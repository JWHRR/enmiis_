/* ============================================================
   ENMIIS — Compte client, côté navigateur.

   Le compte est facultatif : on ne le demande jamais à l'arrivée sur
   le site. Il sert à une seule chose du point de vue de la cliente —
   que son panier ne disparaisse pas, et qu'elle le retrouve depuis un
   autre téléphone ou un ordinateur.

   Rien de sensible ne vit ici : le mot de passe part directement à
   api/auth.js, qui seul parle à la base. Ce module ne conserve qu'un
   jeton de session signé.

   Expose window.enmiisAccount
   ============================================================ */
(function (global) {
  'use strict';

  const TOKEN_KEY = 'enmiis-account-v1';
  const CART_KEY = 'enmiis-cart-v1';
  const API = '/api/auth';

  let client = null;      /* profil connecté, ou null */
  let ready = false;
  const waiting = [];

  /* ---------- Jeton ---------- */

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; }
    catch (err) { return ''; }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (err) { /* mode privé : la session vaut pour cet onglet */ }
  }

  /* ---------- Appels ---------- */

  async function call(action, payload) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action }, payload || {})),
      });
    } catch (err) {
      throw new Error('Service injoignable — vérifiez votre connexion.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const error = new Error((data && data.message) || 'Une erreur est survenue.');
      error.code = data && data.error;
      throw error;
    }
    return data;
  }

  /* ---------- Panier lié au compte ---------- */

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && Array.isArray(parsed.items) ? parsed : null;
    } catch (err) { return null; }
  }

  function writeCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    catch (err) { /* quota atteint : le panier reste celui du serveur */ }
  }

  /* Envoie le panier courant au compte. Silencieux : une panne de
     réseau ne doit pas empêcher la cliente de continuer ses achats. */
  async function pushCart() {
    if (!client) return;
    try { await call('cart', { token: token(), cart: readCart() }); }
    catch (err) { /* on retentera au prochain changement */ }
  }

  /* À la connexion : le panier en cours l'emporte s'il contient
     quelque chose — la cliente vient de le composer. Sinon on
     restaure celui qui dort sur le compte. */
  function mergeCart(remote) {
    const local = readCart();
    if (local && local.items.length) { pushCart(); return; }
    if (remote && Array.isArray(remote.items) && remote.items.length) {
      remote.savedAt = Date.now();
      writeCart(remote);
    }
  }

  /* ---------- Session ---------- */

  function settle(profile) {
    client = profile;
    ready = true;
    waiting.splice(0).forEach((fn) => fn(client));
    document.dispatchEvent(new CustomEvent('enmiis:account', { detail: { client } }));
  }

  async function restore() {
    if (!token()) { settle(null); return; }
    try {
      const data = await call('session', { token: token() });
      mergeCart(data.cart);
      settle(data.client);
    } catch (err) {
      /* Jeton expiré ou service coupé : on repart déconnecté sans
         effacer le panier local. */
      if (err.code === 'no_session') setToken('');
      settle(null);
    }
  }

  /* ---------- API publique ---------- */

  async function register(fields) {
    const data = await call('register', fields);
    setToken(data.token);
    settle(data.client);
    await pushCart();
    return data.client;
  }

  async function login(phone, password) {
    const data = await call('login', { phone, password });
    setToken(data.token);
    const profile = await call('session', { token: data.token }).catch(() => null);
    mergeCart(profile && profile.cart);
    settle(data.client);
    return data.client;
  }

  function logout() {
    setToken('');
    settle(null);
  }

  /* Attendre la fin de la restauration de session. */
  function whenReady(fn) {
    if (ready) fn(client);
    else waiting.push(fn);
  }

  global.enmiisAccount = {
    register, login, logout, whenReady, pushCart,
    current: () => client,
    isReady: () => ready,
  };

  /* Le panier change (ajout, retrait, commande envoyée) : on le
     reflète sur le compte. cz-store émet cet évènement. */
  document.addEventListener('enmiis:cart', pushCart);

  restore();
})(window);
