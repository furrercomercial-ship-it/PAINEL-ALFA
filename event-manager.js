/* Alfa Informática — Event Manager central (AlfaEvents).
   Ponto único de disparo de eventos de e-commerce. Qualquer integração ativa
   (GA4, Meta Pixel, TikTok Pixel...) reaproveita os MESMOS eventos daqui —
   nenhuma lógica duplicada por plataforma. Eventos sem gancho real no site
   ainda ficam registrados (aparecem no painel), só nunca disparam.
   Carregar DEPOIS de consent.js e ANTES de script-engine.js. */
window.AlfaEvents = (function () {
  var REGISTRY = {
    page_view:          { label: 'Visualização de página',              implementado: true },
    view_item:          { label: 'Visualização de produto',             implementado: true },
    pesquisa:           { label: 'Pesquisa',                            implementado: false },
    add_to_cart:        { label: 'Adição ao carrinho',                  implementado: true },
    remove_from_cart:   { label: 'Remoção do carrinho',                 implementado: true },
    begin_checkout:     { label: 'Início do checkout',                  implementado: true },
    add_payment_info:   { label: 'Adição de informações de pagamento',  implementado: true },
    add_shipping_info:  { label: 'Cálculo de frete',                    implementado: true },
    cupom_usado:        { label: 'Uso de cupom',                        implementado: true },
    clique_banner:      { label: 'Clique em banner',                    implementado: false },
    clique_whatsapp:    { label: 'Clique em botão de WhatsApp',         implementado: true },
    sign_up:            { label: 'Cadastro realizado',                  implementado: true },
    login:              { label: 'Login realizado',                     implementado: true },
    purchase:           { label: 'Compra concluída',                    implementado: true },
    wishlist:           { label: 'Lista de desejos',                    implementado: false },
    comparacao_produtos:{ label: 'Comparação de produtos',              implementado: false },
  };

  var SENSITIVE_KEYS = ['password', 'senha', 'cpf', 'card', 'cartao', 'cvv', 'email', 'phone', 'telefone'];

  // Cada integração pode desligar eventos individuais (configurado no painel,
  // ver script-engine.js que popula window.__alfaEventConfig). Sem config
  // explícita pro evento, o padrão é permitido.
  function eventAllowed(plataforma, nome) {
    var cfg = window.__alfaEventConfig && window.__alfaEventConfig[plataforma];
    if (!cfg || cfg[nome] === undefined) return true;
    return !!cfg[nome];
  }

  function sanitize(payload) {
    if (!payload) return {};
    var clean = Object.assign({}, payload);
    SENSITIVE_KEYS.forEach(function (k) { delete clean[k]; });
    return clean;
  }

  function ga4Items(payload) {
    if (!payload || !payload.items) return undefined;
    return payload.items.map(function (i) {
      return { item_id: i.id, item_name: i.name, item_category: i.category, price: i.price, quantity: i.qty };
    });
  }

  var GTAG_MAP = {
    page_view: 'page_view', view_item: 'view_item', add_to_cart: 'add_to_cart',
    remove_from_cart: 'remove_from_cart', begin_checkout: 'begin_checkout',
    add_payment_info: 'add_payment_info', add_shipping_info: 'add_shipping_info',
    purchase: 'purchase', sign_up: 'sign_up', login: 'login',
    cupom_usado: 'select_promotion', clique_whatsapp: 'contact',
  };
  function fireGtag(name, payload) {
    if (typeof window.gtag !== 'function') return;
    var gaName = GTAG_MAP[name];
    if (!gaName || !eventAllowed('ga4', name)) return;
    var params = { currency: 'BRL' };
    if (payload.value != null) params.value = payload.value;
    if (payload.coupon) params.coupon = payload.coupon;
    if (payload.shipping_tier) params.shipping_tier = payload.shipping_tier;
    if (payload.method) params.method = payload.method;
    if (payload.order_id) params.transaction_id = payload.order_id;
    var items = ga4Items(payload);
    if (items) params.items = items;
    window.gtag('event', gaName, params);

    if (name === 'purchase' && window.__alfaGoogleAdsConversion) {
      window.gtag('event', 'conversion', {
        send_to: window.__alfaGoogleAdsConversion.sendTo,
        value: payload.value, currency: 'BRL', transaction_id: payload.order_id,
      });
    }
  }

  var FBQ_MAP = {
    page_view: 'PageView', view_item: 'ViewContent', add_to_cart: 'AddToCart',
    begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase', sign_up: 'CompleteRegistration', login: 'Login',
  };
  function fireFbq(name, payload) {
    if (typeof window.fbq !== 'function' || !eventAllowed('meta_pixel', name)) return;
    var fbName = FBQ_MAP[name];
    if (!fbName) { window.fbq('trackCustom', name, payload); return; }
    var params = {};
    if (payload.value != null) { params.value = payload.value; params.currency = 'BRL'; }
    if (payload.items) { params.contents = payload.items.map(function (i) { return { id: i.id, quantity: i.qty }; }); params.content_type = 'product'; }
    window.fbq('track', fbName, params);
  }

  var TTQ_MAP = {
    page_view: 'Browse', view_item: 'ViewContent', add_to_cart: 'AddToCart',
    begin_checkout: 'InitiateCheckout', purchase: 'CompletePayment', sign_up: 'CompleteRegistration',
  };
  function fireTtq(name, payload) {
    if (typeof window.ttq === 'undefined' || typeof window.ttq.track !== 'function' || !eventAllowed('tiktok_pixel', name)) return;
    var ttName = TTQ_MAP[name];
    if (!ttName) return;
    var params = {};
    if (payload.value != null) { params.value = payload.value; params.currency = 'BRL'; }
    window.ttq.track(ttName, params);
  }

  function track(name, payload) {
    if (!REGISTRY[name]) { console.warn('[AlfaEvents] evento não registrado:', name); return; }
    if (!REGISTRY[name].implementado) return; // "disponível — aguardando implementação"
    var clean = sanitize(payload);
    try { fireGtag(name, clean); } catch (e) { console.error('[AlfaEvents] gtag', e); }
    try { fireFbq(name, clean); } catch (e) { console.error('[AlfaEvents] fbq', e); }
    try { fireTtq(name, clean); } catch (e) { console.error('[AlfaEvents] ttq', e); }
    document.dispatchEvent(new CustomEvent('alfa:event', { detail: { name: name, payload: clean } }));
  }

  // Clique em qualquer link de WhatsApp (header, rodapé, botão de produto,
  // mensagem do checkout etc.) — delegado num único listener, sem precisar
  // instrumentar cada botão espalhado pelo site.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (a) track('clique_whatsapp', { method: 'whatsapp' });
  });

  return { track: track, registry: REGISTRY };
})();
