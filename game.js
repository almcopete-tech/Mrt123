const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const waveEl = document.getElementById('wave');
const weaponEl = document.getElementById('weapon');
const skillCooldownEl = document.getElementById('skillCooldown');
const highScoreEl = document.getElementById('highScore');

const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');

const joystickZone = document.getElementById('joystickZone');
const joystickBase = document.getElementById('joystickBase');
const joystickKnob = document.getElementById('joystickKnob');
const shootBtn = document.getElementById('shootBtn');
const skillBtn = document.getElementById('skillBtn');

let gameState = 'menu';
let lastTime = 0;
let spawnTimer = 0;
let powerupTimer = 0;
let stars = [];

const state = {
  score: 0,
  health: 100,
  wave: 1,
  highScore: Number(localStorage.getItem('neon-high-score') || 0),
  lastWaveScore: 0,
  skillReadyAt: 0,
  rapidFireUntil: 0,
  shieldUntil: 0,
  weaponLevel: 1,
};

highScoreEl.textContent = state.highScore;

const player = {
  x: canvas.width / 2,
  y: canvas.height - 110,
  radius: 16,
  speed: 280,
  dx: 0,
  dy: 0,
  shooting: false,
  shootCooldown: 0,
};

const bullets = [];
const enemies = [];
const particles = [];
const powerups = [];

for (let i = 0; i < 85; i += 1) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    speed: Math.random() * 35 + 18,
  });
}

function resetGame() {
  state.score = 0;
  state.health = 100;
  state.wave = 1;
  state.lastWaveScore = 0;
  state.skillReadyAt = 0;
  state.rapidFireUntil = 0;
  state.shieldUntil = 0;
  state.weaponLevel = 1;

  player.x = canvas.width / 2;
  player.y = canvas.height - 110;
  player.dx = 0;
  player.dy = 0;
  player.shooting = false;
  player.shootCooldown = 0;

  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  powerups.length = 0;

  spawnTimer = 0;
  powerupTimer = 6;
  updateHud();
}

function updateHud() {
  scoreEl.textContent = state.score;
  healthEl.textContent = Math.max(0, Math.round(state.health));
  waveEl.textContent = state.wave;

  const weaponMap = {
    1: 'Pulse x1',
    2: 'Pulse x2',
    3: 'Pulse x3',
  };
  weaponEl.textContent = weaponMap[state.weaponLevel] || 'Pulse x1';

  const remaining = Math.max(0, state.skillReadyAt - performance.now());
  skillCooldownEl.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : 'Lista';

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('neon-high-score', String(state.highScore));
    highScoreEl.textContent = state.highScore;
  }
}

function spawnEnemy() {
  const typeRoll = Math.random();
  let type = 'basic';
  if (typeRoll > 0.86) type = 'tank';
  else if (typeRoll > 0.65) type = 'zigzag';

  const base = {
    x: Math.random() * (canvas.width - 36) + 18,
    y: -30,
    radius: 14,
    speed: 85 + state.wave * 8,
    hp: 1 + Math.floor(state.wave / 2),
    color: '#ff6fa8',
    type,
    zigzagPhase: Math.random() * Math.PI * 2,
  };

  if (type === 'tank') {
    base.radius = 20;
    base.speed *= 0.7;
    base.hp += 4;
    base.color = '#ff9f68';
  }

  if (type === 'zigzag') {
    base.speed *= 1.2;
    base.color = '#9d89ff';
  }

  enemies.push(base);
}

function spawnPowerup() {
  const kind = ['heal', 'rapid', 'weapon', 'shield'][Math.floor(Math.random() * 4)];
  powerups.push({
    x: Math.random() * (canvas.width - 28) + 14,
    y: -20,
    radius: 12,
    speed: 110,
    kind,
  });
}

function shoot() {
  const spread = state.weaponLevel - 1;
  const count = state.weaponLevel;

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    bullets.push({
      x: player.x + t * 22,
      y: player.y - player.radius,
      vx: t * 45,
      vy: -420,
      radius: 4,
      color: '#8bf9ff',
      damage: 1 + spread * 0.5,
    });
  }
}

function applyPowerup(kind) {
  if (kind === 'heal') state.health = Math.min(100, state.health + 30);
  if (kind === 'rapid') state.rapidFireUntil = performance.now() + 7000;
  if (kind === 'weapon') state.weaponLevel = Math.min(3, state.weaponLevel + 1);
  if (kind === 'shield') state.shieldUntil = performance.now() + 7000;

  if (navigator.vibrate) navigator.vibrate(20);
}

function triggerSkill() {
  const now = performance.now();
  if (now < state.skillReadyAt || gameState !== 'playing') return;

  state.skillReadyAt = now + 14000;

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.hp -= 4;
    for (let p = 0; p < 10; p += 1) {
      particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
        life: 0.45,
        color: '#cc9dff',
      });
    }

    if (enemy.hp <= 0) {
      state.score += 14;
      enemies.splice(i, 1);
    }
  }

  if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
}

function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= (a.radius + b.radius) ** 2;
}

function handleCollisions() {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      if (!circleHit(bullet, enemy)) continue;

      enemy.hp -= bullet.damage;
      bullets.splice(i, 1);

      particles.push({
        x: bullet.x,
        y: bullet.y,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        life: 0.25,
        color: '#9af7ff',
      });

      if (enemy.hp <= 0) {
        state.score += enemy.type === 'tank' ? 18 : 10;
        enemies.splice(j, 1);

        for (let p = 0; p < 12; p += 1) {
          particles.push({
            x: enemy.x,
            y: enemy.y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.55,
            color: enemy.color,
          });
        }
      }
      break;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    if (circleHit(player, enemy)) {
      enemies.splice(i, 1);
      const protectedByShield = performance.now() < state.shieldUntil;
      if (!protectedByShield) state.health -= 16;
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    if (circleHit(player, powerups[i])) {
      applyPowerup(powerups[i].kind);
      powerups.splice(i, 1);
    }
  }
}

