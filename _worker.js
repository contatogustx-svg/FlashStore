// Flash Store – backend único para o Cloudflare Pages (upload pelo painel).
// Procure por "TODO" para ver o que falta preencher (parte do gateway).

/* ================= CATÁLOGO (preços no servidor) ================= */
// Catálogo e preços ficam NO SERVIDOR. O valor do site nunca é confiável.
// Os ids precisam ser iguais aos data-id dos botões "Comprar" do index.html.
const STREAMINGS = {
  netflix_tela:  { name: 'Netflix Premium 4K – Tela privada mensal', cents: 988 },
  netflix_conta: { name: 'Netflix Premium 4K Full – Conta completa', cents: 3500 },
  disney_tela:   { name: 'Disney Premium – Tela privada mensal',     cents: 879 },
  disney_conta:  { name: 'Disney+ Premium – Conta completa',         cents: 3100 },
  prime_sem:     { name: 'Prime Vídeo sem anúncios – Tela privada',  cents: 800 },
  prime_com:     { name: 'Prime Vídeo com anúncios – Tela privada mensal', cents: 468 },
  hbo_tela:      { name: 'HBO Max Platinum – Tela privada mensal',   cents: 668 },
  hbo_conta:     { name: 'HBO Max Platinum 4K – Conta completa',     cents: 1690 },
  spotify:       { name: 'Spotify Premium',                          cents: 1690 },
  dazn:          { name: 'Dazze',                                    cents: 1990 },
  paramount:     { name: 'Paramount Plus',                           cents: 2790 },
};
const RECHARGES = { vivo: 'Recarga Vivo', claro: 'Recarga Claro', tim: 'Recarga TIM', oi: 'Recarga Oi' };
const RECHARGE_VALUES = [15, 20, 30, 50]; // valores aceitos (R$)

function buildOrder(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) throw new Error('Carrinho inválido.');
  const lines = [];
  let totalCents = 0;
  for (const it of items) {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error('Quantidade inválida.');
    let name, cents;
    if (Object.hasOwn(STREAMINGS, it.id)) {
      ({ name, cents } = STREAMINGS[it.id]);
    } else if (Object.hasOwn(RECHARGES, it.id)) {
      const v = Number(it.value);
      if (!RECHARGE_VALUES.includes(v)) throw new Error('Valor de recarga inválido.');
      name = `${RECHARGES[it.id]} – R$ ${v}`; cents = v * 100;
    } else {
      throw new Error('Produto inválido.');
    }
    lines.push({ id: it.id, name, qty, cents });
    totalCents += cents * qty;
  }
  return { lines, totalCents };
}

/* ================= GATEWAY (preencher) ================= */
// Adaptador do gateway de pagamento. Preencha as 2 funções conforme o gateway escolhido.
// Segredos (token, chave do webhook) ficam nas variáveis do Cloudflare, nunca no código.

/**
 * Cria uma cobrança Pix.
 * Deve retornar: { gatewayId, pixCode, qrImage?, expiresAt? }
 *  - pixCode: texto "copia e cola"
 *  - qrImage: (opcional) imagem do QR em base64 ou data URL; se faltar, o site desenha o QR do pixCode
 */
async function createPixCharge(env, { orderId, amountCents, customer, description }) {
  if (!env.GATEWAY_TOKEN) {
    const e = new Error('Pagamento ainda não configurado.'); e.status = 503; throw e;
  }
  // TODO: chamar a API do gateway com fetch(), usando env.GATEWAY_TOKEN.
  // Use orderId como referência externa para casar com o webhook depois.
  const e = new Error('Gateway não implementado.'); e.status = 501; throw e;
}

/**
 * Valida e interpreta o webhook do gateway.
 * Deve retornar: { orderId, status } com status em 'paid' | 'expired' | 'canceled' | 'pending'
 * ou lançar erro se a assinatura/segredo for inválido.
 */
async function parseWebhook(env, request) {
  // TODO: conferir assinatura/segredo (env.WEBHOOK_SECRET) e mapear o payload do gateway.
  const e = new Error('Webhook não implementado.'); e.status = 501; throw e;
}

/* ================= ROTAS ================= */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function handleCheckout({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Requisição inválida.' }, 400);

    const name = String(body.customer?.name || '').trim();
    const phone = String(body.customer?.phone || '').replace(/\D/g, '');
    const note = String(body.customer?.note || '').trim().slice(0, 120);
    if (name.length < 2 || name.length > 80) return json({ error: 'Informe seu nome.' }, 400);
    if (phone.length < 10 || phone.length > 13) return json({ error: 'Informe um WhatsApp válido com DDD.' }, 400);

    const { lines, totalCents } = buildOrder(body.items); // total calculado no servidor
    const orderId = 'GX' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

    const charge = await createPixCharge(env, {
      orderId,
      amountCents: totalCents,
      customer: { name, phone, note },
      description: `Pedido ${orderId} – Flash Store`,
    });

    if (env.ORDERS) {
      await env.ORDERS.put(
        orderId,
        JSON.stringify({ status: 'pending', totalCents, lines, customer: { name, phone, note }, gatewayId: charge.gatewayId, createdAt: Date.now() }),
        { expirationTtl: 60 * 60 * 24 * 3 }
      );
    }
    return json({ orderId, pixCode: charge.pixCode, qrImage: charge.qrImage || null, expiresAt: charge.expiresAt || null });
  } catch (err) {
    const status = err.status || 400;
    return json({ error: status >= 500 ? err.message || 'Erro ao gerar o Pix.' : err.message }, status);
  }
}


async function handleStatus({ request, env }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^GX[A-Z0-9]{10}$/.test(id) || !env.ORDERS) return json({ status: 'unknown' }, 404);
  const raw = await env.ORDERS.get(id);
  if (!raw) return json({ status: 'unknown' }, 404);
  return json({ status: JSON.parse(raw).status }); // só o status, nunca dados do cliente
}


async function handleWebhook({ request, env }) {
  try {
    const { orderId, status } = await parseWebhook(env, request); // valida assinatura do gateway
    if (!env.ORDERS || !/^GX[A-Z0-9]{10}$/.test(orderId)) return new Response('ok');
    const raw = await env.ORDERS.get(orderId);
    if (!raw) return new Response('ok');
    const order = JSON.parse(raw);
    if (order.status !== 'paid') {            // idempotente: não reprocessa pedido já pago
      order.status = status;
      if (status === 'paid') order.paidAt = Date.now();
      await env.ORDERS.put(orderId, JSON.stringify(order), { expirationTtl: 60 * 60 * 24 * 30 });
      // TODO (opcional): avisar você (e-mail/WhatsApp/Telegram) que o pedido foi pago.
    }
    return new Response('ok');
  } catch (err) {
    return new Response('forbidden', { status: err.status === 501 ? 501 : 403 });
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/checkout' && request.method === 'POST') return handleCheckout({ request, env });
    if (pathname === '/api/status' && request.method === 'GET') return handleStatus({ request, env });
    if (pathname === '/api/webhook' && request.method === 'POST') return handleWebhook({ request, env });
    if (pathname.startsWith('/api/')) return json({ error: 'Não encontrado.' }, 404);
    return env.ASSETS.fetch(request); // site estático
  },
};
