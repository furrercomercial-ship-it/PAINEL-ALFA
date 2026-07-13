/* Alfa Informática — Date Range Picker compartilhado (Dashboard, Estoque).
   Sem biblioteca de calendário nova: presets nomeados + dois <input
   type="date"> nativos pro período personalizado. AdminDateRange.mount(el,
   onChange, opts) monta o controle dentro de `el` e chama onChange({start,
   end, key, label}) sempre que o período muda. */
window.AdminDateRange = (function () {
  var PRESETS = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'ontem', label: 'Ontem' },
    { key: '7d', label: 'Últimos 7 dias' },
    { key: '30d', label: 'Últimos 30 dias' },
    { key: '90d', label: 'Últimos 90 dias' },
    { key: 'mes', label: 'Este mês' },
    { key: 'mes_passado', label: 'Mês passado' },
    { key: 'ano', label: 'Este ano' },
    { key: 'custom', label: 'Período personalizado' },
  ];

  function startOfDay(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function endOfDay(d) { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
  function fmtInput(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  function rangeFor(key) {
    var now = new Date();
    if (key === 'hoje') return { start: startOfDay(now), end: endOfDay(now) };
    if (key === 'ontem') { var y = new Date(now); y.setDate(y.getDate() - 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    if (key === '7d') return { start: startOfDay(new Date(now.getTime() - 6 * 86400000)), end: endOfDay(now) };
    if (key === '30d') return { start: startOfDay(new Date(now.getTime() - 29 * 86400000)), end: endOfDay(now) };
    if (key === '90d') return { start: startOfDay(new Date(now.getTime() - 89 * 86400000)), end: endOfDay(now) };
    if (key === 'mes') return { start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), end: endOfDay(now) };
    if (key === 'mes_passado') {
      var s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    if (key === 'ano') return { start: startOfDay(new Date(now.getFullYear(), 0, 1)), end: endOfDay(now) };
    return null; // 'custom' é resolvido a partir dos inputs de data, não daqui
  }

  function mount(container, onChange, opts) {
    opts = opts || {};
    var state = { key: opts.initialKey || '7d' };

    function customRange() {
      var s = container.querySelector('#adrStart'), e = container.querySelector('#adrEnd');
      if (!s || !e || !s.value || !e.value) return null;
      return { start: startOfDay(new Date(s.value + 'T00:00:00')), end: endOfDay(new Date(e.value + 'T00:00:00')) };
    }

    function currentRange() {
      return state.key === 'custom' ? customRange() : rangeFor(state.key);
    }

    function fire() {
      var r = currentRange();
      if (!r) return;
      var preset = PRESETS.filter(function (p) { return p.key === state.key; })[0];
      onChange({ start: r.start, end: r.end, key: state.key, label: preset ? preset.label : '' });
    }

    function render() {
      var last7 = rangeFor('7d');
      container.innerHTML =
        '<select class="adr-select" id="adrSelect">' + PRESETS.map(function (p) {
          return '<option value="' + p.key + '"' + (p.key === state.key ? ' selected' : '') + '>' + p.label + '</option>';
        }).join('') + '</select>' +
        '<div class="adr-custom" id="adrCustom" style="' + (state.key === 'custom' ? '' : 'display:none;') + '">' +
          '<input type="date" id="adrStart" value="' + fmtInput(last7.start) + '">' +
          '<span>até</span>' +
          '<input type="date" id="adrEnd" value="' + fmtInput(new Date()) + '">' +
        '</div>';

      container.querySelector('#adrSelect').addEventListener('change', function (e) {
        state.key = e.target.value;
        container.querySelector('#adrCustom').style.display = state.key === 'custom' ? 'flex' : 'none';
        if (state.key !== 'custom') fire();
      });
      container.querySelector('#adrStart').addEventListener('change', function () { if (state.key === 'custom') fire(); });
      container.querySelector('#adrEnd').addEventListener('change', function () { if (state.key === 'custom') fire(); });
    }

    render();
    fire();

    return {
      setKey: function (key) { state.key = key; render(); fire(); },
      getRange: currentRange,
    };
  }

  return { mount: mount, rangeFor: rangeFor, PRESETS: PRESETS };
})();
