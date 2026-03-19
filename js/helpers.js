// ── LABELS ──────────────────────────────────────
function sLabel(s) {
  return {booking:'Booking',dp:'Proses DP',berkas:'Kumpul Berkas',selesai:'Selesai',batal:'Batal'}[s] || s;
}
function kprLabel(s) {
  return {'kpr-btn':'KPR BTN','kpr-bni':'KPR BNI','kpr-bri':'KPR BRI','kpr-mandiri':'KPR Mandiri','kpr-bsm':'KPR Syariah','cash-keras':'Cash Keras','cash-bertahap':'Cash Bertahap','subsidi':'KPR Subsidi FLPP'}[s] || s || '—';
}
function sumberLabel(s) {
  return {referral:'Referral',medsos:'Media Sosial',pameran:'Pameran',brosur:'Brosur',website:'Website','walk-in':'Walk In',telepon:'Telepon'}[s] || s || '—';
}

// ── FORMAT ───────────────────────────────────────
function fRp(n) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
function fRpFull(n) {
  if (!n) return 'Rp 0';
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}
function fDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function relTime(iso) {
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + 'm lalu';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'j lalu';
  return Math.floor(h / 24) + 'h lalu';
}

// ── MISC ─────────────────────────────────────────
function ownerName(oid) {
  const p = allProfs.find(x => x.id === oid);
  return p?.full_name || p?.email || '—';
}
function hsh(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return h;
}

// ── TOAST ────────────────────────────────────────
function showToast(msg, ico = '') {
  const t = document.getElementById('toast');
  t.textContent = ico ? ico + ' ' + msg : msg;
  t.classList.add('show');
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── MODAL ────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── LOADING TEXT ─────────────────────────────────
function setLoadTxt(t) { document.getElementById('loadTxt').textContent = t; }
function hideSplash() {
  const el = document.getElementById('loading');
  el.classList.add('out');
  setTimeout(() => el.style.display = 'none', 400);
}

// ── THEME ─────────────────────────────────────────
function applyTheme(isLight, animate) {
  const html = document.documentElement;
  if (animate) { html.classList.add('theme-anim'); setTimeout(() => html.classList.remove('theme-anim'), 400); }
  html.classList.toggle('light', isLight);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', isLight ? '#f5f5fa' : '#050508');
  const toggle = document.getElementById('themeToggle');
  const thumb  = document.getElementById('toggleThumb');
  const label  = document.getElementById('themeLabel');
  const desc   = document.getElementById('themeDesc');
  if (toggle) toggle.checked = isLight;
  if (thumb)  thumb.textContent = isLight ? '☀️' : '🌙';
  if (label)  label.textContent = isLight ? '☀️ Tema Terang' : '🌙 Tema Gelap';
  if (desc)   desc.textContent  = isLight ? 'Saat ini menggunakan tema terang' : 'Saat ini menggunakan tema gelap';
  const hdrBtn = document.getElementById('themeBtnHdr');
  if (hdrBtn) hdrBtn.textContent = isLight ? '☀️' : '🌙';
  const sidebarThemeIco = document.getElementById('sidebarThemeIco');
  if (sidebarThemeIco) sidebarThemeIco.textContent = isLight ? '☀️' : '🌙';
  // Re-render charts after theme change
  if (curPage === 'laporan') setTimeout(() => renderCharts(), 350);
}
function toggleTheme(isLight) {
  localStorage.setItem('mp_theme', isLight ? 'light' : 'dark');
  applyTheme(isLight, true);
  showToast(isLight ? 'Tema terang aktif ☀️' : 'Tema gelap aktif 🌙', '');
}
function quickToggleTheme() {
  const isNowLight = !document.documentElement.classList.contains('light');
  localStorage.setItem('mp_theme', isNowLight ? 'light' : 'dark');
  applyTheme(isNowLight, true);
  showToast(isNowLight ? 'Tema terang aktif ☀️' : 'Tema gelap aktif 🌙', '');
}
function initTheme() {
  const saved = localStorage.getItem('mp_theme');
  const preferLight = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(preferLight, false);
}

// ── PASSWORD HELPERS ──────────────────────────────
function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  inp.focus();
}
function checkPassStrength(val, barId = 'passStrength', fillId = 'passStrengthFill') {
  const bar  = document.getElementById(barId);
  const fill = document.getElementById(fillId);
  if (!bar || !fill) return;
  if (!val) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  let score = 0;
  if (val.length >= 6)  score++;
  if (val.length >= 10) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  fill.style.width = Math.min((score / 5) * 100, 100) + '%';
  fill.style.background = score <= 1 ? '#f43f5e' : score <= 3 ? '#f59e0b' : '#10b981';
}

