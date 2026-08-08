/* ============================================================
   ENMIIS — Panier.

   Le client n'a pas de compte : son panier vit dans le navigateur
   et expire au bout de 24 h (voir CART_TTL_MS dans cz-store.js).
   Il peut y déposer plusieurs tenues, puis ne saisit ses
   coordonnées qu'une seule fois — une commande = un client + N
   tenues, ce que l'espace atelier sait afficher article par article.

   ============================================================ */
(function (global) {
  'use strict';

  const CZ = global.CZ;
  const cat = CZ.catalog;
  const store = CZ.store;
  const toast = global.enmiisToast || function () {};

  const $ = (sel) => document.querySelector(sel);

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const label = (list, id) => (cat.find(list, id) || {}).label || '—';

  /* ---------- Résumé d'une tenue ---------- */

  function itemLines(item) {
    return [
      { label: 'Manches', value: label(cat.SLEEVES, item.robe.sleeve) },
      { label: 'Col', value: label(cat.COLLARS, item.robe.collar) },
      { label: 'Bordure', value: label(cat.TRIM_STYLES, item.robe.trim) },
      { label: 'Broderie', value: (item.robe.emb.text || '—') },
      { label: 'Capuche', value: label(cat.HOOD_STYLES, item.hood.style) },
      { label: 'Mortier', value: label(cat.CAP_STYLES, item.cap.style) + ' · ' +
        label(cat.CAP_MATERIALS, item.cap.material) },
      { label: 'Gland', value: label(cat.TASSEL_STYLES, item.tassel.style) +
        (item.tassel.year ? ' · ' + item.tassel.year : '') },
    ];
  }

  /* Vignette : le design envoyé par le client, sinon la photo de robe. */
  function itemThumb(item) {
    const shot = (item.files || []).find((f) => f.preview);
    return shot
      ? '<img src="' + esc(shot.preview) + '" alt="" loading="lazy" decoding="async">'
      : '<img src="img/robe.webp" alt="" loading="lazy" decoding="async">';
  }

  function renderItems(cart) {
    $('#pnList').innerHTML = cart.items.map((item, index) =>
      '<li class="pn-item" data-item="' + esc(item.id) + '">' +
        '<span class="pn-item__num">Tenue ' + (index + 1) + '</span>' +
        '<div class="pn-item__thumb">' + itemThumb(item) + '</div>' +
        '<div class="pn-item__body">' +
          '<p class="pn-item__name">' + esc(item.robe.emb.text || 'Tenue de soutenance') + '</p>' +
          '<dl class="pn-item__spec">' + itemLines(item).map((row) =>
            '<div><dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd></div>').join('') +
          '</dl>' +
          '<p class="pn-item__files">' + (item.files || []).length + ' fichier(s) · ' +
            '9 mesures</p>' +
        '</div>' +
        '<button type="button" class="pn-item__remove" data-remove="' + esc(item.id) + '"' +
          ' aria-label="Retirer la tenue ' + (index + 1) + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
        '</button>' +
      '</li>').join('');
  }

  /* ---------- Compte à rebours de la session ---------- */

  function renderExpiry() {
    const node = $('#pnExpiry');
    const ms = store.cartExpiresIn();
    if (!ms) { node.hidden = true; return; }
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    node.hidden = false;
    node.textContent = hours >= 1
      ? 'Votre panier est conservé encore ' + hours + ' h ' + String(minutes).padStart(2, '0') + ' sur cet appareil.'
      : 'Votre panier expire dans ' + minutes + ' min — pensez à valider votre commande.';
  }

  /* ---------- Rendu global ---------- */

  function render() {
    const cart = store.readCart();
    const count = cart.items.length;

    $('#pnCount').textContent = count ? count + ' tenue' + (count > 1 ? 's' : '') : '';
    $('#pnSummaryCount').textContent = String(count);
    $('#pnSub').textContent = count
      ? 'Vérifiez vos tenues, puis renseignez vos coordonnées une seule fois.'
      : '';

    $('#pnEmpty').hidden = count > 0;
    $('#pnLayout').hidden = count === 0;

    if (count) {
      renderItems(cart);
      renderExpiry();
    } else {
      $('#pnExpiry').hidden = true;
    }
  }

  /* ---------- Formulaire client ---------- */

  function fillForm(cart) {
    const regions = $('#pn_region');
    regions.innerHTML = '<option value="">— Choisir un gouvernorat —</option>' +
      cat.REGIONS.map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>').join('');
    $('#pn_date').min = new Date().toISOString().slice(0, 10);

    Object.keys(store.EMPTY_CLIENT).forEach((key) => {
      const field = document.querySelector('[data-client="' + key + '"]');
      if (field) field.value = cart.client[key] || '';
    });
  }

  function readForm() {
    const client = {};
    Object.keys(store.EMPTY_CLIENT).forEach((key) => {
      const field = document.querySelector('[data-client="' + key + '"]');
      client[key] = field ? field.value : '';
    });
    return client;
  }

  /* L'erreur d'un champ ne s'affiche qu'une fois celui-ci renseigné puis
     invalidé, ou lors d'une tentative d'envoi. */
  function showError(key, force) {
    const node = document.querySelector('[data-client-error="' + key + '"]');
    if (!node) return false;
    const client = readForm();
    const message = store.clientErrors(client)[key];
    const touched = String(client[key] || '').trim() !== '';
    const visible = Boolean(message) && (force || touched);
    node.textContent = message || '';
    node.hidden = !visible;
    return Boolean(message);
  }

  function validateAll() {
    const client = readForm();
    const errors = store.clientErrors(client);
    let first = null;
    Object.keys(store.EMPTY_CLIENT).forEach((key) => {
      showError(key, true);
      if (errors[key] && !first) first = key;
    });
    if (first) {
      const field = document.querySelector('[data-client="' + first + '"]');
      if (field) { field.focus(); field.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    return { ok: !first, client };
  }

  /* ---------- Récapitulatif imprimable ---------- */

  function summaryText(order) {
    const c = order.config.client;
    const items = order.config.items || [];
    const lines = [
      'ENMIIS — Dossier de fabrication',
      'Référence : ' + order.ref,
      'Date : ' + new Date(order.createdAt).toLocaleString('fr-FR'),
      'Tenues : ' + items.length,
      '',
      '— CLIENT —',
      'Nom : ' + c.name,
      'WhatsApp : ' + c.whatsapp,
      'E-mail : ' + (c.email || '—'),
      'Région : ' + c.region,
      'Université : ' + (c.university || '—'),
      'Soutenance : ' + c.date,
      'Remarques : ' + (c.notes || '—'),
    ];

    items.forEach((item, index) => {
      lines.push('', '════ TENUE ' + (index + 1) + ' ════');
      lines.push('Fichiers : ' + ((item.files || []).length
        ? item.files.map((f) => f.name).join(', ') : '—'));
      lines.push('Manches : ' + label(cat.SLEEVES, item.robe.sleeve));
      lines.push('Col : ' + label(cat.COLLARS, item.robe.collar));
      lines.push('Bordure : ' + label(cat.TRIM_STYLES, item.robe.trim));
      lines.push('Texte à broder : ' + (item.robe.emb.text || '—'));
      lines.push('Logo université : ' + (item.robe.emb.uniLogoName || '—'));
      lines.push('Capuche : ' + label(cat.HOOD_STYLES, item.hood.style));
      lines.push('Mortier : ' + label(cat.CAP_STYLES, item.cap.style) +
        ' / ' + label(cat.CAP_MATERIALS, item.cap.material));
      lines.push('Gland : ' + label(cat.TASSEL_STYLES, item.tassel.style) +
        (item.tassel.year ? ' / ' + item.tassel.year : ''));
      lines.push('— Mesures —');
      cat.MEASUREMENTS.forEach((m) => {
        lines.push('  ' + m.label + ' : ' + (item.measures[m.id] || '—') + ' ' + m.unit);
      });
    });

    lines.push('', 'Couleurs : à définir avec l’atelier à la confirmation.');
    return lines.join('\n');
  }

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

  /* ---------- Envoi ---------- */

  let lastOrder = null;

  async function submit() {
    const button = $('#pnSubmit');
    const formError = $('#pnFormError');

    if (!store.cartCount()) { toast('Votre panier est vide.'); render(); return; }

    const { ok, client } = validateAll();
    if (!ok) {
      formError.textContent = 'Complétez vos coordonnées avant l’envoi.';
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    store.setCartClient(client);
    button.disabled = true;
    button.textContent = 'Envoi en cours…';

    let order;
    try {
      order = await store.submitCart();
    } catch (err) {
      button.disabled = false;
      button.textContent = 'Envoyer ma commande';
      toast('Envoi impossible — stockage du navigateur saturé.');
      return;
    }

    lastOrder = order;
    store.clearCart();

    $('#pnLayout').hidden = true;
    $('#pnEmpty').hidden = true;
    $('#pnExpiry').hidden = true;
    $('#pnCount').textContent = '';
    $('#pnSub').textContent = '';
    $('#pnDone').hidden = false;
    $('#pnDoneRef').textContent = order.ref;

    const count = (order.config.items || []).length;
    $('#pnDoneText').textContent = 'Conservez cette référence : elle identifie votre dossier auprès de ' +
      'l’atelier. ' + count + ' tenue' + (count > 1 ? 's ont' : ' a') + ' été transmise' +
      (count > 1 ? 's' : '') + '. Notre équipe confirme les mesures, la broderie et les couleurs avant ' +
      'lancement de la fabrication.';
    $('#pnDoneOffline').hidden = order.synced !== false;

    toast(order.synced
      ? 'Commande <em>' + esc(order.ref) + '</em> envoyée à l’atelier.'
      : 'Commande <em>' + esc(order.ref) + '</em> enregistrée — synchronisation en attente.');
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- Branchements ---------- */

  function bind() {
    $('#pnList').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (!remove) return;
      const node = remove.closest('.pn-item');
      if (node) node.classList.add('is-out');
      setTimeout(() => {
        store.removeCartItem(remove.getAttribute('data-remove'));
        render();
        toast('Tenue retirée du panier.');
      }, 200);
    });

    const form = $('#pnForm');
    form.addEventListener('input', (event) => {
      const field = event.target.closest('[data-client]');
      if (!field) return;
      showError(field.getAttribute('data-client'), false);
      store.setCartClient(readForm());
    });
    form.addEventListener('change', (event) => {
      const field = event.target.closest('select[data-client]');
      if (!field) return;
      showError(field.getAttribute('data-client'), false);
      store.setCartClient(readForm());
    });

    $('#pnSubmit').addEventListener('click', submit);
    $('#pnPdf').addEventListener('click', () => {
      if (lastOrder) downloadSummary(lastOrder);
    });
  }

  function init() {
    const cart = store.readCart();
    fillForm(cart);
    bind();
    render();
    /* Le compte à rebours reste juste sans recharger la page. */
    setInterval(renderExpiry, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
