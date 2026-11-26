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
      var li = document.createElement('li');
      li.className = 'item';
      var name = document.createElement('b'); name.textContent = it.name;
      var pr = document.createElement('span'); pr.className = 'pr'; pr.textContent = brl(it.price * it.qty);
      var q = document.createElement('div'); q.className = 'qty';
      var minus = document.createElement('button'); minus.textContent = '−'; minus.setAttribute('aria-label', 'Diminuir');
      var num = document.createElement('span'); num.textContent = it.qty;
      var plus = document.createElement('button'); plus.textContent = '+'; plus.setAttribute('aria-label', 'Aumentar');
      var rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = 'Remover';
      minus.onclick = function () { it.qty = Math.max(1, it.qty - 1); save(); render(); };
      plus.onclick = function () { it.qty += 1; save(); render(); };
      rm.onclick = function () { cart.splice(idx, 1); save(); render(); };
      q.append(minus, num, plus);
      li.append(name, pr, q, rm);
      list.appendChild(li);
    });
    $('emptyMsg').hidden = cart.length > 0;
    $('toCheckout').disabled = cart.length === 0;
    var t = brl(total());
    $('totalCart').textContent = t; $('totalForm').textContent = t; $('totalPix').textContent = t;
  }

  function view(name) {
    $('viewCart').hidden = name !== 'cart'; $('footCart').hidden = name !== 'cart'; if (name !== 'pix') stopPolling();
    $('viewForm').hidden = name !== 'form'; $('viewPix').hidden = name !== 'pix'; $('viewDone').hidden = name !== 'done';
    $('drawerTitle').textContent = name === 'cart' ? 'Meu carrinho' : name === 'done' ? 'Pedido' : 'Pagamento via Pix';
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
