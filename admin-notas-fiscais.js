/* Alfa Informática — Notas Fiscais (armazenamento manual de XML/DANFE por pedido)
   Módulo compartilhado por admin-notas-fiscais.html (listagem geral) e
   admin-pedidos.html (seção "Nota Fiscal" dentro do detalhe do pedido).
   Não emite NF-e nem fala com a SEFAZ — só guarda e organiza os arquivos que
   o funcionário baixa manualmente do ERP externo. */
window.NotasFiscais = (function () {
  const BUCKET = 'notas-fiscais';

  const STATUS_LABELS = { anexada: 'Anexada', pendente: 'Pendente', cancelada: 'Cancelada', substituida: 'Substituída' };
  const STATUS_COLORS = { anexada: 'green', pendente: 'amber', cancelada: 'red', substituida: 'gray' };

  let _uploading = false;
  window.addEventListener('beforeunload', (e) => {
    if (_uploading) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── formatação ────────────────────────────────────────────────────────
  function fmtBRL(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
  function fmtDate(d) { return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'; }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    const dt = new Date(iso);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtBytes(n) {
    if (!n) return '';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function onlyDigits(s) { return (s || '').replace(/\D/g, ''); }
  function fmtChave(raw) { return onlyDigits(raw).replace(/(\d{4})(?=\d)/g, '$1 ').trim(); }
  function validateChave(raw) {
    const digits = onlyDigits(raw);
    if (digits.length !== 44) return { valid: false, digits, error: 'A chave de acesso deve ter exatamente 44 números.' };
    return { valid: true, digits, error: null };
  }

  function validateXmlFile(file) {
    if (!file) return 'Selecione um arquivo XML válido.';
    const okExt = /\.xml$/i.test(file.name);
    const okMime = !file.type || /xml/i.test(file.type);
    if (!okExt || !okMime) return 'Selecione um arquivo XML válido.';
    if (file.size > 5 * 1024 * 1024) return 'O arquivo XML ultrapassa o tamanho máximo permitido (5 MB).';
    return null;
  }
  function validatePdfFile(file) {
    if (!file) return 'Selecione um arquivo PDF válido.';
    const okExt = /\.pdf$/i.test(file.name);
    const okMime = !file.type || file.type === 'application/pdf';
    if (!okExt || !okMime) return 'Selecione um arquivo PDF válido.';
    if (file.size > 15 * 1024 * 1024) return 'O arquivo PDF ultrapassa o tamanho máximo permitido (15 MB).';
    return null;
  }

  function friendlyError(error) {
    console.error('[NotasFiscais]', error);
    const msg = (error && error.message) || '';
    if ((error && error.code === '23505') || /duplicate key/i.test(msg)) {
      if (/chave_acesso/i.test(msg)) return 'Já existe uma NF-e cadastrada com essa chave de acesso.';
      if (/pedido_principal/i.test(msg)) return 'Este pedido já tem uma NF-e principal cadastrada.';
      return 'Já existe um registro com esses dados.';
    }
    if (/permission|permiss/i.test(msg)) return 'Você não tem permissão para realizar essa ação.';
    if (/fetch|network/i.test(msg)) return 'Falha de conexão. Tente novamente.';
    return 'Não foi possível completar a operação. Tente novamente.';
  }

  // ── storage ──────────────────────────────────────────────────────────
  async function uploadFiles(pedidoId, xmlFile, pdfFile) {
    const uuid = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2)));
    const folder = String(pedidoId) + '/' + uuid;
    const xmlPath = folder + '/nfe.xml';
    const pdfPath = folder + '/danfe.pdf';

    const { error: xmlErr } = await window.sb.storage.from(BUCKET).upload(xmlPath, xmlFile, { contentType: 'application/xml' });
    if (xmlErr) throw new Error('Não foi possível enviar o arquivo XML. Tente novamente.');

    const { error: pdfErr } = await window.sb.storage.from(BUCKET).upload(pdfPath, pdfFile, { contentType: 'application/pdf' });
    if (pdfErr) {
      await window.sb.storage.from(BUCKET).remove([xmlPath]);
      throw new Error('Não foi possível enviar o arquivo PDF. Tente novamente.');
    }

    return {
      xml_storage_path: xmlPath, pdf_storage_path: pdfPath,
      xml_nome_original: xmlFile.name, pdf_nome_original: pdfFile.name,
      xml_tamanho: xmlFile.size, pdf_tamanho: pdfFile.size,
    };
  }

  async function removeFiles(paths) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) return;
    try { await window.sb.storage.from(BUCKET).remove(list); }
    catch (e) { console.error('[NotasFiscais] erro ao remover arquivos antigos', e); }
  }

  async function getSignedUrl(path) {
    const { data, error } = await window.sb.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data) throw new Error('Não foi possível gerar o link de download.');
    return data.signedUrl;
  }

  async function downloadFile(path, filename) {
    const url = await getSignedUrl(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Não foi possível baixar o arquivo. Tente novamente.');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl; a.download = filename || 'arquivo';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
  }

  // ── histórico ────────────────────────────────────────────────────────
  async function logHistorico(notaId, acao, antes, depois) {
    try {
      await window.sb.from('notas_fiscais_historico').insert({
        nota_fiscal_id: notaId, acao, dados_anteriores: antes || null, dados_novos: depois || null,
      });
    } catch (e) { console.error('[NotasFiscais] erro ao gravar histórico', e); }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────
  async function fetchInvoiceForOrder(pedidoId) {
    const { data, error } = await window.sb.from('notas_fiscais').select('*')
      .eq('pedido_id', pedidoId).eq('tipo_documento', 'principal').is('deleted_at', null)
      .maybeSingle();
    if (error) { console.error(error); return null; }
    return data;
  }

  async function createInvoice(payload, xmlFile, pdfFile) {
    const xmlErr = validateXmlFile(xmlFile); if (xmlErr) throw new Error(xmlErr);
    const pdfErr = validatePdfFile(pdfFile); if (pdfErr) throw new Error(pdfErr);
    const chave = validateChave(payload.chave_acesso);
    if (!chave.valid) throw new Error(chave.error);

    _uploading = true;
    let files;
    try {
      files = await uploadFiles(payload.pedido_id, xmlFile, pdfFile);
      const row = Object.assign({}, payload, files, { chave_acesso: chave.digits, status: 'anexada' });
      const { data, error } = await window.sb.from('notas_fiscais').insert(row).select().single();
      if (error) { await removeFiles([files.xml_storage_path, files.pdf_storage_path]); throw new Error(friendlyError(error)); }
      await logHistorico(data.id, 'criada', null, data);
      return data;
    } finally { _uploading = false; }
  }

  async function updateInvoiceFields(invoice, payload) {
    const next = Object.assign({}, payload);
    const { data, error } = await window.sb.from('notas_fiscais').update(next).eq('id', invoice.id).select().single();
    if (error) throw new Error(friendlyError(error));
    await logHistorico(invoice.id, 'editada', invoice, data);
    return data;
  }

  async function replaceInvoiceFiles(invoice, xmlFile, pdfFile) {
    const xmlErr = validateXmlFile(xmlFile); if (xmlErr) throw new Error(xmlErr);
    const pdfErr = validatePdfFile(pdfFile); if (pdfErr) throw new Error(pdfErr);

    _uploading = true;
    let files;
    try {
      files = await uploadFiles(invoice.pedido_id, xmlFile, pdfFile);
      const { data, error } = await window.sb.from('notas_fiscais').update(files).eq('id', invoice.id).select().single();
      if (error) { await removeFiles([files.xml_storage_path, files.pdf_storage_path]); throw new Error(friendlyError(error)); }
      // só apaga os arquivos antigos depois que o banco confirmou os novos caminhos
      await removeFiles([invoice.xml_storage_path, invoice.pdf_storage_path]);
      await logHistorico(invoice.id, 'arquivos_substituidos', invoice, data);
      return data;
    } finally { _uploading = false; }
  }

  async function softDeleteInvoice(invoice, reason) {
    const { data: userData } = await window.sb.auth.getUser();
    const uid = userData && userData.user ? userData.user.id : null;
    const { data, error } = await window.sb.from('notas_fiscais')
      .update({ deleted_at: new Date().toISOString(), deleted_by: uid, deletion_reason: reason || null })
      .eq('id', invoice.id).select().single();
    if (error) throw new Error(friendlyError(error));
    await logHistorico(invoice.id, 'removida', invoice, data);
    await removeFiles([invoice.xml_storage_path, invoice.pdf_storage_path]);
    return data;
  }

  async function fetchOrderFull(orderId) {
    const { data: order, error } = await window.sb.from('orders')
      .select('id,order_number,total,status,created_at,profiles(full_name,email,cpf)').eq('id', orderId).single();
    if (error || !order) return null;
    const { data: items } = await window.sb.from('order_items').select('product_name_snapshot,qty').eq('order_id', orderId);
    order.items = items || [];
    return order;
  }

  // ── badge (usado na tabela de Pedidos e na de Notas Fiscais) ───────────
  function renderStatusBadge(hasInvoice) {
    return hasInvoice
      ? '<span class="status-pill green">NF-e anexada</span>'
      : '<span class="status-pill gray">Sem NF-e</span>';
  }

  // ── estilos injetados uma única vez (partes sem equivalente em admin.css) ──
  function ensureStyles() {
    if (document.getElementById('nfStyles')) return;
    const style = document.createElement('style');
    style.id = 'nfStyles';
    style.textContent = `
      .nf-order-search{position:relative;}
      .nf-order-results{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);max-height:280px;overflow-y:auto;z-index:20;display:none;}
      .nf-order-results.open{display:block;}
      .nf-order-item{display:flex;align-items:center;gap:10px;padding:10px 13px;cursor:pointer;border-bottom:1px solid var(--border-color);}
      .nf-order-item:last-child{border-bottom:none;}
      .nf-order-item:hover{background:var(--bg-card-2);}
      .nf-order-item-main{flex:1;min-width:0;}
      .nf-order-item-num{font-size:13px;font-weight:800;color:var(--text-main);}
      .nf-order-item-cli{font-size:12px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .nf-order-item-doc{font-size:11px;color:var(--text-muted);margin-top:1px;}
      .nf-order-item-side{text-align:right;flex-shrink:0;}
      .nf-order-item-val{font-size:12.5px;font-weight:700;color:var(--text-main);}
      .nf-order-item-date{font-size:10.5px;color:var(--text-muted);margin-top:2px;}
      .nf-order-empty{padding:16px 13px;font-size:12.5px;color:var(--text-muted);text-align:center;}
      .nf-locked-order{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:10px 13px;font-size:13px;color:var(--text-main);}

      .nf-ref-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);overflow:hidden;margin-top:12px;}
      .nf-ref-card-head{background:rgba(37,99,235,.08);padding:10px 16px;font-size:12.5px;font-weight:800;color:var(--primary);display:flex;align-items:center;justify-content:space-between;}
      .nf-ref-card-body{padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;}
      .nf-ref-item{min-width:0;}
      .nf-ref-item.span2{grid-column:1/-1;}
      .nf-ref-lbl{font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:3px;}
      .nf-ref-val{font-size:13px;color:var(--text-main);font-weight:600;overflow-wrap:anywhere;}
      @media(max-width:480px){.nf-ref-card-body{grid-template-columns:1fr;}}

      .nf-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;margin-bottom:16px;}
      .nf-detail-grid .dl{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:10px;}
      .nf-detail-grid .dv{font-size:13.5px;color:var(--text-main);font-weight:600;}
      .nf-file-row{display:flex;align-items:center;justify-content:space-between;background:rgba(128,128,128,.06);border:1px solid var(--border-color);border-radius:var(--radius-sm);padding:9px 13px;margin-bottom:8px;font-size:12.5px;color:var(--text-secondary);}
      .nf-empty-box{text-align:center;padding:26px 16px;}
      .nf-empty-box svg{color:var(--text-muted);margin-bottom:8px;}
      .nf-empty-box p{font-size:12.5px;color:var(--text-muted);margin-bottom:14px;}
      @media(max-width:480px){.nf-detail-grid{grid-template-columns:1fr;}}

      /* ═══ formulário: seções, legenda, campos ═══ */
      .nf-required-note{font-size:11.5px;color:var(--text-muted);margin:-4px 0 16px;}
      .nf-req{color:var(--danger);margin-left:2px;}
      .nf-section{margin-bottom:26px;}
      .nf-section:last-child{margin-bottom:0;}
      .nf-section-title{font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-main);padding-bottom:8px;margin-bottom:16px;border-bottom:1px solid var(--border-color);}

      /* ═══ chave de acesso: estados ═══ */
      .nf-chave-wrap{position:relative;}
      .nf-chave-wrap input{padding-right:38px;font-family:monospace;letter-spacing:.02em;}
      .nf-chave-check{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--success);display:none;}
      #nf_chave.nf-state-incomplete{border-color:var(--warning);}
      #nf_chave.nf-state-valid{border-color:var(--success);}
      #nf_chave.nf-state-valid ~ .nf-chave-check{display:block;}
      #nf_chave.nf-state-invalid{border-color:var(--danger);}
      #nfChaveHint.nf-hint-error{color:var(--danger);font-weight:600;}

      /* ═══ valor monetário ═══ */
      #nf_valor{font-variant-numeric:tabular-nums;font-weight:700;}

      /* ═══ datas ═══ */
      input[type="date"]{color-scheme:light;}
      :root[data-theme="dark"] input[type="date"]{color-scheme:dark;}

      /* ═══ upload em cards ═══ */
      .nf-upload-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
      @media(max-width:560px){.nf-upload-grid{grid-template-columns:1fr;}}
      .nf-upload-card{position:relative;border:1.5px dashed var(--border-color);border-radius:var(--radius-lg);background:var(--bg-main);transition:border-color .15s var(--ease),background .15s var(--ease);}
      .nf-upload-card.nf-upload-dragging{border-color:var(--primary);background:var(--primary-soft);}
      .nf-upload-card.nf-upload-error-state{border-color:var(--danger);border-style:solid;}
      .nf-upload-empty{text-align:center;padding:22px 16px;}
      .nf-upload-empty svg{color:var(--text-muted);margin-bottom:8px;}
      .nf-upload-label{font-size:13px;font-weight:700;color:var(--text-main);margin-bottom:4px;}
      .nf-upload-drop-hint{font-size:12px;color:var(--text-secondary);margin-bottom:4px;}
      .nf-upload-or{font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;}
      .nf-upload-filled{display:flex;align-items:center;gap:10px;padding:16px;}
      .nf-upload-ok-ic{color:var(--success);flex-shrink:0;background:var(--success-soft);border-radius:50%;padding:6px;width:32px;height:32px;box-sizing:border-box;}
      .nf-upload-file-info{flex:1;min-width:0;}
      .nf-upload-file-name{font-size:12.5px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .nf-upload-file-size{font-size:11px;color:var(--text-muted);margin-top:2px;}
      .nf-upload-file-actions{display:flex;flex-direction:column;gap:6px;flex-shrink:0;}
      .nf-upload-error{font-size:11.5px;color:var(--danger);font-weight:600;padding:0 16px 14px;}

      /* ═══ wizard mobile ═══ */
      .nf-step-progress{display:none;}
      .nf-wizard .nf-step-progress{display:block;padding:0 0 16px;}
      .nf-step-progress-txt{font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;}
      .nf-step-dots{display:flex;gap:5px;}
      .nf-step-dot{height:4px;flex:1;border-radius:2px;background:var(--border-color);}
      .nf-step-dot.active{background:var(--primary);}
      .nf-step-dot.done{background:var(--success);}
      .nf-wizard .nf-section.nf-step-hidden{display:none;}
      .nf-modal-foot{justify-content:space-between;}
      .nf-modal-foot-right{display:flex;gap:10px;justify-content:flex-end;flex:1;}
      .nf-form-modal.nf-saving .nf-section{opacity:.6;pointer-events:none;}
    `;
    document.head.appendChild(style);
  }

  // ── modal: formulário (criar / editar metadados) ────────────────────────
  const STEP_TITLES = ['Pedido', 'Dados da Nota Fiscal', 'Arquivos', 'Informações do Emitente', 'Informações Complementares'];
  const STEP_MEDIA = '(max-width:640px)';
  let _step = 1;

  function uploadCardHtml(kind, label, hint) {
    return `
      <div class="nf-upload-card" id="nfCard_${kind}" data-kind="${kind}">
        <input type="file" id="nf_${kind}" hidden>
        <div class="nf-upload-empty">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div class="nf-upload-label">${label} <span class="nf-req">*</span></div>
          <div class="nf-upload-drop-hint">Arraste o arquivo aqui</div>
          <div class="nf-upload-or">ou</div>
          <button type="button" class="btn btn-secondary btn-sm nf-upload-pick">Selecionar arquivo</button>
        </div>
        <div class="nf-upload-filled" style="display:none;">
          <svg class="nf-upload-ok-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <div class="nf-upload-file-info">
            <div class="nf-upload-file-name"></div>
            <div class="nf-upload-file-size"></div>
          </div>
          <div class="nf-upload-file-actions">
            <button type="button" class="btn btn-secondary btn-sm nf-upload-change">Trocar arquivo</button>
            <button type="button" class="btn btn-secondary btn-sm nf-upload-remove">Remover</button>
          </div>
        </div>
        <div class="nf-upload-error" style="display:none;"></div>
        <div class="field-hint" style="padding:0 16px 12px;">${hint}</div>
      </div>`;
  }

  function ensureFormModal() {
    if (document.getElementById('nfFormModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="nfFormModal">
        <div class="modal nf-form-modal" style="max-width:700px;">
          <div class="modal-head"><div class="modal-title" id="nfFormTitle">Adicionar NF-e</div><button class="modal-close" id="nfFormClose">✕</button></div>
          <div id="nfFormBody">
            <div class="nf-step-progress" id="nfStepProgress"></div>
            <div class="nf-required-note">* Campos obrigatórios</div>

            <div class="nf-section" data-step="1">
              <div class="nf-section-title">Pedido</div>
              <div class="field" id="nfOrderPickWrap">
                <label>Pedido vinculado <span class="nf-req">*</span></label>
                <div class="nf-order-search">
                  <input type="search" id="nf_order_search" placeholder="Buscar por número do pedido, cliente ou CPF/CNPJ...">
                  <div class="nf-order-results" id="nfOrderResults"></div>
                </div>
              </div>
              <div class="field" id="nfOrderLocked" style="display:none;">
                <label>Pedido vinculado</label>
                <div class="nf-locked-order" id="nfOrderLockedTxt"></div>
              </div>
              <div id="nfOrderRef" style="display:none;"></div>
            </div>

            <div class="nf-section" data-step="2">
              <div class="nf-section-title">Dados da Nota Fiscal</div>
              <div class="field-row">
                <div class="field"><label>Número da NF-e <span class="nf-req">*</span></label><input id="nf_numero"></div>
                <div class="field"><label>Série <span class="nf-req">*</span></label><input id="nf_serie"></div>
              </div>
              <div class="field">
                <label>Chave de acesso <span class="nf-req">*</span></label>
                <div class="nf-chave-wrap">
                  <input id="nf_chave" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000">
                  <svg class="nf-chave-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="field-hint" id="nfChaveHint">44 números — pontos, espaços e traços são removidos automaticamente.</div>
              </div>
              <div class="field-row">
                <div class="field"><label>Data de emissão <span class="nf-req">*</span></label><input type="date" id="nf_emissao"></div>
                <div class="field"><label>Valor total <span class="nf-req">*</span></label><input type="text" inputmode="decimal" id="nf_valor" placeholder="R$ 0,00"></div>
              </div>
            </div>

            <div class="nf-section" data-step="3">
              <div class="nf-section-title">Arquivos</div>
              <div class="nf-upload-grid" id="nfFileRow">
                ${uploadCardHtml('xml', 'XML da NF-e', 'Até 5 MB.')}
                ${uploadCardHtml('pdf', 'PDF/DANFE', 'Até 15 MB.')}
              </div>
            </div>

            <div class="nf-section" data-step="4">
              <div class="nf-section-title">Informações do Emitente</div>
              <div class="field-row">
                <div class="field"><label>Protocolo de autorização</label><input id="nf_protocolo"></div>
                <div class="field"><label>CNPJ do emitente</label><input id="nf_emit_doc"></div>
              </div>
              <div class="field"><label>Nome/razão social do emitente</label><input id="nf_emit_nome"></div>
            </div>

            <div class="nf-section" data-step="5">
              <div class="nf-section-title">Informações Complementares</div>
              <div class="field-row">
                <div class="field"><label>Data de saída</label><input type="date" id="nf_saida"></div>
                <div class="field"><label>Natureza da operação</label><input id="nf_natureza" placeholder="Venda de mercadoria"></div>
              </div>
              <div class="field"><label>Observações</label><textarea id="nf_obs" rows="2"></textarea></div>
            </div>
          </div>
          <div class="modal-foot nf-modal-foot">
            <button class="btn btn-secondary" id="nfStepBack" style="display:none;">← Voltar</button>
            <div class="nf-modal-foot-right">
              <button class="btn btn-secondary" id="nfFormCancel">Cancelar</button>
              <button class="btn btn-secondary" id="nfStepNext" style="display:none;">Próximo →</button>
              <button class="btn btn-primary" id="nfFormSave">Adicionar NF-e</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('nf_chave').addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      const before = e.target.value.length;
      e.target.value = fmtChave(e.target.value);
      const after = e.target.value.length;
      e.target.selectionStart = e.target.selectionEnd = Math.max(0, pos + (after - before));
      updateChaveState();
    });

    document.getElementById('nf_valor').addEventListener('input', (e) => {
      const pos = e.target.selectionStart;
      const before = e.target.value.length;
      e.target.value = maskMoneyValue(e.target.value);
      const after = e.target.value.length;
      e.target.selectionStart = e.target.selectionEnd = Math.max(0, pos + (after - before));
    });
    document.getElementById('nf_valor').addEventListener('focus', (e) => {
      if (!e.target.value) e.target.value = fmtMoneyInput(0);
    });

    _xmlCardCtl = wireUploadCard('xml', validateXmlFile);
    _pdfCardCtl = wireUploadCard('pdf', validatePdfFile);

    document.getElementById('nfFormClose').addEventListener('click', closeFormModal);
    document.getElementById('nfFormCancel').addEventListener('click', closeFormModal);

    document.getElementById('nfStepNext').addEventListener('click', () => {
      if (_step === 1 && !_formCtx.orderId) { AdminShell.toast('Selecione o pedido vinculado.', 'error'); return; }
      let next = _step + 1;
      if (_formCtx && _formCtx.invoice && next === 3) next += 1; // edição não tem etapa de arquivos
      goToStep(next);
    });
    document.getElementById('nfStepBack').addEventListener('click', () => {
      let prev = _step - 1;
      if (_formCtx && _formCtx.invoice && prev === 3) prev -= 1;
      goToStep(prev);
    });

    window.matchMedia(STEP_MEDIA).addEventListener('change', () => {
      if (document.getElementById('nfFormModal').classList.contains('open')) renderStepUI();
    });
  }

  let _formCtx = null; // { orderId, order, invoice, onSaved, onClosed }
  let _xmlCardCtl = null;
  let _pdfCardCtl = null;

  function closeFormModal() {
    document.getElementById('nfFormModal').classList.remove('open');
    if (_formCtx && _formCtx.onClosed) _formCtx.onClosed();
    _formCtx = null;
  }

  // ── chave de acesso: feedback visual (âmbar incompleta / verde válida / vermelho erro) ──
  function updateChaveState(forceError) {
    const input = document.getElementById('nf_chave');
    const hint = document.getElementById('nfChaveHint');
    input.classList.remove('nf-state-incomplete', 'nf-state-valid', 'nf-state-invalid');
    hint.classList.remove('nf-hint-error');
    if (forceError) {
      input.classList.add('nf-state-invalid');
      hint.textContent = forceError;
      hint.classList.add('nf-hint-error');
      return;
    }
    const digits = onlyDigits(input.value);
    if (!digits.length) {
      hint.textContent = '44 números — pontos, espaços e traços são removidos automaticamente.';
      return;
    }
    if (digits.length < 44) {
      input.classList.add('nf-state-incomplete');
      hint.textContent = digits.length + ' de 44 números.';
    } else {
      input.classList.add('nf-state-valid');
      hint.textContent = 'Chave de acesso válida.';
    }
  }

  // ── valor monetário: mascara como o usuário já vê em ERPs (dígitos = centavos) ──
  function fmtMoneyInput(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseMoneyInput(str) {
    const digits = (str || '').replace(/\D/g, '');
    return digits ? Number(digits) / 100 : 0;
  }
  function maskMoneyValue(str) {
    const digits = (str || '').replace(/\D/g, '').slice(0, 13);
    return fmtMoneyInput(digits ? Number(digits) / 100 : 0);
  }

  // ── cards de upload: input[type=file] oculto continua sendo a fonte da verdade
  // (handleFormSave lê document.getElementById('nf_xml').files[0] sem mudar nada) ──
  function wireUploadCard(kind, validateFn) {
    const card = document.getElementById('nfCard_' + kind);
    const input = document.getElementById('nf_' + kind);
    const empty = card.querySelector('.nf-upload-empty');
    const filled = card.querySelector('.nf-upload-filled');
    const errBox = card.querySelector('.nf-upload-error');
    const nameEl = card.querySelector('.nf-upload-file-name');
    const sizeEl = card.querySelector('.nf-upload-file-size');

    function showEmpty() {
      errBox.textContent = ''; errBox.style.display = 'none'; card.classList.remove('nf-upload-error-state');
      empty.style.display = ''; filled.style.display = 'none';
    }
    function showFile(file) {
      errBox.textContent = ''; errBox.style.display = 'none'; card.classList.remove('nf-upload-error-state');
      nameEl.textContent = file.name;
      sizeEl.textContent = fmtBytes(file.size);
      empty.style.display = 'none'; filled.style.display = '';
    }
    function showError(msg) {
      errBox.textContent = msg; errBox.style.display = ''; card.classList.add('nf-upload-error-state');
      empty.style.display = ''; filled.style.display = 'none';
    }
    function assignFile(file) {
      if (!file) { showEmpty(); return; }
      const err = validateFn(file);
      if (err) { showError(err); input.value = ''; return; }
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      showFile(file);
    }

    card.querySelector('.nf-upload-pick').addEventListener('click', () => input.click());
    card.querySelector('.nf-upload-change').addEventListener('click', () => input.click());
    card.querySelector('.nf-upload-remove').addEventListener('click', () => { input.value = ''; showEmpty(); });
    input.addEventListener('change', () => assignFile(input.files[0]));

    ['dragenter', 'dragover'].forEach(ev => card.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); card.classList.add('nf-upload-dragging'); }));
    ['dragleave', 'dragend'].forEach(ev => card.addEventListener(ev, (e) => { e.preventDefault(); card.classList.remove('nf-upload-dragging'); }));
    card.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation();
      card.classList.remove('nf-upload-dragging');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) assignFile(file);
    });

    return { reset: showEmpty };
  }

  // ── wizard mobile: mesmos campos, só a visibilidade por etapa muda ──
  function isMobileStep() { return window.matchMedia(STEP_MEDIA).matches; }

  function renderStepUI() {
    const modal = document.getElementById('nfFormModal');
    const mobile = isMobileStep();
    modal.classList.toggle('nf-wizard', mobile);
    if (!mobile) {
      document.querySelectorAll('.nf-section').forEach(s => s.classList.remove('nf-step-hidden'));
      document.getElementById('nfStepBack').style.display = 'none';
      document.getElementById('nfStepNext').style.display = 'none';
      document.getElementById('nfFormSave').style.display = '';
      return;
    }
    document.querySelectorAll('.nf-section').forEach(s => {
      s.classList.toggle('nf-step-hidden', Number(s.dataset.step) !== _step);
    });
    document.getElementById('nfStepProgress').innerHTML =
      `<div class="nf-step-progress-txt">Etapa ${_step} de 5 — ${STEP_TITLES[_step - 1]}</div>
       <div class="nf-step-dots">${STEP_TITLES.map((t, i) => `<span class="nf-step-dot ${i + 1 === _step ? 'active' : ''} ${i + 1 < _step ? 'done' : ''}"></span>`).join('')}</div>`;
    document.getElementById('nfStepBack').style.display = _step > 1 ? '' : 'none';
    document.getElementById('nfStepNext').style.display = _step < 5 ? '' : 'none';
    document.getElementById('nfFormSave').style.display = _step === 5 ? '' : 'none';
  }

  function goToStep(n) {
    _step = Math.min(5, Math.max(1, n));
    renderStepUI();
    const body = document.getElementById('nfFormBody');
    if (body) body.scrollTop = 0;
  }

  const ORDER_STATUS_LABELS = { aguardando_pagamento: 'Aguardando Pagamento', pago: 'Pago', preparando: 'Em Preparação', enviado: 'Em Transporte', entregue: 'Entregue', cancelado: 'Cancelado' };
  const ORDER_STATUS_COLORS = { aguardando_pagamento: 'amber', pago: 'blue', preparando: 'blue', enviado: 'blue', entregue: 'green', cancelado: 'red' };

  function renderOrderRef(order) {
    const wrap = document.getElementById('nfOrderRef');
    const produtos = (order.items || []).map(i => i.qty + 'x ' + i.product_name_snapshot).join(', ') || '—';
    const statusLabel = order.status ? (ORDER_STATUS_LABELS[order.status] || order.status) : null;
    const statusColor = order.status ? (ORDER_STATUS_COLORS[order.status] || 'gray') : 'gray';
    wrap.innerHTML = `
      <div class="nf-ref-card">
        <div class="nf-ref-card-head">
          <span>Pedido #${order.order_number || order.id}</span>
          ${statusLabel ? `<span class="status-pill ${statusColor}">${statusLabel}</span>` : ''}
        </div>
        <div class="nf-ref-card-body">
          <div class="nf-ref-item"><div class="nf-ref-lbl">Cliente</div><div class="nf-ref-val">${order.profiles ? order.profiles.full_name : 'Visitante'}</div></div>
          <div class="nf-ref-item"><div class="nf-ref-lbl">CPF/CNPJ</div><div class="nf-ref-val">${(order.profiles && order.profiles.cpf) || '—'}</div></div>
          <div class="nf-ref-item span2"><div class="nf-ref-lbl">Produtos</div><div class="nf-ref-val">${produtos}</div></div>
          <div class="nf-ref-item"><div class="nf-ref-lbl">Valor</div><div class="nf-ref-val">${fmtBRL(order.total)}</div></div>
          <div class="nf-ref-item"><div class="nf-ref-lbl">Data</div><div class="nf-ref-val">${order.created_at ? fmtDate(order.created_at.slice(0, 10)) : '—'}</div></div>
        </div>
      </div>`;
    wrap.style.display = '';
  }

  function applyOrderToForm(order) {
    _formCtx.order = order;
    _formCtx.orderId = order.id;
    renderOrderRef(order);
    AdminShell.toast('Pedido localizado.', 'success');
  }

  async function pickOrder(order) {
    document.getElementById('nfOrderResults').classList.remove('open');
    document.getElementById('nf_order_search').value = '#' + (order.order_number || order.id) + (order.profiles ? ' — ' + order.profiles.full_name : '');
    const full = await fetchOrderFull(order.id);
    if (full) applyOrderToForm(full);
  }

  // Busca sem alterar o banco: número do pedido (ilike direto) + nome/CPF do
  // cliente (busca em profiles, depois os pedidos desses clientes) — evita o
  // filtro de recurso aninhado do PostgREST (profiles.full_name.ilike via
  // !inner), que excluiria pedidos de visitante sem conta dos resultados.
  async function searchOrders(term) {
    const clean = term.trim();
    const numTerm = clean.replace(/^#/, '');
    const digits = clean.replace(/\D/g, '');
    const cols = 'id,order_number,total,status,created_at,profiles(full_name,cpf)';
    const [byNumber, byProfile] = await Promise.all([
      window.sb.from('orders').select(cols)
        .ilike('order_number', '%' + numTerm + '%').order('created_at', { ascending: false }).limit(8),
      window.sb.from('profiles').select('id')
        .or(`full_name.ilike.%${clean}%,cpf.ilike.%${digits || clean}%`).limit(8),
    ]);
    const results = new Map();
    (byNumber.data || []).forEach(o => results.set(o.id, o));
    const profileIds = (byProfile.data || []).map(p => p.id);
    if (profileIds.length) {
      const { data: byUser } = await window.sb.from('orders').select(cols)
        .in('user_id', profileIds).order('created_at', { ascending: false }).limit(8);
      (byUser || []).forEach(o => results.set(o.id, o));
    }
    return Array.from(results.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }

  function wireOrderSearch() {
    const input = document.getElementById('nf_order_search');
    const results = document.getElementById('nfOrderResults');
    let timer = null;
    input.oninput = () => {
      clearTimeout(timer);
      const term = input.value.trim();
      if (!term) { results.classList.remove('open'); return; }
      timer = setTimeout(async () => {
        const list = await searchOrders(term);
        results.innerHTML = list.length
          ? list.map(o => {
              const statusLabel = ORDER_STATUS_LABELS[o.status] || o.status;
              const statusColor = ORDER_STATUS_COLORS[o.status] || 'gray';
              return `<div class="nf-order-item" data-id="${o.id}">
                <div class="nf-order-item-main">
                  <div class="nf-order-item-num">#${o.order_number || o.id} <span class="status-pill ${statusColor}" style="font-size:9px;">${statusLabel}</span></div>
                  <div class="nf-order-item-cli">${o.profiles ? o.profiles.full_name : 'Visitante'}</div>
                  <div class="nf-order-item-doc">${(o.profiles && o.profiles.cpf) || '—'}</div>
                </div>
                <div class="nf-order-item-side">
                  <div class="nf-order-item-val">${fmtBRL(o.total)}</div>
                  <div class="nf-order-item-date">${o.created_at ? fmtDate(o.created_at.slice(0, 10)) : ''}</div>
                </div>
              </div>`;
            }).join('')
          : '<div class="nf-order-empty">Nenhum pedido encontrado.</div>';
        results.classList.add('open');
        results.querySelectorAll('.nf-order-item[data-id]').forEach(el => {
          el.addEventListener('click', () => { const o = list.find(x => String(x.id) === el.dataset.id); if (o) pickOrder(o); });
        });
      }, 300);
    };
  }

  function fillFormFields(invoice) {
    document.getElementById('nf_numero').value = invoice.numero_nfe || '';
    document.getElementById('nf_serie').value = invoice.serie || '';
    document.getElementById('nf_chave').value = fmtChave(invoice.chave_acesso || '');
    updateChaveState();
    document.getElementById('nf_emissao').value = invoice.data_emissao || '';
    document.getElementById('nf_valor').value = invoice.valor_total ? fmtMoneyInput(invoice.valor_total) : '';
    document.getElementById('nf_saida').value = invoice.data_saida || '';
    document.getElementById('nf_natureza').value = invoice.natureza_operacao || '';
    document.getElementById('nf_protocolo').value = invoice.protocolo_autorizacao || '';
    document.getElementById('nf_emit_doc').value = invoice.emitente_documento || '';
    document.getElementById('nf_emit_nome').value = invoice.emitente_nome || '';
    document.getElementById('nf_obs').value = invoice.observacoes || '';
  }

  function clearFormFields() {
    ['nf_numero', 'nf_serie', 'nf_chave', 'nf_emissao', 'nf_valor', 'nf_saida', 'nf_natureza', 'nf_protocolo', 'nf_emit_doc', 'nf_emit_nome', 'nf_obs']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('nf_xml').value = '';
    document.getElementById('nf_pdf').value = '';
    if (_xmlCardCtl) _xmlCardCtl.reset();
    if (_pdfCardCtl) _pdfCardCtl.reset();
    updateChaveState();
  }

  function openFormModal(opts) {
    ensureStyles(); ensureFormModal();
    opts = opts || {};
    _formCtx = { orderId: opts.orderId || (opts.order && opts.order.id) || null, order: opts.order || null, invoice: opts.invoice || null, onSaved: opts.onSaved, onClosed: opts.onClosed };

    clearFormFields();
    const isEdit = !!_formCtx.invoice;
    document.getElementById('nfFormTitle').textContent = isEdit ? 'Editar Nota Fiscal' : 'Adicionar NF-e';
    document.getElementById('nfFormSave').textContent = isEdit ? 'Salvar alterações' : 'Adicionar NF-e';
    document.querySelector('.nf-section[data-step="3"]').style.display = isEdit ? 'none' : '';
    document.getElementById('nf_xml').required = !isEdit;
    document.getElementById('nf_pdf').required = !isEdit;

    const hasLockedOrder = !!(_formCtx.orderId);
    document.getElementById('nfOrderPickWrap').style.display = hasLockedOrder ? 'none' : '';
    document.getElementById('nfOrderLocked').style.display = hasLockedOrder ? '' : 'none';
    document.getElementById('nfOrderRef').style.display = 'none';

    if (isEdit) {
      fillFormFields(_formCtx.invoice);
    } else {
      // Não existe cadastro de "dados da empresa" no projeto — pra reduzir
      // digitação, lembra o último emitente usado com sucesso (só no modo
      // criar, só pré-preenche o que ficar vazio).
      try {
        const cached = JSON.parse(localStorage.getItem('alfa_nf_emitente') || 'null');
        if (cached) {
          document.getElementById('nf_emit_nome').value = cached.nome || '';
          document.getElementById('nf_emit_doc').value = cached.doc || '';
        }
      } catch (e) { /* localStorage indisponível/corrompido — segue sem pré-preencher */ }
    }

    if (hasLockedOrder) {
      const showOrder = (order) => {
        document.getElementById('nfOrderLockedTxt').textContent = '#' + (order.order_number || order.id) + ' — ' + (order.profiles ? order.profiles.full_name : 'Visitante');
        renderOrderRef(order);
      };
      if (_formCtx.order && _formCtx.order.items) { showOrder(_formCtx.order); }
      else {
        fetchOrderFull(_formCtx.orderId).then(order => { if (order) { _formCtx.order = order; showOrder(order); } });
      }
    } else {
      document.getElementById('nf_order_search').value = '';
      document.getElementById('nfOrderResults').classList.remove('open');
      wireOrderSearch();
    }

    _step = 1;
    renderStepUI();

    document.getElementById('nfFormModal').classList.add('open');

    document.getElementById('nfFormSave').onclick = () => handleFormSave();
  }

  function setFormDisabled(disabled) {
    document.querySelectorAll('#nfFormModal input, #nfFormModal select, #nfFormModal textarea, #nfFormModal button')
      .forEach(el => { el.disabled = disabled; });
  }

  async function handleFormSave() {
    const saveBtn = document.getElementById('nfFormSave');
    if (saveBtn.disabled) return;

    if (!_formCtx.orderId) {
      AdminShell.toast('Selecione o pedido vinculado.', 'error');
      if (isMobileStep()) goToStep(1);
      return;
    }

    const payload = {
      pedido_id: _formCtx.orderId,
      numero_nfe: document.getElementById('nf_numero').value.trim(),
      serie: document.getElementById('nf_serie').value.trim(),
      chave_acesso: document.getElementById('nf_chave').value,
      data_emissao: document.getElementById('nf_emissao').value,
      valor_total: parseMoneyInput(document.getElementById('nf_valor').value),
      data_saida: document.getElementById('nf_saida').value || null,
      natureza_operacao: document.getElementById('nf_natureza').value.trim() || null,
      protocolo_autorizacao: document.getElementById('nf_protocolo').value.trim() || null,
      emitente_documento: document.getElementById('nf_emit_doc').value.trim() || null,
      emitente_nome: document.getElementById('nf_emit_nome').value.trim() || null,
      observacoes: document.getElementById('nf_obs').value.trim() || null,
    };

    if (!payload.numero_nfe || !payload.serie || !payload.data_emissao || !payload.valor_total) {
      AdminShell.toast('Preencha todos os campos obrigatórios.', 'error');
      if (isMobileStep()) goToStep(2);
      return;
    }

    // normaliza aqui (não só dentro de createInvoice) porque o modo "editar
    // informações" também passa por este payload, e o campo na tela sempre
    // mostra a chave formatada com espaços.
    const chave = validateChave(payload.chave_acesso);
    if (!chave.valid) {
      AdminShell.toast(chave.error, 'error');
      updateChaveState(chave.error);
      if (isMobileStep()) goToStep(2);
      return;
    }
    payload.chave_acesso = chave.digits;

    // cliente_nome/cliente_documento são um retrato do pedido no momento do
    // CADASTRO da nota — editar outros campos depois (ex: observações) não
    // deve re-puxar o perfil atual do cliente e mudar esse retrato de lado.
    const order = _formCtx.order;
    if (order && !_formCtx.invoice) {
      payload.cliente_nome = order.profiles ? order.profiles.full_name : 'Visitante';
      payload.cliente_documento = order.profiles ? order.profiles.cpf : null;
    }

    const isEdit = !!_formCtx.invoice;
    saveBtn.disabled = true;
    const originalTxt = saveBtn.textContent;
    saveBtn.textContent = isEdit ? 'Salvando...' : 'Enviando arquivos e salvando...';
    setFormDisabled(true);
    document.querySelector('.nf-form-modal').classList.add('nf-saving');

    try {
      let saved;
      if (isEdit) {
        saved = await updateInvoiceFields(_formCtx.invoice, payload);
        AdminShell.toast('Nota fiscal atualizada com sucesso.', 'success');
      } else {
        const xmlFile = document.getElementById('nf_xml').files[0];
        const pdfFile = document.getElementById('nf_pdf').files[0];
        saved = await createInvoice(payload, xmlFile, pdfFile);
        AdminShell.toast('NF-e adicionada com sucesso.', 'success');
        if (payload.emitente_nome || payload.emitente_documento) {
          try { localStorage.setItem('alfa_nf_emitente', JSON.stringify({ nome: payload.emitente_nome, doc: payload.emitente_documento })); }
          catch (e) { /* ignora */ }
        }
      }
      document.getElementById('nfFormModal').classList.remove('open');
      const cb = _formCtx.onSaved; const closedCb = _formCtx.onClosed;
      _formCtx = null;
      if (cb) cb(saved);
      else if (closedCb) closedCb();
    } catch (err) {
      const msg = err.message || 'Não foi possível completar a operação. Tente novamente.';
      AdminShell.toast(msg, 'error');
      if (/chave de acesso/i.test(msg)) { updateChaveState(msg); if (isMobileStep()) goToStep(2); }
      else if (/XML|PDF/.test(msg) && isMobileStep()) { goToStep(3); }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalTxt;
      setFormDisabled(false);
      document.querySelector('.nf-form-modal').classList.remove('nf-saving');
    }
  }

  // ── modal: substituir arquivos ──────────────────────────────────────────
  function ensureReplaceModal() {
    if (document.getElementById('nfReplaceModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="nfReplaceModal">
        <div class="modal" style="max-width:480px;">
          <div class="modal-head"><div class="modal-title">Substituir arquivos</div><button class="modal-close" id="nfReplaceClose">✕</button></div>
          <div class="field-hint" style="margin-bottom:14px;">Os arquivos atuais só serão apagados depois que os novos forem enviados e salvos com sucesso.</div>
          <div class="field"><label>Novo arquivo XML *</label><input type="file" accept=".xml,text/xml,application/xml" id="nfr_xml"><div class="field-hint">Até 5 MB.</div></div>
          <div class="field"><label>Novo arquivo PDF/DANFE *</label><input type="file" accept=".pdf,application/pdf" id="nfr_pdf"><div class="field-hint">Até 15 MB.</div></div>
          <div class="modal-foot">
            <button class="btn btn-secondary" id="nfReplaceCancel">Cancelar</button>
            <button class="btn btn-primary" id="nfReplaceSave">Substituir</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('nfReplaceClose').addEventListener('click', closeReplaceModal);
    document.getElementById('nfReplaceCancel').addEventListener('click', closeReplaceModal);
  }
  let _replaceCtx = null;
  function closeReplaceModal() {
    document.getElementById('nfReplaceModal').classList.remove('open');
    if (_replaceCtx && _replaceCtx.onClosed) _replaceCtx.onClosed();
    _replaceCtx = null;
  }
  function openReplaceModal(invoice, onSaved, onClosed) {
    ensureStyles(); ensureReplaceModal();
    _replaceCtx = { invoice, onSaved, onClosed };
    document.getElementById('nfr_xml').value = '';
    document.getElementById('nfr_pdf').value = '';
    document.getElementById('nfReplaceModal').classList.add('open');
    document.getElementById('nfReplaceSave').onclick = async () => {
      const btn = document.getElementById('nfReplaceSave');
      if (btn.disabled) return;
      const xmlFile = document.getElementById('nfr_xml').files[0];
      const pdfFile = document.getElementById('nfr_pdf').files[0];
      btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Enviando...';
      try {
        const saved = await replaceInvoiceFiles(_replaceCtx.invoice, xmlFile, pdfFile);
        AdminShell.toast('Arquivos atualizados com sucesso.', 'success');
        document.getElementById('nfReplaceModal').classList.remove('open');
        const cb = _replaceCtx.onSaved; _replaceCtx = null;
        if (cb) cb(saved);
      } catch (err) {
        AdminShell.toast(err.message || 'Não foi possível enviar os arquivos. Tente novamente.', 'error');
      } finally { btn.disabled = false; btn.textContent = orig; }
    };
  }

  // ── modal: remover (confirmação) ────────────────────────────────────────
  function ensureDeleteModal() {
    if (document.getElementById('nfDeleteModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="nfDeleteModal">
        <div class="modal" style="max-width:440px;">
          <div class="modal-head"><div class="modal-title">Remover NF-e</div><button class="modal-close" id="nfDeleteClose">✕</button></div>
          <div id="nfDeleteBody" style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;"></div>
          <div class="field"><label>Motivo (opcional)</label><textarea id="nf_del_motivo" rows="2"></textarea></div>
          <div class="modal-foot">
            <button class="btn btn-secondary" id="nfDeleteCancel">Cancelar</button>
            <button class="btn btn-danger" id="nfDeleteConfirm">Remover NF-e</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('nfDeleteClose').addEventListener('click', closeDeleteModal);
    document.getElementById('nfDeleteCancel').addEventListener('click', closeDeleteModal);
  }
  let _deleteCtx = null;
  function closeDeleteModal() {
    document.getElementById('nfDeleteModal').classList.remove('open');
    if (_deleteCtx && _deleteCtx.onClosed) _deleteCtx.onClosed();
    _deleteCtx = null;
  }
  function openDeleteModal(invoice, orderNumber, onDeleted, onClosed) {
    ensureStyles(); ensureDeleteModal();
    _deleteCtx = { invoice, onDeleted, onClosed };
    document.getElementById('nfDeleteBody').innerHTML =
      `Tem certeza que deseja remover a NF-e <b>${invoice.numero_nfe}</b>, vinculada ao pedido <b>#${orderNumber || invoice.pedido_id}</b>?
       Os arquivos XML e PDF também serão removidos do armazenamento. Essa ação não pode ser desfeita.`;
    document.getElementById('nf_del_motivo').value = '';
    document.getElementById('nfDeleteModal').classList.add('open');
    document.getElementById('nfDeleteConfirm').onclick = async () => {
      const btn = document.getElementById('nfDeleteConfirm');
      if (btn.disabled) return;
      btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Removendo...';
      try {
        await softDeleteInvoice(invoice, document.getElementById('nf_del_motivo').value.trim());
        AdminShell.toast('NF-e removida com sucesso.', 'success');
        document.getElementById('nfDeleteModal').classList.remove('open');
        const cb = _deleteCtx.onDeleted; _deleteCtx = null;
        if (cb) cb();
      } catch (err) {
        AdminShell.toast(err.message || 'Não foi possível remover a NF-e. Tente novamente.', 'error');
      } finally { btn.disabled = false; btn.textContent = orig; }
    };
  }

  // ── modal: detalhe (somente leitura + ações) ─────────────────────────────
  function ensureDetailModal() {
    if (document.getElementById('nfDetailModal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay" id="nfDetailModal">
        <div class="modal" style="max-width:620px;">
          <div class="modal-head"><div class="modal-title">Nota Fiscal</div><button class="modal-close" id="nfDetailClose">✕</button></div>
          <div id="nfDetailBody"></div>
          <div class="modal-foot" id="nfDetailFoot"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById('nfDetailClose').addEventListener('click', closeDetailModal);
  }
  let _detailCtx = null;
  function closeDetailModal() {
    document.getElementById('nfDetailModal').classList.remove('open');
    if (_detailCtx && _detailCtx.opts && _detailCtx.opts.onClosed) _detailCtx.opts.onClosed();
    _detailCtx = null;
  }
  // Usado ao trocar pro modal de editar/substituir/remover: só esconde, sem
  // disparar onClosed — quem decide reabrir o pedido por trás é o PRÓXIMO
  // modal (via onSaved/onClosed dele), senão os dois ficam empilhados juntos.
  function hideDetailModalSilently() {
    document.getElementById('nfDetailModal').classList.remove('open');
    _detailCtx = null;
  }

  function openDetailModal(invoice, orderNumber, opts) {
    ensureStyles(); ensureDetailModal();
    opts = opts || {};
    _detailCtx = { invoice, orderNumber, opts };
    renderDetailModal();
    document.getElementById('nfDetailModal').classList.add('open');
  }

  function renderDetailModal() {
    const { invoice, orderNumber, opts } = _detailCtx;
    const canManage = AdminShell.can('notas_fiscais.gerenciar');
    const canDelete = AdminShell.can('notas_fiscais.excluir');

    document.getElementById('nfDetailBody').innerHTML = `
      <div style="margin-bottom:14px;"><span class="status-pill ${STATUS_COLORS[invoice.status] || 'gray'}">${STATUS_LABELS[invoice.status] || invoice.status}</span></div>
      <div class="nf-detail-grid">
        <div><div class="dl">Número</div><div class="dv">${invoice.numero_nfe}</div></div>
        <div><div class="dl">Série</div><div class="dv">${invoice.serie}</div></div>
        <div style="grid-column:1/-1;"><div class="dl">Chave de acesso</div><div class="dv" style="font-family:monospace;font-size:12px;">${fmtChave(invoice.chave_acesso)}</div></div>
        <div><div class="dl">Pedido</div><div class="dv">#${orderNumber || invoice.pedido_id}</div></div>
        <div><div class="dl">Valor total</div><div class="dv">${fmtBRL(invoice.valor_total)}</div></div>
        <div><div class="dl">Data de emissão</div><div class="dv">${fmtDate(invoice.data_emissao)}</div></div>
        <div><div class="dl">Data de saída</div><div class="dv">${fmtDate(invoice.data_saida)}</div></div>
        <div><div class="dl">Cliente</div><div class="dv">${invoice.cliente_nome || '—'}</div></div>
        <div><div class="dl">CPF/CNPJ</div><div class="dv">${invoice.cliente_documento || '—'}</div></div>
        ${invoice.natureza_operacao ? `<div><div class="dl">Natureza da operação</div><div class="dv">${invoice.natureza_operacao}</div></div>` : ''}
        ${invoice.protocolo_autorizacao ? `<div><div class="dl">Protocolo de autorização</div><div class="dv">${invoice.protocolo_autorizacao}</div></div>` : ''}
        ${invoice.emitente_nome ? `<div><div class="dl">Emitente</div><div class="dv">${invoice.emitente_nome}</div></div>` : ''}
        ${invoice.emitente_documento ? `<div><div class="dl">CNPJ do emitente</div><div class="dv">${invoice.emitente_documento}</div></div>` : ''}
      </div>
      ${invoice.observacoes ? `<div class="field"><label>Observações</label><div style="font-size:13px;color:var(--text-secondary);">${invoice.observacoes}</div></div>` : ''}
      <div class="nf-file-row"><span>📄 ${invoice.xml_nome_original || 'nfe.xml'} ${fmtBytes(invoice.xml_tamanho)}</span><button class="btn btn-secondary btn-sm" id="nfDlXml">Baixar XML</button></div>
      <div class="nf-file-row"><span>📄 ${invoice.pdf_nome_original || 'danfe.pdf'} ${fmtBytes(invoice.pdf_tamanho)}</span>
        <span style="display:flex;gap:6px;"><button class="btn btn-secondary btn-sm" id="nfViewPdf">Visualizar</button><button class="btn btn-secondary btn-sm" id="nfDlPdf">Baixar</button></span></div>
      <div class="field-hint">Anexada em ${fmtDateTime(invoice.created_at)}${invoice.updated_at !== invoice.created_at ? ' · Atualizada em ' + fmtDateTime(invoice.updated_at) : ''}</div>
    `;

    document.getElementById('nfDetailFoot').innerHTML = `
      ${opts.orderHref ? `<a class="btn btn-secondary" href="${opts.orderHref}">Abrir pedido</a>` : ''}
      ${canManage ? '<button class="btn btn-secondary" id="nfDetailEdit">Editar informações</button>' : ''}
      ${canManage ? '<button class="btn btn-secondary" id="nfDetailReplace">Substituir arquivos</button>' : ''}
      ${canDelete ? '<button class="btn btn-danger" id="nfDetailDelete">Remover NF-e</button>' : ''}
    `;

    document.getElementById('nfDlXml').addEventListener('click', async (e) => {
      const btn = e.target; btn.disabled = true;
      try { await downloadFile(invoice.xml_storage_path, invoice.xml_nome_original || 'nfe.xml'); }
      catch (err) { AdminShell.toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
    document.getElementById('nfDlPdf').addEventListener('click', async (e) => {
      const btn = e.target; btn.disabled = true;
      try { await downloadFile(invoice.pdf_storage_path, invoice.pdf_nome_original || 'danfe.pdf'); }
      catch (err) { AdminShell.toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });
    document.getElementById('nfViewPdf').addEventListener('click', async (e) => {
      const btn = e.target; btn.disabled = true;
      try { const url = await getSignedUrl(invoice.pdf_storage_path); window.open(url, '_blank', 'noopener'); }
      catch (err) { AdminShell.toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    });

    const editBtn = document.getElementById('nfDetailEdit');
    if (editBtn) editBtn.addEventListener('click', () => {
      hideDetailModalSilently();
      openFormModal({
        orderId: invoice.pedido_id, invoice,
        onSaved: (saved) => { if (opts.onChanged) opts.onChanged(saved); },
        onClosed: () => { if (opts.onChanged) opts.onChanged(null); },
      });
    });

    const replaceBtn = document.getElementById('nfDetailReplace');
    if (replaceBtn) replaceBtn.addEventListener('click', () => {
      hideDetailModalSilently();
      openReplaceModal(invoice,
        (saved) => { if (opts.onChanged) opts.onChanged(saved); },
        () => { if (opts.onChanged) opts.onChanged(null); });
    });

    const deleteBtn = document.getElementById('nfDetailDelete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      hideDetailModalSilently();
      openDeleteModal(invoice, orderNumber,
        () => { if (opts.onChanged) opts.onChanged(null); },
        () => { if (opts.onChanged) opts.onChanged(null); });
    });
  }

  // ── seção "Nota Fiscal" dentro do detalhe do pedido (admin-pedidos.html) ──
  async function renderOrderSection(container, order, hooks) {
    hooks = hooks || {};
    ensureStyles();
    container.innerHTML = '<div class="field-hint">Carregando...</div>';
    const invoice = await fetchInvoiceForOrder(order.id);
    const canManage = AdminShell.can('notas_fiscais.gerenciar');

    const refresh = async () => {
      const fresh = await fetchInvoiceForOrder(order.id);
      renderSection(fresh);
      if (hooks.onChanged) hooks.onChanged(!!fresh);
    };

    function renderSection(inv) {
      if (!inv) {
        container.innerHTML = `
          <div class="nf-empty-box">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div><span class="status-pill gray">NF-e não anexada</span></div>
            <p style="margin-top:8px;">Este pedido ainda não tem uma nota fiscal cadastrada.</p>
            ${canManage ? '<button class="btn btn-primary btn-sm" id="nfAddBtn">Adicionar NF-e</button>' : ''}
          </div>`;
        const addBtn = document.getElementById('nfAddBtn');
        if (addBtn) addBtn.addEventListener('click', () => {
          if (hooks.onBeforeSubModal) hooks.onBeforeSubModal();
          openFormModal({
            orderId: order.id, order,
            onSaved: async () => { await refresh(); if (hooks.onAfterSubModal) hooks.onAfterSubModal(); },
            onClosed: () => { if (hooks.onAfterSubModal) hooks.onAfterSubModal(); },
          });
        });
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom:10px;"><span class="status-pill ${STATUS_COLORS[inv.status] || 'gray'}">${STATUS_LABELS[inv.status] || inv.status}</span></div>
        <div class="detail-line"><b>Número:</b> ${inv.numero_nfe} (série ${inv.serie})</div>
        <div class="detail-line"><b>Chave de acesso:</b> <span style="font-family:monospace;font-size:11.5px;">${fmtChave(inv.chave_acesso)}</span></div>
        <div class="detail-line"><b>Emissão:</b> ${fmtDate(inv.data_emissao)} · <b>Valor:</b> ${fmtBRL(inv.valor_total)}</div>
        <div class="detail-line"><b>Cliente:</b> ${inv.cliente_nome || '—'} (${inv.cliente_documento || '—'})</div>
        ${inv.observacoes ? `<div class="detail-line"><b>Observações:</b> ${inv.observacoes}</div>` : ''}
        <div class="detail-line" style="color:var(--text-muted);font-size:11.5px;margin-top:6px;">Anexada em ${fmtDateTime(inv.created_at)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">
          <button class="btn btn-secondary btn-sm" id="nfSecView">Ver detalhes</button>
        </div>`;

      document.getElementById('nfSecView').addEventListener('click', () => {
        if (hooks.onBeforeSubModal) hooks.onBeforeSubModal();
        openDetailModal(inv, order.order_number, {
          onChanged: async () => { await refresh(); if (hooks.onAfterSubModal) hooks.onAfterSubModal(); },
          onClosed: () => { if (hooks.onAfterSubModal) hooks.onAfterSubModal(); },
        });
      });
    }

    renderSection(invoice);
    if (hooks.onChanged) hooks.onChanged(!!invoice);
  }

  return {
    STATUS_LABELS, STATUS_COLORS,
    fmtBRL, fmtDate, fmtDateTime, fmtBytes, fmtChave, onlyDigits, validateChave,
    validateXmlFile, validatePdfFile, friendlyError,
    getSignedUrl, downloadFile,
    fetchInvoiceForOrder, fetchOrderFull,
    createInvoice, updateInvoiceFields, replaceInvoiceFiles, softDeleteInvoice,
    renderStatusBadge, renderOrderSection,
    openFormModal, openDetailModal, openReplaceModal, openDeleteModal,
  };
})();
