// Small local event handlers — no network, no framework. Switches between the
// recipe screen and the print-preview screen, simulates the print action, and
// honestly represents out-of-scope destinations. Reset returns to the start.
(function () {
  'use strict';
  var recipe = document.getElementById('screen-recipe');
  var print = document.getElementById('screen-print');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function show(screen) {
    [recipe, print].forEach(function (s) {
      var active = s === screen;
      s.classList.toggle('is-hidden', !active);
      if (active) { s.removeAttribute('hidden'); } else { s.setAttribute('hidden', ''); }
    });
    window.scrollTo(0, 0);
    // Move focus to the newly shown screen's heading for keyboard/SR users.
    var h = screen.querySelector('h1');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }

  function flash(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 4000);
  }

  document.getElementById('open-print').addEventListener('click', function () {
    show(print);
  });
  document.getElementById('back-to-recipe').addEventListener('click', function () {
    show(recipe);
  });
  document.getElementById('do-print').addEventListener('click', function () {
    // In the real app (variant A) this is window.print() → the browser's native
    // print dialog. The prototype only simulates that boundary.
    flash('Symulacja: w aplikacji w tym miejscu otwiera się okno drukowania przeglądarki.');
  });
  document.getElementById('reset').addEventListener('click', function () {
    show(recipe);
    flash('Prototyp zresetowany.');
  });

  // Honestly represent destinations outside this prototype's scope.
  Array.prototype.forEach.call(document.querySelectorAll('[data-outofscope]'), function (el) {
    el.addEventListener('click', function () {
      flash('Poza zakresem prototypu: „' + (el.textContent || '').trim() + '”.');
    });
  });

  show(recipe);
})();
