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

  document.querySelectorAll('.buy').forEach(function (btn) {
    btn.addEventListener('click', function () {
      items.push(btn.dataset.item);
      count.textContent = items.length;
      cartBtn.classList.remove('bump');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('bump');
      say(btn.dataset.item + ' adicionado ao carrinho');
    });
  });

  cartBtn.addEventListener('click', function () {
    say(items.length ? items.length + ' item(ns): ' + items.join(', ') : 'Seu carrinho está vazio');
  });
})();

// destaca o item do menu da seção visível
(function () {
  var links = document.querySelectorAll('nav a');
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  function mark(id) {
    if (!map[id]) return;
    links.forEach(function (a) { a.classList.remove('on'); });
    map[id].classList.add('on');
  }
  links.forEach(function (a) {
    a.addEventListener('click', function () { mark(a.getAttribute('href').slice(1)); });
  });
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) mark(e.target.id); });
  }, { rootMargin: '-40% 0px -50% 0px' });
  ['inicio', 'recargas', 'streamings', 'suporte'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) io.observe(el);
  });
})();
