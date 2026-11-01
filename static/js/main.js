/* ══════════════════════════════════════════════════════════════
   DataViz – Main JavaScript
   All frontend logic: API calls, Chart.js rendering, UI state
══════════════════════════════════════════════════════════════ */

'use strict';

// ─── State ────────────────────────────────────────────────────
const state = {
  datasetLoaded: false,
  numericalCols: [],
  categoricalCols: [],
  allCols: [],
  filename: '',
  barChart: null,
  histChart: null,
  barOrientation: 'vertical',
  barPaletteIdx: 0,
  histPaletteIdx: 0,
  currentSection: 'overview',
};

// ─── Color Palettes ───────────────────────────────────────────
const PALETTES = [
  { bg: 'rgba(99,102,241,0.75)',   border: '#6366f1',  gradient: ['#6366f1','#818cf8'] },
  { bg: 'rgba(16,185,129,0.75)',   border: '#10b981',  gradient: ['#10b981','#34d399'] },
  { bg: 'rgba(245,158,11,0.75)',   border: '#f59e0b',  gradient: ['#f59e0b','#fbbf24'] },
  { bg: 'rgba(239,68,68,0.75)',    border: '#ef4444',  gradient: ['#ef4444','#f87171'] },
  { bg: 'rgba(20,184,166,0.75)',   border: '#14b8a6',  gradient: ['#14b8a6','#2dd4bf'] },
  { bg: 'rgba(168,85,247,0.75)',   border: '#a855f7',  gradient: ['#a855f7','#c084fc'] },
];

// multi-color for bar chart categories
const MULTI_COLORS = [
  'rgba(99,102,241,0.8)','rgba(16,185,129,0.8)','rgba(245,158,11,0.8)',
  'rgba(239,68,68,0.8)', 'rgba(20,184,166,0.8)','rgba(168,85,247,0.8)',
  'rgba(251,146,60,0.8)','rgba(236,72,153,0.8)','rgba(34,211,238,0.8)',
  'rgba(132,204,22,0.8)',
];
const MULTI_BORDERS = [
  '#6366f1','#10b981','#f59e0b','#ef4444','#14b8a6','#a855f7',
  '#fb923c','#ec4899','#22d3ee','#84cc16',
];

// ─── Chart.js Global Defaults ─────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';

// ══════════════════════════════════════════════════════════════
// UI Helpers
// ══════════════════════════════════════════════════════════════
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));

  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');

  const link = document.querySelector(`.nav-link[data-section="${name}"]`);
  if (link) link.classList.add('active');

  const labels = {
    overview: 'Dashboard Overview', upload: 'Dataset Upload',
    barchart: 'Bar Chart', histogram: 'Histogram',
    analysis: 'Data Analysis', export: 'Export & Download',
  };
  document.getElementById('currentSection').textContent = labels[name] || name;
  state.currentSection = name;

  // Trigger analysis load when switching to that tab if data loaded
  if (name === 'analysis' && state.datasetLoaded) loadAnalysis();

  // Show no-data notices
  ['bar','hist','analysis'].forEach(t => {
    const el = document.getElementById(`${t}NoData`);
    if (el) el.classList.toggle('d-none', state.datasetLoaded);
  });
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('mainContent');
  sb.classList.toggle('collapsed');
  mc.classList.toggle('sidebar-collapsed');
}

function showSpinner() { document.getElementById('spinnerOverlay').classList.remove('d-none'); }
function hideSpinner() { document.getElementById('spinnerOverlay').classList.add('d-none'); }

function showToast(message, type = 'info') {
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  t.innerHTML = `<i class="bi ${icons[type]}"></i><span>${message}</span>`;
  tc.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

function el(id) { return document.getElementById(id); }

// ══════════════════════════════════════════════════════════════
// Dataset Loading
// ══════════════════════════════════════════════════════════════
async function loadSampleDataset() {
  showSpinner();
  try {
    const res = await fetch('/api/load-sample', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      applyDatasetInfo(data.info, data.preview);
      showToast('Sample dataset loaded successfully!', 'success');
      showSection('overview');
    } else {
      showToast(data.error || 'Failed to load sample dataset', 'error');
    }
  } catch (e) {
    showToast('Network error: ' + e.message, 'error');
  } finally { hideSpinner(); }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) uploadFile(file);
}