// ── PWA ──────────────────────────────────────────
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
function triggerInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(r => { if (r.outcome === 'accepted') showToast('Aplikasi diinstall!', '🎉'); deferredPrompt = null; });
  } else {
    showToast('Gunakan menu browser untuk install', 'ℹ️');
  }
}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

// ── BTN LOADING ───────────────────────────────────
function setBtnLoading(id, loading, txt) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = loading; b.textContent = txt;
}

// ── FILTER DATA BY PERIOD ────────────────────────
function filterByPeriod(list, period) {
  const now = new Date();
  return list.filter(k => {
    const d = new Date(k.created_at);
    if (period === 'bulan')    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'kuartal')  { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear(); }
    if (period === 'tahun')    return d.getFullYear() === now.getFullYear();
    return true; // semua
  });
}

// ── DOWNLOAD TEMPLATE EXCEL ───────────────────────
function downloadTemplate() {
  if (typeof XLSX === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = _doDownloadTemplate;
    document.head.appendChild(s);
  } else {
    _doDownloadTemplate();
  }
}

function _doDownloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Nama Lengkap','No. HP','Tipe Unit','No. Kavling',
    'Harga (Rp)','DP (Rp)','Status','Tgl. Booking',
    'Tgl. Follow-up','KPR / Pembiayaan','Sumber Leads','Catatan'
  ];
  const examples = [
    ['Budi Santoso','081234567890','T36/72','B-12',
     350000000,35000000,'Booking','2024-03-01',
     '2024-03-15','KPR BTN','Referral','Konsumen prioritas'],
    ['Siti Rahayu','089876543210','T45/90','C-5',
     450000000,45000000,'Proses DP','2024-02-15',
     '','KPR BNI','Media Sosial','Via Instagram'],
    ['Ahmad Fauzi','082112345678','T54/110','A-3',
     550000000,0,'Kumpul Berkas','2024-01-20',
     '2024-03-20','Cash Keras','Pameran',''],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Column widths
  ws['!cols'] = [
    {wch:22},{wch:16},{wch:12},{wch:14},
    {wch:16},{wch:14},{wch:16},{wch:14},
    {wch:14},{wch:18},{wch:16},{wch:24}
  ];

  // Info sheet
  const infoData = [
    ['PANDUAN PENGISIAN TEMPLATE MarketPro'],
    [''],
    ['Kolom','Keterangan','Contoh Nilai'],
    ['Nama Lengkap','Wajib diisi','Budi Santoso'],
    ['No. HP','Wajib diisi, format 08xx atau 62xx','081234567890'],
    ['Tipe Unit','Opsional','T36/72, T45/90'],
    ['No. Kavling','Opsional','B-12, A-05'],
    ['Harga (Rp)','Angka saja, tanpa Rp atau titik','350000000'],
    ['DP (Rp)','Angka saja','35000000'],
    ['Status','Booking / Proses DP / Kumpul Berkas / Selesai / Batal','Booking'],
    ['Tgl. Booking','Format YYYY-MM-DD','2024-03-01'],
    ['Tgl. Follow-up','Format YYYY-MM-DD (opsional)','2024-03-15'],
    ['KPR / Pembiayaan','KPR BTN / KPR BNI / KPR BRI / KPR Mandiri / KPR Syariah / Cash Keras / Cash Bertahap / KPR Subsidi FLPP','KPR BTN'],
    ['Sumber Leads','Referral / Media Sosial / Pameran / Brosur / Website / Walk In / Telepon','Referral'],
    ['Catatan','Opsional, teks bebas','Konsumen prioritas'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{wch:20},{wch:50},{wch:30}];

  XLSX.utils.book_append_sheet(wb, ws, 'Data Konsumen');
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Panduan');
  XLSX.writeFile(wb, 'template-import-marketpro.xlsx');
  showToast('Template berhasil diunduh', '📥');
}

// ── DESKTOP SIDEBAR RESIZE HANDLER ───────────────
window.addEventListener('resize', () => {
  const isDesktop = window.innerWidth >= 768;
  const sidebarUser   = document.getElementById('sidebarUser');
  const sidebarBottom = document.getElementById('sidebarBottom');
  if (sidebarUser)   sidebarUser.style.display   = (isDesktop && me) ? 'flex' : 'none';
  if (sidebarBottom) sidebarBottom.style.display  = (isDesktop && me) ? 'flex' : 'none';
});

// Patch applyTheme to also sync sidebar icon
const _origApplyTheme = applyTheme;
// (sync handled inside applyTheme via quickToggleTheme → sidebarThemeIco is set)
