/* Alfa Informática — Shell do Painel Admin (sidebar, guarda de sessão, permissões, chat FAQ)
   Toda página admin-*.html (exceto admin-login.html) deve:
     <div id="admin-sidebar-mount"></div>
     <script src="...supabase-js..."></script>
     <script src="supabase-client.js"></script>
     <script src="admin-shell.js"></script>
   E chamar AdminShell.init('produtos') no próprio script da página, dentro de
   um .then — AdminShell.init() retorna uma Promise que resolve quando o
   usuário já foi validado como staff e as permissões carregadas. */
window.AdminShell = (function () {
  const ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    produtos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
    categorias: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>',
    pedidos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2 7 6 17 6 18 2"/><rect x="4" y="6" width="16" height="14"/><path d="M9 10a3 3 0 006 0"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    avaliacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15 8.5 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 8.5"/></svg>',
    equipe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="3"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    identidade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    cores: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.15-.75-.4-1.02-.24-.26-.4-.6-.4-.98 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.4-4.5-8-10-8z"/></svg>',
    header: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="11" width="18" height="9" rx="1"/></svg>',
    hero: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 13l5-5 4 4 5-6 4 5"/></svg>',
    banners: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="1"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    popups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="5" width="16" height="12" rx="2"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>',
    homepage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7"/><path d="M9 22V12h6v10"/></svg>',
    seo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    scripts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    textos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    paginas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>',
    blocos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    cupons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.17L4 3a1 1 0 0 0-1 1l.17 5.59a2 2 0 0 0 .66 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    lucro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    despesas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 8h20"/><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 16h4"/></svg>',
  };

  const NAV = [
    { key: 'dashboard',  label: 'Dashboard',  href: 'admin-dashboard.html',  perm: null, group: 'Visão Geral', icon: ICONS.dashboard },

    { key: 'produtos',   label: 'Produtos',   href: 'admin-produtos.html',   perm: 'produtos.editar', group: 'Catálogo', icon: ICONS.produtos },
    { key: 'categorias', label: 'Categorias', href: 'admin-categorias.html', perm: 'categorias.editar', group: 'Catálogo', icon: ICONS.categorias },

    { key: 'pedidos',    label: 'Pedidos',    href: 'admin-pedidos.html',    perm: 'pedidos.visualizar', group: 'Vendas', icon: ICONS.pedidos },
    { key: 'clientes',   label: 'Clientes',   href: 'admin-clientes.html',   perm: 'clientes.visualizar', group: 'Vendas', icon: ICONS.clientes },
    { key: 'cupons',     label: 'Cupons',     href: 'admin-cupons.html',     perm: 'precos.editar', group: 'Vendas', icon: ICONS.cupons },

    { key: 'lucro',      label: 'Lucro',      href: 'admin-lucro.html',      perm: 'faturamento.visualizar', group: 'Financeiro', icon: ICONS.lucro },
    { key: 'despesas',   label: 'Despesas',   href: 'admin-despesas.html',   perm: 'faturamento.visualizar', group: 'Financeiro', icon: ICONS.despesas },

    { key: 'avaliacoes', label: 'Avaliações', href: 'admin-avaliacoes.html', perm: 'avaliacoes.moderar', group: 'Engajamento', icon: ICONS.avaliacoes },

    { key: 'aparencia-identidade', label: 'Identidade Visual', href: 'admin-aparencia-identidade.html', perm: 'configuracoes.editar', group: 'Aparência', icon: ICONS.identidade },
    { key: 'aparencia-cores',      label: 'Design System',      href: 'admin-aparencia-cores.html',      perm: 'design_system.editar', group: 'Aparência', icon: ICONS.cores },
    { key: 'aparencia-textos',     label: 'Textos',             href: 'admin-aparencia-textos.html',     perm: 'textos.editar', group: 'Aparência', icon: ICONS.textos },
    { key: 'aparencia-header',     label: 'Header',             href: 'admin-aparencia-header.html',     perm: 'configuracoes.editar', group: 'Aparência', icon: ICONS.header },
    { key: 'aparencia-hero',       label: 'Hero / Banner',      href: 'admin-aparencia-hero.html',       perm: 'banners.editar', group: 'Aparência', icon: ICONS.hero },
    { key: 'aparencia-banners',    label: 'Banners',            href: 'admin-aparencia-banners.html',    perm: 'banners.editar', group: 'Aparência', icon: ICONS.banners },
    { key: 'aparencia-popups',     label: 'Popups',              href: 'admin-aparencia-popups.html',     perm: 'banners.editar', group: 'Aparência', icon: ICONS.popups },
    { key: 'aparencia-homepage',   label: 'Homepage',            href: 'admin-aparencia-homepage.html',   perm: 'banners.editar', group: 'Aparência', icon: ICONS.homepage },
    { key: 'aparencia-blocos',     label: 'Blocos das Páginas',  href: 'admin-aparencia-blocos.html',     perm: 'blocos.editar', group: 'Aparência', icon: ICONS.blocos },
    { key: 'aparencia-paginas',    label: 'Páginas',             href: 'admin-aparencia-paginas.html',    perm: 'paginas.editar', group: 'Aparência', icon: ICONS.paginas },
    { key: 'aparencia-seo',        label: 'SEO',                 href: 'admin-aparencia-seo.html',        perm: 'configuracoes.editar', group: 'Aparência', icon: ICONS.seo },
    { key: 'aparencia-scripts',    label: 'Integrações e Scripts', href: 'admin-aparencia-scripts.html',  perm: 'integracoes.visualizar', group: 'Aparência', icon: ICONS.scripts },

    { key: 'equipe',     label: 'Equipe',     href: 'admin-equipe.html',     perm: 'equipe.gerenciar', group: 'Sistema', icon: ICONS.equipe },
  ];

  const FAQ = [
    { q: ['mudar cor do site', 'design system', 'tipografia', 'cor do preço', 'cor do botão'],
      a: 'Vá em <b>Aparência → Design System</b>. Lá dá pra mudar cores de preço/PIX/parcelamento/botões separadamente, tipografia e estilo de botão — sempre com "Salvar rascunho" antes de "Publicar", e um preview ao vivo do site.' },
    { q: ['mudar texto do botão', 'trocar texto', 'editar texto do site'],
      a: 'Vá em <b>Aparência → Textos</b> — lista os textos de botões/rótulos que já estão conectados ao site (mais vão sendo adicionados aos poucos).' },
    { q: ['reordenar seção', 'mover bloco', 'esconder seção', 'arrastar bloco'],
      a: 'Vá em <b>Aparência → Blocos das Páginas</b> — arraste pra reordenar, use o olho pra mostrar/ocultar, e o cadeado pra travar a posição. Funciona em Produto, Categoria, Carrinho, Checkout e Minha Conta.' },
    { q: ['criar página', 'nova página', 'política de privacidade', 'termos de uso', 'página de contato'],
      a: 'Vá em <b>Aparência → Páginas</b>. As páginas institucionais (política, termos, garantia etc.), contato, suporte e outras já existem prontas pra você editar — lembre de marcar "Publicada" quando terminar.' },
    { q: ['adicionar produto', 'criar produto', 'novo produto', 'cadastrar produto'],
      a: 'Vá em <b>Produtos</b> no menu lateral e clique em <b>Novo Produto</b>. Preencha nome, categoria, preço e estoque — os outros campos são opcionais.' },
    { q: ['alterar banner', 'editar banner', 'trocar banner', 'banner'],
      a: 'Vá em <b>Aparência → Banners</b> (ou <b>Hero / Banner</b> pro carrossel do topo) e clique em <b>Novo</b> — dá pra subir a imagem, definir link e ordem de exibição.' },
    { q: ['ver lucro', 'meu lucro', 'quanto lucrei', 'margem de lucro', 'lucro líquido'],
      a: 'Vá em <b>Lucro</b> no menu lateral. Ele calcula receita, custo dos produtos vendidos e despesas automaticamente — só depende de você ter preenchido o <b>Preço de Custo</b> em cada produto e cadastrado suas despesas em <b>Despesas</b>.' },
    { q: ['cadastrar despesa', 'nova despesa', 'custo fixo', 'aluguel', 'gastos da loja'],
      a: 'Vá em <b>Despesas</b> no menu lateral e clique em <b>Nova Despesa</b>. Marque "recorrente" pra custos que se repetem todo mês (aluguel, salários, assinaturas) — eles entram automaticamente no cálculo de lucro de cada mês.' },
    { q: ['google analytics', 'meta pixel', 'facebook pixel', 'tiktok pixel', 'google tag manager', 'instalar script', 'cookie', 'consentimento'],
      a: 'Vá em <b>Aparência → Integrações e Scripts</b>. Pra Google Analytics, Meta Pixel, TikTok Pixel e outras ferramentas conhecidas, basta colar o ID na aba <b>Integrações</b> — não precisa entender código. Pra qualquer outro script, use a aba <b>Scripts personalizados</b>.' },
    { q: ['criar cupom', 'novo cupom', 'cupom de desconto'],
      a: 'Vá em <b>Cupons</b> no menu lateral e clique em <b>Novo Cupom</b>. Defina o código, tipo de desconto (percentual ou valor fixo), pedido mínimo e validade — ele já passa a funcionar no checkout.' },
    { q: ['mudar cor', 'cores do site', 'personalizar site', 'trocar cor'],
      a: 'Vá em <b>Aparência → Cores</b> pra mudar a paleta com preview ao vivo, ou <b>Aparência → Identidade Visual</b> pra trocar logo e favicon.' },
    { q: ['criar categoria', 'nova categoria', 'adicionar categoria'],
      a: 'Vá em <b>Categorias</b>, clique em <b>Nova Categoria</b> (ou <b>Nova Subcategoria</b> dentro de uma categoria existente) e preencha nome e ordem de exibição.' },
    { q: ['colocar em promoção', 'produto em promoção', 'promoção', 'desconto'],
      a: 'Edite o produto em <b>Produtos</b> e preencha o campo <b>Preço Antigo</b> com um valor maior que o Preço atual — o desconto aparece automaticamente na loja.' },
    { q: ['aumentar estoque', 'estoque', 'reposição'],
      a: 'Edite o produto em <b>Produtos</b> e ajuste o campo <b>Estoque</b>. Produtos com estoque abaixo do mínimo aparecem no aviso no topo do painel.' },
    { q: ['status do pedido', 'alterar pedido', 'mudar status'],
      a: 'Vá em <b>Pedidos</b>, abra o pedido desejado e altere o status no seletor — a mudança é salva na hora.' },
    { q: ['bloquear cliente', 'cliente'],
      a: 'Vá em <b>Clientes</b>, abra o cliente e use o botão <b>Bloquear</b>.' },
    { q: ['aprovar avaliação', 'moderar avaliação', 'avaliação'],
      a: 'Vá em <b>Avaliações</b> — lá você aprova, rejeita ou exclui avaliações enviadas pelos clientes.' },
    { q: ['criar conta', 'novo funcionário', 'equipe', 'permissão', 'cargo'],
      a: 'Vá em <b>Equipe</b> (apenas Administradores) para criar contas de funcionários e definir o cargo de cada um.' },
  ];

  let _profile = null;
  let _permKeys = new Set();

  function can(key) { return !key || _permKeys.has(key); }

  async function guard() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) { location.href = 'admin-login.html'; return null; }

    const { data: profile, error } = await window.sb
      .from('profiles').select('id,full_name,role,is_blocked').eq('id', session.user.id).single();

    if (error || !profile || profile.role === 'cliente' || profile.is_blocked) {
      await window.sb.auth.signOut();
      location.href = 'admin-login.html?denied=1';
      return null;
    }

    profile.email = session.user.email;
    _profile = profile;

    const { data: perms } = await window.sb
      .from('role_permissions').select('permission_key').eq('role', profile.role).eq('allowed', true);
    _permKeys = new Set((perms || []).map(p => p.permission_key));

    return profile;
  }

  function renderSidebar(activeKey) {
    const mount = document.getElementById('admin-sidebar-mount');
    if (!mount) return;
    const items = NAV.filter(item => can(item.perm));
    const initials = (_profile.full_name || _profile.email || 'A').split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();

    // Agrupa mantendo a ordem de primeira aparição no NAV; grupos sem nenhum
    // item visível (por permissão) simplesmente não aparecem.
    const groups = [];
    items.forEach(it => {
      let g = groups.find(x => x.name === it.group);
      if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
      g.items.push(it);
    });

    mount.innerHTML = `
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-brand">
          <img src="logo-dark.png" alt="Alfa Informática">
          <span class="admin-brand-txt">PAINEL ADMIN</span>
        </div>
        <nav class="admin-nav">
          ${groups.map(g => `
            <div class="admin-nav-group-lbl">${g.name}</div>
            ${g.items.map(it => `<a class="admin-nav-item ${it.key === activeKey ? 'active' : ''}" href="${it.href}">${it.icon}${it.label}</a>`).join('')}
          `).join('')}
        </nav>
        <div class="admin-sidebar-foot">
          <div class="admin-avatar">${initials}</div>
          <div class="admin-who">
            <div class="admin-who-name">${_profile.full_name || _profile.email}</div>
            <div class="admin-who-role">${_profile.role}</div>
          </div>
          <button class="admin-logout-btn" id="adminLogoutBtn" title="Sair">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>`;

    document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
      await window.sb.auth.signOut();
      location.href = 'admin-login.html';
    });
  }

  async function renderInsightBar() {
    const el = document.getElementById('admin-insight-bar');
    if (!el) return;
    const insights = [];
    try {
      const { count: lowStock } = await window.sb.from('products').select('id', { count: 'exact', head: true }).lte('stock', 0);
      if (lowStock) insights.push(`<strong>${lowStock}</strong> produto${lowStock !== 1 ? 's' : ''} sem estoque`);
      if (can('avaliacoes.moderar')) {
        const { count: pending } = await window.sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        if (pending) insights.push(`<strong>${pending}</strong> avaliaç${pending !== 1 ? 'ões' : 'ão'} aguardando aprovação`);
      }
      if (can('pedidos.visualizar')) {
        const { count: pendingOrders } = await window.sb.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_pagamento');
        if (pendingOrders) insights.push(`<strong>${pendingOrders}</strong> pedido${pendingOrders !== 1 ? 's' : ''} aguardando pagamento`);
      }
    } catch (e) { /* silencioso — painel segue funcionando sem o aviso */ }

    if (!insights.length) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${insights.join(' &nbsp;•&nbsp; ')}</span>`;
  }

  function chatAnswer(text) {
    const q = text.toLowerCase();
    let best = null, bestScore = 0;
    FAQ.forEach(entry => {
      entry.q.forEach(phrase => {
        if (q.includes(phrase)) { const score = phrase.length; if (score > bestScore) { bestScore = score; best = entry; } }
      });
    });
    if (best) return best.a;
    const words = q.split(/\s+/).filter(w => w.length > 3);
    FAQ.forEach(entry => {
      entry.q.forEach(phrase => {
        const hit = words.filter(w => phrase.includes(w)).length;
        if (hit >= 2 && hit > bestScore) { bestScore = hit; best = entry; }
      });
    });
    return best ? best.a : 'Não tenho uma resposta pronta pra isso ainda. Tente perguntar sobre produtos, categorias, pedidos, clientes, avaliações ou equipe — ou use os atalhos abaixo.';
  }

  function mountChat() {
    if (document.getElementById('adminChatFab')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="chat-fab" id="adminChatFab" title="Assistente do painel">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <div class="chat-panel" id="adminChatPanel">
        <div class="chat-head"><div>Assistente do Painel<div class="chat-head-sub">Respostas rápidas — sem IA real ainda</div></div>
          <button class="modal-close" id="adminChatClose">✕</button>
        </div>
        <div class="chat-body" id="adminChatBody">
          <div class="chat-msg bot">Oi! Posso te ajudar a usar o painel. Pergunte algo como "como adiciono um produto?" ou escolha um atalho abaixo.</div>
        </div>
        <div class="chat-suggestions">
          <button class="chat-sugg-btn" data-q="Como adiciono um produto?">Como adiciono um produto?</button>
          <button class="chat-sugg-btn" data-q="Como coloco um produto em promoção?">Como coloco um produto em promoção?</button>
          <button class="chat-sugg-btn" data-q="Como crio uma categoria?">Como crio uma categoria?</button>
        </div>
        <div class="chat-input-row">
          <input type="text" id="adminChatInput" placeholder="Digite sua pergunta...">
          <button id="adminChatSend">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const panel = document.getElementById('adminChatPanel');
    const body = document.getElementById('adminChatBody');
    document.getElementById('adminChatFab').addEventListener('click', () => panel.classList.toggle('open'));
    document.getElementById('adminChatClose').addEventListener('click', () => panel.classList.remove('open'));

    function ask(text) {
      if (!text.trim()) return;
      body.insertAdjacentHTML('beforeend', `<div class="chat-msg user"></div>`);
      body.lastElementChild.textContent = text;
      body.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">${chatAnswer(text)}</div>`);
      body.scrollTop = body.scrollHeight;
    }
    document.getElementById('adminChatSend').addEventListener('click', () => {
      const inp = document.getElementById('adminChatInput');
      ask(inp.value); inp.value = '';
    });
    document.getElementById('adminChatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { ask(e.target.value); e.target.value = ''; }
    });
    document.querySelectorAll('.chat-sugg-btn').forEach(b => b.addEventListener('click', () => ask(b.dataset.q)));
  }

  function toast(msg, type) {
    let container = document.getElementById('adminToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'adminToastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 200);
    }, 3200);
  }

  async function init(activeKey) {
    const profile = await guard();
    if (!profile) return null;
    renderSidebar(activeKey);
    renderInsightBar();
    mountChat();
    return { profile, can };
  }

  return { init, can, toast, get profile() { return _profile; } };
})();
