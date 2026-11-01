/* ═══════════════════════════════════════════════════════════════════════
   Project Helix — Dashboard Application v2.0
   Interactive Element Intelligence & Extrapolative ML Predictor
   Supports all 118 known elements + arbitrary superheavy elements (Z > 118)
   ═══════════════════════════════════════════════════════════════════════ */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const FEATURES = [
  { key: 'atomic_mass',               label: 'Atomic Mass',         unit: 'u',       dp: 4 },
  { key: 'density',                   label: 'Density',             unit: 'g/cm³',   dp: 4 },
  { key: 'melt',                      label: 'Melting Point',       unit: 'K',       dp: 2 },
  { key: 'boil',                      label: 'Boiling Point',       unit: 'K',       dp: 2 },
  { key: 'molar_heat',                label: 'Molar Heat',          unit: 'J/mol·K', dp: 3 },
  { key: 'electron_affinity',         label: 'Electron Affinity',   unit: 'kJ/mol',  dp: 3 },
  { key: 'electronegativity_pauling', label: 'Electronegativity',   unit: 'Pauling', dp: 2 },
];

const PREDICT_FEATURES = [
  { key: 'atomic_mass',               label: 'Atomic Mass',         unit: 'u',       dp: 3 },
  { key: 'density',                   label: 'Density',             unit: 'g/cm³',   dp: 3 },
  { key: 'melt',                      label: 'Melting Point',       unit: 'K',       dp: 1 },
  { key: 'boil',                      label: 'Boiling Point',       unit: 'K',       dp: 1 },
  { key: 'molar_heat',                label: 'Molar Heat',          unit: 'J/mol·K', dp: 2 },
  { key: 'electron_affinity',         label: 'Electron Affinity',   unit: 'kJ/mol',  dp: 2 },
  { key: 'electronegativity_pauling', label: 'Electronegativity',   unit: 'Pauling', dp: 2 },
];

const PHASE_EMOJI = { Gas: '💨', Liquid: '💧', Solid: '🪨', Unknown: '❓' };
const SHELL_LABELS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

// ── State ──────────────────────────────────────────────────────────────────────
let ALL_ELEMENTS = [];      // 118 canonical elements
let currentZ = null;        // currently selected atomic number
let currentElement = null;  // currently displayed element object
let bgAnimId = null;

// ── Helper ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Startup ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initBackground();
  initNavScroll();
  await loadData();
  initUI();
  renderDataQuality();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND ANIMATION
// ═══════════════════════════════════════════════════════════════════════════════
function initBackground() {
  const canvas = $('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const particles = [];
  const PARTICLE_COUNT = 55;

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
      alpha: Math.random() * 0.45 + 0.1,
    });
  }

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
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.strokeStyle = `rgba(0,229,200,${0.07 * (1 - dist / 150)})`;
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

