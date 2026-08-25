/* ============================================================
   AutoSave — generic DOM form auto-save/restore for ED Suite
   modules that don't already have their own state-object +
   localStorage layer (ICU, ECG calculators, Airway calculators).

   Captures: input/select/textarea values (by id) + chip .on
   states (by data-group + text). Debounced save on input/change/
   chip-click. Restore dispatches real 'input'/'change' events so
   each module's own inline oninput="..." handlers recompute
   everything exactly as if the user had typed it — no need to
   know or call each module's calc functions by name.

   Usage:
     const as = AutoSave.attach('icu_admission_autosave_v1', {
       extra: () => ({ customLabs, selectedAbx: [...selectedAbx] }),
       beforeRestore: (data) => { if (data.extra) { ...apply... } },
       afterRestore: (data) => { ...re-render dependent UI... }
     });
     as.restore();   // call once after initial buildSections()/render()
     as.clear();     // call from the module's "reset form" action
   ============================================================ */
(function (global) {
  'use strict';

  // Minimal CSS.escape polyfill (Safari <10.1, older Android WebViews)
  if (!global.CSS) global.CSS = {};
  if (typeof global.CSS.escape !== 'function') {
    global.CSS.escape = function (value) {
      return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function (ch) {
        return '\\' + ch;
      });
    };
  }

  function attach(key, opts) {
    opts = opts || {};
    var timer = null;

    function snapshot() {
      var data = { fields: {}, chips: [] };
      document.querySelectorAll('input[id], textarea[id], select[id]').forEach(function (el) {
        data.fields[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
      });
      document.querySelectorAll('.chip.on[data-group]').forEach(function (c) {
        data.chips.push({ group: c.getAttribute('data-group'), val: c.textContent });
      });
      if (typeof opts.extra === 'function') {
        try { data.extra = opts.extra(); } catch (e) {}
      }
      data.savedAt = new Date().toISOString();
      return data;
    }

    function save() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        try { localStorage.setItem(key, JSON.stringify(snapshot())); } catch (e) {}
      }, 600);
    }

    function restore() {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return false;
        var data = JSON.parse(raw);

        if (typeof opts.beforeRestore === 'function') {
          try { opts.beforeRestore(data); } catch (e) {}
        }

        Object.keys(data.fields || {}).forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = data.fields[id];
          else el.value = data.fields[id];
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) {}
        });

        (data.chips || []).forEach(function (ch) {
          document.querySelectorAll('.chip[data-group]').forEach(function (c) {
            if (c.getAttribute('data-group') === ch.group && c.textContent === ch.val) {
              c.classList.add('on');
              if (c.classList.contains('crit-candidate')) c.classList.add('crit');
              c.setAttribute('aria-pressed', 'true');
            }
          });
        });

        if (typeof opts.afterRestore === 'function') {
          try { opts.afterRestore(data); } catch (e) {}
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    function clear() {
      try { localStorage.removeItem(key); } catch (e) {}
    }

    document.addEventListener('input', save);
    document.addEventListener('change', save);
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('chip')) save();
    });

    return { save: save, restore: restore, clear: clear, snapshot: snapshot };
  }

  global.AutoSave = { attach: attach };
})(window);
