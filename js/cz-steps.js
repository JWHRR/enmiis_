/* ============================================================
   ENMIIS — Configurateur : écrans de l’assistant.
   Un module par étape : gabarit (html) + branchements (bind).
   Expose window.CZ.steps
   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ || (global.CZ = {});
  const cat = CZ.catalog;
  const store = CZ.store;

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const kb = (bytes) => (bytes < 1024 * 1024
    ? Math.max(1, Math.round(bytes / 1024)) + ' Ko'
    : (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo');

  /* ----------------------------------------------------------
     Briques d’interface
     ---------------------------------------------------------- */

  function swatches(path, colors, options) {
    const opts = options || {};
    const current = store.at(path);
    const extra = opts.matchLabel
      ? '<button type="button" class="cz-swatch cz-swatch--match" data-set="' + path + '" data-value="match"' +
        ' aria-pressed="' + (current === 'match') + '" aria-label="' + esc(opts.matchLabel) + '">' +
        '<span class="cz-swatch__tip">' + esc(opts.matchLabel) + '</span></button>'
      : '';
    return '<div class="cz-swatches' + (opts.small ? ' cz-swatches--small' : '') + '">' + extra +
      colors.map((color) =>
        '<button type="button" class="cz-swatch" data-set="' + path + '" data-value="' + color.id + '"' +
        ' style="--sw:' + color.hex + '" aria-pressed="' + (current === color.id) + '"' +
        ' aria-label="' + esc(color.label) + '">' +
        '<span class="cz-swatch__tip">' + esc(color.label) + '</span></button>').join('') +
      '</div>';
  }

  function optionCards(path, items, thumb) {
    const current = store.at(path);
    return '<div class="cz-options">' + items.map((item) =>
      '<button type="button" class="cz-option' + (current === item.id ? ' is-active' : '') + '"' +
      ' data-set="' + path + '" data-value="' + item.id + '" aria-pressed="' + (current === item.id) + '">' +
      (thumb ? '<span class="cz-option__thumb">' + thumb(item.id) + '</span>' : '') +
      '<span class="cz-option__name">' + esc(item.label) + '</span>' +
      (item.note ? '<span class="cz-option__note">' + esc(item.note) + '</span>' : '') +
      (item.ref ? '<span class="cz-option__ref">' + esc(item.ref) + '</span>' : '') +
      '<span class="cz-option__check"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg></span>' +
      '</button>').join('') + '</div>';
  }

  function field(label, inner, help) {
    return '<div class="cz-field"><span class="cz-field__label">' + esc(label) + '</span>' + inner +
      (help ? '<p class="cz-help">' + esc(help) + '</p>' : '') + '</div>';
  }

  function textInput(path, attrs) {
    const a = attrs || {};
    return '<input class="cz-input" type="' + (a.type || 'text') + '" data-type="' + path + '"' +
      ' value="' + esc(store.at(path)) + '"' +
      (a.maxlength ? ' maxlength="' + a.maxlength + '"' : '') +
      (a.placeholder ? ' placeholder="' + esc(a.placeholder) + '"' : '') +
      (a.inputmode ? ' inputmode="' + a.inputmode + '"' : '') +
      (a.autocomplete ? ' autocomplete="' + a.autocomplete + '"' : '') +
      ' spellcheck="false">';
  }

  function uploadSlot(pathData, pathName, label, hintText) {
    const value = store.at(pathData);
    const name = store.at(pathName);
    return '<div class="cz-logo' + (value ? ' is-filled' : '') + '" data-logo="' + pathData + '">' +
      (value
        ? '<img class="cz-logo__img" src="' + esc(value) + '" alt="' + esc(name) + '">'
        : '<svg class="cz-logo__icon" viewBox="0 0 24 24"><path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/></svg>') +
      '<span class="cz-logo__text">' + esc(value ? name : label) + '</span>' +
      '<span class="cz-logo__hint">' + esc(hintText) + '</span>' +
      '<input type="file" accept="image/png,image/jpeg,image/svg+xml" class="visually-hidden"' +
      ' data-logo-input="' + pathData + '" data-logo-name="' + pathName + '">' +
      (value ? '<button type="button" class="cz-logo__clear" data-logo-clear="' + pathData + '"' +
        ' aria-label="Retirer">×</button>' : '') +
      '</div>';
  }

  /* ---------- Vignettes de style ---------- */

  const HOOD_THUMBS = {
    'etole-droite': '<path d="M14 6 C 20 12 28 12 34 6 L 36 12 L 30 40 L 22 40 L 22 14 L 26 14 L 26 40 L 18 40 L 12 12 Z"/>',
    'etole-v': '<path d="M14 6 C 20 12 28 12 34 6 L 36 12 L 31 36 L 26 42 L 22 36 L 22 14 L 26 14"/><path d="M12 12 L 17 36 L 22 42"/>',
    'etole-arrondie': '<path d="M14 6 C 20 12 28 12 34 6 L 36 12 L 31 34 C 31 41 22 41 22 34 L 22 14"/><path d="M12 12 L 17 34 C 17 41 26 41 26 34"/>',
    'capuche-am': '<path d="M12 6 C 19 14 29 14 36 6 C 39 16 39 26 36 32 L 24 44 L 12 32 C 9 26 9 16 12 6 Z"/><path d="M17 12 C 21 17 27 17 31 12"/>',
    'capuche-eu': '<path d="M11 6 C 19 15 29 15 37 6 C 41 18 41 30 37 38 C 32 44 16 44 11 38 C 7 30 7 18 11 6 Z"/><path d="M16 13 C 21 19 27 19 32 13"/>',
  };

  const CAP_THUMBS = {
    classique: '<path d="M24 8 L 42 16 L 24 24 L 6 16 Z"/><path d="M14 20 C 14 28 34 28 34 20"/><circle cx="24" cy="16" r="2"/><path d="M24 16 C 34 18 38 24 38 32"/><path d="M36 32 L 40 32 L 39 40 L 37 40 Z"/>',
    incline: '<path d="M20 6 L 43 17 L 27 25 L 5 14 Z"/><path d="M15 21 C 16 29 36 28 35 20"/><circle cx="26" cy="17" r="2"/><path d="M26 17 C 22 22 20 28 20 34"/><path d="M18 34 L 22 34 L 21 41 L 19 41 Z"/>',
    plat: '<path d="M24 11 L 40 16 L 24 21 L 8 16 Z"/><path d="M15 19 C 15 25 33 25 33 19"/><circle cx="24" cy="16" r="2"/><path d="M24 16 L 24 30"/><path d="M22 30 L 26 30 L 25 40 L 23 40 Z"/>',
  };

  const TASSEL_THUMBS = {
    noeud: '<path d="M24 4 L 24 12"/><ellipse cx="24" cy="16" rx="5" ry="4"/><circle cx="24" cy="22" r="4"/><path d="M18 25 L 30 25 L 32 44 L 16 44 Z"/><path d="M21 26 L 20 43 M24 26 L 24 43 M27 26 L 28 43"/>',
    cannele: '<path d="M24 4 L 24 12"/><path d="M19 12 L 29 12 L 30 24 L 18 24 Z"/><path d="M18 16 L 30 16 M18 20 L 30 20"/><path d="M18 25 L 30 25 L 32 44 L 16 44 Z"/><path d="M21 26 L 20 43 M24 26 L 24 43 M27 26 L 28 43"/>',
    lisse: '<path d="M24 4 L 24 12"/><path d="M20 13 C 22 10 26 10 28 13 L 29 24 L 19 24 Z"/><path d="M19 25 L 29 25 L 31 44 L 17 44 Z"/><path d="M22 26 L 21 43 M24 26 L 24 43 M26 26 L 27 43"/>',
    fin: '<path d="M24 4 L 24 14"/><path d="M21 15 C 22 12 26 12 27 15 L 28 23 L 20 23 Z"/><path d="M21 24 L 27 24 L 28 42 L 20 42 Z"/><path d="M23 25 L 22 41 M25 25 L 26 41"/>',
  };

  const thumbWrap = (paths) => '<svg viewBox="0 0 48 48" aria-hidden="true">' + paths + '</svg>';

  /* ----------------------------------------------------------
     Illustrations des guides de mesure
     ---------------------------------------------------------- */
  const FIGURES = {
    height: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 42 C 92 42 88 48 88 56 C 88 64 92 70 100 70 C 108 70 112 64 112 56 C 112 48 108 42 100 42 Z"/><path class="fig-body" d="M86 72 L 114 72 L 120 118 L 114 118 L 112 170 L 88 170 L 86 118 L 80 118 Z"/><line class="fig-wall" x1="150" y1="24" x2="150" y2="184"/><line class="fig-mark" x1="60" y1="38" x2="160" y2="38"/><line class="fig-mark" x1="60" y1="180" x2="160" y2="180"/><line class="fig-arrow" x1="140" y1="38" x2="140" y2="180"/><text class="fig-num" x="132" y="112" text-anchor="end">1</text></svg>',
    weight: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 36 C 92 36 88 42 88 50 C 88 58 92 64 100 64 C 108 64 112 58 112 50 C 112 42 108 36 100 36 Z"/><path class="fig-body" d="M86 66 L 114 66 L 120 112 L 112 112 L 110 148 L 90 148 L 88 112 L 80 112 Z"/><rect class="fig-mark" x="62" y="150" width="76" height="24" rx="4"/><path class="fig-arrow" d="M84 162 A 16 16 0 0 1 116 162"/><line class="fig-arrow" x1="100" y1="162" x2="110" y2="155"/></svg>',
    head: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 30 C 72 30 56 52 56 82 C 56 112 72 136 100 140 C 128 136 144 112 144 82 C 144 52 128 30 100 30 Z"/><ellipse class="fig-tape" cx="100" cy="66" rx="46" ry="11"/><ellipse class="fig-mark" cx="100" cy="84" rx="47" ry="11"/><ellipse class="fig-mark" cx="100" cy="102" rx="45" ry="11"/><circle class="fig-dot" cx="152" cy="66" r="9"/><text class="fig-num" x="152" y="70" text-anchor="middle">1</text><circle class="fig-dot" cx="154" cy="84" r="9"/><text class="fig-num" x="154" y="88" text-anchor="middle">2</text><circle class="fig-dot" cx="152" cy="102" r="9"/><text class="fig-num" x="152" y="106" text-anchor="middle">3</text><path class="fig-body" d="M56 78 C 48 78 46 92 54 94"/><path class="fig-body" d="M144 78 C 152 78 154 92 146 94"/></svg>',
    chest: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 128 84 L 124 130 L 76 130 L 72 84 Z"/><path class="fig-body" d="M84 58 L 60 78 L 56 130"/><path class="fig-body" d="M116 58 L 140 78 L 144 130"/><ellipse class="fig-tape" cx="100" cy="86" rx="32" ry="9"/><text class="fig-num" x="100" y="164" text-anchor="middle">6</text><line class="fig-arrow" x1="68" y1="152" x2="132" y2="152"/></svg>',
    waist: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 126 86 L 116 112 L 122 150 L 78 150 L 84 112 L 74 86 Z"/><ellipse class="fig-tape" cx="100" cy="112" rx="22" ry="8"/><line class="fig-arrow" x1="132" y1="112" x2="164" y2="112"/></svg>',
    hip: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 124 88 L 114 108 L 126 140 L 74 140 L 86 108 L 76 88 Z"/><path class="fig-body" d="M78 142 L 94 142 L 92 178 L 80 178 Z"/><path class="fig-body" d="M106 142 L 122 142 L 120 178 L 108 178 Z"/><ellipse class="fig-tape" cx="100" cy="134" rx="30" ry="9"/><text class="fig-num" x="100" y="192" text-anchor="middle">3</text></svg>',
    shoulder: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 30 C 90 30 84 38 84 48 C 84 58 90 66 100 66 C 110 66 116 58 116 48 C 116 38 110 30 100 30 Z"/><path class="fig-body" d="M62 88 C 74 74 88 70 100 70 C 112 70 126 74 138 88 L 132 150 L 68 150 Z"/><line class="fig-tape" x1="62" y1="86" x2="138" y2="86"/><circle class="fig-dot" cx="62" cy="86" r="6"/><circle class="fig-dot" cx="138" cy="86" r="6"/><line class="fig-arrow" x1="62" y1="172" x2="138" y2="172"/><text class="fig-num" x="100" y="188" text-anchor="middle">2</text></svg>',
    sleeve: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M96 24 C 86 24 80 32 80 42 C 80 52 86 60 96 60 C 106 60 112 52 112 42 C 112 32 106 24 96 24 Z"/><path class="fig-body" d="M76 66 L 116 66 L 124 106 L 118 158 L 74 158 L 70 106 Z"/><path class="fig-body" d="M116 66 L 146 92 L 154 134 L 142 148"/><path class="fig-tape" d="M120 70 C 142 94 150 118 146 142"/><circle class="fig-dot" cx="120" cy="70" r="6"/><circle class="fig-dot" cx="146" cy="142" r="6"/><text class="fig-num" x="168" y="110" text-anchor="middle">5</text></svg>',
    gown: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 24 C 92 24 88 30 88 38 C 88 46 92 52 100 52 C 108 52 112 46 112 38 C 112 30 108 24 100 24 Z"/><path class="fig-body" d="M84 56 C 100 48 100 48 116 56 C 122 96 128 148 134 178 L 66 178 C 72 148 78 96 84 56 Z"/><line class="fig-tape" x1="152" y1="56" x2="152" y2="178"/><line class="fig-mark" x1="140" y1="56" x2="162" y2="56"/><line class="fig-mark" x1="140" y1="178" x2="162" y2="178"/><text class="fig-num" x="172" y="122" text-anchor="middle">1</text><line class="fig-arrow" x1="66" y1="190" x2="134" y2="190"/></svg>',
  };

  /* ----------------------------------------------------------
     Étape 1 — Fichiers
     ---------------------------------------------------------- */
  const upload = {
    html() {
      const accept = cat.FILE_TYPES.map((t) => '.' + t.ext).join(',');
      const badges = ['PDF', 'PNG', 'JPG', 'SVG', 'AI', 'EPS', 'CDR']
        .map((label) => '<span class="cz-badge">' + label + '</span>').join('');
      return '<div class="cz-screen__intro"><p>Ces fichiers partent directement à l’atelier : logos d’université, ' +
        'planches de broderie, gabarits vectoriels ou visuels de référence.</p></div>' +
        '<div class="cz-drop" id="czDrop" tabindex="0" role="button"' +
        ' aria-label="Déposer ou choisir des fichiers de production">' +
          '<div class="cz-drop__ring"></div>' +
          '<svg class="cz-drop__icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/></svg>' +
          '<p class="cz-drop__title">Déposez vos fichiers ici</p>' +
          '<p class="cz-drop__sub">ou cliquez pour parcourir · ' + cat.MAX_FILE_MB + ' Mo maximum par fichier</p>' +
          '<div class="cz-drop__badges">' + badges + '</div>' +
          '<input type="file" id="czFileInput" class="visually-hidden" multiple accept="' + accept + '">' +
        '</div>' +
        '<ul class="cz-files" id="czFiles"></ul>' +
        '<p class="cz-error" id="czFileError" hidden></p>';
    },

    /* Vignette d’un fichier : aperçu réel si le navigateur sait l’afficher. */
    item(file) {
      const preview = file.previewable
        ? '<img src="' + esc(file.dataUrl) + '" alt="">'
        : '<span class="cz-file__ext">' + esc(file.label) + '</span>';
      return '<li class="cz-file" data-file="' + file.id + '">' +
        '<span class="cz-file__thumb">' + preview + '</span>' +
        '<span class="cz-file__meta">' +
          '<strong class="cz-file__name">' + esc(file.name) + '</strong>' +
          '<span class="cz-file__size">' + esc(file.label) + ' · ' + kb(file.size) + '</span>' +
        '</span>' +
        '<span class="cz-file__actions">' +
          (file.previewable
            ? '<button type="button" class="cz-file__btn" data-file-view="' + file.id + '">Aperçu</button>'
            : '') +
          '<button type="button" class="cz-file__btn" data-file-replace="' + file.id + '">Remplacer</button>' +
          '<button type="button" class="cz-file__btn cz-file__btn--danger" data-file-remove="' + file.id + '">Retirer</button>' +
        '</span>' +
        '<span class="cz-file__check"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg></span>' +
      '</li>';
    },
  };

  /* ----------------------------------------------------------
     Étape 2 — Robe
     ---------------------------------------------------------- */
  const robe = {
    html() {
      const emb = store.at('robe.emb');
      return '<div class="cz-group">' +
        field('Tissu', optionCards('robe.fabric', cat.FABRICS)) +
        field('Couleur principale', swatches('robe.main', cat.MAIN_COLORS)) +
        field('Couleur secondaire', swatches('robe.secondary', cat.TRIM_COLORS),
          'Chevrons de manches, poignets et liserés.') +
        field('Couleur des manches', swatches('robe.sleeveColor', cat.MAIN_COLORS,
          { matchLabel: 'Assorties au tissu' })) +
        field('Coupe des manches', optionCards('robe.sleeve', cat.SLEEVES)) +
        field('Col', optionCards('robe.collar', cat.COLLARS)) +
        field('Bordure (contour)', optionCards('robe.trim', cat.TRIM_STYLES)) +
        field('Couleur de bordure', swatches('robe.trimColor', cat.TRIM_COLORS)) +
      '</div>' +
      '<div class="cz-group">' +
        '<div class="cz-switch">' +
          '<span class="cz-switch__text"><strong>Broderie personnalisée</strong>' +
          '<small>Texte, logo d’université et logo de faculté.</small></span>' +
          '<button type="button" class="cz-toggle' + (emb.enabled ? ' is-on' : '') + '"' +
          ' data-toggle="robe.emb.enabled" role="switch" aria-checked="' + emb.enabled + '">' +
          '<span class="cz-toggle__dot"></span></button>' +
        '</div>' +
        '<div class="cz-collapse' + (emb.enabled ? ' is-open' : '') + '" id="czEmbPanel">' +
          field('Texte à broder',
            textInput('robe.emb.text', { maxlength: 28, placeholder: 'Ex : Dr Salhi Wafa' })) +
          field('Police', '<div class="cz-fonts">' + Object.keys(cat.FONTS).map((id) =>
            '<button type="button" class="cz-font' + (emb.font === id ? ' is-active' : '') + '"' +
            ' data-set="robe.emb.font" data-value="' + id + '" aria-pressed="' + (emb.font === id) + '"' +
            ' style="font-family:' + cat.FONTS[id].stack + '">' + esc(cat.FONTS[id].label) + '</button>').join('') +
            '</div>') +
          field('Couleur du fil', swatches('robe.emb.thread', cat.THREAD_COLORS, { small: true })) +
          field('Emplacement', '<div class="cz-pills">' + cat.EMB_POSITIONS.map((p) =>
            '<button type="button" class="cz-pill' + (emb.position === p.id ? ' is-active' : '') + '"' +
            ' data-set="robe.emb.position" data-value="' + p.id + '"' +
            ' aria-pressed="' + (emb.position === p.id) + '">' + esc(p.label) + '</button>').join('') +
            '</div>') +
          '<div class="cz-logos">' +
            uploadSlot('robe.emb.uniLogo', 'robe.emb.uniLogoName', 'Logo d’université', 'PNG · JPG · SVG') +
            uploadSlot('robe.emb.facLogo', 'robe.emb.facLogoName', 'Logo de faculté', 'PNG · JPG · SVG') +
          '</div>' +
        '</div>' +
      '</div>';
    },
  };

  /* ----------------------------------------------------------
     Étape 3 — Capuche
     ---------------------------------------------------------- */
  const hood = {
    html() {
      return '<div class="cz-screen__intro"><p>Modèles relevés sur la planche « Cape » : étoles droite, ' +
        'en V et arrondie, puis les capuchons américain et européen.</p></div>' +
        '<div class="cz-group">' +
        field('Modèle', optionCards('hood.style', cat.HOOD_STYLES,
          (id) => thumbWrap(HOOD_THUMBS[id]))) +
        field('Couleur extérieure', swatches('hood.outer', cat.MAIN_COLORS)) +
        field('Doublure intérieure', swatches('hood.inner', cat.TRIM_COLORS)) +
        field('Couleur de bordure', swatches('hood.border', cat.TRIM_COLORS)) +
        field('Couleurs de faculté', swatches('hood.faculty', cat.FACULTY_COLORS),
          'La faculté choisie détermine le satin visible à l’intérieur.') +
        field('Broderie de capuche',
          textInput('hood.emb', { maxlength: 40, placeholder: 'Ex : Faculté de Médecine de Tunis' })) +
        '</div>';
    },
  };

  /* ----------------------------------------------------------
     Étape 4 — Mortier
     ---------------------------------------------------------- */
  const cap = {
    html() {
      return '<div class="cz-screen__intro"><p>Les trois formes de plateau de la planche coiffe : ' +
        'le repère 1 désigne le plateau, le repère 2 la calotte.</p></div>' +
        '<div class="cz-group">' +
        field('Forme du mortier', optionCards('cap.style', cat.CAP_STYLES,
          (id) => thumbWrap(CAP_THUMBS[id]))) +
        field('Matière', optionCards('cap.material', cat.CAP_MATERIALS)) +
        field('Couleur', swatches('cap.color', cat.MAIN_COLORS)) +
        field('Couleur du bouton', swatches('cap.button', cat.TRIM_COLORS, { small: true })) +
        field('Broderie du plateau',
          textInput('cap.emb', { maxlength: 24, placeholder: 'Ex : Promotion 2026' })) +
        field('Logo brodé sur le mortier',
          uploadSlot('cap.logo', 'cap.logoName', 'Ajouter un logo', 'PNG · JPG · SVG')) +
        '</div>';
    },
  };

  /* ----------------------------------------------------------
     Étape 5 — Gland
     ---------------------------------------------------------- */
  const tassel = {
    html() {
      const years = [];
      const thisYear = new Date().getFullYear();
      for (let y = thisYear; y <= thisYear + 3; y += 1) years.push(String(y));
      const current = store.at('tassel.year');
      return '<div class="cz-screen__intro"><p>Quatre têtes de gland relevées sur la planche : ' +
        'nœud, torsade cannelée, tête lisse et version fine.</p></div>' +
        '<div class="cz-group">' +
        field('Style du gland', optionCards('tassel.style', cat.TASSEL_STYLES,
          (id) => thumbWrap(TASSEL_THUMBS[id]))) +
        field('Couleur du gland', swatches('tassel.color', cat.TASSEL_COLORS)) +
        field('Breloque année', '<div class="cz-pills">' +
          '<button type="button" class="cz-pill' + (!current ? ' is-active' : '') + '"' +
          ' data-set="tassel.year" data-value="" aria-pressed="' + (!current) + '">Aucune</button>' +
          years.map((y) => '<button type="button" class="cz-pill' + (current === y ? ' is-active' : '') + '"' +
            ' data-set="tassel.year" data-value="' + y + '" aria-pressed="' + (current === y) + '">' + y +
            '</button>').join('') + '</div>') +
        field('Finition de la breloque année', optionCards('tassel.yearCharm', cat.CHARM_FINISHES)) +
        field('Breloque de faculté', optionCards('tassel.facultyCharm', cat.CHARM_FINISHES),
          'La breloque reprend la couleur de faculté choisie à l’étape capuche.') +
        '</div>';
    },
  };

  /* ----------------------------------------------------------
     Étape 6 — Mesures
     ---------------------------------------------------------- */
  const measure = {
    html() {
      return '<div class="cz-screen__intro"><p>Chaque mesure dispose de son illustration et de son guide. ' +
        'Munissez-vous d’un mètre ruban souple.</p></div>' +
        '<div class="cz-measures">' + cat.MEASUREMENTS.map((m) => {
          const value = store.at('measures.' + m.id);
          return '<div class="cz-measure" data-measure="' + m.id + '">' +
            '<div class="cz-measure__fig">' + FIGURES[m.guide.figure] + '</div>' +
            '<div class="cz-measure__main">' +
              '<div class="cz-measure__head">' +
                '<span class="cz-measure__label">' + esc(m.label) + '</span>' +
                '<button type="button" class="cz-measure__guide" data-guide="' + m.id + '">' +
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>' +
                  '<path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.4V14"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>' +
                  'Comment mesurer</button>' +
              '</div>' +
              '<div class="cz-measure__input">' +
                '<input class="cz-input" type="number" inputmode="decimal" step="0.5"' +
                  ' data-measure-input="' + m.id + '" value="' + esc(value) + '"' +
                  ' placeholder="' + m.placeholder + '" min="' + m.min + '" max="' + m.max + '"' +
                  ' aria-label="' + esc(m.label) + ' en ' + m.unit + '">' +
                '<span class="cz-measure__unit">' + m.unit + '</span>' +
                '<span class="cz-measure__state" data-measure-state="' + m.id + '"></span>' +
              '</div>' +
              '<p class="cz-measure__hint">' + esc(m.hint) + '</p>' +
              '<p class="cz-error" data-measure-error="' + m.id + '" hidden></p>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
    },
  };

  /* ----------------------------------------------------------
     Étape 7 — Récapitulatif
     ---------------------------------------------------------- */
  const review = {
    lines() {
      const s = store.get();
      const labelOf = (list, id) => (cat.find(list, id) || {}).label || '—';
      const colorRow = (label, list, id) => ({
        label,
        value: labelOf(list, id),
        hex: cat.hexOf(list, id, ''),
      });

      return [
        {
          step: 'robe', title: 'La Robe', rows: [
            { label: 'Tissu', value: labelOf(cat.FABRICS, s.robe.fabric) },
            colorRow('Couleur principale', cat.MAIN_COLORS, s.robe.main),
            colorRow('Couleur secondaire', cat.TRIM_COLORS, s.robe.secondary),
            s.robe.sleeveColor === 'match'
              ? { label: 'Manches', value: 'Assorties au tissu' }
              : colorRow('Manches', cat.MAIN_COLORS, s.robe.sleeveColor),
            { label: 'Coupe des manches', value: labelOf(cat.SLEEVES, s.robe.sleeve) },
            { label: 'Col', value: labelOf(cat.COLLARS, s.robe.collar) },
            { label: 'Bordure', value: labelOf(cat.TRIM_STYLES, s.robe.trim) },
            colorRow('Couleur de bordure', cat.TRIM_COLORS, s.robe.trimColor),
            { label: 'Broderie', value: s.robe.emb.enabled
              ? (s.robe.emb.text.trim() || '— sans texte —') + ' · ' + cat.FONTS[s.robe.emb.font].label +
                ' · ' + labelOf(cat.THREAD_COLORS, s.robe.emb.thread) +
                ' · ' + ((cat.EMB_POSITIONS.find((p) => p.id === s.robe.emb.position) || {}).label || '')
              : 'Aucune' },
            { label: 'Logos brodés', value: [s.robe.emb.uniLogoName, s.robe.emb.facLogoName]
              .filter(Boolean).join(' · ') || 'Aucun' },
          ],
        },
        {
          step: 'hood', title: 'La Capuche', rows: [
            { label: 'Modèle', value: labelOf(cat.HOOD_STYLES, s.hood.style) },
            colorRow('Extérieur', cat.MAIN_COLORS, s.hood.outer),
            colorRow('Doublure', cat.TRIM_COLORS, s.hood.inner),
            colorRow('Bordure', cat.TRIM_COLORS, s.hood.border),
            colorRow('Faculté', cat.FACULTY_COLORS, s.hood.faculty),
            { label: 'Broderie', value: s.hood.emb.trim() || 'Aucune' },
          ],
        },
        {
          step: 'cap', title: 'Le Mortier', rows: [
            { label: 'Forme', value: labelOf(cat.CAP_STYLES, s.cap.style) },
            { label: 'Matière', value: labelOf(cat.CAP_MATERIALS, s.cap.material) },
            colorRow('Couleur', cat.MAIN_COLORS, s.cap.color),
            colorRow('Bouton', cat.TRIM_COLORS, s.cap.button),
            { label: 'Broderie', value: s.cap.emb.trim() || 'Aucune' },
            { label: 'Logo', value: s.cap.logoName || 'Aucun' },
          ],
        },
        {
          step: 'tassel', title: 'Le Gland', rows: [
            { label: 'Style', value: labelOf(cat.TASSEL_STYLES, s.tassel.style) },
            colorRow('Couleur', cat.TASSEL_COLORS, s.tassel.color),
            { label: 'Année', value: s.tassel.year || 'Aucune' },
            { label: 'Breloque année', value: labelOf(cat.CHARM_FINISHES, s.tassel.yearCharm) },
            { label: 'Breloque faculté', value: labelOf(cat.CHARM_FINISHES, s.tassel.facultyCharm) },
          ],
        },
        {
          step: 'measure', title: 'Vos Mesures',
          rows: cat.MEASUREMENTS.map((m) => ({
            label: m.label,
            value: s.measures[m.id] ? s.measures[m.id] + ' ' + m.unit : '— manquante —',
            warn: !s.measures[m.id],
          })),
        },
      ];
    },

    html() {
      const s = store.get();
      /* Les erreurs de coordonnées restent muettes à l’arrivée sur l’écran :
         elles n’apparaissent qu’à la saisie ou au blocage de l’envoi. */
      const filesBlock = s.files.length
        ? '<ul class="cz-recap__files">' + s.files.map((f) =>
            '<li>' + (f.previewable
              ? '<img src="' + esc(f.dataUrl) + '" alt="">'
              : '<span class="cz-file__ext">' + esc(f.label) + '</span>') +
            '<span>' + esc(f.name) + '<small>' + kb(f.size) + '</small></span></li>').join('') + '</ul>'
        : '<p class="cz-recap__empty">Aucun fichier — revenez à l’étape « Vos fichiers ».</p>';

      const sections = this.lines().map((section) =>
        '<section class="cz-recap">' +
          '<header class="cz-recap__head"><h3>' + esc(section.title) + '</h3>' +
          '<button type="button" class="btn btn--line cz-recap__edit" data-goto="' + section.step + '">Modifier</button>' +
          '</header>' +
          '<dl class="cz-recap__list">' + section.rows.map((row) =>
            '<div class="cz-recap__row' + (row.warn ? ' is-warn' : '') + '">' +
            '<dt>' + esc(row.label) + '</dt>' +
            '<dd>' + (row.hex ? '<i class="cz-recap__dot" style="background:' + row.hex + '"></i>' : '') +
            esc(row.value) + '</dd></div>').join('') +
          '</dl>' +
        '</section>').join('');

      const inputRow = (id, label, attrs) => {
        const a = attrs || {};
        return '<div class="cz-field">' +
          '<label class="cz-field__label" for="cz_' + id + '">' + esc(label) + '</label>' +
          '<input class="cz-input" id="cz_' + id + '" type="' + (a.type || 'text') + '"' +
          ' data-client="' + id + '" value="' + esc(store.at('client.' + id)) + '"' +
          (a.placeholder ? ' placeholder="' + esc(a.placeholder) + '"' : '') +
          (a.autocomplete ? ' autocomplete="' + a.autocomplete + '"' : '') +
          (a.min ? ' min="' + a.min + '"' : '') + '>' +
          '<p class="cz-error" data-client-error="' + id + '" hidden></p></div>';
      };

      return '<section class="cz-recap">' +
          '<header class="cz-recap__head"><h3>Vos fichiers</h3>' +
          '<button type="button" class="btn btn--line cz-recap__edit" data-goto="upload">Modifier</button>' +
          '</header>' + filesBlock +
        '</section>' + sections +
        '<section class="cz-recap">' +
          '<header class="cz-recap__head"><h3>Vos coordonnées</h3></header>' +
          '<div class="cz-form">' +
            inputRow('name', 'Nom & prénom *', { placeholder: 'Ex : Salhi Wafa', autocomplete: 'name' }) +
            inputRow('whatsapp', 'Numéro WhatsApp *', { type: 'tel', placeholder: 'Ex : 22 123 456', autocomplete: 'tel' }) +
            inputRow('email', 'E-mail (optionnel)', { type: 'email', placeholder: 'vous@exemple.tn', autocomplete: 'email' }) +
            '<div class="cz-field"><label class="cz-field__label" for="cz_region">Région *</label>' +
              '<select class="cz-input" id="cz_region" data-client="region">' +
              '<option value="">— Choisir un gouvernorat —</option>' +
              cat.REGIONS.map((r) => '<option value="' + esc(r) + '"' +
                (store.at('client.region') === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('') +
              '</select><p class="cz-error" data-client-error="region" hidden></p></div>' +
            inputRow('university', 'Université / établissement', { placeholder: 'Ex : Université de Tunis El Manar' }) +
            inputRow('date', 'Date de soutenance *', { type: 'date', min: new Date().toISOString().slice(0, 10) }) +
            '<div class="cz-field cz-field--wide"><label class="cz-field__label" for="cz_notes">Remarques</label>' +
              '<textarea class="cz-input" id="cz_notes" data-client="notes" rows="3"' +
              ' placeholder="Contraintes de délai, précisions de broderie, couleurs imposées…">' +
              esc(store.at('client.notes')) + '</textarea></div>' +
          '</div>' +
        '</section>';
    },
  };

  /* ----------------------------------------------------------
     Étape 8 — Envoi
     ---------------------------------------------------------- */
  const submit = {
    html() {
      const done = store.at('submitted');
      if (done) return submit.success(done);
      return '<div class="cz-send">' +
        '<div class="cz-send__seal"><svg viewBox="0 0 48 48" aria-hidden="true">' +
          '<circle cx="24" cy="24" r="20"/><polyline points="15 24 21 30 33 18"/></svg></div>' +
        '<h3 class="cz-send__title">Votre dossier de fabrication est complet</h3>' +
        '<p class="cz-send__text">En confirmant, votre configuration, vos fichiers et vos mesures sont ' +
        'transmis à l’atelier ENMIIS et apparaissent immédiatement dans l’espace de gestion des commandes.</p>' +
        '<ul class="cz-send__checks">' +
          '<li>' + store.get().files.length + ' fichier(s) de production</li>' +
          '<li>Robe, capuche, mortier et gland configurés</li>' +
          '<li>9 mesures validées</li>' +
        '</ul>' +
        '<button type="button" class="btn btn--solid cz-send__cta" id="czSubmit">Envoyer ma demande</button>' +
        '<p class="cz-send__note">Réponse de l’atelier sous 24 h ouvrées sur WhatsApp.</p>' +
      '</div>';
    },

    success(done) {
      return '<div class="cz-done">' +
        '<div class="cz-done__burst"><svg viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle class="cz-done__ring" cx="32" cy="32" r="26"/>' +
          '<polyline class="cz-done__tick" points="20 33 28 41 44 23"/></svg></div>' +
        '<p class="cz-done__label">Demande enregistrée</p>' +
        '<h3 class="cz-done__title">Merci — votre commande est entre nos mains</h3>' +
        '<p class="cz-done__ref">Référence <strong>' + esc(done.ref) + '</strong></p>' +
        '<p class="cz-done__text">Conservez cette référence : elle identifie votre dossier auprès de l’atelier. ' +
        'Notre équipe confirme les mesures et la broderie avant lancement de la fabrication.</p>' +
        '<div class="cz-done__actions">' +
          '<button type="button" class="btn btn--solid" id="czPdf">Télécharger le récapitulatif</button>' +
          '<button type="button" class="btn btn--line" id="czRestart">Configurer une autre tenue</button>' +
        '</div>' +
      '</div>';
    },
  };

  CZ.steps = {
    esc, FIGURES,
    upload, robe, hood, cap, tassel, measure, review, submit,
  };
})(window);