function setupDropZone() {
  const dz = el('dropZone');
  dz.addEventListener('click', () => el('fileInput').click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
}

async function uploadFile(file) {
  const allowed = ['.csv', '.xlsx', '.xls'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showToast('Invalid file type. Please upload CSV or Excel files.', 'error');
    el('uploadError').textContent = 'Invalid file type. Please upload CSV or Excel files.';
    el('uploadError').classList.remove('d-none');
    return;
  }
  el('uploadError').classList.add('d-none');
  el('uploadProgress').classList.remove('d-none');
  el('progressFill').style.width = '0%';
  el('uploadStatusText').textContent = 'Uploading…';

  // Animate progress bar
  let prog = 0;
  const progInt = setInterval(() => {
    prog = Math.min(prog + 8, 85);
    el('progressFill').style.width = prog + '%';
  }, 80);

  const formData = new FormData();
  formData.append('file', file);

  showSpinner();
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    clearInterval(progInt);
    el('progressFill').style.width = '100%';
    el('uploadStatusText').textContent = data.success ? 'Upload complete!' : 'Upload failed.';

    if (data.success) {
      applyDatasetInfo(data.info, data.preview);
      showToast(`"${data.info.filename}" loaded — ${data.info.total_records} records`, 'success');
    } else {
      el('uploadError').textContent = data.error || 'Upload failed.';
      el('uploadError').classList.remove('d-none');
      showToast(data.error || 'Upload failed', 'error');
    }
  } catch (e) {
    clearInterval(progInt);
    showToast('Network error: ' + e.message, 'error');
  } finally {
    hideSpinner();
    setTimeout(() => el('uploadProgress').classList.add('d-none'), 2000);
  }
}

function applyDatasetInfo(info, preview) {
  state.datasetLoaded = true;
  state.numericalCols = info.numerical_columns;
  state.categoricalCols = info.categorical_columns;
  state.allCols = info.numerical_columns.concat(info.categorical_columns);
  state.filename = info.filename;

  // Update stat cards
  el('stat-records').textContent   = info.total_records.toLocaleString();
  el('stat-columns').textContent   = info.total_columns;
  el('stat-categorical').textContent = info.categorical_columns.length;
  el('stat-numerical').textContent   = info.numerical_columns.length;

  // Status bar
  const ds = el('datasetStatus');
  ds.innerHTML = `<i class="bi bi-database-fill-check"></i><span>${info.filename} (${info.total_records} rows)</span>`;
  ds.classList.add('loaded');

  // Overview section
  el('emptyState').classList.add('d-none');
  el('overviewLoaded').classList.remove('d-none');
  renderOverviewInfo(info);
  renderPreviewTable(preview, info.numerical_columns, 'previewTableHead', 'previewTableBody');

  // Upload section
  el('uploadedDataInfo').classList.remove('d-none');
  el('loadedFilename').textContent = info.filename;
  renderDatasetInfoCards(info);
  renderPreviewTable(preview, info.numerical_columns, 'uploadPreviewHead', 'uploadPreviewBody');
  renderColumnDetails(info.columns_info);

  // Populate chart selects
  populateBarSelect(info.categorical_columns);
  populateHistSelect(info.numerical_columns);

  // Hide no-data notices
  ['bar','hist','analysis'].forEach(t => {
    const nd = el(`${t}NoData`); if (nd) nd.classList.add('d-none');
  });
}

