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
