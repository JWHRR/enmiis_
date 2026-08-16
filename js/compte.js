/* ============================================================
   ENMIIS — Page « Mon compte ».
   Inscription, connexion, et rappel de ce que le compte apporte
   à la cliente : son panier ne disparaît plus.
   ============================================================ */
(function (global) {
  'use strict';

  const account = global.enmiisAccount;
  const cat = (global.CZ || {}).catalog;
  const store = (global.CZ || {}).store;
  const toast = global.enmiisToast || function () {};

  const $ = (sel) => document.querySelector(sel);

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- Rendu ---------- */

  function renderCartLink() {
    const link = $('#acCartLink');
    if (!link || !store) return;
    const count = store.cartCount();
    link.hidden = count === 0;
    link.textContent = count ? count + ' article' + (count > 1 ? 's' : '') : '';
  }

  function renderProfile(client) {
    $('#acLoading').hidden = true;
    $('#acProfile').hidden = !client;
    $('#acGuest').hidden = Boolean(client);
    renderCartLink();
    if (!client) return;

    $('#acName').textContent = client.name;
    $('#acFacts').innerHTML = [
      { label: 'Téléphone', value: client.phone },
      { label: 'Vous êtes de', value: client.origin || '—' },
      { label: 'Adresse', value: client.address || '—' },
    ].map((row) =>
      '<div class="ac-fact"><dt>' + esc(row.label) + '</dt>' +
      '<dd>' + esc(row.value) + '</dd></div>').join('');
  }

  /* ---------- Bascule inscription / connexion ---------- */

  function showTab(which) {
    const isLogin = which === 'login';
    $('#acRegisterForm').hidden = isLogin;
    $('#acLoginForm').hidden = !isLogin;
    $('#acTabRegister').classList.toggle('is-active', !isLogin);
    $('#acTabLogin').classList.toggle('is-active', isLogin);
    $('#acTabRegister').setAttribute('aria-selected', String(!isLogin));
    $('#acTabLogin').setAttribute('aria-selected', String(isLogin));
    $('#acTitle').textContent = isLogin ? 'Me connecter' : 'Créer mon compte';
    $('#acSub').textContent = isLogin
      ? 'Entrez le numéro et le mot de passe de votre compte.'
      : 'Pour que votre panier ne se perde pas, et que vous le retrouviez depuis ' +
        'n’importe quel appareil.';
  }

  function showError(node, message) {
    node.textContent = message || '';
    node.hidden = !message;
  }

  /* ---------- Envoi ---------- */

  async function submit(button, errorNode, run) {
    const label = button.textContent;
    showError(errorNode, '');
    button.disabled = true;
    button.textContent = 'Un instant…';
    try {
      const client = await run();
      /* Le panier composé avant l'inscription est déjà rattaché au
         compte par account.js : on renvoie la cliente là où elle
         allait. */
      const next = store && store.cartCount() ? 'panier.html' : 'compte.html';
      toast('Bienvenue <em>' + esc(client.name) + '</em> — votre panier est en sécurité.');
      setTimeout(() => { global.location.href = next; }, 700);
    } catch (err) {
      showError(errorNode, err.message || 'Une erreur est survenue.');
      button.disabled = false;
      button.textContent = label;
    }
  }

  function bind() {
    $('#acTabRegister').addEventListener('click', () => showTab('register'));
    $('#acTabLogin').addEventListener('click', () => showTab('login'));

    $('#acRegisterForm').addEventListener('submit', (event) => {
      event.preventDefault();
      submit($('#acRegisterBtn'), $('#acRegisterError'), () => account.register({
        name: $('#ac_name').value,
        phone: $('#ac_phone').value,
        origin: $('#ac_origin').value,
        address: $('#ac_address').value,
        password: $('#ac_password').value,
      }));
    });

    $('#acLoginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      submit($('#acLoginBtn'), $('#acLoginError'),
        () => account.login($('#ac_login_phone').value, $('#ac_login_password').value));
    });

    $('#acLogout').addEventListener('click', () => {
      account.logout();
      toast('Vous êtes déconnectée. Votre panier reste sur cet appareil.');
      renderProfile(null);
    });
  }

  function init() {
    if (!account) return;

    /* Les gouvernorats servent aussi bien au compte qu'à la commande. */
    const origin = $('#ac_origin');
    if (origin && cat) {
      origin.innerHTML = '<option value="">— Choisir un gouvernorat —</option>' +
        cat.REGIONS.map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');
    }

    bind();
    /* Onglet « connexion » d'emblée si on arrive depuis un lien de
       connexion (panier, en-tête). */
    if (/[?&]mode=login/.test(global.location.search)) showTab('login');

    account.whenReady(renderProfile);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
