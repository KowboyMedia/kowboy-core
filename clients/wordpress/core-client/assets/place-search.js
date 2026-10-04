// The place search box (includes/place-search.php, docs/search.md): a combo box over the places
// the page rendered as data, pills for the chosen ones, every change written to the address and
// sent to the list on the page, which reloads its cards (the set's list script listens for
// `core-list:params`). Typing without choosing searches the words as free text on submit, with
// the pills saying where (Default 134). Plain JavaScript, on the page and inside every shadow
// root the plugin opens; no build step.
(function () {
  'use strict';
  var GROUPS = { areas: 'Områden', municipalities: 'Kommuner', counties: 'Län' };

  /** Every root that may hold a box: the document and each open shadow root under it. */
  function roots() {
    var found = [document];
    document.querySelectorAll('core-view').forEach(function (host) {
      if (host.shadowRoot) found.push(host.shadowRoot);
    });
    return found;
  }

  /** Lower case without accents, so "skane" finds Skåne and "malm" finds Malmö. */
  function fold(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** A place matches when its label, or a word in it, begins with the typed text. */
  function matches(place, typed) {
    var label = fold(place.label);
    return (
      label.indexOf(typed) === 0 ||
      label.split(/[\s·,-]+/).some(function (word) {
        return word.indexOf(typed) === 0;
      })
    );
  }

  function setup(box) {
    if (box.dataset.ready) return;
    box.dataset.ready = '1';
    var places = JSON.parse(box.dataset.places || '[]');
    var input = box.querySelector('input[type="search"]');
    var list = box.querySelector('[role="listbox"]');
    var holder = box.querySelector('[data-pills]');
    var hidden = {
      areas: box.querySelector('input[name="areas"]'),
      lkf: box.querySelector('input[name="lkf"]'),
    };
    var form = box.closest('form');
    var shown = [];
    var active = -1;

    function kindOf(group) {
      return group === 'areas' ? 'areas' : 'lkf';
    }
    function pills() {
      return Array.prototype.map.call(holder.querySelectorAll('[data-pill-kind]'), function (pill) {
        return { kind: pill.dataset.pillKind, id: pill.dataset.pillId };
      });
    }
    function chosen(kind, id) {
      return pills().some(function (pill) {
        return pill.kind === kind && pill.id === id;
      });
    }
    function writeHidden() {
      var current = pills();
      Object.keys(hidden).forEach(function (kind) {
        hidden[kind].value = current
          .filter(function (pill) {
            return pill.kind === kind;
          })
          .map(function (pill) {
            return pill.id;
          })
          .join(',');
      });
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
      writeHidden();
      var values = fields();
      writeAddress(values);
      var drives = target();
      if (drives) drives.dispatchEvent(new CustomEvent('core-list:params', { detail: values }));
      else if (form) form.submit();
    }

    function addPill(place) {
      var kind = kindOf(place.group);
      if (chosen(kind, place.id)) return;
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'core-place-search__pill';
      pill.dataset.pillKind = kind;
      pill.dataset.pillId = place.id;
      pill.setAttribute('aria-label', 'Ta bort ' + place.label);
      pill.textContent = place.label;
      var cross = document.createElement('span');
      cross.setAttribute('aria-hidden', 'true');
      cross.textContent = ' ×';
      pill.appendChild(cross);
      holder.appendChild(pill);
    }
    holder.addEventListener('click', function (event) {
      var pill = event.target.closest('[data-pill-kind]');
      if (!pill) return;
      pill.remove();
      search();
      input.focus();
    });

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      active = -1;
    }
    function render() {
      var typed = fold(input.value.trim());
      shown = places.filter(function (place) {
        return !chosen(kindOf(place.group), place.id) && (typed === '' || matches(place, typed));
      });
      list.innerHTML = '';
      if (!shown.length) {
        close();
        return;
      }
      var group = '';
      shown.forEach(function (place, index) {
        if (place.group !== group) {
          group = place.group;
          var head = document.createElement('li');
          head.className = 'core-place-search__group';
          head.setAttribute('role', 'presentation');
          head.textContent = GROUPS[group] || group;
          list.appendChild(head);
        }
        var option = document.createElement('li');
        option.className = 'core-place-search__option' + (index === active ? ' is-active' : '');
        option.id = list.id + '-' + index;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', index === active ? 'true' : 'false');
        option.dataset.index = String(index);
        option.textContent = place.label;
        list.appendChild(option);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (active >= 0) {
        input.setAttribute('aria-activedescendant', list.id + '-' + active);
        var item = list.querySelector('.is-active');
        if (item && item.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
    function choose(place) {
      addPill(place);
      input.value = '';
      close();
      search();
    }
    function move(delta) {
      if (list.hidden) render();
      if (!shown.length) return;
      active = (active + delta + shown.length) % shown.length;
      render();
    }

    input.addEventListener('input', function () {
      active = -1;
      render();
    });
    input.addEventListener('focus', function () {
      render();
    });
    input.addEventListener('blur', function () {
      window.setTimeout(close, 150);
    });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === 'Escape') {
        close();
      } else if (event.key === 'Enter' && !list.hidden && active >= 0) {
        // A chosen suggestion; Enter with none chosen submits the form: the words as free text
        // (Default 134), which the submit handler below sends to the list on the page.
        event.preventDefault();
        choose(shown[active]);
      } else if (event.key === 'Backspace' && input.value === '') {
        var last = holder.querySelector('[data-pill-kind]:last-child');
        if (last) {
          last.remove();
          search();
        }
      }
    });
    list.addEventListener('mousedown', function (event) {
      event.preventDefault(); // the field keeps its focus, so the click below reaches the option
    });
    list.addEventListener('click', function (event) {
      var option = event.target.closest('[role="option"]');
      if (option) choose(shown[Number(option.dataset.index)]);
    });
    if (form) {
      form.addEventListener('submit', function (event) {
        writeHidden();
        // The form inside a list is the set's own to reload. Any other form, with a list on the
        // page, sends its fields to that list instead of loading the page again; without one,
        // the page loads with the fields in its address.
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
