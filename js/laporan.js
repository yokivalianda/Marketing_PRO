// ── LAPORAN KPI ──────────────────────────────────
function setPeriod(p) {
  curPeriod = p;
  // Reset custom range saat pilih preset
  curDateFrom = '';
  curDateTo   = '';
  document.querySelectorAll('.ptag').forEach(c => c.classList.toggle('on', c.dataset.p === p));
  // Tutup custom picker jika terbuka
  const picker = document.getElementById('customRangePicker');
  if (picker) picker.style.display = 'none';
  updatePeriodLabel();
  renderLapKpi();
  renderCharts();
}

// ── CUSTOM DATE RANGE ────────────────────────────
function toggleCustomRange() {
  const picker = document.getElementById('customRangePicker');
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Pre-fill dengan nilai saat ini
    const from = document.getElementById('dateFrom');
    const to   = document.getElementById('dateTo');
    if (from && !from.value) from.value = curDateFrom || getFirstDayOfMonth();
    if (to   && !to.value)   to.value   = curDateTo   || getTodayStr();
  }
}

function applyCustomRange() {
  const from = document.getElementById('dateFrom')?.value || '';
  const to   = document.getElementById('dateTo')?.value   || '';
  if (from && to && from > to) {
    showToast('Tanggal mulai harus sebelum tanggal akhir', '⚠️'); return;
  }
  curDateFrom = from;
  curDateTo   = to;
  curPeriod   = 'custom';
  // Nonaktifkan semua preset
  document.querySelectorAll('.ptag').forEach(c => c.classList.remove('on'));
  document.getElementById('customRangePicker').style.display = 'none';
  updatePeriodLabel();
  renderLapKpi();
  renderCharts();
  showToast('Filter diterapkan', '✅');
}

function clearCustomRange() {
  curDateFrom = '';
  curDateTo   = '';
  setPeriod('bulan');
  const from = document.getElementById('dateFrom');
  const to   = document.getElementById('dateTo');
  if (from) from.value = '';
  if (to)   to.value   = '';
}

// Preset cepat di dalam date picker
function setQuickRange(type) {
  const today = new Date();
  let from, to;
  if (type === '7d') {
    from = new Date(today); from.setDate(today.getDate() - 6);
    to = today;
  } else if (type === '30d') {
    from = new Date(today); from.setDate(today.getDate() - 29);
    to = today;
  } else if (type === '90d') {
    from = new Date(today); from.setDate(today.getDate() - 89);
    to = today;
  } else if (type === 'bln-lalu') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to   = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (type === 'kwartal-lalu') {
    const q = Math.floor(today.getMonth() / 3);
    from = new Date(today.getFullYear(), (q - 1) * 3, 1);
    to   = new Date(today.getFullYear(), q * 3, 0);
  }
  if (from && to) {
    document.getElementById('dateFrom').value = dateToStr(from);
    document.getElementById('dateTo').value   = dateToStr(to);
  }
}

function updatePeriodLabel() {
  const lbl  = document.getElementById('activePeriodLabel');
  const btn  = document.getElementById('clearRangeBtn');
  const isCustom = curPeriod === 'custom' && (curDateFrom || curDateTo);
  if (lbl) {
    if (isCustom) {
      const from = curDateFrom ? fDateShort(curDateFrom) : '—';
      const to   = curDateTo   ? fDateShort(curDateTo)   : '—';
      lbl.textContent   = `${from} – ${to}`;
      lbl.style.display = 'inline';
    } else {
      lbl.style.display = 'none';
    }
  }
  if (btn) btn.style.display = isCustom ? 'inline' : 'none';
  // Highlight tombol custom saat aktif
  document.querySelectorAll('.ptag-custom').forEach(el =>
    el.classList.toggle('active', isCustom)
  );
}

function getFirstDayOfMonth() {
  const d = new Date(); d.setDate(1); return dateToStr(d);
}
function getTodayStr() { return dateToStr(new Date()); }
function dateToStr(d) { return d.toISOString().slice(0, 10); }

