/* ═══════════════════════════════════════════════════════════════════════
   Project Helix — Dashboard Application
   Pure-JS frontend: loads PeriodicTableJSON.json directly, renders element
   data, runs weighted-neighbour property predictions, draws Bohr models,
   plots trend charts, and renders the mini periodic table.
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
// JSON data is embedded via data.js (HELIX_DATA global) for file:// compatibility.

const FEATURES = [
  { key: 'atomic_mass',               label: 'Atomic Mass',         unit: 'u' },
  { key: 'density',                   label: 'Density',             unit: 'g/cm³' },
  { key: 'melt',                      label: 'Melting Point',       unit: 'K' },
  { key: 'boil',                      label: 'Boiling Point',       unit: 'K' },
  { key: 'molar_heat',                label: 'Molar Heat',          unit: 'J/mol·K' },
  { key: 'electron_affinity',         label: 'Electron Affinity',   unit: 'kJ/mol' },
  { key: 'electronegativity_pauling', label: 'Electronegativity',   unit: 'Pauling' },
];

const PREDICT_FEATURES = [
  { key: 'density',                   label: 'Density',             unit: 'g/cm³',   dp: 4 },
  { key: 'melt',                      label: 'Melting Point',       unit: 'K',        dp: 2 },
  { key: 'boil',                      label: 'Boiling Point',       unit: 'K',        dp: 2 },
  { key: 'molar_heat',                label: 'Molar Heat',          unit: 'J/mol·K',  dp: 3 },
  { key: 'electron_affinity',         label: 'Electron Affinity',   unit: 'kJ/mol',   dp: 3 },
  { key: 'electronegativity_pauling', label: 'Electronegativity',   unit: 'Pauling',  dp: 3 },
];

// Periodic table grid layout [symbol -> [col, row]] (1-indexed)
// We'll compute this from xpos/ypos in the JSON

// Category → CSS class map
const CAT_CLASS = {
  'alkali metal':          'cat-alkali',
  'alkaline earth metal':  'cat-alkaline',
  'lanthanide':            'cat-lanthanide',
  'actinide':              'cat-actinide',
  'transition metal':      'cat-transition',
  'post-transition metal': 'cat-post',
  'metalloid':             'cat-metalloid',
  'polyatomic nonmetal':   'cat-nonmetal',
  'diatomic nonmetal':     'cat-nonmetal',
  'noble gas':             'cat-noble',
  'unknown, predicted to be an alkali metal': 'cat-alkali',
  'unknown, predicted to be a noble gas':     'cat-noble',
  'unknown, probably a noble gas':            'cat-noble',
  'unknown, probably a transition metal':     'cat-transition',
  'unknown, probably post-transition metal':  'cat-post',
  'unknown, but predicted to be post-transition metal': 'cat-post',
};

const PHASE_EMOJI = { Gas: '💨', Liquid: '💧', Solid: '🪨', Unknown: '❓' };

// ── State ──────────────────────────────────────────────────────────────────────
let ALL_ELEMENTS = [];      // full JSON array, 118 elements
let currentZ = null;        // currently displayed atomic number
let trendChart = null;      // Chart.js instance
let bgAnimId = null;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Startup ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initBackground();
  initNavScroll();
  await loadData();
  initUI();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════
function initBackground() {
  const canvas = $('bg-canvas');
  const ctx = canvas.getContext('2d');
  const particles = [];
  const PARTICLE_COUNT = 60;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    });
  }

  // Connection lines
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;

    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 160) {
          ctx.strokeStyle = `rgba(0,229,200,${0.07 * (1 - dist/160)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,200,${p.alpha})`;
      ctx.fill();
    }

    bgAnimId = requestAnimationFrame(draw);
  }
  draw();
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV SCROLL
// ═══════════════════════════════════════════════════════════════════════════════
function initNavScroll() {
  const nav = $('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════════
async function loadData() {
  try {
    // Use embedded data (data.js) — works with file:// without a server
    if (typeof HELIX_DATA !== 'undefined' && HELIX_DATA.elements) {
      ALL_ELEMENTS = HELIX_DATA.elements
        .filter(e => typeof e.number === 'number' && e.number >= 1 && e.number <= 118)
        .sort((a, b) => a.number - b.number);
    } else {
      // Fallback: try fetch (works when served)
      const resp = await fetch('../src/PeriodicTableJSON.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      ALL_ELEMENTS = json.elements
        .filter(e => typeof e.number === 'number' && e.number >= 1 && e.number <= 118)
        .sort((a, b) => a.number - b.number);
    }
    $('loading-overlay').classList.add('hidden');
  } catch (err) {
    const overlay = $('loading-overlay');
    overlay.querySelector('.loading-text').textContent = `⚠ Failed to load dataset: ${err.message}`;
    overlay.querySelector('.spinner').style.display = 'none';
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI INITIALISATION
// ═══════════════════════════════════════════════════════════════════════════════
function initUI() {
  const input   = $('atomic-input');
  const btn     = $('search-btn');
  const errBox  = $('search-error');

  function doSearch() {
    const raw = input.value.trim();
    const z   = parseInt(raw, 10);
    errBox.textContent = '';

    if (!raw) { errBox.textContent = 'Please enter an atomic number.'; return; }
    if (isNaN(z) || z < 1 || z > 118) {
      errBox.textContent = 'Atomic number must be between 1 and 118.';
      return;
    }
    displayElement(z);
  }

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // Quick-select hint chips
  document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.z;
      doSearch();
    });
  });

  // Prev / Next
  $('prev-btn').addEventListener('click', () => {
    if (currentZ > 1) { input.value = currentZ - 1; displayElement(currentZ - 1); }
  });
  $('next-btn').addEventListener('click', () => {
    if (currentZ < 118) { input.value = currentZ + 1; displayElement(currentZ + 1); }
  });

  // Trend controls
  $('trend-property').addEventListener('change', () => currentZ && renderTrendChart(currentZ));
  $('trend-scope').addEventListener('change',    () => currentZ && renderTrendChart(currentZ));

  // Show Hydrogen by default
  input.value = 1;
  displayElement(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DISPLAY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
function displayElement(z) {
  const el = ALL_ELEMENTS.find(e => e.number === z);
  if (!el) return;

  currentZ = z;

  // Show results section
  const section = $('results-section');
  section.removeAttribute('hidden');

  // Animate in
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderHeroCard(el);
  renderPropGrid(el);
  renderElectronSection(el);
  renderBohrModel(el);
  renderPredictions(el);
  renderPeriodicMap(el);
  renderTrendChart(z);
  updateNavArrows(z);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO CARD
// ═══════════════════════════════════════════════════════════════════════════════
function renderHeroCard(el) {
  $('el-number').textContent = el.number;
  $('el-symbol').textContent = el.symbol;
  $('el-mass').textContent   = formatNum(el.atomic_mass, 4);
  $('el-name').textContent   = el.name;

  // Colour badge by category
  const badge = $('el-symbol-badge');
  badge.style.borderColor = getCatColor(el.category) + '55';
  badge.style.boxShadow   = `0 0 30px ${getCatColor(el.category)}40`;

  // Tags
  const tags = $('el-tags');
  tags.innerHTML = '';
  const tagDefs = [
    { cls: 'el-tag-category', text: el.category || 'unknown' },
    { cls: 'el-tag-phase',    text: (el.phase ? PHASE_EMOJI[el.phase] + ' ' : '') + (el.phase || 'Unknown') },
    { cls: 'el-tag-period',   text: `Period ${el.period}` },
    { cls: 'el-tag-group',    text: el.group ? `Group ${el.group}` : 'Group —' },
    { cls: 'el-tag-block',    text: `${el.block}-block` },
  ];
  tagDefs.forEach(({ cls, text }) => {
    const span = document.createElement('span');
    span.className = `el-tag ${cls}`;
    span.textContent = text;
    tags.appendChild(span);
  });

  // Summary
  $('el-summary').textContent = el.summary || '';

  // Discovery
  const disc = $('el-discovery');
  const parts = [];
  if (el.discovered_by) parts.push(`<strong>Discovered by:</strong> ${el.discovered_by}`);
  if (el.named_by)      parts.push(`<strong>Named by:</strong> ${el.named_by}`);
  if (el['cpk-hex'])    parts.push(`<strong>CPK colour:</strong> <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#${el['cpk-hex']};border:1px solid rgba(255,255,255,0.3);vertical-align:middle;margin-left:4px;"></span> #${el['cpk-hex'].toUpperCase()}`);
  disc.innerHTML = parts.join(' &nbsp;·&nbsp; ');

  // Image
  const photo = $('el-photo');
  const caption = $('el-photo-caption');
  if (el.image && el.image.url) {
    photo.src   = el.image.url;
    photo.alt   = el.image.title || el.name;
    photo.style.display = 'block';
    caption.textContent = el.image.title || '';
    $('element-image-panel').style.display = '';
  } else {
    photo.src = '';
    photo.style.display = 'none';
    $('element-image-panel').style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY GRID
// ═══════════════════════════════════════════════════════════════════════════════
function renderPropGrid(el) {
  const grid = $('prop-grid');
  grid.innerHTML = '';

  const props = [
    { label: 'Atomic Mass',         key: 'atomic_mass',               unit: 'u',        dp: 6 },
    { label: 'Density',             key: 'density',                   unit: 'g/cm³',    dp: 4 },
    { label: 'Melting Point',       key: 'melt',                      unit: 'K',        dp: 2 },
    { label: 'Boiling Point',       key: 'boil',                      unit: 'K',        dp: 2 },
    { label: 'Molar Heat',          key: 'molar_heat',                unit: 'J/mol·K',  dp: 3 },
    { label: 'Electron Affinity',   key: 'electron_affinity',         unit: 'kJ/mol',   dp: 3 },
    { label: 'Electronegativity',   key: 'electronegativity_pauling', unit: 'Pauling',  dp: 2 },
    { label: 'Phase',               key: 'phase',                     unit: '',         dp: 0 },
    { label: 'Appearance',          key: 'appearance',                unit: '',         dp: 0 },
    { label: 'Ionisation Energy 1', key: '_ie1',                      unit: 'kJ/mol',   dp: 2 },
  ];

  for (const p of props) {
    let val;
    if (p.key === '_ie1') {
      val = el.ionization_energies && el.ionization_energies.length > 0 ? el.ionization_energies[0] : null;
    } else {
      val = el[p.key] ?? null;
    }

    const card = document.createElement('div');
    card.className = 'prop-card';

    const label = document.createElement('div');
    label.className = 'prop-label';
    label.textContent = p.label;

    const valueEl = document.createElement('div');
    if (val !== null && val !== undefined && val !== '') {
      valueEl.className = 'prop-value';
      valueEl.textContent = p.dp > 0 ? formatNum(val, p.dp) : val;
      if (p.unit) {
        const unitEl = document.createElement('div');
        unitEl.className = 'prop-unit';
        unitEl.textContent = p.unit;
        card.appendChild(label);
        card.appendChild(valueEl);
        card.appendChild(unitEl);
      } else {
        card.appendChild(label);
        card.appendChild(valueEl);
      }
    } else {
      valueEl.className = 'prop-missing';
      valueEl.textContent = 'Not available';
      card.appendChild(label);
      card.appendChild(valueEl);
    }

    grid.appendChild(card);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTRON CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
function renderElectronSection(el) {
  $('ec-notation').textContent = el.electron_configuration || '—';

  const shellsRow = $('ec-shells-row');
  shellsRow.innerHTML = '';

  if (el.shells && el.shells.length > 0) {
    el.shells.forEach((count, i) => {
      const shell = document.createElement('div');
      shell.className = 'ec-shell-chip';
      shell.innerHTML = `<span>Shell ${i+1}</span><span>${count} e⁻</span>`;
      shellsRow.appendChild(shell);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOHR MODEL CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
function renderBohrModel(el) {
  const canvas = $('bohr-canvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;

  ctx.clearRect(0, 0, W, H);

  const shells = el.shells || [];
  const maxShells = shells.length;
  if (maxShells === 0) return;

  const maxR = Math.min(CX, CY) - 16;
  const shellStep = maxR / (maxShells + 0.5);

  // Glow for nucleus
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
  grd.addColorStop(0, '#00e5c8');
  grd.addColorStop(0.5, 'rgba(0,229,200,0.6)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(CX, CY, 18, 0, Math.PI*2);
  ctx.fill();

  // Nucleus label
  ctx.fillStyle = '#040d1a';
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(el.symbol || '', CX, CY);

  // Draw shells and electrons
  const now = Date.now();

  shells.forEach((electronCount, i) => {
    const r = shellStep * (i + 1);

    // Orbit ring
    ctx.strokeStyle = `rgba(0,229,200,${0.2 - i * 0.02})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Electrons
    for (let j = 0; j < electronCount; j++) {
      const baseAngle = (2 * Math.PI * j) / electronCount;
      const spinSpeed = 0.4 / (i + 1);    // outer shells spin slower
      const angle = baseAngle + now * spinSpeed * 0.001;
      const ex = CX + r * Math.cos(angle);
      const ey = CY + r * Math.sin(angle);

      // Electron glow
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
      eg.addColorStop(0, `rgba(124,92,252,0.9)`);
      eg.addColorStop(1, `rgba(124,92,252,0)`);
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // Shell labels
  shells.forEach((count, i) => {
    const r = shellStep * (i + 1);
    const labels = ['K','L','M','N','O','P','Q'];
    ctx.fillStyle = 'rgba(232,240,254,0.35)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i] || '', CX + r + 5, CY);
  });

  // Animate
  const ANIM_KEY = `bohr_anim_${el.number}`;
  if (canvas._animId) cancelAnimationFrame(canvas._animId);

  function animate() {
    canvas._animId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, W, H);

    const now2 = Date.now();

    const grd2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
    grd2.addColorStop(0, '#00e5c8');
    grd2.addColorStop(0.5, 'rgba(0,229,200,0.6)');
    grd2.addColorStop(1, 'transparent');
    ctx.fillStyle = grd2;
    ctx.beginPath();
    ctx.arc(CX, CY, 18, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#040d1a';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.symbol || '', CX, CY);

    shells.forEach((electronCount, i) => {
      const r = shellStep * (i + 1);

      ctx.strokeStyle = `rgba(0,229,200,${Math.max(0.05, 0.22 - i * 0.03)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let j = 0; j < electronCount; j++) {
        const baseAngle = (2 * Math.PI * j) / electronCount;
        const spinSpeed = 0.4 / (i + 1);
        const angle = baseAngle + now2 * spinSpeed * 0.001;
        const ex = CX + r * Math.cos(angle);
        const ey = CY + r * Math.sin(angle);

        const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
        eg.addColorStop(0, `rgba(124,92,252,0.9)`);
        eg.addColorStop(1, `rgba(124,92,252,0)`);
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI*2);
        ctx.fill();
      }

      const labels = ['K','L','M','N','O','P','Q'];
      ctx.fillStyle = 'rgba(232,240,254,0.35)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i] || '', CX + r + 5, CY);
    });
  }

  animate();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY PREDICTION ENGINE
// Weighted-neighbour regression:
//   1. Find all elements with a known value for the property
//   2. Weight by closeness in atomic number + same period + same group bonus
//   3. Compute weighted average as prediction
//   4. Report confidence from how many neighbours contributed
// ═══════════════════════════════════════════════════════════════════════════════
function predictProperty(el, key) {
  const known = ALL_ELEMENTS.filter(e => e[key] !== null && e[key] !== undefined && e.number !== el.number);
  if (known.length === 0) return { value: null, confidence: 0, neighbours: 0 };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const k of known) {
    // Distance-based weight (Gaussian kernel on atomic number)
    const dZ      = Math.abs(k.number - el.number);
    const dPeriod = Math.abs((k.period || 0) - (el.period || 0));
    const dGroup  = Math.abs((k.group || 0) - (el.group || 0));

    // Normalised similarity score (0 to 1)
    const wZ      = Math.exp(-dZ * dZ / 64);          // σ ≈ 8 elements
    const wPeriod = Math.exp(-dPeriod * dPeriod / 2); // same period = big boost
    const wGroup  = Math.exp(-dGroup * dGroup / 4);   // same group = boost
    const wBlock  = k.block === el.block ? 1.3 : 0.8;

    const w = wZ * (0.5 + 0.3 * wPeriod + 0.2 * wGroup) * wBlock;
    totalWeight  += w;
    weightedSum  += k[key] * w;
  }

  const predicted = weightedSum / totalWeight;

  // Confidence: how many significant neighbours (weight > 0.01)?
  const sigNeighbours = known.filter(k => {
    const dZ = Math.abs(k.number - el.number);
    return Math.exp(-dZ * dZ / 64) > 0.01;
  }).length;
  const confidence = Math.min(1, sigNeighbours / 10); // normalise

  return { value: predicted, confidence, neighbours: sigNeighbours };
}

function renderPredictions(el) {
  const grid = $('prediction-grid');
  grid.innerHTML = '';

  for (const feat of PREDICT_FEATURES) {
    const actual    = el[feat.key] ?? null;
    const predicted = predictProperty(el, feat.key);
    const card      = document.createElement('div');
    card.className  = 'pred-card';

    const label = document.createElement('div');
    label.className = 'pred-label';
    label.textContent = feat.label;

    const row = document.createElement('div');
    row.className = 'pred-row';

    const actualEl = document.createElement('div');
    actualEl.className = 'pred-actual';
    actualEl.textContent = actual !== null ? formatNum(actual, feat.dp) + ' ' + feat.unit : '—';

    const estEl = document.createElement('div');
    estEl.className = 'pred-estimated';
    estEl.title = 'Predicted value';
    estEl.textContent = predicted.value !== null ? '≈ ' + formatNum(predicted.value, feat.dp) + ' ' + feat.unit : '—';

    row.appendChild(actualEl);
    row.appendChild(estEl);

    // Accuracy bar
    const barWrap = document.createElement('div');
    barWrap.className = 'pred-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'pred-bar';
    let pct = predicted.confidence * 100;

    // If we have both actual and predicted, show error
    let matchEl = null;
    if (actual !== null && predicted.value !== null) {
      const err = Math.abs(actual - predicted.value) / Math.max(Math.abs(actual), 1e-9);
      pct = Math.max(0, (1 - err) * 100);
      matchEl = document.createElement('div');
      matchEl.className = 'pred-match ' + (pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'ok');
      matchEl.textContent = `${pct.toFixed(0)}% accuracy`;
    }

    setTimeout(() => { bar.style.width = pct + '%'; }, 100);
    barWrap.appendChild(bar);

    const conf = document.createElement('div');
    conf.className = 'pred-confidence';
    conf.textContent = `${predicted.neighbours} neighbours · ${(predicted.confidence * 100).toFixed(0)}% confidence`;

    card.appendChild(label);
    card.appendChild(row);
    card.appendChild(barWrap);
    if (matchEl) card.appendChild(matchEl);
    card.appendChild(conf);
    grid.appendChild(card);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI PERIODIC TABLE
// ═══════════════════════════════════════════════════════════════════════════════
function renderPeriodicMap(el) {
  const container = $('mini-table');
  container.innerHTML = '';

  // Build 9×18 grid (rows 1-7 + 2 lanthanide/actinide rows, cols 1-18)
  const ROWS = 9, COLS = 18;
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

  // Place elements using xpos/ypos from JSON
  for (const e of ALL_ELEMENTS) {
    const col = (e.xpos || 0) - 1;
    const row = (e.wypos || e.ypos || 0) - 1;
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      grid[row][col] = e;
    }
  }

  const ptGrid = document.createElement('div');
  ptGrid.className = 'pt-grid';

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      const e = grid[r][c];

      if (!e) {
        cell.className = 'pt-cell empty';
      } else {
        cell.className = 'pt-cell';
        cell.textContent = e.symbol;
        cell.title = `${e.number} · ${e.name}`;

        // Category colour
        const colour = getCatColor(e.category);
        cell.style.background = colour + '22';
        cell.style.borderColor = colour + '44';
        cell.style.color = colour;

        // Highlight current element
        if (e.number === el.number) {
          cell.classList.add('active');
        } else if (e.period === el.period) {
          cell.classList.add('same-period');
        } else if (e.group && e.group === el.group) {
          cell.classList.add('same-group');
        } else if (e.block === el.block) {
          cell.classList.add('same-block');
        }

        // Click to navigate
        cell.addEventListener('click', () => {
          $('atomic-input').value = e.number;
          displayElement(e.number);
        });
      }

      ptGrid.appendChild(cell);
    }
  }

  container.appendChild(ptGrid);

  // Position stats
  const stats = $('position-stats');
  stats.innerHTML = '';
  const statData = [
    { label: 'Period',    value: el.period,   sub: `Row ${el.period} of 7`              },
    { label: 'Group',     value: el.group || '—', sub: el.group ? `Column ${el.group} of 18` : 'Lanthanide/Actinide' },
    { label: 'Block',     value: el.block?.toUpperCase() || '—', sub: `${el.block}-block elements` },
    { label: 'Category',  value: null, sub: el.category || 'unknown', long: true },
  ];
  for (const s of statData) {
    const card = document.createElement('div');
    card.className = 'pos-stat-card';
    if (s.long) {
      card.innerHTML = `<div class="pos-stat-label">${s.label}</div><div class="pos-stat-sub" style="font-size:0.85rem;color:var(--clr-text-dim);font-weight:600;">${s.sub}</div>`;
    } else {
      card.innerHTML = `<div class="pos-stat-label">${s.label}</div><div class="pos-stat-value">${s.value}</div><div class="pos-stat-sub">${s.sub}</div>`;
    }
    stats.appendChild(card);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND CHART (hand-drawn canvas, no external lib)
// ═══════════════════════════════════════════════════════════════════════════════
function renderTrendChart(z) {
  const el       = ALL_ELEMENTS.find(e => e.number === z);
  const propKey  = $('trend-property').value;
  const scope    = $('trend-scope').value;

  // Filter elements for scope
  let subset;
  switch (scope) {
    case 'period': subset = ALL_ELEMENTS.filter(e => e.period === el.period); break;
    case 'group':  subset = ALL_ELEMENTS.filter(e => e.group && e.group === el.group); break;
    case 'block':  subset = ALL_ELEMENTS.filter(e => e.block === el.block); break;
    default:       subset = ALL_ELEMENTS; break;
  }

  // Only elements with a value for this property
  const dataPoints = subset
    .filter(e => e[propKey] !== null && e[propKey] !== undefined)
    .map(e => ({ z: e.number, v: e[propKey], symbol: e.symbol, isCurrent: e.number === z }));

  if (dataPoints.length === 0) return;

  const canvas = $('trends-chart');
  const ctx    = canvas.getContext('2d');
  const W      = canvas.offsetWidth  || canvas.parentElement.offsetWidth  - 32;
  const H      = canvas.offsetHeight || 248;
  canvas.width  = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  const zVals = dataPoints.map(d => d.z);
  const vVals = dataPoints.map(d => d.v);
  const zMin  = Math.min(...zVals), zMax = Math.max(...zVals);
  const vMin  = Math.min(...vVals), vMax = Math.max(...vVals);
  const vRange = vMax - vMin || 1;

  const toX = z  => PAD.left + (z  - zMin) / (zMax - zMin || 1) * plotW;
  const toY = v  => PAD.top  + plotH - (v - vMin) / vRange * plotH;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    const val = vMax - (vRange / 4) * i;
    ctx.fillStyle = 'rgba(232,240,254,0.3)';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatNum(val, 2), PAD.left - 6, y);
  }

  // Axes labels
  ctx.fillStyle = 'rgba(232,240,254,0.5)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Atomic Number', PAD.left + plotW / 2, H - 14);

  // Axis lines
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  // Line path
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,229,200,0.6)';
  ctx.lineWidth = 2;
  dataPoints.forEach((d, i) => {
    const x = toX(d.z), y = toY(d.v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Area fill
  ctx.beginPath();
  dataPoints.forEach((d, i) => {
    const x = toX(d.z), y = toY(d.v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  const last = dataPoints[dataPoints.length - 1];
  ctx.lineTo(toX(last.z), PAD.top + plotH);
  ctx.lineTo(toX(dataPoints[0].z), PAD.top + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
  grad.addColorStop(0, 'rgba(0,229,200,0.18)');
  grad.addColorStop(1, 'rgba(0,229,200,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Dots
  for (const d of dataPoints) {
    const x = toX(d.z), y = toY(d.v);
    if (d.isCurrent) {
      // Highlighted dot
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,229,200,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI*2);
      ctx.fillStyle = '#00e5c8';
      ctx.fill();
      // Label
      ctx.fillStyle = '#00e5c8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(d.symbol, x, y - 8);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,229,200,0.45)';
      ctx.fill();
    }
  }

  // X-axis tick labels for atomic numbers
  const tickStep = Math.ceil((zMax - zMin + 1) / 8);
  ctx.fillStyle = 'rgba(232,240,254,0.4)';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let t = zMin; t <= zMax; t += tickStep) {
    const x = toX(t);
    ctx.fillText(t, x, PAD.top + plotH + 5);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV ARROWS
// ═══════════════════════════════════════════════════════════════════════════════
function updateNavArrows(z) {
  const prev = $('prev-btn');
  const next = $('next-btn');
  const lbl  = $('nav-arrow-label');

  prev.disabled = z <= 1;
  next.disabled = z >= 118;

  const el = ALL_ELEMENTS.find(e => e.number === z);
  if (el) lbl.textContent = `${el.number} · ${el.symbol} · ${el.name}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════
function formatNum(v, dp) {
  if (v === null || v === undefined) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

function getCatColor(cat) {
  const map = {
    'alkali metal':                       '#ff6b6b',
    'alkaline earth metal':               '#ffd93d',
    'lanthanide':                         '#c084fc',
    'actinide':                           '#86efac',
    'transition metal':                   '#60a5fa',
    'post-transition metal':              '#34d399',
    'metalloid':                          '#fb923c',
    'polyatomic nonmetal':                '#38bdf8',
    'diatomic nonmetal':                  '#38bdf8',
    'noble gas':                          '#a78bfa',
    'unknown, predicted to be an alkali metal': '#ff6b6b',
    'unknown, predicted to be a noble gas':     '#a78bfa',
    'unknown, probably a noble gas':            '#a78bfa',
    'unknown, probably a transition metal':     '#60a5fa',
    'unknown, probably post-transition metal':  '#34d399',
    'unknown, but predicted to be post-transition metal': '#34d399',
  };
  return map[(cat || '').toLowerCase()] || '#94a3b8';
}

// Resize trend chart on window resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentZ) renderTrendChart(currentZ);
  }, 200);
}, { passive: true });
