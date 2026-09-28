// The set's script: the behaviours of the package's 2025 template (kowboy-templates-v2-v3, on
// Patric's word, 2026-09-28) written against the set's own markup: the card and plan sliders
// (Swiper, in vendor/), the hero carousel (ken-burns-carousel, in vendor/), the collapsible fact
// tables, the gallery's "Visa fler bilder", the bid history, the reviews' "show all", and the
// list reloads against the plugin's endpoint. It looks inside shadow roots too, so the same file
// serves both modes.
(function () {
  'use strict';

  /** Every root that may hold views: the document and each open shadow root under it. */
  function roots() {
    var found = [document];
    document.querySelectorAll('core-view').forEach(function (host) {
      if (host.shadowRoot) found.push(host.shadowRoot);
    });
    return found;
  }

  function query(selector, handler) {
    roots().forEach(function (root) {
      root.querySelectorAll(selector).forEach(handler);
    });
  }

  function setupSwiper(container) {
    if (container.getAttribute('data-swiper-ready') || typeof window.Swiper !== 'function') return;
    container.setAttribute('data-swiper-ready', '1');
    new window.Swiper(container, {
      loop: container.querySelectorAll('.swiper-slide').length > 1,
      autoplay: false,
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
      navigation: {
        nextEl: container.querySelector('.swiper-button-next'),
        prevEl: container.querySelector('.swiper-button-prev'),
      },
      effect: 'slide',
      speed: 500,
    });
  }

  /** A list: reload its cards from the plugin's endpoint with its parameter set. */
  function setupList(list) {
    if (list.getAttribute('data-list-ready')) return;
    list.setAttribute('data-list-ready', '1');
    var params = JSON.parse(list.getAttribute('data-params') || '{}');
    var wrapper = list.closest('.kowboy-property-list-wrapper') || list;
    var row = list.querySelector('.row');
    var more = wrapper.querySelector('.load-more-button');
    var page = parseInt(list.getAttribute('data-page') || '1', 10);
    var scope = list.getRootNode();
    var filter = scope.querySelector('[data-kowboy-filter-for="' + list.id + '"]');
    var form = filter ? filter.querySelector('.kowboy-filter-form') : null;
    var statusButtons = scope.querySelectorAll('#filter_' + list.id + ' .status-filter-items button');

    function load(append) {
      var url = new URL(list.getAttribute('data-reload'), window.location.href);
      Object.keys(params).forEach(function (key) {
        if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
          url.searchParams.set(key, params[key]);
        }
      });
      url.searchParams.set('page', String(page));
      wrapper.classList.add('is-loading');
      return fetch(url.toString())
        .then(function (response) {
          return response.json();
        })
        .then(function (result) {
          if (append) row.insertAdjacentHTML('beforeend', result.html);
          else row.innerHTML = result.html;
          if (!result.total) {
            row.innerHTML =
              '<div class="no-results-message">Ingen fastighet hittades med dina angivna sökkriterier.</div>';
          }
          if (more) more.hidden = !result.has_more;
          row.querySelectorAll('.swiper').forEach(setupSwiper);
        })
        .finally(function () {
          wrapper.classList.remove('is-loading');
        });
    }

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        new FormData(form).forEach(function (value, key) {
          params[key] = value;
        });
        page = 1;
        load(false);
      });
    }
    statusButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        statusButtons.forEach(function (other) {
          other.classList.remove('active');
        });
        button.classList.add('active');
        params.status = button.getAttribute('data-status');
        page = 1;
        load(false);
      });
    });
    if (more) {
      more.addEventListener('click', function () {
        page += 1;
        load(true);
      });
    }
    // The first page came from the server; one reload on load keeps it current.
    if (list.getAttribute('data-hydrate') === '1') load(false);
  }

  /** The fact tables: one open at a time is not required; each button toggles its own content. */
  function setupCollapsible(button) {
    if (button.getAttribute('data-toggle-ready')) return;
    button.setAttribute('data-toggle-ready', '1');
    button.addEventListener('click', function () {
      var content = button.nextElementSibling;
      var icon = button.querySelector('[data-icon]');
      var item = button.closest('.collapsible-item');
      if (!content) return;
      var open = content.dataset.open === 'true';
      content.classList.toggle('hidden', open);
      content.dataset.open = open ? 'false' : 'true';
      if (item) item.classList.toggle('is-open', !open);
      if (icon) icon.classList.toggle('rotate-180', !open);
    });
  }

  /** The gallery: a few rows first, "Visa fler bilder" shows the rest. */
  function setupGallery(gallery) {
    if (gallery.getAttribute('data-gallery-ready')) return;
    gallery.setAttribute('data-gallery-ready', '1');
    var items = gallery.querySelectorAll('.masonry-item');
    var width = gallery.clientWidth || window.innerWidth;
    var columns = width <= 768 ? 1 : width <= 1024 ? 2 : 3;
    var maxVisible = columns * (width <= 768 ? 6 : 3);
    var toggle = gallery.getRootNode().querySelector('[data-gallery-toggle="' + gallery.id + '"]');
    items.forEach(function (item, index) {
      item.classList.toggle('is-collapsed', index >= maxVisible);
    });
    if (!toggle) return;
    toggle.classList.toggle('is-hidden', items.length <= maxVisible);
    toggle.addEventListener('click', function () {
      items.forEach(function (item) {
        item.classList.remove('is-collapsed');
      });
      toggle.classList.add('is-hidden');
      toggle.setAttribute('aria-expanded', 'true');
    });
  }

  /** The bid history: three rows, then "Visa all budhistorik". */
  function setupBidding(button) {
    if (button.getAttribute('data-bids-ready')) return;
    button.setAttribute('data-bids-ready', '1');
    var block = button.closest('.bidding-block');
    var text = button.querySelector('#buttonText');
    var arrow = button.querySelector('#arrowIcon');
    var expanded = false;
    button.addEventListener('click', function () {
      expanded = !expanded;
      block.querySelectorAll('.extra-row').forEach(function (rowEl) {
        rowEl.classList.toggle('hidden', !expanded);
      });
      if (arrow) arrow.classList.toggle('rotate-180', expanded);
      if (text) text.textContent = expanded ? 'Visa mindre' : 'Visa all budhistorik';
    });
  }

  /** The reviews: three cards, then "Show all". */
  function setupTestimonials(button) {
    if (button.getAttribute('data-reviews-ready')) return;
    button.setAttribute('data-reviews-ready', '1');
    var section = button.closest('.agent-testimonials-section');
    var label = button.querySelector('.testimonial-show-label');
    var visible = Number(button.dataset.visibleCount || 3);
    var cards = section ? Array.prototype.slice.call(section.querySelectorAll('.testimonial-card')) : [];
    button.addEventListener('click', function () {
      var expanded = button.dataset.expanded === 'true';
      cards.forEach(function (card, index) {
        card.classList.toggle('is-hidden', expanded && index >= visible);
      });
      button.dataset.expanded = expanded ? 'false' : 'true';
      button.classList.toggle('is-expanded', !expanded);
      if (label) label.textContent = expanded ? button.dataset.labelCollapsed : button.dataset.labelExpanded;
    });
  }

  function setup() {
    query('.swiper', setupSwiper);
    query('.property-list[data-reload]', setupList);
    query('[data-toggle]', setupCollapsible);
    query('.property-gallery-masonry', setupGallery);
    query('#toggleButton', setupBidding);
    query('.testimonial-show-btn', setupTestimonials);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
