/* Configurações públicas do site (nada secreto aqui!) */
window.GUSTX = {
  apiBase: '',               // vazio = mesmo domínio (Cloudflare Pages Functions em /api)
  whatsapp: '5568992423531', // WhatsApp com 55 + DDD + número
  grupo: '',                 // link do grupo do WhatsApp (ex.: https://chat.whatsapp.com/XXXX). Vazio = botão mostra "Em breve!"

  /* Firebase (Authentication + Realtime Database).
     Cole aqui o firebaseConfig do seu projeto: Console do Firebase > Configurações do projeto > Seus apps > App da Web.
     Estes valores são públicos por natureza; quem protege os dados são as Regras do banco. */
  firebase: {
    apiKey: 'AIzaSyDVy5g9EylAJM3wNuZNxF5X3nAoaQlqM2s',
    authDomain: 'flash-store-325c2.firebaseapp.com',
    databaseURL: 'https://flash-store-325c2-default-rtdb.firebaseio.com',
    projectId: 'flash-store-325c2',
    appId: '1:860963899437:web:72a8029fec79f02bb910a4'
  }
};
