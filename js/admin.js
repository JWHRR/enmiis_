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

  const API_BASE = '/api/orders';
  const SUPABASE_REST_URL = 'https://kzqpvtrgchtiffcyxzfy.supabase.co/rest/v1/orders';
  const SUPABASE_KEY = 'sb_publishable_x8IMyzlq6tqxbXITcP6YRg_-CnC0mj-';

  const CLOUD_ENABLED = true;

  const STATUSES = [
    { id: 'nouveau',   label: 'Nouveau',     tone: 'new'  },
    { id: 'confirme',  label: 'Confirmé',    tone: 'info' },
    { id: 'production',label: 'En atelier',  tone: 'work' },
    { id: 'pret',      label: 'Prêt',        tone: 'done' },
    { id: 'livre',     label: 'Livré',       tone: 'sent' },
    { id: 'annule',    label: 'Annulé',      tone: 'off'  },
  ];

  const $ = (selector) => document.querySelector(selector);

  /* Les fichiers machine voyagent en base64 dans la commande : au-delà
     de cette taille la requête dépasserait la limite des fonctions
     serverless. */
  const MACHINE_MAX_MB = 2.5;

  const fileSize = (bytes) => (!bytes ? '—' : bytes < 1024 * 1024
    ? Math.max(1, Math.round(bytes / 1024)) + ' Ko'
    : (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo');

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
     'offline' serveur et Supabase tous deux injoignables. */
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
    text.textContent = 'Connexion à l’atelier impossible pour le moment — ' +
      'commandes affichées depuis cet appareil uniquement.';
  }

  /* Récupère les commandes du serveur partagé et les fusionne avec
     celles déjà en local : le serveur fait autorité sur toute
     référence qu'il connaît ; une commande jamais synchronisée
     (réseau coupé lors de l'envoi) reste visible en attendant. */
  function toOrder(row) {
    return {
      ref: row.ref,
      createdAt: row.created_at,
      status: row.status,
      adminNote: row.admin_note,
      config: row.config,
    };
  }

  async function syncFromCloud(showFeedback) {
    if (!CLOUD_ENABLED) {
      if (showFeedback) toast('Synchronisation indisponible en fichier local.');
      return;
    }
    let remote = null;
    try {
      const res = await fetch(API_BASE, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        remote = await res.json();
        console.log('[ENMIIS Admin] Orders loaded via API_BASE:', remote.length);
      }
    } catch (err) {
      console.warn('[ENMIIS Admin] API_BASE unavailable, trying direct Supabase REST');
    }

    if (!Array.isArray(remote)) {
      try {
        const res = await fetch(SUPABASE_REST_URL + '?select=*&order=created_at.desc', {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Accept': 'application/json',
          },
        });
        if (res.ok) {
          const rows = await res.json();
          remote = rows.map(toOrder);
          console.log('[ENMIIS Admin] Orders loaded via Supabase REST:', remote.length);
        } else {
          const txt = await res.text();
          console.error('[ENMIIS Admin] Supabase fetch error:', res.status, txt);
        }
      } catch (err) {
        console.error('[ENMIIS Admin] Supabase network error:', err);
      }
    }

    if (Array.isArray(remote)) {
      const remoteRefs = new Set(remote.map((o) => o.ref));
      const localOnly = orders.filter((o) => !remoteRefs.has(o.ref));
      orders = remote.concat(localOnly);
      persist();
      cloudStatus = 'ok';
      renderSync();
      renderAll();
      if (showFeedback) toast('Commandes synchronisées (' + remote.length + ').');
    } else {
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
      if (res.ok) return true;
    } catch (err) {}

    try {
      const res = await fetch(SUPABASE_REST_URL + '?ref=eq.' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
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
      if (res.ok) return true;
    } catch (err) {}

    try {
      const res = await fetch(SUPABASE_REST_URL + '?ref=eq.' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ admin_note: order.adminNote }),
      });
      return res.ok;
    } catch (err) { return false; }
  }

  async function pushDelete(ref) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE + '?ref=' + encodeURIComponent(ref), { method: 'DELETE' });
      if (res.ok) return true;
    } catch (err) {}

    try {
      const res = await fetch(SUPABASE_REST_URL + '?ref=eq.' + encodeURIComponent(ref), {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
        },
      });
      return res.ok;
    } catch (err) { return false; }
  }

  /* Les fichiers machine sont fusionnés côté serveur : la requête ne
     transporte que la nouvelle liste, jamais la commande entière. */
  async function pushMachineFiles(order) {
    if (!CLOUD_ENABLED) return false;
    const body = JSON.stringify({ machineFiles: machineFilesOf(order) });
    try {
      const res = await fetch(API_BASE + '?ref=' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) return true;
    } catch (err) { /* on tente la voie directe ci-dessous */ }

    /* Repli direct : PostgREST n'accepte pas de fusion partielle du
       jsonb, on renvoie donc la configuration complète. */
    try {
      const res = await fetch(SUPABASE_REST_URL + '?ref=eq.' + encodeURIComponent(order.ref), {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: order.config }),
      });
      return res.ok;
    } catch (err) { return false; }
  }

  async function pushNewOrder(order) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (res.ok) return true;
    } catch (err) { /* on tente la voie directe ci-dessous */ }

    try {
      const res = await fetch(SUPABASE_REST_URL + '?on_conflict=ref', {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          ref: order.ref,
          created_at: order.createdAt,
          status: order.status,
          admin_note: order.adminNote,
          config: order.config,
        }),
      });
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
    const days = daysUntil(clientOf(order).date);
    if (days === null) return null;
    if (order.status === 'livre' || order.status === 'annule') return null;
    if (days < 0) return { tone: 'late', text: 'Date dépassée' };
    if (days <= 7) return { tone: 'urgent', text: 'J−' + days };
    if (days <= 21) return { tone: 'soon', text: 'J−' + days };
    return { tone: 'calm', text: 'J−' + days };
  }

  /* ---------- Filtrage & tri ---------- */
  function haystack(order) {
    const c = clientOf(order);
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
      date: (a, b) => String(a.config?.client?.date || '').localeCompare(String(b.config?.client?.date || '')),
      name: (a, b) => String(a.config?.client?.name || '').localeCompare(String(b.config?.client?.name || ''), 'fr'),
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
      const days = daysUntil(o.config?.client?.date);
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
      const client = clientOf(order);
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
          '<span>Reçue le ' + esc(formatDate(order.createdAt)) +
            /* Une commande peut porter plusieurs tenues : on l'annonce
               dès la liste pour éviter toute surprise à l'atelier. */
            (itemsOf(order).length > 1
              ? ' · <strong class="ad-card__items">' + itemsOf(order).length + ' articles</strong>'
              : '') + '</span>' +
          (flag ? '<span class="ad-flag ad-flag--' + flag.tone + '">' + esc(flag.text) + '</span>' : '') +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ---------- Normalisation ----------
     Une commande porte désormais un client et un tableau de tenues
     (`config.items`). Les commandes antérieures au panier n'avaient
     qu'une seule tenue, à plat dans `config` : elles sont présentées
     comme un article unique, sans conversion en base. */
  function itemsOf(order) {
    const cfg = order.config || {};
    if (Array.isArray(cfg.items)) return cfg.items;
    if (cfg.robe || cfg.measures) return [cfg];
    return [];
  }

  function clientOf(order) {
    return (order.config || {}).client || {};
  }

  function machineFilesOf(order) {
    const list = (order.config || {}).machineFiles;
    return Array.isArray(list) ? list : [];
  }

  /* ---------- Rendu : une tenue ---------- */

  /* Chaque article est une pièce indépendante : on n'affiche que les
     réglages qui la concernent. Les commandes passées avant la
     séparation en trois produits portaient toutes les pièces à la
     fois — ce rendu les couvre aussi, bloc par bloc. */
  function specRows(item) {
    const row = (label, value) =>
      '<div class="ad-row"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
    let rows = '';

    if (item.robe) {
      const robe = item.robe;
      const emb = robe.emb || {};
      rows += row('Manches', labelOf(cat.SLEEVES, robe.sleeve)) +
        row('Col', labelOf(cat.COLLARS, robe.collar)) +
        row('Bordure', labelOf(cat.TRIM_STYLES, robe.trim)) +
        row('Texte à broder', emb.text || '—') +
        row('Logo d’université', emb.uniLogoName || 'Aucun');
    }
    if (item.cap) {
      rows += row('Casquette', labelOf(cat.CAP_STYLES, item.cap.style) + ' · ' +
          labelOf(cat.CAP_MATERIALS, item.cap.material)) +
        row('Broderie du plateau', item.cap.emb || 'Aucune') +
        row('Logo brodé', item.cap.logoName || 'Aucun');
    }
    if (item.tassel) {
      rows += row('Gland', labelOf(cat.TASSEL_STYLES, item.tassel.style)) +
        row('Année de promotion', item.tassel.year || 'Aucune');
    }
    if (item.hood) {
      rows += row('Écharpe', labelOf(cat.HOOD_STYLES, item.hood.style)) +
        row('Broderie de l’écharpe', item.hood.emb || 'Aucune');
    }

    rows += row('Couleurs', 'À définir avec le client — voir note d’atelier');
    return '<dl class="ad-rows">' + rows + '</dl>';
  }

  /* Seules les mesures relevées pour cette pièce : une casquette n'a
     qu'un tour de tête, inutile d'afficher huit cases vides. */
  function measureTable(item) {
    const measures = item.measures || {};
    const fields = cat.MEASUREMENTS.filter((m) => measures[m.id] !== undefined);
    if (!fields.length) return '<p class="ad-note">Aucune mesure pour cet article.</p>';

    return '<div class="ad-measures">' + fields.map((m) => {
      const value = measures[m.id];
      return '<div class="ad-measure' + (value ? '' : ' is-missing') + '">' +
        '<span class="ad-measure__label">' + esc(m.label) + '</span>' +
        '<span class="ad-measure__value">' + (value ? esc(value) + ' ' + m.unit : '—') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function filesBlock(item, index) {
    const files = item.files || [];
    if (!files.length) return '<p class="ad-note">Aucun fichier joint.</p>';
    return '<ul class="ad-files">' + files.map((file) =>
      '<li class="ad-file">' +
        '<span class="ad-file__thumb">' + (file.preview
          ? '<img src="' + esc(file.preview) + '" alt="">'
          : '<span class="ad-file__ext">' + esc(file.label) + '</span>') + '</span>' +
        '<span class="ad-file__meta"><strong>' + esc(file.name) + '</strong>' +
          '<small>' + esc(file.label) + '</small></span>' +
        (file.preview
          ? '<button type="button" class="ad-file__btn" data-preview="' + index + ':' + esc(file.id) + '">Voir</button>' +
            '<a class="ad-file__btn" href="' + esc(file.preview) + '" download="' + esc(file.name) + '">Télécharger</a>'
          : '<span class="ad-file__btn is-off" title="Format sans aperçu navigateur">Fichier source</span>')
      + '</li>').join('') + '</ul>' +
      (files.some((f) => !f.preview)
        ? '<p class="ad-note">Les formats AI, EPS, CDR et PDF sont référencés ici ; demandez au client de ' +
          'les transmettre par WhatsApp si le fichier source est requis.</p>'
        : '');
  }

  /* Visuels brodés joints à une tenue (logos université / mortier). */
  function artworkList(item) {
    const emb = (item.robe || {}).emb || {};
    const cap = item.cap || {};
    return [
      { id: 'uni', src: emb.uniLogo, name: emb.uniLogoName, role: 'Logo université' },
      { id: 'cap', src: cap.logo, name: cap.logoName, role: 'Logo mortier' },
    ].filter((entry) => entry.src);
  }

  function artworkBlock(item, index) {
    const items = artworkList(item);
    if (!items.length) return '';
    return '<h4 class="ad-item__sub">Visuels à broder</h4>' +
      '<ul class="ad-art">' + items.map((entry) =>
        '<li class="ad-art__item">' +
          '<button type="button" class="ad-art__thumb" data-art="' + index + ':' + entry.id + '"' +
            ' aria-label="Agrandir ' + esc(entry.role) + '">' +
            '<img src="' + esc(entry.src) + '" alt="' + esc(entry.role) + '">' +
          '</button>' +
          '<span class="ad-art__role">' + esc(entry.role) + '</span>' +
          '<span class="ad-art__name">' + esc(entry.name || '—') + '</span>' +
          '<a class="ad-file__btn" href="' + esc(entry.src) + '" download="' +
            esc(entry.name || entry.role) + '">Télécharger</a>' +
        '</li>').join('') + '</ul>';
  }

  /* Retrouve un visuel à partir de « index:id » (voir data-art). */
  function artworkAt(order, token) {
    const parts = String(token).split(':');
    const item = itemsOf(order)[Number(parts[0])];
    if (!item) return null;
    const found = artworkList(item).find((entry) => entry.id === parts[1]);
    return found ? { src: found.src, name: found.name || found.role } : null;
  }

  function fileAt(order, token) {
    const parts = String(token).split(':');
    const item = itemsOf(order)[Number(parts[0])];
    if (!item) return null;
    return (item.files || []).find((f) => String(f.id) === parts.slice(1).join(':')) || null;
  }

  /* Le nom que porte l'article dans l'atelier : ce qui doit être brodé
     dessus, sinon un repère neutre. */
  function itemTag(item) {
    if (item.robe && item.robe.emb && item.robe.emb.text) return item.robe.emb.text;
    if (item.cap && item.cap.emb) return item.cap.emb;
    if (item.hood && item.hood.emb) return item.hood.emb;
    return 'Sans broderie';
  }

  /* Un article de la commande — une robe, une casquette ou une écharpe. */
  function itemBlock(item, index, total) {
    const product = item.product ? cat.product(item.product) : null;
    const name = product ? product.label : 'Tenue complète';
    const title = total > 1
      ? (index + 1) + '. ' + name
      : name;
    const price = Number(item.price) ? ' · ' + cat.price(Number(item.price)) : '';
    return '<section class="ad-item">' +
      '<header class="ad-item__head">' +
        '<h3 class="ad-item__title">' + esc(title + price) + '</h3>' +
        '<span class="ad-item__tag">' + esc(itemTag(item)) + '</span>' +
      '</header>' +
      '<h4 class="ad-item__sub">Fichiers de production</h4>' +
      filesBlock(item, index) +
      artworkBlock(item, index) +
      '<h4 class="ad-item__sub">Composition</h4>' +
      specRows(item) +
      '<h4 class="ad-item__sub">Mesures</h4>' +
      measureTable(item) +
    '</section>';
  }

  /* ---------- Fichiers machine (déposés par l'atelier) ---------- */
  function machineBlock(order) {
    const files = machineFilesOf(order);
    return '<section class="ad-block">' +
      '<h3 class="ad-block__title">Fichiers machine' +
        (files.length ? ' <span class="ad-block__count">' + files.length + '</span>' : '') + '</h3>' +
      (files.length
        ? '<ul class="ad-files">' + files.map((file) =>
            '<li class="ad-file">' +
              '<span class="ad-file__thumb"><span class="ad-file__ext">' + esc(file.label || '—') + '</span></span>' +
              '<span class="ad-file__meta"><strong>' + esc(file.name) + '</strong>' +
                '<small>' + esc(fileSize(file.size)) + ' · déposé le ' + esc(formatDate(file.addedAt)) + '</small></span>' +
              '<a class="ad-file__btn" href="' + esc(file.dataUrl) + '" download="' + esc(file.name) + '">Télécharger</a>' +
              '<button type="button" class="ad-file__btn ad-file__btn--danger" data-machine-remove="' +
                esc(file.id) + '">Retirer</button>' +
            '</li>').join('') + '</ul>'
        : '<p class="ad-note">Aucun fichier machine. Déposez ici le fichier de broderie (DST, EMB, PES…) ' +
          'pour le retrouver plus tard.</p>') +
      '<label class="ad-machine__drop" for="adMachineInput">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><polyline points="7 9 12 4 17 9"/><path d="M4 20h16"/></svg>' +
        '<span>Ajouter un fichier machine</span>' +
        '<small>DST · EMB · PES · JEF · EXP · VP3 · PDF · ZIP — ' + MACHINE_MAX_MB + ' Mo max</small>' +
      '</label>' +
      '<input type="file" id="adMachineInput" class="visually-hidden" multiple' +
        ' accept=".dst,.emb,.pes,.jef,.exp,.vp3,.hus,.xxx,.pdf,.zip">' +
      '<p class="ad-error" id="adMachineError" hidden></p>' +
    '</section>';
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

    const client = clientOf(order);
    const items = itemsOf(order);
    const flag = urgency(order);
    const phone = String(client.whatsapp || '').replace(/[^\d]/g, '');
    const waLink = phone
      ? 'https://wa.me/' + (phone.length === 8 ? '216' + phone : phone) +
        '?text=' + encodeURIComponent('Bonjour ' + (client.name || '') + ', votre commande ENMIIS ' + order.ref + ' — ')
      : '';
    const manual = (order.config || {}).source === 'manual';

    body.innerHTML =
      '<header class="ad-head">' +
        '<div>' +
          '<p class="ad-head__ref">' + esc(order.ref) +
            (manual ? ' · <span class="ad-head__origin">saisie atelier</span>' : '') + '</p>' +
          '<h2 class="ad-head__name">' + esc(client.name || 'Client sans nom') + '</h2>' +
          '<p class="ad-head__sub">Reçue le ' + esc(formatDateTime(order.createdAt)) +
            ' · ' + items.length + ' article' + (items.length > 1 ? 's' : '') + '</p>' +
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

      (items.length
        ? items.map((item, index) => itemBlock(item, index, items.length)).join('')
        : '<section class="ad-block"><p class="ad-note">Cette commande ne contient aucun article.</p></section>') +

      machineBlock(order) +

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

  /* ---------- Fichiers machine ---------- */

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('read_failed'));
      reader.readAsDataURL(file);
    });
  }

  function saveMachineFiles(order, files, message) {
    order.config = order.config || {};
    order.config.machineFiles = files;
    if (!persist()) return;
    renderDetail();
    toast(message);
    pushMachineFiles(order).then((ok) => {
      if (!ok) toast('Enregistré localement — synchronisation en attente.');
    });
  }

  async function addMachineFiles(order, fileList) {
    const error = $('#adMachineError');
    const rejected = [];
    const accepted = [];

    for (const raw of Array.from(fileList)) {
      if (raw.size > MACHINE_MAX_MB * 1024 * 1024) {
        rejected.push(raw.name + ' — dépasse ' + MACHINE_MAX_MB + ' Mo');
        continue;
      }
      try {
        accepted.push({
          id: 'mf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: raw.name,
          size: raw.size,
          label: (raw.name.split('.').pop() || 'FICHIER').toUpperCase(),
          addedAt: new Date().toISOString(),
          dataUrl: await readAsDataUrl(raw),
        });
      } catch (err) {
        rejected.push(raw.name + ' — lecture impossible');
      }
    }

    if (accepted.length) {
      saveMachineFiles(order, machineFilesOf(order).concat(accepted),
        accepted.length + ' fichier machine ajouté' + (accepted.length > 1 ? 's' : '') + '.');
    }
    if (rejected.length && error) {
      error.textContent = rejected.join(' · ');
      error.hidden = false;
    }
  }

  function renderAll() {
    renderStats();
    renderFilters();
    renderList();
    renderDetail();
  }

  /* ---------- Récapitulatif texte & fiche imprimable ---------- */
  function summaryText(order) {
    const client = clientOf(order);
    const items = itemsOf(order);
    const machine = machineFilesOf(order);

    const lines = [
      'ENMIIS — Dossier de fabrication',
      'Référence : ' + order.ref,
      'Statut : ' + statusOf(order.status).label,
      'Reçue le : ' + formatDateTime(order.createdAt),
      'Origine : ' + ((order.config || {}).source === 'manual' ? 'saisie atelier' : 'site'),
      'Articles : ' + items.length,
      'Total : ' + cat.price(items.reduce((sum, i) => sum + (Number(i.price) || 0), 0)),
      '',
      '— CLIENT —',
      'Nom : ' + (client.name || '—'),
      'WhatsApp : ' + (client.whatsapp || '—'),
      'E-mail : ' + (client.email || '—'),
      'Région : ' + (client.region || '—'),
      'Université : ' + (client.university || '—'),
      'Soutenance : ' + (client.date || '—'),
      'Remarques : ' + (client.notes || '—'),
    ];

    items.forEach((item, index) => {
      const measures = item.measures || {};
      const product = item.product ? cat.product(item.product) : null;
      lines.push('', '════ ' + (index + 1) + '/' + items.length + ' — ' +
        (product ? product.label.toUpperCase() : 'TENUE COMPLÈTE') +
        (Number(item.price) ? ' — ' + cat.price(Number(item.price)) : '') + ' ════');
      lines.push('Fichiers : ' + ((item.files || []).length
        ? item.files.map((f) => f.name + ' (' + f.label + ')').join(', ') : '—'));

      if (item.robe) {
        const emb = item.robe.emb || {};
        lines.push('Manches : ' + labelOf(cat.SLEEVES, item.robe.sleeve));
        lines.push('Col : ' + labelOf(cat.COLLARS, item.robe.collar));
        lines.push('Bordure : ' + labelOf(cat.TRIM_STYLES, item.robe.trim));
        lines.push('Texte à broder : ' + (emb.text || '—'));
        lines.push('Logo université : ' + (emb.uniLogoName || '—'));
      }
      if (item.cap) {
        lines.push('Casquette : ' + labelOf(cat.CAP_STYLES, item.cap.style) +
          ' / ' + labelOf(cat.CAP_MATERIALS, item.cap.material) +
          (item.cap.emb ? ' · broderie : ' + item.cap.emb : ''));
        lines.push('Logo brodé : ' + (item.cap.logoName || '—'));
      }
      if (item.tassel) {
        lines.push('Gland : ' + labelOf(cat.TASSEL_STYLES, item.tassel.style) +
          (item.tassel.year ? ' / ' + item.tassel.year : ''));
      }
      if (item.hood) {
        lines.push('Écharpe : ' + labelOf(cat.HOOD_STYLES, item.hood.style) +
          (item.hood.emb ? ' · broderie : ' + item.hood.emb : ''));
      }

      lines.push('— Mesures —');
      const fields = cat.MEASUREMENTS.filter((m) => measures[m.id] !== undefined);
      if (!fields.length) lines.push('  —');
      fields.forEach((m) => {
        lines.push('  ' + m.label + ' : ' + (measures[m.id] || '—') + ' ' + m.unit);
      });
    });

    lines.push('', '— COULEURS —', 'À définir avec le client (voir note d’atelier).');
    if (machine.length) {
      lines.push('', '— FICHIERS MACHINE —',
        machine.map((f) => '• ' + f.name).join('\n'));
    }
    lines.push('', '— NOTE ATELIER —', order.adminNote || '—');
    return lines.join('\n');
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
    /* Une ligne par article : une commande de trois pièces donne trois
       lignes partageant la même référence et le même client, ce qui
       reste exploitable dans un tableur. La colonne « Composition »
       décrit la pièce de la ligne, quelle qu'elle soit. */
    const columns = ['Référence', 'Statut', 'Origine', 'Reçue le', 'Article', 'Sur', 'Pièce', 'Prix',
      'Client', 'WhatsApp', 'E-mail', 'Région', 'Université', 'Soutenance',
      'Composition', 'Broderie', 'Mesures', 'Fichiers', 'Note'];
    const cell = (value) => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';

    const rows = [];
    orders.forEach((order) => {
      const client = clientOf(order);
      const items = itemsOf(order);
      const list = items.length ? items : [{}];
      list.forEach((item, index) => {
        const product = item.product ? cat.product(item.product) : null;
        const spec = [];
        const emb = [];

        if (item.robe) {
          spec.push(labelOf(cat.SLEEVES, item.robe.sleeve) + ' / ' +
            labelOf(cat.COLLARS, item.robe.collar) + ' / ' +
            labelOf(cat.TRIM_STYLES, item.robe.trim));
          if (item.robe.emb && item.robe.emb.text) emb.push(item.robe.emb.text);
        }
        if (item.cap) {
          spec.push(labelOf(cat.CAP_STYLES, item.cap.style) + ' / ' +
            labelOf(cat.CAP_MATERIALS, item.cap.material));
          if (item.cap.emb) emb.push(item.cap.emb);
        }
        if (item.tassel) {
          spec.push(labelOf(cat.TASSEL_STYLES, item.tassel.style) +
            (item.tassel.year ? ' / ' + item.tassel.year : ''));
        }
        if (item.hood) {
          spec.push(labelOf(cat.HOOD_STYLES, item.hood.style));
          if (item.hood.emb) emb.push(item.hood.emb);
        }

        const measures = item.measures || {};
        const measureText = cat.MEASUREMENTS
          .filter((m) => measures[m.id])
          .map((m) => m.label + ' ' + measures[m.id] + m.unit)
          .join(' | ');

        rows.push([
          order.ref,
          statusOf(order.status).label,
          (order.config || {}).source === 'manual' ? 'Atelier' : 'Site',
          formatDateTime(order.createdAt),
          index + 1,
          list.length,
          product ? product.label : 'Tenue complète',
          Number(item.price) || '',
          client.name,
          client.whatsapp,
          client.email,
          client.region,
          client.university,
          client.date,
          spec.join(' · '),
          emb.join(' · '),
          measureText,
          (item.files || []).map((f) => f.name).join(' | '),
          order.adminNote,
        ].map(cell).join(';'));
      });
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

  /* ==========================================================
     Nouvelle commande saisie à l'atelier

     Les commandes arrivent parfois par téléphone : ce formulaire
     produit exactement la même structure qu'une commande du site
     (un client + N tenues), simplement marquée `source: 'manual'`.
     Les mesures y sont facultatives — l'atelier les complète souvent
     après un passage en boutique.
     ========================================================== */

  const CLIENT_FIELDS = [
    { id: 'name', label: 'Nom & prénom *', placeholder: 'Ex : Salhi Wafa' },
    { id: 'whatsapp', label: 'Numéro WhatsApp *', type: 'tel', placeholder: 'Ex : 22 123 456' },
    { id: 'email', label: 'E-mail', type: 'email', placeholder: 'vous@exemple.tn' },
    { id: 'region', label: 'Région *', kind: 'region' },
    { id: 'university', label: 'Université / établissement', placeholder: 'Ex : Université de Tunis El Manar' },
    { id: 'date', label: 'Date de soutenance *', type: 'date' },
    { id: 'notes', label: 'Remarques', kind: 'textarea', placeholder: 'Précisions convenues au téléphone…' },
  ];

  let newItemSeq = 0;

  function selectField(name, list, value) {
    return '<select class="ad-input" data-new-item-field="' + name + '">' +
      list.map((entry) => '<option value="' + esc(entry.id) + '"' +
        (entry.id === value ? ' selected' : '') + '>' + esc(entry.label) + '</option>').join('') +
      '</select>';
  }

  /* Les produits auxquels une mesure sert : le tour de tête ne concerne
     que la casquette, la longueur de robe que la robe. */
  function measureOwners(measureId) {
    return cat.PRODUCTS
      .filter((p) => p.measures.indexOf(measureId) > -1)
      .map((p) => p.id).join(' ');
  }

  function newItemMarkup(index) {
    const years = [];
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y <= thisYear + 3; y += 1) years.push(String(y));

    const group = (product, inner) =>
      '<div class="ad-new__grid" data-new-group="' + product + '">' + inner + '</div>';

    return '<article class="ad-new__item" data-new-item="' + index + '" data-product="robe">' +
      '<header class="ad-new__itemHead">' +
        '<h4>Article <span data-new-item-num>' + (index + 1) + '</span></h4>' +
        '<button type="button" class="ad-new__remove" data-new-item-remove' +
          ' aria-label="Retirer cet article">×</button>' +
      '</header>' +

      '<div class="ad-new__grid">' +
        '<label class="ad-new__field ad-new__field--wide"><span>Pièce commandée</span>' +
          '<select class="ad-input" data-new-item-field="product" data-new-product>' +
            cat.PRODUCTS.map((p) => '<option value="' + esc(p.id) + '">' +
              esc(p.label) + ' — ' + esc(cat.price(p.price)) + '</option>').join('') +
          '</select></label>' +
      '</div>' +

      group('robe',
        '<label class="ad-new__field ad-new__field--wide"><span>Texte à broder</span>' +
          '<input class="ad-input" type="text" data-new-item-field="emb" maxlength="40"' +
            ' placeholder="Ex : Dr Salhi Wafa"></label>' +
        '<label class="ad-new__field"><span>Manches</span>' +
          selectField('sleeve', cat.SLEEVES, 'cloche') + '</label>' +
        '<label class="ad-new__field"><span>Col</span>' +
          selectField('collar', cat.COLLARS, 'v') + '</label>' +
        '<label class="ad-new__field"><span>Bordure</span>' +
          selectField('trim', cat.TRIM_STYLES, 'double') + '</label>') +

      group('casquette',
        '<label class="ad-new__field ad-new__field--wide"><span>Broderie du plateau</span>' +
          '<input class="ad-input" type="text" data-new-item-field="capEmb" maxlength="24"' +
            ' placeholder="Ex : Promotion 2026"></label>' +
        '<label class="ad-new__field"><span>Forme</span>' +
          selectField('cap', cat.CAP_STYLES, 'classique') + '</label>' +
        '<label class="ad-new__field"><span>Matière</span>' +
          selectField('capMaterial', cat.CAP_MATERIALS, 'gabardine') + '</label>' +
        '<label class="ad-new__field"><span>Gland</span>' +
          selectField('tassel', cat.TASSEL_STYLES, 'noeud') + '</label>' +
        '<label class="ad-new__field"><span>Année de promotion</span>' +
          '<select class="ad-input" data-new-item-field="year">' +
            '<option value="">Aucune</option>' +
            years.map((y) => '<option value="' + y + '">' + y + '</option>').join('') +
          '</select></label>') +

      group('echarpe',
        '<label class="ad-new__field ad-new__field--wide"><span>Broderie de l’écharpe</span>' +
          '<input class="ad-input" type="text" data-new-item-field="hoodEmb" maxlength="40"' +
            ' placeholder="Ex : Faculté de Médecine de Tunis"></label>' +
        '<label class="ad-new__field"><span>Modèle</span>' +
          selectField('hood', cat.HOOD_STYLES, 'etole-droite') + '</label>') +

      '<details class="ad-new__measures">' +
        '<summary>Mesures (facultatives)</summary>' +
        '<div class="ad-new__grid">' + cat.MEASUREMENTS.map((m) =>
          '<label class="ad-new__field" data-new-measure-for="' + measureOwners(m.id) + '">' +
            '<span>' + esc(m.label) + ' (' + m.unit + ')</span>' +
            '<input class="ad-input" type="number" inputmode="decimal" step="0.5"' +
              ' data-new-measure="' + m.id + '" placeholder="' + m.placeholder + '"' +
              ' min="' + m.min + '" max="' + m.max + '"></label>').join('') +
        '</div>' +
      '</details>' +
    '</article>';
  }

  /* N'affiche que les champs de la pièce choisie : l'atelier ne voit
     pas les options de la robe en saisissant une casquette. */
  function syncNewItem(node) {
    const product = node.getAttribute('data-product') || 'robe';
    node.querySelectorAll('[data-new-group]').forEach((group) => {
      group.hidden = group.getAttribute('data-new-group') !== product;
    });
    node.querySelectorAll('[data-new-measure-for]').forEach((field) => {
      field.hidden = field.getAttribute('data-new-measure-for').split(' ').indexOf(product) === -1;
    });
  }

  function renumberNewItems() {
    const items = document.querySelectorAll('[data-new-item]');
    items.forEach((node, index) => {
      node.querySelector('[data-new-item-num]').textContent = String(index + 1);
      /* Une commande garde au moins un article. */
      node.querySelector('[data-new-item-remove]').hidden = items.length === 1;
    });
  }

  function addNewItem() {
    newItemSeq += 1;
    $('#adNewItems').insertAdjacentHTML('beforeend', newItemMarkup(newItemSeq - 1));
    const node = $('#adNewItems').lastElementChild;
    if (node) syncNewItem(node);
    renumberNewItems();
  }

  function renderNewClient() {
    $('#adNewClient').innerHTML = CLIENT_FIELDS.map((field) => {
      const wide = field.kind === 'textarea' ? ' ad-new__field--wide' : '';
      let control;
      if (field.kind === 'region') {
        control = '<select class="ad-input" data-new-client="region">' +
          '<option value="">— Choisir un gouvernorat —</option>' +
          cat.REGIONS.map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('') +
          '</select>';
      } else if (field.kind === 'textarea') {
        control = '<textarea class="ad-input" rows="2" data-new-client="' + field.id + '"' +
          ' placeholder="' + esc(field.placeholder || '') + '"></textarea>';
      } else {
        control = '<input class="ad-input" type="' + (field.type || 'text') + '"' +
          ' data-new-client="' + field.id + '" placeholder="' + esc(field.placeholder || '') + '">';
      }
      return '<label class="ad-new__field' + wide + '"><span>' + esc(field.label) + '</span>' +
        control + '</label>';
    }).join('');
  }

  function openNewOrder() {
    renderNewClient();
    $('#adNewItems').innerHTML = '';
    newItemSeq = 0;
    addNewItem();
    $('#adNewError').hidden = true;
    const modal = $('#adNewModal');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    const first = modal.querySelector('[data-new-client="name"]');
    if (first) first.focus();
  }

  function closeNewOrder() {
    const modal = $('#adNewModal');
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  /* Construit la commande à partir du formulaire, ou renvoie l'erreur
     qui empêche de l'enregistrer. */
  function collectNewOrder() {
    const client = {};
    CLIENT_FIELDS.forEach((field) => {
      const node = document.querySelector('[data-new-client="' + field.id + '"]');
      client[field.id] = node ? node.value.trim() : '';
    });

    if (client.name.length < 3) return { error: 'Indiquez le nom du client.' };
    if (!client.whatsapp) return { error: 'Indiquez le numéro WhatsApp du client.' };
    if (!client.region) return { error: 'Choisissez la région du client.' };
    if (!client.date) return { error: 'Indiquez la date de soutenance.' };

    const nodes = Array.from(document.querySelectorAll('[data-new-item]'));
    if (!nodes.length) return { error: 'Ajoutez au moins un article.' };

    const collected = nodes.map((node) => {
      const field = (name) => {
        const el = node.querySelector('[data-new-item-field="' + name + '"]');
        return el ? el.value : '';
      };
      const product = cat.product(field('product'));

      /* Comme sur le site, un article ne porte que ses propres mesures. */
      const measures = {};
      cat.measuresFor(product.id).forEach((m) => {
        const el = node.querySelector('[data-new-measure="' + m.id + '"]');
        measures[m.id] = el ? el.value.trim() : '';
      });

      const item = {
        id: 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        product: product.id,
        label: product.label,
        price: product.price,
        addedAt: new Date().toISOString(),
        files: [],
        measures,
      };

      if (product.id === 'robe') {
        item.robe = {
          sleeve: field('sleeve'),
          collar: field('collar'),
          trim: field('trim'),
          emb: { text: field('emb').trim(), uniLogo: null, uniLogoName: '' },
        };
      }
      if (product.id === 'casquette') {
        item.cap = {
          style: field('cap'), material: field('capMaterial'),
          emb: field('capEmb').trim(), logo: null, logoName: '',
        };
        item.tassel = { style: field('tassel'), year: field('year') };
      }
      if (product.id === 'echarpe') {
        item.hood = { style: field('hood'), emb: field('hoodEmb').trim() };
      }

      return item;
    });

    const stamp = new Date();
    const ref = 'ENM-' + stamp.toISOString().slice(2, 10).replace(/-/g, '') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    return {
      order: {
        ref,
        createdAt: stamp.toISOString(),
        status: 'nouveau',
        adminNote: '',
        config: { source: 'manual', client, items: collected, machineFiles: [] },
      },
    };
  }

  function saveNewOrder() {
    const result = collectNewOrder();
    const errorNode = $('#adNewError');
    if (result.error) {
      errorNode.textContent = result.error;
      errorNode.hidden = false;
      return;
    }
    errorNode.hidden = true;

    orders = [result.order].concat(orders);
    if (!persist()) return;
    selectedRef = result.order.ref;
    closeNewOrder();
    renderAll();
    toast('Commande <em>' + esc(result.order.ref) + '</em> enregistrée.');
    pushNewOrder(result.order).then((ok) => {
      if (!ok) toast('Enregistrée localement — synchronisation en attente.');
    });
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
        const file = fileAt(order, preview.getAttribute('data-preview'));
        if (file) openModal(file.name, '<img src="' + esc(file.preview) + '" alt="' + esc(file.name) + '">');
        return;
      }

      const art = event.target.closest('[data-art]');
      if (art) {
        const entry = artworkAt(order, art.getAttribute('data-art'));
        if (entry) openModal(entry.name, '<img src="' + esc(entry.src) + '" alt="' + esc(entry.name) + '">');
        return;
      }

      const machineRemove = event.target.closest('[data-machine-remove]');
      if (machineRemove) {
        const id = machineRemove.getAttribute('data-machine-remove');
        const kept = machineFilesOf(order).filter((f) => f.id !== id);
        saveMachineFiles(order, kept, 'Fichier machine retiré.');
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

    /* Dépôt d'un fichier machine — le panneau étant reconstruit à chaque
       rendu, l'écoute se fait par délégation. */
    $('#adDetail').addEventListener('change', (event) => {
      if (event.target.id !== 'adMachineInput') return;
      const order = orders.find((o) => o.ref === selectedRef);
      if (!order || !event.target.files || !event.target.files.length) return;
      addMachineFiles(order, event.target.files);
      event.target.value = '';
    });

    /* Nouvelle commande saisie à l'atelier */
    $('#adNew').addEventListener('click', openNewOrder);
    $('#adNewAddItem').addEventListener('click', addNewItem);
    $('#adNewForm').addEventListener('submit', (event) => {
      event.preventDefault();
      saveNewOrder();
    });
    $('#adNewItems').addEventListener('click', (event) => {
      if (!event.target.closest('[data-new-item-remove]')) return;
      const node = event.target.closest('[data-new-item]');
      if (node && document.querySelectorAll('[data-new-item]').length > 1) {
        node.remove();
        renumberNewItems();
      }
    });
    /* Changer de pièce n'affiche que les champs qui la concernent. */
    $('#adNewItems').addEventListener('change', (event) => {
      const picker = event.target.closest('[data-new-product]');
      if (!picker) return;
      const node = picker.closest('[data-new-item]');
      if (!node) return;
      node.setAttribute('data-product', picker.value);
      syncNewItem(node);
    });
    $('#adNewModal').addEventListener('click', (event) => {
      if (event.target.closest('[data-new-close]')) closeNewOrder();
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
      if (event.key !== 'Escape') return;
      if ($('#adModal').classList.contains('is-open')) closeModal();
      else if ($('#adNewModal').classList.contains('is-open')) closeNewOrder();
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
