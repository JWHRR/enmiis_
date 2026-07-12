/* ============================================================
   ENMIIS — Maison de Luxe
   Interactions: header, mega menu, mobile menu, search,
   hero slider, brand marquee, reveals, quick view, toasts
   ============================================================ */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     Image fallback — if a remote image fails, swap in an
     elegant neutral placeholder so the layout never breaks.
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
    }
    if (img.complete && img.naturalWidth === 0 && img.src && img.src !== FALLBACK) {
      toFallback();
    } else {
      img.addEventListener('error', toFallback);
    }
  });

  /* ----------------------------------------------------------
     Sticky header — condensed state on scroll
     ---------------------------------------------------------- */
  const header = document.getElementById('siteHeader');
  let lastScrollState = false;

  function onScroll() {
    const scrolled = window.scrollY > 24;
    if (scrolled !== lastScrollState) {
      header.classList.toggle('is-scrolled', scrolled);
      lastScrollState = scrolled;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ----------------------------------------------------------
     Mega menu — hover intent with graceful open/close
     ---------------------------------------------------------- */
  const veil = document.getElementById('headerVeil');
  const megaItems = document.querySelectorAll('.main-nav__item.has-mega');
  let openItem = null;
  let hoverTimer = null;

  function openMega(item) {
    if (openItem && openItem !== item) closeMega(openItem);
    item.classList.add('is-open');
    item.querySelector('.main-nav__link').setAttribute('aria-expanded', 'true');
    item.querySelector('.mega-menu').setAttribute('aria-hidden', 'false');
    veil.classList.add('is-visible');
    openItem = item;
  }

  function closeMega(item) {
    item.classList.remove('is-open');
    item.querySelector('.main-nav__link').setAttribute('aria-expanded', 'false');
    item.querySelector('.mega-menu').setAttribute('aria-hidden', 'true');
    if (openItem === item) {
      openItem = null;
      veil.classList.remove('is-visible');
    }
  }

  megaItems.forEach((item) => {
    item.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => openMega(item), 90);
    });
    item.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => closeMega(item), 160);
    });
    // Keyboard: first click opens, second follows link
    item.querySelector('.main-nav__link').addEventListener('click', (e) => {
      if (!item.classList.contains('is-open')) {
        e.preventDefault();
        openMega(item);
      }
    });
    item.addEventListener('focusout', (e) => {
      if (!item.contains(e.relatedTarget)) closeMega(item);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openItem) closeMega(openItem);
  });

  /* ----------------------------------------------------------
     Mobile menu — full-screen slide-in with stagger
     ---------------------------------------------------------- */
  const burger = document.getElementById('burgerBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');
  const scrim = document.getElementById('scrim');

  // Assign stagger indices for the entrance animation
  mobileMenu.querySelectorAll('[data-stagger]').forEach((el, i) => {
    el.style.setProperty('--i', i);
  });

  function setMenu(open) {
    mobileMenu.classList.toggle('is-open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    scrim.classList.toggle('is-visible', open);
    document.body.classList.toggle('is-locked', open);
    if (open) mobileMenuClose.focus();
    else burger.focus();
  }

  burger.addEventListener('click', () => setMenu(true));
  mobileMenuClose.addEventListener('click', () => setMenu(false));
  scrim.addEventListener('click', () => setMenu(false));

  // Accordion sub-menus
  mobileMenu.querySelectorAll('.mobile-menu__toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const sub = toggle.nextElementSibling;

      // Close siblings for a tidy, focused menu
      mobileMenu.querySelectorAll('.mobile-menu__toggle[aria-expanded="true"]').forEach((other) => {
        if (other !== toggle) {
          other.setAttribute('aria-expanded', 'false');
          other.nextElementSibling.style.maxHeight = '0px';
        }
      });

      toggle.setAttribute('aria-expanded', String(!expanded));
      sub.style.maxHeight = expanded ? '0px' : sub.scrollHeight + 'px';
    });
  });

  /* ----------------------------------------------------------
     Search overlay
     ---------------------------------------------------------- */
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('searchInput');

  function setSearch(open) {
    searchOverlay.classList.toggle('is-open', open);
    searchOverlay.setAttribute('aria-hidden', String(!open));
    scrim.classList.toggle('is-visible', open);
    document.body.classList.toggle('is-locked', open);
    if (open) setTimeout(() => searchInput.focus(), 350);
  }

  document.getElementById('searchBtn').addEventListener('click', () => setSearch(true));
  document.getElementById('quickSearchBtn').addEventListener('click', () => setSearch(true));
  document.getElementById('searchClose').addEventListener('click', () => setSearch(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchOverlay.classList.contains('is-open')) setSearch(false);
      if (mobileMenu.classList.contains('is-open')) setMenu(false);
    }
  });
  scrim.addEventListener('click', () => {
    if (searchOverlay.classList.contains('is-open')) setSearch(false);
  });

  /* ----------------------------------------------------------
     Hero slider — fade, autoplay, swipe
     ---------------------------------------------------------- */
  const hero = document.getElementById('hero');
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
    // Restart the dot progress animation
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
    startAuto(); // reset the clock after manual interaction
  }

  dots.forEach((dot, i) => dot.addEventListener('click', () => interact(i)));
  document.getElementById('heroPrev').addEventListener('click', () => interact(current - 1));
  document.getElementById('heroNext').addEventListener('click', () => interact(current + 1));

  // Pause while the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAuto();
    else startAuto();
  });

  // Touch swipe
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

  /* ----------------------------------------------------------
     Brands marquee — auto-scroll with native swipe support
     ---------------------------------------------------------- */
  const marquee = document.getElementById('brandsMarquee');
  const track = document.getElementById('brandsTrack');

  // Duplicate the logos so the loop is seamless
  track.innerHTML += track.innerHTML;
  track.querySelectorAll('.brands__logo').forEach((el, i) => {
    if (i >= track.children.length / 2) el.setAttribute('aria-hidden', 'true');
  });

  let marqueePaused = false;
  let resumeTimer = null;
  let half = 0;

  function measure() { half = track.scrollWidth / 2; }
  measure();
  window.addEventListener('resize', measure);

  function pauseMarquee() {
    marqueePaused = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { marqueePaused = false; }, 2200);
  }

  ['touchstart', 'pointerdown', 'wheel'].forEach((evt) =>
    marquee.addEventListener(evt, pauseMarquee, { passive: true })
  );
  marquee.addEventListener('mouseenter', () => { marqueePaused = true; clearTimeout(resumeTimer); });
  marquee.addEventListener('mouseleave', () => { marqueePaused = false; });

  // Float accumulator so sub-pixel steps never round away to zero
  let marqueePos = 0;

  marquee.addEventListener('scroll', () => {
    // While the user drives the scroll, keep the loop seamless
    if (marqueePaused && half > 0) {
      if (marquee.scrollLeft >= half) marquee.scrollLeft -= half;
      else if (marquee.scrollLeft <= 0) marquee.scrollLeft += half;
      marqueePos = marquee.scrollLeft;
    }
  }, { passive: true });

  if (!prefersReducedMotion) {
    let lastTime = performance.now();
    function tick(now) {
      const dt = Math.min(now - lastTime, 48);
      lastTime = now;
      if (!marqueePaused && half > 0) {
        marqueePos += dt * 0.035; // gentle, luxurious pace
        if (marqueePos >= half) marqueePos -= half;
        marquee.scrollLeft = marqueePos;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     Scroll reveal
     ---------------------------------------------------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    // Stagger siblings that arrive in the same batch
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
    toast.innerHTML = html;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  /* ----------------------------------------------------------
     Wishlist + cart badges
     ---------------------------------------------------------- */
  const wishlistCountEl = document.getElementById('wishlistCount');
  const cartCountEl = document.getElementById('cartCount');
  let wishlistCount = 0;
  let cartCount = 0;

  function bump(el, value) {
    el.textContent = value;
    el.hidden = value === 0;
    el.classList.remove('is-bumped');
    void el.offsetWidth;
    el.classList.add('is-bumped');
  }

  document.querySelectorAll('.product-card__wishlist').forEach((btn) => {
    btn.addEventListener('click', () => {
      const active = btn.classList.toggle('is-active');
      btn.setAttribute('aria-pressed', String(active));
      btn.classList.remove('is-popped');
      void btn.offsetWidth;
      btn.classList.add('is-popped');

      wishlistCount += active ? 1 : -1;
      bump(wishlistCountEl, wishlistCount);

      const name = btn.closest('.product-card').dataset.name;
      showToast(active
        ? '<em>' + name + '</em> added to your wishlist'
        : '<em>' + name + '</em> removed from your wishlist');
    });
  });

  /* ----------------------------------------------------------
     Quick view modal
     ---------------------------------------------------------- */
  const modal = document.getElementById('quickviewModal');
  const qvImage = document.getElementById('qvImage');
  const qvBrand = document.getElementById('qvBrand');
  const qvName = document.getElementById('qvName');
  const qvPrice = document.getElementById('qvPrice');
  const qvDesc = document.getElementById('qvDesc');
  const qvAdd = document.getElementById('qvAdd');

  function openModal(card) {
    const img = card.querySelector('.product-card__img--primary');
    qvImage.src = img.currentSrc || img.src;
    qvImage.alt = card.dataset.name;
    qvBrand.textContent = card.dataset.brand;
    qvName.textContent = card.dataset.name;
    qvPrice.textContent = card.dataset.price;
    qvDesc.textContent = card.dataset.desc;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    modal.querySelector('.modal__close').focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
  }

  document.querySelectorAll('.product-card__quickview').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.closest('.product-card')));
  });
  modal.querySelectorAll('[data-modal-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  qvAdd.addEventListener('click', () => {
    cartCount += 1;
    bump(cartCountEl, cartCount);
    closeModal();
    showToast('<em>' + qvName.textContent + '</em> added to your shopping bag');
  });

  /* ----------------------------------------------------------
     Newsletter
     ---------------------------------------------------------- */
  const newsletterForm = document.getElementById('newsletterForm');
  const newsletterSuccess = document.getElementById('newsletterSuccess');
  newsletterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    newsletterForm.hidden = true;
    newsletterSuccess.hidden = false;
  });
})();
