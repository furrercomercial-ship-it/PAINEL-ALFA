/* Alfa Informática — Helper de upload de imagem (Supabase Storage, bucket "site-assets") */
window.AdminUpload = (function () {
  async function uploadImage(file, folder) {
    if (!file) return null;
    const safeName = file.name.replace(/[^a-z0-9.]/gi, '_');
    const path = folder + '/' + Date.now() + '-' + safeName;
    const { error } = await window.sb.storage.from('site-assets').upload(path, file, { upsert: true });
    if (error) { alert('Erro ao enviar imagem: ' + error.message); return null; }
    const { data } = window.sb.storage.from('site-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  // Monta um campo de upload com preview dentro do elemento alvo.
  // onUploaded(url) é chamado quando o upload termina.
  function mountField(container, folder, currentUrl, onUploaded) {
    container.innerHTML = `
      <div class="upload-field">
        <div class="upload-preview">${currentUrl ? `<img src="${currentUrl}" alt="">` : '<span class="upload-empty">Sem imagem</span>'}</div>
        <label class="btn btn-secondary btn-sm upload-btn">
          Escolher imagem
          <input type="file" accept="image/*" style="display:none">
        </label>
        ${currentUrl ? '<button type="button" class="btn btn-secondary btn-sm" data-remove>Remover</button>' : ''}
        <div class="upload-status"></div>
      </div>`;
    const input = container.querySelector('input[type=file]');
    const preview = container.querySelector('.upload-preview');
    const status = container.querySelector('.upload-status');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      status.textContent = 'Enviando...';
      const url = await uploadImage(file, folder);
      status.textContent = '';
      if (url) {
        onUploaded(url);
        mountField(container, folder, url, onUploaded);
      }
    });
    const removeBtn = container.querySelector('[data-remove]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        onUploaded('');
        mountField(container, folder, '', onUploaded);
      });
    }
  }

  return { uploadImage, mountField };
})();