// ══════════════════════════════════════════════════════════════
// Render Helpers
// ══════════════════════════════════════════════════════════════
function renderOverviewInfo(info) {
  el('overviewDatasetInfo').innerHTML = `
    <div class="dataset-info-row mt-2"><span class="key">File</span><span class="val">${info.filename}</span></div>
    <div class="dataset-info-row"><span class="key">Total Records</span><span class="val">${info.total_records.toLocaleString()}</span></div>
    <div class="dataset-info-row"><span class="key">Total Columns</span><span class="val">${info.total_columns}</span></div>
    <div class="dataset-info-row"><span class="key">Numerical Variables</span><span class="val">${info.numerical_columns.length}</span></div>
    <div class="dataset-info-row"><span class="key">Categorical Variables</span><span class="val">${info.categorical_columns.length}</span></div>
    <div class="dataset-info-row"><span class="key">Total Missing</span><span class="val">${info.total_missing}</span></div>
  `;
  const colSummary = el('overviewColumnSummary');
  colSummary.innerHTML = '';
  info.columns_info.forEach(c => {
    colSummary.innerHTML += `<span class="col-badge ${c.type}">${c.name}</span>`;
  });
}

function renderDatasetInfoCards(info) {
  el('datasetInfoCards').innerHTML = `
    <div class="col-6 col-md-3"><div class="info-card"><div class="ic-val">${info.total_records.toLocaleString()}</div><div class="ic-lbl">Records</div></div></div>
    <div class="col-6 col-md-3"><div class="info-card"><div class="ic-val">${info.total_columns}</div><div class="ic-lbl">Columns</div></div></div>
    <div class="col-6 col-md-3"><div class="info-card"><div class="ic-val">${info.numerical_columns.length}</div><div class="ic-lbl">Numerical</div></div></div>
    <div class="col-6 col-md-3"><div class="info-card"><div class="ic-val">${info.total_missing}</div><div class="ic-lbl">Missing</div></div></div>
  `;
}

