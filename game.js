"use strict";

/* ============================================================
   Tactical Touch Shooter
   A self-contained HTML5 canvas shooter built for touch screens
   (with mouse/keyboard fallback for desktop testing).
   ============================================================ */

(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // DOM references
  const hud = document.getElementById("hud");
  const scoreEl = document.getElementById("score");
  const waveEl = document.getElementById("wave");
  const livesEl = document.getElementById("lives");
  const startScreen = document.getElementById("start-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const finalScoreEl = document.getElementById("final-score");
  const finalWaveEl = document.getElementById("final-wave");
  const bestScoreEl = document.getElementById("best-score");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const pauseBtn = document.getElementById("pause-btn");

  // Logical (CSS pixel) dimensions; updated on resize.
  let W = window.innerWidth;
  let H = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Game state ----------
  const STATE = { MENU: "menu", PLAYING: "playing", PAUSED: "paused", OVER: "over" };
  let state = STATE.MENU;

  const game = {
    score: 0,
    wave: 1,
    lives: 3,
    spawnTimer: 0,
    spawnInterval: 1.1,
    enemiesThisWave: 0,
    enemiesSpawned: 0,
    waveBanner: 0,
    shake: 0,
  };

  let best = parseInt(localStorage.getItem("tts_best") || "0", 10) || 0;

  // Entities
  let player = null;
  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let powerups = [];
  let stars = [];

  // Input
  const pointer = { active: false, x: W / 2, y: H * 0.8, hasMoved: false };
  const keys = {};

  // ---------- Helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  function initStars() {
    stars = [];
    const count = Math.round((W * H) / 9000);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        z: rand(0.3, 1),
        r: rand(0.4, 1.6),
      });
    }
  }
  initStars();

  // ---------- Player ----------
  function makePlayer() {
    return {
      x: W / 2,
      y: H * 0.8,
      r: 18,
      speed: 520,
      fireTimer: 0,
      fireRate: 0.18,
      power: 1, // 1,2,3 spread levels
      invuln: 0,
    };
  }

  // ---------- Spawning ----------
  function startWave(n) {
    game.wave = n;
    game.enemiesThisWave = 4 + n * 2;
    game.enemiesSpawned = 0;
    game.spawnInterval = Math.max(0.35, 1.1 - n * 0.05);
    game.waveBanner = 2.0;
    waveEl.textContent = String(n);
  }

  function spawnEnemy() {
    const t = Math.random();
    let type = "grunt";
    if (game.wave >= 3 && t > 0.82) type = "zigzag";
    else if (game.wave >= 2 && t > 0.6) type = "shooter";

    const r = type === "shooter" ? 20 : 16;
    const x = rand(r + 10, W - r - 10);
    const baseHp = type === "shooter" ? 3 : type === "zigzag" ? 2 : 1;
    enemies.push({
      type,
      x,
      y: -r,
      r,
      hp: baseHp + Math.floor(game.wave / 4),
      vy: rand(60, 90) + game.wave * 4,
      vx: 0,
      phase: rand(0, Math.PI * 2),
      fireTimer: rand(0.8, 2.2),
      hitFlash: 0,
    });
    game.enemiesSpawned++;
  }

  // ---------- Effects ----------
  function explode(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 260);
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.3, 0.8),
        maxLife: 0.8,
        r: rand(1.5, 4),
        color,
      });
    }
  }

  function spawnPowerup(x, y) {
    const kinds = ["power", "life"];
    const kind = Math.random() < 0.82 ? "power" : "life";
    powerups.push({ x, y, r: 13, vy: 90, kind, t: 0 });
  }

  // ---------- Game flow ----------
  function resetGame() {
    game.score = 0;
    game.wave = 1;
    game.lives = 3;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerups = [];
    player = makePlayer();
    pointer.x = player.x;
    pointer.y = player.y;
    pointer.active = false;
    startWave(1);
    updateHud();
  }

  function startGame() {
    resetGame();
    state = STATE.PLAYING;
    startScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    pauseBtn.classList.remove("hidden");
    lastTime = performance.now();
  }

  function gameOver() {
    state = STATE.OVER;
    if (game.score > best) {
      best = game.score;
      localStorage.setItem("tts_best", String(best));
    }
    finalScoreEl.textContent = String(game.score);
    finalWaveEl.textContent = String(game.wave);
    bestScoreEl.textContent = String(best);
    gameoverScreen.classList.remove("hidden");
    hud.classList.add("hidden");
    pauseBtn.classList.add("hidden");
  }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      pauseBtn.textContent = "▶";
    } else if (state === STATE.PAUSED) {
      state = STATE.PLAYING;
      pauseBtn.textContent = "II";
      lastTime = performance.now();
    }
  }

  function updateHud() {
    scoreEl.textContent = String(game.score);
    waveEl.textContent = String(game.wave);
    livesEl.innerHTML = "";
    for (let i = 0; i < game.lives; i++) {
      const d = document.createElement("div");
      d.className = "life";
      livesEl.appendChild(d);
    }
  }

  // ---------- Update ----------
  function update(dt) {
    // Stars scroll
    for (const s of stars) {
      s.y += s.z * 40 * dt;
      if (s.y > H) { s.y = 0; s.x = rand(0, W); }
    }

    if (state !== STATE.PLAYING) return;

    if (game.waveBanner > 0) game.waveBanner -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 60);

    updatePlayer(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updatePowerups(dt);
    updateParticles(dt);
    handleSpawning(dt);
    checkWaveComplete();
  }

  function updatePlayer(dt) {
    const p = player;
    if (p.invuln > 0) p.invuln -= dt;

    // Pointer drag steering (lerp toward pointer for smooth feel)
    if (pointer.active) {
      p.x += (pointer.x - p.x) * Math.min(1, dt * 14);
      p.y += (pointer.y - p.y) * Math.min(1, dt * 14);
    }
    // Keyboard fallback
    let kx = 0, ky = 0;
    if (keys["ArrowLeft"] || keys["a"]) kx -= 1;
    if (keys["ArrowRight"] || keys["d"]) kx += 1;
    if (keys["ArrowUp"] || keys["w"]) ky -= 1;
    if (keys["ArrowDown"] || keys["s"]) ky += 1;
    p.x += kx * p.speed * dt;
    p.y += ky * p.speed * dt;

    p.x = clamp(p.x, p.r, W - p.r);
    p.y = clamp(p.y, p.r, H - p.r);

    // Auto fire
    p.fireTimer -= dt;
    if (p.fireTimer <= 0) {
      p.fireTimer = p.fireRate;
      fire();
    }
  }

  function fire() {
    const p = player;
    const speed = 720;
    const shots = [];
    if (p.power <= 1) {
      shots.push(0);
    } else if (p.power === 2) {
      shots.push(-0.09, 0.09);
    } else {
      shots.push(-0.16, 0, 0.16);
    }
    for (const ang of shots) {
      bullets.push({
        x: p.x + Math.sin(ang) * 14,
        y: p.y - 16,
        vx: Math.sin(ang) * speed,
        vy: -Math.cos(ang) * speed,
        r: 4,
      });
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) {
        bullets.splice(i, 1);
        continue;
      }
      // hit enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) * (b.r + e.r)) {
          e.hp--;
          e.hitFlash = 0.08;
          bullets.splice(i, 1);
          explode(b.x, b.y, "#9ffcf0", 4);
          if (e.hp <= 0) killEnemy(j);
          break;
        }
      }
    }
  }

  function killEnemy(index) {
    const e = enemies[index];
    const pts = e.type === "shooter" ? 30 : e.type === "zigzag" ? 20 : 10;
    game.score += pts;
    scoreEl.textContent = String(game.score);
    explode(e.x, e.y, e.type === "shooter" ? "#ff9bb0" : "#7df7ea", 18);
    game.shake = Math.min(12, game.shake + 4);
    if (Math.random() < 0.12) spawnPowerup(e.x, e.y);
    enemies.splice(index, 1);
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.vy * dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (e.type === "zigzag") {
        e.phase += dt * 3;
        e.x += Math.sin(e.phase) * 130 * dt;
        e.x = clamp(e.x, e.r, W - e.r);
      }

      if (e.type === "shooter") {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.y > 0 && e.y < H * 0.7) {
          e.fireTimer = rand(1.4, 2.6);
          const dx = player.x - e.x, dy = player.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 240;
          enemyBullets.push({ x: e.x, y: e.y + e.r, vx: (dx / d) * sp, vy: (dy / d) * sp, r: 5 });
        }
      }

      // Reached bottom -> player loses a life
      if (e.y - e.r > H) {
        enemies.splice(i, 1);
        loseLife();
        continue;
      }

      // Collide with player
      if (player.invuln <= 0 && dist2(e.x, e.y, player.x, player.y) < (e.r + player.r) * (e.r + player.r)) {
        explode(e.x, e.y, "#ff9bb0", 16);
        enemies.splice(i, 1);
        loseLife();
      }
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
        enemyBullets.splice(i, 1);
        continue;
      }
      if (player.invuln <= 0 && dist2(b.x, b.y, player.x, player.y) < (b.r + player.r) * (b.r + player.r)) {
        enemyBullets.splice(i, 1);
        loseLife();
      }
    }
  }

  function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.y += pu.vy * dt;
      pu.t += dt;
      if (pu.y > H + 30) { powerups.splice(i, 1); continue; }
      if (dist2(pu.x, pu.y, player.x, player.y) < (pu.r + player.r) * (pu.r + player.r)) {
        if (pu.kind === "life") {
          game.lives = Math.min(5, game.lives + 1);
          updateHud();
        } else {
          player.power = Math.min(3, player.power + 1);
        }
        explode(pu.x, pu.y, pu.kind === "life" ? "#ff4d6d" : "#ffd166", 14);
        powerups.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function loseLife() {
    if (player.invuln > 0) return;
    game.lives--;
    player.power = Math.max(1, player.power - 1);
    player.invuln = 1.6;
    game.shake = 14;
    updateHud();
    explode(player.x, player.y, "#ff4d6d", 24);
    if (game.lives <= 0) gameOver();
  }

  function handleSpawning(dt) {
    if (game.enemiesSpawned >= game.enemiesThisWave) return;
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      game.spawnTimer = game.spawnInterval;
      spawnEnemy();
    }
  }

  function checkWaveComplete() {
    if (game.enemiesSpawned >= game.enemiesThisWave && enemies.length === 0) {
      startWave(game.wave + 1);
    }
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, W, H);

    let sx = 0, sy = 0;
    if (game.shake > 0) {
      sx = rand(-game.shake, game.shake);
      sy = rand(-game.shake, game.shake);
    }
    ctx.save();
    ctx.translate(sx, sy);

    drawStars();

    if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.OVER) {
      drawPowerups();
      drawBullets();
      drawEnemyBullets();
      drawEnemies();
      drawParticles();
      if (player && state !== STATE.OVER) drawPlayer();
    }

    ctx.restore();

    if (game.waveBanner > 0 && state === STATE.PLAYING) drawWaveBanner();
    if (state === STATE.PAUSED) drawPauseOverlay();
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = s.z;
      ctx.fillStyle = "#9fb6ff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    const p = player;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;

    // engine glow
    const grd = ctx.createRadialGradient(0, 10, 2, 0, 14, 22);
    grd.addColorStop(0, "rgba(24,224,200,0.9)");
    grd.addColorStop(1, "rgba(24,224,200,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(-22, 6, 44, 30);

    // ship body
    ctx.fillStyle = "#18e0c8";
    ctx.strokeStyle = "#caffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -p.r);
    ctx.lineTo(p.r * 0.85, p.r * 0.8);
    ctx.lineTo(0, p.r * 0.45);
    ctx.lineTo(-p.r * 0.85, p.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // cockpit
    ctx.fillStyle = "#05202a";
    ctx.beginPath();
    ctx.arc(0, -2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets() {
    ctx.fillStyle = "#affff4";
    ctx.shadowColor = "#18e0c8";
    ctx.shadowBlur = 8;
    for (const b of bullets) {
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r, b.r * 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawEnemyBullets() {
    ctx.fillStyle = "#ffcaca";
    ctx.shadowColor = "#ff4d6d";
    ctx.shadowBlur = 8;
    for (const b of enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawEnemies() {
    for (const e of enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const flash = e.hitFlash > 0;
      let color = "#ff4d6d";
      if (e.type === "shooter") color = "#ff8a3d";
      else if (e.type === "zigzag") color = "#c46dff";
      ctx.fillStyle = flash ? "#ffffff" : color;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (e.type === "shooter") {
        // hexagon
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
      } else if (e.type === "zigzag") {
        // diamond
        ctx.moveTo(0, -e.r);
        ctx.lineTo(e.r, 0);
        ctx.lineTo(0, e.r);
        ctx.lineTo(-e.r, 0);
      } else {
        // inverted triangle (grunt)
        ctx.moveTo(0, e.r);
        ctx.lineTo(e.r * 0.9, -e.r * 0.7);
        ctx.lineTo(-e.r * 0.9, -e.r * 0.7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(5,7,15,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerups() {
    for (const pu of powerups) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.rotate(pu.t * 2);
      const isLife = pu.kind === "life";
      ctx.fillStyle = isLife ? "#ff4d6d" : "#ffd166";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        ctx.lineTo(Math.cos(a) * pu.r, Math.sin(a) * pu.r);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * pu.r * 0.45, Math.sin(a + Math.PI / 4) * pu.r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#05070f";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.rotate(-pu.t * 2);
      ctx.fillText(isLife ? "+" : "P", 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWaveBanner() {
    const a = Math.min(1, game.waveBanner) * Math.min(1, (2 - game.waveBanner) * 2 + 0.3);
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = "#e8f1ff";
    ctx.font = "900 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#18e0c8";
    ctx.shadowBlur = 18;
    ctx.fillText("OLEADA " + game.wave, W / 2, H * 0.4);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawPauseOverlay() {
    ctx.fillStyle = "rgba(5,7,15,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e8f1ff";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSA", W / 2, H / 2);
  }

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function loop(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- Input handling ----------
  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function onDown(e) {
    if (state !== STATE.PLAYING) return;
    e.preventDefault();
    const pos = pointerPos(e);
    pointer.active = true;
    pointer.x = pos.x;
    pointer.y = pos.y;
  }
  function onMove(e) {
    if (!pointer.active || state !== STATE.PLAYING) return;
    e.preventDefault();
    const pos = pointerPos(e);
    pointer.x = pos.x;
    pointer.y = pos.y;
  }
  function onUp(e) {
    pointer.active = false;
  }

  canvas.addEventListener("touchstart", onDown, { passive: false });
  canvas.addEventListener("touchmove", onMove, { passive: false });
  canvas.addEventListener("touchend", onUp, { passive: false });
  canvas.addEventListener("touchcancel", onUp, { passive: false });
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === "p" || e.key === "P") togglePause();
    if (e.key === " " && (state === STATE.MENU || state === STATE.OVER)) startGame();
  });
  window.addEventListener("keyup", (e) => { keys[e.key] = false; });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);

  // Initialize best score display
  bestScoreEl.textContent = String(best);

  // Expose minimal API for automated testing / debugging.
  window.__ttsGame = {
    getState: () => state,
    getGame: () => game,
    start: startGame,
    addScore: (n) => { game.score += n; scoreEl.textContent = String(game.score); },
  };
})();
