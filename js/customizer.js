/* ============================================================
   ENMIIS — Configurateur de tenue de soutenance (v2)
   Parcours pièce par pièce (Robe → Mortier → Capuche),
   devis approximatif calculé par un algorithme documenté,
   formulaire client et facture imprimable.
   ============================================================ */
(function () {
  'use strict';

  const toast = window.enmiisToast || function () {};

  /* Numéro WhatsApp professionnel (format international sans "+",
     ex. '21612345678'). Laissez vide pour masquer le bouton WhatsApp. */
  const BUSINESS_WHATSAPP = '';

  /* ----------------------------------------------------------
     Catalogue & tarifs
     ---------------------------------------------------------- */
  const PIECES = {
    robe: { label: 'Robe de soutenance', base: 170 },
    cap:  { label: 'Mortier (coiffe)',   base: 40 },
    hood: { label: 'Capuche (hood)',     base: 80 },
  };

  const PRODUCTS = {
    toge:    { label: 'Robe de Soutenance', pieces: ['robe'] },
    mortier: { label: 'Mortier (Cap)',      pieces: ['cap'] },
    capuche: { label: 'Capuche (Hood)',     pieces: ['hood'] },
    pack:    { label: 'Pack Complet',       pieces: ['robe', 'cap', 'hood'] },
  };

  /* Algorithme de prix (prototype) — voir computeQuote() :
     robe 170 + tissu premium 15 + XL 5 + sur-mesure 12 %
     + broderie (15 + 0,75 TND/caractère, logo +20) ;
     mortier 40 ; capuche 80 ; pack −10 % sur les pièces ;
     accessoires au prix affiché ; quantité ≥3 : −5 %, ≥6 : −10 % ;
     livraison 8 TND, offerte dès 200 TND. */
  const PRICE = {
    premiumFabric: 15,
    xlSurcharge: 5,
    customRate: 0.12,
    tallSurcharge: 8,   /* stature ≥ 190 cm : tissu supplémentaire */
    embBase: 15,
    embPerChar: 0.75,
    embLogo: 20,
    packRate: 0.10,
    qty3Rate: 0.05,
    qty6Rate: 0.10,
    shipping: 8,
    freeShippingFrom: 200,
  };

  const SIZES = [
    { id: 'XS', label: 'XS', note: '‹ 1m55' },
    { id: 'S',  label: 'S',  note: '1m55–1m65' },
    { id: 'M',  label: 'M',  note: '1m65–1m75' },
    { id: 'L',  label: 'L',  note: '1m75–1m85' },
    { id: 'XL', label: 'XL', note: '› 1m85' },
    { id: 'custom', label: 'Sur mesure', note: '+12 %' },
  ];

  const MAIN_COLORS = [
    { id: 'noir',       label: 'Noir Classique',  hex: '#17171A' },
    { id: 'marine',     label: 'Bleu Marine',     hex: '#1F2A44' },
    { id: 'bordeaux',   label: 'Bordeaux',        hex: '#5C1F2B' },
    { id: 'anthracite', label: 'Gris Anthracite', hex: '#3C3F45' },
    { id: 'ivoire',     label: 'Blanc Ivoire',    hex: '#F1EDE4' },
    { id: 'emeraude',   label: 'Vert Émeraude',   hex: '#14544A', premium: true },
    { id: 'pourpre',    label: 'Pourpre Royal',   hex: '#46244C', premium: true },
  ];

  const TRIM_COLORS = [
    { id: 'or',       label: 'Or',           hex: '#C8A86B' },
    { id: 'argent',   label: 'Argent',       hex: '#C9CCD4' },
    { id: 'blanc',    label: 'Blanc Satin',  hex: '#F5F2EA' },
    { id: 'noir',     label: 'Noir',         hex: '#17171A' },
    { id: 'grenat',   label: 'Rouge Grenat', hex: '#8E2A35' },
    { id: 'roi',      label: 'Bleu Roi',     hex: '#24427C' },
    { id: 'emeraude', label: 'Émeraude',     hex: '#14544A' },
  ];

  const ACCENT_COLORS = [
    { id: 'or',       label: 'Or',           hex: '#C8A86B' },
    { id: 'argent',   label: 'Argent',       hex: '#C9CCD4' },
    { id: 'noir',     label: 'Noir',         hex: '#17171A' },
    { id: 'grenat',   label: 'Rouge Grenat', hex: '#8E2A35' },
    { id: 'roi',      label: 'Bleu Roi',     hex: '#24427C' },
    { id: 'emeraude', label: 'Émeraude',     hex: '#14544A' },
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

  const REGIONS = ['Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
    'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine',
    'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine',
    'Tozeur', 'Tunis', 'Zaghouan'];

  /* ----------------------------------------------------------
     Définition des étapes
     piece : pièce mise en avant dans l'aperçu pendant l'étape
     phase : libellé de regroupement affiché en mode Pack
     ---------------------------------------------------------- */
  const STEP_DEFS = [
    { id: 'product',     title: 'Produit',            piece: null,   phase: null },
    { id: 'measures',    title: 'Taille & mesures',   piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'robe-main',   title: 'Tissu de la robe',   piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'robe-trim',   title: 'Bordure & col',      piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'robe-sleeve', title: 'Manches',            piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'robe-accent', title: 'Chevrons & poignets',piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'robe-emb',    title: 'Broderie',           piece: 'robe', phase: 'La Robe',    products: ['toge', 'pack'] },
    { id: 'cap-main',    title: 'Couleur du mortier', piece: 'cap',  phase: 'Le Mortier', products: ['mortier', 'pack'] },
    { id: 'cap-accent',  title: 'Gland & bouton',     piece: 'cap',  phase: 'Le Mortier', products: ['mortier', 'pack'] },
    { id: 'hood-main',   title: 'Couleur de la capuche', piece: 'hood', phase: 'La Capuche', products: ['capuche', 'pack'] },
    { id: 'hood-trim',   title: 'Satin intérieur',    piece: 'hood', phase: 'La Capuche', products: ['capuche', 'pack'] },
    { id: 'accessories', title: 'Accessoires',        piece: null,   phase: 'Finalisation' },
    { id: 'quantity',    title: 'Quantité',           piece: null,   phase: 'Finalisation' },
    { id: 'client',      title: 'Vos informations',   piece: null,   phase: 'Finalisation' },
    { id: 'quote',       title: 'Devis & facture',    piece: null,   phase: 'Finalisation' },
  ];

  /* ----------------------------------------------------------
     État
     ---------------------------------------------------------- */
  const DEFAULTS = {
    product: 'pack',
    measures: { size: null, height: '', chest: '' },
    robe: {
      main: 'noir', trim: 'or', sleeve: 'match', accent: 'or',
      emb: { enabled: false, text: '', font: 'serif', thread: 'or', position: 'chest-right', logo: null, logoName: '' },
    },
    cap: { main: 'noir', accent: 'or' },
    hood: { main: 'noir', trim: 'or' },
    accessories: [],
    quantity: 1,
    client: { name: '', whatsapp: '', region: '', date: '', notes: '' },
  };

  let state = load() || snapshot(DEFAULTS);
  let view = 'front';
  const history = [];

  function snapshot(s) { return JSON.parse(JSON.stringify(s)); }
  function save() {
    try { localStorage.setItem('enmiis-customizer-v2', JSON.stringify(state)); } catch (e) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem('enmiis-customizer-v2');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!PRODUCTS[parsed.product]) return null;
      const merged = snapshot(DEFAULTS);
      ['product', 'accessories', 'quantity'].forEach((k) => { if (parsed[k] !== undefined) merged[k] = parsed[k]; });
      ['measures', 'cap', 'hood', 'client'].forEach((k) => Object.assign(merged[k], parsed[k] || {}));
      Object.assign(merged.robe, parsed.robe || {});
      merged.robe.emb = Object.assign(snapshot(DEFAULTS.robe.emb), (parsed.robe || {}).emb || {});
      return merged;
    } catch (e) { return null; }
  }

  function commit(mutator) {
    history.push(snapshot(state));
    if (history.length > 60) history.shift();
    mutator(state);
    save();
    renderAll();
  }

  /* saisie texte : une seule entrée d'historique par salve de frappe */
  let burstPrev = null;
  let burstTimer = null;
  function burst(mutator) {
    if (burstPrev === null) burstPrev = snapshot(state);
    mutator(state);
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      history.push(burstPrev);
      if (history.length > 60) history.shift();
      burstPrev = null;
      save();
      renderSteps();
      renderQuoteBox();
    }, 350);
    renderPreview();
    renderPrice();
  }

  /* ----------------------------------------------------------
     Raccourcis DOM
     ---------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const stage = $('#czStage');
  const stepsRoot = $('#czSteps');
  const orderBtn = $('#czOrder');
  const undoBtn = $('#czUndo');

  const colorOf = (list, id) => list.find((c) => c.id === id);
  const money = (n) => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' TND';

  /* ----------------------------------------------------------
     Génération des étapes
     ---------------------------------------------------------- */
  function swatchHTML(c, path, extraClass) {
    return `<button type="button" class="cz-swatch ${extraClass || ''} ${c.premium ? 'cz-swatch--premium' : ''}"
      data-path="${path}" data-color="${c.id}" data-tip="${c.label}${c.premium ? ' · +' + PRICE.premiumFabric + ' TND' : ''}"
      style="background:${c.hex}" aria-label="${c.label}" aria-pressed="false"></button>`;
  }

  function swatchGroup(path, colors, opts) {
    const small = opts && opts.small ? 'cz-swatches--small' : '';
    const match = opts && opts.match
      ? `<button type="button" class="cz-swatch cz-swatch--match" data-path="${path}" data-color="match"
          data-tip="Assorties au tissu" aria-label="Assorties au tissu" aria-pressed="false"></button>`
      : '';
    return `<div class="cz-swatches ${small}">` + match + colors.map((c) => swatchHTML(c, path)).join('') + '</div>';
  }

  const BODIES = {
    product: () => `
      <div class="cz-cards">${Object.entries(PRODUCTS).map(([id, p]) => {
        const base = p.pieces.reduce((sum, piece) => sum + PIECES[piece].base, 0);
        const price = id === 'pack' ? Math.round(base * (1 - PRICE.packRate)) : base;
        return `<button type="button" class="cz-card" data-product="${id}">
          <span class="cz-card__check"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg></span>
          <span class="cz-card__name">${p.label}</span>
          <span class="cz-card__price">dès ${price} TND${id === 'pack' ? ' · −10 %' : ''}</span>
        </button>`;
      }).join('')}</div>
      <p class="cz-help" style="margin-top:0.9rem">Le Pack Complet se personnalise pièce par pièce :
        d'abord la robe, puis le mortier, puis la capuche.</p>`,

    measures: () => `
      <div class="cz-sizes" id="czSizes"></div>
      <div class="cz-measures" id="czMeasures" hidden>
        <div class="cz-field">
          <label for="czHeight">Votre stature (cm)</label>
          <input type="number" id="czHeight" inputmode="numeric" min="130" max="215" placeholder="Ex : 172">
        </div>
        <div class="cz-field">
          <label for="czChest">Tour de poitrine (cm) — optionnel</label>
          <input type="number" id="czChest" inputmode="numeric" min="60" max="160" placeholder="Ex : 96">
        </div>
      </div>
      <p class="cz-help" style="margin-top:0.75rem">Taille XL : +${PRICE.xlSurcharge} TND ·
        Sur mesure : +12 % · Stature ≥ 190 cm : +${PRICE.tallSurcharge} TND de tissu.</p>
      <p class="cz-error" data-error hidden>Choisissez une taille (et votre stature pour le sur-mesure).</p>
      <button class="btn btn--solid cz-next" type="button">Continuer</button>`,

    'robe-main':   () => swatchGroup('robe.main', MAIN_COLORS) + nextBtn(),
    'robe-trim':   () => swatchGroup('robe.trim', TRIM_COLORS) + nextBtn(),
    'robe-sleeve': () => swatchGroup('robe.sleeve', MAIN_COLORS.map((c) => ({ ...c, premium: false })), { match: true }) + nextBtn(),
    'robe-accent': () => '<p class="cz-help">Chevrons de manches, poignets et liserés.</p>'
      + swatchGroup('robe.accent', ACCENT_COLORS) + nextBtn(),

    'robe-emb': () => `
      <div class="cz-toggle">
        <button type="button" id="czEmbNo" class="is-active" aria-pressed="true">Sans broderie</button>
        <button type="button" id="czEmbYes" aria-pressed="false">Avec broderie <span class="cz-plus">dès ${PRICE.embBase} TND</span></button>
      </div>
      <div class="cz-emb" id="czEmbOptions" hidden>
        <div class="cz-field">
          <label for="czEmbText">Texte à broder</label>
          <input type="text" id="czEmbText" maxlength="26" placeholder="Ex : Dr Salhi Wafa" autocomplete="off">
          <p class="cz-help" style="margin-top:0.4rem">Tarif : ${PRICE.embBase} TND + ${String(PRICE.embPerChar).replace('.', ',')} TND / caractère.</p>
          <p class="cz-error" data-error hidden>Ajoutez un texte ou un logo pour la broderie.</p>
        </div>
        <div class="cz-field">
          <span class="cz-field__label" id="czFontLabel">Police</span>
          <div class="cz-fonts" id="czFonts">
            <button type="button" data-font="serif" class="is-active" aria-pressed="true" style="font-family:${FONTS.serif}">Élégante</button>
            <button type="button" data-font="script" aria-pressed="false" style="font-family:${FONTS.script}">Calligraphie</button>
            <button type="button" data-font="modern" aria-pressed="false" style="font-family:${FONTS.modern}">Moderne</button>
          </div>
        </div>
        <div class="cz-field">
          <span class="cz-field__label">Couleur du fil</span>
          ${swatchGroup('robe.emb.thread', THREAD_COLORS, { small: true })}
        </div>
        <div class="cz-field">
          <span class="cz-field__label">Position</span>
          <div class="cz-positions" id="czPositions">
            <button type="button" data-pos="chest-right" class="is-active" aria-pressed="true">Poitrine droite</button>
            <button type="button" data-pos="chest-left" aria-pressed="false">Poitrine gauche</button>
            <button type="button" data-pos="back" aria-pressed="false">Dos</button>
          </div>
        </div>
        <div class="cz-field">
          <span class="cz-field__label">Logo ou image <span class="cz-plus">+${PRICE.embLogo} TND</span></span>
          <label class="cz-upload" for="czLogoInput">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/></svg>
            <span id="czUploadLabel">Téléverser un logo (PNG, JPG)</span>
          </label>
          <input type="file" id="czLogoInput" accept="image/*" class="visually-hidden">
          <button type="button" class="cz-upload__remove" id="czLogoRemove" hidden>Retirer le logo</button>
        </div>
      </div>
      ${nextBtn()}`,

    'cap-main':   () => swatchGroup('cap.main', MAIN_COLORS.map((c) => ({ ...c, premium: false }))) + nextBtn(),
    'cap-accent': () => '<p class="cz-help">Couleur du gland (tassel) et du bouton.</p>'
      + swatchGroup('cap.accent', ACCENT_COLORS) + nextBtn(),

    'hood-main': () => swatchGroup('hood.main', MAIN_COLORS.map((c) => ({ ...c, premium: false }))) + nextBtn(),
    'hood-trim': () => '<p class="cz-help">Le satin intérieur, aux couleurs de votre université.</p>'
      + swatchGroup('hood.trim', TRIM_COLORS) + nextBtn(),

    accessories: () => `
      <div class="cz-acc">${ACCESSORIES.map((a) => `
        <label>
          <input type="checkbox" data-acc="${a.id}">
          <span class="cz-acc__name">${a.label}</span>
          <span class="cz-acc__price">+${a.price} TND</span>
        </label>`).join('')}</div>
      ${nextBtn()}`,

    quantity: () => `
      <div class="cz-qty">
        <button type="button" id="czQtyMinus" aria-label="Diminuer la quantité">−</button>
        <span id="czQtyValue" aria-live="polite">1</span>
        <button type="button" id="czQtyPlus" aria-label="Augmenter la quantité">+</button>
      </div>
      <p class="cz-help">Remise groupe : −5 % dès 3 tenues, −10 % dès 6 — idéal pour votre promotion.</p>
      ${nextBtn()}`,

    client: () => `
      <div class="cz-form">
        <div class="cz-field">
          <label for="czName">Nom &amp; prénom *</label>
          <input type="text" id="czName" data-client="name" autocomplete="name" placeholder="Ex : Salhi Wafa">
          <p class="cz-error" data-err-for="name" hidden>Indiquez votre nom complet.</p>
        </div>
        <div class="cz-field">
          <label for="czWhatsapp">Numéro WhatsApp *</label>
          <input type="tel" id="czWhatsapp" data-client="whatsapp" autocomplete="tel" inputmode="tel" placeholder="Ex : 22 123 456">
          <p class="cz-error" data-err-for="whatsapp" hidden>Numéro tunisien attendu (8 chiffres, +216 optionnel).</p>
        </div>
        <div class="cz-field">
          <label for="czRegion">Région *</label>
          <select id="czRegion" data-client="region">
            <option value="">— Choisir un gouvernorat —</option>
            ${REGIONS.map((r) => `<option value="${r}">${r}</option>`).join('')}
          </select>
          <p class="cz-error" data-err-for="region" hidden>Choisissez votre région.</p>
        </div>
        <div class="cz-field">
          <label for="czDate">Date de votre soutenance *</label>
          <input type="date" id="czDate" data-client="date">
          <p class="cz-error" data-err-for="date" hidden>Indiquez une date à venir.</p>
        </div>
        <div class="cz-field">
          <label for="czNotes">Remarques (optionnel)</label>
          <textarea id="czNotes" data-client="notes" rows="3" placeholder="Université, couleurs de votre faculté, demandes particulières…"></textarea>
        </div>
      </div>
      ${nextBtn('Voir mon devis')}`,

    quote: () => `
      <div class="cz-quote" id="czQuoteBox"></div>
      <details class="cz-algo">
        <summary>Comment est calculé le prix ?</summary>
        <ul>
          <li>Robe ${PIECES.robe.base} TND · Mortier ${PIECES.cap.base} TND · Capuche ${PIECES.hood.base} TND</li>
          <li>Tissu premium : +${PRICE.premiumFabric} TND · Taille XL : +${PRICE.xlSurcharge} TND</li>
          <li>Sur mesure : +12 % de la robe · Stature ≥ 190 cm : +${PRICE.tallSurcharge} TND</li>
          <li>Broderie : ${PRICE.embBase} TND + ${String(PRICE.embPerChar).replace('.', ',')} TND / caractère · Logo : +${PRICE.embLogo} TND</li>
          <li>Pack Complet : −10 % sur l'ensemble des pièces</li>
          <li>Quantité : −5 % dès 3, −10 % dès 6</li>
          <li>Livraison ${PRICE.shipping} TND — offerte dès ${PRICE.freeShippingFrom} TND</li>
        </ul>
      </details>
      <p class="cz-help" style="margin-top:1rem">Prix approximatif — confirmé après prise de mesures.
        Cliquez sur « Obtenir ma facture » pour générer votre facture détaillée.</p>`,
  };

  function nextBtn(label) {
    return `<button class="btn btn--solid cz-next" type="button">${label || 'Continuer'}</button>`;
  }

  function buildSteps() {
    stepsRoot.innerHTML = STEP_DEFS.map((def) => `
      <section class="cz-step" data-step="${def.id}" ${def.phase ? `data-phase="${def.phase}"` : ''}>
        <button class="cz-step__head" type="button" aria-expanded="false" aria-controls="czBody-${def.id}">
          <span class="cz-step__num"></span>
          <span class="cz-step__title">${def.title}<small class="cz-step__value" data-value></small></span>
          <span class="cz-step__phase" data-phase-chip hidden></span>
          <svg class="cz-step__chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="cz-step__body" id="czBody-${def.id}" hidden>${BODIES[def.id]()}</div>
      </section>`).join('');

    /* date minimale : aujourd'hui */
    const today = new Date().toISOString().slice(0, 10);
    $('#czDate').min = today;
  }

  /* ----------------------------------------------------------
     Aperçu SVG — chaque pièce a ses propres couleurs
     ---------------------------------------------------------- */
  const EMB_ANCHORS = {
    front: { 'chest-right': { x: 243, y: 158 }, 'chest-left': { x: 157, y: 158 } },
    back: { back: { x: 200, y: 190 } },
  };

  function paint(groupSel, part, hex) {
    $$(groupSel + ' .cz-p-' + part).forEach((el) => {
      if (!el.classList.contains('cz-tassel')) el.style.fill = hex;
      el.style.color = hex;
    });
  }

  /* pièce mise en avant selon l'étape ouverte */
  function focusedPiece() {
    const open = currentOpenStep();
    const def = STEP_DEFS.find((d) => d.id === open);
    return def && def.piece ? def.piece : null;
  }

  function renderPreview() {
    const pieces = PRODUCTS[state.product].pieces;
    const focus = focusedPiece();
    const shown = focus && pieces.includes(focus) ? [focus] : pieces;

    const robeSleeve = state.robe.sleeve === 'match'
      ? colorOf(MAIN_COLORS, state.robe.main).hex
      : colorOf(MAIN_COLORS, state.robe.sleeve).hex;

    paint('#czGownFront', 'main', colorOf(MAIN_COLORS, state.robe.main).hex);
    paint('#czGownBack', 'main', colorOf(MAIN_COLORS, state.robe.main).hex);
    paint('#czGownFront', 'trim', colorOf(TRIM_COLORS, state.robe.trim).hex);
    paint('#czGownBack', 'trim', colorOf(TRIM_COLORS, state.robe.trim).hex);
    paint('#czGownFront', 'sleeve', robeSleeve);
    paint('#czGownBack', 'sleeve', robeSleeve);
    paint('#czGownFront', 'accent', colorOf(ACCENT_COLORS, state.robe.accent).hex);
    paint('#czGownBack', 'accent', colorOf(ACCENT_COLORS, state.robe.accent).hex);

    paint('#czCap', 'main', colorOf(MAIN_COLORS, state.cap.main).hex);
    paint('#czCap', 'accent', colorOf(ACCENT_COLORS, state.cap.accent).hex);

    paint('#czHoodFront', 'main', colorOf(MAIN_COLORS, state.hood.main).hex);
    paint('#czHoodBack', 'main', colorOf(MAIN_COLORS, state.hood.main).hex);
    paint('#czHoodFront', 'trim', colorOf(TRIM_COLORS, state.hood.trim).hex);
    paint('#czHoodBack', 'trim', colorOf(TRIM_COLORS, state.hood.trim).hex);

    const show = (id, on) => { $(id).style.display = on ? '' : 'none'; };
    show('#czGownFront', shown.includes('robe'));
    show('#czGownBack', shown.includes('robe'));
    show('#czHoodFront', shown.includes('hood'));
    show('#czHoodBack', shown.includes('hood'));
    show('#czCap', shown.includes('cap'));

    /* pièce seule : recentrer et agrandir */
    const hoodAlone = shown.length === 1 && shown[0] === 'hood';
    const capAlone = shown.length === 1 && shown[0] === 'cap';
    $('#czHoodFront').setAttribute('transform', hoodAlone ? 'translate(-70,90) scale(1.35)' : '');
    $('#czHoodBack').setAttribute('transform', hoodAlone ? 'translate(-70,90) scale(1.35)' : '');
    $('#czCap').setAttribute('transform', capAlone ? 'translate(-120,120) scale(1.6)' : '');

    /* libellé de focus */
    const focusLabels = { robe: 'Vous personnalisez : la Robe', cap: 'Vous personnalisez : le Mortier', hood: 'Vous personnalisez : la Capuche' };
    $('#czFocusLabel').textContent = shown.length === 1 && pieces.length > 1
      ? focusLabels[shown[0]]
      : (pieces.length > 1 ? 'Votre tenue complète' : '');

    /* broderie (robe uniquement) */
    const emb = state.robe.emb;
    const embOK = emb.enabled && shown.includes('robe');
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
        textEl.setAttribute('font-family', FONTS[emb.font]);
        textEl.style.fill = colorOf(THREAD_COLORS, emb.thread).hex;
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
      setTimeout(() => { apply(); stage.classList.remove('is-flipping'); }, 220);
    } else {
      apply();
    }
  }

  stage.addEventListener('mousemove', (e) => {
    if (window.matchMedia('(hover: none)').matches) return;
    const r = stage.getBoundingClientRect();
    stage.style.setProperty('--zx', ((e.clientX - r.left) / r.width) * 100 + '%');
    stage.style.setProperty('--zy', ((e.clientY - r.top) / r.height) * 100 + '%');
    stage.classList.add('is-zoomed');
  });
  stage.addEventListener('mouseleave', () => stage.classList.remove('is-zoomed'));

  /* ----------------------------------------------------------
     Étapes visibles / accordéon
     ---------------------------------------------------------- */
  function stepApplies(def) {
    if (!def.products) return true;
    return def.products.includes(state.product);
  }
  function visibleSteps() { return STEP_DEFS.filter(stepApplies).map((d) => d.id); }

  function stepEls() { return $$('.cz-step'); }

  function openStep(name, scroll) {
    stepEls().forEach((step) => {
      const isTarget = step.dataset.step === name;
      step.classList.toggle('is-open', isTarget);
      step.querySelector('.cz-step__head').setAttribute('aria-expanded', String(isTarget));
      step.querySelector('.cz-step__body').hidden = !isTarget;
    });
    const order = visibleSteps();
    const idx = order.indexOf(name);
    if (idx >= 0) $('#czStepCount').textContent = 'Étape ' + (idx + 1) + ' sur ' + order.length;
    renderPreview();
    if (name === 'quote') renderQuoteBox();
    if (scroll) {
      const step = stepEls().find((s) => s.dataset.step === name);
      step?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function currentOpenStep() {
    const open = stepEls().find((s) => s.classList.contains('is-open'));
    return open ? open.dataset.step : 'product';
  }

  function nextStep() {
    const order = visibleSteps();
    const idx = order.indexOf(currentOpenStep());
    openStep(order[Math.min(idx + 1, order.length - 1)], true);
  }

  /* ----------------------------------------------------------
     Résumés & validation
     ---------------------------------------------------------- */
  function embSummary() {
    const emb = state.robe.emb;
    if (!emb.enabled) return 'Sans broderie';
    return [emb.text && ('« ' + emb.text + ' »'), emb.logo && 'logo', POS_LABELS[emb.position]]
      .filter(Boolean).join(' · ');
  }

  function stepValue(id) {
    switch (id) {
      case 'product': return PRODUCTS[state.product].label;
      case 'measures': {
        const m = state.measures;
        if (!m.size) return '';
        const label = SIZES.find((s) => s.id === m.size).label;
        return m.size === 'custom' ? label + (m.height ? ' · ' + m.height + ' cm' : '') : label;
      }
      case 'robe-main': return colorOf(MAIN_COLORS, state.robe.main).label;
      case 'robe-trim': return colorOf(TRIM_COLORS, state.robe.trim).label;
      case 'robe-sleeve': return state.robe.sleeve === 'match' ? 'Assorties au tissu' : colorOf(MAIN_COLORS, state.robe.sleeve).label;
      case 'robe-accent': return colorOf(ACCENT_COLORS, state.robe.accent).label;
      case 'robe-emb': return embSummary();
      case 'cap-main': return colorOf(MAIN_COLORS, state.cap.main).label;
      case 'cap-accent': return colorOf(ACCENT_COLORS, state.cap.accent).label;
      case 'hood-main': return colorOf(MAIN_COLORS, state.hood.main).label;
      case 'hood-trim': return colorOf(TRIM_COLORS, state.hood.trim).label;
      case 'accessories': return state.accessories.length
        ? state.accessories.length + ' accessoire' + (state.accessories.length > 1 ? 's' : '') : 'Aucun';
      case 'quantity': return '× ' + state.quantity;
      case 'client': {
        const c = state.client;
        return [c.name, c.region].filter(Boolean).join(' · ');
      }
      case 'quote': return money(computeQuote().total);
      default: return '';
    }
  }

  function validWhatsapp(num) {
    return /^(\+?216)?\d{8}$/.test(num.replace(/[\s.-]/g, ''));
  }
  function validDate(d) {
    return Boolean(d) && d >= new Date().toISOString().slice(0, 10);
  }

  function stepDone(id) {
    const c = state.client;
    switch (id) {
      case 'measures':
        if (!state.measures.size) return false;
        if (state.measures.size === 'custom') {
          const h = Number(state.measures.height);
          return h >= 130 && h <= 215;
        }
        return true;
      case 'robe-emb': return !state.robe.emb.enabled || Boolean(state.robe.emb.text.trim() || state.robe.emb.logo);
      case 'client': return c.name.trim().length >= 3 && validWhatsapp(c.whatsapp) && Boolean(c.region) && validDate(c.date);
      case 'quote': return false;
      default: return true;
    }
  }

  function validation() {
    return visibleSteps().filter((id) => ['measures', 'robe-emb', 'client'].includes(id) && !stepDone(id));
  }

  /* ----------------------------------------------------------
     Rendu du panneau
     ---------------------------------------------------------- */
  function renderSteps() {
    const order = visibleSteps();
    const isPack = state.product === 'pack';
    stepsRoot.classList.toggle('is-pack', isPack);

    let lastPhase = null;
    stepEls().forEach((step) => {
      const id = step.dataset.step;
      const idx = order.indexOf(id);
      step.classList.toggle('is-hidden', idx === -1);
      if (idx === -1) return;

      step.querySelector('.cz-step__num').textContent = idx + 1;
      step.querySelector('[data-value]').textContent = stepValue(id) || '';
      step.classList.toggle('is-done', stepDone(id));

      /* chip de phase (Pack) : affichée sur la première étape de chaque pièce */
      const chip = step.querySelector('[data-phase-chip]');
      const phase = step.dataset.phase || '';
      const showChip = isPack && phase && phase !== lastPhase;
      chip.hidden = !showChip;
      if (showChip) chip.textContent = phase;
      if (phase) lastPhase = phase;
    });

    /* produit */
    $$('.cz-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.product === state.product);
    });

    /* tailles */
    const m = state.measures;
    $('#czSizes').innerHTML = SIZES.map((s) => `
      <button type="button" data-size="${s.id}" class="${m.size === s.id ? 'is-active' : ''}"
        aria-pressed="${m.size === s.id}">${s.label}<small>${s.note}</small></button>`).join('');
    $('#czMeasures').hidden = m.size !== 'custom';
    syncInput('#czHeight', m.height);
    syncInput('#czChest', m.chest);

    /* pastilles */
    $$('.cz-swatch').forEach((sw) => {
      const val = getPath(sw.dataset.path);
      const active = sw.dataset.color === val;
      sw.classList.toggle('is-active', active);
      sw.setAttribute('aria-pressed', String(active));
    });

    /* broderie */
    const emb = state.robe.emb;
    $('#czEmbNo').classList.toggle('is-active', !emb.enabled);
    $('#czEmbNo').setAttribute('aria-pressed', String(!emb.enabled));
    $('#czEmbYes').classList.toggle('is-active', emb.enabled);
    $('#czEmbYes').setAttribute('aria-pressed', String(emb.enabled));
    $('#czEmbOptions').hidden = !emb.enabled;
    syncInput('#czEmbText', emb.text);
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

    /* accessoires / quantité / client */
    $$('.cz-acc input').forEach((input) => {
      input.checked = state.accessories.includes(input.dataset.acc);
    });
    $('#czQtyValue').textContent = state.quantity;
    ['name', 'whatsapp', 'region', 'date', 'notes'].forEach((k) => {
      syncInput('[data-client="' + k + '"]', state.client[k]);
    });

    /* progression */
    const progressSteps = order.filter((s) => s !== 'quote');
    const done = progressSteps.filter(stepDone).length;
    $('#czProgressBar').style.width = Math.max(6, Math.round((done / progressSteps.length) * 100)) + '%';

    undoBtn.disabled = history.length === 0;
    orderBtn.setAttribute('aria-disabled', String(validation().length > 0));
  }

  function syncInput(sel, value) {
    const el = $(sel);
    if (el && el !== document.activeElement && el.value !== String(value ?? '')) el.value = value ?? '';
  }

  function getPath(path) {
    return path.split('.').reduce((obj, k) => (obj ? obj[k] : undefined), state);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = value;
  }

  /* ----------------------------------------------------------
     ALGORITHME DE PRIX (prototype)
     Retourne les lignes détaillées + remises + total.
     ---------------------------------------------------------- */
  function computeQuote() {
    const lines = [];
    const pieces = PRODUCTS[state.product].pieces;
    const m = state.measures;

    if (pieces.includes('robe')) {
      let robe = PIECES.robe.base;
      lines.push({ label: 'Robe de soutenance — ' + colorOf(MAIN_COLORS, state.robe.main).label, amount: PIECES.robe.base });

      const fabric = colorOf(MAIN_COLORS, state.robe.main);
      if (fabric.premium) {
        lines.push({ label: 'Tissu premium (' + fabric.label + ')', amount: PRICE.premiumFabric });
        robe += PRICE.premiumFabric;
      }
      if (m.size === 'XL') {
        lines.push({ label: 'Supplément taille XL', amount: PRICE.xlSurcharge });
        robe += PRICE.xlSurcharge;
      }
      if (m.size === 'custom') {
        const custom = Math.round(robe * PRICE.customRate);
        lines.push({ label: 'Confection sur mesure (+12 %)', amount: custom });
        robe += custom;
      }
      if (Number(m.height) >= 190) {
        lines.push({ label: 'Tissu supplémentaire (stature ≥ 190 cm)', amount: PRICE.tallSurcharge });
        robe += PRICE.tallSurcharge;
      }

      const emb = state.robe.emb;
      if (emb.enabled) {
        const chars = emb.text.trim().length;
        if (chars > 0) {
          const price = Math.round(PRICE.embBase + PRICE.embPerChar * chars);
          lines.push({ label: 'Broderie « ' + emb.text.trim() + ' » (' + chars + ' caractères)', amount: price });
        }
        if (emb.logo) lines.push({ label: 'Broderie logo', amount: PRICE.embLogo });
      }
    }

    if (pieces.includes('cap')) {
      lines.push({ label: 'Mortier — ' + colorOf(MAIN_COLORS, state.cap.main).label
        + ', gland ' + colorOf(ACCENT_COLORS, state.cap.accent).label, amount: PIECES.cap.base });
    }
    if (pieces.includes('hood')) {
      lines.push({ label: 'Capuche — ' + colorOf(MAIN_COLORS, state.hood.main).label
        + ', satin ' + colorOf(TRIM_COLORS, state.hood.trim).label, amount: PIECES.hood.base });
    }

    const piecesSum = lines.reduce((s, l) => s + l.amount, 0);

    /* remise pack sur les pièces (avant accessoires) */
    const packDiscount = state.product === 'pack' ? Math.round(piecesSum * PRICE.packRate) : 0;

    state.accessories.forEach((id) => {
      const acc = ACCESSORIES.find((a) => a.id === id);
      if (acc) lines.push({ label: 'Accessoire — ' + acc.label, amount: acc.price });
    });

    const unit = lines.reduce((s, l) => s + l.amount, 0) - packDiscount;
    const qty = state.quantity;
    const subtotal = unit * qty;

    const qtyRate = qty >= 6 ? PRICE.qty6Rate : qty >= 3 ? PRICE.qty3Rate : 0;
    const qtyDiscount = Math.round(subtotal * qtyRate);
    const afterQty = subtotal - qtyDiscount;

    const shipping = afterQty >= PRICE.freeShippingFrom ? 0 : PRICE.shipping;
    const total = afterQty + shipping;

    return { lines, packDiscount, unit, qty, subtotal, qtyRate, qtyDiscount, shipping, total };
  }

  /* ----------------------------------------------------------
     Prix animé (barre du bas)
     ---------------------------------------------------------- */
  let shownTotal = 0;
  let priceAnim = null;
  function renderPrice() {
    const target = computeQuote().total;
    if (priceAnim) cancelAnimationFrame(priceAnim);
    const from = shownTotal;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / 350, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      shownTotal = Math.round(from + (target - from) * eased);
      $('#czTotal').textContent = shownTotal + ' TND';
      if (p < 1) priceAnim = requestAnimationFrame(tick);
    }
    priceAnim = requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     Devis (étape) & facture (modal)
     ---------------------------------------------------------- */
  function quoteRowsHTML(q) {
    let html = q.lines.map((l) =>
      `<tr><td>${l.label}</td><td>${money(l.amount)}</td></tr>`).join('');
    return html;
  }

  function quoteTotalsHTML(q, forInvoice) {
    const rows = [];
    if (q.packDiscount) rows.push(['Remise Pack Complet (−10 %)', '−' + money(q.packDiscount)]);
    rows.push(['Prix unitaire', money(q.unit)]);
    if (q.qty > 1) rows.push(['Quantité × ' + q.qty, money(q.subtotal)]);
    if (q.qtyDiscount) rows.push(['Remise groupe (−' + Math.round(q.qtyRate * 100) + ' %)', '−' + money(q.qtyDiscount)]);
    rows.push(['Livraison', q.shipping === 0 ? 'Offerte' : money(q.shipping)]);
    rows.push(['TOTAL' + (forInvoice ? ' TTC' : ''), money(q.total)]);
    return rows.map(([k, v], i) =>
      `<tr class="${i === rows.length - 1 ? 'cz-total-row' : ''}"><td>${k}</td><td>${v}</td></tr>`).join('');
  }

  function renderQuoteBox() {
    const box = $('#czQuoteBox');
    if (!box) return;
    const q = computeQuote();
    box.innerHTML = `<table class="cz-invoice__table">
      <tbody>${quoteRowsHTML(q)}</tbody>
      <tfoot>${quoteTotalsHTML(q, false)}</tfoot>
    </table>`;
  }

  function estimates() {
    const emb = state.robe.emb.enabled && PRODUCTS[state.product].pieces.includes('robe');
    return {
      prod: emb ? '7–10 jours ouvrés' : '5–7 jours ouvrés',
      ship: '2–4 jours (toute la Tunisie)',
    };
  }

  function invoiceNumber() {
    const d = new Date();
    const ymd = d.getFullYear().toString().slice(2)
      + String(d.getMonth() + 1).padStart(2, '0')
      + String(d.getDate()).padStart(2, '0');
    return 'ENM-' + ymd + '-' + String(Math.floor(100 + Math.random() * 900));
  }

  function invoiceText(q, num) {
    const c = state.client;
    const est = estimates();
    return 'FACTURE ENMIIS n° ' + num
      + '\nDate : ' + new Date().toLocaleDateString('fr-FR')
      + '\n\nClient : ' + c.name
      + '\nWhatsApp : ' + c.whatsapp
      + '\nRégion : ' + c.region
      + '\nSoutenance : ' + (c.date ? new Date(c.date + 'T00:00').toLocaleDateString('fr-FR') : '—')
      + (c.notes.trim() ? '\nRemarques : ' + c.notes.trim() : '')
      + '\n\n' + q.lines.map((l) => '· ' + l.label + ' — ' + money(l.amount)).join('\n')
      + (q.packDiscount ? '\n· Remise Pack Complet (−10 %) — −' + money(q.packDiscount) : '')
      + '\nPrix unitaire : ' + money(q.unit)
      + (q.qty > 1 ? '\nQuantité × ' + q.qty + ' : ' + money(q.subtotal) : '')
      + (q.qtyDiscount ? '\nRemise groupe : −' + money(q.qtyDiscount) : '')
      + '\nLivraison : ' + (q.shipping === 0 ? 'offerte' : money(q.shipping))
      + '\nTOTAL : ' + money(q.total)
      + '\n\nConfection : ' + est.prod + '\nLivraison : ' + est.ship
      + '\n(Devis approximatif — confirmé après prise de mesures. Valable 15 jours.)';
  }

  const modal = $('#czModal');
  let currentInvoiceText = '';

  function openInvoice() {
    const q = computeQuote();
    const c = state.client;
    const num = invoiceNumber();
    const est = estimates();

    $('#czInvNum').textContent = num;
    $('#czInvDate').textContent = new Date().toLocaleDateString('fr-FR');
    $('#czInvClient').innerHTML = `
      <p><span>Client</span><strong>${escapeHTML(c.name)}</strong></p>
      <p><span>WhatsApp</span><strong>${escapeHTML(c.whatsapp)}</strong></p>
      <p><span>Région</span><strong>${escapeHTML(c.region)}</strong></p>
      <p><span>Soutenance</span><strong>${c.date ? new Date(c.date + 'T00:00').toLocaleDateString('fr-FR') : '—'}</strong></p>
      ${c.notes.trim() ? `<p><span>Remarques</span><strong>${escapeHTML(c.notes.trim())}</strong></p>` : ''}
      <p><span>Confection</span><strong>${est.prod}</strong></p>`;
    $('#czInvLines').innerHTML = quoteRowsHTML(q);
    $('#czInvTotals').innerHTML = quoteTotalsHTML(q, true);

    currentInvoiceText = invoiceText(q, num);

    const wa = $('#czInvWhatsapp');
    if (BUSINESS_WHATSAPP) {
      wa.hidden = false;
      wa.href = 'https://wa.me/' + BUSINESS_WHATSAPP + '?text=' + encodeURIComponent(currentInvoiceText);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    modal.querySelector('.cz-modal__close').focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /* ----------------------------------------------------------
     Rendu global
     ---------------------------------------------------------- */
  function renderAll() {
    renderPreview();
    renderSteps();
    renderPrice();
    if (currentOpenStep() === 'quote') renderQuoteBox();
  }

  /* ----------------------------------------------------------
     Événements (délégation sur le panneau)
     ---------------------------------------------------------- */
  stepsRoot.addEventListener('click', (e) => {
    const head = e.target.closest('.cz-step__head');
    if (head) {
      const step = head.closest('.cz-step');
      openStep(step.classList.contains('is-open') ? '' : step.dataset.step);
      return;
    }
    if (e.target.closest('.cz-next')) { nextStep(); return; }

    const card = e.target.closest('.cz-card');
    if (card) { commit((s) => { s.product = card.dataset.product; }); return; }

    const size = e.target.closest('[data-size]');
    if (size) {
      commit((s) => { s.measures.size = size.dataset.size; });
      hideError('measures');
      return;
    }

    const sw = e.target.closest('.cz-swatch');
    if (sw) {
      commit((s) => { setPath(s, sw.dataset.path, sw.dataset.color); });
      return;
    }

    if (e.target.closest('#czEmbNo')) { commit((s) => { s.robe.emb.enabled = false; }); return; }
    if (e.target.closest('#czEmbYes')) { commit((s) => { s.robe.emb.enabled = true; }); return; }

    const font = e.target.closest('[data-font]');
    if (font) { commit((s) => { s.robe.emb.font = font.dataset.font; }); return; }

    const pos = e.target.closest('[data-pos]');
    if (pos) {
      commit((s) => { s.robe.emb.position = pos.dataset.pos; });
      setView(pos.dataset.pos === 'back' ? 'back' : 'front', true);
      return;
    }

    if (e.target.closest('#czLogoRemove')) {
      commit((s) => { s.robe.emb.logo = null; s.robe.emb.logoName = ''; });
      return;
    }

    if (e.target.closest('#czQtyMinus')) { commit((s) => { s.quantity = Math.max(1, s.quantity - 1); }); return; }
    if (e.target.closest('#czQtyPlus')) { commit((s) => { s.quantity = Math.min(20, s.quantity + 1); }); return; }
  });

  stepsRoot.addEventListener('input', (e) => {
    const t = e.target;
    /* select et date sont gérés par l'événement "change" */
    if (t.tagName === 'SELECT' || t.type === 'date') return;
    if (t.id === 'czEmbText') {
      burst((s) => { s.robe.emb.text = t.value; });
      return;
    }
    if (t.id === 'czHeight') { burst((s) => { s.measures.height = t.value; }); return; }
    if (t.id === 'czChest') { burst((s) => { s.measures.chest = t.value; }); return; }
    const clientKey = t.dataset.client;
    if (clientKey) {
      burst((s) => { s.client[clientKey] = t.value; });
      hideFieldError(clientKey);
    }
  });

  stepsRoot.addEventListener('change', (e) => {
    const acc = e.target.closest('input[data-acc]');
    if (acc) {
      commit((s) => {
        const id = acc.dataset.acc;
        s.accessories = acc.checked ? s.accessories.concat(id) : s.accessories.filter((a) => a !== id);
      });
      return;
    }
    if (e.target.dataset.client === 'region' || e.target.dataset.client === 'date') {
      commit((s) => { s.client[e.target.dataset.client] = e.target.value; });
      hideFieldError(e.target.dataset.client);
    }
    if (e.target.id === 'czLogoInput') {
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
          s.robe.emb.logo = reader.result;
          s.robe.emb.logoName = file.name;
        });
        hideError('robe-emb');
        toast('Logo ajouté à votre broderie.');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  });

  /* vues avant / arrière */
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
    try { localStorage.removeItem('enmiis-customizer-v2'); } catch (e) { /* ignore */ }
    renderAll();
    openStep('product', true);
    setView('front');
    toast('Configuration réinitialisée.');
  });

  /* erreurs */
  function showError(name) {
    const step = stepEls().find((s) => s.dataset.step === name);
    if (!step) return;
    step.classList.add('is-invalid');
    step.querySelectorAll('[data-error]').forEach((el) => { el.hidden = false; });
    if (name === 'client') {
      const c = state.client;
      toggleFieldError('name', c.name.trim().length < 3);
      toggleFieldError('whatsapp', !validWhatsapp(c.whatsapp));
      toggleFieldError('region', !c.region);
      toggleFieldError('date', !validDate(c.date));
    }
  }
  function hideError(name) {
    const step = stepEls().find((s) => s.dataset.step === name);
    if (!step) return;
    step.classList.remove('is-invalid');
    step.querySelectorAll('[data-error]').forEach((el) => { el.hidden = true; });
  }
  function toggleFieldError(key, show) {
    const el = $('[data-err-for="' + key + '"]');
    if (el) el.hidden = !show;
  }
  function hideFieldError(key) { toggleFieldError(key, false); }

  /* facture */
  orderBtn.addEventListener('click', () => {
    const problems = validation();
    if (problems.length) {
      problems.forEach(showError);
      openStep(problems[0], true);
      toast('Quelques informations manquent avant la facture.');
      return;
    }
    ['measures', 'robe-emb', 'client'].forEach(hideError);
    openInvoice();
  });

  $$('[data-cz-modal-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  $('#czInvPrint').addEventListener('click', () => window.print());

  $('#czInvCopy').addEventListener('click', () => {
    const done = () => toast('Facture copiée — collez-la dans votre message.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentInvoiceText).then(done, () => fallbackCopy(currentInvoiceText, done));
    } else {
      fallbackCopy(currentInvoiceText, done);
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
  buildSteps();
  renderAll();
  setView('front');
  openStep('product');
})();
