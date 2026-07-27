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
  const MAX_HISTORY = 80;

  const DEFAULTS = {
    step: 0,
    files: [],
    robe: {
      main: 'noir', secondary: 'or', sleeveColor: 'match', sleeve: 'cloche',
      collar: 'v', trim: 'double', trimColor: 'or', fabric: 'gabardine',
      emb: {
        enabled: false, text: '', font: 'serif', thread: 'or', position: 'chest-right',
        uniLogo: null, uniLogoName: '', facLogo: null, facLogoName: '',
      },
    },
    hood: { style: 'etole-droite', outer: 'noir', inner: 'blanc', border: 'or', faculty: 'sciences', emb: '' },
    cap: { style: 'classique', color: 'noir', material: 'gabardine', button: 'or', emb: '', logo: null, logoName: '' },
    tassel: { style: 'noeud', color: 'or', year: '', yearCharm: 'or', facultyCharm: 'aucun' },
    measures: {
      height: '', weight: '', head: '', chest: '', waist: '',
      hip: '', shoulder: '', sleeve: '', gown: '',
    },
    client: { name: '', whatsapp: '', email: '', region: '', university: '', date: '', notes: '' },
    submitted: null,
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
      merged.submitted = null;
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

  function clientErrors() {
    const c = state.client;
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
    if (stepId === 'measure') {
      const missing = catalog.MEASUREMENTS
        .filter((field) => measureError(field, state.measures[field.id]))
        .map((field) => field.label);
      return missing.length ? ['Mesures à compléter : ' + missing.join(', ') + '.'] : [];
    }
    if (stepId === 'review') {
      const errors = clientErrors();
      return Object.keys(errors).length ? ['Complétez vos coordonnées avant l’envoi.'] : [];
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

  function buildOrder() {
    const payload = clone(state);
    delete payload.step;
    delete payload.submitted;
    payload.files = state.files.map((file) => ({
      id: file.id, name: file.name, size: file.size, ext: file.ext, label: file.label,
      /* L’aperçu image est conservé pour l’atelier ; les formats vectoriels
         propriétaires (AI, EPS, CDR) n’ont pas de rendu navigateur. */
      preview: file.previewable ? file.dataUrl : '',
    }));
    return {
      ref: reference(),
      createdAt: new Date().toISOString(),
      status: 'nouveau',
      adminNote: '',
      config: payload,
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

  /* Enregistre la commande dans la file consultée par admin.html.
     Retourne l’objet commande, ou lève une erreur si le stockage est plein. */
  function submit() {
    const order = buildOrder();
    const orders = readOrders();
    orders.unshift(order);
    try {
      writeOrders(orders);
    } catch (err) {
      /* Quota atteint : on retente sans les aperçus d’image. */
      order.config.files = order.config.files.map((file) => ({ ...file, preview: '' }));
      orders[0] = order;
      writeOrders(orders);
    }
    commit((draft) => { draft.submitted = { ref: order.ref, createdAt: order.createdAt }; });
    return order;
  }

  restore();

  CZ.store = {
    DEFAULTS,
    get, at, set, type, commit,
    addFiles, replaceFile, removeFile,
    undo, canUndo, reset,
    measureError, clientErrors, stepErrors, isComplete,
    submit, readOrders,
  };
})(window);
