const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const bestScoreEl = document.querySelector('#bestScore');
const modeEl = document.querySelector('#mode');
const speedEl = document.querySelector('#speed');
const attemptsEl = document.querySelector('#attempts');
const overlay = document.querySelector('#overlay');
const startButton = document.querySelector('#startButton');

const FLOOR = 456;
const CEILING = 72;
const PLAYER_SIZE = 42;
const GRAVITY = 2250;
const JUMP_POWER = 785;
const SHIP_THRUST = 1750;
const LEVEL_COLORS = ['#2df7ff', '#ff3df2', '#b9ff30', '#ff9b25', '#8f7cff'];

let best = Number(localStorage.getItem('dash-prisma-best') || 0);
let attempts = 1;
let running = false;
let holding = false;
let lastTime = 0;
let camera = 0;
let pulse = 0;
let speed = 390;
let nextSpawn = 760;
let objects = [];
let particles = [];

const player = {
  x: 178,
  y: FLOOR - PLAYER_SIZE,
  vy: 0,
  rotation: 0,
  mode: 'cube',
  gravity: 1,
  grounded: true,
  invincible: 0,
};

function reset() {
  camera = 0;
  pulse = 0;
  speed = 390;
  nextSpawn = 760;
  objects = [];
  particles = [];
  Object.assign(player, {
    x: 178,
    y: FLOOR - PLAYER_SIZE,
    vy: 0,
    rotation: 0,
    mode: 'cube',
    gravity: 1,
    grounded: true,
    invincible: 0,
  });
  seedOpening();
  updateHud();
}

function seedOpening() {
  addSpike(720);
  addSpike(980);
  addBlock(1260, FLOOR - 76, 78, 76);
  addOrb(1550, FLOOR - 150);
  addPortal(1890, 'ship');
  addSpike(2260);
  addSpike(2360);
}

function addSpike(x) { objects.push({ type: 'spike', x, y: FLOOR, w: 58, h: 64, lethal: true }); }
function addBlock(x, y, w, h) { objects.push({ type: 'block', x, y, w, h, lethal: false }); }
function addOrb(x, y) { objects.push({ type: 'orb', x, y, r: 20, used: false }); }
function addPortal(x, mode) { objects.push({ type: 'portal', x, y: FLOOR - 168, w: 34, h: 132, mode }); }
function addGravityPortal(x) { objects.push({ type: 'gravity', x, y: FLOOR - 245, w: 34, h: 172 }); }

function generateAhead() {
  while (nextSpawn < camera + canvas.width + 760) {
    const roll = Math.random();
    if (roll < 0.34) {
      addSpike(nextSpawn);
      if (Math.random() > 0.55) addSpike(nextSpawn + 68);
    } else if (roll < 0.58) {
      const h = 54 + Math.random() * 62;
      addBlock(nextSpawn, FLOOR - h, 70 + Math.random() * 44, h);
    } else if (roll < 0.72) {
      addOrb(nextSpawn, FLOOR - 140 - Math.random() * 120);
    } else if (roll < 0.86) {
      addPortal(nextSpawn, player.mode === 'cube' ? 'ship' : 'cube');
    } else {
      addGravityPortal(nextSpawn);
    }
    nextSpawn += 230 + Math.random() * 230;
  }
  objects = objects.filter((obj) => obj.x + (obj.w || obj.r || 0) > camera - 180);
}

function startGame() {
  attempts += running ? 0 : 0;
  reset();
  running = true;
  overlay.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function crash() {
  running = false;
  attempts += 1;
  attemptsEl.textContent = attempts;
  best = Math.max(best, Math.floor(camera / 10));
  localStorage.setItem('dash-prisma-best', best);
  bestScoreEl.textContent = `${best} m`;
  overlay.querySelector('h2').textContent = '¡Otra vez!';
  overlay.querySelector('p').textContent = `Llegaste a ${Math.floor(camera / 10)} m. Pulsa comenzar para reintentar el circuito.`;
  startButton.textContent = 'Reintentar';
  overlay.classList.remove('hidden');
  burst(player.x, player.y + PLAYER_SIZE / 2, '#ff3d5d', 42);
}

function jump() {
  if (!running) return startGame();
  if (player.mode === 'cube' && player.grounded) {
    player.vy = -JUMP_POWER * player.gravity;
    player.grounded = false;
    burst(player.x, player.y + PLAYER_SIZE, '#2df7ff', 10);
  }
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  pulse += dt;
  speed = Math.min(820, speed + dt * 8);
  camera += speed * dt;
  generateAhead();

  if (player.mode === 'ship') {
    player.vy += (holding ? -SHIP_THRUST : GRAVITY * 0.8) * dt;
    player.vy = Math.max(-650, Math.min(650, player.vy));
    player.rotation = player.vy * 0.0011;
  } else {
    player.vy += GRAVITY * player.gravity * dt;
    if (!player.grounded) player.rotation += dt * 8.4 * player.gravity;
  }

  player.y += player.vy * dt;
  player.grounded = false;
  collideWorld();
  collideObjects();

  particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += 620 * dt; });
  particles = particles.filter((p) => p.life > 0);
  updateHud();
}

function collideWorld() {
  if (player.y + PLAYER_SIZE >= FLOOR) {
    player.y = FLOOR - PLAYER_SIZE;
    player.vy = 0;
    player.grounded = player.gravity === 1;
    if (player.mode === 'cube') player.rotation = Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2);
  }
  if (player.y <= CEILING) {
    player.y = CEILING;
    player.vy = 0;
    player.grounded = player.gravity === -1;
  }
}

