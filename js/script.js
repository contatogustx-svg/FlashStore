(function () {
  var CFG = window.GUSTX || {};
  var cart = [];
  try { cart = JSON.parse(localStorage.getItem('gustx-cart') || '[]'); } catch (e) { cart = []; }
  var count = document.getElementById('count');
  var cartBtn = document.getElementById('cartBtn');
  var toast = document.getElementById('toast');
  var drawer = document.getElementById('drawer');
  var overlay = document.getElementById('overlay');
  var timer;
  var curView = 'cart';
  var BRAND = {
    netflix: { c: '#e50914', t: 'N' }, disney: { c: '#2f6bff', t: 'D+' }, hbomax: { c: '#7b2cff', t: 'H' },
    spotify: { c: '#1ed760', t: 'S' }, dazn: { c: '#ff6a1a', t: 'D' }, paramount: { c: '#2a8bff', t: 'P+' },
    vivo: { c: '#6a2cb8', t: 'V' }, claro: { c: '#c4242e', t: 'C' }, tim: { c: '#24449a', t: 'T' }, oi: { c: '#22903a', t: 'oi' }
  };
  var $ = function (id) { return document.getElementById(id); };
  var brl = function (v) { return 'R$ ' + v.toFixed(2).replace('.', ','); };
  var total = function () { return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); };

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }

  function save() { try { localStorage.setItem('gustx-cart', JSON.stringify(cart)); } catch (e) {} }

  function render() {
    var n = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    count.textContent = n;
    var list = $('itemsList');
    list.innerHTML = '';
    cart.forEach(function (it, idx) {
      var br = BRAND[it.id] || { c: '#2c5fd0', t: (it.name || '?').charAt(0) };
      var parts = String(it.name).split(' – ');
      var li = document.createElement('li');
      li.className = 'item';
      var tile = document.createElement('span'); tile.className = 'tile'; tile.style.setProperty('--c', br.c); tile.textContent = br.t;
      var info = document.createElement('div'); info.className = 'info';
      var name = document.createElement('b'); name.textContent = parts[0];
      var kind = document.createElement('small');
      kind.textContent = it.value ? 'Recarga de ' + brl(it.price) : 'Assinatura mensal' + (it.qty > 1 ? ' · ' + brl(it.price) + ' cada' : '');
      info.append(name, kind);
      var pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = brl(it.price * it.qty);
      var q = document.createElement('div'); q.className = 'qty';
      var minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Diminuir quantidade');
      var num = document.createElement('span'); num.textContent = it.qty;
      var plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'Aumentar quantidade');
      var rm = document.createElement('button'); rm.type = 'button'; rm.className = 'rm'; rm.setAttribute('aria-label', 'Remover ' + parts[0]);
      rm.innerHTML = '<svg class="ic"><use href="#i-trash"/></svg>';
      minus.onclick = function () { it.qty = Math.max(1, it.qty - 1); save(); render(); };
      plus.onclick = function () { it.qty = Math.min(10, it.qty + 1); save(); render(); };
      rm.onclick = function () { cart.splice(idx, 1); save(); render(); };
      q.append(minus, num, plus);
      li.append(tile, info, pr, q, rm);
      list.appendChild(li);
    });
    drawer.toggleAttribute('data-empty', cart.length === 0);
    if (curView === 'cart') $('drawerSub').textContent = n === 0 ? 'Nenhum item' : n + (n === 1 ? ' item' : ' itens');
    $('emptyMsg').hidden = cart.length > 0;
    $('toCheckout').disabled = cart.length === 0;
    var t = brl(total());
    $('totalCart').textContent = t; $('totalForm').textContent = t; $('totalPix').textContent = t;
  }

  var SUBS = { form: 'Informe seus dados para receber o pedido', pix: 'Pague pelo app do seu banco', done: 'Tudo certo!' };
  var TITLES = { cart: 'Meu carrinho', form: 'Seus dados', pix: 'Pagamento via Pix', done: 'Pedido' };
  function view(name) {
    curView = name;
    $('viewCart').hidden = name !== 'cart'; $('footCart').hidden = name !== 'cart'; if (name !== 'pix') stopPolling();
    $('viewForm').hidden = name !== 'form'; $('viewPix').hidden = name !== 'pix'; $('viewDone').hidden = name !== 'done';
    $('drawerTitle').textContent = TITLES[name];
    var n = cart.reduce(function (s, i) { return s + i.qty; }, 0);
    $('drawerSub').textContent = name === 'cart' ? (n === 0 ? 'Nenhum item' : n + (n === 1 ? ' item' : ' itens')) : SUBS[name];
    var order = ['cart', 'form', 'pix', 'done'], at = order.indexOf(name);
    drawer.dataset.step = name;
    drawer.querySelectorAll('.stp li').forEach(function (li) {
      var k = order.indexOf(li.dataset.s);
      li.classList.toggle('on', k === at); li.classList.toggle('past', k < at);
    });
  }
  function openDrawer() {
    view('cart'); overlay.hidden = false; drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false'); document.body.classList.add('lock');
    $('drawerClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    overlay.hidden = true; document.body.classList.remove('lock');
  }
  overlay.addEventListener('click', closeDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  drawer.querySelectorAll('[data-close]').forEach(function (a) { a.addEventListener('click', closeDrawer); });
  drawer.querySelectorAll('[data-back]').forEach(function (b) { b.addEventListener('click', function () { view(b.dataset.back); }); });

  document.querySelectorAll('.buy[data-item]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.card');
      var chip = card && card.querySelector('.amt.on');
      var price = chip ? parseFloat(chip.dataset.v) : parseFloat(btn.dataset.price);
      var name = btn.dataset.item + (chip ? ' – R$ ' + chip.dataset.v : '');
      var found = cart.filter(function (i) { return i.name === name; })[0];
      if (found) found.qty += 1; else cart.push({ id: btn.dataset.id, value: chip ? price : null, name: name, price: price, qty: 1 });
      save(); render();
      cartBtn.classList.remove('bump'); void cartBtn.offsetWidth; cartBtn.classList.add('bump');
      openDrawer();
    });
  });
  cartBtn.addEventListener('click', openDrawer);
  $('toCheckout').addEventListener('click', function () { view('form'); $('fName').focus(); });

  /* ---------- Pix via gateway (backend no Cloudflare) ---------- */
  var API = (CFG.apiBase || '') + '/api';
  var pollTimer = null, currentOrder = null;

  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

  function setStatus(kind, txt) {
    var box = $('payStatus');
    box.className = 'status ' + kind;
    $('payStatusTxt').textContent = txt;
  }

  function startPolling(orderId) {
    stopPolling();
    var tries = 0;
    pollTimer = setInterval(function () {
      tries++;
      if (tries > 450) { stopPolling(); setStatus('bad', 'Tempo esgotado. Se já pagou, fale com o suporte.'); return; }
      fetch(API + '/status?id=' + encodeURIComponent(orderId))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.status === 'paid') {
            stopPolling(); cart = []; save(); render(); view('done');
          } else if (d.status === 'expired' || d.status === 'canceled') {
            stopPolling(); setStatus('bad', 'Este Pix expirou. Volte e gere um novo.');
          }
        })
        .catch(function () { /* tenta de novo no próximo ciclo */ });
    }, 4000);
  }

  function showPix(d) {
    currentOrder = d.orderId;
    $('pixCode').value = d.pixCode || '';
    var box = $('qrBox');
    box.innerHTML = '';
    if (d.qrImage) {
      var img = document.createElement('img');
      img.alt = 'QR Code Pix'; img.style.cssText = 'display:block;width:100%;height:auto';
      img.src = d.qrImage.indexOf('data:') === 0 ? d.qrImage : 'data:image/png;base64,' + d.qrImage;
      box.appendChild(img);
    } else if (d.pixCode && window.qrcode) {
      try { var qr = qrcode(0, 'M'); qr.addData(d.pixCode); qr.make(); box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
      catch (err) { box.textContent = 'Use o copia e cola abaixo.'; }
    }
    setStatus('wait', 'Aguardando pagamento…');
    view('pix');
    startPolling(d.orderId);
  }

  $('viewForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!cart.length) return;
    var err = $('formErr'), btn = $('genBtn');
    err.hidden = true;
    btn.disabled = true; btn.textContent = 'Gerando Pix…';
    var body = {
      items: cart.map(function (i) { return { id: i.id, qty: i.qty, value: i.value }; }),
      customer: { name: $('fName').value.trim(), phone: $('fPhone').value.trim(), note: $('fNote').value.trim() }
    };
    fetch(API + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.pixCode) throw new Error(res.d.error || 'Não foi possível gerar o Pix agora. Tente novamente em instantes.');
        showPix(res.d);
      })
      .catch(function (ex) {
        err.textContent = ex.message === 'Failed to fetch' ? 'Sem conexão com o servidor. Tente novamente.' : ex.message;
        err.hidden = false;
      })
      .then(function () { btn.disabled = false; btn.textContent = 'Gerar Pix'; });
  });

  $('doneBtn').addEventListener('click', function () { closeDrawer(); });

  $('copyPix').addEventListener('click', function () {
    var ta = $('pixCode');
    var done = function () { say('Código Pix copiado!'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); document.execCommand('copy'); done(); });
    } else { ta.select(); document.execCommand('copy'); done(); }
  });

  render();

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