function renderPreviewTable(rows, numericalCols, headId, bodyId) {
  if (!rows || rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  el(headId).innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
  el(bodyId).innerHTML = rows.map(row =>
    '<tr>' + cols.map(c => {
      const val = row[c] === null || row[c] === undefined ? '<span style="color:#475569">null</span>' : row[c];
      return `<td title="${row[c]}">${val}</td>`;
    }).join('') + '</tr>'
  ).join('');
}

function renderColumnDetails(colsInfo) {
  el('columnDetailsBody').innerHTML = colsInfo.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><code style="color:#94a3b8;font-size:11px">${c.dtype}</code></td>
      <td><span class="badge-type ${c.type}">${c.type}</span></td>
      <td>${c.unique.toLocaleString()}</td>
      <td>${c.missing > 0 ? `<span style="color:#f87171;font-weight:700">${c.missing}</span>` : '<span style="color:#34d399">0</span>'}</td>
    </tr>
  `).join('');
}

function populateBarSelect(cols) {
  const sel = el('barColumnSelect');
  sel.innerHTML = '<option value="">-- Select Column --</option>';
  cols.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
}

function populateHistSelect(cols) {
  const sel = el('histColumnSelect');
  sel.innerHTML = '<option value="">-- Select Column --</option>';
  cols.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
}

// ══════════════════════════════════════════════════════════════
// BAR CHART
// ══════════════════════════════════════════════════════════════
async function updateBarChart() {
  const col = el('barColumnSelect').value;
  if (!col) return;
  showSpinner();
  try {
    const res = await fetch('/api/bar-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: col }),
    });
    const data = await res.json();
    if (data.success) {
      renderBarChart(data, col);
    } else {
      showToast(data.error, 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally { hideSpinner(); }
}

function renderBarChart(data, col) {
  const palette = PALETTES[state.barPaletteIdx];
  const isHoriz = state.barOrientation === 'horizontal';

  // Build per-bar colors
  const bgColors = data.labels.map((_, i) => {
    if (state.barPaletteIdx === 0) return MULTI_COLORS[i % MULTI_COLORS.length];
    return palette.bg;
  });
  const borderColors = data.labels.map((_, i) => {
    if (state.barPaletteIdx === 0) return MULTI_BORDERS[i % MULTI_BORDERS.length];
    return palette.border;
  });

  // Destroy old
  if (state.barChart) { state.barChart.destroy(); state.barChart = null; }

  const canvas = el('barChartCanvas');
  el('barPlaceholder').style.display = 'none';
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');
  state.barChart = new Chart(ctx, {
    type: isHoriz ? 'bar' : 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: col,
        data: isHoriz ? data.values : data.values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: isHoriz ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Distribution of ${col}`,
          color: '#f1f5f9',
          font: { size: 16, weight: '700', family: 'Inter' },
          padding: { bottom: 20 },
        },
        tooltip: {
          backgroundColor: 'rgba(13,20,34,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          padding: 12,
          callbacks: {
            label: ctx => ` Count: ${ctx.raw.toLocaleString()}`,
            afterLabel: ctx => {
              const pct = data.percentages[ctx.dataIndex];
              return ` Percentage: ${pct}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#94a3b8', font: { size: 12 }, maxRotation: 35 },
          title: { display: true, text: isHoriz ? 'Frequency' : col, color: '#94a3b8', font: { size: 12, weight: '600' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#94a3b8', font: { size: 12 } },
          title: { display: true, text: isHoriz ? col : 'Frequency', color: '#94a3b8', font: { size: 12, weight: '600' } },
          beginAtZero: true,
        }
      }
    }
  });

  // Stats
  el('barTotal').textContent   = data.total.toLocaleString();
  el('barUnique').textContent  = data.unique_count;
  el('barMode').textContent    = data.mode;
  el('barMissing').textContent = data.missing;
  el('barInterpretation').innerHTML = data.interpretation;
  el('barStatsSection').classList.remove('d-none');

  // Frequency table
  const maxCount = Math.max(...data.values);
  el('freqTableBody').innerHTML = data.frequency_table.map(row => `
    <tr>
      <td><strong>${row.category}</strong></td>
      <td>${row.count.toLocaleString()}</td>
      <td>${row.percentage}%</td>
      <td>
        <div class="freq-bar-bg">
          <div class="freq-bar-fill" style="width:${Math.round(row.count/maxCount*100)}%"></div>
        </div>
      </td>
    </tr>
  `).join('');
}

function setOrientation(dir) {
  state.barOrientation = dir;
  el('btnVertical').classList.toggle('active', dir === 'vertical');
  el('btnHorizontal').classList.toggle('active', dir === 'horizontal');
  if (el('barColumnSelect').value) updateBarChart();
}

function setPalette(idx) {
  state.barPaletteIdx = idx;
  document.querySelectorAll('#colorPalette .color-swatch').forEach((s, i) => s.classList.toggle('active', i === idx));
  if (el('barColumnSelect').value) updateBarChart();
}

function clearBarChart() {
  if (state.barChart) { state.barChart.destroy(); state.barChart = null; }
  el('barPlaceholder').style.display = '';
  el('barChartCanvas').style.display = 'none';
  el('barStatsSection').classList.add('d-none');
  el('barColumnSelect').value = '';
}

function downloadBarChart() {
  if (!state.barChart) { showToast('No bar chart to download', 'error'); return; }
  const link = document.createElement('a');
  link.download = `bar_chart_${el('barColumnSelect').value || 'chart'}.png`;
  link.href = el('barChartCanvas').toDataURL('image/png', 1.0);
  link.click();
  showToast('Bar chart downloaded!', 'success');
}

// ══════════════════════════════════════════════════════════════
// HISTOGRAM
// ══════════════════════════════════════════════════════════════
async function updateHistogram() {
  const col = el('histColumnSelect').value;
  const bins = parseInt(el('binsRange').value) || 15;
  if (!col) return;
  showSpinner();
  try {
    const res = await fetch('/api/histogram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: col, bins }),
    });
    const data = await res.json();
    if (data.success) {
      renderHistogram(data, col);
    } else {
      showToast(data.error, 'error');
    }
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally { hideSpinner(); }
}

function renderHistogram(data, col) {
  const palette = PALETTES[state.histPaletteIdx];

  if (state.histChart) { state.histChart.destroy(); state.histChart = null; }

  const canvas = el('histChartCanvas');
  el('histPlaceholder').style.display = 'none';
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');

  // Create gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 400);
  grad.addColorStop(0, palette.bg);
  grad.addColorStop(1, palette.bg.replace('0.75', '0.15'));

  state.histChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: col,
        data: data.values,
        backgroundColor: grad,
        borderColor: palette.border,
        borderWidth: 1.5,
        borderRadius: 4,
        borderSkipped: false,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Frequency Distribution of ${col}`,
          color: '#f1f5f9',
          font: { size: 16, weight: '700' },
          padding: { bottom: 20 },
        },
        tooltip: {
          backgroundColor: 'rgba(13,20,34,0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          padding: 12,
          callbacks: {
            title: ctx => `Range: ${ctx[0].label}`,
            label: ctx => ` Frequency: ${ctx.raw.toLocaleString()}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
          title: { display: true, text: col, color: '#94a3b8', font: { size: 12, weight: '600' } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#94a3b8', font: { size: 12 } },
          title: { display: true, text: 'Frequency', color: '#94a3b8', font: { size: 12, weight: '600' } },
          beginAtZero: true,
        }
      }
    }
  });

  // Stats
  const s = data.stats;
  el('histMean').textContent   = s.mean.toLocaleString();
  el('histMedian').textContent = s.median.toLocaleString();
  el('histMode').textContent   = typeof s.mode === 'number' ? s.mode.toLocaleString() : s.mode;
  el('histMin').textContent    = s.min.toLocaleString();
  el('histMax').textContent    = s.max.toLocaleString();
  el('histStd').textContent    = s.std.toLocaleString();
  el('histQ1').textContent     = s.q25.toLocaleString();
  el('histQ3').textContent     = s.q75.toLocaleString();
  el('histSkew').textContent   = s.skewness;
  el('histKurt').textContent   = s.kurtosis;
  el('histInterpretation').innerHTML = data.interpretation;
  el('histStatsSection').classList.remove('d-none');
}

function setHistPalette(idx) {
  state.histPaletteIdx = idx;
  document.querySelectorAll('#histColorPalette .color-swatch').forEach((s, i) => s.classList.toggle('active', i === idx));
  if (el('histColumnSelect').value) updateHistogram();
}

function clearHistChart() {
  if (state.histChart) { state.histChart.destroy(); state.histChart = null; }
  el('histPlaceholder').style.display = '';
  el('histChartCanvas').style.display = 'none';
  el('histStatsSection').classList.add('d-none');
  el('histColumnSelect').value = '';
}

function downloadHistChart() {
  if (!state.histChart) { showToast('No histogram to download', 'error'); return; }
  const link = document.createElement('a');
  link.download = `histogram_${el('histColumnSelect').value || 'chart'}.png`;
  link.href = el('histChartCanvas').toDataURL('image/png', 1.0);
  link.click();
  showToast('Histogram downloaded!', 'success');
}

// ══════════════════════════════════════════════════════════════
// ANALYSIS
// ══════════════════════════════════════════════════════════════
async function loadAnalysis() {
  if (!state.datasetLoaded) return;
  showSpinner();
  try {
    const res = await fetch('/api/analysis');
    const data = await res.json();
    if (data.success) {
      renderAnalysis(data);
      el('analysisContent').classList.remove('d-none');
      el('analysisNoData').classList.add('d-none');
    } else {
      showToast(data.error, 'error');
    }
  } catch (e) {
    showToast('Error loading analysis: ' + e.message, 'error');
  } finally { hideSpinner(); }
}

function renderAnalysis(data) {
  // Numerical table
  const numBody = el('numStatsBody');
  numBody.innerHTML = '';
  for (const [col, s] of Object.entries(data.numerical)) {
    const skewClass = Math.abs(s.skewness) < 0.2 ? 'skew-sym' : (s.skewness > 0 ? 'skew-pos' : 'skew-neg');
    const skewLabel = Math.abs(s.skewness) < 0.2 ? 'Symmetric' : (s.skewness > 0 ? 'Right-skewed' : 'Left-skewed');
    numBody.innerHTML += `
      <tr>
        <td><strong>${col}</strong></td>
        <td>${s.mean.toLocaleString()}</td>
        <td>${s.median.toLocaleString()}</td>
        <td>${s.mode !== null ? s.mode.toLocaleString() : '—'}</td>
        <td>${s.std.toLocaleString()}</td>
        <td>${s.min.toLocaleString()}</td>
        <td>${s.max.toLocaleString()}</td>
        <td><span class="skew-chip ${skewClass}">${skewLabel}</span></td>
        <td>${s.missing > 0 ? `<span style="color:#f87171">${s.missing}</span>` : '0'}</td>
      </tr>
    `;
  }

  // Categorical blocks
  const catContainer = el('catStatsContainer');
  catContainer.innerHTML = '';
  for (const [col, s] of Object.entries(data.categorical)) {
    const maxCount = s.top_5.length > 0 ? s.top_5[0].count : 1;
    const bars = s.top_5.map(item => `
      <div class="cat-freq-row">
        <span class="cat-freq-label" title="${item.value}">${item.value}</span>
        <div class="cat-freq-bar-bg">
          <div class="cat-freq-bar-fill" style="width:${Math.round(item.count/maxCount*100)}%"></div>
        </div>
        <span class="cat-freq-count">${item.count}</span>
      </div>
    `).join('');
    catContainer.innerHTML += `
      <div class="cat-block mt-3 p-3" style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
        <div class="cat-block-title">
          <span class="col-badge categorical">${col}</span>
          <span style="font-size:12px;color:#64748b;font-weight:500">${s.unique} unique values • Mode: <strong style="color:#f1f5f9">${s.mode}</strong> • Missing: ${s.missing}</span>
        </div>
        ${bars}
      </div>
    `;
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════
function exportCSV() {
  if (!state.datasetLoaded) { showToast('No dataset loaded', 'error'); return; }
  window.location.href = '/api/export-csv';
  showToast('Dataset export started!', 'success');
}

// ══════════════════════════════════════════════════════════════
// RESET
// ══════════════════════════════════════════════════════════════
async function resetDashboard() {
  if (!confirm('Are you sure you want to reset the dashboard? All loaded data will be cleared.')) return;
  showSpinner();
  try {
    await fetch('/api/reset', { method: 'POST' });
    // Reset state
    state.datasetLoaded = false;
    state.numericalCols = [];
    state.categoricalCols = [];
    state.allCols = [];
    state.filename = '';

    // Reset stats
    ['stat-records','stat-columns','stat-categorical','stat-numerical'].forEach(id => el(id).textContent = '—');

    // Reset dataset status
    const ds = el('datasetStatus');
    ds.innerHTML = `<i class="bi bi-database-x"></i><span>No Dataset Loaded</span>`;
    ds.classList.remove('loaded');

    // Reset overview
    el('emptyState').classList.remove('d-none');
    el('overviewLoaded').classList.add('d-none');

    // Reset upload section
    el('uploadedDataInfo').classList.add('d-none');
    el('uploadError').classList.add('d-none');

    // Destroy charts
    clearBarChart();
    clearHistChart();

    // Reset selects
    el('barColumnSelect').innerHTML = '<option value="">-- Select Column --</option>';
    el('histColumnSelect').innerHTML = '<option value="">-- Select Column --</option>';

    // Reset analysis
    el('analysisContent').classList.add('d-none');

    showSection('overview');
    showToast('Dashboard reset successfully!', 'success');
  } catch (e) {
    showToast('Error resetting: ' + e.message, 'error');
  } finally { hideSpinner(); }
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setupDropZone();
  showSection('overview');

  // Animate stat card values on load
  document.querySelectorAll('.stat-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 0.08}s`;
    card.style.animation = 'fadeIn 0.5s ease both';
  });
});
