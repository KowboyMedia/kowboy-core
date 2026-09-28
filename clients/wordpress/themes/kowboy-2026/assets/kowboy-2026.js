// The theme's script, on the page and inside every shadow root: the menu, the sliders (Swiper,
// in vendor/), the list reloads against the plugin's endpoint, the collapsibles, the gallery's
// "Visa fler bilder", the forms, and the map (Leaflet, in vendor/).
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

  function each(selector, handler) {
    roots().forEach(function (root) {
      root.querySelectorAll(selector).forEach(handler);
    });
  }

  function once(element, flag) {
    if (element.dataset[flag]) return false;
    element.dataset[flag] = '1';
    return true;
  }

  function setupMenu(button) {
    if (!once(button, 'ready')) return;
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      document.body.classList.toggle('k-menu-open', !open);
    });
  }

  function swiper(container, options) {
    if (!once(container, 'ready') || typeof window.Swiper !== 'function') return null;
    return new window.Swiper(container, options);
  }

  function setupCardSlider(container) {
    swiper(container, {
      loop: container.querySelectorAll('.swiper-slide').length > 1,
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
      speed: 500,
    });
  }

  /** The hero's images: a slow crossfade with a slight zoom on the active slide (CSS). */
  function setupHeroSlider(container) {
    swiper(container, {
      loop: true,
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: 2000,
      autoplay: { delay: 6000, disableOnInteraction: false },
      allowTouchMove: false,
    });
  }

  function setupTestimonials(container) {
    var section = container.closest('.k-testimonials');
    swiper(container, {
      slidesPerView: 1,
      spaceBetween: 24,
      breakpoints: { 768: { slidesPerView: 2 } },
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
      navigation: section
        ? {
            nextEl: section.querySelector('[data-next]'),
            prevEl: section.querySelector('[data-prev]'),
          }
        : undefined,
    });
  }

  /** A list: reload its cards from the plugin's endpoint with its parameter set. */
  function setupList(list) {
    if (!once(list, 'ready')) return;
    var params = JSON.parse(list.dataset.params || '{}');
    var cards = list.querySelector('[data-cards]');
    var more = list.querySelector('[data-more]');
    var empty = list.querySelector('[data-empty]');
    var page = parseInt(list.dataset.page || '1', 10);

    function load(append) {
      var url = new URL(list.dataset.reload, window.location.href);
      Object.keys(params).forEach(function (key) {
        if (params[key] !== '' && params[key] !== null && params[key] !== undefined) {
          url.searchParams.set(key, params[key]);
        }
      });
      url.searchParams.set('page', String(page));
      list.classList.add('is-loading');
      return fetch(url.toString())
        .then(function (response) {
          return response.json();
        })
        .then(function (result) {
          if (append) cards.insertAdjacentHTML('beforeend', result.html);
          else cards.innerHTML = result.html;
          if (empty) empty.hidden = result.total > 0;
          if (more) more.hidden = !result.has_more;
          cards.querySelectorAll('[data-card-slider]').forEach(setupCardSlider);
        })
        .finally(function () {
          list.classList.remove('is-loading');
        });
    }

    list.querySelectorAll('[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        list.querySelectorAll('[data-tab]').forEach(function (other) {
          other.classList.remove('is-active');
        });
        tab.classList.add('is-active');
        params.status = tab.dataset.tab;
        page = 1;
        load(false);
      });
    });
    var form = list.querySelector('.k-search');
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
    if (more) {
      more.addEventListener('click', function () {
        page += 1;
        load(true);
      });
    }
  }

  function setupAccordion(button) {
    if (!once(button, 'ready')) return;
    button.addEventListener('click', function () {
      var panel = button.closest('.k-accordion__item').querySelector('.k-accordion__panel');
      var open = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });
  }

  function setupGallery(gallery) {
    if (!once(gallery, 'ready')) return;
    var button = gallery.querySelector('[data-gallery-more]');
    if (!button) return;
    button.addEventListener('click', function () {
      gallery.querySelectorAll('.is-collapsed').forEach(function (item) {
        item.classList.remove('is-collapsed');
      });
      button.parentElement.hidden = true;
    });
  }

  /** A form: sent as JSON to the theme's endpoint; the answer replaces the form with a message. */
  function setupForm(form) {
    if (!once(form, 'ready')) return;
    var message = form.querySelector('[data-message]');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = {};
      new FormData(form).forEach(function (value, key) {
        data[key] = value;
      });
      data.consent = data.consent === '1';
      form.classList.add('is-sending');
      fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (response) {
          return response.json().then(function (body) {
            return { ok: response.ok, body: body };
          });
        })
        .then(function (result) {
          message.hidden = false;
          message.textContent = result.ok
            ? 'Tack! Vi hör av oss.'
            : result.body.error || 'Något gick fel. Försök igen.';
          if (result.ok)
            form.querySelectorAll('input, button').forEach(function (field) {
              field.disabled = true;
            });
        })
        .catch(function () {
          message.hidden = false;
          message.textContent = 'Något gick fel. Försök igen.';
        })
        .finally(function () {
          form.classList.remove('is-sending');
        });
    });
  }

  function setupMap(element) {
    if (!once(element, 'ready') || typeof window.L !== 'object') return;
    var lat = parseFloat(element.dataset.lat);
    var lng = parseFloat(element.dataset.lng);
    var map = window.L.map(element, { scrollWheelZoom: false, zoomControl: true }).setView(
      [lat, lng],
      14,
    );
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    var icon = window.L.icon({
      iconUrl: element.dataset.marker,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    window.L.marker([lat, lng], { icon: icon, title: element.dataset.title }).addTo(map);
  }

  function setup() {
    each('[data-menu-toggle]', setupMenu);
    each('[data-card-slider]', setupCardSlider);
    each('[data-hero-slider]', setupHeroSlider);
    each('[data-testimonials]', setupTestimonials);
    each('[data-list]', setupList);
    each('[data-accordion-button]', setupAccordion);
    each('[data-gallery]', setupGallery);
    each('[data-lead-form]', setupForm);
    each('[data-map]', setupMap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
