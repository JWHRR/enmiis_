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
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 1000'>" +
        "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
        "<stop offset='0' stop-color='#F4F1EB'/><stop offset='1' stop-color='#E4DDD2'/>" +
        "</linearGradient></defs>" +
        "<rect width='800' height='1000' fill='url(#g)'/>" +
        "<text x='400' y='510' font-family='Georgia, serif' font-size='44' letter-spacing='18' fill='#B9A88C' text-anchor='middle'>ENMIIS</text>" +
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
     Favoris (compteur d'entête)
     ---------------------------------------------------------- */
  const wishlistCountEl = document.getElementById('wishlistCount');
  let wishlistCount = 0;

  function bump(el, value) {
    el.textContent = value;
    el.hidden = value === 0;
    el.classList.remove('is-bumped');
    void el.offsetWidth;
    el.classList.add('is-bumped');
  }

  document.querySelectorAll('.work-card__wishlist').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const active = btn.classList.toggle('is-active');
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.remove('is-popped');
      void btn.offsetWidth;
      btn.classList.add('is-popped');

      wishlistCount += active ? 1 : -1;
      if (wishlistCountEl) bump(wishlistCountEl, wishlistCount);

      const name = btn.closest('.work-card')?.querySelector('.work-card__title')?.textContent || 'Création';
      showToast(active
        ? '<em>' + name + '</em> ajoutée à vos favoris'
        : '<em>' + name + '</em> retirée de vos favoris');
    });
  });

  document.getElementById('wishlistBtn')?.addEventListener('click', () => {
    showToast(wishlistCount > 0
      ? '<em>' + wishlistCount + '</em> création' + (wishlistCount > 1 ? 's' : '') + ' dans vos favoris'
      : 'Votre liste de favoris est vide');
  });

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
      });
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
})();
