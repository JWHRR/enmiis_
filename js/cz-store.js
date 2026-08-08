/* ============================================================
   ENMIIS — Configurateur : état, historique, persistance,
   validation et transmission de la commande à l’espace admin.
   Expose window.CZ.store
   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ || (global.CZ = {});
  const STATE_KEY = 'enmiis-configurator-v3';
  const ORDERS_KEY = 'enmiis-orders-v1';
  const CART_KEY = 'enmiis-cart-v1';
  const MAX_HISTORY = 80;

  /* Le client n'a pas de compte : son panier vit dans son navigateur et
     expire au bout de 24 h, comme une session. Passé ce délai il est
     vidé au premier accès plutôt que de ressusciter une commande
     oubliée depuis des jours. */
  const CART_TTL_MS = 24 * 60 * 60 * 1000;

  /* API partagée (voir api/orders.js) : chemin relatif, car le
     configurateur et l'espace atelier vivent sur le même domaine
     Vercel. Sans elle, la commande reste valable en local — voir
     pushOrder() plus bas. */
  const API_BASE = '/api/orders';
  const SUPABASE_REST_URL = 'https://kzqpvtrgchtiffcyxzfy.supabase.co/rest/v1/orders';
  const SUPABASE_KEY = 'sb_publishable_x8IMyzlq6tqxbXITcP6YRg_-CnC0mj-';

  const CLOUD_ENABLED = true;

  /* Les couleurs ne se choisissent plus dans le configurateur : elles sont
     définies par l'atelier lors de la confirmation. Le client ne choisit
     que les modèles, illustrés un à un. */
  const DEFAULTS = {
    step: 0,
    files: [],
    robe: {
      sleeve: 'cloche', collar: 'v', trim: 'double',
      /* La broderie fait partie de la commande : le texte à broder est
         demandé à tous. Police et emplacement sont arrêtés par l'atelier,
         comme les couleurs. */
      emb: { text: '', uniLogo: null, uniLogoName: '' },
    },
    hood: { style: 'etole-droite', emb: '' },
    cap: { style: 'classique', material: 'gabardine', emb: '', logo: null, logoName: '' },
    tassel: { style: 'noeud', year: '' },
    measures: {
      height: '', weight: '', head: '', chest: '', waist: '',
      hip: '', shoulder: '', sleeve: '', gown: '',
    },
  };

  /* Coordonnées et articles : renseignés au panier, pas dans la tenue. */
  const EMPTY_CLIENT = {
    name: '', whatsapp: '', email: '', region: '', university: '', date: '', notes: '',
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  let state = clone(DEFAULTS);
  const history = [];

  /* Les données binaires des fichiers vivent hors de l’état : l’historique
     n’en conserve que les identifiants, et ce registre permet de
     réhydrater un fichier retiré lorsqu’on annule la suppression.
     Il est vidé uniquement par reset(). */
  const fileRegistry = new Map();

  /* ---------- Persistance ---------- */

  /* Les fichiers téléversés sont conservés en mémoire uniquement :
     leurs données binaires ne sont pas écrites dans localStorage
     pour ne pas dépasser le quota du navigateur. */
  function persistable(source) {
    const copy = clone(source);
    copy.files = source.files.map((file) => ({
      id: file.id, name: file.name, size: file.size, ext: file.ext, label: file.label, dataUrl: '',
    }));
    return copy;
  }

  function save() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(persistable(state)));
    } catch (err) {
      /* quota ou mode privé : la configuration reste valable pour la session */
    }
  }

  function mergeInto(target, source) {
    Object.keys(target).forEach((key) => {
      const incoming = source ? source[key] : undefined;
      if (incoming === undefined || incoming === null) return;
      if (Array.isArray(target[key])) target[key] = incoming;
      else if (typeof target[key] === 'object') mergeInto(target[key], incoming);
      else target[key] = incoming;
    });
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const merged = clone(DEFAULTS);
      mergeInto(merged, parsed);
      /* Les fichiers restaurés n’ont plus leur contenu : on repart à vide. */
      merged.files = [];
      state = merged;
    } catch (err) {
      state = clone(DEFAULTS);
    }
  }

  /* ---------- Lecture / écriture ---------- */

  function get() { return state; }

  function at(path) {
    return path.split('.').reduce((node, key) => (node == null ? node : node[key]), state);
  }

  function assign(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const node = keys.reduce((acc, key) => acc[key], state);
    node[last] = value;
  }

  /* Modification enregistrée dans l’historique (annulable). */
  function commit(mutator) {
    history.push(persistable(state));
    if (history.length > MAX_HISTORY) history.shift();
    mutator(state);
    save();
  }

  function set(path, value) {
    if (at(path) === value) return;
    commit(() => assign(path, value));
  }

  /* Saisie au clavier : une seule entrée d’historique par salve de frappe. */
  let burstBase = null;
  let burstTimer = null;
  function type(path, value) {
    if (burstBase === null) burstBase = persistable(state);
    assign(path, value);
    clearTimeout(burstTimer);
    burstTimer = setTimeout(() => {
      history.push(burstBase);
      if (history.length > MAX_HISTORY) history.shift();
      burstBase = null;
      save();
    }, 400);
  }

  function undo() {
    if (!history.length) return false;
    const previous = history.pop();
    state = previous;
    /* L’instantané ne porte que des références : on récupère les fichiers
       complets dans le registre, dans l’ordre enregistré. */
    state.files = previous.files
      .map((file) => fileRegistry.get(file.id))
      .filter(Boolean);
    save();
    return true;
  }

  /* ---------- Fichiers de production ---------- */

  function addFiles(files) {
    files.forEach((file) => fileRegistry.set(file.id, file));
    commit((draft) => { draft.files = draft.files.concat(files); });
  }

  function replaceFile(id, file) {
    fileRegistry.set(file.id, file);
    commit((draft) => {
      const index = draft.files.findIndex((entry) => entry.id === id);
      if (index > -1) draft.files.splice(index, 1, file);
      else draft.files.push(file);
    });
  }

  function removeFile(id) {
    commit((draft) => { draft.files = draft.files.filter((file) => file.id !== id); });
  }

  function canUndo() { return history.length > 0; }

  function reset() {
    history.length = 0;
    fileRegistry.clear();
    state = clone(DEFAULTS);
    save();
  }

  /* ---------- Validation ---------- */

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* Numéro tunisien : 8 chiffres commençant par 2 à 9, avec indicatif
     facultatif (+216, 216, 00216) et n’importe quel groupement de saisie
     — « 22123456 », « 22 123 456 », « +216 22-12-34-56 » sont acceptés. */
  function validPhone(raw) {
    const digits = String(raw).replace(/[^\d]/g, '');
    const local = digits.replace(/^(?:00216|216)/, '');
    return /^[2-9]\d{7}$/.test(local);
  }

  function measureError(field, raw) {
    const value = String(raw).trim();
    if (!value) return 'Mesure requise.';
    const num = Number(value.replace(',', '.'));
    if (!Number.isFinite(num)) return 'Saisissez un nombre.';
    if (num < field.min) return 'Minimum ' + field.min + ' ' + field.unit + '.';
    if (num > field.max) return 'Maximum ' + field.max + ' ' + field.unit + '.';
    return '';
  }

  /* Valide les coordonnées du panier (le configurateur ne les porte plus). */
  function clientErrors(client) {
    const c = Object.assign({}, EMPTY_CLIENT, client || {});
    const errors = {};
    if (!c.name.trim() || c.name.trim().length < 3) errors.name = 'Indiquez votre nom complet.';
    if (!validPhone(c.whatsapp)) errors.whatsapp = 'Numéro tunisien attendu (8 chiffres).';
    if (c.email.trim() && !EMAIL_RE.test(c.email.trim())) errors.email = 'Adresse e-mail invalide.';
    if (!c.region) errors.region = 'Choisissez votre région.';
    if (!c.date) errors.date = 'Indiquez la date de soutenance.';
    else if (c.date < new Date().toISOString().slice(0, 10)) errors.date = 'La date doit être à venir.';
    return errors;
  }

  /* Une étape est franchissable si ses données obligatoires sont valides. */
  function stepErrors(stepId) {
    const catalog = CZ.catalog;
    if (stepId === 'upload') {
      return state.files.length ? [] : ['Ajoutez au moins un fichier de production.'];
    }
    if (stepId === 'robe') {
      /* La broderie est comprise dans la commande : on demande à tous
         ce qui doit être brodé (nom, titre, mention…). */
      return state.robe.emb.text.trim()
        ? []
        : ['Indiquez le texte à broder sur la robe.'];
    }
    if (stepId === 'measure') {
      const missing = catalog.MEASUREMENTS
        .filter((field) => measureError(field, state.measures[field.id]))
        .map((field) => field.label);
      return missing.length ? ['Mesures à compléter : ' + missing.join(', ') + '.'] : [];
    }
    return [];
  }

  function isComplete(stepId) { return stepErrors(stepId).length === 0; }

  /* ---------- Transmission vers l’espace admin ---------- */

  function reference() {
    const now = new Date();
    const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'ENM-' + stamp + '-' + rand;
  }

  /* Une tenue prête à rejoindre le panier : les aperçus d'image sont
     conservés pour l'atelier, les formats vectoriels propriétaires
     (AI, EPS, CDR) n'ayant pas de rendu navigateur. */
  function buildItem() {
    const item = clone(state);
    delete item.step;
    item.id = 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    item.addedAt = new Date().toISOString();
    item.files = state.files.map((file) => ({
      id: file.id, name: file.name, size: file.size, ext: file.ext, label: file.label,
      preview: file.previewable ? file.dataUrl : '',
    }));
    return item;
  }

  /* ---------- Panier (24 h, sans compte) ---------- */

  const EMPTY_CART = { savedAt: 0, items: [], client: clone(EMPTY_CLIENT) };

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return clone(EMPTY_CART);
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return clone(EMPTY_CART);
      /* Session expirée : on repart d'un panier vide. */
      if (!parsed.savedAt || Date.now() - parsed.savedAt > CART_TTL_MS) {
        localStorage.removeItem(CART_KEY);
        return clone(EMPTY_CART);
      }
      parsed.client = Object.assign(clone(EMPTY_CLIENT), parsed.client || {});
      return parsed;
    } catch (err) {
      return clone(EMPTY_CART);
    }
  }

  function writeCart(cart) {
    cart.savedAt = Date.now();
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    return cart;
  }

  /* Millisecondes restantes avant expiration (0 si panier vide/expiré). */
  function cartExpiresIn() {
    const cart = readCart();
    if (!cart.items.length || !cart.savedAt) return 0;
    return Math.max(0, cart.savedAt + CART_TTL_MS - Date.now());
  }

  function cartCount() { return readCart().items.length; }

  /* Ajoute la tenue en cours au panier. Si le quota du navigateur est
     atteint, on retente sans les aperçus d'image plutôt que d'échouer. */
  function addToCart() {
    const cart = readCart();
    const item = buildItem();
    cart.items.push(item);
    try {
      writeCart(cart);
    } catch (err) {
      cart.items = cart.items.map((entry) => Object.assign({}, entry, {
        files: (entry.files || []).map((f) => Object.assign({}, f, { preview: '' })),
      }));
      writeCart(cart);
    }
    return item;
  }

  function removeCartItem(id) {
    const cart = readCart();
    cart.items = cart.items.filter((item) => item.id !== id);
    writeCart(cart);
    return cart;
  }

  function setCartClient(client) {
    const cart = readCart();
    cart.client = Object.assign(clone(EMPTY_CLIENT), client || {});
    writeCart(cart);
    return cart;
  }

  function clearCart() {
    try { localStorage.removeItem(CART_KEY); } catch (err) { /* rien à effacer */ }
  }

  /* Une commande = un client + une ou plusieurs tenues. */
  function buildOrder(cart) {
    return {
      ref: reference(),
      createdAt: new Date().toISOString(),
      status: 'nouveau',
      adminNote: '',
      config: {
        source: 'web',
        client: clone(cart.client),
        items: clone(cart.items),
        machineFiles: [],
      },
    };
  }

  function readOrders() {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }

  /* Envoie la commande à l'API partagée (Vercel KV) pour qu'elle
     atteigne l'espace atelier depuis n'importe quel appareil. N'échoue
     jamais bruyamment : réseau coupé ou stockage cloud pas encore
     activé retournent simplement false, et la commande reste valable
     en local (voir submit() et syncPendingOrders() ci-dessous). */
  async function pushOrder(order) {
    if (!CLOUD_ENABLED) return false;
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (res.ok) {
        console.log('[ENMIIS Sync] Order sent to API_BASE:', order.ref);
        return true;
      }
    } catch (err) {
      console.warn('[ENMIIS Sync] API_BASE unavailable, using direct Supabase REST');
    }

    try {
      const row = {
        ref: order.ref,
        created_at: order.createdAt || new Date().toISOString(),
        status: order.status || 'nouveau',
        admin_note: order.adminNote || '',
        config: order.config,
      };
      const res = await fetch(SUPABASE_REST_URL + '?on_conflict=ref', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(row),
      });
      if (res.ok) {
        console.log('[ENMIIS Sync] Order sent directly to Supabase:', order.ref);
        return true;
      } else {
        const txt = await res.text();
        console.error('[ENMIIS Sync] Supabase REST error:', res.status, txt);
        return false;
      }
    } catch (err) {
      console.error('[ENMIIS Sync] Supabase network error:', err);
      return false;
    }
  }

  /* Enregistre la commande dans la file consultée par admin.html, puis
     tente de la transmettre au serveur partagé. Retourne la commande
     (avec son indicateur `synced`), ou lève une erreur si le stockage
     local lui-même est inutilisable. */
  /* Envoie le panier entier : une commande, un client, N tenues.
     La commande est d'abord enregistrée localement (elle n'est jamais
     perdue), puis transmise au serveur partagé. */
  async function submitCart() {
    const cart = readCart();
    if (!cart.items.length) throw new Error('empty_cart');

    const order = buildOrder(cart);
    const orders = readOrders();
    orders.unshift(order);
    try {
      writeOrders(orders);
    } catch (err) {
      /* Quota atteint : on retente sans les aperçus d'image. */
      order.config.items = order.config.items.map((item) => Object.assign({}, item, {
        files: (item.files || []).map((f) => Object.assign({}, f, { preview: '' })),
      }));
      orders[0] = order;
      writeOrders(orders);
    }

    const synced = await pushOrder(order);
    order.synced = synced;
    if (synced) {
      const stored = readOrders();
      const idx = stored.findIndex((o) => o.ref === order.ref);
      if (idx > -1) { stored[idx].synced = true; writeOrders(stored); }
    }
    return order;
  }

  /* Si une commande précédente n'a pas pu atteindre le serveur (réseau
     coupé au moment de l'envoi, stockage cloud pas encore activé), on
     retente en tâche de fond à l'ouverture suivante du configurateur —
     sans bloquer le chargement ni redéclencher de rendu. */
  function syncPendingOrders() {
    if (!CLOUD_ENABLED) return;
    let stored;
    try { stored = readOrders(); } catch (err) { return; }
    stored.filter((o) => o.synced !== true).forEach((order) => {
      pushOrder(order).then((ok) => {
        if (!ok) return;
        const current = readOrders();
        const idx = current.findIndex((o) => o.ref === order.ref);
        if (idx > -1) { current[idx].synced = true; writeOrders(current); }
      });
    });
  }

  restore();
  syncPendingOrders();

  CZ.store = {
    DEFAULTS, EMPTY_CLIENT, CART_TTL_MS,
    get, at, set, type, commit,
    addFiles, replaceFile, removeFile,
    undo, canUndo, reset,
    measureError, clientErrors, stepErrors, isComplete,
    readCart, addToCart, removeCartItem, setCartClient, clearCart,
    cartCount, cartExpiresIn,
    submitCart, readOrders,
  };
})(window);
