/* ============================================================
   ENMIIS — Essayage virtuel.

   La visualisation part du panier : ce sont les pièces réellement
   configurées qui sont décrites au modèle, avec leurs photos produit.
   L'image obtenue n'est jamais ajoutée au panier ni à la commande —
   le panier reste la seule source de vérité (voir api/tryon.js).
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

  const MAX_UPLOAD_MB = 10;
  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

  let photo = null;   /* { dataUrl, name } */

  /* ----------------------------------------------------------
     Ce que le client porte
     ---------------------------------------------------------- */

  /* On ne garde qu'une pièce par type : le client peut avoir commandé
     deux robes (pour une amie, une rechange), il n'en porte qu'une sur
     la visualisation. */
  function selection() {
    const seen = {};
    return store.readCart().items.filter((item) => {
      if (!item.product || seen[item.product]) return false;
      seen[item.product] = true;
      return true;
    });
  }

  /* Description lisible d'une pièce, pour l'affichage et pour le modèle. */
  function detailOf(item) {
    if (item.robe) {
      const bits = [
        label(cat.SLEEVES, item.robe.sleeve).toLowerCase(),
        label(cat.COLLARS, item.robe.collar).toLowerCase(),
        label(cat.TRIM_STYLES, item.robe.trim).toLowerCase(),
      ];
      if (item.robe.emb.text.trim()) bits.push('broderie « ' + item.robe.emb.text.trim() + ' »');
      return bits.join(', ');
    }
    if (item.cap) {
      const bits = [
        label(cat.CAP_STYLES, item.cap.style).toLowerCase(),
        label(cat.CAP_MATERIALS, item.cap.material).toLowerCase(),
      ];
      if (item.tassel) bits.push(label(cat.TASSEL_STYLES, item.tassel.style).toLowerCase());
      if (item.cap.emb.trim()) bits.push('broderie « ' + item.cap.emb.trim() + ' »');
      return bits.join(', ');
    }
    if (item.hood) {
      const bits = [label(cat.HOOD_STYLES, item.hood.style).toLowerCase()];
      if (item.hood.emb.trim()) bits.push('broderie « ' + item.hood.emb.trim() + ' »');
      return bits.join(', ');
    }
    return 'tenue de soutenance';
  }

  function picksMarkup(items) {
    return items.map((item) => {
      const product = cat.product(item.product);
      return '<li class="es-pick">' +
        '<span class="es-pick__check" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg>' +
        '</span>' +
        '<span class="es-pick__body">' +
          '<strong>' + esc(product.label) + '</strong>' +
          '<small>' + esc(detailOf(item)) + '</small>' +
        '</span>' +
        '<span class="es-pick__price">' + esc(cat.price(Number(item.price) || 0)) + '</span>' +
      '</li>';
    }).join('');
  }

  /* ----------------------------------------------------------
     Photo du client
     ---------------------------------------------------------- */

  function showError(message) {
    const node = $('#esError');
    node.textContent = message || '';
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

  /* Une photo de téléphone pèse plusieurs mégaoctets : on la réduit
     avant l'envoi, sinon la requête n'aboutit pas. */
  function downscale(dataUrl, maxSide) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        /* JPEG : le modèle n'a pas besoin de la transparence et le
           poids de la requête reste raisonnable. */
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function ingest(file) {
    if (!file) return;
    showError('');

    if (ACCEPTED.indexOf(file.type) === -1) {
      showError('Format non pris en charge — choisissez un JPG, un PNG ou un WebP.');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      showError('Photo trop lourde (maximum ' + MAX_UPLOAD_MB + ' Mo).');
      return;
    }

    const drop = $('#esDrop');
    drop.classList.add('is-loading');
    try {
      const dataUrl = await downscale(await readFile(file), 1280);
      photo = { dataUrl, name: file.name };
      $('#esPhotoImg').src = dataUrl;
      $('#esPhotoName').textContent = file.name;
      $('#esPhoto').hidden = false;
      drop.classList.add('is-filled');
      $('#esGenerate').disabled = false;
    } catch (err) {
      showError('Cette photo n’a pas pu être lue. Essayez-en une autre.');
    } finally {
      drop.classList.remove('is-loading');
    }
  }

  function clearPhoto() {
    photo = null;
    $('#esPhoto').hidden = true;
    $('#esPhotoImg').removeAttribute('src');
    $('#esFile').value = '';
    $('#esDrop').classList.remove('is-filled');
    $('#esGenerate').disabled = true;
    showError('');
  }

  /* ----------------------------------------------------------
     Génération
     ---------------------------------------------------------- */

  function setWaiting(on) {
    $('#esWait').hidden = !on;
    $('#esLayout').hidden = on || !selection().length;
    $('#esGenerate').disabled = on || !photo;
  }

  async function generate() {
    const items = selection();
    if (!items.length) { toast('Votre panier est vide.'); render(); return; }
    if (!photo) { showError('Ajoutez d’abord une photo.'); return; }

    showError('');
    setWaiting(true);

    const outfit = {
      pieces: items.map((item) => ({
        id: item.product,
        label: cat.product(item.product).label,
        detail: detailOf(item),
      })),
    };

    /* Panne réseau et refus du serveur ne se disent pas pareil : la
       première demande de réessayer, la seconde porte un message
       précis (clé absente, photo refusée…) qu'on relaie tel quel. */
    let res;
    try {
      res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photo.dataUrl, outfit }),
      });
    } catch (err) {
      setWaiting(false);
      showError('Service d’essayage injoignable — vérifiez votre connexion, puis réessayez.');
      return;
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload || !payload.image) {
      setWaiting(false);
      showError((payload && payload.message) ||
        'La génération a échoué. Réessayez dans un instant.');
      return;
    }

    setWaiting(false);
    showResult(payload.image, items);
  }

  function showResult(image, items) {
    $('#esResultImg').src = image;
    $('#esResultPicks').innerHTML = picksMarkup(items);
    $('#esResultTotal').textContent = cat.price(
      items.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    $('#esLayout').hidden = true;
    $('#esResult').hidden = false;
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function retry() {
    $('#esResult').hidden = true;
    $('#esLayout').hidden = false;
    clearPhoto();
    global.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ----------------------------------------------------------
     Rendu & branchements
     ---------------------------------------------------------- */

  function render() {
    const items = selection();
    const count = items.length;
    const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    $('#esCount').textContent = count ? count + ' pièce' + (count > 1 ? 's' : '') : '';
    $('#esEmpty').hidden = count > 0;
    $('#esLayout').hidden = count === 0;
    if (!count) return;

    $('#esPicks').innerHTML = picksMarkup(items);
    $('#esTotal').textContent = cat.price(total);
  }

  function bind() {
    const drop = $('#esDrop');
    const input = $('#esFile');

    const open = () => { input.value = ''; input.click(); };
    drop.addEventListener('click', (event) => {
      if (event.target === input) return;
      open();
    });
    drop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    });
    input.addEventListener('change', () => ingest(input.files && input.files[0]));

    ['dragenter', 'dragover'].forEach((type) => {
      drop.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add('is-over');
      });
    });
    drop.addEventListener('dragleave', (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
    });
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('is-over');
      const files = event.dataTransfer && event.dataTransfer.files;
      if (files && files[0]) ingest(files[0]);
    });

    /* Empêche le navigateur d'ouvrir une image déposée hors de la zone. */
    ['dragover', 'drop'].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (!event.target.closest('#esDrop')) event.preventDefault();
      });
    });

    $('#esPhotoClear').addEventListener('click', clearPhoto);
    $('#esGenerate').addEventListener('click', generate);
    $('#esRetry').addEventListener('click', retry);
  }

  function init() {
    bind();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
