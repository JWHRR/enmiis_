/* ============================================================
   ENMIIS — Configurateur : contrôleur de l’assistant.
   Navigation entre les huit étapes, branchement des écrans,
   téléversement des fichiers, guides de mesure et envoi.
   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ;
  const cat = CZ.catalog;
  const store = CZ.store;
  const steps = CZ.steps;
  const preview = CZ.preview;
  const toast = global.enmiisToast || function () {};
  const esc = steps.esc;

  const $ = (selector) => document.querySelector(selector);
  const screensRoot = $('#czScreens');
  const railRoot = $('#czRail');

  let current = 0;
  let fileSeq = 0;
  let replacing = null;   /* identifiant du fichier en cours de remplacement */

  const stepAt = (index) => cat.STEPS[index];

  /* ----------------------------------------------------------
     Rendu de l’écran courant
     ---------------------------------------------------------- */
  const RENDERERS = {
    upload: () => steps.upload.html(),
    robe: () => steps.robe.html(),
    hood: () => steps.hood.html(),
    cap: () => steps.cap.html(),
    tassel: () => steps.tassel.html(),
    measure: () => steps.measure.html(),
    review: () => steps.review.html(),
    submit: () => steps.submit.html(),
  };

  function renderScreen() {
    const def = stepAt(current);
    $('#czPhase').textContent = def.phase;
    $('#czStepTitle').textContent = def.title;
    $('#czStepSub').textContent = def.sub;
    $('#czStepCount').textContent = 'Étape ' + (current + 1) + ' sur ' + cat.STEPS.length;

    screensRoot.innerHTML = '<div class="cz-screen" data-screen="' + def.id + '">' +
      RENDERERS[def.id]() + '</div>';
    /* Déclenche l’animation d’entrée après insertion dans le document. */
    requestAnimationFrame(() => {
      const screen = screensRoot.firstElementChild;
      if (screen) screen.classList.add('is-in');
    });

    if (def.id === 'upload') renderFiles();
    if (def.id === 'measure') cat.MEASUREMENTS.forEach((m) => validateMeasure(m.id, false));

    renderRail();
    renderNav();
    bindScreen();
    preview.focus(def.id);
    screensRoot.scrollTop = 0;
  }

  /* L’état du bouton « annuler » suit chaque mutation, pas seulement
     les changements d’étape : il est resynchronisé à part. */
  function syncUndo() {
    $('#czUndo').disabled = !store.canUndo();
  }

  function renderRail() {
    syncUndo();
    railRoot.innerHTML = cat.STEPS.map((def, index) => {
      const state = index === current ? 'is-current'
        : index < current || store.isComplete(def.id) ? 'is-done' : '';
      return '<li class="cz-rail__item ' + state + '">' +
        '<button type="button" data-rail="' + index + '"' +
        (index === current ? ' aria-current="step"' : '') + '>' +
        '<span class="cz-rail__dot">' + (index + 1) + '</span>' +
        '<span class="cz-rail__name">' + esc(def.title) + '</span></button></li>';
    }).join('');
    $('#czProgressBar').style.width = (((current + 1) / cat.STEPS.length) * 100).toFixed(2) + '%';
  }

  function renderNav() {
    const def = stepAt(current);
    const prev = $('#czPrev');
    const next = $('#czNext');
    prev.disabled = current === 0;
    /* La dernière étape porte sa propre action de confirmation. */
    next.hidden = def.id === 'submit';
    next.textContent = def.id === 'review' ? 'Valider et envoyer' : 'Continuer';
  }

  /* ----------------------------------------------------------
     Navigation
     ---------------------------------------------------------- */
  function goTo(index, options) {
    const target = Math.max(0, Math.min(cat.STEPS.length - 1, index));
    if (target === current) return;
    /* Vers l’avant : toutes les étapes franchies doivent être complètes,
       y compris celles qu’un saut dans le rail passerait par-dessus. */
    if (!(options && options.force) && target > current) {
      for (let i = current; i < target; i += 1) {
        const errors = store.stepErrors(stepAt(i).id);
        if (!errors.length) continue;
        toast(errors[0]);
        if (i === current) flagIncomplete();
        else goTo(i, { force: true });
        return;
      }
    }
    current = target;
    store.commit((draft) => { draft.step = current; });
    renderScreen();
    if (global.innerWidth < 1024) {
      $('#czPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goToId(stepId) {
    const index = cat.STEPS.findIndex((def) => def.id === stepId);
    if (index > -1) goTo(index, { force: true });
  }

  /* Signale visuellement ce qui bloque le passage à l’étape suivante. */
  function flagIncomplete() {
    const def = stepAt(current);
    if (def.id === 'upload') {
      const drop = $('#czDrop');
      if (drop) {
        drop.classList.add('is-shake');
        setTimeout(() => drop.classList.remove('is-shake'), 500);
      }
    }
    if (def.id === 'measure') {
      let first = null;
      cat.MEASUREMENTS.forEach((m) => {
        const invalid = validateMeasure(m.id, true);
        if (invalid && !first) first = m.id;
      });
      const node = first && screensRoot.querySelector('[data-measure-input="' + first + '"]');
      if (node) { node.focus(); node.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    if (def.id === 'review') {
      const errors = store.clientErrors();
      let first = null;
      Object.keys(store.DEFAULTS.client).forEach((key) => {
        const node = screensRoot.querySelector('[data-client-error="' + key + '"]');
        if (!node) return;
        node.textContent = errors[key] || '';
        node.hidden = !errors[key];
        if (errors[key] && !first) first = key;
      });
      const input = first && screensRoot.querySelector('[data-client="' + first + '"]');
      if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
  }

  /* ----------------------------------------------------------
     Fichiers de production
     ---------------------------------------------------------- */
  const PREVIEWABLE = ['png', 'jpg', 'jpeg', 'svg'];

  function typeOf(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return cat.FILE_TYPES.find((t) => t.ext === ext) || null;
  }

  function showFileError(message) {
    const node = $('#czFileError');
    if (!node) return;
    node.textContent = message;
    node.hidden = !message;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Lecture impossible'));
      reader.readAsDataURL(file);
    });
  }

  /* Une photo de téléphone pèse plusieurs mégaoctets : telle quelle, elle
     saturerait le stockage du navigateur et n’arriverait jamais jusqu’à
     l’espace atelier. On la réduit donc en WebP — format qui préserve la
     transparence des logos — avant de la joindre à la commande. */
  function downscale(dataUrl, maxSide) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const webp = canvas.toDataURL('image/webp', 0.82);
        const out = webp.indexOf('data:image/webp') === 0 ? webp : canvas.toDataURL('image/png');
        /* Si la conversion ne fait pas gagner de place, on garde l’original. */
        resolve(out.length < dataUrl.length ? out : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /* Le SVG est déjà léger et vectoriel : il passe tel quel. */
  const RASTER = ['png', 'jpg', 'jpeg'];
  function compress(dataUrl, ext, maxSide) {
    return RASTER.indexOf(ext) > -1 ? downscale(dataUrl, maxSide) : Promise.resolve(dataUrl);
  }

  async function ingest(fileList) {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;
    showFileError('');

    const drop = $('#czDrop');
    if (drop) drop.classList.add('is-loading');

    const accepted = [];
    const rejected = [];

    for (const raw of incoming) {
      const type = typeOf(raw);
      if (!type) { rejected.push(raw.name + ' — format non pris en charge'); continue; }
      if (raw.size > cat.MAX_FILE_MB * 1024 * 1024) {
        rejected.push(raw.name + ' — dépasse ' + cat.MAX_FILE_MB + ' Mo');
        continue;
      }
      try {
        const previewable = PREVIEWABLE.indexOf(type.ext) > -1;
        /* Seuls les formats affichables par le navigateur sont conservés en
           image ; PDF, AI, EPS et CDR ne sont référencés que par leur nom. */
        const dataUrl = previewable
          ? await compress(await readFile(raw), type.ext, 1400)
          : '';
        fileSeq += 1;
        accepted.push({
          id: 'f' + Date.now() + fileSeq,
          name: raw.name,
          size: raw.size,
          ext: type.ext,
          label: type.label,
          previewable,
          dataUrl,
        });
      } catch (err) {
        rejected.push(raw.name + ' — lecture impossible');
      }
    }

    if (drop) drop.classList.remove('is-loading');

    if (accepted.length) {
      if (replacing) store.replaceFile(replacing, accepted[0]);
      else store.addFiles(accepted);
      renderFiles(accepted.map((f) => f.id));
      /* Le dernier design envoyé devient l’aperçu principal. */
      preview.selectUpload(accepted[accepted.length - 1].id);
      toast(replacing
        ? 'Fichier remplacé.'
        : accepted.length + ' fichier' + (accepted.length > 1 ? 's ajoutés' : ' ajouté') + '.');
    }

    replacing = null;
    if (rejected.length) showFileError(rejected.join(' · '));
  }

  function renderFiles(highlight) {
    const list = $('#czFiles');
    if (!list) return;
    const files = store.get().files;
    list.innerHTML = files.map(steps.upload.item).join('');
    (highlight || []).forEach((id) => {
      const node = list.querySelector('[data-file="' + id + '"]');
      if (node) {
        node.classList.add('is-new');
        setTimeout(() => node.classList.remove('is-new'), 900);
      }
    });
    const drop = $('#czDrop');
    if (drop) drop.classList.toggle('is-filled', files.length > 0);
    renderRail();
    preview.render();
  }

  function bindUpload(screen) {
    const drop = screen.querySelector('#czDrop');
    const input = screen.querySelector('#czFileInput');
    if (!drop || !input) return;

    const openPicker = (multiple) => {
      input.multiple = multiple;
      input.value = '';
      input.click();
    };

    drop.addEventListener('click', (event) => {
      if (event.target === input) return;
      replacing = null;
      openPicker(true);
    });
    drop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        replacing = null;
        openPicker(true);
      }
    });

    input.addEventListener('change', () => { ingest(input.files); });

    let depth = 0;
    ['dragenter', 'dragover'].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        if (type === 'dragenter') depth += 1;
        drop.classList.add('is-over');
      });
    });
    drop.addEventListener('dragleave', (event) => {
      event.preventDefault();
      depth = Math.max(0, depth - 1);
      if (!depth) drop.classList.remove('is-over');
    });
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      depth = 0;
      drop.classList.remove('is-over');
      replacing = null;
      if (event.dataTransfer && event.dataTransfer.files) ingest(event.dataTransfer.files);
    });

    /* Empêche le navigateur d’ouvrir un fichier déposé hors de la zone. */
    ['dragover', 'drop'].forEach((type) => {
      screen.addEventListener(type, (event) => {
        if (!event.target.closest('#czDrop')) event.preventDefault();
      });
    });

    screen.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-file-remove]');
      if (remove) {
        const id = remove.getAttribute('data-file-remove');
        const node = screen.querySelector('[data-file="' + id + '"]');
        if (node) node.classList.add('is-out');
        setTimeout(() => {
          store.removeFile(id);
          renderFiles();
          preview.render();
        }, 220);
        return;
      }
      const replace = event.target.closest('[data-file-replace]');
      if (replace) {
        replacing = replace.getAttribute('data-file-replace');
        openPicker(false);
        return;
      }
      const view = event.target.closest('[data-file-view]');
      if (view) {
        const file = store.get().files.find((f) => f.id === view.getAttribute('data-file-view'));
        if (file) openLightbox(file.name, '<img src="' + esc(file.dataUrl) + '" alt="' + esc(file.name) + '">');
      }
    });
  }

  /* ----------------------------------------------------------
     Mesures
     ---------------------------------------------------------- */
  function validateMeasure(id, showError) {
    const field = cat.MEASUREMENTS.find((m) => m.id === id);
    const error = store.measureError(field, store.at('measures.' + id));
    const errorNode = screensRoot.querySelector('[data-measure-error="' + id + '"]');
    const stateNode = screensRoot.querySelector('[data-measure-state="' + id + '"]');
    const row = screensRoot.querySelector('[data-measure="' + id + '"]');
    const empty = !String(store.at('measures.' + id)).trim();

    if (errorNode) {
      const visible = Boolean(error) && (showError || !empty);
      errorNode.textContent = error;
      errorNode.hidden = !visible;
    }
    if (row) {
      row.classList.toggle('is-valid', !error);
      row.classList.toggle('is-invalid', Boolean(error) && (showError || !empty));
    }
    if (stateNode) stateNode.classList.toggle('is-valid', !error);
    return Boolean(error);
  }

  function openGuide(id) {
    const field = cat.MEASUREMENTS.find((m) => m.id === id);
    if (!field) return;
    const guide = field.guide;
    const figure = $('#czGuideFigure');

    $('#czGuideTitle').textContent = field.label;

    /* Certaines mesures se prennent en plusieurs passages : ils s’affichent
       côte à côte, comme sur la planche, au lieu d’empiler les vignettes. */
    if (guide.row) {
      figure.classList.add('cz-guide__figure--row');
      figure.innerHTML = guide.row.map((pos) =>
        '<div class="cz-pos">' +
          '<div class="cz-pos__fig">' + steps.FIGURES[pos.figure] + '</div>' +
          '<p class="cz-pos__title">' + esc(pos.title) + '</p>' +
          '<p class="cz-pos__text">' + esc(pos.text) + '</p>' +
        '</div>').join('');
    } else {
      figure.classList.remove('cz-guide__figure--row');
      figure.innerHTML = steps.FIGURES[guide.figure];
    }

    $('#czGuideSteps').innerHTML = guide.steps
      .map((line) => '<li>' + esc(line) + '</li>').join('');
    $('#czGuideTip').textContent = guide.tip;
    openModal($('#czGuide'));
  }

  function bindMeasure(screen) {
    screen.addEventListener('input', (event) => {
      const input = event.target.closest('[data-measure-input]');
      if (!input) return;
      const id = input.getAttribute('data-measure-input');
      store.type('measures.' + id, input.value);
      validateMeasure(id, false);
      renderRail();
    });
    screen.addEventListener('blur', (event) => {
      const input = event.target.closest('[data-measure-input]');
      if (input) validateMeasure(input.getAttribute('data-measure-input'), true);
    }, true);
    screen.addEventListener('click', (event) => {
      const guide = event.target.closest('[data-guide]');
      if (guide) openGuide(guide.getAttribute('data-guide'));
    });
  }

  /* ----------------------------------------------------------
     Modales
     ---------------------------------------------------------- */
  let lastFocused = null;

  function openModal(modal) {
    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    const focusable = modal.querySelector('.cz-modal__close');
    if (focusable) focusable.focus();
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocused) lastFocused.focus();
  }

  function openLightbox(title, html) {
    $('#czLightboxTitle').textContent = title;
    $('#czLightboxBody').innerHTML = html;
    openModal($('#czLightbox'));
  }

  function bindModals() {
    document.querySelectorAll('.cz-modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-cz-close]')) closeModal(modal);
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = document.querySelector('.cz-modal.is-open');
      if (open) closeModal(open);
    });
  }

  /* ----------------------------------------------------------
     Logos brodés
     ---------------------------------------------------------- */
  function bindLogos(screen) {
    screen.addEventListener('click', (event) => {
      const clear = event.target.closest('[data-logo-clear]');
      if (clear) {
        event.stopPropagation();
        const path = clear.getAttribute('data-logo-clear');
        store.commit((draft) => {
          const keys = path.split('.');
          const last = keys.pop();
          const node = keys.reduce((acc, key) => acc[key], draft);
          node[last] = null;
          node[last + 'Name'] = '';
        });
        rerenderScreenKeepScroll();
        return;
      }
      const slot = event.target.closest('[data-logo]');
      if (slot) slot.querySelector('[data-logo-input]').click();
    });

    screen.addEventListener('change', async (event) => {
      const input = event.target.closest('[data-logo-input]');
      if (!input || !input.files || !input.files[0]) return;
      const file = input.files[0];
      if (file.size > cat.MAX_FILE_MB * 1024 * 1024) {
        toast('Logo trop lourd (max ' + cat.MAX_FILE_MB + ' Mo).');
        return;
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const dataUrl = await compress(await readFile(file), ext, 420);
      store.commit((draft) => {
        const keys = input.getAttribute('data-logo-input').split('.');
        const last = keys.pop();
        const node = keys.reduce((acc, key) => acc[key], draft);
        node[last] = dataUrl;
        node[last + 'Name'] = file.name;
      });
      rerenderScreenKeepScroll();
      toast('Logo ajouté.');
    });
  }

  /* Redessine l’écran sans perdre la position de lecture. */
  function rerenderScreenKeepScroll() {
    const top = global.scrollY;
    renderScreen();
    global.scrollTo({ top, behavior: 'auto' });
  }

  /* ----------------------------------------------------------
     Récapitulatif & envoi
     ---------------------------------------------------------- */
  function bindReview(screen) {
    screen.addEventListener('click', (event) => {
      const goto = event.target.closest('[data-goto]');
      if (goto) goToId(goto.getAttribute('data-goto'));
    });
    /* L’erreur d’un champ n’apparaît qu’une fois celui-ci renseigné puis
       invalidé — jamais tant qu’il est simplement vide et intouché. */
    const showFieldError = (key, value) => {
      const errorNode = screen.querySelector('[data-client-error="' + key + '"]');
      if (!errorNode) return;
      const message = store.clientErrors()[key];
      const visible = Boolean(message) && String(value).trim() !== '';
      errorNode.textContent = message || '';
      errorNode.hidden = !visible;
    };

    screen.addEventListener('input', (event) => {
      const input = event.target.closest('input[data-client], textarea[data-client]');
      if (!input) return;
      const key = input.getAttribute('data-client');
      store.type('client.' + key, input.value);
      showFieldError(key, input.value);
      syncUndo();
    });

    screen.addEventListener('change', (event) => {
      const select = event.target.closest('select[data-client]');
      if (!select) return;
      const key = select.getAttribute('data-client');
      store.set('client.' + key, select.value);
      showFieldError(key, select.value);
    });
  }

  function summaryText(order) {
    const s = order.config;
    const label = (list, id) => (cat.find(list, id) || {}).label || '—';
    const lines = [
      'ENMIIS — Dossier de fabrication',
      'Référence : ' + order.ref,
      'Date : ' + new Date(order.createdAt).toLocaleString('fr-FR'),
      '',
      '— CLIENT —',
      'Nom : ' + s.client.name,
      'WhatsApp : ' + s.client.whatsapp,
      'E-mail : ' + (s.client.email || '—'),
      'Région : ' + s.client.region,
      'Université : ' + (s.client.university || '—'),
      'Soutenance : ' + s.client.date,
      'Remarques : ' + (s.client.notes || '—'),
      '',
      '— FICHIERS —',
      s.files.length ? s.files.map((f) => '• ' + f.name + ' (' + f.label + ')').join('\n') : '—',
      '',
      '— ROBE —',
      'Tissu : ' + label(cat.FABRICS, s.robe.fabric),
      'Manches : ' + label(cat.SLEEVES, s.robe.sleeve),
      'Col : ' + label(cat.COLLARS, s.robe.collar),
      'Bordure : ' + label(cat.TRIM_STYLES, s.robe.trim),
      'Broderie : ' + (s.robe.emb.enabled
        ? s.robe.emb.text + ' (' + cat.FONTS[s.robe.emb.font].label + ')'
        : 'aucune'),
      '',
      '— CAPUCHE —',
      'Modèle : ' + label(cat.HOOD_STYLES, s.hood.style),
      'Broderie : ' + (s.hood.emb || '—'),
      '',
      '— MORTIER —',
      'Forme : ' + label(cat.CAP_STYLES, s.cap.style),
      'Matière : ' + label(cat.CAP_MATERIALS, s.cap.material),
      'Broderie : ' + (s.cap.emb || '—'),
      '',
      '— GLAND —',
      'Style : ' + label(cat.TASSEL_STYLES, s.tassel.style),
      'Année : ' + (s.tassel.year || '—'),
      '',
      'Couleurs : à définir avec l’atelier à la confirmation.',
      '',
      '— MESURES —',
      cat.MEASUREMENTS.map((m) => m.label + ' : ' + s.measures[m.id] + ' ' + m.unit).join('\n'),
    ];
    return lines.join('\n');
  }

  /* Récapitulatif imprimable : la boîte d’impression du navigateur
     permet l’enregistrement en PDF. */
  function downloadSummary(order) {
    const win = global.open('', '_blank');
    if (!win) { toast('Autorisez les fenêtres pour générer le PDF.'); return; }
    win.document.write(
      '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>ENMIIS — ' + esc(order.ref) + '</title><style>' +
      'body{font-family:Inter,Arial,sans-serif;color:#111;margin:40px;line-height:1.6;font-size:13px}' +
      'h1{font-family:Georgia,serif;font-size:24px;letter-spacing:.04em;margin:0 0 4px}' +
      'p.sub{color:#8A8A8A;margin:0 0 28px;font-size:12px;letter-spacing:.14em;text-transform:uppercase}' +
      'pre{white-space:pre-wrap;font-family:inherit;font-size:13px;border-top:1px solid #EAEAEA;padding-top:20px}' +
      '</style></head><body><h1>ENMIIS</h1>' +
      '<p class="sub">Dossier de fabrication · ' + esc(order.ref) + '</p>' +
      '<pre>' + esc(summaryText(order)) + '</pre></body></html>');
    win.document.close();
    win.focus();
    win.print();
  }

  function bindSubmit(screen) {
    const send = screen.querySelector('#czSubmit');
    if (send) {
      send.addEventListener('click', async () => {
        const errors = store.stepErrors('review');
        if (errors.length) { toast(errors[0]); goToId('review'); return; }
        send.disabled = true;
        send.textContent = 'Envoi en cours…';
        try {
          const order = await store.submit();
          renderScreen();
          toast(order.synced
            ? 'Demande <em>' + esc(order.ref) + '</em> envoyée à l’atelier.'
            : 'Demande <em>' + esc(order.ref) + '</em> enregistrée — synchronisation en attente.');
        } catch (err) {
          send.disabled = false;
          send.textContent = 'Envoyer ma demande';
          toast('Envoi impossible — stockage du navigateur saturé.');
        }
      });
    }

    const pdf = screen.querySelector('#czPdf');
    if (pdf) {
      pdf.addEventListener('click', () => {
        const ref = store.at('submitted').ref;
        const order = store.readOrders().find((o) => o.ref === ref);
        if (order) downloadSummary(order);
      });
    }

    const restart = screen.querySelector('#czRestart');
    if (restart) {
      restart.addEventListener('click', () => {
        store.reset();
        current = 0;
        renderScreen();
        toast('Nouvelle configuration.');
      });
    }
  }

  /* ----------------------------------------------------------
     Branchements génériques (délégation sur le conteneur)
     ---------------------------------------------------------- */
  function bindGlobalControls() {
    screensRoot.addEventListener('click', (event) => {
      const setter = event.target.closest('[data-set]');
      if (setter) {
        store.set(setter.getAttribute('data-set'), setter.getAttribute('data-value'));
        syncPressed(setter);
        preview.render();
        renderRail();
        /* La carte choisie s’affiche en vitrine sur l’aperçu. */
        const artNode = setter.querySelector('.cz-option__art');
        const nameNode = setter.querySelector('.cz-option__name');
        if (artNode && nameNode) preview.spotlight(artNode.innerHTML, nameNode.textContent);
        return;
      }
      const toggle = event.target.closest('[data-toggle]');
      if (toggle) {
        const path = toggle.getAttribute('data-toggle');
        store.set(path, !store.at(path));
        rerenderScreenKeepScroll();
      }
    });

    screensRoot.addEventListener('input', (event) => {
      const input = event.target.closest('[data-type]');
      if (!input) return;
      store.type(input.getAttribute('data-type'), input.value);
      preview.render();
      syncUndo();
    });

    railRoot.addEventListener('click', (event) => {
      const button = event.target.closest('[data-rail]');
      if (button) goTo(Number(button.getAttribute('data-rail')));
    });

    $('#czPrev').addEventListener('click', () => goTo(current - 1, { force: true }));
    $('#czNext').addEventListener('click', () => goTo(current + 1));

    /* Vue courante en plein écran. */
    $('#czShotZoom').addEventListener('click', () => {
      const shot = preview.current();
      if (!shot.src) { toast('Ce format n’a pas d’aperçu navigateur.'); return; }
      openLightbox(shot.title,
        '<div class="cz-lightbox__shot">' +
        '<img src="' + esc(shot.src) + '" alt="' + esc(shot.title) + '"></div>');
    });

    /* Vignettes des designs téléversés : afficher, remplacer, supprimer.
       Le conteneur vit hors des écrans, il n’est branché qu’une fois. */
    $('#czThumbs').addEventListener('click', (event) => {
      const pick = event.target.closest('[data-thumb-pick]');
      if (pick) { preview.selectUpload(pick.getAttribute('data-thumb-pick')); return; }

      const replace = event.target.closest('[data-thumb-replace]');
      if (replace) {
        const input = $('#czFileInput');
        if (!input) return;
        replacing = replace.getAttribute('data-thumb-replace');
        input.multiple = false;
        input.value = '';
        input.click();
        return;
      }

      const remove = event.target.closest('[data-thumb-remove]');
      if (remove) {
        store.removeFile(remove.getAttribute('data-thumb-remove'));
        renderFiles();
        preview.render();
        toast('Fichier supprimé.');
      }
    });

    $('#czUndo').addEventListener('click', () => {
      if (!store.undo()) return;
      renderScreen();
      preview.render();
      toast('Modification annulée.');
    });

    $('#czReset').addEventListener('click', () => {
      store.reset();
      current = 0;
      renderScreen();
      toast('Configuration réinitialisée.');
    });
  }

  /* Met à jour l’état pressé au sein d’un même groupe d’options. */
  function syncPressed(clicked) {
    const path = clicked.getAttribute('data-set');
    screensRoot.querySelectorAll('[data-set="' + path + '"]').forEach((node) => {
      const active = node === clicked;
      node.setAttribute('aria-pressed', String(active));
      node.classList.toggle('is-active', active);
    });
  }

  /* Rebranche les écouteurs propres à chaque écran après un rendu. */
  function bindScreen() {
    const screen = screensRoot.firstElementChild;
    if (!screen) return;
    const id = screen.getAttribute('data-screen');
    if (id === 'upload') bindUpload(screen);
    if (id === 'robe' || id === 'cap') bindLogos(screen);
    if (id === 'measure') bindMeasure(screen);
    if (id === 'review') bindReview(screen);
    if (id === 'submit') bindSubmit(screen);
  }

  async function loadPresetDataUrl(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 1200;
        let w = img.width;
        let h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round((h * max) / w); w = max; }
          else { w = Math.round((w * max) / h); h = max; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  async function applyPresetModel(id) {
    const presetMap = {
      '1': {
        name: 'Modèle Toge d’Excellence #1 (Photo de référence)',
        src: 'img/soutenance/1.png',
        fabric: 'gabardine', sleeve: 'cloche', collar: 'v', trim: 'double'
      },
      '2': {
        name: 'Modèle Toge de Prestance #2 (Photo de référence)',
        src: 'img/soutenance/2.png',
        fabric: 'gabardine', sleeve: 'cloche', collar: 'v', trim: 'simple'
      },
      '3': {
        name: 'Pack Soutenance Complète #3 (Photo de référence)',
        src: 'img/soutenance/3.png',
        fabric: 'gabardine', sleeve: 'cloche', collar: 'v', trim: 'double'
      }
    };

    const preset = presetMap[id] || presetMap['1'];

    /* Pré-configure la robe selon le modèle */
    store.commit((draft) => {
      draft.robe.fabric = preset.fabric;
      draft.robe.sleeve = preset.sleeve;
      draft.robe.collar = preset.collar;
      draft.robe.trim = preset.trim;
    });

    const dataUrl = await loadPresetDataUrl(preset.src);

    /* Vérifie si l'image est déjà ajoutée dans les fichiers */
    const existing = store.get().files.find(f => f.name === preset.name);
    if (!existing) {
      const fileObj = {
        id: 'preset-' + id + '-' + Date.now(),
        name: preset.name,
        size: 1100000,
        ext: 'png',
        label: 'PNG',
        previewable: true,
        dataUrl: dataUrl,
        preview: dataUrl
      };
      store.addFiles([fileObj]);
    }

    if (CZ.preview && typeof CZ.preview.render === 'function') {
      CZ.preview.render();
    }

    /* Notifie le client */
    setTimeout(() => {
      toast('<em>' + preset.name + '</em> attachée comme photo de référence !');
    }, 300);
  }

  /* ----------------------------------------------------------
     Démarrage
     ---------------------------------------------------------- */
  function init() {
    preview.init();
    bindModals();
    bindGlobalControls();

    /* Vérification d'un modèle choisi depuis soutenance.html */
    try {
      const params = new URLSearchParams(window.location.search);
      const presetId = params.get('preset') || params.get('model') || params.get('photo');
      if (presetId) {
        applyPresetModel(presetId);
      }
    } catch (e) {}

    current = Math.min(store.at('step') || 0, cat.STEPS.length - 1);
    /* Une configuration déjà envoyée repart de la première étape. */
    if (stepAt(current).id === 'submit' && !store.at('submitted')) current = 0;
    renderScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
