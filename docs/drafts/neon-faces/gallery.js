// Gallery for the neon face drafts: loads faces/<id>.js in this order and
// draws each live. Query params: t=HH:MM:SS freezes the clock (ambient motion
// keeps running), speed=N runs the clock N times faster, solo=<id> draws one
// face full-page (used by shoot.mjs).
(function () {
  'use strict';
  const IDS = [
    'tube', 'sign', 'nixie', 'radar', 'reactor', 'horizon', 'vector', 'plasma', 'wordclock', 'tach',
    'pulse', 'constellation', 'tunnel', 'outline', 'arcade', 'laser', 'spiro', 'hive', 'pendulum', 'dotmatrix',
  ];
  const N = window.NEON;
  const q = new URLSearchParams(location.search);
  const frozen = q.get('t');
  const speed = parseFloat(q.get('speed') || '1') || 1;
  const solo = q.get('solo');
  const t0 = performance.now();
  const wall0 = Date.now();
  window.__neonErrors = [];

  function nowMs() {
    if (frozen) {
      const [H, M, S] = frozen.split(':').map(Number);
      const d = new Date();
      d.setHours(H || 0, M || 0, S || 0, 0);
      return d.getTime();
    }
    return wall0 + (performance.now() - t0) * speed;
  }

  function load(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.append(s);
    });
  }

  const views = [];
  function makeView(face, canvas, dprCap) {
    const view = { face, canvas, ctx: canvas.getContext('2d', { alpha: false }), state: {}, visible: true, error: null, dprCap };
    size(view);
    return view;
  }
  function size(view) {
    const css = view.canvas.getBoundingClientRect().width || 300;
    const px = Math.round(css * Math.min(window.devicePixelRatio || 1, view.dprCap));
    if (view.canvas.width !== px) {
      view.canvas.width = px;
      view.canvas.height = px;
    }
  }

  function render(view, T) {
    const ctx = view.ctx;
    const S = view.canvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const p = view.face.persist;
    ctx.fillStyle = p ? `rgba(4,4,10,${p})` : N.STAGE;
    ctx.fillRect(0, 0, S, S);
    ctx.setTransform(S / 1000, 0, 0, S / 1000, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(500, 500, 500, 0, N.TAU);
    ctx.clip();
    try {
      view.face.draw(ctx, T, N, view.state);
    } catch (e) {
      if (!view.error) {
        view.error = e;
        window.__neonErrors.push(`${view.face.id}: ${e && e.message}`);
        console.error(view.face.id, e);
        const note = view.canvas.parentElement.querySelector('.err');
        if (note) note.textContent = `Draw error: ${e && e.message}`;
      }
    }
    ctx.restore();
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (now - last < 1000 / 30) return;
    last = now;
    const T = N.timeState(nowMs(), (performance.now() - t0) / 1000);
    const focus = views.find((v) => v.focus);
    for (const v of views) {
      if (focus ? v === focus : v.visible) render(v, T);
    }
    window.__neonReady = true;
  }

  function hueText(face) {
    const name = (k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : '');
    if (!face.accent) return name(face.hue);
    return `${name(face.hue)}, ${face.accent}${face.accentFor ? ' for ' + face.accentFor : ''}`;
  }

  function buildGallery() {
    const grid = document.getElementById('grid');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = views.find((x) => x.canvas === e.target);
          if (v) v.visible = e.isIntersecting;
        }
      },
      { rootMargin: '80px 0px' },
    );
    for (const id of IDS) {
      const face = N.faces.get(id);
      const card = document.createElement('article');
      card.className = 'card';
      card.id = id;
      if (!face) {
        card.innerHTML = `<div class="disc empty"><p>${id}: not drafted yet</p></div><h2>${id}</h2>`;
        grid.append(card);
        continue;
      }
      card.innerHTML = `<button class="disc" aria-label="Open ${face.name} full size"><canvas></canvas><p class="err"></p></button>
        <h2>${face.name}</h2>
        <p class="hue"><span class="chip" style="background:${N.c[face.hue] || '#888'}"></span>${face.accent ? `<span class="chip" style="background:${N.c[face.accent] || '#888'}"></span>` : ''}${hueText(face)}</p>
        <p class="idea">${face.idea || ''}</p>`;
      grid.append(card);
      const view = makeView(face, card.querySelector('canvas'), 1.5);
      views.push(view);
      io.observe(view.canvas);
      card.querySelector('.disc').addEventListener('click', () => openFocus(face));
    }
    window.addEventListener('resize', () => views.forEach(size));
    const fromHash = location.hash.slice(1);
    if (fromHash && N.faces.get(fromHash)) openFocus(N.faces.get(fromHash));
  }

  function openFocus(face) {
    closeFocus();
    const overlay = document.getElementById('focus');
    overlay.hidden = false;
    overlay.querySelector('h2').textContent = face.name;
    overlay.querySelector('.idea').textContent = face.idea || '';
    const canvas = overlay.querySelector('canvas');
    const view = makeView(face, canvas, 2);
    view.focus = true;
    views.push(view);
    history.replaceState(null, '', `#${face.id}`);
  }
  function closeFocus() {
    const i = views.findIndex((v) => v.focus);
    if (i >= 0) views.splice(i, 1);
    const overlay = document.getElementById('focus');
    if (overlay) overlay.hidden = true;
  }
  window.closeFocus = () => {
    closeFocus();
    history.replaceState(null, '', location.pathname + location.search);
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeFocus();
  });

  function buildSolo(id) {
    document.body.classList.add('solo');
    const face = N.faces.get(id);
    if (!face) {
      window.__neonErrors.push(`${id}: not loaded`);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'solo-canvas';
    document.body.append(canvas);
    views.push(makeView(face, canvas, 1));
  }

  (async () => {
    const r = Date.now();
    for (const id of solo ? [solo] : IDS) {
      const ok = await load(`faces/${id}.js?r=${r}`);
      if (!ok && solo) window.__neonErrors.push(`${id}: faces/${id}.js failed to load`);
    }
    if (solo) buildSolo(solo);
    else buildGallery();
    requestAnimationFrame(loop);
  })();
})();
