(function () {
  var items = [];
  var count = document.getElementById('count');
  var cartBtn = document.getElementById('cartBtn');
  var toast = document.getElementById('toast');
  var timer;

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }

  /* carrinho */
  document.querySelectorAll('.buy[data-item]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.card');
      var chip = card && card.querySelector('.amt.on');
      var name = btn.dataset.item + (chip ? ' – R$ ' + chip.dataset.v : '');
      items.push(name);
      count.textContent = items.length;
      cartBtn.classList.remove('bump');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('bump');
      say(name + ' adicionado ao carrinho');
    });
  });
  cartBtn.addEventListener('click', function () {
    say(items.length ? items.length + ' item(ns): ' + items.join(', ') : 'Seu carrinho está vazio');
  });

  /* abas */
  var TABS = ['inicio', 'recargas', 'streamings', 'conta', 'suporte'];
  var panels = document.querySelectorAll('[data-tabs]');
  var navLinks = document.querySelectorAll('nav a');

  function showTab(name, push) {
    if (TABS.indexOf(name) < 0) name = 'inicio';
    document.body.dataset.tab = name;
    panels.forEach(function (el) {
      el.hidden = el.dataset.tabs.split(' ').indexOf(name) < 0;
    });
    navLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + name;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (push) history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    if (a.hasAttribute('data-soon')) { e.preventDefault(); say('Em breve!'); return; }
    var name = a.getAttribute('href').slice(1);
    if (TABS.indexOf(name) >= 0) { e.preventDefault(); showTab(name, true); }
  });

  window.addEventListener('hashchange', function () {
    showTab(location.hash.slice(1), false);
  });

  document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    say('O login ainda não está ativo.');
  });

  showTab(location.hash.slice(1), false);
})();

/* valores da recarga, efeito de entrada e barra ao rolar */
(function () {
  document.querySelectorAll('.amts').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('.amt');
      if (!b) return;
      g.querySelectorAll('.amt').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
  });

  var header = document.querySelector('header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var els = document.querySelectorAll('.card, .step, .panel');
  els.forEach(function (el, i) { el.classList.add('reveal'); el.style.setProperty('--d', (i % 6) * 60 + 'ms'); });
  if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  els.forEach(function (el) { io.observe(el); });
})();
