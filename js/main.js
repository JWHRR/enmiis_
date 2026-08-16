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

  if (searchOverlay) {
    document.getElementById('searchBtn')?.addEventListener('click', () => setSearch(true));
    document.getElementById('quickSearchBtn')?.addEventListener('click', () => setSearch(true));
    document.getElementById('searchClose')?.addEventListener('click', () => setSearch(false));
    scrim.addEventListener('click', () => {
      if (searchOverlay.classList.contains('is-open')) setSearch(false);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
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
    const OWN = {
      toges:     { produit: 'robe',      label: 'Téléverser mon propre modèle de robe' },
      echarpes:  { produit: 'echarpe',   label: 'Téléverser mon propre modèle d’écharpe' },
      mortiers:  { produit: 'casquette', label: 'Téléverser mon propre modèle de mortier' },
    };
    const own = document.getElementById('worksOwn');
    const ownCta = document.getElementById('worksOwnCta');

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
      });
    });

    syncOwn((chips.find((c) => c.classList.contains('is-active')) || {}).dataset?.filter || 'all');
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
    '1': {
      title: "Toge d’Excellence — Broderie Or & Logos Universitaires",
      category: "Toges d'Apparat",
      img: "img/soutenance/1.png",
      desc: "Confectionnée dans notre gabardine de laine d'exception, cette tenue d'excellence se distingue par son tombé fluide, ses finitions dorées et ses broderies héraldiques sur mesure. Comprend le col en V avec double galon, les manches cloches sculptées, l'écharpe d'honneur ainsi que la personnalisation avec votre logo universitaire et le texte 'Félicitations Docteur'. Idéale pour les soutenances de thèse de médecine, pharmacie, droit et doctorats d'État.",
      highlights: [
        "Gabardine de laine noble & finitions satinées dorées",
        "Broderie haute précision au fil métallisé",
        "Écharpe d'honneur personnalisable nominative",
        "Modèle officiel pour doctorats & soutenances"
      ],
      presetUrl: "customizer.html?preset=1"
    },
    '2': {
      title: "Toge de Prestance — Finition Velours & Écharpe Satin",
      category: "Toges de Soutenance",
      img: "img/soutenance/2.png",
      desc: "Incarnation du raffinement académique, cette toge associe la légèreté de la gabardine à la profondeur du velours noir. Dotée d'un mortier traditionnel ajusté avec gland torsadé et d'une écharpe brodée au fil d'or, elle offre une allure solennelle et élégante. Parfaitement adaptée pour marquer la réussite des diplômés lors de la cérémonie officielle.",
      highlights: [
        "Tissu satiné ultra-léger et agréable au porté",
        "Col et rehausses en velours haute qualité",
        "Mortier ajustable avec gland millésimé",
        "Coupe élégante mixte convenant à toutes les statures"
      ],
      presetUrl: "customizer.html?preset=2"
    },
    '3': {
      title: "Pack Soutenance Complète — Toge, Écharpe & Mortier",
      category: "Coffret Soutenance",
      img: "img/soutenance/3.png",
      desc: "Le coffret ultime pour célébrer votre grand jour. Ce pack réunit votre tenue sur mesure (toge, mortier, écharpe brodée nominative avec votre nom, diplôme et date de soutenance) ainsi que le dossier de fabrication préparé par notre atelier. Conçu pour garantir un confort parfait durant votre présentation et des photos de diplôme inoubliables.",
      highlights: [
        "Ensemble complet sur mesure prêt pour le jour J",
        "Écharpe nominative brodée (Nom, Spécialité & Date)",
        "Inclus la housse de protection sérigraphiée ENMIIS",
        "Livraison offerte & suivi dédié par notre atelier"
      ],
      presetUrl: "customizer.html?preset=3"
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