/* carrossel de banners (troca sozinho) e botão do grupo */
(function () {
  var CFG = window.GUSTX || {};
  var g = document.getElementById('btnGrupo');
  if (g && CFG.grupo) { g.href = CFG.grupo; g.target = '_blank'; g.rel = 'noopener'; g.removeAttribute('data-soon'); }

  var car = document.getElementById('car');
  if (!car) return;
  var slides = [].slice.call(car.querySelectorAll('.slide'));
  var dotsBox = document.getElementById('carDots');
  var i = 0, timer = null, x0 = null;
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  slides.forEach(function (s, n) {
    var d = document.createElement('button');
    d.type = 'button'; d.setAttribute('aria-label', 'Ir para o banner ' + (n + 1));
    d.onclick = function () { go(n); play(); };
    dotsBox.appendChild(d);
  });
  var dots = [].slice.call(dotsBox.children);

  function go(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach(function (s, k) { s.classList.toggle('on', k === i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    var img = slides[i].querySelector('img'); if (img) img.loading = 'eager';
  }
  function stop() { clearInterval(timer); timer = null; }
  function play() { stop(); if (still || slides.length < 2) return; timer = setInterval(function () { go(i + 1); }, 5000); }

  car.querySelector('.prev').onclick = function () { go(i - 1); play(); };
  car.querySelector('.next').onclick = function () { go(i + 1); play(); };
  car.addEventListener('mouseenter', stop);
  car.addEventListener('mouseleave', play);
  car.addEventListener('focusin', stop);
  car.addEventListener('focusout', play);
  car.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; stop(); }, { passive: true });
  car.addEventListener('touchend', function (e) {
    if (x0 !== null) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); }
    x0 = null; play();
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });

  go(0); play();
})();