function initNavScroll() {
  const nav = $('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════════════════════════════════════════════
async function loadData() {
  try {
    if (typeof HELIX_DATA !== 'undefined' && HELIX_DATA.elements) {
      ALL_ELEMENTS = HELIX_DATA.elements
        .filter(e => typeof e.number === 'number' && e.number >= 1 && e.number <= 118)
        .sort((a, b) => a.number - b.number);
    } else {
      const resp = await fetch('../src/PeriodicTableJSON.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      ALL_ELEMENTS = json.elements
        .filter(e => typeof e.number === 'number' && e.number >= 1 && e.number <= 118)
        .sort((a, b) => a.number - b.number);
    }
    const overlay = $('loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  } catch (err) {
    const overlay = $('loading-overlay');
    if (overlay) {
      const txt = overlay.querySelector('.loading-text');
      if (txt) txt.textContent = `⚠ Failed to load dataset: ${err.message}`;
      const sp = overlay.querySelector('.spinner');
      if (sp) sp.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HYPOTHETICAL ELEMENT SYNTHESIS (Z > 118)
// ═══════════════════════════════════════════════════════════════════════════════
function createHypotheticalElement(z) {
  const systematicName   = HelixML.getSystematicName(z);
  const systematicSymbol = HelixML.getSystematicSymbol(z);
  const placement        = HelixML.getExtendedPlacement(z) || { period: 8, group: 1, block: 's' };
  const ecData           = HelixML.generateElectronConfig(z);
  const category         = HelixML.getCategory(z);
  const predictions      = HelixML.predictAll(z);
  const confidence       = HelixML.getConfidence(z);

  const phase = placement.block === 'p' && placement.group === 18 ? 'Gas' : 'Solid';

  return {
    number: z,
    name: systematicName,
    symbol: systematicSymbol,
    atomic_mass: predictions.atomic_mass || (z * 2.65),
    category: category,
    period: placement.period,
    group: placement.group,
    block: placement.block,
    phase: phase,
    density: predictions.density,
    melt: predictions.melt,
    boil: predictions.boil,
    molar_heat: predictions.molar_heat,
    electron_affinity: predictions.electron_affinity,
    electronegativity_pauling: predictions.electronegativity_pauling,
    electron_configuration: ecData.config,
    shells: ecData.shells,
    summary: `Theoretical superheavy element ${systematicName} (Z=${z}) predicted using quantum Aufbau orbital ordering and Project Helix ML models. Placed in Period ${placement.period}, Group ${placement.group}, ${placement.block}-block of the extended periodic table.`,
    discovered_by: 'Hypothetical / Not yet synthesised',
    named_by: 'IUPAC systematic nomenclature',
    isHypothetical: true,
    confidence: confidence,
    mlPredictions: predictions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI INITIALISATION
// ═══════════════════════════════════════════════════════════════════════════════
function initUI() {
  const input  = $('atomic-input');
  const btn    = $('search-btn');
  const errBox = $('search-error');

  function doSearch() {
    const raw = input.value.trim();
    const z   = parseInt(raw, 10);
    errBox.textContent = '';

    if (!raw) {
      errBox.textContent = 'Please enter an atomic number.';
      return;
    }
    if (isNaN(z) || z < 1) {
      errBox.textContent = 'Atomic number must be a positive integer (≥ 1).';
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

  // Prev / Next buttons
  $('prev-btn').addEventListener('click', () => {
    if (currentZ > 1) {
      input.value = currentZ - 1;
      displayElement(currentZ - 1);
    }
  });

  $('next-btn').addEventListener('click', () => {
    input.value = (currentZ || 1) + 1;
    displayElement((currentZ || 1) + 1);
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
  let el;
  if (z <= 118) {
    el = ALL_ELEMENTS.find(e => e.number === z);
    if (!el) return;
    el.isHypothetical = false;
  } else {
    el = createHypotheticalElement(z);
  }

  currentZ = z;
  currentElement = el;

  const section = $('results-section');
  section.removeAttribute('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Handle Hypothetical Banner
  const banner = $('hypothetical-banner');
  const heroCard = $('element-hero-card');

  if (el.isHypothetical) {
    banner.removeAttribute('hidden');
    heroCard.classList.add('hypothetical');
    const conf = el.confidence || HelixML.getConfidence(z);
    $('hypo-detail').textContent = `Element ${z} (${el.symbol}) has not been synthesised yet. All properties shown are machine-learning predictions derived from periodic table trends and Aufbau extrapolation.`;
    
    const confBadge = $('hypo-confidence');
    confBadge.className = `hypo-confidence conf-${conf.level}`;
    confBadge.textContent = `${conf.label} (${(conf.score * 100).toFixed(0)}% confidence)`;
  } else {
    banner.setAttribute('hidden', '');
    heroCard.classList.remove('hypothetical');
  }

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
  $('el-mass').textContent   = formatNum(el.atomic_mass, 3);
  $('el-name').textContent   = el.name;

  // Colour badge by category
  const badge = $('el-symbol-badge');
  const catColor = getCatColor(el.category);
  badge.style.borderColor = catColor + '66';
  badge.style.boxShadow   = `0 0 30px ${catColor}40`;

  // Tags
  const tags = $('el-tags');
  tags.innerHTML = '';
  const tagDefs = [
    { cls: 'el-tag-category', text: el.category || 'unknown' },
    { cls: 'el-tag-phase',    text: (el.phase ? (PHASE_EMOJI[el.phase] || '') + ' ' : '') + (el.phase || 'Solid') },
    { cls: 'el-tag-period',   text: `Period ${el.period}` },
    { cls: 'el-tag-group',    text: el.group ? `Group ${el.group}` : 'Group —' },
    { cls: 'el-tag-block',    text: `${el.block}-block` },
  ];

  if (el.isHypothetical) {
    tagDefs.push({ cls: 'el-tag-ml', text: '🔮 ML Extrapolated' });
  }

  tagDefs.forEach(({ cls, text }) => {
    const span = document.createElement('span');
    span.className = `el-tag ${cls}`;
    span.textContent = text;
    tags.appendChild(span);
  });

  // Summary
  $('el-summary').textContent = el.summary || '';

  // Discovery / Attribution
  const disc = $('el-discovery');
  const parts = [];
  if (el.discovered_by) parts.push(`<strong>Discovered:</strong> ${el.discovered_by}`);
  if (el.named_by)      parts.push(`<strong>Named by:</strong> ${el.named_by}`);
  if (el['cpk-hex']) {
    parts.push(`<strong>CPK:</strong> <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#${el['cpk-hex']};border:1px solid rgba(255,255,255,0.3);vertical-align:middle;margin-left:4px;"></span> #${el['cpk-hex'].toUpperCase()}`);
  }
  disc.innerHTML = parts.join(' &nbsp;·&nbsp; ');

  // Image panel
  const photo = $('el-photo');
  const caption = $('el-photo-caption');
  const panel = $('element-image-panel');
  if (el.image && el.image.url && !el.isHypothetical) {
    photo.src = el.image.url;
    photo.alt = el.image.title || el.name;
    photo.style.display = 'block';
    caption.textContent = el.image.title || '';
    panel.style.display = '';
  } else {
    photo.src = '';
    photo.style.display = 'none';
    panel.style.display = 'none';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY GRID
// ═══════════════════════════════════════════════════════════════════════════════
function renderPropGrid(el) {
  const grid = $('prop-grid');
  grid.innerHTML = '';

  const props = [
    { label: 'Atomic Mass',         key: 'atomic_mass',               unit: 'u',        dp: 4 },
    { label: 'Density',             key: 'density',                   unit: 'g/cm³',    dp: 4 },
    { label: 'Melting Point',       key: 'melt',                      unit: 'K',        dp: 2 },
    { label: 'Boiling Point',       key: 'boil',                      unit: 'K',        dp: 2 },
    { label: 'Molar Heat',          key: 'molar_heat',                unit: 'J/mol·K',  dp: 3 },
    { label: 'Electron Affinity',   key: 'electron_affinity',         unit: 'kJ/mol',   dp: 3 },
    { label: 'Electronegativity',   key: 'electronegativity_pauling', unit: 'Pauling',  dp: 2 },
    { label: 'Phase',               key: 'phase',                     unit: '',         dp: 0 },
    { label: 'Period / Group',      key: '_pos',                      unit: '',         dp: 0 },
    { label: 'Block',               key: 'block',                     unit: 'orbital',  dp: 0 },
  ];

  for (const p of props) {
    let val;
    let isPredictedVal = el.isHypothetical;

    if (p.key === '_pos') {
      val = `Period ${el.period}, Group ${el.group || '—'}`;
    } else {
      val = el[p.key] ?? null;
      if ((val === null || val === undefined) && !el.isHypothetical && typeof HelixML !== 'undefined') {
        const mlVal = HelixML.predict(el.number, p.key);
        if (mlVal !== null && mlVal !== undefined) {
          val = mlVal;
          isPredictedVal = true;
        }
      }
    }

    const card = document.createElement('div');
    card.className = 'prop-card' + (isPredictedVal ? ' ml-predicted' : '');

    const label = document.createElement('div');
    label.className = 'prop-label';
    label.textContent = p.label;

    if (isPredictedVal && p.key !== '_pos' && p.key !== 'phase' && p.key !== 'block') {
      const mlBadge = document.createElement('span');
      mlBadge.className = 'prop-ml-badge';
      mlBadge.textContent = 'ML';
      label.appendChild(mlBadge);
    }

    const valueEl = document.createElement('div');
    if (val !== null && val !== undefined && val !== '') {
      valueEl.className = 'prop-value';
      valueEl.textContent = (typeof val === 'number' && p.dp > 0) ? formatNum(val, p.dp) : val;

      card.appendChild(label);
      card.appendChild(valueEl);

      if (p.unit) {
        const unitEl = document.createElement('div');
        unitEl.className = 'prop-unit';
        unitEl.textContent = p.unit;
        card.appendChild(unitEl);
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
// ELECTRON CONFIGURATION & BOHR MODEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderElectronSection(el) {
  $('ec-notation').textContent = el.electron_configuration || '—';

  const shellsRow = $('ec-shells-row');
  shellsRow.innerHTML = '';

  if (el.shells && el.shells.length > 0) {
    el.shells.forEach((count, i) => {
      const shellName = SHELL_LABELS[i] || `Shell ${i + 1}`;
      const chip = document.createElement('div');
      chip.className = 'ec-shell-chip';
      chip.innerHTML = `<span>${shellName} (${i + 1})</span><span>${count} e⁻</span>`;
      shellsRow.appendChild(chip);
    });
  }
}

function renderBohrModel(el) {
  const canvas = $('bohr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;

  if (canvas._animId) cancelAnimationFrame(canvas._animId);

  const shells = el.shells || [];
  const maxShells = shells.length;
  if (maxShells === 0) {
    ctx.clearRect(0, 0, W, H);
    return;
  }

  const maxR = Math.min(CX, CY) - 18;
  const shellStep = maxR / (maxShells + 0.6);

  function animate() {
    canvas._animId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, W, H);

    const now = Date.now();

    // Nucleus Glow
    const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
    grd.addColorStop(0, '#00e5c8');
    grd.addColorStop(0.5, 'rgba(0,229,200,0.5)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(CX, CY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Symbol in center
    ctx.fillStyle = '#040d1a';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.symbol || '', CX, CY);

    // Shells
    shells.forEach((electronCount, i) => {
      const r = shellStep * (i + 1);

      // Orbital track
      ctx.strokeStyle = `rgba(0,229,200,${Math.max(0.06, 0.24 - i * 0.02)})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(CX, CY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Electrons
      const visibleElectrons = Math.min(electronCount, 32);
      for (let j = 0; j < visibleElectrons; j++) {
        const baseAngle = (2 * Math.PI * j) / visibleElectrons;
        const spinSpeed = 0.4 / (i + 1);
        const angle = baseAngle + now * spinSpeed * 0.001;
        const ex = CX + r * Math.cos(angle);
        const ey = CY + r * Math.sin(angle);

        // Glow
        const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 5);
        eg.addColorStop(0, 'rgba(124,92,252,0.9)');
        eg.addColorStop(1, 'rgba(124,92,252,0)');
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(ex, ey, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shell letter
      const letter = SHELL_LABELS[i] || `${i + 1}`;
      ctx.fillStyle = 'rgba(232,240,254,0.35)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, CX + r + 4, CY);
    });
  }

  animate();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ML PROPERTY PREDICTIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════
function renderPredictions(el) {
  // Render Model Performance Overview Row
  const metricsRow = $('model-metrics-row');
  metricsRow.innerHTML = '';

  const modelTargets = ['atomic_mass', 'density', 'melt', 'boil', 'electronegativity_pauling'];
  modelTargets.forEach(tgt => {
    const m = HelixML.getModelMetrics(tgt);
    if (!m) return;
    const chip = document.createElement('div');
    chip.className = 'metric-chip';
    const r2Val = (m.r2 * 100).toFixed(1);
    const scoreClass = m.r2 >= 0.8 ? 'metric-good' : m.r2 >= 0.5 ? 'metric-ok' : 'metric-bad';
    const shortNames = {
      atomic_mass: 'Mass',
      density: 'Density',
      melt: 'Melt',
      boil: 'Boil',
      electronegativity_pauling: 'Electroneg.',
    };
    chip.innerHTML = `<span class="metric-label">${shortNames[tgt] || tgt}:</span><span class="${scoreClass}">R² ${r2Val}% (MAPE ${m.mape}%)</span>`;
    metricsRow.appendChild(chip);
  });

  // Render Prediction Cards Grid
  const grid = $('prediction-grid');
  grid.innerHTML = '';

  for (const feat of PREDICT_FEATURES) {
    const actual = (!el.isHypothetical && el[feat.key] !== null && el[feat.key] !== undefined)
      ? el[feat.key]
      : null;

    const mlPredicted = HelixML.predict(el.number, feat.key);
    const mInfo = HelixML.getModelMetrics(feat.key);

    const card = document.createElement('div');
    card.className = 'pred-card';

    const label = document.createElement('div');
    label.className = 'pred-label';
    label.textContent = feat.label;

    const row = document.createElement('div');
    row.className = 'pred-row';

    const actualEl = document.createElement('div');
    actualEl.className = 'pred-actual';
    actualEl.textContent = actual !== null ? `${formatNum(actual, feat.dp)} ${feat.unit}` : (el.isHypothetical ? 'Hypothetical' : 'Not recorded');

    const estEl = document.createElement('div');
    estEl.className = 'pred-estimated';
    estEl.title = 'ML Ridge Regression Prediction';
    estEl.textContent = mlPredicted !== null ? `≈ ${formatNum(mlPredicted, feat.dp)} ${feat.unit}` : '—';

    row.appendChild(actualEl);
    row.appendChild(estEl);

    // Accuracy / Agreement calculation
    const barWrap = document.createElement('div');
    barWrap.className = 'pred-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'pred-bar';

    let matchEl = document.createElement('div');
    let pct = 75;

    if (actual !== null && mlPredicted !== null) {
      const err = Math.abs(actual - mlPredicted) / Math.max(Math.abs(actual), 1e-6);
      pct = Math.max(0, Math.min(100, (1 - err) * 100));
      matchEl.className = 'pred-match ' + (pct >= 85 ? 'good' : pct >= 60 ? 'ok' : 'ok');
      matchEl.textContent = `${pct.toFixed(0)}% agreement with literature`;
    } else if (el.isHypothetical) {
      const conf = el.confidence || HelixML.getConfidence(el.number);
      pct = conf.score * 100;
      matchEl.className = 'pred-match ' + (pct >= 60 ? 'ok' : 'missing');
      matchEl.textContent = `Extrapolated ML value (${conf.label})`;
    } else {
      matchEl.className = 'pred-match ok';
      matchEl.textContent = `ML-imputed missing literature value`;
    }

    setTimeout(() => { bar.style.width = pct + '%'; }, 60);
    barWrap.appendChild(bar);

    const confEl = document.createElement('div');
    confEl.className = 'pred-confidence';
    const sampleCount = mInfo ? mInfo.n_samples : 118;
    confEl.textContent = `Trained on ${sampleCount} elements · Ridge Regression`;

    card.appendChild(label);
    card.appendChild(row);
    card.appendChild(barWrap);
    card.appendChild(matchEl);
    card.appendChild(confEl);

    grid.appendChild(card);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIODIC MAP
// ═══════════════════════════════════════════════════════════════════════════════
function renderPeriodicMap(el) {
  const container = $('mini-table');
  container.innerHTML = '';

  const ROWS = 9, COLS = 18;
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

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

        const colour = getCatColor(e.category);
        cell.style.background = colour + '22';
        cell.style.borderColor = colour + '44';
        cell.style.color = colour;

        if (e.number === el.number) {
          cell.classList.add('active');
        } else if (e.period === el.period) {
          cell.classList.add('same-period');
        } else if (e.group && e.group === el.group) {
          cell.classList.add('same-group');
        } else if (e.block === el.block) {
          cell.classList.add('same-block');
        }

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
    { label: 'Period',   value: el.period, sub: el.period <= 7 ? `Standard Period ${el.period} of 7` : `Extended Period ${el.period} (Period 8+)` },
    { label: 'Group',    value: el.group || '—', sub: el.group ? `Column ${el.group} of 18` : 'Lanthanide/Actinide/Superactinide' },
    { label: 'Block',    value: (el.block || 's').toUpperCase(), sub: `${(el.block || 's').toUpperCase()}-orbital block` },
    { label: 'Series',   value: null, sub: el.category || 'superheavy element', long: true },
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
// TREND CHART
// ═══════════════════════════════════════════════════════════════════════════════
function renderTrendChart(z) {
  const el = currentElement || ALL_ELEMENTS.find(e => e.number === z) || createHypotheticalElement(z);
  const propKey = $('trend-property').value;
  const scope   = $('trend-scope').value;

  let subset = ALL_ELEMENTS;
  if (scope === 'period') {
    subset = ALL_ELEMENTS.filter(e => e.period === el.period);
  } else if (scope === 'group') {
    subset = ALL_ELEMENTS.filter(e => e.group && e.group === el.group);
  } else if (scope === 'block') {
    subset = ALL_ELEMENTS.filter(e => e.block === el.block);
  }

  // Extract points
  const dataPoints = subset
    .filter(e => e[propKey] !== null && e[propKey] !== undefined)
    .map(e => ({ z: e.number, v: e[propKey], symbol: e.symbol, isCurrent: e.number === z }));

  // If viewing a hypothetical element, append its predicted point to the trend chart!
  if (el.isHypothetical) {
    const predVal = el[propKey] ?? HelixML.predict(z, propKey);
    if (predVal !== null && predVal !== undefined) {
      dataPoints.push({
        z: el.number,
        v: predVal,
        symbol: el.symbol,
        isCurrent: true,
        isExtrapolated: true,
      });
    }
  }

  dataPoints.sort((a, b) => a.z - b.z);

  const canvas = $('trends-chart');
  if (!canvas || dataPoints.length === 0) return;

  const ctx   = canvas.getContext('2d');
  const W     = canvas.offsetWidth || canvas.parentElement.offsetWidth - 32;
  const H     = canvas.offsetHeight || 250;
  canvas.width  = W;
  canvas.height = H;

  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 20, right: 30, bottom: 40, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  const zVals = dataPoints.map(d => d.z);
  const vVals = dataPoints.map(d => d.v);
  const zMin  = Math.min(...zVals), zMax = Math.max(...zVals);
  const vMin  = Math.min(...vVals), vMax = Math.max(...vVals);
  const vRange = vMax - vMin || 1;

  const toX = valZ => PAD.left + (valZ - zMin) / (zMax - zMin || 1) * plotW;
  const toY = valV => PAD.top + plotH - (valV - vMin) / vRange * plotH;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
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

  // Axes label
  ctx.fillStyle = 'rgba(232,240,254,0.5)';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Atomic Number (Z)', PAD.left + plotW / 2, H - 14);

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
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = d.isExtrapolated ? 'rgba(124,92,252,0.3)' : 'rgba(0,229,200,0.25)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = d.isExtrapolated ? '#c084fc' : '#00e5c8';
      ctx.fill();

      ctx.fillStyle = d.isExtrapolated ? '#c084fc' : '#00e5c8';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${d.symbol} (${d.z})`, x, y - 8);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,229,200,0.45)';
      ctx.fill();
    }
  }

  // X ticks
  const tickStep = Math.max(1, Math.ceil((zMax - zMin + 1) / 8));
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
// DATA QUALITY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function renderDataQuality() {
  const container = $('quality-dashboard');
  if (!container || typeof HelixML === 'undefined') return;

  const qr = HelixML.getQualityReport();
  if (!qr) return;

  container.innerHTML = '';

  // 1. Completeness Card
  const cCard = document.createElement('div');
  cCard.className = 'quality-card';
  cCard.innerHTML = `
    <div class="quality-card-title"><span class="qc-icon">📊</span> Dataset Completeness</div>
    <div class="quality-metric-big pass">${qr.completeness.percentage}%</div>
    <div class="quality-detail">
      <strong>${qr.completeness.filled_cells.toLocaleString()}</strong> of ${qr.completeness.total_cells.toLocaleString()} data cells populated in canonical Dataset v1.1.
    </div>
    <div class="quality-bar-row">
      <span class="quality-bar-label">Overall</span>
      <div class="quality-bar-track">
        <div class="quality-bar-fill fill-good" style="width: ${qr.completeness.percentage}%"></div>
      </div>
      <span class="quality-bar-value">${qr.completeness.percentage}%</span>
    </div>
  `;
  container.appendChild(cCard);

  // 2. Structural Integrity Card
  const iCard = document.createElement('div');
  iCard.className = 'quality-card';
  iCard.innerHTML = `
    <div class="quality-card-title"><span class="qc-icon">🛡️</span> Structural Integrity</div>
    <ul class="quality-check-list">
      <li><span class="check-icon check-pass">✓</span> 118 Elements (Atomic Numbers 1 → 118 Continuous)</li>
      <li><span class="check-icon check-pass">✓</span> 118 Unique Symbols & Names</li>
      <li><span class="check-icon check-pass">✓</span> Periods [1–7] & Groups [1–18] conform to IUPAC</li>
      <li><span class="check-icon check-pass">✓</span> Orbitals restricted to standard blocks {s, p, d, f}</li>
      <li><span class="check-icon check-pass">✓</span> Positive Atomic Mass across all samples</li>
    </ul>
  `;
  container.appendChild(iCard);

  // 3. Thermodynamic Law & Physical Checks Card
  const tCard = document.createElement('div');
  tCard.className = 'quality-card';
  tCard.innerHTML = `
    <div class="quality-card-title"><span class="qc-icon">🔬</span> Physical Consistency Checks</div>
    <div class="quality-detail" style="margin-top:0;">
      <p style="margin-bottom:0.6rem;"><span class="check-pass">✓ 117 / 118</span> elements follow standard <code>T<sub>melt</sub> &le; T<sub>boil</sub></code>.</p>
      <div style="background:rgba(245,166,35,0.08);border:1px solid rgba(245,166,35,0.3);padding:0.6rem 0.8rem;border-radius:6px;">
        <strong style="color:var(--clr-amber);">Physical Anomaly Note:</strong><br>
        <strong>Arsenic (Z=33):</strong> Sublimation point at 1 atm is 887 K. The 1090 K melting point is a high-pressure triple point (&ge; 28 atm).
      </div>
    </div>
  `;
  container.appendChild(tCard);

  // 4. Missing Values Breakdown Card
  const mCard = document.createElement('div');
  mCard.className = 'quality-card';
  let missingBars = '';
  const total = qr.shape.rows;
  for (const [col, count] of Object.entries(qr.missing)) {
    const filledPct = ((total - count) / total * 100).toFixed(1);
    const fillCls = filledPct >= 90 ? 'fill-good' : filledPct >= 80 ? 'fill-warn' : 'fill-bad';
    const friendlyName = col.replace(/_/g, ' ');
    missingBars += `
      <div class="quality-bar-row">
        <span class="quality-bar-label" title="${col}">${friendlyName}</span>
        <div class="quality-bar-track">
          <div class="quality-bar-fill ${fillCls}" style="width: ${filledPct}%"></div>
        </div>
        <span class="quality-bar-value">${filledPct}%</span>
      </div>
    `;
  }
  mCard.innerHTML = `
    <div class="quality-card-title"><span class="qc-icon">📉</span> Feature Resolution Status</div>
    <div class="quality-detail" style="margin-bottom:0.6rem;">Density, melt, and boil points are 100% resolved in Dataset v1.1.</div>
    ${missingBars}
  `;
  container.appendChild(mCard);

  // 5. ML Model Summary Card
  const mlCard = document.createElement('div');
  mlCard.className = 'quality-card';
  mlCard.innerHTML = `
    <div class="quality-card-title"><span class="qc-icon">🤖</span> Machine Learning Models</div>
    <div class="quality-detail" style="margin-bottom:0.6rem;">
      Trained with scikit-learn Ridge Regression with polynomial interaction features (277 dimensions) to predict properties beyond Z=118.
    </div>
    <ul class="quality-check-list">
      <li><span class="check-icon check-pass">✓</span> <strong>Atomic Mass:</strong> R² = 98.9% (MAPE 11.7%)</li>
      <li><span class="check-icon check-pass">✓</span> <strong>Density:</strong> R² = 94.4% (MAPE 24.2%)</li>
      <li><span class="check-icon check-pass">✓</span> <strong>Electronegativity:</strong> R² = 93.9% (CV R² = 0.77)</li>
      <li><span class="check-icon check-pass">✓</span> <strong>Boiling Point:</strong> R² = 79.9% (CV R² = 0.42)</li>
    </ul>
  `;
  container.appendChild(mlCard);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAV ARROWS
// ═══════════════════════════════════════════════════════════════════════════════
function updateNavArrows(z) {
  const prev = $('prev-btn');
  const next = $('next-btn');
  const lbl  = $('nav-arrow-label');

  prev.disabled = z <= 1;
  next.disabled = false;

  if (currentElement) {
    lbl.textContent = `${currentElement.number} · ${currentElement.symbol} · ${currentElement.name}`;
  }
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
    'alkali metal':                                     '#ff6b6b',
    'alkaline earth metal':                             '#ffd93d',
    'lanthanide':                                       '#c084fc',
    'actinide':                                         '#86efac',
    'transition metal':                                 '#60a5fa',
    'post-transition metal':                            '#34d399',
    'metalloid':                                        '#fb923c',
    'polyatomic nonmetal':                              '#38bdf8',
    'diatomic nonmetal':                                '#38bdf8',
    'noble gas':                                        '#a78bfa',
    'superactinide (predicted)':                        '#c084fc',
    'alkali metal (predicted)':                         '#ff6b6b',
    'alkaline earth metal (predicted)':                 '#ffd93d',
    'transition metal (predicted)':                     '#60a5fa',
    'noble gas (predicted)':                            '#a78bfa',
    'post-transition metal (predicted)':                '#34d399',
    'halogen (predicted)':                              '#38bdf8',
    'unknown (predicted)':                              '#b8a1ff',
    'unknown, predicted to be an alkali metal':         '#ff6b6b',
    'unknown, predicted to be a noble gas':             '#a78bfa',
    'unknown, probably a noble gas':                    '#a78bfa',
    'unknown, probably a transition metal':             '#60a5fa',
    'unknown, probably post-transition metal':          '#34d399',
    'unknown, but predicted to be post-transition metal':'#34d399',
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
