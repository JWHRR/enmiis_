/* ============================================================
   ENMIIS — Configurateur : visionneuse d’aperçu.

   Deux modes :
   · « photo »  — tant qu’aucun fichier n’est envoyé : la
     photographie studio de la pièce en cours (robe, capuche,
     mortier, gland), avec pastilles de résumé ;
   · « design » — dès qu’un fichier est envoyé, il devient
     l’aperçu principal et le reste jusqu’à la fin du parcours
     (vignettes, zoom, déplacement, plein écran). Les choix faits
     sur les étapes suivantes s’affichent en vitrine par-dessus,
     sans jamais remplacer le design du client.

   Toutes les transitions durent 300 ms (fondu + légère échelle).

   Expose window.CZ.preview
   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ || (global.CZ = {});
  const cat = CZ.catalog;

  const el = {};
  let layers = [];
  let front = 0;
  let currentStep = 'upload';
  let selectedUpload = null;

  /* Caméra : zoom 1–3, déplacement quand zoomé. */
  let zoom = 1;
  let panX = 0;
  let panY = 0;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const label = (list, id) => (cat.find(list, id) || {}).label || '—';

  /* ---------- Contenu par étape ---------- */
  const PHOTOS = {
    robe:   { src: 'img/robe.webp',   piece: 'La robe' },
    hood:   { src: 'img/hood.webp',   piece: 'La capuche' },
    cap:    { src: 'img/cap.webp',    piece: 'Le mortier' },
    tassel: { src: 'img/tassel.webp', piece: 'Le gland' },
  };
  const STEP_SHOT = { robe: 'robe', hood: 'hood', cap: 'cap', tassel: 'tassel' };

  function chipList(state) {
    if (currentStep === 'robe') {
      const chips = [
        { label: 'Manches', value: label(cat.SLEEVES, state.robe.sleeve) },
        { label: 'Col', value: label(cat.COLLARS, state.robe.collar) },
        { label: 'Bordure', value: label(cat.TRIM_STYLES, state.robe.trim) },
      ];
      /* La broderie est obligatoire : la pastille apparaît dès la saisie. */
      const text = state.robe.emb.text.trim();
      if (text) chips.push({ label: 'Broderie', value: text });
      return chips;
    }
    if (currentStep === 'hood') {
      const chips = [{ label: 'Modèle', value: label(cat.HOOD_STYLES, state.hood.style) }];
      if (state.hood.emb.trim()) chips.push({ label: 'Broderie', value: state.hood.emb.trim() });
      return chips;
    }
    if (currentStep === 'cap') {
      const chips = [
        { label: 'Forme', value: label(cat.CAP_STYLES, state.cap.style) },
        { label: 'Matière', value: label(cat.CAP_MATERIALS, state.cap.material) },
      ];
      if (state.cap.logoName) chips.push({ label: 'Logo', value: state.cap.logoName });
      return chips;
    }
    if (currentStep === 'tassel') {
      const chips = [{ label: 'Style', value: label(cat.TASSEL_STYLES, state.tassel.style) }];
      if (state.tassel.year) chips.push({ label: 'Année', value: state.tassel.year });
      return chips;
    }
    /* Vue d’ensemble (fichiers, mesures, récapitulatif, envoi) */
    return [
      { label: 'Manches', value: label(cat.SLEEVES, state.robe.sleeve) },
      { label: 'Col', value: label(cat.COLLARS, state.robe.collar) },
      { label: 'Capuche', value: label(cat.HOOD_STYLES, state.hood.style) },
      { label: 'Mortier', value: label(cat.CAP_STYLES, state.cap.style) },
      { label: 'Gland', value: label(cat.TASSEL_STYLES, state.tassel.style) },
    ];
  }

  /* ---------- Mode courant ----------
     Un design envoyé reste l’aperçu principal jusqu’à la fin du
     parcours : le mode ne dépend plus de l’étape, seulement de la
     présence d’au moins un fichier. */
  function uploadsMode() {
    return CZ.store.get().files.length > 0;
  }

  function selectedFile() {
    const files = CZ.store.get().files;
    if (!files.length) return null;
    return files.find((f) => f.id === selectedUpload) || files[files.length - 1];
  }

  /* ---------- Couches d’image (fondu croisé 300 ms) ---------- */
  function setImage(src) {
    const visible = layers[front];
    const hidden = layers[1 - front];
    if (visible.getAttribute('src') === src) return;
    hidden.onload = () => {
      visible.classList.remove('is-on');
      hidden.classList.add('is-on');
      front = 1 - front;
    };
    hidden.setAttribute('src', src);
  }

  /* ---------- Caméra ---------- */
  function applyCamera() {
    /* Le déplacement est borné pour que l’image ne quitte jamais le cadre. */
    const bound = (zoom - 1) * 50;
    panX = clamp(panX, -bound, bound);
    panY = clamp(panY, -bound, bound);
    el.view.style.transform =
      'translate(' + panX.toFixed(1) + '%, ' + panY.toFixed(1) + '%) scale(' + zoom.toFixed(3) + ')';
    el.frame.classList.toggle('is-zoomed', zoom > 1.02);
  }

  function setZoom(value, keepPan) {
    zoom = clamp(value, 1, 3);
    if (!keepPan && zoom <= 1.02) { panX = 0; panY = 0; }
    applyCamera();
  }

  function resetCamera() {
    zoom = 1; panX = 0; panY = 0;
    applyCamera();
  }

  /* ---------- Rendu ---------- */
  function render() {
    const state = CZ.store.get();

    if (uploadsMode()) {
      const file = selectedFile();
      el.frame.classList.add('is-doc');
      if (file.previewable) {
        el.doc.hidden = true;
        setImage(file.dataUrl);
      } else {
        /* Formats sans rendu navigateur : tuile d’extension à la place. */
        el.doc.hidden = false;
        el.doc.textContent = file.label;
      }
      el.piece.textContent = 'Votre design';
      el.style.textContent = file.name;
    } else {
      const shot = PHOTOS[STEP_SHOT[currentStep] || 'robe'];
      el.frame.classList.remove('is-doc');
      el.doc.hidden = true;
      setImage(shot.src);
      el.piece.textContent = STEP_SHOT[currentStep] ? shot.piece : 'Votre tenue';
      el.style.textContent = STEP_SHOT[currentStep]
        ? ''
        : label(cat.SLEEVES, state.robe.sleeve) + ' · ' + label(cat.COLLARS, state.robe.collar);
    }

    el.spec.innerHTML = chipList(state).map((chip) =>
      '<span class="cz-chip">' +
        '<span class="cz-chip__label">' + chip.label + '</span>' +
        '<span class="cz-chip__value">' + chip.value + '</span>' +
      '</span>').join('');

    renderThumbs();
  }

  function renderThumbs() {
    if (!uploadsMode()) {
      el.thumbs.innerHTML = '';
      el.thumbs.hidden = true;
      return;
    }
    const files = CZ.store.get().files;
    const active = selectedFile();
    el.thumbs.hidden = false;
    el.thumbs.innerHTML = files.map((file) =>
      '<span class="cz-thumb' + (file.id === active.id ? ' is-active' : '') + '" data-thumb="' + file.id + '">' +
        '<button type="button" class="cz-thumb__pick" data-thumb-pick="' + file.id + '"' +
        ' aria-label="Afficher ' + file.name.replace(/"/g, '&quot;') + '"' +
        ' aria-pressed="' + (file.id === active.id) + '">' +
        (file.previewable
          ? '<img src="' + file.dataUrl + '" alt="" loading="lazy" decoding="async">'
          : '<span class="cz-thumb__ext">' + file.label + '</span>') +
        '</button>' +
        '<span class="cz-thumb__tools">' +
          '<button type="button" data-thumb-replace="' + file.id + '" aria-label="Remplacer ce fichier">' +
            '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><polyline points="20 3 20 8 15 8"/></svg>' +
          '</button>' +
          '<button type="button" data-thumb-remove="' + file.id + '" aria-label="Supprimer ce fichier">' +
            '<svg viewBox="0 0 24 24"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
          '</button>' +
        '</span>' +
      '</span>').join('');
  }

  /* ---------- Vitrine du dernier modèle choisi ---------- */
  let spotTimer = null;
  function spotlight(svgHtml, name) {
    if (!svgHtml) return;
    el.spot.innerHTML = '<span class="cz-spot__art">' + svgHtml + '</span>' +
      '<span class="cz-spot__name">' + name + '</span>';
    el.spot.classList.remove('is-in');
    /* réamorce la transition d’apparition */
    void el.spot.offsetWidth;
    el.spot.classList.add('is-in');
    el.spot.hidden = false;
    clearTimeout(spotTimer);
    spotTimer = setTimeout(() => { el.spot.classList.remove('is-in'); }, 2600);
  }

  /* ---------- Navigation d’étape ---------- */
  function focus(stepId) {
    currentStep = stepId;
    resetCamera();
    el.spot.hidden = true;
    render();
    preloadNext(stepId);
  }

  /* Précharge la photo de l’étape suivante pour une bascule sans attente. */
  const preloaded = {};
  function preloadNext(stepId) {
    const order = cat.STEPS.map((s) => s.id);
    const next = order[order.indexOf(stepId) + 1];
    const shot = PHOTOS[STEP_SHOT[next]];
    if (shot && !preloaded[shot.src]) {
      preloaded[shot.src] = true;
      const img = new Image();
      img.decoding = 'async';
      img.src = shot.src;
    }
  }

  function selectUpload(id) {
    selectedUpload = id;
    resetCamera();
    render();
  }

  /* Vue courante, pour le plein écran. */
  function current() {
    if (uploadsMode()) {
      const file = selectedFile();
      return file.previewable
        ? { src: file.dataUrl, title: file.name }
        : { src: '', title: file.name };
    }
    const shot = PHOTOS[STEP_SHOT[currentStep] || 'robe'];
    return { src: shot.src, title: shot.piece };
  }

  /* ---------- Interactions de la visionneuse ---------- */
  function bindViewer() {
    el.frame.addEventListener('wheel', (event) => {
      event.preventDefault();
      setZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1), true);
    }, { passive: false });

    let dragging = false;
    let sx = 0; let sy = 0; let px = 0; let py = 0;
    el.frame.addEventListener('pointerdown', (event) => {
      if (zoom <= 1.02) return;
      dragging = true;
      sx = event.clientX; sy = event.clientY; px = panX; py = panY;
      el.frame.setPointerCapture(event.pointerId);
      el.frame.classList.add('is-panning');
    });
    el.frame.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const rect = el.frame.getBoundingClientRect();
      panX = px + ((event.clientX - sx) / rect.width) * 100;
      panY = py + ((event.clientY - sy) / rect.height) * 100;
      applyCamera();
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      el.frame.classList.remove('is-panning');
      if (el.frame.hasPointerCapture(event.pointerId)) el.frame.releasePointerCapture(event.pointerId);
    };
    el.frame.addEventListener('pointerup', stop);
    el.frame.addEventListener('pointercancel', stop);
    el.frame.addEventListener('dblclick', resetCamera);

    /* Accessible au clavier : flèches pour se déplacer, +/− pour zoomer. */
    el.frame.setAttribute('tabindex', '0');
    el.frame.setAttribute('role', 'img');
    el.frame.setAttribute('aria-label', 'Aperçu — molette ou boutons pour zoomer, double-clic pour réinitialiser');
    el.frame.addEventListener('keydown', (event) => {
      const keys = {
        '+': () => setZoom(zoom * 1.2),
        '=': () => setZoom(zoom * 1.2),
        '-': () => setZoom(zoom * 0.85),
        ArrowLeft: () => { panX += 8; applyCamera(); },
        ArrowRight: () => { panX -= 8; applyCamera(); },
        ArrowUp: () => { panY += 8; applyCamera(); },
        ArrowDown: () => { panY -= 8; applyCamera(); },
        Home: resetCamera,
      };
      if (keys[event.key]) { event.preventDefault(); keys[event.key](); }
    });

    el.zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
    el.zoomOut.addEventListener('click', () => setZoom(zoom * 0.8));
  }

  function init() {
    el.frame = document.getElementById('czShotFrame');
    el.view = document.getElementById('czShotView');
    el.doc = document.getElementById('czShotDoc');
    el.spec = document.getElementById('czSpec');
    el.spot = document.getElementById('czSpot');
    el.piece = document.getElementById('czShotPiece');
    el.style = document.getElementById('czShotStyle');
    el.thumbs = document.getElementById('czThumbs');
    el.zoomIn = document.getElementById('czZoomIn');
    el.zoomOut = document.getElementById('czZoomOut');
    layers = [document.getElementById('czShotImg'), document.getElementById('czShotNext')];
    layers[0].classList.add('is-on');
    bindViewer();
    render();
  }

  CZ.preview = { init, render, focus, current, selectUpload, spotlight };
})(window);


