/* ============================================================
   ENMIIS — Page des favoris.

   Les favoris sont enregistrés par js/main.js (window.enmiisFavorites)
   au moment du clic sur le cœur d'une création. Cette page se contente
   de les afficher, de permettre leur retrait et de renvoyer vers le
   configurateur.
   ============================================================ */
(function (global) {
  'use strict';

  const store = global.enmiisFavorites;
  const toast = global.enmiisToast || function () {};

  const $ = (sel) => document.querySelector(sel);

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function card(entry) {
    /* Une création sans lien de personnalisation (décor, box cadeau…)
       renvoie vers la page des créations plutôt que vers un preset. */
    const href = entry.href || 'soutenance.html';
    return '<article class="fv-card" data-fav="' + esc(entry.id) + '">' +
      '<div class="fv-card__media">' +
        (entry.img
          ? '<img src="' + esc(entry.img) + '" alt="" loading="lazy" decoding="async">'
          : '') +
        '<button type="button" class="fv-card__remove" data-remove="' + esc(entry.id) + '"' +
          ' aria-label="Retirer ' + esc(entry.title) + ' des favoris">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      (entry.label ? '<p class="fv-card__label">' + esc(entry.label) + '</p>' : '') +
      '<h2 class="fv-card__title">' + esc(entry.title) + '</h2>' +
      (entry.desc ? '<p class="fv-card__desc">' + esc(entry.desc) + '</p>' : '') +
      '<a class="btn btn--solid fv-card__cta" href="' + esc(href) + '">Personnaliser</a>' +
    '</article>';
  }

  function render() {
    const list = store.read();
    const count = list.length;

    $('#fvCount').textContent = count ? count + ' création' + (count > 1 ? 's' : '') : '';
    $('#fvSub').textContent = count
      ? 'Retrouvez ici les créations que vous avez aimées.'
      : '';
    $('#fvEmpty').hidden = count > 0;
    $('#fvGrid').hidden = count === 0;
    $('#fvGrid').innerHTML = list.map(card).join('');
  }

  function bind() {
    $('#fvGrid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove]');
      if (!button) return;
      const node = button.closest('.fv-card');
      const id = button.getAttribute('data-remove');
      const entry = store.read().find((item) => item.id === id);
      if (node) node.classList.add('is-out');
      setTimeout(() => {
        store.remove(id);
        /* render() remet à jour le compteur de l'entête (#fvCount). */
        render();
        toast('<em>' + esc(entry ? entry.title : 'Création') + '</em> retirée de vos favoris');
      }, 200);
    });
  }

  function init() {
    if (!store) return;
    bind();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
