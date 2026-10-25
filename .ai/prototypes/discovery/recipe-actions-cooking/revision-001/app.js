// Local handlers only — no network. Toggles the desktop/mobile preview, the
// favourite state, simple toasts for share/print, and a simplified cooking-mode
// overlay (4 steps). Reset returns to the start.
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  var toast = document.getElementById('toast');
  var toastTimer = null;

  function flash(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 3500);
  }

  function setView(mobile) {
    stage.classList.toggle('is-mobile', mobile);
    stage.classList.toggle('is-desktop', !mobile);
    document.getElementById('view-mobile').setAttribute('aria-pressed', String(mobile));
    document.getElementById('view-desktop').setAttribute('aria-pressed', String(!mobile));
  }
  document.getElementById('view-desktop').addEventListener('click', function () { setView(false); });
  document.getElementById('view-mobile').addEventListener('click', function () { setView(true); });

  var fav = document.getElementById('fav');
  var favLabel = document.getElementById('fav-label');
  fav.addEventListener('click', function () {
    var on = fav.classList.toggle('on');
    fav.setAttribute('aria-pressed', String(on));
    favLabel.textContent = on ? 'W ulubionych · usuń' : 'Dodaj do ulubionych';
    if (on) flash('Dodano do ulubionych.');
  });

  document.getElementById('share').addEventListener('click', function () {
    flash('Symulacja: otwiera się okno udostępniania / kopiuje link.');
  });
  document.getElementById('print').addEventListener('click', function () {
    flash('Symulacja: otwiera się okno drukowania przeglądarki.');
  });

  // Cooking mode overlay
  var STEPS = [
    'Roztopić łyżkę masła w garnku.',
    'Obrać cebulę i pokroić, podsmażać aż się zeszkli.',
    'Wlać bulion, dodać buraczki i ziemniaki, gotować do miękkości.',
    'Dodać śmietankę i sok z cytryny, doprawić do smaku.',
  ];
  var overlay = document.getElementById('cook-overlay');
  var coStep = document.getElementById('co-step');
  var coText = document.getElementById('co-text');
  var coPrev = document.getElementById('co-prev');
  var coNext = document.getElementById('co-next');
  var i = 0;

  function render() {
    coStep.textContent = 'Krok ' + (i + 1) + ' z ' + STEPS.length;
    coText.textContent = STEPS[i];
    coPrev.disabled = i === 0;
    coPrev.style.opacity = i === 0 ? '0.5' : '1';
    coNext.textContent = i === STEPS.length - 1 ? 'Gotowe ✓' : 'Dalej →';
  }
  function openCook() { i = 0; render(); overlay.hidden = false; coNext.focus(); }
  function closeCook() { overlay.hidden = true; document.getElementById('cook').focus(); }

  document.getElementById('cook').addEventListener('click', openCook);
  document.getElementById('cook-close').addEventListener('click', closeCook);
  coPrev.addEventListener('click', function () { if (i > 0) { i--; render(); } });
  coNext.addEventListener('click', function () {
    if (i === STEPS.length - 1) { closeCook(); return; }
    i++; render();
  });

  document.getElementById('reset').addEventListener('click', function () {
    setView(false);
    fav.classList.remove('on');
    fav.setAttribute('aria-pressed', 'false');
    favLabel.textContent = 'Dodaj do ulubionych';
    overlay.hidden = true;
    flash('Prototyp zresetowany.');
  });

  setView(false);
})();
