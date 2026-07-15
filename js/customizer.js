/* ============================================================
   ENMIIS — Configurateur de tenue de soutenance
   État central + rendu ciblé : aperçu SVG recolorable,
   accordéon d'étapes, moteur de prix animé, validation,
   annuler / réinitialiser, récapitulatif de commande.
   ============================================================ */
(function () {
  'use strict';

  const toast = window.enmiisToast || function () {};

  /* ----------------------------------------------------------
     Catalogue
     ---------------------------------------------------------- */
  const PRODUCTS = {
    toge:    { label: 'Toge de Soutenance', base: 170, steps: ['size', 'main', 'trim', 'sleeve', 'accent', 'embroidery', 'accessories', 'quantity'] },
    capuche: { label: 'Capuche (Hood)',     base: 80,  steps: ['main', 'trim', 'accessories', 'quantity'] },
    mortier: { label: 'Mortier (Cap)',      base: 40,  steps: ['main', 'accent', 'accessories', 'quantity'] },
    pack:    { label: 'Pack Complet',       base: 260, steps: ['size', 'main', 'trim', 'sleeve', 'accent', 'embroidery', 'accessories', 'quantity'] },
  };

  const SIZES = [
    { id: 'XS', label: 'XS', note: '‹ 1m55' },
    { id: 'S',  label: 'S',  note: '1m55–1m65' },
    { id: 'M',  label: 'M',  note: '1m65–1m75' },
    { id: 'L',  label: 'L',  note: '1m75–1m85' },
    { id: 'XL', label: 'XL', note: '› 1m85' },
    { id: 'custom', label: 'Sur mesure', note: 'nous vous contactons' },
  ];

  const MAIN_COLORS = [
    { id: 'noir',      label: 'Noir Classique',   hex: '#17171A' },
    { id: 'marine',    label: 'Bleu Marine',      hex: '#1F2A44' },
    { id: 'bordeaux',  label: 'Bordeaux',         hex: '#5C1F2B' },
    { id: 'anthracite',label: 'Gris Anthracite',  hex: '#3C3F45' },
    { id: 'ivoire',    label: 'Blanc Ivoire',     hex: '#F1EDE4' },
    { id: 'emeraude',  label: 'Vert Émeraude',    hex: '#14544A', premium: 15 },
    { id: 'pourpre',   label: 'Pourpre Royal',    hex: '#46244C', premium: 15 },
  ];

  const TRIM_COLORS = [
    { id: 'or',      label: 'Or',           hex: '#C8A86B' },
    { id: 'argent',  label: 'Argent',       hex: '#C9CCD4' },
    { id: 'blanc',   label: 'Blanc Satin',  hex: '#F5F2EA' },
    { id: 'noir',    label: 'Noir',         hex: '#17171A' },
    { id: 'grenat',  label: 'Rouge Grenat', hex: '#8E2A35' },
    { id: 'roi',     label: 'Bleu Roi',     hex: '#24427C' },
    { id: 'emeraude',label: 'Émeraude',     hex: '#14544A' },
  ];

  const ACCENT_COLORS = [
    { id: 'or',      label: 'Or',           hex: '#C8A86B' },
    { id: 'argent',  label: 'Argent',       hex: '#C9CCD4' },
    { id: 'noir',    label: 'Noir',         hex: '#17171A' },
    { id: 'grenat',  label: 'Rouge Grenat', hex: '#8E2A35' },
    { id: 'roi',     label: 'Bleu Roi',     hex: '#24427C' },
    { id: 'emeraude',label: 'Émeraude',     hex: '#14544A' },
  ];

  const THREAD_COLORS = [
    { id: 'or',     label: 'Fil Or',     hex: '#C8A86B' },
    { id: 'argent', label: 'Fil Argent', hex: '#C9CCD4' },
    { id: 'blanc',  label: 'Fil Blanc',  hex: '#FFFFFF' },
    { id: 'noir',   label: 'Fil Noir',   hex: '#17171A' },
    { id: 'grenat', label: 'Fil Grenat', hex: '#8E2A35' },
    { id: 'roi',    label: 'Fil Bleu',   hex: '#24427C' },
  ];

  const FONTS = {
    serif:  "'Cormorant Garamond', serif",
    script: "'Great Vibes', cursive",
    modern: "'Inter', sans-serif",
  };
  const FONT_LABELS = { serif: 'Élégante', script: 'Calligraphie', modern: 'Moderne' };
  const POS_LABELS = { 'chest-right': 'Poitrine droite', 'chest-left': 'Poitrine gauche', back: 'Dos' };

  const ACCESSORIES = [
    { id: 'echarpe', label: 'Écharpe personnalisée « Félicitations Dr »', price: 35 },
    { id: 'box',     label: 'Box cadeau Prestige (dragées, mug, carte)',  price: 65 },
    { id: 'bouquet', label: 'Mini bouquet assorti',                        price: 30 },
    { id: 'cadre',   label: 'Cadre photo souvenir',                        price: 25 },
    { id: 'gland',   label: 'Gland (tassel) supplémentaire',               price: 10 },
  ];

  const EMB_TEXT_PRICE = 25;
  const EMB_LOGO_PRICE = 20;
  const FREE_SHIPPING_FROM = 200;
  const SHIPPING_PRICE = 8;

  const STEP_ORDER = ['product', 'size', 'main', 'trim', 'sleeve', 'accent', 'embroidery', 'accessories', 'quantity', 'summary'];

  /* ----------------------------------------------------------
     État
     ---------------------------------------------------------- */
  const DEFAULTS = {
    product: 'toge',
    size: null,
    main: 'noir',
    trim: 'or',
    sleeve: 'match',
    accent: 'or',
    embroidery: { enabled: false, text: '', font: 'serif', thread: 'or', position: 'chest-right', logo: null, logoName: '' },
    accessories: [],
    quantity: 1,
  };

  let state = load() || snapshot(DEFAULTS);
  let view = 'front';
  const history = [];

  function snapshot(s) { return JSON.parse(JSON.stringify(s)); }
  function save() {
    try { localStorage.setItem('enmiis-customizer', JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem('enmiis-customizer');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!PRODUCTS[parsed.product]) return null;
      return Object.assign(snapshot(DEFAULTS), parsed, {
        embroidery: Object.assign(snapshot(DEFAULTS.embroidery), parsed.embroidery || {}),
      });
    } catch (e) { return null; }
  }

  /* Mutation : mémorise l'état précédent pour "annuler" */
  function commit(mutator) {
    history.push(snapshot(state));
    if (history.length > 60) history.shift();
    mutator(state);
    save();
    renderAll();
  }

  /* ----------------------------------------------------------
     Raccourcis DOM
     ---------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const stage = $('#czStage');
  const steps = $$('.cz-step');
  const orderBtn = $('#czOrder');
  const undoBtn = $('#czUndo');

  function colorOf(list, id) { return list.find((c) => c.id === id); }
  function sleeveHex() {
    return state.sleeve === 'match'
      ? colorOf(MAIN_COLORS, state.main).hex
      : colorOf(MAIN_COLORS, state.sleeve).hex;
  }

  /* ----------------------------------------------------------
     Construction des contrôles
     ---------------------------------------------------------- */
  function buildProductCards() {
    $('#czProductCards').innerHTML = Object.entries(PRODUCTS).map(([id, p]) => `
      <button type="button" class="cz-card" data-product="${id}">
        <span class="cz-card__check"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg></span>
        <span class="cz-card__name">${p.label}</span>
        <span class="cz-card__price">${p.base} TND</span>
      </button>
    `).join('');
  }

  function buildSizes() {
    $('#czSizes').innerHTML = SIZES.map((s) => `
      <button type="button" data-size="${s.id}" aria-pressed="false">${s.label}<small>${s.note}</small></button>
    `).join('');
  }

  function swatchHTML(c, key, extra) {
    return `<button type="button" class="cz-swatch ${extra || ''} ${c.premium ? 'cz-swatch--premium' : ''}"
      data-key="${key}" data-color="${c.id}" data-tip="${c.label}${c.premium ? ' · +' + c.premium + ' TND' : ''}"
      style="background:${c.hex}" aria-label="${c.label}" aria-pressed="false"></button>`;
  }

  function buildSwatches() {
    $('#czMainSwatches').innerHTML = MAIN_COLORS.map((c) => swatchHTML(c, 'main')).join('');
    $('#czTrimSwatches').innerHTML = TRIM_COLORS.map((c) => swatchHTML(c, 'trim')).join('');
    $('#czSleeveSwatches').innerHTML =
      `<button type="button" class="cz-swatch cz-swatch--match" data-key="sleeve" data-color="match"
        data-tip="Assorties au tissu" aria-label="Assorties au tissu" aria-pressed="false"></button>` +
      MAIN_COLORS.map((c) => swatchHTML({ ...c, premium: 0 }, 'sleeve')).join('');
    $('#czAccentSwatches').innerHTML = ACCENT_COLORS.map((c) => swatchHTML(c, 'accent')).join('');
    $('#czThreadSwatches').innerHTML = THREAD_COLORS.map((c) => swatchHTML(c, 'thread')).join('');
  }

  function buildAccessories() {
    $('#czAccList').innerHTML = ACCESSORIES.map((a) => `
      <label>
        <input type="checkbox" data-acc="${a.id}">
        <span class="cz-acc__name">${a.label}</span>
        <span class="cz-acc__price">+${a.price} TND</span>
      </label>
    `).join('');
  }

  /* ----------------------------------------------------------
     Aperçu SVG
     ---------------------------------------------------------- */
  const EMB_ANCHORS = {
    front: { 'chest-right': { x: 243, y: 158 }, 'chest-left': { x: 157, y: 158 } },
    back: { back: { x: 200, y: 190 } },
  };

  function renderPreview() {
    const product = state.product;
    const mainHex = colorOf(MAIN_COLORS, state.main).hex;
    const trimHex = colorOf(TRIM_COLORS, state.trim).hex;
    const accentHex = colorOf(ACCENT_COLORS, state.accent).hex;

    $$('#czSvg .cz-p-main').forEach((el) => { el.style.fill = mainHex; });
    $$('#czSvg .cz-p-trim').forEach((el) => { el.style.fill = trimHex; });
    $$('#czSvg .cz-p-sleeve').forEach((el) => { el.style.fill = sleeveHex(); });
    $$('#czSvg .cz-p-accent').forEach((el) => {
      /* le cordon du gland est un trait, pas une forme pleine */
      if (!el.classList.contains('cz-tassel')) el.style.fill = accentHex;
      el.style.color = accentHex; /* pour le cordon (stroke: currentColor) */
    });

    const showGown = product === 'toge' || product === 'pack';
    const showHood = product === 'capuche' || product === 'pack';
    const showCap = product === 'mortier' || product === 'pack';

    $('#czGownFront').style.display = showGown ? '' : 'none';
    $('#czGownBack').style.display = showGown ? '' : 'none';
    $('#czHoodFront').style.display = showHood ? '' : 'none';
    $('#czHoodBack').style.display = showHood ? '' : 'none';
    $('#czCap').style.display = showCap ? '' : 'none';

    /* produits seuls : recentrer la pièce */
    const scale = { capuche: 'translate(0,110) scale(1.35)', mortier: 'translate(0,140) scale(1.6)' };
    $('#czHoodFront').setAttribute('transform', product === 'capuche' ? scale.capuche : '');
    $('#czHoodBack').setAttribute('transform', product === 'capuche' ? scale.capuche : '');
    $('#czCap').setAttribute('transform', product === 'mortier' ? scale.mortier : '');

    /* broderie */
    const emb = state.embroidery;
    const embOK = emb.enabled && stepApplies('embroidery');
    const threadHex = colorOf(THREAD_COLORS, emb.thread).hex;
    const ff = FONTS[emb.font];

    const tf = $('#czEmbTextFront');
    const tb = $('#czEmbTextBack');
    const lf = $('#czLogoFront');
    const lb = $('#czLogoBack');
    tf.textContent = '';
    tb.textContent = '';
    lf.style.display = 'none';
    lb.style.display = 'none';

    if (embOK) {
      const isBack = emb.position === 'back';
      const anchor = isBack ? EMB_ANCHORS.back.back : EMB_ANCHORS.front[emb.position];
      const textEl = isBack ? tb : tf;
      const logoEl = isBack ? lb : lf;

      if (emb.text) {
        textEl.textContent = emb.text;
        textEl.setAttribute('x', anchor.x);
        textEl.setAttribute('y', anchor.y + (emb.logo ? 26 : 0));
        textEl.setAttribute('font-family', ff);
        textEl.style.fill = threadHex;
      }
      if (emb.logo) {
        const w = isBack ? 38 : 34;
        logoEl.setAttribute('href', emb.logo);
        logoEl.setAttribute('x', anchor.x - w / 2);
        logoEl.setAttribute('y', anchor.y - w + 6);
        logoEl.style.display = '';
      }
    }
  }

  function setView(next, animate) {
    view = next;
    const apply = () => {
      $('#czFront').style.display = view === 'front' ? '' : 'none';
      $('#czBack').style.display = view === 'back' ? '' : 'none';
      $('#czViewFront').classList.toggle('is-active', view === 'front');
      $('#czViewFront').setAttribute('aria-pressed', String(view === 'front'));
      $('#czViewBack').classList.toggle('is-active', view === 'back');
      $('#czViewBack').setAttribute('aria-pressed', String(view === 'back'));
    };
    if (animate) {
      stage.classList.add('is-flipping');
      setTimeout(() => {
        apply();
        stage.classList.remove('is-flipping');
      }, 220);
    } else {
      apply();
    }
  }

  /* zoom au survol (souris uniquement) */
  stage.addEventListener('mousemove', (e) => {
    if (window.matchMedia('(hover: none)').matches) return;
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--zx', ((e.clientX - r.left) / r.width) * 100 + '%');
    stage.style.setProperty('--zy', ((e.clientY - r.top) / r.height) * 100 + '%');
    stage.classList.add('is-zoomed');
  });
  stage.addEventListener('mouseleave', () => stage.classList.remove('is-zoomed'));

  /* ----------------------------------------------------------
     Étapes / accordéon
     ---------------------------------------------------------- */
  function stepApplies(name) {
    if (name === 'product' || name === 'summary') return true;
    return PRODUCTS[state.product].steps.includes(name);
  }

  /* la ligne "taille" reste visible même en taille unique */
  function visibleSteps() { return STEP_ORDER.filter((n) => n === 'size' || stepApplies(n)); }

  function openStep(name, focus) {
    steps.forEach((step) => {
      const isTarget = step.dataset.step === name;
      const head = step.querySelector('.cz-step__head');
      const body = step.querySelector('.cz-step__body');
      step.classList.toggle('is-open', isTarget);
      head.setAttribute('aria-expanded', String(isTarget));
      body.hidden = !isTarget;
    });
    const idx = visibleSteps().indexOf(name);
    if (idx >= 0) $('#czStepCount').textContent = 'Étape ' + (idx + 1) + ' sur ' + visibleSteps().length;
    if (focus) {
      const step = steps.find((s) => s.dataset.step === name);
      step?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function currentOpenStep() {
    const open = steps.find((s) => s.classList.contains('is-open'));
    return open ? open.dataset.step : 'product';
  }

  function nextStep() {
    const order = visibleSteps();
    const idx = order.indexOf(currentOpenStep());
    const next = order[Math.min(idx + 1, order.length - 1)];
    openStep(next, true);
  }

  /* résumé de chaque étape + états fait / invalide */
  function stepValue(name) {
    const emb = state.embroidery;
    switch (name) {
      case 'product': return PRODUCTS[state.product].label;
      case 'size':
        if (!stepApplies('size')) return 'Taille unique';
        return state.size ? (SIZES.find((s) => s.id === state.size).label) : '';
      case 'main': return colorOf(MAIN_COLORS, state.main).label;
      case 'trim': return colorOf(TRIM_COLORS, state.trim).label;
      case 'sleeve': return state.sleeve === 'match' ? 'Assorties au tissu' : colorOf(MAIN_COLORS, state.sleeve).label;
      case 'accent': return colorOf(ACCENT_COLORS, state.accent).label;
      case 'embroidery':
        if (!emb.enabled) return 'Sans broderie';
        return [emb.text && ('« ' + emb.text + ' »'), emb.logo && 'logo', POS_LABELS[emb.position]].filter(Boolean).join(' · ');
      case 'accessories':
        return state.accessories.length
          ? state.accessories.length + ' accessoire' + (state.accessories.length > 1 ? 's' : '')
          : 'Aucun';
      case 'quantity': return '× ' + state.quantity;
      case 'summary': return '';
    }
  }

  function stepDone(name) {
    switch (name) {
      case 'size': return !stepApplies('size') || Boolean(state.size);
      case 'embroidery': return !state.embroidery.enabled || Boolean(state.embroidery.text.trim() || state.embroidery.logo);
      case 'summary': return false;
      default: return true;
    }
  }

  function validation() {
    const problems = [];
    if (stepApplies('size') && !state.size) problems.push('size');
    if (stepApplies('embroidery') && state.embroidery.enabled && !state.embroidery.text.trim() && !state.embroidery.logo) problems.push('embroidery');
    return problems;
  }

  function renderSteps() {
    const order = visibleSteps();
    steps.forEach((step) => {
      const name = step.dataset.step;
      const idx = order.indexOf(name);
      step.classList.toggle('is-hidden', idx === -1);
      if (idx !== -1) step.querySelector('.cz-step__num').textContent = idx + 1;

      step.querySelector('[data-value]').textContent = stepValue(name) || '';
      step.classList.toggle('is-done', stepDone(name));
    });

    /* contrôles reflétant l'état */
    $$('#czProductCards .cz-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.product === state.product);
    });

    const sizeApplicable = stepApplies('size');
    $('#czSizes').innerHTML = sizeApplicable
      ? SIZES.map((s) => `
        <button type="button" data-size="${s.id}" class="${state.size === s.id ? 'is-active' : ''}"
          aria-pressed="${state.size === s.id}">${s.label}<small>${s.note}</small></button>`).join('')
      : '<p class="cz-help">Ce produit est en taille unique — rien à choisir ici.</p>';

    $$('.cz-swatch').forEach((sw) => {
      const key = sw.dataset.key;
      const val = key === 'thread' ? state.embroidery.thread : state[key];
      const active = sw.dataset.color === val;
      sw.classList.toggle('is-active', active);
      sw.setAttribute('aria-pressed', String(active));
    });

    /* broderie */
    const emb = state.embroidery;
    $('#czEmbNo').classList.toggle('is-active', !emb.enabled);
    $('#czEmbNo').setAttribute('aria-pressed', String(!emb.enabled));
    $('#czEmbYes').classList.toggle('is-active', emb.enabled);
    $('#czEmbYes').setAttribute('aria-pressed', String(emb.enabled));
    $('#czEmbOptions').hidden = !emb.enabled;
    if ($('#czEmbText').value !== emb.text) $('#czEmbText').value = emb.text;
    $$('#czFonts button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.font === emb.font);
      b.setAttribute('aria-pressed', String(b.dataset.font === emb.font));
    });
    $$('#czPositions button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.pos === emb.position);
      b.setAttribute('aria-pressed', String(b.dataset.pos === emb.position));
    });
    $('#czUploadLabel').textContent = emb.logoName || 'Téléverser un logo (PNG, JPG)';
    $('#czLogoRemove').hidden = !emb.logo;

    /* accessoires */
    $$('#czAccList input').forEach((input) => {
      input.checked = state.accessories.includes(input.dataset.acc);
    });

    $('#czQtyValue').textContent = state.quantity;

    /* progression */
    const progressSteps = order.filter((s) => s !== 'summary');
    const done = progressSteps.filter(stepDone).length;
    $('#czProgressBar').style.width = Math.max(8, Math.round((done / progressSteps.length) * 100)) + '%';

    undoBtn.disabled = history.length === 0;
  }

  /* ----------------------------------------------------------
     Prix
     ---------------------------------------------------------- */
  function unitPrice() {
    let sum = PRODUCTS[state.product].base;
    const main = colorOf(MAIN_COLORS, state.main);
    if (main.premium) sum += main.premium;
    if (stepApplies('embroidery') && state.embroidery.enabled) {
      if (state.embroidery.text.trim()) sum += EMB_TEXT_PRICE;
      if (state.embroidery.logo) sum += EMB_LOGO_PRICE;
    }
    state.accessories.forEach((id) => {
      const acc = ACCESSORIES.find((a) => a.id === id);
      if (acc) sum += acc.price;
    });
    return sum;
  }

  function total() { return unitPrice() * state.quantity; }

  let shownTotal = 0;
  let priceAnim = null;
  function renderPrice() {
    const target = total();
    if (priceAnim) cancelAnimationFrame(priceAnim);
    const from = shownTotal;
    const t0 = performance.now();
    const DUR = 350;
    function tick(now) {
      const p = Math.min((now - t0) / DUR, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      shownTotal = Math.round(from + (target - from) * eased);
      $('#czTotal').textContent = shownTotal + ' TND';
      if (p < 1) priceAnim = requestAnimationFrame(tick);
    }
    priceAnim = requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     Récapitulatif
     ---------------------------------------------------------- */
  function summaryRows() {
    const emb = state.embroidery;
    const rows = [
      ['Produit', PRODUCTS[state.product].label],
      stepApplies('size') ? ['Taille', state.size ? SIZES.find((s) => s.id === state.size).label : '—'] : null,
      ['Tissu principal', colorOf(MAIN_COLORS, state.main).label],
      stepApplies('trim') ? ['Bordure', colorOf(TRIM_COLORS, state.trim).label] : null,
      stepApplies('sleeve') ? ['Manches', stepValue('sleeve')] : null,
      stepApplies('accent') ? ['Accents', colorOf(ACCENT_COLORS, state.accent).label] : null,
      stepApplies('embroidery')
        ? ['Broderie', emb.enabled
            ? [emb.text && ('« ' + emb.text + ' »'), emb.logo && 'logo fourni',
               FONT_LABELS[emb.font], colorOf(THREAD_COLORS, emb.thread).label, POS_LABELS[emb.position]]
              .filter(Boolean).join(', ')
            : 'Sans']
        : null,
      ['Accessoires', state.accessories.length
        ? state.accessories.map((id) => ACCESSORIES.find((a) => a.id === id).label).join(', ')
        : 'Aucun'],
      ['Quantité', String(state.quantity)],
      ['Prix unitaire', unitPrice() + ' TND'],
      ['Total', total() + ' TND'],
    ];
    return rows.filter(Boolean);
  }

  function renderSummary() {
    $('#czSummaryList').innerHTML = summaryRows()
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    const emb = stepApplies('embroidery') && state.embroidery.enabled;
    $('#czEstProd').textContent = emb ? '7–10 jours ouvrés' : '5–7 jours ouvrés';
    $('#czEstShip').textContent = total() >= FREE_SHIPPING_FROM
      ? '2–4 jours, offerte'
      : '2–4 jours, +' + SHIPPING_PRICE + ' TND';

    const valid = validation().length === 0;
    orderBtn.setAttribute('aria-disabled', String(!valid));
  }

  function renderAll() {
    renderPreview();
    renderSteps();
    renderPrice();
    renderSummary();
  }

  /* ----------------------------------------------------------
     Événements
     ---------------------------------------------------------- */

  /* accordéon */
  steps.forEach((step) => {
    step.querySelector('.cz-step__head').addEventListener('click', () => {
      const isOpen = step.classList.contains('is-open');
      openStep(isOpen ? '' : step.dataset.step);
    });
  });
  $$('.cz-next').forEach((btn) => btn.addEventListener('click', nextStep));

  /* produit */
  $('#czProductCards').addEventListener('click', (e) => {
    const card = e.target.closest('.cz-card');
    if (!card) return;
    commit((s) => {
      s.product = card.dataset.product;
      if (!stepApplies('size')) s.size = null;
    });
  });

  /* taille */
  $('#czSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn) return;
    commit((s) => { s.size = btn.dataset.size; });
    hideError('size');
  });

  /* pastilles de couleur (tous groupes) */
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('.cz-swatch');
    if (!sw) return;
    const key = sw.dataset.key;
    const color = sw.dataset.color;
    commit((s) => {
      if (key === 'thread') s.embroidery.thread = color;
      else s[key] = color;
    });
  });

  /* broderie */
  $('#czEmbNo').addEventListener('click', () => commit((s) => { s.embroidery.enabled = false; }));
  $('#czEmbYes').addEventListener('click', () => commit((s) => { s.embroidery.enabled = true; }));

  /* rendu immédiat de l'aperçu ; une seule entrée d'historique par salve de frappe */
  let textDebounce = null;
  let textBurstPrev = null;
  $('#czEmbText').addEventListener('input', (e) => {
    if (textBurstPrev === null) textBurstPrev = snapshot(state);
    state.embroidery.text = e.target.value;
    renderPreview();
    renderPrice();
    renderSummary();
    clearTimeout(textDebounce);
    textDebounce = setTimeout(() => {
      history.push(textBurstPrev);
      if (history.length > 60) history.shift();
      textBurstPrev = null;
      save();
      renderSteps();
      hideError('embroidery');
    }, 300);
  });

  $('#czFonts').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-font]');
    if (btn) commit((s) => { s.embroidery.font = btn.dataset.font; });
  });

  $('#czPositions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pos]');
    if (!btn) return;
    commit((s) => { s.embroidery.position = btn.dataset.pos; });
    setView(btn.dataset.pos === 'back' ? 'back' : 'front', true);
  });

  $('#czLogoInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('Image trop lourde — 4 Mo maximum.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      commit((s) => {
        s.embroidery.logo = reader.result;
        s.embroidery.logoName = file.name;
      });
      hideError('embroidery');
      toast('Logo ajouté à votre broderie.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  $('#czLogoRemove').addEventListener('click', () => {
    commit((s) => { s.embroidery.logo = null; s.embroidery.logoName = ''; });
  });

  /* accessoires */
  $('#czAccList').addEventListener('change', (e) => {
    const input = e.target.closest('input[data-acc]');
    if (!input) return;
    commit((s) => {
      const id = input.dataset.acc;
      s.accessories = input.checked
        ? s.accessories.concat(id)
        : s.accessories.filter((a) => a !== id);
    });
  });

  /* quantité */
  $('#czQtyMinus').addEventListener('click', () => commit((s) => { s.quantity = Math.max(1, s.quantity - 1); }));
  $('#czQtyPlus').addEventListener('click', () => commit((s) => { s.quantity = Math.min(20, s.quantity + 1); }));

  /* vues */
  $('#czViewFront').addEventListener('click', () => setView('front', true));
  $('#czViewBack').addEventListener('click', () => setView('back', true));

  /* annuler / réinitialiser */
  undoBtn.addEventListener('click', () => {
    const prev = history.pop();
    if (!prev) return;
    state = prev;
    save();
    renderAll();
    toast('Modification annulée.');
  });

  $('#czReset').addEventListener('click', () => {
    history.push(snapshot(state));
    state = snapshot(DEFAULTS);
    try { localStorage.removeItem('enmiis-customizer'); } catch (e) { /* ignore */ }
    renderAll();
    openStep('product', true);
    setView('front');
    toast('Configuration réinitialisée.');
  });

  /* validation + erreurs */
  function showError(name) {
    const step = steps.find((s) => s.dataset.step === name);
    if (!step) return;
    step.classList.add('is-invalid');
    step.querySelectorAll('[data-error]').forEach((el) => { el.hidden = false; });
  }
  function hideError(name) {
    const step = steps.find((s) => s.dataset.step === name);
    if (!step) return;
    step.classList.remove('is-invalid');
    step.querySelectorAll('[data-error]').forEach((el) => { el.hidden = true; });
  }

  /* commande */
  const modal = $('#czModal');

  function recapText() {
    return 'Commande ENMIIS — Configurateur Soutenance\n'
      + summaryRows().map(([k, v]) => k + ' : ' + v).join('\n')
      + '\nConfection : ' + $('#czEstProd').textContent
      + '\nLivraison : ' + $('#czEstShip').textContent;
  }

  orderBtn.addEventListener('click', () => {
    const problems = validation();
    if (problems.length) {
      problems.forEach(showError);
      openStep(problems[0], true);
      toast('Quelques informations manquent avant de commander.');
      return;
    }
    ['size', 'embroidery'].forEach(hideError);
    $('#czModalRecap').textContent = recapText();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    modal.querySelector('.cz-modal__close').focus();
  });

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }
  $$('[data-cz-modal-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  $('#czModalCopy').addEventListener('click', () => {
    const text = recapText();
    const done = () => toast('Récapitulatif copié — collez-le dans votre message.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  });

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* silencieux */ }
    document.body.removeChild(ta);
  }

  /* ----------------------------------------------------------
     Démarrage
     ---------------------------------------------------------- */
  buildProductCards();
  buildSizes();
  buildSwatches();
  buildAccessories();
  renderAll();
  setView('front');
  openStep('product');
})();
