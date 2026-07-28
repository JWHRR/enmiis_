/* ============================================================
   ENMIIS — Configurateur : écrans de l’assistant.
   Un module par étape : gabarit (html) + illustrations (ART).

   Chaque option est illustrée : même silhouette, même échelle,
   même trait sur toutes les cartes — la partie qui change d’un
   modèle à l’autre est soulignée à l’or. Le client comprend la
   différence d’un coup d’œil, sans lire.

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

  /* ==========================================================
     ART — bibliothèque d’illustrations produit.
     Classes : a-ink trait principal · a-dim trait estompé ·
     a-gold soulignage or · a-goldf aplat or · a-soft fond tissu.
     ========================================================== */
  const art = (inner, vb) =>
    '<svg viewBox="0 0 ' + (vb || '120 140') + '" aria-hidden="true" focusable="false">' + inner + '</svg>';

  /* --- Robe : silhouette commune, détail mis en avant --- */
  const SLEEVE_PATHS = {
    cloche: [
      'M46 34 C 38 38 33 47 31 57 L 20 104 C 30 112 44 110 49 103 L 47 58',
      'M74 34 C 82 38 87 47 89 57 L 100 104 C 90 112 76 110 71 103 L 73 58',
    ],
    pointe: [
      'M46 34 C 38 38 33 47 31 57 L 25 92 L 38 120 L 47 94 L 47 58',
      'M74 34 C 82 38 87 47 89 57 L 95 92 L 82 120 L 73 94 L 73 58',
    ],
    droite: [
      'M46 34 C 39 37 35 44 33 52 L 30 102 C 34 106 42 106 45 102 L 47 58',
      'M74 34 C 81 37 85 44 87 52 L 90 102 C 86 106 78 106 75 102 L 73 58',
    ],
  };

  const COLLAR_PATHS = {
    v:     '<path class="a-gold" d="M49 32 L 60 56 L 71 32"/>',
    chale: '<path class="a-goldf" d="M48 31 C 52 46 68 46 72 31 L 69 29 C 66 41 54 41 51 29 Z"/>',
    droit: '<path class="a-goldf" d="M50 27 C 54 23 66 23 70 27 L 70 33 C 66 29 54 29 50 33 Z"/>',
    sans:  '<path class="a-ink" d="M51 31 C 55 35 65 35 69 31"/>',
  };

  const TRIM_PATHS = {
    double: '<path class="a-gold" stroke-width="4" d="M53 36 L 51 124"/>' +
            '<path class="a-gold" stroke-width="4" d="M67 36 L 69 124"/>',
    simple: '<path class="a-gold" stroke-width="5" d="M60 38 L 60 124"/>',
    'liseré': '<path class="a-gold" stroke-width="1.5" d="M54 36 L 52 124"/>' +
              '<path class="a-gold" stroke-width="1.5" d="M66 36 L 68 124"/>',
    aucun: '',
  };

  /* Silhouette de robe ; `focus` désigne la partie soulignée à l’or. */
  function gownArt(options) {
    const o = options || {};
    const sleeve = SLEEVE_PATHS[o.sleeve || 'cloche'];
    const sleeveClass = o.focus === 'sleeve' ? 'a-goldf' : 'a-ink';
    const collar = o.focus === 'collar'
      ? COLLAR_PATHS[o.collar || 'v']
      : (o.collar ? COLLAR_PATHS[o.collar].replace(/a-gold[f]?/g, 'a-dim') : '');
    const trim = o.focus === 'trim'
      ? TRIM_PATHS[o.trim || 'double']
      : (o.trim ? TRIM_PATHS[o.trim].replace(/a-gold/g, 'a-dim') : '');
    return art(
      '<path class="' + sleeveClass + '" d="' + sleeve[0] + '"/>' +
      '<path class="' + sleeveClass + '" d="' + sleeve[1] + '"/>' +
      '<path class="a-ink" d="M46 34 C 52 26 68 26 74 34 L 80 126 L 40 126 Z"/>' +
      '<path class="a-ink" d="M52 30 C 56 34 64 34 68 30"/>' +
      trim + collar,
    );
  }

  /* --- Échantillons de matière (tissus robe & mortier) --- */
  const WEAVES = {
    gabardine:
      '<path class="a-dim" d="M32 104 L 88 42 M32 88 L 80 36 M40 110 L 88 58 M52 112 L 88 74"/>' +
      '<path class="a-gold" stroke-width="2" d="M32 72 L 66 36"/>',
    crepe:
      '<path class="a-dim" d="M32 52 q 8 -7 16 0 t 16 0 t 16 0 M32 70 q 8 -7 16 0 t 16 0 t 16 0 ' +
      'M32 88 q 8 -7 16 0 t 16 0 t 16 0"/>' +
      '<path class="a-gold" stroke-width="2" d="M32 106 q 8 -7 16 0 t 16 0 t 16 0"/>',
    satin:
      '<path class="a-gold" stroke-width="7" opacity="0.35" d="M30 96 L 90 44"/>' +
      '<path class="a-gold" stroke-width="3" d="M30 82 L 90 30"/>' +
      '<path class="a-dim" d="M34 112 L 90 62"/>',
    velours:
      Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) =>
        '<circle class="a-dimf" cx="' + (36 + c * 12 + (r % 2) * 6) + '" cy="' + (44 + r * 14) + '" r="2"/>',
      ).join('')).join('') +
      '<circle class="a-goldc" cx="60" cy="72" r="2.6"/>',
    taffetas:
      '<path class="a-dim" d="M32 100 L 88 44 M32 76 L 76 32 M48 112 L 88 72"/>' +
      '<path class="a-dim" d="M32 44 L 88 100 M32 68 L 72 108 M44 32 L 88 76"/>' +
      '<path class="a-gold" stroke-width="2" d="M32 56 L 82 106"/>',
  };

  function fabricArt(id) {
    return art('<rect class="a-soft" x="24" y="24" width="72" height="94" rx="12"/>' +
      '<g clip-path="inset(0 round 12px)">' + (WEAVES[id] || WEAVES.gabardine) + '</g>');
  }

  /* --- Capuche / étole : les cinq modèles de la planche --- */
  const HOOD_ART = {
    'etole-droite':
      '<path class="a-ink" d="M36 18 C 50 34 70 34 84 18 L 89 32 C 70 52 50 52 31 32 Z"/>' +
      '<path class="a-ink" d="M39 32 L 35 114 L 56 114 L 56 42 Z"/>' +
      '<path class="a-ink" d="M81 32 L 85 114 L 64 114 L 64 42 Z"/>' +
      '<path class="a-goldf" d="M43 40 L 40 107 L 51 107 L 51 45 Z"/>' +
      '<path class="a-goldf" d="M77 40 L 80 107 L 69 107 L 69 45 Z"/>' +
      '<path class="a-gold" d="M45 114 L 45 124 M75 114 L 75 124"/>',
    'etole-v':
      '<path class="a-ink" d="M36 18 C 50 34 70 34 84 18 L 89 32 C 70 52 50 52 31 32 Z"/>' +
      '<path class="a-ink" d="M39 32 L 36 100 L 46 120 L 56 100 L 56 42 Z"/>' +
      '<path class="a-ink" d="M81 32 L 84 100 L 74 120 L 64 100 L 64 42 Z"/>' +
      '<path class="a-goldf" d="M43 40 L 41 97 L 46 108 L 51 97 L 51 45 Z"/>' +
      '<path class="a-goldf" d="M77 40 L 79 97 L 74 108 L 69 97 L 69 45 Z"/>',
    'etole-arrondie':
      '<path class="a-ink" d="M36 18 C 50 34 70 34 84 18 L 89 32 C 70 52 50 52 31 32 Z"/>' +
      '<path class="a-ink" d="M39 32 L 36 102 C 36 118 56 118 56 102 L 56 42 Z"/>' +
      '<path class="a-ink" d="M81 32 L 84 102 C 84 118 64 118 64 102 L 64 42 Z"/>' +
      '<path class="a-goldf" d="M43 40 L 41 100 C 41 110 51 110 51 100 L 51 45 Z"/>' +
      '<path class="a-goldf" d="M77 40 L 79 100 C 79 110 69 110 69 100 L 69 45 Z"/>',
    'capuche-am':
      '<path class="a-ink" d="M32 20 C 48 40 72 40 88 20 C 96 44 96 66 88 86 L 60 120 L 32 86 C 24 66 24 44 32 20 Z"/>' +
      '<path class="a-goldf" d="M42 32 C 52 44 68 44 78 32 C 84 48 84 64 78 80 L 60 102 L 42 80 C 36 64 36 48 42 32 Z"/>' +
      '<path class="a-ink" d="M60 44 C 66 56 66 72 60 84 C 54 72 54 56 60 44 Z"/>',
    'capuche-eu':
      '<path class="a-ink" d="M30 20 C 48 42 72 42 90 20 C 100 50 100 82 90 106 C 76 122 44 122 30 106 C 20 82 20 50 30 20 Z"/>' +
      '<path class="a-goldf" d="M40 34 C 52 48 68 48 80 34 C 88 54 88 80 80 98 C 70 110 50 110 40 98 C 32 80 32 54 40 34 Z"/>' +
      '<path class="a-ink" d="M30 106 C 44 122 76 122 90 106 L 87 114 C 74 128 46 128 33 114 Z"/>',
  };

  /* --- Mortier : perspective + trois petites vues (face·dessus·profil) --- */
  const CAP_GEOM = {
    classique: { board: 'M60 18 L 106 36 L 60 54 L 14 36 Z', crown: 'M34 46 C 34 68 86 68 86 46 L 86 60 C 86 80 34 80 34 60 Z', bx: 60, by: 36, tiltFront: 0, tiltSide: 0 },
    incline:   { board: 'M52 14 L 108 38 L 66 56 L 12 32 Z',  crown: 'M36 46 C 38 68 88 66 86 44 L 88 58 C 90 80 38 82 36 60 Z', bx: 63, by: 35, tiltFront: 4, tiltSide: 5 },
    plat:      { board: 'M60 24 L 102 38 L 60 52 L 18 38 Z',  crown: 'M38 44 C 38 62 82 62 82 44 L 82 54 C 82 72 38 72 38 54 Z', bx: 60, by: 38, tiltFront: 0, tiltSide: -2 },
  };

  function capArt(id) {
    const g = CAP_GEOM[id] || CAP_GEOM.classique;
    return art(
      '<path class="a-ink" d="' + g.crown + '"/>' +
      '<path class="a-inkf" d="' + g.board + '"/>' +
      '<circle class="a-goldc" cx="' + g.bx + '" cy="' + g.by + '" r="3.5"/>' +
      '<path class="a-gold" stroke-width="2" d="M' + g.bx + ' ' + g.by + ' C ' + (g.bx + 20) + ' ' + (g.by + 6) + ' ' + (g.bx + 28) + ' ' + (g.by + 18) + ' ' + (g.bx + 30) + ' ' + (g.by + 32) + '"/>' +
      '<path class="a-goldf" d="M' + (g.bx + 26) + ' ' + (g.by + 32) + ' L ' + (g.bx + 34) + ' ' + (g.by + 32) + ' L ' + (g.bx + 33) + ' ' + (g.by + 50) + ' L ' + (g.bx + 27) + ' ' + (g.by + 50) + ' Z"/>',
    );
  }

  /* Petites vues techniques du mortier, alignées sous la carte. */
  function capViews(id) {
    const g = CAP_GEOM[id] || CAP_GEOM.classique;
    const f = g.tiltFront;
    const s = g.tiltSide;
    const view = (label, inner) =>
      '<span class="cz-view"><svg viewBox="0 0 36 30" aria-hidden="true" focusable="false">' + inner + '</svg>' +
      '<em>' + label + '</em></span>';
    return '<span class="cz-views">' +
      view('Face',
        '<path class="a-ink" d="M4 ' + (13 + f) + ' L 32 ' + (13 - f) + ' L 29 ' + (7 - f) + ' L 7 ' + (7 + f) + ' Z"/>' +
        '<path class="a-ink" d="M10 ' + (13 + f * 0.6) + ' L 26 ' + (13 - f * 0.6) + ' L 26 20 L 10 20 Z"/>') +
      view('Dessus',
        '<path class="a-ink" d="M18 3 L 33 15 L 18 27 L 3 15 Z"/>' +
        '<circle class="a-goldc" cx="18" cy="15" r="2"/>') +
      view('Profil',
        '<path class="a-ink" stroke-width="3" d="M4 ' + (11 - s) + ' L 32 ' + (11 + s) + '"/>' +
        '<path class="a-ink" d="M11 ' + (13 - s * 0.5) + ' C 11 21 25 21 25 ' + (13 + s * 0.5) + '"/>') +
      '</span>';
  }

  /* --- Gland : modèle en grand + pastille de détail de la tête --- */
  const TASSEL_HEADS = {
    noeud:
      '<ellipse class="a-goldf" cx="60" cy="34" rx="13" ry="11"/>' +
      '<path class="a-gold" d="M50 30 C 56 40 64 40 70 30 M50 38 C 56 28 64 28 70 38"/>',
    cannele:
      '<path class="a-goldf" d="M48 24 L 72 24 L 75 48 L 45 48 Z"/>' +
      '<path class="a-gold" d="M46 32 L 74 32 M45 40 L 75 40"/>',
    lisse:
      '<path class="a-goldf" d="M48 26 C 52 18 68 18 72 26 L 74 46 L 46 46 Z"/>',
    fin:
      '<path class="a-goldf" d="M52 26 C 55 20 65 20 68 26 L 70 42 L 50 42 Z"/>',
  };

  const TASSEL_DETAILS = {
    noeud:  '<path class="a-gold" d="M88 22 C 92 28 100 28 104 22 M88 30 C 92 24 100 24 104 30 M88 26 h16"/>',
    cannele:'<path class="a-gold" d="M88 20 h16 M88 25 h16 M88 30 h16"/>',
    lisse:  '<path class="a-gold" d="M89 28 C 92 20 100 20 103 28"/>',
    fin:    '<path class="a-gold" d="M92 20 v12 M96 19 v14 M100 20 v12"/>',
  };

  function tasselArt(id) {
    const slim = id === 'fin';
    const half = slim ? 11 : 16;
    const top = slim ? 42 : (id === 'noeud' ? 45 : 48);
    const bottom = slim ? 106 : 118;
    let strands = '';
    const count = slim ? 5 : 8;
    for (let i = 0; i < count; i += 1) {
      const x = 60 - half + 3 + (i * (half * 2 - 6)) / (count - 1);
      strands += '<path class="a-gold" stroke-width="1.2" d="M' + x.toFixed(1) + ' ' + (top + 2) +
        ' L ' + (x + (x - 60) * 0.14).toFixed(1) + ' ' + (bottom - 2) + '"/>';
    }
    return art(
      '<path class="a-ink" d="M60 8 L 60 ' + (id === 'noeud' ? 24 : 22) + '"/>' +
      TASSEL_HEADS[id] +
      '<path class="a-goldf" opacity="0.5" d="M' + (60 - half) + ' ' + top + ' L ' + (60 + half) + ' ' + top +
        ' L ' + (60 + half + 3) + ' ' + bottom + ' L ' + (60 - half - 3) + ' ' + bottom + ' Z"/>' +
      strands +
      /* pastille loupe : détail de la tête */
      '<circle class="a-lens" cx="96" cy="25" r="15"/>' +
      TASSEL_DETAILS[id] +
      '<path class="a-ink" d="M85 36 L 78 44"/>',
    );
  }

  const ART = {
    'robe.fabric': (id) => fabricArt(id),
    'robe.sleeve': (id) => gownArt({ sleeve: id, focus: 'sleeve' }),
    'robe.collar': (id) => gownArt({ collar: id, focus: 'collar' }),
    'robe.trim':   (id) => gownArt({ trim: id, focus: 'trim' }),
    'hood.style':  (id) => art(HOOD_ART[id]),
    'cap.style':   (id) => capArt(id),
    'cap.material': (id) => fabricArt(id),
    'tassel.style': (id) => tasselArt(id),
  };

  /* ==========================================================
     Briques d’interface
     ========================================================== */
  function optionCards(path, items, options) {
    const opts = options || {};
    const current = store.at(path);
    const artFn = ART[path];
    return '<div class="cz-options' + (opts.wide ? ' cz-options--wide' : '') + '" role="group">' +
      items.map((item) =>
        '<button type="button" class="cz-option' + (current === item.id ? ' is-active' : '') + '"' +
        ' data-set="' + path + '" data-value="' + item.id + '" aria-pressed="' + (current === item.id) + '">' +
        (artFn ? '<span class="cz-option__art">' + artFn(item.id) + '</span>' : '') +
        '<span class="cz-option__name">' + esc(item.label) + '</span>' +
        (item.note ? '<span class="cz-option__note">' + esc(item.note) + '</span>' : '') +
        (path === 'cap.style' ? capViews(item.id) : '') +
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
      ' spellcheck="false">';
  }

  function uploadSlot(pathData, pathName, label, hintText) {
    const value = store.at(pathData);
    const name = store.at(pathName);
    return '<div class="cz-logo' + (value ? ' is-filled' : '') + '" data-logo="' + pathData + '">' +
      (value
        ? '<img class="cz-logo__img" src="' + esc(value) + '" alt="' + esc(name) + '" decoding="async">'
        : '<svg class="cz-logo__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/></svg>') +
      '<span class="cz-logo__text">' + esc(value ? name : label) + '</span>' +
      '<span class="cz-logo__hint">' + esc(hintText) + '</span>' +
      '<input type="file" accept="image/png,image/jpeg,image/svg+xml" class="visually-hidden"' +
      ' data-logo-input="' + pathData + '" data-logo-name="' + pathName + '">' +
      (value ? '<button type="button" class="cz-logo__clear" data-logo-clear="' + pathData + '"' +
        ' aria-label="Retirer">×</button>' : '') +
      '</div>';
  }

  /* ==========================================================
     Illustrations des guides de mesure
     ========================================================== */
  function headProfile(tapeY, number) {
    return '<svg viewBox="0 0 120 140" aria-hidden="true">' +
      '<path class="fig-body" d="M62 22 C 38 22 26 40 26 62 C 26 74 30 84 34 90 L 34 106 C 34 112 40 116 48 116 L 76 116"/>' +
      '<path class="fig-body" d="M26 58 C 20 58 18 66 20 72 C 22 77 27 78 30 77"/>' +
      '<path class="fig-body" d="M62 22 C 82 22 92 38 92 60 C 92 82 80 100 62 106"/>' +
      '<path class="fig-body" d="M66 62 C 72 58 78 62 76 70 C 75 76 69 78 66 75"/>' +
      '<path class="fig-tape" d="M26 ' + tapeY + ' C 40 ' + (tapeY - 7) + ' 78 ' + (tapeY - 7) + ' 92 ' + tapeY + '"/>' +
      '<circle class="fig-dot" cx="60" cy="128" r="11"/>' +
      '<text class="fig-num" x="60" y="132" text-anchor="middle">' + number + '</text>' +
      '</svg>';
  }

  const FIGURES = {
    height: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 42 C 92 42 88 48 88 56 C 88 64 92 70 100 70 C 108 70 112 64 112 56 C 112 48 108 42 100 42 Z"/><path class="fig-body" d="M86 72 L 114 72 L 120 118 L 114 118 L 112 170 L 88 170 L 86 118 L 80 118 Z"/><line class="fig-wall" x1="150" y1="24" x2="150" y2="184"/><line class="fig-mark" x1="60" y1="38" x2="160" y2="38"/><line class="fig-mark" x1="60" y1="180" x2="160" y2="180"/><line class="fig-arrow" x1="140" y1="38" x2="140" y2="180"/><text class="fig-num" x="132" y="112" text-anchor="end">1</text></svg>',
    weight: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 36 C 92 36 88 42 88 50 C 88 58 92 64 100 64 C 108 64 112 58 112 50 C 112 42 108 36 100 36 Z"/><path class="fig-body" d="M86 66 L 114 66 L 120 112 L 112 112 L 110 148 L 90 148 L 88 112 L 80 112 Z"/><rect class="fig-mark" x="62" y="150" width="76" height="24" rx="4"/><path class="fig-arrow" d="M84 162 A 16 16 0 0 1 116 162"/><line class="fig-arrow" x1="100" y1="162" x2="110" y2="155"/></svg>',
    head: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 30 C 72 30 56 52 56 82 C 56 112 72 136 100 140 C 128 136 144 112 144 82 C 144 52 128 30 100 30 Z"/><ellipse class="fig-tape" cx="100" cy="66" rx="46" ry="11"/><ellipse class="fig-mark" cx="100" cy="84" rx="47" ry="11"/><ellipse class="fig-mark" cx="100" cy="102" rx="45" ry="11"/><circle class="fig-dot" cx="152" cy="66" r="9"/><text class="fig-num" x="152" y="70" text-anchor="middle">1</text><circle class="fig-dot" cx="154" cy="84" r="9"/><text class="fig-num" x="154" y="88" text-anchor="middle">2</text><circle class="fig-dot" cx="152" cy="102" r="9"/><text class="fig-num" x="152" y="106" text-anchor="middle">3</text><path class="fig-body" d="M56 78 C 48 78 46 92 54 94"/><path class="fig-body" d="M144 78 C 152 78 154 92 146 94"/></svg>',
    head1: headProfile(62, 1),
    head2: headProfile(80, 2),
    head3: headProfile(98, 3),
    chest: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 128 84 L 124 130 L 76 130 L 72 84 Z"/><path class="fig-body" d="M84 58 L 60 78 L 56 130"/><path class="fig-body" d="M116 58 L 140 78 L 144 130"/><ellipse class="fig-tape" cx="100" cy="86" rx="32" ry="9"/><text class="fig-num" x="100" y="164" text-anchor="middle">6</text><line class="fig-arrow" x1="68" y1="152" x2="132" y2="152"/></svg>',
    waist: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 126 86 L 116 112 L 122 150 L 78 150 L 84 112 L 74 86 Z"/><ellipse class="fig-tape" cx="100" cy="112" rx="22" ry="8"/><line class="fig-arrow" x1="132" y1="112" x2="164" y2="112"/></svg>',
    hip: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 26 C 92 26 88 32 88 40 C 88 48 92 54 100 54 C 108 54 112 48 112 40 C 112 32 108 26 100 26 Z"/><path class="fig-body" d="M84 58 L 116 58 L 124 88 L 114 108 L 126 140 L 74 140 L 86 108 L 76 88 Z"/><path class="fig-body" d="M78 142 L 94 142 L 92 178 L 80 178 Z"/><path class="fig-body" d="M106 142 L 122 142 L 120 178 L 108 178 Z"/><ellipse class="fig-tape" cx="100" cy="134" rx="30" ry="9"/><text class="fig-num" x="100" y="192" text-anchor="middle">3</text></svg>',
    shoulder: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 30 C 90 30 84 38 84 48 C 84 58 90 66 100 66 C 110 66 116 58 116 48 C 116 38 110 30 100 30 Z"/><path class="fig-body" d="M62 88 C 74 74 88 70 100 70 C 112 70 126 74 138 88 L 132 150 L 68 150 Z"/><line class="fig-tape" x1="62" y1="86" x2="138" y2="86"/><circle class="fig-dot" cx="62" cy="86" r="6"/><circle class="fig-dot" cx="138" cy="86" r="6"/><line class="fig-arrow" x1="62" y1="172" x2="138" y2="172"/><text class="fig-num" x="100" y="188" text-anchor="middle">2</text></svg>',
    sleeve: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M96 24 C 86 24 80 32 80 42 C 80 52 86 60 96 60 C 106 60 112 52 112 42 C 112 32 106 24 96 24 Z"/><path class="fig-body" d="M76 66 L 116 66 L 124 106 L 118 158 L 74 158 L 70 106 Z"/><path class="fig-body" d="M116 66 L 146 92 L 154 134 L 142 148"/><path class="fig-tape" d="M120 70 C 142 94 150 118 146 142"/><circle class="fig-dot" cx="120" cy="70" r="6"/><circle class="fig-dot" cx="146" cy="142" r="6"/><text class="fig-num" x="168" y="110" text-anchor="middle">5</text></svg>',
    gown: '<svg viewBox="0 0 200 200" aria-hidden="true"><path class="fig-body" d="M100 24 C 92 24 88 30 88 38 C 88 46 92 52 100 52 C 108 52 112 46 112 38 C 112 30 108 24 100 24 Z"/><path class="fig-body" d="M84 56 C 100 48 100 48 116 56 C 122 96 128 148 134 178 L 66 178 C 72 148 78 96 84 56 Z"/><line class="fig-tape" x1="152" y1="56" x2="152" y2="178"/><line class="fig-mark" x1="140" y1="56" x2="162" y2="56"/><line class="fig-mark" x1="140" y1="178" x2="162" y2="178"/><text class="fig-num" x="172" y="122" text-anchor="middle">1</text><line class="fig-arrow" x1="66" y1="190" x2="134" y2="190"/></svg>',
  };

  /* ==========================================================
     Étape 1 — Fichiers
     ========================================================== */
  const upload = {
    html() {
      const accept = cat.FILE_TYPES.map((t) => '.' + t.ext).join(',');
      const badges = ['PDF', 'PNG', 'JPG', 'SVG', 'AI', 'EPS', 'CDR']
        .map((label) => '<span class="cz-badge">' + label + '</span>').join('');
      return '<div class="cz-screen__intro"><p>Ces fichiers partent directement à l’atelier — et vos images ' +
        's’affichent aussitôt dans l’aperçu, où elles restent jusqu’à la fin du parcours.</p></div>' +
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

    item(file) {
      const preview = file.previewable
        ? '<img src="' + esc(file.dataUrl) + '" alt="" loading="lazy" decoding="async">'
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

  /* ==========================================================
     Étape 2 — Robe
     ========================================================== */
  const robe = {
    html() {
      const emb = store.at('robe.emb');
      return '<div class="cz-group">' +
        field('Tissu', optionCards('robe.fabric', cat.FABRICS)) +
        field('Coupe des manches', optionCards('robe.sleeve', cat.SLEEVES),
          'La partie dorée montre la manche du modèle.') +
        field('Col', optionCards('robe.collar', cat.COLLARS)) +
        field('Bordure (contour)', optionCards('robe.trim', cat.TRIM_STYLES)) +
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
      '</div>' +
      '<p class="cz-help cz-help--workshop">Les couleurs (tissu, bordure, fils) sont définies avec vous par ' +
      'l’atelier à la confirmation de la commande.</p>';
    },
  };

  /* ==========================================================
     Étape 3 — Capuche
     ========================================================== */
  const hood = {
    html() {
      return '<div class="cz-screen__intro"><p>Les cinq modèles de la planche « Cape », illustrés à la même ' +
        'échelle : la doublure apparaît en doré.</p></div>' +
        '<div class="cz-group">' +
        field('Modèle', optionCards('hood.style', cat.HOOD_STYLES, { wide: true })) +
        field('Broderie de capuche',
          textInput('hood.emb', { maxlength: 40, placeholder: 'Ex : Faculté de Médecine de Tunis' })) +
        '</div>';
    },
  };

  /* ==========================================================
     Étape 4 — Mortier
     ========================================================== */
  const cap = {
    html() {
      return '<div class="cz-screen__intro"><p>Chaque forme est montrée en perspective, avec ses vues ' +
        'de face, de dessus et de profil.</p></div>' +
        '<div class="cz-group">' +
        field('Forme du mortier', optionCards('cap.style', cat.CAP_STYLES, { wide: true })) +
        field('Matière', optionCards('cap.material', cat.CAP_MATERIALS)) +
        field('Broderie du plateau',
          textInput('cap.emb', { maxlength: 24, placeholder: 'Ex : Promotion 2026' })) +
        field('Logo brodé sur le mortier',
          uploadSlot('cap.logo', 'cap.logoName', 'Ajouter un logo', 'PNG · JPG · SVG')) +
        '</div>';
    },
  };

  /* ==========================================================
     Étape 5 — Gland
     ========================================================== */
  const tassel = {
    html() {
      const years = [];
      const thisYear = new Date().getFullYear();
      for (let y = thisYear; y <= thisYear + 3; y += 1) years.push(String(y));
      const current = store.at('tassel.year');
      return '<div class="cz-screen__intro"><p>Les quatre têtes de gland de la planche, chacune avec sa ' +
        'pastille de détail en gros plan.</p></div>' +
        '<div class="cz-group">' +
        field('Style du gland', optionCards('tassel.style', cat.TASSEL_STYLES, { wide: true })) +
        field('Année de promotion (breloque)', '<div class="cz-pills">' +
          '<button type="button" class="cz-pill' + (!current ? ' is-active' : '') + '"' +
          ' data-set="tassel.year" data-value="" aria-pressed="' + (!current) + '">Aucune</button>' +
          years.map((y) => '<button type="button" class="cz-pill' + (current === y ? ' is-active' : '') + '"' +
            ' data-set="tassel.year" data-value="' + y + '" aria-pressed="' + (current === y) + '">' + y +
            '</button>').join('') + '</div>',
          'La finition de la breloque est choisie avec l’atelier.') +
        '</div>';
    },
  };

  /* ==========================================================
     Étape 6 — Mesures
     ========================================================== */
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

  /* ==========================================================
     Étape 7 — Récapitulatif
     ========================================================== */
  const review = {
    lines() {
      const s = store.get();
      const labelOf = (list, id) => (cat.find(list, id) || {}).label || '—';
      return [
        {
          step: 'robe', title: 'La Robe', rows: [
            { label: 'Tissu', value: labelOf(cat.FABRICS, s.robe.fabric) },
            { label: 'Coupe des manches', value: labelOf(cat.SLEEVES, s.robe.sleeve) },
            { label: 'Col', value: labelOf(cat.COLLARS, s.robe.collar) },
            { label: 'Bordure', value: labelOf(cat.TRIM_STYLES, s.robe.trim) },
            { label: 'Broderie', value: s.robe.emb.enabled
              ? (s.robe.emb.text.trim() || '— sans texte —') + ' · ' + cat.FONTS[s.robe.emb.font].label +
                ' · ' + ((cat.EMB_POSITIONS.find((p) => p.id === s.robe.emb.position) || {}).label || '')
              : 'Aucune' },
            { label: 'Logos brodés', value: [s.robe.emb.uniLogoName, s.robe.emb.facLogoName]
              .filter(Boolean).join(' · ') || 'Aucun' },
          ],
        },
        {
          step: 'hood', title: 'La Capuche', rows: [
            { label: 'Modèle', value: labelOf(cat.HOOD_STYLES, s.hood.style) },
            { label: 'Broderie', value: s.hood.emb.trim() || 'Aucune' },
          ],
        },
        {
          step: 'cap', title: 'Le Mortier', rows: [
            { label: 'Forme', value: labelOf(cat.CAP_STYLES, s.cap.style) },
            { label: 'Matière', value: labelOf(cat.CAP_MATERIALS, s.cap.material) },
            { label: 'Broderie', value: s.cap.emb.trim() || 'Aucune' },
            { label: 'Logo', value: s.cap.logoName || 'Aucun' },
          ],
        },
        {
          step: 'tassel', title: 'Le Gland', rows: [
            { label: 'Style', value: labelOf(cat.TASSEL_STYLES, s.tassel.style) },
            { label: 'Année de promotion', value: s.tassel.year || 'Aucune' },
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
      const filesBlock = s.files.length
        ? '<ul class="cz-recap__files">' + s.files.map((f) =>
            '<li>' + (f.previewable
              ? '<img src="' + esc(f.dataUrl) + '" alt="" loading="lazy" decoding="async">'
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
            '<dd>' + esc(row.value) + '</dd></div>').join('') +
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
        '<p class="cz-help cz-help--workshop">Les couleurs de chaque pièce sont arrêtées avec vous par ' +
        'l’atelier avant la mise en fabrication.</p>' +
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
              ' placeholder="Couleurs souhaitées, contraintes de délai, précisions de broderie…">' +
              esc(store.at('client.notes')) + '</textarea></div>' +
          '</div>' +
        '</section>';
    },
  };

  /* ==========================================================
     Étape 8 — Envoi
     ========================================================== */
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
        'Notre équipe confirme les mesures, la broderie et les couleurs avant lancement de la fabrication.</p>' +
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
