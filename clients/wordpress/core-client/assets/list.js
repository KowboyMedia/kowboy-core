// A list in the browser, for every list in any theme (Patric, 198 a): the wrapper a set renders
// carries `core_client_list_data` (includes/templates.php), and this script refreshes its cards
// once on load, switches its tabs, applies its filters and the place search, and shows more, all
// against the reload endpoint with the same parameter set. The look stays the set's: it finds the
// parts by their attributes, `[data-cards]`, `[data-more]` (a link to the next page),
// `[data-empty]`, `[data-tab]` and `form[data-filters]`, and puts `is-loading` on the list while
// cards load. After each load it sends `core-list:cards` from the list, with the cards' element as
// `detail.cards` and whether they changed as `detail.changed`, so the set can start what its cards
// need (Kowboy 2026: the photo sliders). The refresh on load asks for every list of the page in
// one request. Plain JavaScript, on the page and inside every shadow root the plugin opens; no
// build step.
(function () {
  'use strict';

  /** Every root that may hold a list: the document and each open shadow root under it. */
  function roots() {
    var found = [document];
    document.querySelectorAll('core-view').forEach(function (host) {
      if (host.shadowRoot) found.push(host.shadowRoot);
    });
    return found;
  }

  /**
   * One list. The first pages are built on the server; the script refreshes them once on load,
   * so a page served from a page cache shows the cards as they are now, replacing them only when
   * they changed. "Visa fler" is a link to the next page, which the script loads in place
   * instead, keeping the list's own parameter in the address in step, so a reload or the back
   * button finds the list as it was left; a tab, a filter or a search starts again from the
   * first page. It hands back its refresh on load, for start() to send with the other lists'.
   */
  function setup(list) {
    // A flag of its own, since a set may start its own script on the same element (a slider that is a list).
    if (list.dataset.listReady) return null;
    list.dataset.listReady = '1';
    var params = JSON.parse(list.dataset.params || '{}');
    var cards = list.querySelector('[data-cards]');
    var more = list.querySelector('[data-more]');
    var empty = list.querySelector('[data-empty]');
    var first = parseInt(list.dataset.first || '1', 10);
    var page = parseInt(list.dataset.page || '1', 10);
    var perPage = parseInt(list.dataset.perPage || '10', 10);
    var key = list.dataset.key || '';
    var queue = Promise.resolve();
    if (!cards) return null;

    /** The address with the list's own parameter at `shown` pages, none for the first. */
    function address(shown) {
      var url = new URL(window.location.href);
      if (shown > 1) url.searchParams.set(key, String(shown));
      else url.searchParams.delete(key);
      return url;
    }

    /** The parameter set of pages `from` to `to` (more than one only from the first, as the server builds them). */
    function query(from, to) {
      var set = {};
      Object.keys(params).forEach(function (name) {
        if (params[name] !== '' && params[name] !== null && params[name] !== undefined) {
          set[name] = params[name];
        }
      });
      set.page = String(to > from ? 1 : from);
      set.per_page = String(perPage * (to - from + 1));
      return set;
    }

    /**
     * Pages `from` to `to`, after any load before it; `busy` dims the cards meanwhile. `show`
     * puts the answer in and returns false when it left the cards as they were; `answer` is the
     * answer when it was already asked for (the refresh on load).
     */
    function load(from, to, busy, show, answer) {
      queue = queue
        .then(function () {
          if (busy) list.classList.add('is-loading');
          if (answer) return answer;
          var url = new URL(list.dataset.reload, window.location.href);
          var set = query(from, to);
          Object.keys(set).forEach(function (name) {
            url.searchParams.set(name, set[name]);
          });
          return fetch(url.toString()).then(function (response) {
            return response.json();
          });
        })
        .then(function (result) {
          var changed = show(result) !== false;
          if (empty) empty.hidden = result.total > 0;
          if (more) {
            more.hidden = !result.has_more;
            if (key) more.href = address(page + 1).toString();
          }
          list.dispatchEvent(
            new CustomEvent('core-list:cards', {
              bubbles: true,
              composed: true,
              detail: { cards: cards, changed: changed },
            }),
          );
        })
        .catch(function () {
          // The cards the page already shows stay; the next press tries again.
        })
        .finally(function () {
          list.classList.remove('is-loading');
        });
      return queue;
    }

    /** Again from the first page, for a tab, a filter or a search. */
    function restart() {
      first = 1;
      page = 1;
      if (key) window.history.replaceState(window.history.state, '', address(1).toString());
      load(1, 1, true, function (result) {
        cards.innerHTML = result.html;
      });
    }

    list.querySelectorAll('[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        list.querySelectorAll('[data-tab]').forEach(function (other) {
          other.classList.remove('is-active');
        });
        tab.classList.add('is-active');
        params.status = tab.dataset.tab;
        restart();
      });
    });
    // The place search box (assets/place-search.js, in the list's filters or on a hero above)
    // sends the parameters it stands for; the list takes them over and reloads from the first page.
    list.addEventListener('core-list:params', function (event) {
      Object.keys(event.detail || {}).forEach(function (name) {
        params[name] = event.detail[name];
      });
      restart();
    });
    var form = list.querySelector('form[data-filters]');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        new FormData(form).forEach(function (value, name) {
          params[name] = value;
        });
        restart();
      });
    }
    if (more) {
      more.addEventListener('click', function (event) {
        event.preventDefault();
        page += 1;
        if (key) window.history.replaceState(window.history.state, '', address(page).toString());
        load(page, page, true, function (result) {
          cards.insertAdjacentHTML('beforeend', result.html);
        });
      });
    }
    // The refresh on load, quietly: the cards change only when the list did.
    var hash = list.dataset.hash || '';
    return {
      reload: list.dataset.reload,
      query: query(first, page),
      refresh: function (answer) {
        load(
          first,
          page,
          false,
          function (result) {
            if (result.hash === hash) return false;
            cards.innerHTML = result.html;
          },
          answer,
        );
      },
    };
  }

  /**
   * Every list of the page, and its refresh on load: one request for all of them (twenty at a
   * time, as the endpoint answers), so a page with several lists starts WordPress once.
   */
  function start() {
    var refreshes = [];
    roots().forEach(function (root) {
      root.querySelectorAll('[data-list]').forEach(function (list) {
        var refresh = setup(list);
        if (refresh) refreshes.push(refresh);
      });
    });
    for (var at = 0; at < refreshes.length; at += 20) {
      var group = refreshes.slice(at, at + 20);
      if (group.length === 1) {
        group[0].refresh(null);
        continue;
      }
      var url = new URL(group[0].reload, window.location.href);
      url.searchParams.set(
        'batch',
        JSON.stringify(
          group.map(function (one) {
            return one.query;
          }),
        ),
      );
      var answers = fetch(url.toString())
        .then(function (response) {
          return response.json();
        })
        .then(function (body) {
          return body.lists;
        });
      group.forEach(function (one, index) {
        one.refresh(
          answers.then(function (lists) {
            return lists[index];
          }),
        );
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
