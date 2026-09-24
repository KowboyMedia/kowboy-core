// The set's script: list hydration and reloads, the status buttons, "Visa fler", the card
// sliders, the hero carousel and the gallery's "Visa fler bilder". It looks inside shadow roots
// too (the site's shadow DOM setting), so the same file serves both modes.
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

  /** A list: reload its cards from the reload endpoint with its parameter set. */
  function setupList(list) {
    var params = JSON.parse(list.getAttribute('data-params') || '{}');
    var cards = list.querySelector('.k26-cards');
    var more = list.querySelector('.k26-list__more-button');
    var empty = list.querySelector('.k26-list__empty');
    var form = list.querySelector('.k26-filter');
    var page = parseInt(list.getAttribute('data-page') || '1', 10);

    function load(append) {
      var url = new URL(list.getAttribute('data-reload'), window.location.href);
      Object.keys(params).forEach(function (key) {
        if (params[key] !== '' && params[key] !== null && params[key] !== undefined)
          url.searchParams.set(key, params[key]);
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
          if (more) more.hidden = !result.has_more;
          if (empty) empty.hidden = result.total > 0;
          cards.querySelectorAll('.k26-slider').forEach(setupSlider);
        })
        .finally(function () {
          list.classList.remove('is-loading');
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
    list.querySelectorAll('.k26-status-filter button').forEach(function (button) {
      button.addEventListener('click', function () {
        list.querySelectorAll('.k26-status-filter button').forEach(function (other) {
          other.classList.remove('is-active');
        });
        button.classList.add('is-active');
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
    load(false);
  }

  function setupSlider(slider) {
    if (slider.getAttribute('data-ready')) return;
    slider.setAttribute('data-ready', '1');
    var slides = slider.querySelectorAll('.k26-slider__slide');
    var current = 0;
    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === current);
      });
    }
    var prev = slider.querySelector('.k26-slider__prev');
    var next = slider.querySelector('.k26-slider__next');
    if (prev)
      prev.addEventListener('click', function (event) {
        event.preventDefault();
        show(current - 1);
      });
    if (next)
      next.addEventListener('click', function (event) {
        event.preventDefault();
        show(current + 1);
      });
  }

  function setupCarousel(carousel) {
    var images = carousel.querySelectorAll('img');
    if (images.length < 2) return;
    var current = 0;
    setInterval(function () {
      images[current].classList.remove('is-active');
      current = (current + 1) % images.length;
      images[current].classList.add('is-active');
    }, 6000);
  }

  function setupGallery(gallery) {
    var button = gallery.querySelector('[data-gallery-more]');
    if (!button) return;
    button.addEventListener('click', function () {
      gallery.querySelectorAll('.k26-gallery__item.is-hidden').forEach(function (item) {
        item.classList.remove('is-hidden');
      });
      button.hidden = true;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    query('.k26-list', setupList);
    query('.k26-slider', setupSlider);
    query('.k26-hero__images', setupCarousel);
    query('.k26-gallery', setupGallery);
  });
})();
