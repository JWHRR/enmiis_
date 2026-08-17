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
    /* Le configurateur ne compose qu'une pièce à la fois : robe,
       casquette ou écharpe. Chacune part au panier séparément. */
    product: 'robe',
    /* Identifiant de la ligne de panier en cours de modification
       (bouton « Modifier » du panier), sinon null pour un ajout. */
    editing: null,
    step: 0,
    files: [],
    robe: { sleeve: 'cloche', collar: 'v', trim: 'double' },
    hood: { style: 'etole-droite', emb: '' },
    cap: { style: 'classique', material: 'gabardine', emb: '', logo: null, logoName: '' },
    tassel: { style: 'noeud', year: '' },
    measures: {
      height: '', weight: '', head: '', chest: '', waist: '',
      hip: '', shoulder: '', sleeve: '', gown: '',
    },
  };

  /* Coordonnées et articles : renseignés au panier, pas dans la tenue.
     `promo` sert à repérer d'où vient la cliente — il n'ouvre aucune
     réduction affichée sur le site. */
  const EMPTY_CLIENT = {
    name: '', whatsapp: '', email: '', region: '', university: '', date: '',
    promo: '', notes: '',
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

  /* Repart d'une configuration vierge en restant sur la même pièce :
     le bouton « réinitialiser » ne renvoie pas le client vers la robe
     alors qu'il configurait sa casquette. */
  function reset() {
    const product = state.product;
    history.length = 0;
    fileRegistry.clear();
    state = clone(DEFAULTS);
    state.product = product;
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
    /* Le champ reste facultatif, mais un code saisi doit exister : sans
       ce refus, la cliente croirait avoir un avantage qu'elle n'a pas. */
    if (c.promo.trim() && !CZ.catalog.isPromo(c.promo)) {
      errors.promo = 'Ce code promo n’existe pas. Vérifiez-le ou laissez le champ vide.';
    }
    return errors;
  }

  /* Une étape est franchissable si ses données obligatoires sont valides.
     Les règles dépendent de la pièce en cours : seule la robe exige un
     fichier de production et un texte à broder, et chaque pièce ne
     demande que ses propres mesures. */
  function stepErrors(stepId) {
    const catalog = CZ.catalog;
    const product = catalog.product(state.product);

    if (stepId === 'upload') {
      if (!product.fileRequired) return [];
      return state.files.length ? [] : ['Ajoutez le design à broder sur votre robe.'];
    }
    if (stepId === 'measure') {
      const missing = catalog.measuresFor(state.product)
        .filter((field) => measureError(field, state.measures[field.id]))
        .map((field) => field.label);
      return missing.length ? ['Mesures à compléter : ' + missing.join(', ') + '.'] : [];
    }
    return [];
  }

  /* Change de pièce : le configurateur repart de son écran d'accueil,
     sans toucher au panier déjà constitué. */
  function setProduct(productId) {
    const known = CZ.catalog.product(productId).id;
    if (state.product === known) return;
    history.length = 0;
    fileRegistry.clear();
    state = clone(DEFAULTS);
    state.product = known;
    save();
  }

  function isComplete(stepId) { return stepErrors(stepId).length === 0; }

  /* ---------- Transmission vers l’espace admin ---------- */

  function reference() {
    const now = new Date();
    const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'ENM-' + stamp + '-' + rand;
  }

  /* Une pièce prête à rejoindre le panier. On ne conserve que les
     réglages qui la concernent — une casquette ne porte pas les
     options de la robe — ainsi que ses seules mesures utiles.
     Les aperçus d'image sont gardés pour l'atelier ; les formats
     vectoriels propriétaires (AI, EPS, CDR) n'ont pas de rendu
     navigateur et ne sont référencés que par leur nom. */
  function buildItem() {
    const catalog = CZ.catalog;
    const product = catalog.product(state.product);

    const item = {
      id: 'it' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      product: product.id,
      label: product.label,
      addedAt: new Date().toISOString(),
      measures: {},
      files: state.files.map((file) => ({
        id: file.id, name: file.name, size: file.size, ext: file.ext, label: file.label,
        preview: file.previewable ? file.dataUrl : '',
      })),
    };

    catalog.measuresFor(product.id).forEach((field) => {
      item.measures[field.id] = state.measures[field.id];
    });

    if (product.id === 'robe') item.robe = clone(state.robe);
    if (product.id === 'casquette') {
      item.cap = clone(state.cap);
      item.tassel = clone(state.tassel);
    }
    if (product.id === 'echarpe') item.hood = clone(state.hood);

    return item;
  }

  /* Recharge une ligne du panier dans le configurateur (bouton
     « Modifier »). Les fichiers reviennent avec leur aperçu : le
     contenu binaire d'origine n'ayant pas été conservé, c'est cet
     aperçu qui repart à l'atelier si le client ne les remplace pas. */
  function loadCartItem(id) {
    const item = readCart().items.find((entry) => entry.id === id);
    if (!item) return null;

    history.length = 0;
    fileRegistry.clear();

    const draft = clone(DEFAULTS);
    draft.product = CZ.catalog.product(item.product).id;
    draft.editing = item.id;
    mergeInto(draft.measures, item.measures);
    if (item.robe) mergeInto(draft.robe, item.robe);
    if (item.cap) mergeInto(draft.cap, item.cap);
    if (item.tassel) mergeInto(draft.tassel, item.tassel);
    if (item.hood) mergeInto(draft.hood, item.hood);

    draft.files = (item.files || []).map((file) => {
      const restored = {
        id: file.id, name: file.name, size: file.size, ext: file.ext,
        label: file.label, previewable: Boolean(file.preview), dataUrl: file.preview || '',
      };
      fileRegistry.set(restored.id, restored);
      return restored;
    });

    state = draft;
    save();
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
    /* Si la cliente a un compte, js/account.js écoute cet évènement
       pour que son panier la suive d'un appareil à l'autre. */
    try { document.dispatchEvent(new CustomEvent('enmiis:cart')); }
    catch (err) { /* environnement sans DOM : rien à notifier */ }
    return cart;
  }

  /* Millisecondes restantes avant expiration (0 si panier vide/expiré). */
  function cartExpiresIn() {
    const cart = readCart();
    if (!cart.items.length || !cart.savedAt) return 0;
    return Math.max(0, cart.savedAt + CART_TTL_MS - Date.now());
  }

  function cartCount() { return readCart().items.length; }

  /* Ajoute la pièce en cours au panier — ou remplace celle qu'on est en
     train de modifier, à sa place dans la liste. Si le quota du
     navigateur est atteint, on retente sans les aperçus d'image plutôt
     que d'échouer. */
  function addToCart() {
    const cart = readCart();
    const item = buildItem();
    const editing = state.editing;
    const index = editing ? cart.items.findIndex((entry) => entry.id === editing) : -1;

    if (index > -1) {
      /* On garde l'identifiant d'origine : le panier ne bouge pas. */
      item.id = editing;
      cart.items.splice(index, 1, item);
    } else {
      cart.items.push(item);
    }

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
    /* La commande est partie : le compte ne doit pas garder l'ancien
       panier en réserve. */
    try { document.dispatchEvent(new CustomEvent('enmiis:cart')); }
    catch (err) { /* environnement sans DOM */ }
  }

  /* Une commande = un client + un ou plusieurs articles. */
  function buildOrder(cart) {
    const client = clone(cart.client);
    /* Le code est mis en forme une fois pour toutes : l'atelier n'a
       pas à deviner entre « ihec carthage » et « IHEC_CARTHAGE ». */
    client.promo = CZ.catalog.normalizePromo(client.promo);

    return {
      ref: reference(),
      createdAt: new Date().toISOString(),
      status: 'nouveau',
      adminNote: '',
      config: {
        source: 'web',
        client,
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
    measureError, clientErrors, stepErrors, isComplete, setProduct,
    readCart, addToCart, removeCartItem, setCartClient, clearCart,
    loadCartItem, cartCount, cartExpiresIn,
    submitCart, readOrders,
  };
})(window);
