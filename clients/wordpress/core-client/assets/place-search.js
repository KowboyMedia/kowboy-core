// The place search box (includes/place-search.php, docs/search.md): Tom Select (lib/tom-select)
// over the multi-select the page rendered, the chosen places as pills, every change written to
// the hidden fields and the address and sent to the list on the page, which reloads its cards
// (the set's list script listens for `core-list:params`). Typing without choosing searches the
// words as free text, with the pills saying where (Default 134): Enter sends them when no place
// matches, and the form's button always. Plain JavaScript, on the page and inside every shadow
// root the plugin opens; no build step.
(function () {
  'use strict';

  /** Every root that may hold a box: the document and each open shadow root under it. */
  function roots() {
    var found = [document];
    document.querySelectorAll('core-view').forEach(function (host) {
      if (host.shadowRoot) found.push(host.shadowRoot);
    });
    return found;
  }

  var TomSelect = window.TomSelect;
  if (typeof TomSelect !== 'function') return;

  /**
   * The library with one change: closing the list keeps the typed words. Tom Select clears them
   * when the list closes, also when the field loses focus, which would empty the field as the
   * visitor reaches for the button; here the words are the free text of the search, so they
   * stay until a place is chosen (below) or the visitor deletes them.
   */
  class PlaceSelect extends TomSelect {
    close() {
      super.close(false);
    }
  }

  function setup(box) {
    var select = box.querySelector('select');
    if (!select || select.tomselect) return;
    var hidden = {
      q: box.querySelector('input[name="q"]'),
      areas: box.querySelector('input[name="areas"]'),
      lkf: box.querySelector('input[name="lkf"]'),
    };
    var form = box.closest('form');
    var noMatch = select.dataset.noMatch || '';

    /** The chosen places into the two hidden fields: the option values are `kind:id`. */
    function writeHidden(items) {
      var chosen = { areas: [], lkf: [] };
      items.forEach(function (value) {
        var at = value.indexOf(':');
        var kind = value.slice(0, at);
        if (chosen[kind]) chosen[kind].push(value.slice(at + 1));
      });
      hidden.areas.value = chosen.areas.join(',');
      hidden.lkf.value = chosen.lkf.join(',');
    }
    /** The parameters the box stands for: the form's fields when it is in one, else its own three. */
    function fields() {
      var values = {};
      (form || box).querySelectorAll('input[name], select[name]').forEach(function (field) {
        values[field.name] = field.value;
      });
      return values;
    }
    function writeAddress(values) {
      var url = new URL(window.location.href);
      Object.keys(values).forEach(function (key) {
        if (values[key] === '') url.searchParams.delete(key);
        else url.searchParams.set(key, values[key]);
      });
      window.history.replaceState(window.history.state, '', url.toString());
    }
    /** The list the box drives: the one around it, else the first on the page. */
    function target() {
      var around = box.closest('[data-list]');
      if (around) return around;
      var found = null;
      roots().forEach(function (root) {
        if (!found) found = root.querySelector('[data-list]');
      });
      return found;
    }
    function search() {
      hidden.q.value = ts.control_input.value;
      var values = fields();
      writeAddress(values);
      var drives = target();
      if (drives) drives.dispatchEvent(new CustomEvent('core-list:params', { detail: values }));
      else if (form) form.submit();
    }

    var ts = new PlaceSelect(select, {
      plugins: { remove_button: { title: 'Ta bort' } },
      placeholder: select.dataset.placeholder || '',
      maxItems: null,
      maxOptions: null,
      hideSelected: true,
      closeAfterSelect: true,
      lockOptgroupOrder: true,
      // The library waits 300 ms after a keystroke before it filters; the list is small and Enter
      // right after the last letter must act on what the letters leave, so it filters at once.
      refreshThrottle: 0,
      create: false,
      render: {
        no_results: function (data, escape) {
          return noMatch ? '<div class="no-results">' + escape(noMatch) + '</div>' : null;
        },
      },
    });
    // The names for a screen reader: the library finds the label on the page, not in a shadow root.
    if (!ts.control_input.hasAttribute('aria-labelledby')) {
      ts.control_input.setAttribute('aria-label', box.querySelector('label').textContent);
      ts.dropdown_content.setAttribute('aria-label', 'Platser');
    }
    // The words follow the field: as the visitor types (the library's `type`), and whenever the
    // library sets the field itself (its `update` on the field, as when a click on a pill
    // highlights it and empties the words).
    ts.setTextboxValue(hidden.q.value);
    ts.on('type', function (words) {
      hidden.q.value = words;
    });
    ts.control_input.addEventListener('update', function () {
      hidden.q.value = ts.control_input.value;
    });
    ts.on('item_add', function () {
      // A chosen place takes the words: they were the search for it, not free text.
      ts.setTextboxValue('');
    });
    ts.on('item_remove', function (value) {
      // A place the list did not offer (chosen in the address, no home here) leaves with its pill.
      if (ts.options[value] && ts.options[value].homes === '0') ts.removeOption(value);
    });
    ts.on('change', function () {
      writeHidden(ts.items);
      search();
    });
    // Enter with a place highlighted chooses it (the library's own handling); Enter with none,
    // the words being no place, sends them as free text, the way the button does. Caught before
    // the library sees the key, since choosing clears the highlight.
    ts.wrapper.addEventListener(
      'keydown',
      function (event) {
        if (event.key !== 'Enter' || (ts.isOpen && ts.activeOption)) return;
        event.preventDefault();
        ts.close();
        if (form) form.requestSubmit();
        else search();
      },
      true,
    );
    if (form) {
      form.addEventListener('submit', function (event) {
        // The form inside a list is the set's own to reload. Any other form, with a list on the
        // page, sends its fields to that list instead of loading the page again; without one,
        // the page loads with the fields in its address.
        hidden.q.value = ts.control_input.value;
        if (box.closest('[data-list]') || !target()) {
          writeAddress(fields());
          return;
        }
        event.preventDefault();
        search();
      });
    }
  }

  function setupAll() {
    roots().forEach(function (root) {
      root.querySelectorAll('[data-place-search]').forEach(setup);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAll);
  else setupAll();
})();
