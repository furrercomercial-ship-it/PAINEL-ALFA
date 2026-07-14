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
    estoque: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 8v8a2 2 0 0 1-1 1.73l-6 3.46a2 2 0 0 1-2 0l-6-3.46A2 2 0 0 1 5 16.73V8"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22V12"/><path d="M8 4.5 16 9"/></svg>',
    notificacoes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    notasfiscais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="13" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><path d="M16 13v4a2 2 0 0 0 2 2"/></svg>',
  };

  const NAV = [
    { key: 'dashboard',  label: 'Dashboard',  href: 'admin-dashboard.html',  perm: null, group: 'Visão Geral', icon: ICONS.dashboard },

    { key: 'produtos',   label: 'Produtos',   href: 'admin-produtos.html',   perm: 'produtos.editar', group: 'Catálogo', icon: ICONS.produtos },
    { key: 'categorias', label: 'Categorias', href: 'admin-categorias.html', perm: 'categorias.editar', group: 'Catálogo', icon: ICONS.categorias },

    { key: 'estoque-dashboard', label: 'Visão Geral',      href: 'admin-estoque-dashboard.html', perm: 'estoque.visualizar', group: 'Estoque', icon: ICONS.estoque },
    { key: 'estoque-itens',     label: 'Itens em Estoque', href: 'admin-estoque.html',           perm: 'estoque.visualizar', group: 'Estoque', icon: ICONS.estoque },

    { key: 'pedidos',    label: 'Pedidos',    href: 'admin-pedidos.html',    perm: 'pedidos.visualizar', group: 'Vendas', icon: ICONS.pedidos },
    { key: 'notas-fiscais', label: 'Notas Fiscais', href: 'admin-notas-fiscais.html', perm: 'notas_fiscais.visualizar', group: 'Vendas', icon: ICONS.notasfiscais },
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

    { key: 'notificacoes', label: 'Notificações', href: 'admin-notificacoes.html', perm: 'notificacoes.visualizar', group: 'Sistema', icon: ICONS.notificacoes },
    { key: 'equipe',       label: 'Equipe',       href: 'admin-equipe.html',       perm: 'equipe.gerenciar',        group: 'Sistema', icon: ICONS.equipe },
  ];

  const NOTIF_CATS = [
    { key: 'todas', label: 'Todas' },
    { key: 'pedidos', label: 'Pedidos', color: 'var(--success)' },
    { key: 'estoque', label: 'Estoque', color: 'var(--warning)' },
    { key: 'clientes', label: 'Clientes', color: 'var(--primary)' },
    { key: 'financeiro', label: 'Financeiro', color: 'var(--violet, #8B5CF6)' },
    { key: 'sistema', label: 'Sistema', color: 'var(--danger)' },
  ];
  const NOTIF_ICON = {
    pedidos: ICONS.pedidos,
    estoque: ICONS.estoque,
    clientes: ICONS.clientes,
    financeiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    sistema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  const FAQ = [
    // ── PRODUTOS ──────────────────────────────────────────────────────────
    { topic: 'Produtos', q: ['adicionar produto', 'criar produto', 'novo produto', 'cadastrar produto'],
      a: 'Vá em <b>Produtos</b> no menu lateral e clique em <b>Novo Produto</b>. Preencha nome, categoria, preço e estoque — os outros campos são opcionais.' },
    { topic: 'Produtos', q: ['colocar em promoção', 'produto em promoção', 'promoção', 'desconto no produto'],
      a: 'Edite o produto em <b>Produtos</b> e preencha o campo <b>Preço Antigo</b> com um valor maior que o Preço atual — o desconto aparece automaticamente na loja.' },
    { topic: 'Produtos', q: ['sku', 'ean', 'ncm', 'código interno', 'código de barras do produto'],
      a: 'Esses campos ficam na edição do produto, em <b>Produtos</b>: <b>SKU</b> e <b>Código Interno</b> são identificadores seus, <b>EAN</b> é o código de barras oficial, <b>NCM</b> é o código fiscal. Nenhum é obrigatório pro produto aparecer na loja.' },
    { topic: 'Produtos', q: ['imagem do produto', 'foto do produto', 'trocar foto', 'produto sem imagem'],
      a: 'Na edição do produto em <b>Produtos</b>, tem um campo de imagens onde você sobe uma ou mais fotos — a primeira é a capa usada nos cards. Produto sem nenhuma imagem mostra uma caixa neutra em vez de foto quebrada.' },
    { topic: 'Produtos', q: ['duplicar produto', 'copiar produto'],
      a: 'Na lista de <b>Produtos</b>, clique em <b>Duplicar</b> na linha do produto — cria uma cópia com "(cópia)" no nome pra você editar rapidamente sem preencher tudo de novo.' },
    { topic: 'Produtos', q: ['excluir produto', 'apagar produto', 'remover produto'],
      a: 'Na lista de <b>Produtos</b>, clique em <b>Excluir</b> na linha do produto (precisa da permissão "Excluir produtos"). Cuidado: produtos com pedidos já feitos ficam sem o produto original, mas o pedido mantém os dados salvos na hora da compra.' },
    { topic: 'Produtos', q: ['produto inativo', 'desativar produto', 'ativo'],
      a: 'Edite o produto e desmarque <b>Ativo</b> — ele some da loja pro cliente mas continua no painel, sem precisar excluir.' },

    // ── CATEGORIAS ────────────────────────────────────────────────────────
    { topic: 'Categorias', q: ['criar categoria', 'nova categoria', 'adicionar categoria'],
      a: 'Vá em <b>Categorias</b>, clique em <b>Nova Categoria</b> (ou <b>Nova Subcategoria</b> dentro de uma categoria existente) e preencha nome e ordem de exibição.' },
    { topic: 'Categorias', q: ['reordenar categoria', 'mudar ordem das categorias', 'categoria não aparece no menu'],
      a: 'Em <b>Categorias</b>, use as setinhas ▲▼ pra reordenar categorias e subcategorias — a ordem no painel é a mesma ordem que aparece no menu do site.' },
    { topic: 'Categorias', q: ['subcategoria não aparece', 'barra de subcategorias sumiu'],
      a: 'Confere duas coisas: (1) em <b>Categorias</b>, se a categoria realmente tem subcategorias cadastradas e ativas; (2) em <b>Aparência → Blocos das Páginas → Categoria</b>, se o bloco "Subcategorias" está antes de "Grade de produtos" na ordem — se estiver depois, ele fica "escondido" no fim da página.' },

    // ── PEDIDOS ───────────────────────────────────────────────────────────
    { topic: 'Pedidos', q: ['status do pedido', 'alterar pedido', 'mudar status', 'marcar como pago'],
      a: 'Vá em <b>Pedidos</b>, abra o pedido desejado e altere o status no seletor — a mudança é salva na hora. Marcar como <b>Pago</b> desconta o estoque automaticamente; cancelar um pedido que já estava pago devolve o estoque.' },
    { topic: 'Pedidos', q: ['buscar pedido', 'encontrar pedido', 'número do pedido'],
      a: 'Em <b>Pedidos</b>, usa a busca no topo por número do pedido — ou pesquisa pelo sino de busca do Dashboard, que já abre a tela filtrada.' },
    { topic: 'Pedidos', q: ['rastreio', 'código de rastreio', 'transportadora'],
      a: 'Abrindo o pedido em <b>Pedidos</b> dá pra preencher o código de rastreio e a transportadora — isso é só informativo, não calcula frete automático de nenhuma transportadora ainda.' },

    // ── CLIENTES ──────────────────────────────────────────────────────────
    { topic: 'Clientes', q: ['bloquear cliente', 'desbloquear cliente'],
      a: 'Vá em <b>Clientes</b>, abra o cliente e use o botão <b>Bloquear</b> (ou <b>Desbloquear</b>). Cliente bloqueado não consegue mais fazer login na loja.' },
    { topic: 'Clientes', q: ['ver pedidos do cliente', 'histórico do cliente'],
      a: 'Abrindo o cliente em <b>Clientes</b> você vê os dados cadastrados e pode conferir os pedidos dele cruzando com a tela de <b>Pedidos</b> (filtrando pelo nome/e-mail).' },
    { topic: 'Clientes', q: ['novo cliente', 'cliente se cadastrou'],
      a: 'Todo cadastro novo na loja aparece automaticamente em <b>Clientes</b> e gera uma notificação (categoria "Clientes") no sino de notificações.' },

    // ── CUPONS ────────────────────────────────────────────────────────────
    { topic: 'Cupons', q: ['criar cupom', 'novo cupom', 'cupom de desconto'],
      a: 'Vá em <b>Cupons</b> no menu lateral e clique em <b>Novo Cupom</b>. Defina o código, tipo de desconto (percentual ou valor fixo), pedido mínimo e validade — ele já passa a funcionar no checkout.' },
    { topic: 'Cupons', q: ['cupom não funciona', 'cupom não aplica', 'cupom expirado'],
      a: 'Confere em <b>Cupons</b> se ele está <b>ativo</b>, dentro da validade, e se o pedido bate com o valor mínimo exigido — qualquer um desses fora do combinado faz o checkout recusar o código.' },
    { topic: 'Cupons', q: ['limite de uso do cupom', 'quantas vezes o cupom pode ser usado'],
      a: 'Ao criar/editar o cupom em <b>Cupons</b>, tem um campo de limite de uso total — o sistema conta sozinho quantas vezes já foi usado e bloqueia depois de bater o limite.' },

    // ── ESTOQUE ───────────────────────────────────────────────────────────
    { topic: 'Estoque', q: ['aumentar estoque', 'estoque', 'reposição', 'entrada de estoque'],
      a: 'Vá em <b>Estoque → Itens em Estoque</b> e clique em <b>Movimentar</b> no produto — escolha "Entrada manual" ou "Reposição", a quantidade e um motivo. O estoque atualiza sozinho e fica registrado no histórico.' },
    { topic: 'Estoque', q: ['tirar do estoque', 'saída de estoque', 'ajuste de estoque', 'corrigir estoque'],
      a: 'Em <b>Estoque → Itens em Estoque</b>, clique em <b>Movimentar</b> e escolha "Saída manual" (pra tirar uma quantidade) ou "Ajuste" (pra digitar o +/- direto, útil quando é só correção de contagem).' },
    { topic: 'Estoque', q: ['histórico de estoque', 'quem mexeu no estoque', 'movimentação do produto'],
      a: 'Em <b>Estoque → Itens em Estoque</b>, clique em <b>Histórico</b> no produto — mostra toda entrada/saída, incluindo vendas e cancelamentos automáticos, com data, usuário e saldo depois de cada movimento.' },
    { topic: 'Estoque', q: ['estoque baixo', 'estoque mínimo', 'aviso de estoque'],
      a: 'Cada produto tem um campo de <b>Estoque Mínimo</b> (em Produtos). Quando o estoque cai pra esse nível ou menos, o produto entra na lista de "Estoque baixo" no Dashboard e em Estoque, e gera uma notificação automática.' },
    { topic: 'Estoque', q: ['localização no estoque', 'onde fica o produto', 'prateleira'],
      a: 'Em <b>Estoque → Itens em Estoque</b> tem uma coluna "Localização" editável direto na tabela — digite algo como "Prateleira A3" e clica fora pra salvar.' },
    { topic: 'Estoque', q: ['estoque desconta sozinho', 'baixa automática de estoque', 'venda desconta estoque'],
      a: 'Sim — quando você marca um pedido como <b>Pago</b> em Pedidos, o estoque de cada produto do pedido desconta sozinho. Se depois cancelar esse pedido, o estoque volta automaticamente.' },

    // ── FINANCEIRO ────────────────────────────────────────────────────────
    { topic: 'Financeiro', q: ['ver lucro', 'meu lucro', 'quanto lucrei', 'margem de lucro', 'lucro líquido'],
      a: 'Vá em <b>Lucro</b> no menu lateral. Ele calcula receita, custo dos produtos vendidos e despesas automaticamente — só depende de você ter preenchido o <b>Preço de Custo</b> em cada produto e cadastrado suas despesas em <b>Despesas</b>.' },
    { topic: 'Financeiro', q: ['cadastrar despesa', 'nova despesa', 'custo fixo', 'aluguel', 'gastos da loja'],
      a: 'Vá em <b>Despesas</b> no menu lateral e clique em <b>Nova Despesa</b>. Marque "recorrente" pra custos que se repetem todo mês (aluguel, salários, assinaturas) — eles entram automaticamente no cálculo de lucro de cada mês.' },
    { topic: 'Financeiro', q: ['preço de custo', 'custo do produto', 'cmv'],
      a: 'Preenche o <b>Preço de Custo</b> na edição de cada produto (tela Produtos) — é isso que alimenta o cálculo de lucro bruto e o "Resumo Financeiro" do Dashboard.' },

    // ── AVALIAÇÕES ────────────────────────────────────────────────────────
    { topic: 'Avaliações', q: ['aprovar avaliação', 'moderar avaliação', 'avaliação', 'rejeitar avaliação'],
      a: 'Vá em <b>Avaliações</b> — lá você aprova, rejeita ou exclui avaliações enviadas pelos clientes. Só avaliações aprovadas aparecem na página do produto e contam na nota média.' },

    // ── EQUIPE ────────────────────────────────────────────────────────────
    { topic: 'Equipe', q: ['criar conta', 'novo funcionário', 'equipe', 'permissão', 'cargo'],
      a: 'Vá em <b>Equipe</b> (apenas Administradores) para criar contas de funcionários e definir o cargo de cada um. Cada cargo já vem com um conjunto padrão de permissões que dá pra ajustar individualmente.' },
    { topic: 'Equipe', q: ['mudar permissão', 'dar acesso', 'tirar acesso'],
      a: 'Em <b>Equipe</b>, abra o funcionário e ajusta as permissões marcadas — cada tela do painel (Produtos, Pedidos, Estoque etc.) tem sua própria permissão, então dá pra liberar só o que a pessoa precisa.' },

    // ── DASHBOARD ─────────────────────────────────────────────────────────
    { topic: 'Dashboard', q: ['mudar período', 'período personalizado', 'filtrar por data', 'período do dashboard'],
      a: 'No topo do Dashboard tem os atalhos 7/30/90 dias e um seletor com mais opções (Hoje, Ontem, Este mês, Mês passado, Este ano, Período personalizado). Escolher qualquer um atualiza receita, gráfico, pedidos e produtos mais vendidos juntos.' },
    { topic: 'Dashboard', q: ['buscar produto no painel', 'busca global', 'pesquisar cliente', 'pesquisar pedido'],
      a: 'A busca no topo do Dashboard pesquisa em Produtos, Categorias, Clientes, Pedidos e Cupons ao mesmo tempo, em tempo real. Clicar num resultado já abre a tela certa com o filtro aplicado.' },
    { topic: 'Dashboard', q: ['gráfico de receita', 'receita não bate'],
      a: 'O gráfico de receita do Dashboard só conta pedidos com status diferente de "Aguardando Pagamento" e "Cancelado" — ou seja, receita de verdade, não venda pendente.' },

    // ── NOTIFICAÇÕES ──────────────────────────────────────────────────────
    { topic: 'Notificações', q: ['notificação', 'sino', 'aviso de pedido novo', 'marcar como lida'],
      a: 'O sino (no topo do Dashboard, ou flutuante nas outras telas) avisa sozinho sobre pedido novo/pago/cancelado/enviado/entregue, estoque baixo/zerado e cliente novo. Clica pra ver, marcar como lida ou excluir; o histórico completo fica em <b>Notificações</b> no menu.' },
    { topic: 'Notificações', q: ['notificação de estoque baixo', 'aviso de estoque zerado'],
      a: 'Sempre que um produto cruza o estoque mínimo ou zera, uma notificação é criada automaticamente na categoria "Estoque" — não precisa configurar nada.' },

    // ── APARÊNCIA — DESIGN SYSTEM / IDENTIDADE ───────────────────────────
    { topic: 'Aparência', q: ['mudar cor do site', 'design system', 'tipografia', 'cor do preço', 'cor do botão', 'mudar cor', 'cores do site', 'personalizar site', 'trocar cor'],
      a: 'Vá em <b>Aparência → Design System</b>. Lá dá pra mudar cores de preço/PIX/parcelamento/botões separadamente, tipografia e estilo de botão — sempre com "Salvar rascunho" antes de "Publicar", e um preview ao vivo do site.' },
    { topic: 'Aparência', q: ['trocar logo', 'trocar favicon', 'identidade visual'],
      a: 'Vá em <b>Aparência → Identidade Visual</b> pra trocar logo (modo claro/escuro) e favicon.' },
    { topic: 'Aparência', q: ['mudar texto do botão', 'trocar texto', 'editar texto do site'],
      a: 'Vá em <b>Aparência → Textos</b> — lista os textos de botões/rótulos que já estão conectados ao site (mais vão sendo adicionados aos poucos).' },
    { topic: 'Aparência', q: ['reordenar seção', 'mover bloco', 'esconder seção', 'arrastar bloco'],
      a: 'Vá em <b>Aparência → Blocos das Páginas</b> — arraste pra reordenar, use o olho pra mostrar/ocultar, e o cadeado pra travar a posição. Funciona em Homepage, Produto, Categoria, Carrinho, Checkout e Minha Conta.' },
    { topic: 'Aparência', q: ['criar página', 'nova página', 'política de privacidade', 'termos de uso', 'página de contato'],
      a: 'Vá em <b>Aparência → Páginas</b>. As páginas institucionais (política, termos, garantia etc.), contato, suporte e outras já existem prontas pra você editar — lembre de marcar "Publicada" quando terminar.' },
    { topic: 'Aparência', q: ['editar cabeçalho', 'menu do topo', 'header do site'],
      a: 'Vá em <b>Aparência → Header</b> pra editar os links do menu superior e a barra de topo do site.' },
    { topic: 'Aparência', q: ['carrossel da home', 'banner principal', 'hero'],
      a: 'Vá em <b>Aparência → Hero / Banner</b> pra editar o carrossel grande do topo da homepage.' },
    { topic: 'Aparência', q: ['alterar banner', 'editar banner', 'trocar banner', 'banner'],
      a: 'Vá em <b>Aparência → Banners</b> (ou <b>Hero / Banner</b> pro carrossel do topo) e clique em <b>Novo</b> — dá pra subir a imagem, definir link e ordem de exibição.' },
    { topic: 'Aparência', q: ['popup', 'pop-up de desconto', 'aviso na tela'],
      a: 'Vá em <b>Aparência → Popups</b> pra criar avisos, cupons ou newsletter que aparecem em cima do site — cada tipo tem seu próprio visual.' },
    { topic: 'Aparência', q: ['organizar homepage', 'seções da home', 'ordem da homepage'],
      a: 'Vá em <b>Aparência → Homepage</b> pra arrastar e reordenar as seções e categorias em destaque da página inicial.' },
    { topic: 'Aparência', q: ['seo', 'aparecer no google', 'meta description', 'título da página no google'],
      a: 'Vá em <b>Aparência → SEO</b> pra configurar título/descrição padrão do site pros mecanismos de busca.' },
    { topic: 'Aparência', q: ['google analytics', 'meta pixel', 'facebook pixel', 'tiktok pixel', 'google tag manager', 'instalar script', 'cookie', 'consentimento'],
      a: 'Vá em <b>Aparência → Integrações e Scripts</b>. Pra Google Analytics, Meta Pixel, TikTok Pixel e outras ferramentas conhecidas, basta colar o ID na aba <b>Integrações</b> — não precisa entender código. Pra qualquer outro script, use a aba <b>Scripts personalizados</b>.' },
  ];

  const FAQ_TOPICS = [...new Set(FAQ.map(f => f.topic))];

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

    mountMobileNav();
  }

  // A barra lateral já virava gaveta em telas ≤900px (admin.css), mas não
  // existia nenhum botão em lugar nenhum pra abrir essa gaveta — ficava
  // presa fora da tela. Injeta o botão dentro do topbar de qualquer página
  // (sem precisar editar as 26 telas uma por uma) mais um fundo escurecido
  // que fecha ao tocar fora.
  function mountMobileNav() {
    const topbar = document.querySelector('.admin-topbar');
    const sidebar = document.getElementById('adminSidebar');
    if (!topbar || !sidebar || document.getElementById('adminMobToggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'admin-mob-toggle';
    toggle.id = 'adminMobToggle';
    toggle.title = 'Abrir menu';
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    topbar.prepend(toggle);

    const backdrop = document.createElement('div');
    backdrop.className = 'admin-sidebar-backdrop';
    backdrop.id = 'adminSidebarBackdrop';
    document.body.appendChild(backdrop);

    function closeNav() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }
    function openNav() { sidebar.classList.add('open'); backdrop.classList.add('open'); }

    toggle.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) closeNav(); else openNav();
    });
    backdrop.addEventListener('click', closeNav);
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
    return best ? best.a : 'Não tenho uma resposta pronta pra isso ainda. Escolhe um dos tópicos abaixo (' + FAQ_TOPICS.join(', ') + ') pra ver as perguntas mais comuns de cada área.';
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
          <div class="chat-msg bot">Oi! Posso te ajudar a usar o painel. Digite sua dúvida ou escolhe um tópico abaixo pra ver as perguntas mais comuns.</div>
        </div>
        <div class="chat-topics" id="chatTopics">
          ${FAQ_TOPICS.map(t => `<button class="chat-topic-btn" data-topic="${t}">${t}</button>`).join('')}
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
    // Delegação: qualquer botão de sugestão inserido depois (via tópico)
    // também funciona, sem precisar religar listener toda hora.
    body.addEventListener('click', e => {
      const b = e.target.closest('.chat-sugg-btn[data-q]');
      if (b) ask(b.dataset.q);
    });
    document.getElementById('chatTopics').addEventListener('click', e => {
      const btn = e.target.closest('.chat-topic-btn');
      if (!btn) return;
      const topic = btn.dataset.topic;
      const items = FAQ.filter(f => f.topic === topic);
      const listHtml = items.map(f => {
        const label = f.q[0].charAt(0).toUpperCase() + f.q[0].slice(1) + '?';
        return `<button class="chat-sugg-btn" data-q="${label.replace(/"/g, '&quot;')}">${label}</button>`;
      }).join('');
      body.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">Perguntas sobre <b>${topic}</b>:</div><div class="chat-suggestions">${listHtml}</div>`);
      body.scrollTop = body.scrollHeight;
    });
    document.getElementById('adminChatSend').addEventListener('click', () => {
      const inp = document.getElementById('adminChatInput');
      ask(inp.value); inp.value = '';
    });
    document.getElementById('adminChatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { ask(e.target.value); e.target.value = ''; }
    });
  }

  /* ═══ NOTIFICAÇÕES ═══ */
  let _notifCat = 'todas';
  let _notifCache = [];

  function timeAgoShell(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.floor(min / 60);
    if (h < 24) return 'há ' + h + 'h';
    const d = Math.floor(h / 24);
    if (d < 30) return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    return new Date(iso).toLocaleDateString('pt-BR');
  }

  async function refreshNotifBadge() {
    if (!can('notificacoes.visualizar')) return;
    try {
      const { count } = await window.sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', false);
      // Além do badge do sino flutuante, qualquer elemento marcado com
      // data-notif-badge (ex: o sino que já mora no topbar do Dashboard)
      // recebe o mesmo contador — sem precisar acoplar admin-shell.js a
      // um id específico de página.
      document.querySelectorAll('#notifFabBadge, [data-notif-badge]').forEach(badge => {
        if (count) { badge.hidden = false; badge.textContent = count > 9 ? '9+' : count; }
        else badge.hidden = true;
      });
    } catch (e) { /* silencioso */ }
  }

  function renderNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!_notifCache.length) { list.innerHTML = '<div class="notif-empty">Nenhuma notificação por aqui.</div>'; return; }
    list.innerHTML = _notifCache.map(n => {
      const cat = NOTIF_CATS.find(c => c.key === n.categoria) || {};
      return `<div class="notif-item ${n.lida ? '' : 'unread'}" data-id="${n.id}" data-href="${n.link_href || ''}">
        <div class="notif-item-ic" style="background:${cat.color || 'var(--primary)'}22;color:${cat.color || 'var(--primary)'}">${NOTIF_ICON[n.categoria] || ''}</div>
        <div class="notif-item-body">
          <div class="notif-item-title">${n.titulo}</div>
          ${n.descricao ? `<div class="notif-item-desc">${n.descricao}</div>` : ''}
          <div class="notif-item-time">${timeAgoShell(n.created_at)}</div>
        </div>
        <button class="notif-item-del" data-del="${n.id}" title="Excluir">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
  }

  async function loadNotifList() {
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '<div class="notif-empty">Carregando...</div>';
    let q = window.sb.from('notificacoes').select('*').order('created_at', { ascending: false }).limit(30);
    if (_notifCat !== 'todas') q = q.eq('categoria', _notifCat);
    const { data } = await q;
    _notifCache = data || [];
    renderNotifList();
  }

  function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) loadNotifList();
  }

  function mountNotifBell() {
    if (!can('notificacoes.visualizar')) return;
    if (document.getElementById('notifFab')) return;

    // O sino mora dentro do topbar de toda página (mesmo lugar em todo
    // lugar) em vez de flutuar solto lá embaixo — evita ficar duplicado
    // do lado do balão de chat. Se a página não tiver uma área de ações
    // no topbar ainda, cria uma.
    const topbar = document.querySelector('.admin-topbar');
    const bellBtn = document.createElement('button');
    bellBtn.className = 'notif-fab';
    bellBtn.id = 'notifFab';
    bellBtn.title = 'Notificações';
    bellBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="notif-fab-badge" id="notifFabBadge" hidden>0</span>';

    // Páginas podem marcar o lugar exato do sino com <span id="notifAnchor">
    // (ex: Dashboard, onde ele fica entre a busca e o botão de criar); as
    // demais recebem o sino no início do bloco de ações do topbar.
    const anchor = document.getElementById('notifAnchor');
    let actions = document.querySelector('.admin-topbar-actions');
    if (anchor) {
      anchor.classList.forEach(c => bellBtn.classList.add(c));
      anchor.replaceWith(bellBtn);
    } else if (topbar) {
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'admin-topbar-actions';
        topbar.appendChild(actions);
      }
      actions.prepend(bellBtn);
    } else {
      document.body.appendChild(bellBtn);
    }

    const panelWrap = document.createElement('div');
    panelWrap.innerHTML = `
      <div class="notif-panel" id="notifPanel">
        <div class="notif-head">
          <div class="notif-head-title">Notificações</div>
          <div class="notif-head-actions">
            <button class="notif-mark-all" id="notifMarkAll">Marcar todas como lidas</button>
            <button class="modal-close" id="notifClose">✕</button>
          </div>
        </div>
        <div class="notif-tabs" id="notifTabs">
          ${NOTIF_CATS.map(c => `<button class="notif-tab ${c.key === 'todas' ? 'active' : ''}" data-cat="${c.key}">${c.label}</button>`).join('')}
        </div>
        <div class="notif-list" id="notifList"><div class="notif-empty">Carregando...</div></div>
        <div style="padding:10px 16px;border-top:1px solid var(--border-color);text-align:center;">
          <a href="admin-notificacoes.html" style="font-size:11.5px;color:var(--primary);font-weight:700;">Ver histórico completo →</a>
        </div>
      </div>`;
    document.body.appendChild(panelWrap);

    const panel = document.getElementById('notifPanel');
    bellBtn.addEventListener('click', () => toggleNotifications());
    document.getElementById('notifClose').addEventListener('click', () => panel.classList.remove('open'));

    document.getElementById('notifTabs').addEventListener('click', e => {
      const btn = e.target.closest('.notif-tab');
      if (!btn) return;
      _notifCat = btn.dataset.cat;
      document.querySelectorAll('#notifTabs .notif-tab').forEach(b => b.classList.toggle('active', b === btn));
      loadNotifList();
    });

    document.getElementById('notifMarkAll').addEventListener('click', async () => {
      await window.sb.from('notificacoes').update({ lida: true }).eq('lida', false);
      await loadNotifList();
      refreshNotifBadge();
    });

    document.getElementById('notifList').addEventListener('click', async e => {
      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        e.stopPropagation();
        await window.sb.from('notificacoes').delete().eq('id', delBtn.dataset.del);
        _notifCache = _notifCache.filter(n => String(n.id) !== delBtn.dataset.del);
        renderNotifList();
        refreshNotifBadge();
        return;
      }
      const item = e.target.closest('.notif-item');
      if (!item) return;
      const id = item.dataset.id;
      if (item.classList.contains('unread')) {
        await window.sb.from('notificacoes').update({ lida: true }).eq('id', id);
        item.classList.remove('unread');
        refreshNotifBadge();
      }
      if (item.dataset.href) location.href = item.dataset.href;
    });

    refreshNotifBadge();
    setInterval(refreshNotifBadge, 60000);
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
    mountNotifBell();
    return { profile, can };
  }

  return { init, can, toast, toggleNotifications, get profile() { return _profile; } };
})();
