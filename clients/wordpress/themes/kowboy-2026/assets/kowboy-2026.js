// The theme's script, on the page and inside every shadow root: the menu, the sliders (Swiper,
// in vendor/), the list reloads against the plugin's endpoint, the collapsibles, the gallery's
// "Visa fler bilder" and the full-screen slider a photo opens, the viewings that are over, the
// map (Leaflet, in vendor/), and the form window the theme's own form buttons open.
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

  /**
   * A link to a place in the same view (the contact button to the agent, a form button to the
   * agent or the office when no form window is on duty): the browser's own jump cannot see
   * into a shadow root, so the script scrolls there, smoothly where the stylesheet says so
   * (scroll-behavior). A click the form window or the widget has taken is left alone.
   */
  function setupAnchor(link) {
    if (!once(link, 'ready')) return;
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented) return;
      var target = link.getRootNode().getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ block: 'start' });
    });
  }

  /**
   * Every word of the form window the visitor reads, in Swedish, as approved 2026-10-05 (the
   * step's own words stand in parts/form-window.php).
   */
  var FORM_TEXT = {
    title: { interest: 'Är du intresserad av bostaden?' },
    sent: {
      interest: function (home) {
        return [
          'Din intresseanmälan är skickad',
          (home ? home + '. ' : '') + 'Mäklaren hör av sig.',
        ];
      },
    },
    send: 'Skicka',
    sending: 'Skickar…',
    refused: 'Det gick tyvärr inte',
    failed: 'Det gick inte att skicka just nu',
    failedText: 'Mäklarsystemet svarade inte. Dina uppgifter finns kvar; försök igen om en stund.',
    tooMany: 'För många försök just nu. Vänta en stund och försök igen.',
  };
  /** The visitor's details after a sent form, in their own browser, so the next form is one tap. */
  var FORM_REMEMBER = 'core-forms:person';
  /** No form leaves before this long after the window opened: a bot measure the window keeps. */
  var FORM_MIN_OPEN_MS = 3000;

  /**
   * The form window (parts/form-window.php): the theme draws the forms it owns (KOWBOY_FORMS in
   * functions.php; their buttons carry data-k-form, on the page or inside a shadow root) and
   * posts each to the plugin's receiver on this site, which sends it on to Core. The page holds
   * no key. The person is remembered in the visitor's own browser after a sent form, with a line
   * saying so and "Glöm mig"; a filled honeypot is told it succeeded and sends nothing.
   */
  function setupFormWindow(dialog) {
    if (!once(dialog, 'ready') || typeof dialog.showModal !== 'function') return;
    var mark = function (name) {
      return dialog.querySelector('[data-form-' + name + ']');
    };
    var field = function (name) {
      return dialog.querySelector('[name="' + name + '"]');
    };
    var kind = 'interest';
    var record = null;
    var home = '';
    var openedAt = 0;
    var sending = false;

    function show(step) {
      dialog.querySelectorAll('[data-form-step]').forEach(function (element) {
        element.hidden = element.dataset.formStep !== step;
      });
      var first = dialog
        .querySelector('[data-form-step="' + step + '"]')
        .querySelector('input:not([tabindex="-1"]), textarea, button');
      if (first) first.focus();
    }

    function remembered() {
      try {
        var stored = localStorage.getItem(FORM_REMEMBER);
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }

    function remember(person) {
      try {
        if (person) localStorage.setItem(FORM_REMEMBER, JSON.stringify(person));
        else localStorage.removeItem(FORM_REMEMBER);
      } catch {
        // a browser that refuses storage still gets the form
      }
    }

    function resetPerson() {
      var kept = remembered();
      ['first_name', 'last_name', 'phone', 'email'].forEach(function (name) {
        field(name).value = (kept && kept[name]) || '';
      });
      field('message').value = '';
      field('website').value = '';
      field('consent').checked = false;
      mark('remembered').hidden = !kept;
      mark('error').hidden = true;
      mark('send').disabled = false;
      mark('send').textContent = FORM_TEXT.send;
    }

    /** property:<connection>:<id>, as the button names the home, into the submission's record. */
    function recordRef(named) {
      var parts = named.split(':');
      if (parts.length < 3 || parts[0] !== 'property') return null;
      return { datatype: 'property', connection_id: parts[1], remote_id: parts.slice(2).join(':') };
    }

    function open(button) {
      kind = button.dataset.kForm;
      record = recordRef(button.dataset.record || '');
      home = button.dataset.home || '';
      openedAt = Date.now();
      mark('top').classList.remove('is-done');
      mark('title').textContent = FORM_TEXT.title[kind];
      mark('subtitle').textContent = home;
      resetPerson();
      show('person');
      if (!dialog.open) dialog.showModal();
    }

    /** The four fields and the consent, or null while one is missing. */
    function readPerson() {
      var value = function (name) {
        return field(name).value.trim();
      };
      var person = {
        first_name: value('first_name'),
        last_name: value('last_name'),
        email: value('email'),
        phone: value('phone'),
      };
      var emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email);
      var complete = person.first_name && person.last_name && person.phone && emailOk;
      return complete && field('consent').checked ? person : null;
    }

    /** The page's address without its fragment, and its UTM tags, for the submission's source. */
    function source() {
      var url = new URL(window.location.href);
      var utm = {};
      url.searchParams.forEach(function (value, key) {
        if (key.indexOf('utm_') === 0) utm[key] = value;
      });
      url.hash = '';
      return { page: url.toString(), utm: utm };
    }

    function uuid() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });
    }

    function fail(title, text) {
      mark('fail-title').textContent = title;
      mark('fail-text').textContent = text;
      show('fail');
    }

    /** The confirmation becomes the heading (Patric, 2026-10-04). */
    function sent() {
      var words = FORM_TEXT.sent[kind](home);
      mark('title').textContent = words[0];
      mark('subtitle').textContent = words[1];
      mark('top').classList.add('is-done');
      show('end');
    }

    /** The receiver's answer, which is Core's: 200 sent, 409 the CRM's refusal, 429 too many, else failed. */
    function answered(status, body) {
      if (status === 200) return sent();
      if (status === 409) return fail(FORM_TEXT.refused, (body && body.reason) || '');
      if (status === 429) return fail(FORM_TEXT.failed, FORM_TEXT.tooMany);
      fail(FORM_TEXT.failed, FORM_TEXT.failedText);
    }

    function send() {
      if (sending) return;
      var person = readPerson();
      if (!person) {
        mark('error').hidden = false;
        return;
      }
      mark('error').hidden = true;
      // The honeypot filled: a bot, which is told it succeeded and sends nothing.
      if (field('website').value !== '') return sent();
      var submission = {
        id: uuid(),
        kind: kind,
        person: person,
        consent: { given: true, at: new Date().toISOString() },
        source: source(),
      };
      if (record) submission.record = record;
      var message = field('message').value.trim();
      if (message) submission.message = message;
      sending = true;
      mark('send').disabled = true;
      mark('send').textContent = FORM_TEXT.sending;
      new Promise(function (resolve) {
        setTimeout(resolve, Math.max(0, FORM_MIN_OPEN_MS - (Date.now() - openedAt)));
      })
        .then(function () {
          return fetch(dialog.dataset.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submission),
          });
        })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (body) {
              if (response.status === 200) remember(person);
              answered(response.status, body);
            });
        })
        .catch(function () {
          fail(FORM_TEXT.failed, FORM_TEXT.failedText);
        })
        .finally(function () {
          sending = false;
          mark('send').disabled = false;
          mark('send').textContent = FORM_TEXT.send;
        });
    }

    dialog.querySelector('[data-form-step="person"]').addEventListener('submit', function (event) {
      event.preventDefault();
      send();
    });
    mark('close').addEventListener('click', function () {
      dialog.close();
    });
    mark('finish').addEventListener('click', function () {
      dialog.close();
    });
    mark('retry').addEventListener('click', function () {
      show('person');
    });
    mark('forget').addEventListener('click', function () {
      remember(null);
      ['first_name', 'last_name', 'phone', 'email'].forEach(function (name) {
        field(name).value = '';
      });
      mark('remembered').hidden = true;
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
    // The buttons, on the page and inside every shadow root, through the click's composed path
    // in the capture phase, before the link's own jump (setupAnchor steps back from a prevented click).
    document.addEventListener(
      'click',
      function (event) {
        var button = event.composedPath().find(function (node) {
          return node instanceof Element && node.hasAttribute('data-k-form');
        });
        if (!button || !FORM_TEXT.title[button.dataset.kForm]) return;
        event.preventDefault();
        open(button);
      },
      true,
    );
  }

  function setup() {
    each('[data-menu-toggle]', setupMenu);
    each('a[href^="#"]:not([href="#"])', setupAnchor);
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
    each('dialog.k-form', setupFormWindow);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
