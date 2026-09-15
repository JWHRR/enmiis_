/* ============================================================
   ENMIIS — Aperçu IA, côté navigateur.

   Le panneau vit sous le panier. Il ne s'affiche que pour une cliente
   connectée : une invitée ne voit rien du tout, ni le bouton, ni le
   prix. C'est voulu — le service demande un compte, et proposer une
   porte fermée n'aide personne.

   Trois états, un seul écran :

     pas d'accès   →  l'offre, le QR, et « J'ai payé »
     en attente    →  l'atelier vérifie
     accès ouvert  →  dépôt du portrait et génération

   Le portrait est réduit ici, avant l'envoi. Une photo de téléphone
   pèse cinq mégaoctets ; Vercel refuse les corps de plus de quatre et
   demi, et un visage n'a pas besoin de plus de mille pixels.
   ============================================================ */
(function (global) {
  'use strict';

  const API = '/api/preview';
  const CART_KEY = 'enmiis-cart-v1';
  const COTE_MAX = 1024;
  const QR = 'img/premium/qr-paiement.png';

  /* La génération dépasse parfois la durée d'une requête. Quand plus
     rien ne répond, on interroge l'historique plutôt que d'annoncer un
     échec qui n'en est pas un. Un refus explicite du serveur, lui, est
     rapporté sans attendre. */
  const RELANCE_MS = 6000;
  const RELANCES_MAX = 20;

  let racine = null;
  let etat = null;
  let portrait = null;     /* { dataUrl, nom } */
  let occupe = false;

  /* ---------- Outils ---------- */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerHTML = message;
    el.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('is-on'), 4200);
  }

  function jeton() {
    try { return localStorage.getItem('enmiis-account-v1') || ''; }
    catch (err) { return ''; }
  }

  function panier() {
    try {
      const brut = localStorage.getItem(CART_KEY);
      const lu = brut ? JSON.parse(brut) : null;
      return lu && Array.isArray(lu.items) ? lu : { items: [] };
    } catch (err) { return { items: [] }; }
  }

  async function appel(action, charge) {
    let res;
    try {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ action, token: jeton() }, charge || {})),
      });
    } catch (err) {
      throw new Error('Service injoignable — vérifiez votre connexion.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = new Error((data && data.message) || 'Une erreur est survenue.');
      e.code = data && data.error;
      e.data = data;
      throw e;
    }
    return data;
  }

  /* ---------- Le portrait ----------
     Réduit, réorienté par le navigateur, et réencodé en JPEG. On perd
     au passage les métadonnées de l'appareil — position GPS comprise,
     que personne n'a envie d'envoyer avec son visage. */

  function reduire(fichier) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp)$/.test(fichier.type)) {
        reject(new Error('Format accepté : JPEG, PNG ou WebP.'));
        return;
      }
      if (fichier.size > 25 * 1024 * 1024) {
        reject(new Error('Photo trop lourde (25 Mo maximum).'));
        return;
      }

      const lecteur = new FileReader();
      lecteur.onerror = () => reject(new Error('Photo illisible.'));
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Ce fichier n’est pas une image.'));
        img.onload = () => {
          const facteur = Math.min(1, COTE_MAX / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * facteur);
          c.height = Math.round(img.height * facteur);
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve({ dataUrl: c.toDataURL('image/jpeg', 0.88), nom: fichier.name });
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  /* ---------- Rendu ---------- */

  function offre() {
    const o = (etat && etat.offer) || { price: 29, currency: 'TND', credits: 5 };
    return '<div class="ia-offer">' +
      '<p class="ia-offer__price"><strong>' + esc(o.price) + '</strong> ' + esc(o.currency) + '</p>' +
      '<p class="ia-offer__credits">' + esc(o.credits) + ' aperçus' +
        (o.days > 0 ? ' · valables ' + esc(o.days) + ' jours' : '') + '</p>' +
    '</div>';
  }

  function ecranPaiement() {
    return '<div class="ia-pay">' +
      '<p class="ia-lead">Déposez une photo de votre visage : nous vous montrons portant exactement la ' +
        'tenue que vous venez de composer, couleurs et finitions comprises.</p>' +
      offre() +
      '<div class="ia-qr">' +
        '<img src="' + QR + '" alt="QR code de paiement ENMIIS" ' +
          'onerror="this.closest(\'.ia-qr\').classList.add(\'is-missing\')">' +
        '<p class="ia-qr__missing">Déposez votre QR code dans <code>' + QR + '</code>.</p>' +
        '<p class="ia-qr__help">Scannez pour régler, puis indiquez votre référence ci-dessous.</p>' +
      '</div>' +
      '<div class="cz-field">' +
        '<label class="cz-label" for="iaRef">Référence du paiement</label>' +
        '<input class="cz-input" id="iaRef" type="text" maxlength="120" ' +
          'placeholder="Numéro de transaction, ou les 4 derniers chiffres">' +
      '</div>' +
      '<button type="button" class="btn btn--solid ia-btn" data-ia="payer">J’ai payé — demander l’accès</button>' +
      '<p class="ia-note">L’atelier vérifie puis ouvre l’accès sur votre compte. Vous serez prévenue ici même.</p>' +
    '</div>';
  }

  function ecranAttente() {
    return '<div class="ia-wait">' +
      '<span class="ia-wait__dot" aria-hidden="true"></span>' +
      '<p class="ia-lead">Votre paiement est en cours de vérification par l’atelier.</p>' +
      '<p class="ia-note">Dès qu’il est validé, l’aperçu s’ouvre ici. Vous pouvez fermer cette page.</p>' +
      '<button type="button" class="btn btn--line ia-btn" data-ia="rafraichir">Vérifier maintenant</button>' +
    '</div>';
  }

  function ecranGeneration() {
    const credits = etat.access.credits;
    const pieces = panier().items.length;
    return '<div class="ia-gen">' +
      '<p class="ia-lead">Déposez votre portrait. Un visage de face, bien éclairé, sans lunettes de soleil.</p>' +

      '<div class="ia-drop' + (portrait ? ' is-filled' : '') + '" data-ia="deposer" tabindex="0" role="button" ' +
        'aria-label="Choisir une photo de portrait">' +
        (portrait
          ? '<img class="ia-drop__vignette" src="' + portrait.dataUrl + '" alt="Votre portrait">' +
            '<span class="ia-drop__nom">' + esc(portrait.nom) + '</span>' +
            '<span class="ia-drop__change">Changer de photo</span>'
          : '<span class="ia-drop__icone" aria-hidden="true">＋</span>' +
            '<span class="ia-drop__texte">Choisir une photo</span>' +
            '<span class="ia-drop__note">JPEG, PNG ou WebP</span>') +
      '</div>' +
      '<input type="file" id="iaFichier" accept="image/jpeg,image/png,image/webp" class="visually-hidden">' +

      '<label class="ia-consent">' +
        '<input type="checkbox" id="iaConsent">' +
        '<span>J’autorise ENMIIS à traiter cette photo pour générer mon aperçu. ' +
          'Je peux la supprimer à tout moment.</span>' +
      '</label>' +

      '<button type="button" class="btn btn--solid ia-btn" data-ia="generer"' +
        (portrait && pieces ? '' : ' disabled') + '>Générer mon aperçu IA</button>' +

      '<p class="ia-note">' +
        (pieces
          ? esc(pieces) + ' pièce' + (pieces > 1 ? 's' : '') + ' au panier · '
          : 'Votre panier est vide. ') +
        esc(credits) + ' aperçu' + (credits > 1 ? 's' : '') + ' restant' + (credits > 1 ? 's' : '') +
      '</p>' +
    '</div>';
  }

  function ecranEnCours() {
    return '<div class="ia-busy">' +
      '<span class="ia-busy__anneau" aria-hidden="true"></span>' +
      '<p class="ia-lead">Génération en cours…</p>' +
      '<p class="ia-note">Une trentaine de secondes. Ne fermez pas cette page.</p>' +
    '</div>';
  }

  function galerie() {
    const liste = (etat.previews || []).filter((a) => a.status !== 'en_cours');
    if (!liste.length) return '';
    return '<div class="ia-galerie">' +
      '<h3 class="ia-galerie__titre">Vos aperçus</h3>' +
      '<div class="ia-galerie__grille">' +
        liste.map((a) => (a.status === 'pret'
          ? '<figure class="ia-vignette">' +
              '<a href="' + esc(a.url) + '" target="_blank" rel="noopener">' +
                '<img src="' + esc(a.url) + '" alt="Aperçu généré" loading="lazy">' +
              '</a>' +
              '<figcaption>' + esc(new Date(a.createdAt).toLocaleDateString('fr-FR')) + '</figcaption>' +
              '<button type="button" class="ia-vignette__x" data-ia="supprimer" data-id="' + esc(a.id) + '" ' +
                'aria-label="Supprimer cet aperçu">×</button>' +
            '</figure>'
          : '<figure class="ia-vignette ia-vignette--echec">' +
              '<p>' + esc(a.error || 'Génération échouée') + '</p>' +
              '<button type="button" class="ia-vignette__x" data-ia="supprimer" data-id="' + esc(a.id) + '" ' +
                'aria-label="Retirer">×</button>' +
            '</figure>')).join('') +
      '</div>' +
    '</div>';
  }

  function rendre() {
    if (!racine) return;

    if (!etat) { racine.hidden = true; return; }
    racine.hidden = false;

    let corps;
    if (occupe) corps = ecranEnCours();
    else if (etat.access.active && etat.access.credits > 0) corps = ecranGeneration();
    else if (etat.pending) corps = ecranAttente();
    else corps = ecranPaiement();

    racine.innerHTML =
      '<div class="cz-group ia-panneau">' +
        '<p class="ia-kicker">Service premium</p>' +
        '<h2 class="ia-titre">Voyez-vous porter cette tenue</h2>' +
        corps +
        galerie() +
      '</div>';
  }

  /* ---------- Actions ---------- */

  async function charger() {
    try {
      etat = await appel('status');
    } catch (err) {
      /* Service non configuré ou hors ligne : le panneau disparaît
         plutôt que d'afficher une erreur dont la cliente ne peut rien
         faire. Le panier, lui, continue de fonctionner. */
      etat = null;
    }
    rendre();
  }

  async function payer() {
    const champ = document.getElementById('iaRef');
    const reference = champ ? champ.value.trim() : '';
    try {
      const out = await appel('payment', { reference });
      toast(out.message || 'Demande envoyée.');
      await charger();
    } catch (err) {
      toast(err.message);
    }
  }

  async function choisirFichier(fichier) {
    if (!fichier) return;
    try {
      portrait = await reduire(fichier);
      rendre();
    } catch (err) {
      toast(err.message);
    }
  }

  /* La fonction serverless peut être coupée avant d'avoir répondu. On
     interroge alors l'historique : si l'aperçu s'y trouve, il est
     prêt, et l'appel n'avait échoué qu'en apparence. */
  async function attendreResultat(depart) {
    for (let i = 0; i < RELANCES_MAX; i += 1) {
      await new Promise((r) => setTimeout(r, RELANCE_MS));
      try {
        const frais = await appel('status');
        const arrive = (frais.previews || []).find((a) => new Date(a.createdAt).getTime() >= depart);
        if (arrive && arrive.status !== 'en_cours') { etat = frais; return arrive; }
        etat = frais;
      } catch (err) { /* on retente */ }
    }
    return null;
  }

  async function generer() {
    const consent = document.getElementById('iaConsent');
    if (!consent || !consent.checked) {
      toast('Cochez l’autorisation avant de générer.');
      return;
    }
    if (!portrait) { toast('Choisissez d’abord une photo.'); return; }

    const depart = Date.now();
    occupe = true;
    rendre();

    try {
      const out = await appel('generate', { portrait: portrait.dataUrl, cart: panier() });
      occupe = false;
      etat = await appel('status').catch(() => etat);
      rendre();
      if (out.preview && out.preview.status === 'pret') toast('Votre aperçu est prêt.');
    } catch (err) {
      /* Deux échecs très différents se ressemblent ici.

         Le serveur a répondu et a tranché — panier vide, portrait
         refusé, génération ratée : il a déjà rendu le crédit. On le dit
         tout de suite, attendre n'apporterait rien.

         Rien n'a répondu — réseau coupé, fonction dépassée par le
         temps : l'image est peut-être en train de finir malgré tout.
         C'est le seul cas où l'on va voir. */
      if (err.code) {
        occupe = false;
        etat = await appel('status').catch(() => etat);
        rendre();
        toast(err.message);
        return;
      }

      const tardif = await attendreResultat(depart);
      occupe = false;
      rendre();
      if (tardif && tardif.status === 'pret') toast('Votre aperçu est prêt.');
      else toast(err.message);
    }
  }

  async function supprimer(id) {
    try {
      await appel('delete', { id: Number(id) });
      await charger();
      toast('Aperçu supprimé.');
    } catch (err) {
      toast(err.message);
    }
  }

  /* ---------- Branchement ---------- */

  function brancher() {
    racine.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-ia]');
      if (!el) return;
      const quoi = el.getAttribute('data-ia');
      if (quoi === 'payer') payer();
      else if (quoi === 'rafraichir') charger();
      else if (quoi === 'generer') generer();
      else if (quoi === 'supprimer') supprimer(el.getAttribute('data-id'));
      else if (quoi === 'deposer') {
        const input = document.getElementById('iaFichier');
        if (input) input.click();
      }
    });

    racine.addEventListener('keydown', (ev) => {
      const el = ev.target.closest('[data-ia="deposer"]');
      if (el && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        const input = document.getElementById('iaFichier');
        if (input) input.click();
      }
    });

    racine.addEventListener('change', (ev) => {
      if (ev.target.id === 'iaFichier') choisirFichier(ev.target.files && ev.target.files[0]);
    });

    /* Le panier change : le compte de pièces affiché doit suivre. */
    document.addEventListener('enmiis:cart', () => { if (etat && !occupe) rendre(); });
  }

  function demarrer() {
    racine = document.getElementById('pnPreview');
    if (!racine || !global.enmiisAccount) return;
    brancher();

    const suivre = (cliente) => {
      if (!cliente) { etat = null; rendre(); return; }
      charger();
    };
    global.enmiisAccount.whenReady(suivre);
    document.addEventListener('enmiis:account', (ev) => suivre(ev.detail && ev.detail.client));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})(window);
