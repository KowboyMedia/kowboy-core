// The theme's script, on the page and inside every shadow root: the menu, the sliders (Swiper,
// in vendor/), the list reloads against the plugin's endpoint, the collapsibles, the gallery's
// "Visa fler bilder" and the full-screen slider a photo opens, the viewings that are over, and
// the map (Leaflet, in vendor/).
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

  /** The hamburger: the bars fold into a cross and the menu slides in (both in the stylesheet). */
  function setupMenu(button) {
    if (!once(button, 'ready')) return;
    function toggle(open) {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('k-menu-open', open);
    }
    button.addEventListener('click', function () {
      toggle(button.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') toggle(false);
    });
  }

  function swiper(container, options) {
    if (!once(container, 'ready') || typeof window.Swiper !== 'function') return null;
    return new window.Swiper(container, options);
  }

  /**
   * A property's floor plans, when it has several: one a slide, with dots. The slider is as
   * tall as the tallest plan (no measured height: the files load lazily, and a height measured
   * before they load would be a few pixels).
   */
  function setupPlanSlider(container) {
    swiper(container, {
      speed: 500,
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
    });
  }

  /** A card's photos: swipeable, with dots; a plain click on a photo (no swipe) follows the card's link. */
  function setupCardSlider(container) {
    var card = container.closest('[data-card-url]');
    swiper(container, {
      loop: container.querySelectorAll('.swiper-slide').length > 1,
      pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
      speed: 500,
      on: {
        click: function (instance, event) {
          if (card && !event.target.closest('.swiper-pagination')) {
            window.location.href = card.dataset.cardUrl;
          }
        },
      },
    });
  }

  /**
   * The hero's images: a slow crossfade with a slight zoom on the active slide (CSS). A hero
   * marked `data-hero-swipe` (a property's) also moves on a swipe or a drag, with the same fade.
   */
  function setupHeroSlider(container) {
    swiper(container, {
      loop: container.querySelectorAll('.swiper-slide').length > 1,
      effect: 'fade',
      fadeEffect: { crossFade: true },
      speed: 2000,
      autoplay: { delay: 6000, disableOnInteraction: false },
      allowTouchMove: container.hasAttribute('data-hero-swipe'),
      grabCursor: container.hasAttribute('data-hero-swipe'),
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
    // The place search box (the plugin's, in the list's filters or on the hero above) sends the
    // parameters it stands for; the list takes them over and reloads from the first page.
    list.addEventListener('core-list:params', function (event) {
      Object.keys(event.detail || {}).forEach(function (key) {
        params[key] = event.detail[key];
      });
      page = 1;
      load(false);
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

  /** A collapsible: the item's `is-open` class, which the stylesheet animates. */
  function setupAccordion(button) {
    if (!once(button, 'ready')) return;
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.closest('.k-accordion__item').classList.toggle('is-open', open);
    });
  }

  /** The full-screen slider over the page: every photo, arrows, keys, pinch zoom, a close button. */
  function openLightbox(urls, index) {
    var box = document.createElement('div');
    box.className = 'k-lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Bilder');
    var close = document.createElement('button');
    close.className = 'k-lightbox__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Stäng');
    close.innerHTML = '&times;';
    var slider = document.createElement('div');
    slider.className = 'swiper k-lightbox__slider';
    var wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    urls.forEach(function (url) {
      var slide = document.createElement('div');
      slide.className = 'swiper-slide';
      var zoom = document.createElement('div');
      zoom.className = 'swiper-zoom-container';
      var image = document.createElement('img');
      image.src = url;
      image.alt = '';
      zoom.appendChild(image);
      slide.appendChild(zoom);
      wrapper.appendChild(slide);
    });
    slider.appendChild(wrapper);
    ['swiper-button-prev', 'swiper-button-next', 'swiper-pagination'].forEach(function (name) {
      var part = document.createElement('div');
      part.className = name;
      slider.appendChild(part);
    });
    box.appendChild(close);
    box.appendChild(slider);
    document.body.appendChild(box);
    document.body.classList.add('k-lightbox-open');
    var instance = new window.Swiper(slider, {
      initialSlide: index,
      loop: urls.length > 1,
      keyboard: { enabled: true },
      zoom: true,
      navigation: {
        nextEl: slider.querySelector('.swiper-button-next'),
        prevEl: slider.querySelector('.swiper-button-prev'),
      },
      pagination: { el: slider.querySelector('.swiper-pagination'), type: 'fraction' },
    });
    function shut() {
      instance.destroy(true, true);
      box.remove();
      document.body.classList.remove('k-lightbox-open');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(event) {
      if (event.key === 'Escape') shut();
    }
    close.addEventListener('click', shut);
    box.addEventListener('click', function (event) {
      if (event.target.classList.contains('swiper-slide')) shut();
    });
    document.addEventListener('keydown', onKey);
    close.focus();
  }

  /** The gallery's photos (data-images, the full files): "Visa fler bilder", and a photo opens the slider. */
  function setupGallery(gallery) {
    if (!once(gallery, 'ready')) return;
    var urls = JSON.parse(gallery.dataset.images || '[]');
    gallery.querySelectorAll('button[data-lightbox]').forEach(function (button) {
      button.addEventListener('click', function () {
        openLightbox(urls, parseInt(button.dataset.lightbox, 10) || 0);
      });
    });
    var button = gallery.querySelector('[data-gallery-more]');
    if (!button) return;
    button.addEventListener('click', function () {
      gallery.querySelectorAll('.is-collapsed').forEach(function (item) {
        item.classList.remove('is-collapsed');
      });
      button.parentElement.hidden = true;
    });
  }

  /** The phone's photo slider (parts/gallery.php): one photo a screen, a count, and a tap opens the full-screen slider. */
  function setupPhotoSlider(container) {
    var gallery = container.closest('[data-gallery]');
    var instance = swiper(container, {
      pagination: { el: container.querySelector('.swiper-pagination'), type: 'fraction' },
      on: {
        click: function (self, event) {
          var slide = event.target.closest('[data-lightbox]');
          if (slide && gallery)
            openLightbox(
              JSON.parse(gallery.dataset.images || '[]'),
              parseInt(slide.dataset.lightbox, 10) || 0,
            );
        },
      },
    });
    return instance;
  }

  /** A property's hero: a click on the photo (not on the text, a link or a button) opens the slider at the photo shown. */
  function setupHeroLightbox(hero) {
    if (!once(hero, 'lightboxReady')) return;
    hero.addEventListener('click', function (event) {
      if (event.target.closest('a, button, .k-hero__content')) return;
      var gallery = hero.getRootNode().querySelector('[data-gallery]');
      if (!gallery) return;
      var active = hero.querySelector('.swiper-slide-active');
      openLightbox(
        JSON.parse(gallery.dataset.images || '[]'),
        active ? parseInt(active.dataset.index || '0', 10) || 0 : 0,
      );
    });
  }

  /**
   * A property's viewings: the page carries every one, and the browser hides those that are over
   * (so a cached page never shows a past viewing), keeps at most the CRM's visible limit, and
   * shows the empty text when none remains.
   */
  function setupViewings(block) {
    if (!once(block, 'ready')) return;
    var limit = parseInt(block.dataset.limit || '0', 10) || 0;
    var empty = block.querySelector('[data-viewings-empty]');
    function refresh() {
      var now = Date.now();
      var shown = 0;
      block.querySelectorAll('[data-viewing]').forEach(function (viewing) {
        var until = Date.parse(viewing.dataset.until || '');
        var upcoming = isNaN(until) || until >= now;
        var visible = upcoming && (limit < 1 || shown < limit);
        if (visible) shown += 1;
        viewing.hidden = !visible;
      });
      if (empty) empty.hidden = shown > 0;
    }
    refresh();
    window.setInterval(refresh, 60000);
  }

  /** Every ring of a GeoJSON polygon or multipolygon, as Leaflet's [lat, lng] pairs. */
  function rings(shape, out) {
    if (!Array.isArray(shape)) return out;
    if (shape.length && Array.isArray(shape[0]) && typeof shape[0][0] === 'number') {
      out.push(
        shape.map(function (point) {
          return [point[1], point[0]];
        }),
      );
      return out;
    }
    shape.forEach(function (part) {
      rings(part, out);
    });
    return out;
  }

  function setupMap(element) {
    if (!once(element, 'ready') || typeof window.L !== 'object') return;
    var lat = parseFloat(element.dataset.lat);
    var lng = parseFloat(element.dataset.lng);
    var outline = [];
    try {
      outline = rings(JSON.parse(element.dataset.polygon || 'null'), []);
    } catch {
      outline = [];
    }
    var map = window.L.map(element, { scrollWheelZoom: false, zoomControl: false });
    // On a high-density screen the tiles of one zoom level in are drawn at half size, so the map is sharp (Patric, 2026-10-03).
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      detectRetina: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    if (outline.length) {
      var area = window.L.polygon(outline, {
        color: '#111111',
        weight: 2,
        fillOpacity: 0.08,
      }).addTo(map);
      map.fitBounds(area.getBounds(), { padding: [24, 24] });
    }
    if (!isNaN(lat) && !isNaN(lng)) {
      var icon = window.L.divIcon({
        className: 'k-map__pin',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      window.L.marker([lat, lng], { icon: icon, title: element.dataset.title }).addTo(map);
      if (!outline.length) map.setView([lat, lng], 14);
    }
  }

  function setup() {
    each('[data-menu-toggle]', setupMenu);
    each('[data-card-slider]', setupCardSlider);
    each('[data-plan-slider]', setupPlanSlider);
    each('[data-hero-slider]', setupHeroSlider);
    each('[data-testimonials]', setupTestimonials);
    each('[data-list]', setupList);
    each('[data-accordion-button]', setupAccordion);
    each('[data-gallery]', setupGallery);
    each('[data-photo-slider]', setupPhotoSlider);
    each('[data-viewings]', setupViewings);
    each('.k-hero[data-lightbox]', setupHeroLightbox);
    each('[data-map]', setupMap);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
