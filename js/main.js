/* ============================================================
   ENMIIS — Maison de Luxe
   Interactions partagées : header, menu mobile, recherche,
   hero, reveals, toast, favoris, overlay "en construction",
   galerie de réalisations.
   Chaque bloc vérifie la présence de ses éléments pour que le
   même script serve toutes les pages du site.
   ============================================================ */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     Image fallback — si une image distante échoue, on affiche
     un élégant placeholder neutre pour ne jamais casser la mise
     en page (et pour marquer l'emplacement de vos vraies photos).
     ---------------------------------------------------------- */
  const FALLBACK =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      /* Même rapport 5/7 que les cadres de cartes : le placeholder les
         remplit exactement, sans filet clair sur les bords. */
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1120'>" +
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
        "<stop offset='0' stop-color='#F4F1EB'/><stop offset='1' stop-color='#E4DDD2'/>" +
        "</linearGradient></defs>" +
        "<rect width='800' height='1120' fill='url(#g)'/>" +
        "<text x='400' y='570' font-family='Georgia, serif' font-size='44' letter-spacing='18' fill='#B9A88C' text-anchor='middle'>ENMIIS</text>" +
      '</svg>'
    );

  document.querySelectorAll('img').forEach((img) => {
    function toFallback() {
      img.removeEventListener('error', toFallback);
      img.src = FALLBACK;
      img.srcset = '';
      img.closest('.work-card')?.classList.add('is-placeholder');
    }
    if (img.complete && img.naturalWidth === 0 && img.src && img.src !== FALLBACK) {
      toFallback();
    } else {
      img.addEventListener('error', toFallback);
    }
  });

  /* ----------------------------------------------------------
     Sticky header — état condensé au défilement
     ---------------------------------------------------------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    let lastScrollState = false;
    const onScroll = () => {
      const scrolled = window.scrollY > 24;
      if (scrolled !== lastScrollState) {
        header.classList.toggle('is-scrolled', scrolled);
        lastScrollState = scrolled;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ----------------------------------------------------------
     Menu mobile — plein écran avec entrée décalée
     ---------------------------------------------------------- */
  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const scrim = document.getElementById('scrim');

  function setMenu(open) {
    if (!mobileMenu) return;
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    scrim.classList.toggle('is-visible', open);
    document.body.classList.toggle('is-locked', open);
    if (open) mobileMenuClose.focus();
    else burger.focus();
  }

  if (mobileMenu && burger) {
    mobileMenu.querySelectorAll('[data-stagger]').forEach((el, i) => {
      el.style.setProperty('--i', i);
    });
    burger.addEventListener('click', () => setMenu(true));
    mobileMenuClose.addEventListener('click', () => setMenu(false));
    scrim.addEventListener('click', () => setMenu(false));
  }

  /* ----------------------------------------------------------
     Recherche plein écran
     ---------------------------------------------------------- */
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('searchInput');

  function setSearch(open) {
    if (!searchOverlay) return;
    searchOverlay.classList.toggle('is-open', open);
    searchOverlay.setAttribute('aria-hidden', String(!open));
    scrim.classList.toggle('is-visible', open);
    document.body.classList.toggle('is-locked', open);
    if (open) setTimeout(() => searchInput.focus(), 350);
  }

  /* Le champ de l'en-tête (desktop) renvoie vers la recherche plein
     écran plutôt que d'ouvrir un second mécanisme : ce qui est tapé
     avant l'ouverture est repris tel quel. */
  function ouvrirDepuisEntete() {
    const champ = document.getElementById('headerSearchInput');
    const valeur = champ ? champ.value : '';
    setSearch(true);
    if (valeur && searchInput) searchInput.value = valeur;
    if (champ) champ.value = '';
  }

  if (searchOverlay) {
    document.getElementById('searchBtn')?.addEventListener('click', () => setSearch(true));
    document.getElementById('quickSearchBtn')?.addEventListener('click', () => setSearch(true));
    document.getElementById('headerSearchBtn')?.addEventListener('click', ouvrirDepuisEntete);
    document.getElementById('headerSearchInput')?.addEventListener('focus', ouvrirDepuisEntete);
    document.getElementById('searchClose')?.addEventListener('click', () => setSearch(false));
    scrim.addEventListener('click', () => {
      if (searchOverlay.classList.contains('is-open')) setSearch(false);
    });
  }

  /* ----------------------------------------------------------
     Scan par la caméra

     Le pictogramme code-barres était un décor : le toucher ouvrait la
     recherche, rien de plus. Il ouvre maintenant la caméra arrière.

     Deux limites tenaient au navigateur, pas au site : la caméra exige
     une connexion sécurisée, et seul BarcodeDetector — présent sur
     Chrome et Edge, absent de Safari et Firefox — sait décoder un code.
     Plutôt qu'un bouton muet, on ouvre toujours la caméra, on décode
     quand c'est possible, et on dit pourquoi quand ça ne l'est pas.
     ---------------------------------------------------------- */
  const scanOverlay = document.getElementById('scanOverlay');
  const scanVideo = document.getElementById('scanVideo');
  const scanHint = document.getElementById('scanHint');
  let scanStream = null;
  let scanTimer = null;

  function scanStop() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    /* Sans arrêt explicite des pistes, le voyant de la caméra reste
       allumé après la fermeture. */
    if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; }
    if (scanVideo) scanVideo.srcObject = null;
    if (!scanOverlay) return;
    scanOverlay.classList.remove('is-open');
    scanOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  async function scanStart() {
    if (!scanOverlay || !scanVideo) return;
    scanOverlay.classList.add('is-open');
    scanOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    scanHint.textContent = 'Ouverture de la caméra…';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      scanHint.textContent = 'Ce navigateur ne donne pas accès à la caméra.';
      return;
    }

    try {
      scanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      const nom = err && err.name;
      scanHint.textContent =
        nom === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorisez-le dans votre navigateur, puis réessayez.'
        : !window.isSecureContext ? 'La caméra demande une connexion sécurisée (https).'
        : nom === 'NotFoundError' ? 'Aucune caméra détectée sur cet appareil.'
        : 'La caméra n’a pas pu démarrer.';
      return;
    }

    scanVideo.srcObject = scanStream;
    try { await scanVideo.play(); } catch (err) { /* iOS refuse parfois la lecture auto */ }

    let detecteur = null;
    try {
      if ('BarcodeDetector' in window) detecteur = new window.BarcodeDetector();
    } catch (err) { detecteur = null; }

    if (!detecteur) {
      scanHint.textContent = 'Lecture automatique indisponible sur ce navigateur — '
        + 'cherchez plutôt le nom du produit.';
      return;
    }

    scanHint.textContent = 'Visez le code : il sera lu automatiquement.';
    scanTimer = setInterval(async () => {
      if (!scanVideo.videoWidth) return;
      let codes = [];
      try { codes = await detecteur.detect(scanVideo); } catch (err) { return; }
      if (!codes.length) return;
      const valeur = (codes[0].rawValue || '').trim();
      if (!valeur) return;
      scanStop();
      /* Le site n'associe aucun code à un produit : le résultat part
         donc dans la recherche, seul endroit qui sache en faire
         quelque chose. */
      setSearch(true);
      if (searchInput) searchInput.value = valeur;
      showToast('Code lu : <em>' + valeur + '</em>');
    }, 400);
  }

  document.getElementById('scanBtn')?.addEventListener('click', scanStart);
  document.getElementById('scanClose')?.addEventListener('click', scanStop);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (scanOverlay?.classList.contains('is-open')) scanStop();
    if (searchOverlay?.classList.contains('is-open')) setSearch(false);
    if (mobileMenu?.classList.contains('is-open')) setMenu(false);
  });

  /* ----------------------------------------------------------
     Hero — fondu, autoplay, balayage tactile
     ---------------------------------------------------------- */
  const hero = document.getElementById('hero');
  if (hero) {
    const slides = Array.from(hero.querySelectorAll('.hero__slide'));
    const dots = Array.from(hero.querySelectorAll('.hero__dot'));
    const SLIDE_MS = 6500;
    hero.style.setProperty('--slide-ms', SLIDE_MS + 'ms');

    let current = 0;
    let autoTimer = null;

    function goTo(index) {
      const next = (index + slides.length) % slides.length;
      if (next === current && slides[next].classList.contains('is-active')) return;

      slides[current].classList.remove('is-active');
      slides[current].setAttribute('aria-hidden', 'true');
      dots[current].classList.remove('is-active');
      dots[current].setAttribute('aria-selected', 'false');

      current = next;

      slides[current].classList.add('is-active');
      slides[current].setAttribute('aria-hidden', 'false');
      void dots[current].offsetWidth;
      dots[current].classList.add('is-active');
      dots[current].setAttribute('aria-selected', 'true');
    }

    function startAuto() {
      if (prefersReducedMotion) return;
      stopAuto();
      autoTimer = setInterval(() => goTo(current + 1), SLIDE_MS);
    }
    function stopAuto() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
    }
    function interact(index) {
      goTo(index);
      startAuto();
    }

    dots.forEach((dot, i) => dot.addEventListener('click', () => interact(i)));
    document.getElementById('heroPrev').addEventListener('click', () => interact(current - 1));
    document.getElementById('heroNext').addEventListener('click', () => interact(current + 1));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else startAuto();
    });

    let touchX = null;
    let touchY = null;
    hero.addEventListener('touchstart', (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      stopAuto();
    }, { passive: true });

    hero.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - touchY;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        goTo(current + (dx < 0 ? 1 : -1));
      }
      touchX = touchY = null;
      startAuto();
    }, { passive: true });

    startAuto();
  }

  /* ----------------------------------------------------------
     Apparition au défilement
     ---------------------------------------------------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const io = new IntersectionObserver((entries) => {
      let delay = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--reveal-delay', delay + 's');
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
        delay += 0.08;
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ----------------------------------------------------------
     Toast
     ---------------------------------------------------------- */
  const toast = document.getElementById('toast');
  let toastTimer = null;
  function showToast(html) {
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }
  window.enmiisToast = showToast;

  /* ----------------------------------------------------------
     Panier (compteur d'entête)
     Lu directement dans le stockage local : les pages vitrine ne
     chargent pas le configurateur. Même clé et même durée de vie
     de 24 h que js/cz-store.js.
     ---------------------------------------------------------- */
  const CART_KEY = 'enmiis-cart-v1';
  const CART_TTL_MS = 24 * 60 * 60 * 1000;

  function readCartCount() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return 0;
      const cart = JSON.parse(raw);
      if (!cart || !Array.isArray(cart.items)) return 0;
      if (!cart.savedAt || Date.now() - cart.savedAt > CART_TTL_MS) return 0;
      return cart.items.length;
    } catch (err) {
      return 0;
    }
  }

  const cartCountEl = document.getElementById('cartCount');
  if (cartCountEl) {
    const count = readCartCount();
    cartCountEl.textContent = count;
    cartCountEl.hidden = count === 0;
  }

  /* ----------------------------------------------------------
     Favoris

     Le client n'a pas de compte : ses favoris vivent dans son
     navigateur, sans expiration (contrairement au panier, qui est une
     commande en cours). La liste est consultable sur favoris.html.
     ---------------------------------------------------------- */
  const FAV_KEY = 'enmiis-favorites-v1';

  function readFavorites() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeFavorites(list) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      return false;
    }
  }

  /* Identifiant stable dérivé du titre : les créations n'ont pas d'id
     propre dans le balisage, et leurs titres sont uniques. */
  function favId(title) {
    return String(title).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function isFavorite(id) {
    return readFavorites().some((entry) => entry.id === id);
  }

  function removeFavorite(id) {
    const list = readFavorites().filter((entry) => entry.id !== id);
    writeFavorites(list);
    return list;
  }

  window.enmiisFavorites = {
    read: readFavorites,
    remove: removeFavorite,
    id: favId,
    count: () => readFavorites().length,
  };

  const wishlistCountEl = document.getElementById('wishlistCount');

  function bump(el, value) {
    el.textContent = value;
    el.hidden = value === 0;
    el.classList.remove('is-bumped');
    void el.offsetWidth;
    el.classList.add('is-bumped');
  }

  function syncFavoriteBadge(animate) {
    if (!wishlistCountEl) return;
    const count = readFavorites().length;
    if (animate) bump(wishlistCountEl, count);
    else {
      wishlistCountEl.textContent = count;
      wishlistCountEl.hidden = count === 0;
    }
  }

  /* Extrait de la carte tout ce qu'il faut pour la réafficher ailleurs. */
  function cardToFavorite(card) {
    const title = card.querySelector('.work-card__title')?.textContent.trim() || 'Création';
    const preset = card.querySelector('.work-card__btn-choose')?.getAttribute('href') || '';
    return {
      id: favId(title),
      title,
      label: card.querySelector('.work-card__label')?.textContent.trim() || '',
      desc: card.querySelector('.work-card__desc')?.textContent.trim() || '',
      img: card.querySelector('.work-card__media img')?.getAttribute('src') || '',
      href: preset,
      addedAt: new Date().toISOString(),
    };
  }

  document.querySelectorAll('.work-card__wishlist').forEach((btn) => {
    const card = btn.closest('.work-card');
    if (!card) return;
    const entry = cardToFavorite(card);

    /* État initial : un favori déjà enregistré reste marqué au retour. */
    if (isFavorite(entry.id)) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      btn.setAttribute('aria-label', 'Retirer des favoris');
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nowActive = !isFavorite(entry.id);
      if (nowActive) {
        const list = readFavorites();
        list.unshift(cardToFavorite(card));
        if (!writeFavorites(list)) {
          showToast('Impossible d’enregistrer ce favori — stockage saturé');
          return;
        }
      } else {
        removeFavorite(entry.id);
      }

      btn.classList.toggle('is-active', nowActive);
      btn.setAttribute('aria-pressed', String(nowActive));
      btn.setAttribute('aria-label', nowActive ? 'Retirer des favoris' : 'Ajouter aux favoris');
      btn.classList.remove('is-popped');
      void btn.offsetWidth;
      btn.classList.add('is-popped');

      syncFavoriteBadge(true);
      showToast(nowActive
        ? '<em>' + entry.title + '</em> ajoutée à vos favoris'
        : '<em>' + entry.title + '</em> retirée de vos favoris');
    });
  });

  syncFavoriteBadge(false);

  /* ----------------------------------------------------------
     Overlay "en construction" — catégories pas encore ouvertes
     ---------------------------------------------------------- */
  const construction = document.getElementById('constructionOverlay');

  function setConstruction(open) {
    if (!construction) return;
    construction.classList.toggle('is-open', open);
    construction.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);
    if (open) construction.querySelector('.construction__close').focus();
  }

  document.querySelectorAll('[data-soon]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setMenu(false);
      if (searchOverlay?.classList.contains('is-open')) setSearch(false);
      setConstruction(true);
    });
  });

  construction?.querySelectorAll('[data-construction-close]').forEach((el) =>
    el.addEventListener('click', () => setConstruction(false))
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && construction?.classList.contains('is-open')) setConstruction(false);
  });

  /* ----------------------------------------------------------
     Galerie de réalisations — filtres par catégorie
     ---------------------------------------------------------- */
  const filterBar = document.getElementById('worksFilter');
  if (filterBar) {
    const chips = Array.from(filterBar.querySelectorAll('button'));
    const cards = Array.from(document.querySelectorAll('.work-card'));

    /* Chaque catégorie configurable a son propre configurateur : le
       bouton sous la liste ouvre celui de la pièce filtrée, pour la
       cliente qui préfère téléverser son modèle plutôt que d'en
       choisir un. Sur « Tout », Box ou Décoration il n'y a pas de
       pièce unique : le bouton disparaît. */
    /* Le filtre porte le nom de la piece ; l'identifiant produit reste
       celui du catalogue, inchange pour ne pas rompre les commandes
       deja enregistrees. */
    const OWN = {
      'robe':            { produit: 'robe',            label: 'Téléverser mon propre modèle de robe' },
      'chapeau':         { produit: 'casquette',       label: 'Téléverser mon propre modèle de chapeau' },
      'cache-col':       { produit: 'echarpe',         label: 'Téléverser mon propre modèle de cache-col' },
      'cape':            { produit: 'cape',            label: 'Téléverser mon propre modèle de cape' },
      'cape-americaine': { produit: 'cape-americaine', label: 'Téléverser mon propre modèle de cape américaine' },
      'bond-miss':       { produit: 'bond-miss',       label: 'Téléverser mon propre modèle de bond miss' },
    };
    const own = document.getElementById('worksOwn');
    const ownCta = document.getElementById('worksOwnCta');

    /* Deux pieces n'ont pas encore de creation photographiee. Plutot
       qu'une grille blanche sans un mot, on le dit — et le bouton
       « televerser » juste dessous garde un chemin ouvert. */
    const vide = document.getElementById('worksEmpty');
    function syncVide(filter) {
      if (!vide) return;
      const visibles = cards.filter((c) => filter === 'all' || c.dataset.category === filter);
      vide.hidden = visibles.length > 0;
    }

    function syncOwn(filter) {
      if (!own || !ownCta) return;
      const entry = OWN[filter];
      own.hidden = !entry;
      if (!entry) return;
      ownCta.href = 'customizer.html?produit=' + entry.produit;
      ownCta.textContent = entry.label;
    }

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-pressed', String(c === chip));
        });
        const filter = chip.dataset.filter;
        cards.forEach((card) => {
          const show = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !show);
        });
        syncOwn(filter);
        syncVide(filter);
      });
    });

    const depart = (chips.find((c) => c.classList.contains('is-active')) || {}).dataset?.filter || 'all';
    syncOwn(depart);
    syncVide(depart);
  }

  /* ----------------------------------------------------------
     Choix des pièces à configurer

     La cliente coche ce qu'elle veut composer ; le configurateur les
     enchaîne ensuite dans l'ordre du catalogue. On passe la liste par
     l'URL : aucune donnée à conserver ici, et un lien reste partageable.
     ---------------------------------------------------------- */
  const pieceDialog = document.getElementById('pieceDialog');
  if (pieceDialog) {
    const cases = Array.from(pieceDialog.querySelectorAll('input[type="checkbox"]'));
    const compteur = document.getElementById('pieceCount');
    const erreur = document.getElementById('pieceError');
    const ouvrir = document.getElementById('startCustom');
    let dernierFocus = null;

    function coches() { return cases.filter((c) => c.checked).map((c) => c.value); }

    function majCompteur() {
      const n = coches().length;
      compteur.textContent = n === 0
        ? 'Aucune pièce sélectionnée'
        : n + ' pièce' + (n > 1 ? 's' : '') + ' sélectionnée' + (n > 1 ? 's' : '');
      if (n) { erreur.hidden = true; }
    }

    function basculer(ouvert) {
      pieceDialog.classList.toggle('is-open', ouvert);
      pieceDialog.setAttribute('aria-hidden', String(!ouvert));
      document.body.classList.toggle('is-locked', ouvert);
      if (ouvert) {
        dernierFocus = document.activeElement;
        majCompteur();
        setTimeout(() => cases[0].focus(), 60);
      } else if (dernierFocus) {
        dernierFocus.focus();
        dernierFocus = null;
      }
    }

    ouvrir?.addEventListener('click', () => basculer(true));
    document.getElementById('pieceClose')?.addEventListener('click', () => basculer(false));
    pieceDialog.addEventListener('click', (e) => { if (e.target === pieceDialog) basculer(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pieceDialog.classList.contains('is-open')) basculer(false);
    });
    cases.forEach((c) => c.addEventListener('change', majCompteur));

    document.getElementById('pieceGo')?.addEventListener('click', () => {
      const choix = coches();
      /* Sans piece cochee il n'y a rien a configurer : on le dit plutot
         que d'ouvrir un configurateur vide. */
      if (!choix.length) { erreur.hidden = false; return; }
      window.location.href = 'customizer.html?pieces=' + encodeURIComponent(choix.join(','));
    });
  }

  /* ----------------------------------------------------------
     Newsletter
     ---------------------------------------------------------- */
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterSuccess = document.getElementById('newsletterSuccess');
  newsletterForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    newsletterForm.hidden = true;
    newsletterSuccess.hidden = false;
  });

  /* ----------------------------------------------------------
     Modal Zoom & Description — Créations Soutenance
     ---------------------------------------------------------- */
  const MODELS_DATA = {
    /* Une seule vue : la bande de vignettes reste fermee d'elle-meme. */
    'cachecol-1': {
      title: "Cache-col Noir",
      category: "Cache-col",
      img: "img/designs/cache-col/cachecol-1-1.webp",
      desc: "Noir mat, pointes nettes, porté sans bordure.",
      highlights: [
        "Crêpe noir mat",
        "Pointes nettes, sans bordure",
        "Se porte ouvert sur la robe"
      ],
      presetUrl: "customizer.html?produit=echarpe&preset=cachecol-1"
    },
    /* Une seule vue : la bande de vignettes reste fermee d'elle-meme. */
    'cachecol-2': {
      title: "Cache-col Noir — Liseré Ivoire",
      category: "Cache-col",
      img: "img/designs/cache-col/cachecol-2-1.webp",
      desc: "Noir souligné d’un liseré ivoire, avec son gland.",
      highlights: [
        "Crêpe noir mat",
        "Liseré ivoire sur tout le contour",
        "Gland assorti"
      ],
      presetUrl: "customizer.html?produit=echarpe&preset=cachecol-2"
    },
    /* Une seule vue : la bande de vignettes reste fermee d'elle-meme. */
    'capeam-1': {
      title: "Cape Bordeaux & Noir",
      category: "Cape américaine",
      img: "img/designs/cape-americaine/capeam-1-1.webp",
      desc: "Corps bordeaux, chevron et pan noirs.",
      highlights: [
        "Corps bordeaux",
        "Chevron et pan noirs",
        "Épaules structurées"
      ],
      presetUrl: "customizer.html?produit=cape-americaine&preset=capeam-1"
    },
    /* Une seule vue : la bande de vignettes reste fermee d'elle-meme. */
    'capeam-2': {
      title: "Cape Camel & Bordeaux",
      category: "Cape américaine",
      img: "img/designs/cape-americaine/capeam-2-1.webp",
      desc: "Corps camel, chevron bordeaux.",
      highlights: [
        "Corps camel",
        "Chevron bordeaux",
        "Tombé souple dans le dos"
      ],
      presetUrl: "customizer.html?produit=cape-americaine&preset=capeam-2"
    },
    /* Une seule vue : la bande de vignettes reste fermee d'elle-meme. */
    'bande-1': {
      title: "Bande Miss Noire",
      category: "Bande miss",
      img: "img/designs/bande-miss/bande-1-1.webp",
      desc: "Bande d’honneur noire, portée en écharpe.",
      highlights: [
        "Bande d’honneur noire",
        "Se porte en écharpe",
        "Pointe nette sur la hanche"
      ],
      presetUrl: "customizer.html?produit=bond-miss&preset=bande-1"
    },
    /* « views » ouvre la bande de vignettes : la premiere vue est celle
       que porte deja la fiche, les suivantes se decouvrent au clic. */
    'robe-1': {
      title: "Robe Camel — Parements Bordeaux",
      category: "Toges d'Apparat",
      img: "img/designs/robe/robe-1-1.webp",
      views: [
        { label: "Face",   src: "img/designs/robe/robe-1-1.webp" },
        { label: "Profil", src: "img/designs/robe/robe-1-2.webp" },
        { label: "Dos",    src: "img/designs/robe/robe-1-3.webp" }
      ],
      desc: "Drapé camel, manches à parements bordeaux et fermeture centrale nette. Photographiée sous trois angles à l'atelier.",
      highlights: [
        "Camel chaud et parements bordeaux",
        "Manches d'apparat soulignées d'un liseré or",
        "Tombé fluide et fermeture centrale nette",
        "Trois vues : face, profil et dos"
      ],
      presetUrl: "customizer.html?produit=robe&preset=robe-1"
    },
    'robe-2': {
      title: "Robe Marine — Liséré Or",
      category: "Toges d'Apparat",
      img: "img/designs/robe/robe-2-1.webp",
      views: [
        { label: "Face",   src: "img/designs/robe/robe-2-1.webp" },
        { label: "Détail", src: "img/designs/robe/robe-2-2.webp" },
        { label: "Dos",    src: "img/designs/robe/robe-2-3.webp" }
      ],
      desc: "Marine profond, liséré doré sur les manches et le devant. Photographiée sous trois angles à l'atelier.",
      highlights: [
        "Marine profond, haute tenue",
        "Liséré doré aux manches et au parement",
        "Col en V net",
        "Trois vues : face, détail et dos"
      ],
      presetUrl: "customizer.html?produit=robe&preset=robe-2"
    }
  };

  const modelModal = document.getElementById('modelModal');
  const modelModalBackdrop = document.getElementById('modelModalBackdrop');
  const modelModalClose = document.getElementById('modelModalClose');
  const modelModalImg = document.getElementById('modelModalImg');
  const modelModalTitle = document.getElementById('modelModalTitle');
  const modelModalCategory = document.getElementById('modelModalCategory');
  const modelModalDesc = document.getElementById('modelModalDesc');
  const modelModalHighlights = document.getElementById('modelModalHighlights');
  const modelModalChooseBtn = document.getElementById('modelModalChooseBtn');

  function openModelModal(id, chooseUrl) {
    const data = MODELS_DATA[id] || MODELS_DATA['1'];
    if (!modelModal) return;
    modelModalImg.src = data.img;
    modelModalTitle.textContent = data.title;
    modelModalCategory.textContent = data.category;
    modelModalDesc.textContent = data.desc;
    /* Plusieurs cartes partagent la même fiche : le bouton « Choisir »
       suit la carte réellement ouverte, pour arriver sur le
       configurateur de sa pièce (robe, casquette ou écharpe). */
    modelModalChooseBtn.href = chooseUrl || data.presetUrl;
    modelModalHighlights.innerHTML = data.highlights.map(h => '<li><span>✓</span> ' + h + '</li>').join('');

    const modalThumbs = document.getElementById('modelModalThumbs');
    if (modalThumbs) {
      if (data.views && data.views.length) {
        modalThumbs.innerHTML = data.views.map((v, idx) =>
          '<button type="button" class="model-modal__thumb' + (idx === 0 ? ' is-active' : '') +
            '" data-thumb-src="' + v.src + '" aria-label="Voir la vue : ' + v.label + '">' +
            '<img src="' + v.src + '" alt="" loading="lazy" decoding="async">' +
            '<span>' + v.label + '</span>' +
          '</button>'
        ).join('');
        modalThumbs.hidden = false;
        modalThumbs.querySelectorAll('.model-modal__thumb').forEach(btn => {
          btn.addEventListener('click', () => {
            modalThumbs.querySelectorAll('.model-modal__thumb').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            const targetSrc = btn.getAttribute('data-thumb-src');
            if (targetSrc) modelModalImg.src = targetSrc;
          });
        });
      } else {
        modalThumbs.innerHTML = '';
        modalThumbs.hidden = true;
      }
    }

    modelModal.classList.add('is-open');
    modelModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
  }

  function closeModelModal() {
    if (!modelModal) return;
    modelModal.classList.remove('is-open');
    modelModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-open-modal');
      const choose = btn.closest('.work-card')?.querySelector('.work-card__btn-choose');
      openModelModal(id, choose?.getAttribute('href'));
    });
  });

  modelModalClose?.addEventListener('click', closeModelModal);
  modelModalBackdrop?.addEventListener('click', closeModelModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modelModal?.classList.contains('is-open')) closeModelModal();
  });
})();