function update(dt) {
  if (gameState !== 'playing') return;

  const now = performance.now();

  player.x += player.dx * player.speed * dt;
  player.y += player.dy * player.speed * dt;
  player.x = Math.max(player.radius + 4, Math.min(canvas.width - player.radius - 4, player.x));
  player.y = Math.max(80, Math.min(canvas.height - player.radius - 4, player.y));

  const fireRate = now < state.rapidFireUntil ? 0.07 : 0.16;
  player.shootCooldown -= dt;
  if (player.shooting && player.shootCooldown <= 0) {
    shoot();
    player.shootCooldown = fireRate;
  }

  spawnTimer -= dt;
  const spawnRate = Math.max(0.22, 1.2 - state.wave * 0.1);
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = spawnRate;
  }

  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    spawnPowerup();
    powerupTimer = 9 + Math.random() * 3;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -20 || b.x < -20 || b.x > canvas.width + 20) bullets.splice(i, 1);
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    e.y += e.speed * dt;
    if (e.type === 'zigzag') {
      e.zigzagPhase += dt * 6;
      e.x += Math.sin(e.zigzagPhase) * 95 * dt;
    }

    if (e.y - e.radius > canvas.height + 20) {
      enemies.splice(i, 1);
      if (performance.now() >= state.shieldUntil) state.health -= 8;
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    powerups[i].y += powerups[i].speed * dt;
    if (powerups[i].y > canvas.height + 20) powerups.splice(i, 1);
  }

  for (const star of stars) {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = -2;
      star.x = Math.random() * canvas.width;
    }
  }

  handleCollisions();

  if (state.score - state.lastWaveScore >= 180) {
    state.wave += 1;
    state.lastWaveScore = state.score;
    state.health = Math.min(100, state.health + 8);
  }

  if (state.health <= 0) {
    gameState = 'menu';
    overlay.classList.add('show');
    startBtn.textContent = `Reintentar (puntos ${state.score})`;
  }

  updateHud();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const star of stars) {
    ctx.fillStyle = '#90a6ff';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const bullet of bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff66';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const pu of powerups) {
    const colorMap = {
      heal: '#80ff9b',
      rapid: '#8de5ff',
      weapon: '#ffd167',
      shield: '#dba0ff',
    };
    ctx.fillStyle = colorMap[pu.kind];
    ctx.beginPath();
    ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#10172a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const char = pu.kind === 'heal' ? '+' : pu.kind === 'rapid' ? 'R' : pu.kind === 'weapon' ? 'W' : 'S';
    ctx.fillText(char, pu.x, pu.y + 0.5);
  }

  const shieldActive = performance.now() < state.shieldUntil;
  if (shieldActive) {
    ctx.strokeStyle = '#d2a8ffbb';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#7cf7ff';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - player.radius - 6);
  ctx.lineTo(player.x - player.radius, player.y + player.radius);
  ctx.lineTo(player.x + player.radius, player.y + player.radius);
  ctx.closePath();
  ctx.fill();

  if (gameState === 'paused') {
    ctx.fillStyle = '#00000088';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSA', canvas.width / 2, canvas.height / 2);
  }
}

function loop(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0);
  lastTime = ts;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function normalizeStick(dx, dy) {
  const len = Math.hypot(dx, dy) || 1;
  const max = 42;
  const clamped = Math.min(len, max);

  joystickKnob.style.transform = `translate(${(dx / len) * clamped}px, ${(dy / len) * clamped}px)`;
  player.dx = dx / max;
  player.dy = dy / max;
}

joystickZone.addEventListener('pointerdown', (e) => {
  if (gameState !== 'playing') return;
  joystickBase.classList.remove('hidden');
  joystickBase.style.left = `${e.offsetX}px`;
  joystickBase.style.top = `${e.offsetY}px`;
  joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickZone.setPointerCapture(e.pointerId);
});

joystickZone.addEventListener('pointermove', (e) => {
  if (gameState !== 'playing' || joystickBase.classList.contains('hidden')) return;
  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  normalizeStick(e.clientX - centerX, e.clientY - centerY);
});

function releaseStick() {
  joystickBase.classList.add('hidden');
  joystickKnob.style.transform = 'translate(0px, 0px)';
  player.dx = 0;
  player.dy = 0;
}

joystickZone.addEventListener('pointerup', releaseStick);
joystickZone.addEventListener('pointercancel', releaseStick);

shootBtn.addEventListener('pointerdown', () => {
  if (gameState !== 'playing') return;
  player.shooting = true;
});
shootBtn.addEventListener('pointerup', () => {
  player.shooting = false;
});
shootBtn.addEventListener('pointercancel', () => {
  player.shooting = false;
});

skillBtn.addEventListener('click', triggerSkill);

startBtn.addEventListener('click', () => {
  resetGame();
  gameState = 'playing';
  overlay.classList.remove('show');
  startBtn.textContent = 'Iniciar partida';
});

pauseBtn.addEventListener('click', () => {
  if (gameState === 'playing') gameState = 'paused';
  else if (gameState === 'paused') gameState = 'playing';
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') player.shooting = true;
  if (e.code === 'KeyP') pauseBtn.click();
  if (e.code === 'KeyX') triggerSkill();

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') player.dx = -1;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') player.dx = 1;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') player.dy = -1;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') player.dy = 1;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') player.shooting = false;
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) player.dx = 0;
  if (['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(e.code)) player.dy = 0;
});

requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(loop);
});