function collideObjects() {
  const box = { x: player.x + camera, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  for (const obj of objects) {
    if (obj.type === 'orb' && !obj.used && circleRect(obj, box)) {
      obj.used = true;
      player.vy = -JUMP_POWER * 1.08 * player.gravity;
      player.grounded = false;
      burst(obj.x - camera, obj.y, '#b9ff30', 18);
    }
    if (obj.type === 'portal' && rects(box, obj)) {
      player.mode = obj.mode;
      player.gravity = 1;
      player.vy *= 0.35;
      burst(obj.x - camera, obj.y + 60, '#ff3df2', 22);
      obj.x = -9999;
    }
    if (obj.type === 'gravity' && rects(box, obj)) {
      player.gravity *= -1;
      player.vy = 0;
      burst(obj.x - camera, obj.y + 80, '#ff9b25', 22);
      obj.x = -9999;
    }
    if (obj.type === 'block' && rects(box, obj)) {
      if (box.y + box.h - player.vy * 0.016 <= obj.y + 12 && player.gravity === 1) {
        player.y = obj.y - PLAYER_SIZE;
        player.vy = 0;
        player.grounded = true;
      } else {
        crash();
      }
    }
    if (obj.lethal && triangleHit(box, obj)) crash();
  }
}

function rects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(circle, rect) {
  const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  return (circle.x - cx) ** 2 + (circle.y - cy) ** 2 < circle.r ** 2;
}

function triangleHit(rect, spike) {
  return rects(rect, { x: spike.x + 10, y: spike.y - spike.h + 12, w: spike.w - 20, h: spike.h - 12 });
}

function burst(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({ x, y, color, life: 0.35 + Math.random() * 0.45, vx: -160 + Math.random() * 320, vy: -420 + Math.random() * 340 });
  }
}

function draw() {
  const theme = LEVEL_COLORS[Math.floor(camera / 1800) % LEVEL_COLORS.length];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#10153f');
  gradient.addColorStop(0.55, '#17104c');
  gradient.addColorStop(1, '#2a0c44');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid(theme);
  drawGround(theme);
  objects.forEach((obj) => drawObject(obj, theme));
  drawPlayer(theme);
  drawParticles();
}

function drawGrid(theme) {
  ctx.save();
  ctx.globalAlpha = 0.23 + Math.sin(pulse * 5) * 0.05;
  ctx.strokeStyle = theme;
  ctx.lineWidth = 1;
  const offset = -(camera * 0.28) % 48;
  for (let x = offset; x < canvas.width; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = 24; y < canvas.height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  ctx.restore();
}

function drawGround(theme) {
  ctx.fillStyle = '#07091d';
  ctx.fillRect(0, FLOOR, canvas.width, canvas.height - FLOOR);
  ctx.strokeStyle = theme;
  ctx.lineWidth = 5;
  ctx.shadowColor = theme;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  ctx.lineTo(canvas.width, FLOOR);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawObject(obj, theme) {
  const x = obj.x - camera;
  ctx.save();
  ctx.shadowBlur = 18;
  if (obj.type === 'spike') {
    ctx.fillStyle = '#ff3d5d'; ctx.shadowColor = '#ff3d5d';
    ctx.beginPath(); ctx.moveTo(x, obj.y); ctx.lineTo(x + obj.w / 2, obj.y - obj.h); ctx.lineTo(x + obj.w, obj.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
  } else if (obj.type === 'block') {
    ctx.fillStyle = '#17235f'; ctx.shadowColor = theme; ctx.strokeStyle = theme; ctx.lineWidth = 4;
    ctx.fillRect(x, obj.y, obj.w, obj.h); ctx.strokeRect(x, obj.y, obj.w, obj.h);
  } else if (obj.type === 'orb') {
    ctx.globalAlpha = obj.used ? 0.25 : 1;
    ctx.fillStyle = '#b9ff30'; ctx.shadowColor = '#b9ff30';
    ctx.beginPath(); ctx.arc(x, obj.y, obj.r + Math.sin(pulse * 8) * 3, 0, Math.PI * 2); ctx.fill();
  } else if (obj.type === 'portal' || obj.type === 'gravity') {
    ctx.strokeStyle = obj.type === 'portal' ? '#ff3df2' : '#ff9b25'; ctx.shadowColor = ctx.strokeStyle; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(x + obj.w / 2, obj.y + obj.h / 2, obj.w, obj.h / 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(theme) {
  ctx.save();
  ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
  ctx.rotate(player.rotation);
  ctx.fillStyle = player.mode === 'cube' ? theme : '#ff9b25';
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 22;
  if (player.mode === 'ship') {
    ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-22, -20); ctx.lineTo(-12, 0); ctx.lineTo(-22, 20); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
  }
  ctx.restore();
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 5, 5);
    ctx.globalAlpha = 1;
  });
}

function updateHud() {
  scoreEl.textContent = `${Math.floor(camera / 10)} m`;
  bestScoreEl.textContent = `${best} m`;
  modeEl.textContent = player.mode === 'cube' ? 'Cubo' : 'Nave';
  speedEl.textContent = `${(speed / 390).toFixed(1)}x`;
  attemptsEl.textContent = attempts;
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault(); holding = true; jump();
  }
});
window.addEventListener('keyup', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) holding = false;
});
canvas.addEventListener('pointerdown', () => { holding = true; jump(); });
window.addEventListener('pointerup', () => { holding = false; });
startButton.addEventListener('click', startGame);

reset();
draw();