function renderLapKpi() {
  const k       = filterByPeriod(allKons, curPeriod);
  const selesai = k.filter(x => x.status === 'selesai').length;
  const nilai   = k.filter(x => x.status === 'selesai').reduce((s, x) => s + (x.harga || 0), 0);
  const dp      = k.reduce((s, x) => s + (x.dp || 0), 0);

  document.getElementById('lapKpi').innerHTML = `
    <div class="kpi-card kc-blue"><div class="kpi-icon">👥</div><div class="kpi-label">Total Konsumen</div><div class="kpi-value">${k.length}</div></div>
    <div class="kpi-card kc-green"><div class="kpi-icon">✅</div><div class="kpi-label">Akad Selesai</div><div class="kpi-value">${selesai}</div></div>
    <div class="kpi-card kc-amber"><div class="kpi-icon">💵</div><div class="kpi-label">Nilai Jual</div><div class="kpi-value" style="font-size:17px">${fRp(nilai)}</div></div>
    <div class="kpi-card kc-violet"><div class="kpi-icon">🏦</div><div class="kpi-label">DP Masuk</div><div class="kpi-value" style="font-size:17px">${fRp(dp)}</div></div>`;

  // Pipeline progress bars
  const pipes = [
    { k: 'cek-lokasi', l: 'Prospek Konsumen',    c: '#0ea5e9' },
    { k: 'booking',    l: 'Booking',        c: '#6366f1' },
    { k: 'dp',         l: 'Proses DP',      c: '#f59e0b' },
    { k: 'berkas',     l: 'Kumpul Berkas',  c: '#a855f7' },
    { k: 'selesai',    l: 'Selesai',        c: '#10b981' },
    { k: 'batal',      l: 'Batal',          c: '#f43f5e' },
  ];
  document.getElementById('lapProg').innerHTML = pipes.map(p => {
    const cnt = k.filter(x => x.status === p.k).length;
    const pct = k.length ? Math.round(cnt / k.length * 100) : 0;
    return `<div class="prog-item">
      <div class="prog-head"><span class="prog-name">${p.l}</span><span class="prog-meta">${cnt} · ${pct}%</span></div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${p.c}"></div></div>
    </div>`;
  }).join('');

  // Ranking (admin)
  if (myProf?.role === 'admin') {
    const mt = allProfs.filter(p => p.role !== 'admin');
    const ranked = mt.map(p => ({
      ...p,
      cnt:  k.filter(x => x.owner_id === p.id).length,
      done: k.filter(x => x.owner_id === p.id && x.status === 'selesai').length,
      val:  k.filter(x => x.owner_id === p.id && x.status === 'selesai').reduce((s, x) => s + (x.harga || 0), 0)
    })).sort((a, b) => b.done - a.done || b.cnt - a.cnt);
    document.getElementById('lapRank').innerHTML = ranked.map((p, i) => `
      <div class="rank-item">
        <div class="rank-pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</div>
        <div class="rank-av av${i % 8}">${(p.full_name || '?').charAt(0).toUpperCase()}</div>
        <div class="rank-info"><div class="rank-name">${p.full_name || p.email}</div><div class="rank-sub">${p.cnt} konsumen · ${p.done} akad</div></div>
        <div class="rank-val">${fRp(p.val)}</div>
      </div>`).join('');
  }

  // Target — render via target.js module
  if (typeof renderTargetSection === 'function') renderTargetSection();
}

// ── CHARTS via Chart.js ───────────────────────────
function getChartColors() {
  const isLight = document.documentElement.classList.contains('light');
  return {
    grid:   isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.07)',
    text:   isLight ? '#9090b0'           : '#4a4a68',
    brand:  '#6366f1', emerald: '#10b981', amber: '#f59e0b',
    violet: '#a855f7', rose: '#f43f5e',    sky: '#0ea5e9',
  };
}

function destroyCharts() {
  if (chartPipeline) { chartPipeline.destroy(); chartPipeline = null; }
  if (chartTren)     { chartTren.destroy();     chartTren     = null; }
  if (chartSumber)   { chartSumber.destroy();   chartSumber   = null; }
}

function renderCharts() {
  if (typeof Chart === 'undefined') return;
  destroyCharts();
  const k  = filterByPeriod(allKons, curPeriod);
  const cl = getChartColors();
  const isLight = document.documentElement.classList.contains('light');
  Chart.defaults.color = cl.text;

  // ── Chart 1: Pipeline donut ────────────────────
  const c1 = document.getElementById('chartPipeline');
  if (c1) {
    const counts = ['cek-lokasi','booking','dp','berkas','selesai','batal'].map(s => k.filter(x => x.status === s).length);
    chartPipeline = new Chart(c1, {
      type: 'doughnut',
      data: {
        labels: ['Prospek Konsumen','Booking','Proses DP','Kumpul Berkas','Selesai','Batal'],
        datasets: [{ data: counts, backgroundColor: [cl.sky, cl.brand, cl.amber, cl.violet, cl.emerald, cl.rose], borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 }, boxWidth: 10 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} konsumen` } } },
        animation: { duration: 600 }
      }
    });
  }

  // ── Chart 2: Tren penjualan per bulan (bar) ───
  const c2 = document.getElementById('chartTren');
  if (c2) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() });
    }
    const dataSelesai = months.map(m => allKons.filter(x => {
      const d = new Date(x.created_at);
      return x.status === 'selesai' && d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length);
    const dataBaru = months.map(m => allKons.filter(x => {
      const d = new Date(x.created_at);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    }).length);
    chartTren = new Chart(c2, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [
          { label: 'Konsumen Baru', data: dataBaru, backgroundColor: isLight ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.3)', borderRadius: 4 },
          { label: 'Akad Selesai',  data: dataSelesai, backgroundColor: isLight ? 'rgba(16,185,129,0.7)' : 'rgba(16,185,129,0.8)',  borderRadius: 4 },
        ]
      },
      options: {
        scales: {
          x: { grid: { color: cl.grid }, ticks: { font: { size: 10 } } },
          y: { grid: { color: cl.grid }, ticks: { font: { size: 10 }, precision: 0 }, beginAtZero: true }
        },
        plugins: { legend: { labels: { padding: 12, font: { size: 11 }, boxWidth: 10 } } },
        animation: { duration: 600 }
      }
    });
  }

  // ── Chart 3: Sumber leads (horizontal bar) ────
  const c3 = document.getElementById('chartSumber');
  if (c3) {
    const sumberMap = {};
    k.forEach(x => { const s = x.sumber || 'lainnya'; sumberMap[s] = (sumberMap[s] || 0) + 1; });
    const sorted = Object.entries(sumberMap).sort((a, b) => b[1] - a[1]);
    const colors = [cl.brand, cl.emerald, cl.amber, cl.violet, cl.rose, cl.sky];
    chartSumber = new Chart(c3, {
      type: 'bar',
      data: {
        labels: sorted.map(s => sumberLabel(s[0])),
        datasets: [{ data: sorted.map(s => s[1]), backgroundColor: sorted.map((_, i) => colors[i % colors.length] + (isLight ? 'cc' : 'bb')), borderRadius: 4 }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { grid: { color: cl.grid }, ticks: { font: { size: 10 }, precision: 0 } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        },
        plugins: { legend: { display: false } },
        animation: { duration: 600 }
      }
    });
  }
}
