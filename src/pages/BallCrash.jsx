import { useEffect, useRef } from 'react';
import '@/styles/ball-crash.css';

export default function BallCrash() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const $ = (s) => root.querySelector(s);
    const modal = $('#modal');
    let best = Number(localStorage.getItem('ball-crash-best') || 0);
    const menu = $('#menuScreen');
    const gameScreen = $('#gameScreen');
    const canvas = $('#game');
    const ctx = canvas.getContext('2d');
    const COLORS = ['#42ff79', '#3be8ff', '#8e63ff', '#ffcc45', '#ff5b7f', '#ff8d45', '#ff4cf0'];
    let targets = [], shot = null, particles = [], floaters = [], score = 0, nextValue = 1,
      turn = 0, combo = 0, aiming = false, aimX = 0, aimY = 0, last = 0, raf = 0,
      running = false, scale = 1, gameOver = false;

    $('#best').textContent = String(best).padStart(2, '0');

    const buzz = (ms = 18) => {
      if (navigator.vibrate && localStorage.getItem('haptics') !== 'off') navigator.vibrate(ms);
    };

    function open(label, title, body) {
      buzz();
      $('#modalLabel').textContent = label;
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = body;
      modal.showModal();
    }

    $('#how').onclick = () => open('QUICK GUIDE', 'HOW TO PLAY',
      '<ol><li>Drag upward to aim, then release to shoot.</li><li>Hit an equal number to merge it. Nearby matches create chain reactions.</li><li>Every few shots the stack advances. Keep every ball below the warning line.</li></ol>');
    $('#scores').onclick = () => open('PERSONAL RECORD', 'HIGH SCORE',
      `<div class="score">${best}</div><p class="tagline">Your best run so far. Build chains to multiply every merge.</p>`);
    $('#settings').onclick = () => open('GAME OPTIONS', 'SETTINGS',
      '<div class="setting"><span>Sound effects</span><button class="toggle" data-key="sound">ON</button></div><div class="setting"><span>Haptics</span><button class="toggle" data-key="haptics">ON</button></div>');
    $('.close').onclick = () => modal.close();
    modal.onclick = (e) => {
      if (e.target === modal && !gameOver) modal.close();
      const t = e.target.closest('.toggle');
      if (t) {
        const on = t.textContent === 'ON';
        t.textContent = on ? 'OFF' : 'ON';
        t.style.background = on ? '#343a47' : 'var(--green)';
        localStorage.setItem(t.dataset.key, on ? 'off' : 'on');
        buzz();
      }
    };
    $('#sound').onclick = (e) => {
      const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      localStorage.setItem('sound', on ? 'on' : 'off');
      buzz();
    };

    function resize() {
      const r = canvas.parentElement.getBoundingClientRect();
      scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.floor(r.width * scale);
      canvas.height = Math.floor(r.height * scale);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }
    function size() { return { w: canvas.width / scale, h: canvas.height / scale }; }
    function radius() { return Math.min(27, size().w * .07); }

    function updateHud() {
      $('#score').textContent = score;
      $('#gameBest').textContent = best;
      $('#nextBall').textContent = nextValue;
      $('#nextBall').style.background = COLORS[(nextValue - 1) % COLORS.length];
      $('#status').textContent = combo > 1 ? `CHAIN x${combo}` : `ROW IN ${3 - turn % 3} SHOTS`;
    }

    function reset() {
      score = 0; turn = 0; combo = 0; shot = null; particles = []; floaters = [];
      nextValue = 1; gameOver = false;
      const { w, h } = size(), r = radius();
      targets = [
        { x: w * .15, y: h - r - 15, v: 1 },
        { x: w * .32, y: h - r - 15, v: 2 },
        { x: w * .70, y: h - r - 15, v: 3 },
        { x: w * .87, y: h - r - 15, v: 3 },
        { x: w * .18, y: h - r * 3 - 25, v: 1 }
      ].map((o) => ({ ...o, r }));
      updateHud();
      $('#tutorial').classList.remove('gone');
    }

    function start() {
      menu.hidden = true;
      gameScreen.hidden = false;
      resize();
      reset();
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      gameScreen.hidden = true;
      menu.hidden = false;
      $('#best').textContent = String(best).padStart(2, '0');
      if (modal.open) modal.close();
    }

    function pointer(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function down(e) {
      if (shot || gameOver) return;
      e.preventDefault();
      aiming = true;
      const p = pointer(e);
      aimX = p.x; aimY = p.y;
      $('#tutorial').classList.add('gone');
    }
    function move(e) {
      if (!aiming) return;
      e.preventDefault();
      const p = pointer(e);
      aimX = p.x; aimY = p.y;
    }
    function up() {
      if (!aiming || shot || gameOver) return;
      aiming = false;
      const { w, h } = size(), o = { x: w / 2, y: h - 25 };
      let dx = aimX - o.x, dy = aimY - o.y;
      if (dy > -45) dy = -190;
      const len = Math.hypot(dx, dy) || 1, speed = 620;
      shot = { x: o.x, y: o.y, r: 10, vx: dx / len * speed, vy: dy / len * speed, v: nextValue, age: 0 };
      nextValue = 1 + Math.floor(Math.random() * Math.min(4, 2 + Math.floor(score / 20)));
      combo = 0;
      updateHud();
      buzz();
    }

    function burst(x, y, color, n = 12) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .7, color });
      }
    }
    function addScore(x, y, value) {
      combo++;
      const gained = value * combo;
      score += gained;
      floaters.push({ x, y, text: `+${gained}${combo > 1 ? '  x' + combo : ''}`, life: 1 });
      if (score > best) { best = score; localStorage.setItem('ball-crash-best', best); }
      updateHud();
    }
    function chainMerge(index) {
      let current = targets[index], merged = true;
      while (merged && current) {
        merged = false;
        for (let i = targets.length - 1; i >= 0; i--) {
          const other = targets[i];
          if (other === current || other.v !== current.v) continue;
          const d = Math.hypot(other.x - current.x, other.y - current.y);
          if (d < current.r + other.r + 18) {
            current.x = (current.x + other.x) / 2;
            current.y = (current.y + other.y) / 2;
            targets.splice(i, 1);
            current.v++;
            current.r = Math.min(current.r + 2, 36);
            addScore(current.x, current.y, current.v);
            burst(current.x, current.y, COLORS[(current.v - 1) % COLORS.length], 16);
            merged = true;
            buzz(32);
            break;
          }
        }
      }
    }
    function settleBoard() {
      const { w, h } = size();
      for (let pass = 0; pass < 8; pass++) {
        for (const t of targets) {
          t.x = Math.max(t.r, Math.min(w - t.r, t.x));
          t.y = Math.min(h - t.r - 8, t.y);
          for (const o of targets) {
            if (o === t) continue;
            const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy), min = t.r + o.r + 2;
            if (d < min && d > 0) {
              const push = (min - d) / 2;
              t.x += dx / d * push;
              t.y += dy / d * push;
            }
          }
        }
      }
    }
    function attachShot(x, y) {
      if (!shot) return;
      const r = radius(), s = size();
      const t = { x: Math.max(r, Math.min(s.w - r, x)), y: Math.max(r + 10, Math.min(s.h - r - 8, y)), r, v: shot.v };
      targets.push(t);
      shot = null;
      settleBoard();
      endTurn();
    }
    function hitTarget() {
      if (!shot) return false;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i], dx = shot.x - t.x, dy = shot.y - t.y, d = Math.hypot(dx, dy);
        if (d < shot.r + t.r) {
          const nx = dx / (d || 1), ny = dy / (d || 1);
          if (shot.v === t.v) {
            t.v++; t.r = Math.min(t.r + 2, 36);
            shot = null;
            addScore(t.x, t.y, t.v);
            burst(t.x, t.y, COLORS[(t.v - 1) % COLORS.length], 18);
            buzz(38);
            chainMerge(i);
            settleBoard();
            endTurn();
          } else {
            attachShot(t.x + nx * (t.r + radius() + 2), t.y + ny * (t.r + radius() + 2));
          }
          return true;
        }
      }
      return false;
    }
    function addRow() {
      const { w, h } = size(), r = radius();
      targets.forEach((t) => t.y -= r * 1.75);
      const count = 3 + Math.min(2, Math.floor(score / 35));
      for (let i = 0; i < count; i++) {
        const x = r + (i + .5) * (w - r * 2) / count + (Math.random() - .5) * 12,
          v = 1 + Math.floor(Math.random() * Math.min(4, 2 + score / 25));
        targets.push({ x, y: h - r - 8, r, v });
      }
      settleBoard();
      burst(w / 2, h - 12, '#3be8ff', 20);
    }
    function endTurn() {
      turn++;
      if (turn % 3 === 0) addRow();
      updateHud();
      checkGameOver();
    }
    function checkGameOver() {
      const danger = 118;
      if (targets.some((t) => t.y - t.r < danger)) {
        gameOver = true; aiming = false; shot = null;
        running = false; cancelAnimationFrame(raf);
        buzz(100);
        open('RUN COMPLETE', 'GAME OVER',
          `<div class="score">${score}</div><p class="tagline">Best ${best} · ${turn} shots survived</p><button class="play again" id="playAgain"><span><small>TRY</small>AGAIN</span><b>↻</b></button>`);
        $('#playAgain').onclick = () => {
          modal.close();
          running = true;
          resize();
          reset();
          last = performance.now();
          raf = requestAnimationFrame(loop);
        };
      }
    }
    function physics(dt) {
      const { w, h } = size();
      if (shot) {
        shot.age += dt;
        shot.vy += 70 * dt;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.x < shot.r) { shot.x = shot.r; shot.vx = Math.abs(shot.vx) * .94; }
        if (shot.x > w - shot.r) { shot.x = w - shot.r; shot.vx = -Math.abs(shot.vx) * .94; }
        if (shot.y < shot.r) { shot.y = shot.r; shot.vy = Math.abs(shot.vy) * .9; }
        if (hitTarget()) return;
        if (shot && shot.y > h + 25) { shot = null; endTurn(); }
        else if (shot && shot.age > 6) attachShot(shot.x, Math.min(shot.y, h - radius() - 8));
      }
      for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt; }
      particles = particles.filter((p) => p.life > 0);
      for (const f of floaters) { f.y -= 35 * dt; f.life -= dt; }
      floaters = floaters.filter((f) => f.life > 0);
    }
    function circle(x, y, r, v) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[(v - 1) % COLORS.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = v === 3 ? '#fff' : '#080a0f';
      ctx.font = `900 ${Math.max(19, r)}px 'Barlow Condensed',sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v, x, y + 1);
    }
    function trajectory() {
      const { w, h } = size(), o = { x: w / 2, y: h - 25 },
        dx = aimX - o.x, dy = Math.min(aimY - o.y, -45), len = Math.hypot(dx, dy) || 1;
      let x = o.x, y = o.y, vx = dx / len * 26, vy = dy / len * 26;
      for (let i = 1; i < 17; i++) {
        x += vx; y += vy;
        if (x < 8 || x > w - 8) vx *= -1;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, 5 - i * .18), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${1 - i / 19})`;
        ctx.fill();
      }
    }
    function draw() {
      const { w, h } = size();
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff0b';
      ctx.lineWidth = 1;
      for (let y = 24; y < h; y += 42) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.setLineDash([7, 7]);
      ctx.strokeStyle = '#ff5b7f88';
      ctx.beginPath(); ctx.moveTo(0, 118); ctx.lineTo(w, 118); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff5b7faa';
      ctx.font = '800 9px Inter';
      ctx.textAlign = 'left';
      ctx.fillText('DANGER', 10, 108);
      if (aiming && !shot) trajectory();
      for (const t of targets) circle(t.x, t.y, t.r, t.v);
      if (shot) circle(shot.x, shot.y, shot.r, shot.v);
      else if (!gameOver) circle(w / 2, h - 25, 10, nextValue);
      if (!shot && !gameOver) {
        ctx.beginPath();
        ctx.arc(w / 2, h - 25, 17, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff44';
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / .7);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      for (const f of floaters) {
        ctx.globalAlpha = Math.max(0, f.life);
        ctx.fillStyle = '#fff';
        ctx.font = '900 17px Barlow Condensed';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
    }
    function loop(now) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, .025);
      last = now;
      physics(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    $('#play').onclick = start;
    $('#menuButton').onclick = stop;
    $('#restart').onclick = () => { resize(); reset(); };

    const onResize = () => { if (running) { resize(); reset(); } };
    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (modal.open) modal.close();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <main className="app" id="menuScreen">
        <div className="glow g1"></div>
        <div className="glow g2"></div>
        <header>
          <button className="icon" id="sound" aria-label="Toggle sound" aria-pressed="true">♪</button>
          <div className="best"><small>BEST</small><b id="best">00</b></div>
          <button className="icon" id="settings" aria-label="Settings">⚙</button>
        </header>
        <section className="hero">
          <div className="balls" aria-hidden="true">
            <i className="b3">3</i><i className="b2">2</i><i className="b1">1</i>
          </div>
          <p className="eyebrow">AIM · BOUNCE · MERGE</p>
          <h1>BALL<br /><span>CRASH</span></h1>
          <p className="tagline">One shot. One chain.<br />How high can you climb?</p>
        </section>
        <nav>
          <button className="play" id="play">
            <span><small>START</small>PLAY</span>
            <b>➔</b>
          </button>
          <div className="row">
            <button className="secondary" id="how"><i>?</i> HOW TO PLAY</button>
            <button className="secondary" id="scores"><i>♛</i> SCORES</button>
          </div>
        </nav>
        <footer><span>V0.2</span><i></i><span>READY TO CRASH</span></footer>
      </main>

      <main className="game-screen" id="gameScreen" hidden>
        <header className="game-header">
          <button id="menuButton" className="game-menu" aria-label="Return to menu">
            <span>≡</span><small>MENU</small>
          </button>
          <div className="round"><small>SCORE</small><b id="score">0</b></div>
          <div className="game-best"><span>♛</span><div><small>BEST</small><b id="gameBest">0</b></div></div>
        </header>
        <section className="canvas-wrap">
          <canvas id="game" aria-label="Ball Crash game area"></canvas>
          <div className="tutorial" id="tutorial"><b>DRAG TO AIM</b><span>Release to shoot</span></div>
        </section>
        <div className="next-bar">
          <span>NEXT</span><i id="nextBall">1</i><p id="status">MATCH EQUAL NUMBERS</p><button id="restart" aria-label="Restart game">↻</button>
        </div>
      </main>

      <dialog id="modal">
        <section>
          <button className="close" aria-label="Close">×</button>
          <small id="modalLabel"></small>
          <h2 id="modalTitle"></h2>
          <div id="modalBody"></div>
        </section>
      </dialog>
    </div>
  );
}