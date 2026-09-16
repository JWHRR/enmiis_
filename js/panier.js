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

  /* ---------- Résumé d'un article ---------- */

  /* Chaque ligne du panier est une pièce indépendante. Les paniers
     composés avant la séparation en trois produits portaient toutes
     les pièces à la fois : ils restent lisibles ici. */
  function productOf(item) {
    return item.product ? cat.product(item.product) : null;
  }

  /* Le nom de la ligne vient du catalogue. L'ancienne version lisait la
     broderie du chapeau — un champ qui n'existe plus : la page entiere
     levait alors une exception et le panier s'affichait vide. */
  function itemName(item) {
    const product = productOf(item);
    if (!product) return 'Tenue de soutenance';
    return product.label + ' de soutenance';
  }

  const couleurDe = (id) => {
    const c = cat.find(cat.FABRIC_COLORS, id);
    return c ? c.label + ' (' + c.code + ')' : null;
  };

  /* Chaque ligne n'affiche que ce que la piece porte reellement. Les
     commandes passees avant la refonte gardent leurs anciens champs :
     on les lit encore, sinon un panier ancien deviendrait illisible. */
  function itemLines(item) {
    const rows = [];
    const ajouter = (libelle, valeur) => { if (valeur) rows.push({ label: libelle, value: valeur }); };

    if (item.robe) {
      ajouter('Manches', label(cat.SLEEVES, item.robe.sleeve));
      ajouter('Aspect du tissu', item.robe.finish && label(cat.FINISHES, item.robe.finish));
      ajouter('Tissu (ancienne fiche)', item.robe.fabric && label(cat.FABRICS, item.robe.fabric));
      ajouter('Couleur', couleurDe(item.robe.fabricColor));
      ajouter('Col', item.robe.collar && label(cat.COLLARS, item.robe.collar));
      ajouter('Bordure', item.robe.trim && label(cat.TRIM_STYLES, item.robe.trim));
    }
    if (item.cap) {
      ajouter('Aspect du tissu', item.cap.finish && label(cat.FINISHES, item.cap.finish));
      ajouter('Tissu (ancienne fiche)', item.cap.fabric && label(cat.FABRICS, item.cap.fabric));
      ajouter('Couleur', couleurDe(item.cap.fabricColor));
      ajouter('Ornement', item.cap.ornement && label(cat.ORNEMENTS, item.cap.ornement));
      if (item.cap.ornement === 'strass' && item.cap.strass) {
        ajouter('Strass', label(cat.STRASS_MODELS, item.cap.strass));
      }
      if (item.cap.ornement === 'fleur' && item.cap.fleur) {
        ajouter('Fleur', label(cat.FLEUR_MODELS, item.cap.fleur));
      }
      ajouter('Forme', item.cap.style && label(cat.CAP_STYLES, item.cap.style));
      ajouter('Broderie', item.cap.emb);
    }
    if (item.tassel) {
      ajouter('Gland', item.tassel.style && label(cat.TASSEL_STYLES, item.tassel.style));
    }
    if (item.hood) {
      ajouter('Aspect du tissu', item.hood.finish && label(cat.FINISHES, item.hood.finish));
      ajouter('Tissu (ancienne fiche)', item.hood.fabric && label(cat.FABRICS, item.hood.fabric));
      ajouter('Couleur', couleurDe(item.hood.fabricColor));
      ajouter('Contour', item.hood.contour && label(cat.TRIM_STYLES, item.hood.contour));
      ajouter('Modèle', item.hood.style && label(cat.HOOD_STYLES, item.hood.style));
      ajouter('Broderie', item.hood.emb);
    }
    if (item.capeam) {
      ajouter('Couleur 1', couleurDe(item.capeam.color1));
      ajouter('Couleur 2', couleurDe(item.capeam.color2));
    }
    if (item.bande) {
      ajouter('Couleur', couleurDe(item.bande.fabricColor));
    }
    return rows;
  }

  /* Vignette : le design envoyé par le client, sinon la photo produit. */
  function itemThumb(item) {
    const shot = (item.files || []).find((f) => f.preview);
    const product = productOf(item);
    const src = shot ? shot.preview : (product ? product.photo : 'img/robe.webp');
    return '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async">';
  }

  function renderItems(cart) {
    $('#pnList').innerHTML = cart.items.map((item) => {
      const product = productOf(item);
      const measures = Object.keys(item.measures || {}).length;
      const files = (item.files || []).length;
      const meta = [
        measures + ' mesure' + (measures > 1 ? 's' : ''),
        files ? files + ' fichier' + (files > 1 ? 's' : '') : 'aucun fichier',
      ].join(' · ');

      return '<li class="pn-item" data-item="' + esc(item.id) + '">' +
        '<span class="pn-item__num">' + esc(product ? product.label : 'Tenue complète') + '</span>' +
        '<div class="pn-item__thumb">' + itemThumb(item) + '</div>' +
        '<div class="pn-item__body">' +
          '<p class="pn-item__name">' + esc(itemName(item)) + '</p>' +
          '<dl class="pn-item__spec">' + itemLines(item).map((row) =>
            '<div><dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd></div>').join('') +
          '</dl>' +
          '<p class="pn-item__files">' + esc(meta) + '</p>' +
          '<div class="pn-item__foot">' +
            (product
              ? '<a class="pn-item__edit" href="customizer.html?edit=' + esc(item.id) + '">Modifier</a>'
              : '') +
            '<button type="button" class="pn-item__edit pn-item__edit--danger"' +
              ' data-remove="' + esc(item.id) + '">Supprimer</button>' +
          '</div>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  /* ---------- Compte à rebours de la session ---------- */

  function renderExpiry() {
    const node = $('#pnExpiry');

    /* Un panier porte par un compte ne tient pas a cet appareil : il
       est sur le serveur. Annoncer un compte a rebours « sur cet
       appareil » juste au-dessus de « vous le retrouverez sur tous vos
       appareils » disait deux choses contraires. */
    const compte = global.enmiisAccount && global.enmiisAccount.known();
    if (compte) { node.hidden = true; return; }

    const ms = store.cartExpiresIn();
    if (!ms) { node.hidden = true; return; }
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    node.hidden = false;
    node.textContent = hours >= 1
      ? 'Votre panier est conservé encore ' + hours + ' h ' + String(minutes).padStart(2, '0') + ' sur cet appareil.'
      : 'Votre panier expire dans ' + minutes + ' min — pensez à valider votre commande.';
  }

  /* ---------- Compléter la tenue ----------
     La proposition n'a de sens que s'il reste une pièce à ajouter :
     une cliente qui a déjà sa robe, sa casquette et son écharpe n'a
     rien à compléter. */

  function renderMore(cart) {
    const box = $('#pnMore');
    if (!box) return;
    const owned = new Set(cart.items.map((item) => item.product).filter(Boolean));
    const missing = cat.PRODUCTS.filter((p) => !owned.has(p.id));
    box.hidden = missing.length === 0;
    if (!missing.length) return;

    /* On ne propose que ce qui manque, sans insister sur le reste. */
    $('#pnMoreRow').innerHTML = missing.map((product) =>
      '<a class="pn-add" href="customizer.html?produit=' + esc(product.id) + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        esc(product.label) +
      '</a>').join('');
  }

  /* ---------- Compte ----------
     Le compte n'est jamais imposé : on explique seulement ce qu'il
     évite — perdre son panier au bout de 24 h. */

  function renderAccount(client) {
    const box = $('#pnAccount');
    if (!box) return;
    /* Rien à proposer si le panier est vide. */
    if (!store.cartCount()) { box.hidden = true; return; }
    box.hidden = false;

    if (client) {
      box.classList.add('is-known');
      $('#pnAccountTitle').textContent = 'Panier enregistré · ' + client.name;
      $('#pnAccountText').textContent = 'Vous le retrouverez sur tous vos appareils.';
      $('#pnAccountActions').innerHTML =
        '<a class="btn btn--line" href="compte.html">Mon compte</a>';
    } else {
      box.classList.remove('is-known');
      $('#pnAccountTitle').textContent = 'Gardez votre panier';
      $('#pnAccountText').textContent = 'Sans compte, il s’efface au bout de 24 h. ' +
        'Avec, vous le retrouvez sur tous vos appareils.';
      $('#pnAccountActions').innerHTML =
        '<a class="btn btn--solid" href="compte.html">Créer mon compte</a>' +
        '<a class="btn btn--line" href="compte.html?mode=login">Me connecter</a>';
    }
  }

  /* Pré-remplit les coordonnées avec celles du compte, pour que la
     cliente n'ait pas à les retaper à chaque commande. */
  function prefillFromAccount(client) {
    if (!client) return;
    const cart = store.readCart();
    const set = (key, value) => {
      const field = document.querySelector('[data-client="' + key + '"]');
      if (field && !String(cart.client[key] || '').trim() && value) field.value = value;
    };
    set('name', client.name);
    set('whatsapp', client.phone);
    set('region', client.origin);
    store.setCartClient(readForm());
  }

  /* ---------- Code promo ----------
     Le site ne dit jamais ce que le code donne : il sert à l'atelier
     à reconnaître d'où vient la cliente. */

  function renderPromo(force) {
    const field = $('#pn_promo');
    const okNode = $('#pnPromoOk');
    const errNode = document.querySelector('[data-client-error="promo"]');
    if (!field || !okNode) return;

    const typed = field.value.trim();
    const valid = cat.isPromo(typed);
    okNode.hidden = !valid;
    field.classList.toggle('is-valid', valid);

    /* « IHEC » n'est pas encore « IHEC_CARTHAGE » : afficher le refus
       à chaque lettre le ferait clignoter pendant toute la frappe. On
       attend que la cliente quitte le champ, ou qu'elle envoie. */
    const bad = Boolean(typed) && !valid && Boolean(force);
    field.classList.toggle('is-invalid', bad);
    if (errNode) {
      errNode.textContent = bad ? (store.clientErrors(readForm()).promo || '') : '';
      errNode.hidden = !bad;
    }
  }

  /* ---------- Rendu global ---------- */

  function render() {
    const cart = store.readCart();
    const count = cart.items.length;

    $('#pnCount').textContent = count ? count + ' article' + (count > 1 ? 's' : '') : '';
    $('#pnSummaryCount').textContent = String(count);
    $('#pnSub').textContent = count
      ? 'Vérifiez vos pièces, puis renseignez vos coordonnées une seule fois.'
      : '';

    $('#pnEmpty').hidden = count > 0;
    $('#pnLayout').hidden = count === 0;

    if (count) {
      renderItems(cart);
      renderMore(cart);
      renderExpiry();
    } else {
      $('#pnExpiry').hidden = true;
    }

    const account = global.enmiisAccount;
    renderAccount(account ? account.current() : null);
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
      'Articles : ' + items.length,
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
      const product = productOf(item);
      lines.push('', '════ ' + (index + 1) + '. ' +
        (product ? product.label.toUpperCase() : 'TENUE COMPLÈTE') + ' ════');
      lines.push('Fichiers : ' + ((item.files || []).length
        ? item.files.map((f) => f.name).join(', ') : '—'));

      /* Le recapitulatif imprime exactement les memes lignes que la
         carte a l'ecran : une seule source, aucune divergence possible. */
      itemLines(item).forEach((row) => { lines.push(row.label + ' : ' + row.value); });

      lines.push('— Mesures —');
      cat.MEASUREMENTS
        .filter((m) => item.measures && item.measures[m.id] !== undefined)
        .forEach((m) => {
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
      'l’atelier. ' + count + ' article' + (count > 1 ? 's ont' : ' a') + ' été transmis' +
      (count > 1 ? '' : '') + '. Notre équipe confirme les mesures, la broderie et les couleurs avant ' +
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
      if (field.id === 'pn_promo') renderPromo();
    });
    form.addEventListener('change', (event) => {
      const field = event.target.closest('select[data-client]');
      if (!field) return;
      showError(field.getAttribute('data-client'), false);
      store.setCartClient(readForm());
    });
    form.addEventListener('blur', (event) => {
      if (event.target.id === 'pn_promo') renderPromo(true);
    }, true);

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
    renderPromo();

    /* La session met un aller-retour réseau à se rétablir : on
       réaffiche dès qu'elle est connue, sans faire attendre la page. */
    const account = global.enmiisAccount;
    if (account) {
      /* On peint d'abord ce que l'on sait deja. Sans cela, la page
         s'ouvre sur « creez un compte » et se corrige un demi-seconde
         plus tard, sous les yeux d'une cliente qui a un compte. */
      const connu = account.cached();
      if (connu) {
        renderAccount(connu);
        prefillFromAccount(connu);
        renderExpiry();
      }
      account.whenReady((client) => {
        renderAccount(client);
        prefillFromAccount(client);
        renderExpiry();
      });
    }

    /* Le compte à rebours reste juste sans recharger la page. */
    setInterval(renderExpiry, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
