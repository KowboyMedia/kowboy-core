// The theme's script, on the page and inside every shadow root: the menu, the sliders (Swiper,
// in vendor/), the list reloads against the plugin's endpoint, the collapsibles, the gallery's
// "Visa fler bilder" and the full-screen slider a photo opens, the viewings that are over, the
// map (Leaflet, in vendor/), and the form window every form button opens.
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
   * steps' own words stand in parts/form-window.php).
   */
  var FORM_TEXT = {
    title: {
      interest: 'Är du intresserad av bostaden?',
      viewing: 'Boka visning',
      lead: 'Ska du sälja din bostad?',
    },
    subtitleLead: 'Kostnadsfri värdering',
    sent: {
      interest: function (home) {
        return [
          'Din intresseanmälan är skickad',
          (home ? home + '. ' : '') + 'Mäklaren hör av sig.',
        ];
      },
      viewing: function (home, slot) {
        return [
          'Din plats är bokad',
          [home, slot].filter(Boolean).join(' · ') + '. Du får en bekräftelse från mäklaren.',
        ];
      },
      lead: function () {
        return ['Tack, vi hör av oss', 'Kostnadsfri värdering. Mäklaren kontaktar dig.'];
      },
    },
    send: 'Skicka',
    sending: 'Skickar…',
    placesLeft: function (n) {
      return n + ' ' + (n === 1 ? 'plats' : 'platser') + ' kvar';
    },
    full: 'Fullbokad',
    personMissing: 'Fyll i alla fält och godkänn integritetspolicyn.',
    humanWaiting: 'Robotkontrollen är inte klar än. Vänta en liten stund och försök igen.',
    refused: 'Det gick tyvärr inte',
    refusedSlot: 'Någon hann före. Välj en annan tid.',
    failed: 'Det gick inte att skicka just nu',
    failedText: 'Mäklarsystemet svarade inte. Dina uppgifter finns kvar; försök igen om en stund.',
    tooMany: 'För många försök just nu. Vänta en stund och försök igen.',
    notHuman: 'Robotkontrollen gick inte igenom. Försök igen.',
    cannotLoad: 'Det gick inte att hämta formuläret. Ladda om sidan och försök igen.',
  };
  /** Each form's steps before the answer: a booking picks its time first. */
  var FORM_STEPS = { interest: ['person'], viewing: ['slot', 'person'], lead: ['person'] };
  /** The visitor's details after a sent form, in their own browser, so the next form is one tap. */
  var FORM_REMEMBER = 'core-forms:person';
  /** No form leaves before this long after the window opened: a bot measure the window keeps. */
  var FORM_MIN_OPEN_MS = 3000;
  /** How long a send waits for the bot check's answer before asking the visitor to wait. */
  var FORM_HUMAN_WAIT_MS = 8000;
  var TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  var turnstileLoading = null;
  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!turnstileLoading) {
      turnstileLoading = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.onload = function () {
          resolve();
        };
        script.onerror = function () {
          turnstileLoading = null;
          reject(new Error('the bot check did not load'));
        };
        document.head.appendChild(script);
      });
    }
    return turnstileLoading;
  }

  var formDay = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Stockholm',
  });
  var formClock = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm',
  });

  /** "söndag 12 oktober · 13.00–13.30", from the slot's moments; what the CRM gave when one is missing. */
  function slotLabel(startsAt, endsAt) {
    var start = startsAt ? new Date(startsAt) : null;
    var end = endsAt ? new Date(endsAt) : null;
    if (!start || isNaN(start.getTime())) return startsAt || '';
    var until = end && !isNaN(end.getTime()) ? '–' + formClock.format(end).replace(':', '.') : '';
    return formDay.format(start) + ' · ' + formClock.format(start).replace(':', '.') + until;
  }

  /**
   * The form window (parts/form-window.php): every form button (data-k-form, on the page or
   * inside a shadow root) opens it, for an interest, a viewing booking or a free valuation. A
   * booking reads the home's times from the plugin's receiver on this site and picks one; then the
   * person's step, whose form goes to the plugin's other receiver, which sends it on to Core. The
   * page holds no key but the bot check's public one. The person is remembered in the visitor's
   * own browser after a sent form, with a line saying so and "Glöm mig"; a filled honeypot is told
   * it succeeded and sends nothing.
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
    var viewingId = '';
    var viewings = [];
    var slotId = null;
    var openedAt = 0;
    var sending = false;
    var humanWidget = null;
    var humanToken = null;

    function show(step) {
      dialog.querySelectorAll('[data-form-step]').forEach(function (element) {
        element.hidden = element.dataset.formStep !== step;
      });
      var steps = FORM_STEPS[kind];
      var at = steps.indexOf(step);
      var progress = mark('progress');
      progress.hidden = steps.length < 2 || at < 0;
      progress.innerHTML = steps
        .map(function (_, index) {
          return '<i class="' + (index <= at ? 'is-on' : '') + '"></i>';
        })
        .join('');
      if (step === 'person') renderHuman();
      var first = dialog
        .querySelector('[data-form-step="' + step + '"]')
        .querySelector(
          'input:not([tabindex="-1"]), .k-form__slot:not([disabled]), textarea, button:not([hidden])',
        );
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
      field('current_home').checked = false;
      field('consent').checked = false;
      mark('current-home').hidden = kind === 'lead';
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

    /** The bot check's challenge, rendered while the visitor types; its token travels with the send. */
    function renderHuman() {
      var key = dialog.dataset.humanKey;
      if (!key) return;
      loadTurnstile()
        .then(function () {
          if (!window.turnstile) return;
          if (humanWidget !== null) {
            window.turnstile.reset(humanWidget);
            humanToken = null;
            return;
          }
          humanWidget = window.turnstile.render(mark('human'), {
            sitekey: key,
            appearance: 'interaction-only',
            size: 'flexible',
            callback: function (token) {
              humanToken = token;
            },
            'expired-callback': function () {
              humanToken = null;
            },
            'error-callback': function () {
              humanToken = null;
            },
          });
        })
        .catch(function () {
          // no challenge: the send asks the visitor to wait, and Core refuses a form without proof
        });
    }

    /** The token, waiting a little for the challenge; null when the site has no bot check, false while it has none yet. */
    function humanProof() {
      if (!dialog.dataset.humanKey) return Promise.resolve(null);
      var until = Date.now() + FORM_HUMAN_WAIT_MS;
      return new Promise(function (resolve) {
        (function poll() {
          if (humanToken) return resolve(humanToken);
          if (Date.now() >= until) return resolve(false);
          setTimeout(poll, 200);
        })();
      });
    }

    function pickSlot(button) {
      slotId = button.dataset.slot;
      mark('slots')
        .querySelectorAll('.k-form__slot')
        .forEach(function (other) {
          other.setAttribute('aria-checked', String(other === button));
        });
      mark('slot-error').hidden = true;
    }

    /** The home's times as the CRM has them now; a viewing's own button shows only that viewing's. */
    function renderSlots() {
      var box = mark('slots');
      box.innerHTML = '';
      var free = [];
      viewings.forEach(function (viewing) {
        (viewing.slots || []).forEach(function (slot) {
          var button = document.createElement('button');
          button.className = 'k-form__slot';
          button.type = 'button';
          button.setAttribute('role', 'radio');
          button.setAttribute('aria-checked', 'false');
          button.dataset.slot = slot.id;
          var when = document.createElement('span');
          when.textContent = slotLabel(slot.starts_at, slot.ends_at);
          var spots = document.createElement('small');
          var available = slot.available !== false;
          spots.textContent = !available
            ? FORM_TEXT.full
            : slot.free_spots === null || slot.free_spots === undefined
              ? ''
              : FORM_TEXT.placesLeft(slot.free_spots);
          button.append(when, spots);
          if (available) free.push(button);
          else button.disabled = true;
          button.addEventListener('click', function () {
            pickSlot(button);
          });
          box.appendChild(button);
        });
      });
      mark('no-times').hidden = box.children.length > 0;
      mark('next').disabled = free.length === 0;
      mark('slot-error').hidden = true;
      // A viewing's own button, with one free time: picked.
      if (viewingId && free.length === 1) pickSlot(free[0]);
    }

    function loadSlots() {
      // The receiver's address may carry a query of its own (?rest_route= without pretty permalinks).
      var url = new URL(dialog.dataset.slots, window.location.href);
      url.searchParams.set('connection_id', record.connection_id);
      url.searchParams.set('remote_id', record.remote_id);
      return fetch(url.toString(), { headers: { Accept: 'application/json' } })
        .then(function (response) {
          if (!response.ok) throw new Error('no times');
          return response.json();
        })
        .then(function (body) {
          var all = (body && body.viewings) || [];
          var own = viewingId
            ? all.filter(function (viewing) {
                return viewing.id === viewingId;
              })
            : [];
          viewings = own.length > 0 ? own : all;
        });
    }

    function open(button) {
      kind = button.dataset.kForm;
      record = kind === 'lead' ? null : recordRef(button.dataset.record || '');
      home = button.dataset.home || '';
      viewingId = button.dataset.viewing || '';
      viewings = [];
      slotId = null;
      openedAt = Date.now();
      mark('top').classList.remove('is-done');
      mark('title').textContent = FORM_TEXT.title[kind];
      mark('subtitle').textContent = kind === 'lead' ? FORM_TEXT.subtitleLead : home;
      resetPerson();
      if (!dialog.open) dialog.showModal();
      if (kind !== 'viewing') return show('person');
      dialog.querySelectorAll('[data-form-step]').forEach(function (element) {
        element.hidden = true;
      });
      mark('progress').hidden = true;
      mark('loading').hidden = false;
      var opened = openedAt;
      (record ? loadSlots() : Promise.reject(new Error('no home')))
        .then(function () {
          if (opened !== openedAt) return;
          mark('loading').hidden = true;
          renderSlots();
          show('slot');
        })
        .catch(function () {
          if (opened !== openedAt) return;
          mark('loading').hidden = true;
          fail(FORM_TEXT.failed, FORM_TEXT.cannotLoad, false);
          mark('retry').hidden = true;
        });
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

    function fail(title, text, canGoBack) {
      mark('fail-title').textContent = title;
      mark('fail-text').textContent = text;
      mark('back').hidden = !canGoBack;
      mark('retry').hidden = false;
      show('fail');
    }

    function chosenSlot() {
      var found = null;
      viewings.forEach(function (viewing) {
        (viewing.slots || []).forEach(function (slot) {
          if (slot.id === slotId) found = slot;
        });
      });
      return found;
    }

    /** The confirmation becomes the heading (Patric, 2026-10-04). */
    function sent() {
      var slot = chosenSlot();
      var words = FORM_TEXT.sent[kind](home, slot ? slotLabel(slot.starts_at, slot.ends_at) : '');
      mark('title').textContent = words[0];
      mark('subtitle').textContent = words[1];
      mark('top').classList.add('is-done');
      show('end');
    }

    /** The receiver's answer, which is Core's: 200 sent, 409 refused, 403 the bot check, 429 too many, else failed. */
    function answered(status, body) {
      if (status === 200) return sent();
      if (status === 409) {
        var reason = (body && body.reason) || (kind === 'viewing' ? FORM_TEXT.refusedSlot : '');
        return fail(FORM_TEXT.refused, reason, kind === 'viewing');
      }
      if (status === 429) return fail(FORM_TEXT.failed, FORM_TEXT.tooMany, false);
      if (status === 403) return fail(FORM_TEXT.failed, FORM_TEXT.notHuman, false);
      fail(FORM_TEXT.failed, FORM_TEXT.failedText, false);
    }

    function submission(person) {
      var form = {
        id: uuid(),
        kind: kind,
        person: person,
        consent: { given: true, at: new Date().toISOString() },
        source: source(),
      };
      if (record) form.record = record;
      if (kind === 'viewing') form.slot_id = slotId;
      var message = field('message').value.trim();
      if (message) form.message = message;
      if (kind !== 'lead' && field('current_home').checked) form.contact_about_current_home = true;
      return form;
    }

    function send() {
      if (sending) return;
      var person = readPerson();
      var error = mark('error');
      if (!person) {
        error.textContent = FORM_TEXT.personMissing;
        error.hidden = false;
        return;
      }
      error.hidden = true;
      // The honeypot filled: a bot, which is told it succeeded and sends nothing.
      if (field('website').value !== '') return sent();
      var form = submission(person);
      var spent = false;
      sending = true;
      mark('send').disabled = true;
      mark('send').textContent = FORM_TEXT.sending;
      new Promise(function (resolve) {
        setTimeout(resolve, Math.max(0, FORM_MIN_OPEN_MS - (Date.now() - openedAt)));
      })
        .then(humanProof)
        .then(function (proof) {
          if (proof === false) {
            error.textContent = FORM_TEXT.humanWaiting;
            error.hidden = false;
            return;
          }
          var headers = { 'Content-Type': 'application/json' };
          if (proof) headers['X-Core-Human'] = proof;
          spent = true;
          return fetch(dialog.dataset.endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(form),
          }).then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (body) {
                if (response.status === 200) remember(person);
                answered(response.status, body);
              });
          });
        })
        .catch(function () {
          fail(FORM_TEXT.failed, FORM_TEXT.failedText, false);
        })
        .finally(function () {
          sending = false;
          mark('send').disabled = false;
          mark('send').textContent = FORM_TEXT.send;
          // A token is good for one send: the next one earns its own.
          if (spent && humanWidget !== null && window.turnstile) {
            window.turnstile.reset(humanWidget);
            humanToken = null;
          }
        });
    }

    dialog.querySelector('[data-form-step="slot"]').addEventListener('submit', function (event) {
      event.preventDefault();
      if (!slotId) {
        mark('slot-error').hidden = false;
        return;
      }
      show('person');
    });
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
    // After a refused booking: back to the times, read again, to pick another.
    mark('back').addEventListener('click', function () {
      slotId = null;
      mark('fail-title').textContent = '';
      dialog.querySelectorAll('[data-form-step]').forEach(function (element) {
        element.hidden = true;
      });
      mark('loading').hidden = false;
      loadSlots()
        .catch(function () {
          // the times read before stay
        })
        .then(function () {
          mark('loading').hidden = true;
          renderSlots();
          show('slot');
        });
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
