/* =========================================================
   Lily bloom + delayed reveal + music
   Settings you may want to change are in CONFIG.
   ========================================================= */
const CONFIG = {
  bloomDuration: 3500,   // ms for the flower to open
  revealDelay: 300       // ms to wait after full bloom before the letter appears
};

(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('lily');
  const wrap = document.getElementById('flowerWrap');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // small seeded random so speckles are the same on every visit
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- Petal shape (points up, base at 0,0, ~206 long) ---------- */
  const PETAL =
    'M0 0C-30 -26 -50 -78 -43 -124C-39 -148 -30 -152 -26 -170C-17 -190 -6 -197 2 -207' +
    'C14 -196 33 -188 41 -162C47 -142 41 -127 44 -108C44 -70 28 -26 0 0Z';

  /* ---------- Gradients ---------- */
  const defs = `
  <defs>
    <linearGradient id="gA" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#cdbf8f"/><stop offset=".12" stop-color="#e7bcc6"/>
      <stop offset=".3" stop-color="#b03a63"/><stop offset=".62" stop-color="#7d2140"/>
      <stop offset="1" stop-color="#4a1124"/></linearGradient>
    <linearGradient id="gB" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#bfb487"/><stop offset=".14" stop-color="#d79bab"/>
      <stop offset=".32" stop-color="#9a2c52"/><stop offset=".65" stop-color="#6a1a36"/>
      <stop offset="1" stop-color="#3f0d1e"/></linearGradient>
    <linearGradient id="gLeaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8c987b"/><stop offset="1" stop-color="#46513b"/></linearGradient>
    <linearGradient id="gAnther" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e0a03a"/><stop offset="1" stop-color="#8a4a12"/></linearGradient>
    <radialGradient id="gThroat">
      <stop offset="0" stop-color="#b9cf6f"/><stop offset=".6" stop-color="#7f9a45" stop-opacity=".8"/>
      <stop offset="1" stop-color="#7f9a45" stop-opacity="0"/></radialGradient>
  </defs>`;

  /* ---------- Stem + leaves (static, muted sage) ---------- */
  const stem = `
  <g>
    <path d="M200 330C197 410 205 490 200 580" fill="none" stroke="#6b7859" stroke-width="7" stroke-linecap="round"/>
    <path d="M198 445C160 428 102 450 66 506C122 500 172 482 198 458Z" fill="url(#gLeaf)"/>
    <path d="M197 452C150 462 105 485 72 504" fill="none" stroke="#38422f" stroke-width="1.1" opacity=".6"/>
    <path d="M202 490C240 466 296 464 338 480C302 508 246 522 204 504Z" fill="url(#gLeaf)"/>
    <path d="M204 496C250 490 295 488 332 480" fill="none" stroke="#38422f" stroke-width="1.1" opacity=".6"/>
  </g>`;

  /* ---------- Six petals ---------- */
  // closed angle / open angle / open length / open curl for each petal
  const P = [
    { ca: -11,  oa: -128, sy: .84, sk: -9,  g: 'gA' },
    { ca: -6.5, oa: -70,  sy: 1.0, sk: 8,   g: 'gB' },
    { ca: -2,   oa: -12,  sy: .98, sk: -7,  g: 'gA' },
    { ca: 2,    oa: 46,   sy: .94, sk: 10,  g: 'gB' },
    { ca: 6.5,  oa: 104,  sy: .8,  sk: -8,  g: 'gA' },
    { ca: 11,   oa: 162,  sy: .72, sk: 9,   g: 'gB' }
  ];

  function petalMarkup(p) {
    let s = `<path d="${PETAL}" fill="url(#${p.g})" stroke="rgba(240,185,200,.55)" stroke-width="1.3"/>`;
    // delicate veins
    [-24, -12, 0, 12, 24].forEach(x => {
      s += `<path d="M0 -6Q${x * .3} -90 ${x * .85} -172" fill="none" stroke="rgba(255,205,220,${x === 0 ? .3 : .15})" stroke-width="${x === 0 ? 1.4 : .8}"/>`;
    });
    // speckles, denser near the throat
    for (let k = 0; k < 46; k++) {
      const f = .1 + rnd() * .62;
      if (f > .42 && rnd() < .5) continue;
      const half = 34 * Math.sin(clamp(f * 1.6 + .1) * Math.PI / 2);
      const x = (rnd() * 2 - 1) * half * .78;
      s += `<circle cx="${x.toFixed(1)}" cy="${(-f * 190).toFixed(1)}" r="${(.8 + rnd() * 1.6).toFixed(1)}" fill="#2a0612" opacity=".78"/>`;
    }
    return s;
  }

  /* ---------- Stamens, pistil, throat ---------- */
  const S = [[40, -100], [78, -76], [102, -40], [-30, -98], [-72, -70], [-98, -28]];
  let stamenMarkup = '';
  S.forEach(() => {
    stamenMarkup += `<g class="st"><path fill="none" stroke="#d6dc9a" stroke-width="2.2" stroke-linecap="round"/>
      <ellipse rx="10" ry="3.6" fill="url(#gAnther)" stroke="#6b3a0c" stroke-width=".6"/></g>`;
  });
  const core = `
  <g id="core" opacity="0">
    <circle r="30" fill="url(#gThroat)"/>
    <g id="stamens">${stamenMarkup}</g>
    <path id="pistil" fill="none" stroke="#9db35b" stroke-width="3" stroke-linecap="round"/>
    <circle id="stigma" r="4.2" fill="#e8d7a0"/>
  </g>`;

  /* ---------- Build the SVG ---------- */
  let petalsHTML = '';
  [0, 2, 4, 1, 3, 5].forEach(i => { petalsHTML += `<g class="petal" data-i="${i}">${petalMarkup(P[i])}</g>`; });
  svg.innerHTML = defs + stem + `<g id="flower">${petalsHTML}</g><g id="coreWrap">${core}</g>`;

  const petalEls = [...svg.querySelectorAll('.petal')].sort((a, b) => a.dataset.i - b.dataset.i);
  const coreWrap = svg.querySelector('#coreWrap');
  const coreEl = svg.querySelector('#core');
  const stamenEls = [...svg.querySelectorAll('.st')];
  const pistil = svg.querySelector('#pistil');
  const stigma = svg.querySelector('#stigma');

  /* ---------- Draw one frame. p = 0 (closed bud) -> 1 (fully open) ---------- */
  function update(p) {
    const cy = lerp(335, 290, ease(p));
    petalEls.forEach((el, i) => {
      const d = i * 0.04;                         // petals open one after another
      const t = ease(clamp((p - d) / 0.8));
      const a = lerp(P[i].ca, P[i].oa, t);
      const sx = lerp(.78, 1.08, t);
      const sy = lerp(.93, P[i].sy, t);
      const sk = lerp(0, P[i].sk, t);
      el.setAttribute('transform', `translate(200 ${cy}) rotate(${a}) skewX(${sk}) scale(${sx} ${sy})`);
    });
    coreWrap.setAttribute('transform', `translate(200 ${cy})`);
    const vis = clamp((p - .4) / .3);
    coreEl.setAttribute('opacity', vis);
    const e = ease(clamp((p - .3) / .7));
    stamenEls.forEach((g, i) => {
      const ex = S[i][0] * e, ey = lerp(-40, S[i][1], e);
      g.firstElementChild.setAttribute('d', `M0 0Q${ex * .2} ${ey * .9} ${ex} ${ey}`);
      const ang = Math.atan2(ey - ey * .9, ex - ex * .2) * 180 / Math.PI;
      g.lastElementChild.setAttribute('transform', `translate(${ex} ${ey}) rotate(${ang})`);
    });
    const px = 10 * e, py = lerp(-40, -114, e);
    pistil.setAttribute('d', `M0 0Q${px * .1} ${py * .6} ${px} ${py}`);
    stigma.setAttribute('cx', px); stigma.setAttribute('cy', py);
  }
  update(0);

  /* ---------- Click to bloom ---------- */
  const hint = document.getElementById('hint');
  let opened = false;

  function bloom() {
    if (opened) return;
    opened = true;
    wrap.classList.add('opened');
    wrap.removeAttribute('tabindex');
    hint.classList.add('gone');
    const dur = reduce ? 1200 : CONFIG.bloomDuration;
    const t0 = performance.now();
    (function frame(now) {
      const p = clamp((now - t0) / dur);
      update(p);
      if (p < 1) requestAnimationFrame(frame);
      else setTimeout(reveal, reduce ? 300 : CONFIG.revealDelay);   // only AFTER bloom ends
    })(t0);
  }
  wrap.addEventListener('click', bloom);
  wrap.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bloom(); } });

  /* ---------- Reveal the letter (photo is only loaded now) ---------- */
  function reveal() {
    document.body.classList.add('bloomed');
    const letter = document.getElementById('letter');
    const img = document.getElementById('photo');
    img.onload = () => img.parentElement.classList.add('loaded');
    img.src = img.dataset.src;
    letter.hidden = false;
    letter.setAttribute('aria-hidden', 'false');
    void letter.offsetWidth;                 // let the browser register the start state
    letter.classList.add('show');
    setTimeout(() => letter.scrollIntoView({ behavior: 'smooth', block: 'center' }), 500);
  }

  /* ---------- Music (never autoplays) ---------- */
  const song = document.getElementById('song');
  const playBtn = document.getElementById('playBtn');
  const player = document.getElementById('player');
  const label = document.getElementById('trackLabel');
  const iPlay = document.getElementById('iconPlay');
  const iPause = document.getElementById('iconPause');
  const vol = document.getElementById('volume');
  song.volume = +vol.value;

  function setPlaying(on) {
    player.classList.toggle('playing', on);
    iPlay.hidden = on; iPause.hidden = !on;
    playBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  }
  playBtn.addEventListener('click', () => {
    if (song.paused) {
      song.play().then(() => setPlaying(true)).catch(() => { label.textContent = 'add assets/birthday-song.mp3'; });
    } else { song.pause(); setPlaying(false); }
  });
  song.addEventListener('error', () => { label.textContent = 'add assets/birthday-song.mp3'; setPlaying(false); }, true);
  vol.addEventListener('input', () => { song.volume = +vol.value; });
})();