/* ============================================================
   APERÇU 3D / SVG — DÉSACTIVÉ
   ------------------------------------------------------------
   Moteur vectoriel en couches remplacé par l'aperçu photo ci-dessus :
   rotation à la souris, zoom, pincement, ombre portée variable,
   flottement et balancement du gland. Le balisage SVG correspondant est
   commenté dans customizer.html.

   Conservé ligne à ligne (préfixe //) plutôt qu'en commentaire de bloc,
   car le code contient lui-même des commentaires de bloc.
   ============================================================ */

// /* ============================================================
//    ENMIIS — Configurateur : aperçu en direct.
//    Rendu SVG multi-couches (robe · capuche · mortier · gland),
//    rotation à la souris, zoom, ombre douce, flottement,
//    balancement naturel du gland.
//    Expose window.CZ.preview
//    ============================================================ */
// (function (global) {
//   'use strict';
//
//   const CZ = global.CZ || (global.CZ = {});
//   const cat = CZ.catalog;
//
//   const reduceMotion = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
//
//   const el = {};
//   let yaw = 0;            /* rotation horizontale en degrés, −180 → 180 */
//   let zoom = 1;           /* facteur d’échelle, 0.75 → 2.4 */
//   let spinning = false;
//   let spinFrame = 0;
//   let swingBoost = 0;     /* impulsion donnée au gland pendant la rotation */
//
//   const ZOOM_MIN = 0.75;
//   const ZOOM_MAX = 2.4;
//
//   const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
//
//   /* Normalise un angle dans l’intervalle [−180, 180]. */
//   function normalize(angle) {
//     let a = angle % 360;
//     if (a > 180) a -= 360;
//     if (a < -180) a += 360;
//     return a;
//   }
//
//   function isBack() { return Math.abs(yaw) > 90; }
//
//   function angleLabel() {
//     const a = Math.abs(yaw);
//     if (a < 25) return 'Face';
//     if (a < 70) return 'Trois-quarts';
//     if (a < 110) return 'Profil';
//     if (a < 155) return 'Trois-quarts dos';
//     return 'Dos';
//   }
//
//   /* ----------------------------------------------------------
//      Générateurs de géométrie
//      ---------------------------------------------------------- */
//
//   /* Capuche / étole — les cinq modèles de la planche « CAPE ». */
//   function hoodMarkup(style) {
//     const panels = {
//       /* Pans droits à extrémité carrée (modèle 1) */
//       'etole-droite':
//         '<path class="cz-h-outer" d="M170 100 C 186 122 214 122 230 100 L 236 118 C 216 140 184 140 164 118 Z"/>' +
//         '<path class="cz-h-outer" d="M166 116 L 158 344 L 196 344 L 196 132 Z"/>' +
//         '<path class="cz-h-outer" d="M234 116 L 242 344 L 204 344 L 204 132 Z"/>' +
//         '<path class="cz-h-inner" d="M172 124 L 166 336 L 190 336 L 190 136 Z"/>' +
//         '<path class="cz-h-inner" d="M228 124 L 234 336 L 210 336 L 210 136 Z"/>' +
//         '<path class="cz-h-border" d="M158 336 L 196 336 L 196 344 L 158 344 Z"/>' +
//         '<path class="cz-h-border" d="M204 336 L 242 336 L 242 344 L 204 344 Z"/>',
//       /* Pans taillés en pointe (modèle 2) */
//       'etole-v':
//         '<path class="cz-h-outer" d="M170 100 C 186 122 214 122 230 100 L 236 118 C 216 140 184 140 164 118 Z"/>' +
//         '<path class="cz-h-outer" d="M166 116 L 160 328 L 177 352 L 196 328 L 196 132 Z"/>' +
//         '<path class="cz-h-outer" d="M234 116 L 240 328 L 223 352 L 204 328 L 204 132 Z"/>' +
//         '<path class="cz-h-inner" d="M172 124 L 168 322 L 177 340 L 190 322 L 190 136 Z"/>' +
//         '<path class="cz-h-inner" d="M228 124 L 232 322 L 223 340 L 210 322 L 210 136 Z"/>' +
//         '<path class="cz-h-border" d="M160 322 L 196 322 L 196 330 L 160 330 Z"/>' +
//         '<path class="cz-h-border" d="M204 322 L 240 322 L 240 330 L 204 330 Z"/>',
//       /* Extrémités arrondies (modèle 3) */
//       'etole-arrondie':
//         '<path class="cz-h-outer" d="M170 100 C 186 122 214 122 230 100 L 236 118 C 216 140 184 140 164 118 Z"/>' +
//         '<path class="cz-h-outer" d="M166 116 L 160 320 C 160 348 196 348 196 320 L 196 132 Z"/>' +
//         '<path class="cz-h-outer" d="M234 116 L 240 320 C 240 348 204 348 204 320 L 204 132 Z"/>' +
//         '<path class="cz-h-inner" d="M172 124 L 168 318 C 168 338 190 338 190 318 L 190 136 Z"/>' +
//         '<path class="cz-h-inner" d="M228 124 L 232 318 C 232 338 210 338 210 318 L 210 136 Z"/>' +
//         '<path class="cz-h-border" d="M160 316 C 160 344 196 344 196 316 L 196 324 C 196 352 160 352 160 324 Z"/>' +
//         '<path class="cz-h-border" d="M204 316 C 204 344 240 344 240 316 L 240 324 C 240 352 204 352 204 324 Z"/>',
//       /* Capuchon américain : V doublé satin */
//       'capuche-am':
//         '<path class="cz-h-outer" d="M156 98 C 180 126 220 126 244 98 C 256 128 258 176 248 224 L 200 316 L 152 224 C 142 176 144 128 156 98 Z"/>' +
//         '<path class="cz-h-inner" d="M172 112 C 188 132 212 132 228 112 C 238 140 240 178 232 216 L 200 284 L 168 216 C 160 178 162 140 172 112 Z"/>' +
//         '<path class="cz-h-border" d="M156 98 C 180 126 220 126 244 98 L 248 114 C 220 142 180 142 152 114 Z"/>' +
//         '<path class="cz-h-border" d="M152 224 L 200 316 L 248 224 L 240 220 L 200 296 L 160 220 Z"/>',
//       /* Capuchon européen : bord large rabattu */
//       'capuche-eu':
//         '<path class="cz-h-outer" d="M154 96 C 180 128 220 128 246 96 C 262 136 264 200 252 262 C 240 300 160 300 148 262 C 136 200 138 136 154 96 Z"/>' +
//         '<path class="cz-h-inner" d="M170 114 C 188 138 212 138 230 114 C 244 148 246 200 236 250 C 228 278 172 278 164 250 C 154 200 156 148 170 114 Z"/>' +
//         '<path class="cz-h-border" d="M148 262 C 160 300 240 300 252 262 L 246 288 C 232 320 168 320 154 288 Z"/>' +
//         '<path class="cz-h-border" d="M154 96 C 180 128 220 128 246 96 L 250 112 C 220 146 180 146 150 112 Z"/>',
//     };
//     return panels[style] || panels['etole-droite'];
//   }
//
//   /* Mortier — plateau, calotte et bouton (planche coiffe). */
//   function capMarkup(style) {
//     const board = {
//       classique: 'M200 12 L 326 58 L 200 104 L 74 58 Z',
//       incline:   'M188 8 L 328 62 L 212 106 L 72 52 Z',
//       plat:      'M200 20 L 318 58 L 200 96 L 82 58 Z',
//     }[style] || 'M200 12 L 326 58 L 200 104 L 74 58 Z';
//
//     /* La calotte est une bande dont le bord supérieur épouse exactement le
//        V inférieur du plateau : elle se glisse dessous sans laisser de jour,
//        et son bord inférieur descend rejoindre l’épaule de la robe. */
//     const crown = {
//       classique: 'M150 84 L 200 104 L 250 84 L 250 108 C 250 138 150 138 150 108 Z',
//       incline:   'M144 78 L 212 106 L 266 85 L 264 113 C 266 143 146 143 144 106 Z',
//       plat:      'M152 78 L 200 96 L 248 78 L 248 100 C 248 126 152 126 152 100 Z',
//     }[style] || 'M150 84 L 200 104 L 250 84 L 250 108 C 250 138 150 138 150 108 Z';
//
//     return (
//       '<path class="cz-c-crown" d="' + crown + '"/>' +
//       '<path class="cz-c-board" d="' + board + '"/>' +
//       '<path class="cz-c-shade" d="' + board + '" fill="#000" opacity="0.09"/>' +
//       '<path class="cz-c-seam" d="M200 12 L 200 104 M74 58 L 326 58"/>'
//     );
//   }
//
//   /* Point d’ancrage du gland selon la forme du mortier. */
//   const TASSEL_ANCHOR = {
//     classique: { x: 200, y: 58, drop: 46 },
//     incline:   { x: 212, y: 60, drop: 40 },
//     plat:      { x: 200, y: 58, drop: 52 },
//   };
//
//   /* Gland — cordon, tête et franges (planche tassel). */
//   function tasselMarkup(style, capStyle, buttonHex) {
//     const anchor = TASSEL_ANCHOR[capStyle] || TASSEL_ANCHOR.classique;
//     const side = (cat.find(cat.CAP_STYLES, capStyle) || {}).tassel || 'right';
//     const dx = side === 'left' ? -66 : side === 'front' ? -10 : 66;
//     const hx = anchor.x + dx;
//     const hy = anchor.y + anchor.drop;
//
//     /* Tête du gland, propre à chaque modèle */
//     const heads = {
//       noeud:
//         '<ellipse class="cz-t-head" cx="0" cy="6" rx="9" ry="8"/>' +
//         '<path class="cz-t-head" d="M-11 14 C -4 20 4 20 11 14 C 8 22 -8 22 -11 14 Z"/>' +
//         '<circle class="cz-t-knot" cx="0" cy="16" r="6"/>',
//       cannele:
//         '<path class="cz-t-head" d="M-8 0 L 8 0 L 10 18 L -10 18 Z"/>' +
//         '<path class="cz-t-knot" d="M-10 8 L 10 8 M-10 13 L 10 13 M-10 18 L 10 18"/>',
//       lisse:
//         '<path class="cz-t-head" d="M-7 0 C -3 -4 3 -4 7 0 L 9 16 L -9 16 Z"/>',
//       fin:
//         '<path class="cz-t-head" d="M-5 0 C -2 -3 2 -3 5 0 L 6 13 L -6 13 Z"/>',
//     };
//     const head = heads[style] || heads.noeud;
//
//     const slim = style === 'fin';
//     const width = slim ? 8 : 13;
//     const length = slim ? 52 : 66;
//     const strandCount = slim ? 5 : 9;
//
//     let strands = '';
//     for (let i = 0; i < strandCount; i += 1) {
//       const t = strandCount === 1 ? 0.5 : i / (strandCount - 1);
//       const x = -width + t * width * 2;
//       const bend = (t - 0.5) * 6;
//       strands += '<path class="cz-t-strand" d="M' + x.toFixed(1) + ' 18 C ' +
//         (x + bend).toFixed(1) + ' ' + (18 + length * 0.5) + ' ' +
//         (x + bend * 1.4).toFixed(1) + ' ' + (18 + length * 0.8) + ' ' +
//         (x + bend * 1.6).toFixed(1) + ' ' + (18 + length) + '"/>';
//     }
//     const skirt = '<path class="cz-t-skirt" d="M-' + width + ' 18 L ' + width + ' 18 L ' +
//       (width + 3) + ' ' + (18 + length) + ' L -' + (width + 3) + ' ' + (18 + length) + ' Z"/>';
//
//     /* Cordon reliant le bouton du mortier à la tête du gland */
//     const cord = '<path class="cz-t-cord" d="M' + anchor.x + ' ' + anchor.y +
//       ' Q ' + (anchor.x + dx * 0.55) + ' ' + (anchor.y + 6) + ' ' + hx + ' ' + hy + '"/>';
//
//     return (
//       '<g class="cz-t-swing" style="transform-origin:' + anchor.x + 'px ' + anchor.y + 'px">' +
//         cord +
//         '<g transform="translate(' + hx + ' ' + hy + ')">' + skirt + strands + head + '</g>' +
//       '</g>' +
//       '<circle class="cz-c-button" cx="' + anchor.x + '" cy="' + anchor.y + '" r="6.5" fill="' + buttonHex + '"/>'
//     );
//   }
//
//   /* Breloques suspendues au gland (année, faculté). */
//   function charmMarkup(state) {
//     const anchor = TASSEL_ANCHOR[state.cap.style] || TASSEL_ANCHOR.classique;
//     const side = (cat.find(cat.CAP_STYLES, state.cap.style) || {}).tassel || 'right';
//     const dx = side === 'left' ? -66 : side === 'front' ? -10 : 66;
//     const baseX = anchor.x + dx;
//     const baseY = anchor.y + anchor.drop + (state.tassel.style === 'fin' ? 84 : 98);
//
//     let out = '';
//     const yearHex = cat.hexOf(cat.CHARM_FINISHES, state.tassel.yearCharm, '');
//     if (state.tassel.year && state.tassel.yearCharm !== 'aucun' && yearHex) {
//       out += '<g class="cz-t-charm" transform="translate(' + (baseX - 13) + ' ' + baseY + ')">' +
//         '<circle r="11" fill="' + yearHex + '"/>' +
//         '<text y="4" text-anchor="middle" font-size="9" font-family="Inter, sans-serif" fill="#17171A">' +
//           String(state.tassel.year).slice(-4) + '</text></g>';
//     }
//     const facHex = cat.hexOf(cat.CHARM_FINISHES, state.tassel.facultyCharm, '');
//     if (state.tassel.facultyCharm !== 'aucun' && facHex) {
//       const faculty = cat.find(cat.FACULTY_COLORS, state.hood.faculty);
//       out += '<g class="cz-t-charm" transform="translate(' + (baseX + 13) + ' ' + baseY + ')">' +
//         '<circle r="11" fill="' + facHex + '"/>' +
//         '<circle r="5" fill="' + faculty.hex + '"/></g>';
//     }
//     return out;
//   }
//
//   /* ----------------------------------------------------------
//      Application de l’état au SVG
//      ---------------------------------------------------------- */
//
//   function paint(selector, hex) {
//     el.svg.querySelectorAll(selector).forEach((node) => { node.style.fill = hex; });
//   }
//
//   function renderEmbroidery(state) {
//     const emb = state.robe.emb;
//     const back = isBack();
//     const text = el.embText;
//     const uni = el.logoUni;
//     const fac = el.logoFac;
//
//     const position = cat.EMB_POSITIONS.find((p) => p.id === emb.position) || cat.EMB_POSITIONS[0];
//     const visibleSide = position.id === 'back' ? back : !back;
//     const show = emb.enabled && visibleSide;
//
//     if (show && emb.text.trim()) {
//       const thread = cat.hexOf(cat.THREAD_COLORS, emb.thread);
//       text.textContent = emb.text.trim();
//       text.setAttribute('x', position.x);
//       text.setAttribute('y', position.y);
//       text.setAttribute('fill', thread);
//       text.style.fontFamily = cat.FONTS[emb.font].stack;
//       text.style.fontSize = emb.font === 'script' ? '19px' : '13px';
//       text.style.display = '';
//     } else {
//       text.style.display = 'none';
//     }
//
//     if (show && emb.uniLogo) {
//       uni.setAttribute('href', emb.uniLogo);
//       uni.setAttribute('x', position.x - 20);
//       uni.setAttribute('y', position.y - 56);
//       uni.style.display = '';
//     } else {
//       uni.style.display = 'none';
//     }
//
//     if (show && emb.facLogo) {
//       fac.setAttribute('href', emb.facLogo);
//       fac.setAttribute('x', position.x - 17);
//       fac.setAttribute('y', position.y + 12);
//       fac.style.display = '';
//     } else {
//       fac.style.display = 'none';
//     }
//   }
//
//   function render() {
//     const state = CZ.store.get();
//     const back = isBack();
//
//     /* --- Robe --- */
//     const mainHex = cat.hexOf(cat.MAIN_COLORS, state.robe.main);
//     const secondaryHex = cat.hexOf(cat.TRIM_COLORS, state.robe.secondary);
//     const trimHex = cat.hexOf(cat.TRIM_COLORS, state.robe.trimColor);
//     const sleeveHex = state.robe.sleeveColor === 'match'
//       ? mainHex
//       : cat.hexOf(cat.MAIN_COLORS, state.robe.sleeveColor);
//
//     paint('#czGown .cz-p-main', mainHex);
//     paint('#czGown .cz-p-sleeve', sleeveHex);
//     paint('#czGown .cz-p-accent', secondaryHex);
//     paint('#czGown .cz-p-trim', trimHex);
//     paint('#czGown .cz-p-collar', trimHex);
//
//     const fabric = cat.find(cat.FABRICS, state.robe.fabric);
//     el.svg.style.setProperty('--cz-sheen', String(fabric.sheen));
//
//     /* Bordure et col disparaissent de dos, comme sur un vêtement réel. */
//     el.trim.style.display = (state.robe.trim === 'aucun' || back) ? 'none' : '';
//     el.collar.style.display = (state.robe.collar === 'sans' || back) ? 'none' : '';
//     /* Le parement simple ne conserve qu’une bande. */
//     Array.from(el.trim.children).forEach((node, index) => {
//       node.style.display = (state.robe.trim === 'simple' && index === 1) ? 'none' : '';
//     });
//     el.svg.dataset.trim = state.robe.trim;
//     el.svg.dataset.sleeve = state.robe.sleeve;
//
//     /* --- Capuche --- */
//     el.hood.innerHTML = hoodMarkup(state.hood.style);
//     paint('#czHood .cz-h-outer', cat.hexOf(cat.MAIN_COLORS, state.hood.outer));
//     paint('#czHood .cz-h-inner', cat.hexOf(cat.FACULTY_COLORS, state.hood.faculty,
//       cat.hexOf(cat.TRIM_COLORS, state.hood.inner)));
//     paint('#czHood .cz-h-border', cat.hexOf(cat.TRIM_COLORS, state.hood.border));
//
//     /* --- Mortier & gland --- */
//     el.cap.innerHTML = capMarkup(state.cap.style);
//     paint('#czCap .cz-c-board', cat.hexOf(cat.MAIN_COLORS, state.cap.color));
//     paint('#czCap .cz-c-crown', cat.hexOf(cat.MAIN_COLORS, state.cap.color));
//     el.cap.dataset.material = state.cap.material;
//
//     const buttonHex = cat.hexOf(cat.TRIM_COLORS, state.cap.button);
//     el.tassel.innerHTML = tasselMarkup(state.tassel.style, state.cap.style, buttonHex) + charmMarkup(state);
//     const tasselHex = cat.hexOf(cat.TASSEL_COLORS, state.tassel.color);
//     paint('#czTassel .cz-t-head', tasselHex);
//     paint('#czTassel .cz-t-skirt', tasselHex);
//     paint('#czTassel .cz-t-knot', tasselHex);
//     el.svg.querySelectorAll('#czTassel .cz-t-strand, #czTassel .cz-t-cord, #czTassel .cz-t-knot')
//       .forEach((node) => { node.style.stroke = tasselHex; });
//
//     /* --- Broderies --- */
//     renderEmbroidery(state);
//
//     /* --- Repères de dos --- */
//     el.folds.style.opacity = back ? '0.9' : '0.45';
//
//     applyTransform();
//   }
//
//   /* ----------------------------------------------------------
//      Caméra : rotation, zoom, ombre
//      ---------------------------------------------------------- */
//   function applyTransform() {
//     const depth = Math.abs(Math.sin((yaw * Math.PI) / 180));
//     el.float.style.transform = 'rotateY(' + yaw.toFixed(2) + 'deg) scale(' + zoom.toFixed(3) + ')';
//     /* L’ombre se resserre quand le sujet pivote de profil. */
//     el.ground.setAttribute('rx', (118 * (1 - depth * 0.45)).toFixed(1));
//     el.ground.setAttribute('opacity', (1 - depth * 0.3).toFixed(2));
//     el.svg.dataset.face = isBack() ? 'back' : 'front';
//     el.angle.textContent = angleLabel();
//   }
//
//   function setYaw(value, options) {
//     const previous = yaw;
//     yaw = normalize(value);
//     const delta = Math.abs(normalize(yaw - previous));
//     swingBoost = clamp(swingBoost + delta * 0.04, 0, 1);
//     if ((previous > 90) !== (yaw > 90) || (previous < -90) !== (yaw < -90)) render();
//     else applyTransform();
//     if (options && options.stopSpin) setSpin(false);
//   }
//
//   function setZoom(value) {
//     zoom = clamp(value, ZOOM_MIN, ZOOM_MAX);
//     applyTransform();
//   }
//
//   function setSpin(on) {
//     spinning = on && !reduceMotion;
//     el.spin.setAttribute('aria-pressed', String(spinning));
//     el.spin.classList.toggle('is-active', spinning);
//     if (spinning) spinFrame = requestAnimationFrame(spinTick);
//     else cancelAnimationFrame(spinFrame);
//   }
//
//   let lastTick = 0;
//   function spinTick(now) {
//     if (!spinning) return;
//     const dt = lastTick ? Math.min(now - lastTick, 64) : 16;
//     lastTick = now;
//     setYaw(yaw + dt * 0.022);
//     spinFrame = requestAnimationFrame(spinTick);
//   }
//
//   /* Amortissement de l’impulsion du gland. */
//   function decayTick() {
//     if (swingBoost > 0.001) {
//       swingBoost *= 0.94;
//       el.svg.style.setProperty('--cz-swing', (1 + swingBoost * 3).toFixed(3));
//     } else if (swingBoost !== 0) {
//       swingBoost = 0;
//       el.svg.style.setProperty('--cz-swing', '1');
//     }
//     requestAnimationFrame(decayTick);
//   }
//
//   function recenter() {
//     setSpin(false);
//     yaw = 0;
//     zoom = 1;
//     render();
//   }
//
//   /* ----------------------------------------------------------
//      Interactions pointeur
//      ---------------------------------------------------------- */
//   function bindPointer() {
//     let dragging = false;
//     let startX = 0;
//     let startYaw = 0;
//     let moved = false;
//
//     el.stage.addEventListener('pointerdown', (event) => {
//       if (event.target.closest('.cz-stage__tools')) return;
//       dragging = true;
//       moved = false;
//       startX = event.clientX;
//       startYaw = yaw;
//       el.stage.setPointerCapture(event.pointerId);
//       el.stage.classList.add('is-dragging');
//       setSpin(false);
//     });
//
//     el.stage.addEventListener('pointermove', (event) => {
//       if (!dragging) return;
//       const dx = event.clientX - startX;
//       if (Math.abs(dx) > 3) moved = true;
//       setYaw(startYaw + dx * 0.55);
//     });
//
//     const endDrag = (event) => {
//       if (!dragging) return;
//       dragging = false;
//       el.stage.classList.remove('is-dragging');
//       if (el.stage.hasPointerCapture(event.pointerId)) el.stage.releasePointerCapture(event.pointerId);
//       if (!moved) el.hint.classList.add('is-dim');
//     };
//     el.stage.addEventListener('pointerup', endDrag);
//     el.stage.addEventListener('pointercancel', endDrag);
//
//     el.stage.addEventListener('wheel', (event) => {
//       event.preventDefault();
//       setZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
//     }, { passive: false });
//
//     /* Pincement à deux doigts sur mobile */
//     let pinchStart = 0;
//     let pinchZoom = 1;
//     el.stage.addEventListener('touchstart', (event) => {
//       if (event.touches.length !== 2) return;
//       pinchStart = Math.hypot(
//         event.touches[0].clientX - event.touches[1].clientX,
//         event.touches[0].clientY - event.touches[1].clientY,
//       );
//       pinchZoom = zoom;
//     }, { passive: true });
//
//     el.stage.addEventListener('touchmove', (event) => {
//       if (event.touches.length !== 2 || !pinchStart) return;
//       event.preventDefault();
//       const distance = Math.hypot(
//         event.touches[0].clientX - event.touches[1].clientX,
//         event.touches[0].clientY - event.touches[1].clientY,
//       );
//       setZoom(pinchZoom * (distance / pinchStart));
//     }, { passive: false });
//
//     el.stage.addEventListener('touchend', () => { pinchStart = 0; });
//
//     /* Clavier : la scène est focalisable pour rester accessible. */
//     el.stage.setAttribute('tabindex', '0');
//     el.stage.addEventListener('keydown', (event) => {
//       const keys = {
//         ArrowLeft: () => setYaw(yaw - 15, { stopSpin: true }),
//         ArrowRight: () => setYaw(yaw + 15, { stopSpin: true }),
//         ArrowUp: () => setZoom(zoom * 1.12),
//         ArrowDown: () => setZoom(zoom * 0.89),
//         Home: recenter,
//       };
//       if (keys[event.key]) {
//         event.preventDefault();
//         keys[event.key]();
//       }
//     });
//
//     el.zoomIn.addEventListener('click', () => setZoom(zoom * 1.18));
//     el.zoomOut.addEventListener('click', () => setZoom(zoom * 0.85));
//     el.spin.addEventListener('click', () => setSpin(!spinning));
//     el.recenter.addEventListener('click', recenter);
//   }
//
//   /* Met en avant une pièce pendant l’étape correspondante. */
//   const FOCUS = {
//     robe:   { yaw: 0,   zoom: 1.05, dim: ['czCap', 'czTassel'] },
//     hood:   { yaw: -22, zoom: 1.25, dim: ['czCap', 'czTassel'] },
//     cap:    { yaw: 12,  zoom: 1.9,  dim: ['czGown', 'czHood'] },
//     tassel: { yaw: 22,  zoom: 2.0,  dim: ['czGown', 'czHood'] },
//   };
//
//   function focus(stepId) {
//     const preset = FOCUS[stepId];
//     ['czGown', 'czHood', 'czCap', 'czTassel'].forEach((id) => {
//       const node = el.svg.querySelector('#' + id);
//       if (node) node.classList.toggle('is-dimmed', Boolean(preset && preset.dim.includes(id)));
//     });
//     setSpin(false);
//     /* Hors des étapes de tenue, la silhouette revient au cadrage complet. */
//     yaw = preset ? preset.yaw : 0;
//     zoom = preset ? preset.zoom : 1;
//     /* Le mortier et le gland se cadrent en haut du plan. */
//     el.scene.style.setProperty('--cz-pan', (stepId === 'cap' || stepId === 'tassel') ? '30%' : '0%');
//     render();
//   }
//
//   function init() {
//     el.stage = document.getElementById('czStage');
//     el.scene = document.getElementById('czScene');
//     el.float = document.getElementById('czFloat');
//     el.svg = document.getElementById('czSvg');
//     el.hood = document.getElementById('czHood');
//     el.cap = document.getElementById('czCap');
//     el.tassel = document.getElementById('czTassel');
//     el.trim = document.getElementById('czTrim');
//     el.collar = document.getElementById('czCollar');
//     el.folds = document.getElementById('czFolds');
//     el.ground = document.getElementById('czGround');
//     el.embText = document.getElementById('czEmbText');
//     el.logoUni = document.getElementById('czLogoUni');
//     el.logoFac = document.getElementById('czLogoFac');
//     el.angle = document.getElementById('czAngle');
//     el.hint = document.getElementById('czHint');
//     el.zoomIn = document.getElementById('czZoomIn');
//     el.zoomOut = document.getElementById('czZoomOut');
//     el.spin = document.getElementById('czSpin');
//     el.recenter = document.getElementById('czRecenter');
//
//     if (reduceMotion) el.svg.classList.add('cz-no-motion');
//
//     bindPointer();
//     render();
//     if (!reduceMotion) requestAnimationFrame(decayTick);
//   }
//
//   CZ.preview = { init, render, focus, recenter };
// })(window);
