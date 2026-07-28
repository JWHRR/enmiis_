/* ============================================================
   ENMIIS — Espace Atelier : gestion des commandes.
   Liste, recherche, filtres, suivi de statut, notes internes,
   fiche de fabrication imprimable, import / export.

   NOTE DE SÉCURITÉ — le site est entièrement statique : le
   contrôle d’accès ci-dessous se joue côté navigateur et ne
   protège pas les données d’un visiteur déterminé. Pour un
   vrai secret, il faut une authentification côté serveur.
   ============================================================ */
(function (global) {
  'use strict';

  /* Le catalogue est chargé par js/cz-catalog.js ; s'il manque, init()
     l'annonce à l'écran au lieu de laisser une page blanche. */
  const cat = (global.CZ && global.CZ.catalog) || null;
  const PASSWORD = 'enmiis987';
  const SESSION_KEY = 'enmiis-admin-session';
  const ORDERS_KEY = 'enmiis-orders-v1';

  /* API partagée (voir api/orders.js) — même origine Vercel que ce
     fichier, donc chemin relatif : pas de CORS à gérer côté atelier. */
  const API_BASE = '/api/orders';

  /* Ouvert en fichier local (double-clic sur admin.html, tests),
     `/api/orders` ne peut exister : on ne tente même pas l'appel. */
  const CLOUD_ENABLED = global.location && global.location.protocol !== 'file:';

  const STATUSES = [
    { id: 'nouveau',   label: 'Nouveau',     tone: 'new'  },
    { id: 'confirme',  label: 'Confirmé',    tone: 'info' },
    { id: 'production',label: 'En atelier',  tone: 'work' },
    { id: 'pret',      label: 'Prêt',        tone: 'done' },
    { id: 'livre',     label: 'Livré',       tone: 'sent' },
    { id: 'annule',    label: 'Annulé',      tone: 'off'  },
  ];

  const $ = (selector) => document.querySelector(selector);

  /* Selon le navigateur et le mode de navigation, l'accès au stockage peut
     lever une exception (fichier local, navigation privée, cookies bloqués).
     Une session en mémoire prend alors le relais : l'espace reste utilisable
     le temps de l'onglet au lieu de rester bloqué sur l'écran de connexion. */
  let memorySession = false;

  function sessionActive() {
    if (memorySession) return true;
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function rememberSession() {
    memorySession = true;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (err) {
      /* session limitée à cet onglet */
    }
  }

  function forgetSession() {
    memorySession = false;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      /* rien à effacer */
    }
  }

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let orders = [];
  let selectedRef = null;
  let filterStatus = 'tous';
  let query = '';
  let sortMode = 'recent';

  /* 'unknown' avant la première tentative · 'ok' synchronisé ·
     'offline' réseau injoignable · 'unconfigured' KV pas encore activé. */
  let cloudStatus = 'unknown';

  /* ---------- Toast local (l’espace admin ne charge pas main.js) ---------- */
  let toastTimer = null;
  function toast(message) {
    const node = $('#toast');
    node.innerHTML = message;
    node.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3200);
  }

  /* ---------- Persistance ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      orders = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      orders = [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
      return true;
    } catch (err) {
      toast('Stockage saturé — exportez puis archivez d’anciennes commandes.');
      return false;
    }
  }

  /* ---------- Synchronisation avec l'API partagée ----------
     admin.js reste pleinement fonctionnel hors connexion (localStorage
     comme avant) ; ces appels ajoutent la synchronisation entre
     appareils sans jamais bloquer l'interface si le serveur est
     injoignable ou si le stockage cloud n'a pas encore été activé. */

  function renderSync() {
    const bar = $('#adSync');
    const text = $('#adSyncText');
    if (!bar || !text) return;
    if (cloudStatus === 'ok' || cloudStatus === 'unknown') {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    text.textContent = cloudStatus === 'unconfigured'
      ? 'Synchronisation cloud non activée — commandes affichées depuis cet appareil uniquement.'
      : 'Connexion à l’atelier impossible pour le moment — commandes affichées depuis cet appareil uniquement.';
  }

  /* Récupère les commandes du serveur partagé et les fusionne avec
     celles déjà en local : le serveur fait autorité sur toute
     référence qu'il connaît ; une commande jamais synchronisée
     (réseau coupé lors de l'envoi) reste visible en attendant. */
  async function syncFromCloud(showFeedback) {
    if (!CLOUD_ENABLED) {
      if (showFeedback) toast('Synchronisation indisponible en fichier local.');
      return;
    }
    try {
      const res = await fetch(API_BASE, { headers: { Accept: 'application/json' } });
      if (res.status === 503) {
        cloudStatus = 'unconfigured';
        renderSync();
        return;
      }
      if (!res.ok) throw new Error('http_' + res.status);
      const remote = await res.json();
      if (!Array.isArray(remote)) throw new Error('bad_payload');

      const remoteRefs = new Set(remote.map((o) => o.ref));
      const localOnly = orders.filter((o) => !remoteRefs.has(o.ref));
      orders = remote.concat(localOnly);
      persist();
      cloudStatus = 'ok';
      renderSync();
      renderAll();
      if (showFeedback) toast('Commandes synchronisées.');
    } catch (err) {
      cloudStatus = 'offline';
      renderSync();
      if (showFeedback) toast('Synchronisation impossible pour le moment.');
    }
  }

  async function pushStatus(order) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE + '?ref=' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: order.status }),
      });
      return res.ok;
    } catch (err) { return false; }
  }

  async function pushNote(order) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE + '?ref=' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: order.adminNote }),
      });
      return res.ok;
    } catch (err) { return false; }
  }

  async function pushDelete(ref) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE + '?ref=' + encodeURIComponent(ref), { method: 'DELETE' });
      return res.ok;
    } catch (err) { return false; }
  }

  /* ---------- Formatage ---------- */
  const labelOf = (list, id) => {
    const found = list.find((item) => item.id === id);
    return found ? found.label : '—';
  };
  const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

  function formatDate(iso) {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /* Nombre de jours restants avant la soutenance. */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    if (Number.isNaN(target.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function urgency(order) {
    const days = daysUntil(order.config.client.date);
    if (days === null) return null;
    if (order.status === 'livre' || order.status === 'annule') return null;
    if (days < 0) return { tone: 'late', text: 'Date dépassée' };
    if (days <= 7) return { tone: 'urgent', text: 'J−' + days };
    if (days <= 21) return { tone: 'soon', text: 'J−' + days };
    return { tone: 'calm', text: 'J−' + days };
  }

  /* ---------- Filtrage & tri ---------- */
  function haystack(order) {
    const c = order.config.client;
    return [order.ref, c.name, c.region, c.university, c.whatsapp, c.email, c.notes]
      .join(' ').toLowerCase();
  }

  function visibleOrders() {
    const needle = query.trim().toLowerCase();
    let list = orders.filter((order) => {
      if (filterStatus !== 'tous' && order.status !== filterStatus) return false;
      if (needle && haystack(order).indexOf(needle) === -1) return false;
      return true;
    });

    const sorters = {
      recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      old: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      date: (a, b) => String(a.config.client.date).localeCompare(String(b.config.client.date)),
      name: (a, b) => String(a.config.client.name).localeCompare(String(b.config.client.name), 'fr'),
    };
    list = list.slice().sort(sorters[sortMode]);
    return list;
  }

  /* ---------- Rendu : indicateurs ---------- */
  function renderStats() {
    const total = orders.length;
    const counts = {};
    STATUSES.forEach((s) => { counts[s.id] = 0; });
    orders.forEach((order) => { counts[order.status] = (counts[order.status] || 0) + 1; });

    const active = orders.filter((o) => o.status !== 'livre' && o.status !== 'annule');
    const urgent = active.filter((o) => {
      const days = daysUntil(o.config.client.date);
      return days !== null && days <= 7;
    }).length;

    const tiles = [
      { label: 'Commandes',   value: total,               note: 'toutes périodes' },
      { label: 'Nouvelles',   value: counts.nouveau || 0, note: 'à traiter',        tone: 'new' },
      { label: 'En atelier',  value: counts.production || 0, note: 'en fabrication', tone: 'work' },
      { label: 'Échéance ≤ 7 j', value: urgent,           note: 'à prioriser',      tone: urgent ? 'urgent' : '' },
      { label: 'Livrées',     value: counts.livre || 0,   note: 'clôturées',        tone: 'done' },
    ];

    $('#adStats').innerHTML = tiles.map((tile) =>
      '<article class="ad-stat' + (tile.tone ? ' ad-stat--' + tile.tone : '') + '">' +
        '<p class="ad-stat__value">' + tile.value + '</p>' +
        '<p class="ad-stat__label">' + esc(tile.label) + '</p>' +
        '<p class="ad-stat__note">' + esc(tile.note) + '</p>' +
      '</article>').join('');
  }

  /* ---------- Rendu : filtres ---------- */
  function renderFilters() {
    const counts = { tous: orders.length };
    STATUSES.forEach((s) => {
      counts[s.id] = orders.filter((order) => order.status === s.id).length;
    });
    const entries = [{ id: 'tous', label: 'Toutes' }].concat(STATUSES);
    $('#adStatusFilter').innerHTML = entries.map((entry) =>
      '<button type="button" class="ad-chip' + (filterStatus === entry.id ? ' is-active' : '') + '"' +
      ' data-status-filter="' + entry.id + '" aria-pressed="' + (filterStatus === entry.id) + '">' +
      esc(entry.label) + '<span>' + (counts[entry.id] || 0) + '</span></button>').join('');
  }

  /* ---------- Rendu : liste ---------- */
  function renderList() {
    const list = visibleOrders();
    const root = $('#adOrders');

    $('#adCount').textContent = list.length
      ? list.length + (list.length > 1 ? ' commandes affichées' : ' commande affichée')
      : '';
    $('#adEmpty').hidden = list.length > 0;

    root.innerHTML = list.map((order) => {
      const client = order.config.client;
      const status = statusOf(order.status);
      const flag = urgency(order);
      return '<li class="ad-card' + (order.ref === selectedRef ? ' is-active' : '') + '"' +
        ' data-ref="' + esc(order.ref) + '" tabindex="0" role="button">' +
        '<div class="ad-card__top">' +
          '<span class="ad-card__ref">' + esc(order.ref) + '</span>' +
          '<span class="ad-pill ad-pill--' + status.tone + '">' + esc(status.label) + '</span>' +
        '</div>' +
        '<p class="ad-card__name">' + esc(client.name || 'Client sans nom') + '</p>' +
        '<p class="ad-card__meta">' + esc(client.region || '—') +
          (client.university ? ' · ' + esc(client.university) : '') + '</p>' +
        '<div class="ad-card__foot">' +
          '<span>Reçue le ' + esc(formatDate(order.createdAt)) + '</span>' +
          (flag ? '<span class="ad-flag ad-flag--' + flag.tone + '">' + esc(flag.text) + '</span>' : '') +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ---------- Rendu : détail ---------- */
  /* Les couleurs ne font plus partie de la configuration client :
     elles sont arrêtées par l'atelier et notées en note d'atelier. */
  function specRows(order) {
    const s = order.config;
    const row = (label, value) =>
      '<div class="ad-row"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';

    const groups = [
      {
        title: 'Robe',
        rows:
          row('Tissu', labelOf(cat.FABRICS, s.robe.fabric)) +
          row('Coupe des manches', labelOf(cat.SLEEVES, s.robe.sleeve)) +
          row('Col', labelOf(cat.COLLARS, s.robe.collar)) +
          row('Bordure', labelOf(cat.TRIM_STYLES, s.robe.trim)) +
          row('Broderie', s.robe.emb.enabled
            ? (s.robe.emb.text || '—') + ' · ' + ((cat.FONTS[s.robe.emb.font] || {}).label || '—')
            : 'Aucune') +
          row('Emplacement broderie', s.robe.emb.enabled
            ? (cat.EMB_POSITIONS.find((p) => p.id === s.robe.emb.position) || {}).label || '—'
            : '—') +
          row('Logos fournis', [s.robe.emb.uniLogoName, s.robe.emb.facLogoName].filter(Boolean).join(' · ') || 'Aucun'),
      },
      {
        title: 'Capuche',
        rows:
          row('Modèle', labelOf(cat.HOOD_STYLES, s.hood.style)) +
          row('Broderie', s.hood.emb || 'Aucune'),
      },
      {
        title: 'Mortier',
        rows:
          row('Forme', labelOf(cat.CAP_STYLES, s.cap.style)) +
          row('Matière', labelOf(cat.CAP_MATERIALS, s.cap.material)) +
          row('Broderie', s.cap.emb || 'Aucune') +
          row('Logo', s.cap.logoName || 'Aucun'),
      },
      {
        title: 'Gland',
        rows:
          row('Style', labelOf(cat.TASSEL_STYLES, s.tassel.style)) +
          row('Année de promotion', s.tassel.year || 'Aucune'),
      },
      {
        title: 'Couleurs',
        rows: row('Palette', 'À définir avec le client — voir note d’atelier'),
      },
    ];

    return groups.map((group) =>
      '<section class="ad-block"><h3 class="ad-block__title">' + esc(group.title) + '</h3>' +
      '<dl class="ad-rows">' + group.rows + '</dl></section>').join('');
  }

  function measureTable(order) {
    return '<section class="ad-block"><h3 class="ad-block__title">Mesures</h3>' +
      '<div class="ad-measures">' + cat.MEASUREMENTS.map((m) => {
        const value = order.config.measures[m.id];
        return '<div class="ad-measure' + (value ? '' : ' is-missing') + '">' +
          '<span class="ad-measure__label">' + esc(m.label) + '</span>' +
          '<span class="ad-measure__value">' + (value ? esc(value) + ' ' + m.unit : '—') + '</span>' +
        '</div>';
      }).join('') + '</div></section>';
  }

  function filesBlock(order) {
    const files = order.config.files || [];
    if (!files.length) {
      return '<section class="ad-block"><h3 class="ad-block__title">Fichiers</h3>' +
        '<p class="ad-note">Aucun fichier joint.</p></section>';
    }
    return '<section class="ad-block"><h3 class="ad-block__title">Fichiers de production ' +
      '<span class="ad-block__count">' + files.length + '</span></h3>' +
      '<ul class="ad-files">' + files.map((file) =>
        '<li class="ad-file">' +
          '<span class="ad-file__thumb">' + (file.preview
            ? '<img src="' + esc(file.preview) + '" alt="">'
            : '<span class="ad-file__ext">' + esc(file.label) + '</span>') + '</span>' +
          '<span class="ad-file__meta"><strong>' + esc(file.name) + '</strong>' +
            '<small>' + esc(file.label) + '</small></span>' +
          (file.preview
            ? '<button type="button" class="ad-file__btn" data-preview="' + esc(file.id) + '">Voir</button>' +
              '<a class="ad-file__btn" href="' + esc(file.preview) + '" download="' + esc(file.name) + '">Télécharger</a>'
            : '<span class="ad-file__btn is-off" title="Format sans aperçu navigateur">Fichier source</span>') +
        '</li>').join('') + '</ul>' +
      (files.some((f) => !f.preview)
        ? '<p class="ad-note">Les formats AI, EPS, CDR et PDF sont référencés ici ; ' +
          'demandez au client de les transmettre par WhatsApp si le fichier source est requis.</p>'
        : '') +
      '</section>';
  }

  /* Visuels brodés joints à la configuration (hors fichiers de production). */
  function artworkBlock(order) {
    const s = order.config;
    const items = [
      { id: 'uni', src: s.robe.emb.uniLogo, name: s.robe.emb.uniLogoName, role: 'Logo université' },
      { id: 'fac', src: s.robe.emb.facLogo, name: s.robe.emb.facLogoName, role: 'Logo faculté' },
      { id: 'cap', src: s.cap.logo, name: s.cap.logoName, role: 'Logo mortier' },
    ].filter((item) => item.src);

    if (!items.length) return '';
    return '<section class="ad-block"><h3 class="ad-block__title">Visuels à broder ' +
      '<span class="ad-block__count">' + items.length + '</span></h3>' +
      '<ul class="ad-art">' + items.map((item) =>
        '<li class="ad-art__item">' +
          '<button type="button" class="ad-art__thumb" data-art="' + item.id + '" ' +
            'aria-label="Agrandir ' + esc(item.role) + '">' +
            '<img src="' + esc(item.src) + '" alt="' + esc(item.role) + '">' +
          '</button>' +
          '<span class="ad-art__role">' + esc(item.role) + '</span>' +
          '<span class="ad-art__name">' + esc(item.name || '—') + '</span>' +
          '<a class="ad-file__btn" href="' + esc(item.src) + '" download="' +
            esc(item.name || item.role) + '">Télécharger</a>' +
        '</li>').join('') + '</ul></section>';
  }

  function artworkOf(order, id) {
    const s = order.config;
    if (id === 'uni') return { src: s.robe.emb.uniLogo, name: s.robe.emb.uniLogoName || 'Logo université' };
    if (id === 'fac') return { src: s.robe.emb.facLogo, name: s.robe.emb.facLogoName || 'Logo faculté' };
    if (id === 'cap') return { src: s.cap.logo, name: s.cap.logoName || 'Logo mortier' };
    return null;
  }

  function renderDetail() {
    const order = orders.find((o) => o.ref === selectedRef);
    const body = $('#adBody');
    const placeholder = $('#adPlaceholder');

    if (!order) {
      body.hidden = true;
      placeholder.hidden = false;
      return;
    }
    placeholder.hidden = true;
    body.hidden = false;

    const client = order.config.client;
    const flag = urgency(order);
    const phone = String(client.whatsapp || '').replace(/[^\d]/g, '');
    const waLink = phone
      ? 'https://wa.me/' + (phone.length === 8 ? '216' + phone : phone) +
        '?text=' + encodeURIComponent('Bonjour ' + client.name + ', votre commande ENMIIS ' + order.ref + ' — ')
      : '';

    body.innerHTML =
      '<header class="ad-head">' +
        '<div>' +
          '<p class="ad-head__ref">' + esc(order.ref) + '</p>' +
          '<h2 class="ad-head__name">' + esc(client.name || 'Client sans nom') + '</h2>' +
          '<p class="ad-head__sub">Reçue le ' + esc(formatDateTime(order.createdAt)) + '</p>' +
        '</div>' +
        (flag ? '<span class="ad-flag ad-flag--' + flag.tone + ' ad-flag--lg">' + esc(flag.text) + '</span>' : '') +
      '</header>' +

      '<div class="ad-status" role="group" aria-label="Statut de la commande">' +
        STATUSES.map((s) =>
          '<button type="button" class="ad-status__btn ad-status__btn--' + s.tone +
          (order.status === s.id ? ' is-active' : '') + '" data-status="' + s.id + '"' +
          ' aria-pressed="' + (order.status === s.id) + '">' + esc(s.label) + '</button>').join('') +
      '</div>' +

      '<section class="ad-block"><h3 class="ad-block__title">Client</h3>' +
        '<dl class="ad-rows">' +
          '<div class="ad-row"><dt>Téléphone</dt><dd>' +
            (waLink ? '<a href="' + waLink + '" target="_blank" rel="noopener">' + esc(client.whatsapp) + '</a>'
                    : esc(client.whatsapp || '—')) + '</dd></div>' +
          '<div class="ad-row"><dt>E-mail</dt><dd>' +
            (client.email ? '<a href="mailto:' + esc(client.email) + '">' + esc(client.email) + '</a>' : '—') +
            '</dd></div>' +
          '<div class="ad-row"><dt>Région</dt><dd>' + esc(client.region || '—') + '</dd></div>' +
          '<div class="ad-row"><dt>Université</dt><dd>' + esc(client.university || '—') + '</dd></div>' +
          '<div class="ad-row"><dt>Soutenance</dt><dd>' + esc(formatDate(client.date)) + '</dd></div>' +
          '<div class="ad-row"><dt>Remarques</dt><dd>' + esc(client.notes || '—') + '</dd></div>' +
        '</dl>' +
      '</section>' +

      filesBlock(order) +
      artworkBlock(order) +
      specRows(order) +
      measureTable(order) +

      '<section class="ad-block">' +
        '<h3 class="ad-block__title">Note d’atelier</h3>' +
        '<textarea class="ad-textarea" id="adNote" rows="3"' +
        ' placeholder="Fournisseur, retouches, délai convenu…">' + esc(order.adminNote || '') + '</textarea>' +
        '<p class="ad-note" id="adNoteState">Enregistrée automatiquement.</p>' +
      '</section>' +

      '<footer class="ad-actions">' +
        (waLink ? '<a class="btn btn--solid" href="' + waLink + '" target="_blank" rel="noopener">Écrire sur WhatsApp</a>' : '') +
        '<button class="btn btn--line" type="button" id="adPrint">Fiche de fabrication</button>' +
        '<button class="btn btn--line" type="button" id="adCopy">Copier le récapitulatif</button>' +
        '<button class="btn btn--line ad-danger" type="button" id="adDelete">Supprimer</button>' +
      '</footer>';
  }

  function renderAll() {
    renderStats();
    renderFilters();
    renderList();
    renderDetail();
  }

  /* ---------- Récapitulatif texte & fiche imprimable ---------- */
  function summaryText(order) {
    const s = order.config;
    return [
      'ENMIIS — Dossier de fabrication',
      'Référence : ' + order.ref,
      'Statut : ' + statusOf(order.status).label,
      'Reçue le : ' + formatDateTime(order.createdAt),
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
      (s.files || []).length ? s.files.map((f) => '• ' + f.name + ' (' + f.label + ')').join('\n') : '—',
      '',
      '— ROBE —',
      'Tissu : ' + labelOf(cat.FABRICS, s.robe.fabric),
      'Manches : ' + labelOf(cat.SLEEVES, s.robe.sleeve),
      'Col : ' + labelOf(cat.COLLARS, s.robe.collar),
      'Bordure : ' + labelOf(cat.TRIM_STYLES, s.robe.trim),
      'Broderie : ' + (s.robe.emb.enabled ? s.robe.emb.text : 'aucune'),
      '',
      '— CAPUCHE —',
      'Modèle : ' + labelOf(cat.HOOD_STYLES, s.hood.style),
      'Broderie : ' + (s.hood.emb || '—'),
      '',
      '— MORTIER —',
      'Forme : ' + labelOf(cat.CAP_STYLES, s.cap.style),
      'Matière : ' + labelOf(cat.CAP_MATERIALS, s.cap.material),
      'Broderie : ' + (s.cap.emb || '—'),
      '',
      '— GLAND —',
      'Style : ' + labelOf(cat.TASSEL_STYLES, s.tassel.style),
      'Année : ' + (s.tassel.year || '—'),
      '',
      '— COULEURS —',
      'À définir avec le client (voir note d’atelier).',
      '',
      '— MESURES —',
      cat.MEASUREMENTS.map((m) => m.label + ' : ' + (s.measures[m.id] || '—') + ' ' + m.unit).join('\n'),
      '',
      '— NOTE ATELIER —',
      order.adminNote || '—',
    ].join('\n');
  }

  function printSheet(order) {
    const win = global.open('', '_blank');
    if (!win) { toast('Autorisez les fenêtres pour imprimer la fiche.'); return; }
    win.document.write(
      '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">' +
      '<title>ENMIIS — ' + esc(order.ref) + '</title><style>' +
      'body{font-family:Inter,Arial,sans-serif;color:#111;margin:36px;font-size:12.5px;line-height:1.6}' +
      'h1{font-family:Georgia,serif;font-size:22px;margin:0}' +
      'p.sub{color:#8A8A8A;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:2px 0 24px}' +
      'pre{white-space:pre-wrap;font-family:inherit;border-top:1px solid #EAEAEA;padding-top:18px}' +
      '</style></head><body><h1>ENMIIS</h1><p class="sub">Fiche de fabrication · ' + esc(order.ref) + '</p>' +
      '<pre>' + esc(summaryText(order)) + '</pre></body></html>');
    win.document.close();
    win.focus();
    win.print();
  }

  /* ---------- Import / export ---------- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  function exportJson() {
    if (!orders.length) { toast('Aucune commande à exporter.'); return; }
    download('enmiis-commandes-' + stamp() + '.json', JSON.stringify(orders, null, 2), 'application/json');
    toast(orders.length + ' commande(s) exportée(s).');
  }

  function exportCsv() {
    if (!orders.length) { toast('Aucune commande à exporter.'); return; }
    const columns = ['Référence', 'Statut', 'Reçue le', 'Client', 'WhatsApp', 'E-mail', 'Région',
      'Université', 'Soutenance', 'Robe', 'Capuche', 'Mortier', 'Gland', 'Fichiers', 'Note'];
    const cell = (value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';

    const rows = orders.map((order) => {
      const s = order.config;
      return [
        order.ref,
        statusOf(order.status).label,
        formatDateTime(order.createdAt),
        s.client.name,
        s.client.whatsapp,
        s.client.email,
        s.client.region,
        s.client.university,
        s.client.date,
        labelOf(cat.FABRICS, s.robe.fabric) + ' / ' + labelOf(cat.SLEEVES, s.robe.sleeve),
        labelOf(cat.HOOD_STYLES, s.hood.style),
        labelOf(cat.CAP_STYLES, s.cap.style) + ' / ' + labelOf(cat.CAP_MATERIALS, s.cap.material),
        labelOf(cat.TASSEL_STYLES, s.tassel.style) + (s.tassel.year ? ' / ' + s.tassel.year : ''),
        (s.files || []).map((f) => f.name).join(' | '),
        order.adminNote,
      ].map(cell).join(';');
    });

    /* BOM UTF-8 : Excel reconnaît alors les accents. */
    download('enmiis-commandes-' + stamp() + '.csv',
      '﻿' + columns.map(cell).join(';') + '\n' + rows.join('\n'), 'text/csv');
    toast('Export CSV généré.');
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const valid = incoming.filter((order) => order && order.ref && order.config && order.config.client);
        if (!valid.length) { toast('Fichier sans commande exploitable.'); return; }

        const known = new Set(orders.map((order) => order.ref));
        const added = valid.filter((order) => !known.has(order.ref));
        added.forEach((order) => {
          if (!STATUSES.some((s) => s.id === order.status)) order.status = 'nouveau';
          if (typeof order.adminNote !== 'string') order.adminNote = '';
        });
        orders = added.concat(orders);
        if (persist()) {
          renderAll();
          toast(added.length + ' commande(s) importée(s)' +
            (valid.length - added.length ? ' · ' + (valid.length - added.length) + ' doublon(s) ignoré(s)' : '') + '.');
        }
      } catch (err) {
        toast('Fichier JSON illisible.');
      }
    };
    reader.onerror = () => toast('Lecture du fichier impossible.');
    reader.readAsText(file);
  }

  /* ---------- Modale ---------- */
  function openModal(title, html) {
    $('#adModalTitle').textContent = title;
    $('#adModalBody').innerHTML = html;
    const modal = $('#adModal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
  }

  function closeModal() {
    const modal = $('#adModal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  /* ---------- Branchements ---------- */
  function bind() {
    $('#adSearch').addEventListener('input', (event) => {
      query = event.target.value;
      renderList();
    });

    $('#adSort').addEventListener('change', (event) => {
      sortMode = event.target.value;
      renderList();
    });

    $('#adStatusFilter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-status-filter]');
      if (!button) return;
      filterStatus = button.getAttribute('data-status-filter');
      renderFilters();
      renderList();
    });

    const selectOrder = (ref) => {
      selectedRef = ref;
      renderList();
      renderDetail();
      if (global.innerWidth < 1024) {
        $('#adDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    $('#adOrders').addEventListener('click', (event) => {
      const card = event.target.closest('[data-ref]');
      if (card) selectOrder(card.getAttribute('data-ref'));
    });
    $('#adOrders').addEventListener('keydown', (event) => {
      const card = event.target.closest('[data-ref]');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        selectOrder(card.getAttribute('data-ref'));
      }
    });

    /* Actions du panneau de détail (délégation : il est recréé à chaque rendu). */
    $('#adDetail').addEventListener('click', (event) => {
      const order = orders.find((o) => o.ref === selectedRef);
      if (!order) return;

      const statusBtn = event.target.closest('[data-status]');
      if (statusBtn) {
        order.status = statusBtn.getAttribute('data-status');
        if (persist()) {
          renderAll();
          toast('Statut : <em>' + esc(statusOf(order.status).label) + '</em>');
        }
        pushStatus(order).then((ok) => {
          if (!ok) toast('Statut enregistré localement — synchronisation en attente.');
        });
        return;
      }

      const preview = event.target.closest('[data-preview]');
      if (preview) {
        const file = (order.config.files || []).find((f) => f.id === preview.getAttribute('data-preview'));
        if (file) openModal(file.name, '<img src="' + esc(file.preview) + '" alt="' + esc(file.name) + '">');
        return;
      }

      const art = event.target.closest('[data-art]');
      if (art) {
        const item = artworkOf(order, art.getAttribute('data-art'));
        if (item) openModal(item.name, '<img src="' + esc(item.src) + '" alt="' + esc(item.name) + '">');
        return;
      }

      if (event.target.closest('#adPrint')) { printSheet(order); return; }

      if (event.target.closest('#adCopy')) {
        navigator.clipboard.writeText(summaryText(order))
          .then(() => toast('Récapitulatif copié.'))
          .catch(() => toast('Copie impossible — utilisez « Fiche de fabrication ».'));
        return;
      }

      if (event.target.closest('#adDelete')) {
        if (!global.confirm('Supprimer définitivement la commande ' + order.ref + ' ?')) return;
        const ref = order.ref;
        orders = orders.filter((o) => o.ref !== ref);
        selectedRef = null;
        if (persist()) {
          renderAll();
          toast('Commande supprimée.');
        }
        pushDelete(ref);
      }
    });

    /* Note d’atelier : enregistrée après une courte pause de frappe. */
    let noteTimer = null;
    $('#adDetail').addEventListener('input', (event) => {
      if (event.target.id !== 'adNote') return;
      const order = orders.find((o) => o.ref === selectedRef);
      if (!order) return;
      order.adminNote = event.target.value;
      const state = $('#adNoteState');
      state.textContent = 'Enregistrement…';
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        if (persist()) state.textContent = 'Note enregistrée à ' +
          new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '.';
        pushNote(order);
      }, 500);
    });

    $('#adRefresh').addEventListener('click', () => syncFromCloud(true));
    $('#adSyncRetry').addEventListener('click', () => syncFromCloud(true));
    $('#adExport').addEventListener('click', exportJson);
    $('#adCsv').addEventListener('click', exportCsv);
    $('#adImport').addEventListener('click', () => $('#adImportInput').click());
    $('#adImportInput').addEventListener('change', (event) => {
      if (event.target.files && event.target.files[0]) importJson(event.target.files[0]);
      event.target.value = '';
    });

    $('#adLogout').addEventListener('click', () => {
      forgetSession();
      global.location.reload();
    });

    $('#adModal').addEventListener('click', (event) => {
      if (event.target.closest('[data-ad-close]')) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && $('#adModal').classList.contains('is-open')) closeModal();
    });

    /* Deux onglets ouverts : la liste reste synchronisée. */
    global.addEventListener('storage', (event) => {
      if (event.key !== ORDERS_KEY) return;
      load();
      renderAll();
    });
  }

  /* ---------- Accès ---------- */
  function openApp() {
    $('#adGate').hidden = true;
    $('#adApp').hidden = false;
    load();
    bind();
    renderAll();
    syncFromCloud(false);
  }

  function bindGate() {
    const form = $('#adLogin');
    const error = $('#adGateError');
    let attempts = 0;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = $('#adPass').value;
      if (value === PASSWORD) {
        rememberSession();
        openApp();
        return;
      }
      attempts += 1;
      error.textContent = attempts > 2
        ? 'Mot de passe incorrect. Contactez la direction ENMIIS.'
        : 'Mot de passe incorrect.';
      error.hidden = false;
      form.classList.add('is-shake');
      setTimeout(() => form.classList.remove('is-shake'), 500);
      $('#adPass').select();
    });
  }

  /* Un écran vide ne dit rien : si le démarrage échoue, on affiche la cause
     plutôt que de laisser la page blanche. */
  function fail(message, detail) {
    const gate = $('#adGate');
    const app = $('#adApp');
    if (app) app.hidden = true;
    if (!gate) {
      document.body.textContent = message + (detail ? ' — ' + detail : '');
      return;
    }
    gate.hidden = false;
    gate.innerHTML = '<div class="ad-gate__card">' +
      '<p class="ad-gate__label">Espace Atelier</p>' +
      '<h1 class="ad-gate__title">Chargement impossible</h1>' +
      '<p class="ad-gate__text">' + esc(message) + '</p>' +
      (detail ? '<p class="ad-error">' + esc(detail) + '</p>' : '') +
      '<a class="ad-gate__back" href="index.html">← Retour au site</a>' +
      '</div>';
  }

  function init() {
    /* admin.js dépend du catalogue produit pour libeller les commandes. */
    if (!cat || !cat.MEASUREMENTS) {
      fail('Le catalogue produit n’a pas pu être chargé. Vérifiez que le fichier '
        + 'js/cz-catalog.js est bien présent à côté de js/admin.js.');
      return;
    }
    try {
      if (sessionActive()) openApp();
      else bindGate();
    } catch (err) {
      fail('Une erreur a interrompu l’ouverture de l’espace atelier.', err && err.message);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
