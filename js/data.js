// ── INIT ─────────────────────────────────────────
async function init() {
  setLoadTxt('Menginisialisasi...');

  if (SUPABASE_URL === 'GANTI_DENGAN_URL_SUPABASE_ANDA') {
    hideSplash(); showSetupGuide(); return;
  }

  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    setLoadTxt('Memeriksa sesi...');

    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      hideSplash(); showAuth();
      sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          document.getElementById('auth').classList.add('show');
          showNewPassPanel();
          history.replaceState(null, '', window.location.pathname);
        }
      });
      return;
    }

    const { data: { session } } = await sb.auth.getSession();
    if (session) { await afterLogin(session.user); }
    else { hideSplash(); showAuth(); }
  } catch(e) {
    hideSplash(); showAuth();
    showAuthErr('Gagal terhubung. Periksa konfigurasi Supabase.');
  }
}

// ── AFTER LOGIN ──────────────────────────────────
async function afterLogin(user) {
  me = user;
  setLoadTxt('Memuat profil...');
  let { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!prof) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    await sb.from('profiles').insert({ id: user.id, email: user.email, full_name: name, role: 'marketing', target: 5 });
    ({ data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single());
  }
  myProf = prof;
  setLoadTxt('Memuat data...');
  await Promise.all([loadProfs(), loadKons()]);
  setupRealtime();
  hideSplash(); hideAuth();
  const shell = document.getElementById('shell');
  shell.style.display = 'flex'; shell.classList.add('show');
  updateHeaderUI();
  setupAdminUI();
  renderDash(); renderKons();
  initTheme();
}

// ── HEADER & ADMIN UI ───────────────────────────
function updateHeaderUI() {
  const name = myProf?.full_name || me.email;
  const initial = name.charAt(0).toUpperCase();
  const ci = Math.abs(hsh(me.id)) % 8;
  document.getElementById('hAvatar').textContent = initial;
  document.getElementById('hAvatar').className = `pill-avatar av${ci}`;
  document.getElementById('hName').textContent = name.split(' ')[0];
  const rb = document.getElementById('hRole');
  rb.textContent = myProf?.role === 'admin' ? 'Admin' : 'Marketing';
  rb.className = `pill-role${myProf?.role === 'admin' ? ' admin' : ''}`;
  document.getElementById('heroName').innerHTML = `${name.split(' ')[0]}<br><span class="accent">Selamat bekerja!</span>`;
  document.getElementById('setHeroName').textContent = name;
  document.getElementById('setEmail').textContent = me.email;
  document.getElementById('setAvatar').textContent = initial;
  document.getElementById('setAvatar').className = `set-big-av av${ci}`;
  document.getElementById('setPName').value = name;
  document.getElementById('setPTarget').value = myProf?.target || 5;
}

function setupAdminUI() {
  const isAdmin = myProf?.role === 'admin';
  document.getElementById('teamSec').style.display   = isAdmin ? 'block' : 'none';
  document.getElementById('rankSec').style.display   = isAdmin ? 'block' : 'none';
  document.getElementById('adminGrp').style.display  = isAdmin ? 'block' : 'none';
  document.getElementById('adminBar').classList.toggle('show', isAdmin);
  if (isAdmin) fillAdminSel();
}

// ── LOAD DATA ────────────────────────────────────
async function loadProfs() {
  const { data } = await sb.from('profiles').select('*');
  allProfs = data || [];
}
async function loadKons() {
  let q = sb.from('konsumen').select('*').order('created_at', { ascending: false });
  if (myProf?.role !== 'admin') q = q.eq('owner_id', me.id);
  const { data } = await q;
  allKons = data || [];
  updateNotifPip();
}

// ── REALTIME ─────────────────────────────────────
function setupRealtime() {
  if (rtChan) sb.removeChannel(rtChan);
  rtChan = sb.channel('kons-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'konsumen' }, async p => {
      const isAdmin = myProf?.role === 'admin';
      const mine = p.new?.owner_id === me.id || p.old?.owner_id === me.id;
      if (!isAdmin && !mine) return;
      if (p.eventType === 'INSERT') {
        if (isAdmin || p.new.owner_id === me.id) allKons.unshift(p.new);
        if (p.new.owner_id !== me.id) showToast('📥 Data baru dari tim!', '');
      } else if (p.eventType === 'UPDATE') {
        const i = allKons.findIndex(k => k.id === p.new.id);
        if (i >= 0) allKons[i] = p.new; else if (isAdmin || p.new.owner_id === me.id) allKons.unshift(p.new);
      } else if (p.eventType === 'DELETE') {
        allKons = allKons.filter(k => k.id !== p.old.id);
      }
      updateNotifPip();
      if (curPage === 'dashboard') renderDash();
      if (curPage === 'konsumen')  renderKons();
      if (curPage === 'laporan')   { renderLapKpi(); renderCharts(); }
      if (curPage === 'kalender')  renderKalender();
    }).subscribe();
}

// ── SAVE / DELETE ────────────────────────────────
async function saveKons() {
  const nama = document.getElementById('fNama').value.trim();
  const hp   = document.getElementById('fHP').value.trim();
  if (!nama || !hp) { showToast('Nama dan HP wajib diisi', '⚠️'); return; }
  const eid = document.getElementById('editId').value;
  const obj = {
    nama, hp,
    unit:        document.getElementById('fUnit').value.trim(),
    kavling:     document.getElementById('fKavling').value.trim(),
    harga:       parseInt(document.getElementById('fHarga').value) || 0,
    dp:          parseInt(document.getElementById('fDP').value) || 0,
    status:      document.getElementById('fStatus').value,
    tgl_booking: document.getElementById('fTglBooking').value || null,
    tgl_followup:document.getElementById('fTglFollowup').value || null,
    kpr:         document.getElementById('fKPR').value,
    sumber:      document.getElementById('fSumber').value,
    catatan:     document.getElementById('fCatatan').value.trim(),
  };
  setBtnLoading('btnSave', true, 'Menyimpan...');
  try {
    if (eid) {
      const ex = allKons.find(k => k.id === eid);
      obj.log = [...(ex?.log || [])];
      if (ex && ex.status !== obj.status) obj.log.push({ action: `Status: ${sLabel(ex.status)} → ${sLabel(obj.status)}`, time: new Date().toISOString(), note: '' });
      if (ex && ex.tgl_followup !== obj.tgl_followup && obj.tgl_followup) {
        obj.log.push({ action: `Follow-up dijadwal: ${fDateShort(obj.tgl_followup)}`, time: new Date().toISOString(), note: '' });
      }
      const { error } = await sb.from('konsumen').update(obj).eq('id', eid);
      if (error) throw error;
      showToast('Data diperbarui', '✅');
    } else {
      obj.owner_id   = me.id;
      obj.owner_name = myProf?.full_name || me.email;
      obj.berkas = { ktp: false, kk: false, slip: false, tabungan: false, npwp: false, surat: false };
      obj.log = [{ action: 'Konsumen ditambahkan', time: new Date().toISOString(), note: obj.catatan }];
      const { error } = await sb.from('konsumen').insert(obj);
      if (error) throw error;
      showToast('Konsumen ditambahkan', '✅');
    }
    closeModal('modalAdd');
  } catch(e) { showToast('Gagal: ' + e.message, '❌'); }
  setBtnLoading('btnSave', false, 'Simpan Data');
}

async function hapusKons() {
  if (!confirm('Yakin hapus konsumen ini?')) return;
  const id = document.getElementById('editId').value;
  const { error } = await sb.from('konsumen').delete().eq('id', id);
  if (!error) { showToast('Konsumen dihapus', '🗑️'); closeModal('modalAdd'); }
  else showToast('Gagal menghapus', '❌');
}

async function toggleBerkas(id, key) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  const berkas = { ...k.berkas, [key]: !k.berkas[key] };
  const lbl = { ktp: 'KTP', kk: 'Kartu Keluarga', slip: 'Slip Gaji', tabungan: 'Rekening Tabungan', npwp: 'NPWP', surat: 'Surat Lainnya' };
  const log  = [...(k.log || []), { action: `Berkas ${lbl[key]}: ${berkas[key] ? '✅ Sudah' : '❌ Belum'}`, time: new Date().toISOString(), note: '' }];
  await sb.from('konsumen').update({ berkas, log }).eq('id', id);
  showToast(berkas[key] ? `${lbl[key]} ✓` : `${lbl[key]} belum`, berkas[key] ? '✅' : '📋');
  openDetail(id);
}

async function addLog(id) {
  const note = prompt('Tambah catatan:'); if (!note) return;
  const k = allKons.find(x => x.id === id); if (!k) return;
  const log = [...(k.log || []), { action: 'Catatan ditambahkan', time: new Date().toISOString(), note }];
  await sb.from('konsumen').update({ log }).eq('id', id);
  showToast('Catatan ditambahkan', '📝');
  openDetail(id);
}

// ── PROFIL SAVE ──────────────────────────────────
async function saveProfil() {
  const name   = document.getElementById('setPName').value.trim();
  const target = parseInt(document.getElementById('setPTarget').value) || 5;
  if (!name) { showToast('Nama tidak boleh kosong', '⚠️'); return; }
  const { error } = await sb.from('profiles').update({ full_name: name, target }).eq('id', me.id);
  if (!error) { myProf.full_name = name; myProf.target = target; updateHeaderUI(); showToast('Profil disimpan', '✅'); }
  else showToast('Gagal menyimpan', '❌');
}

// ── USER MGMT ─────────────────────────────────────
async function openUserMgmt() {
  await loadProfs();
  document.getElementById('usersBody').innerHTML = allProfs.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--glass-border)">
      <div class="rank-av av${Math.abs(hsh(p.id)) % 8}">${(p.full_name || '?').charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">${p.full_name || '—'}</div>
        <div style="font-size:11px;color:var(--text-3)">${p.email}</div>
      </div>
      <select onchange="updateRole('${p.id}',this.value)" class="admin-select" style="flex:0 0 auto;width:auto">
        <option value="marketing" ${p.role === 'marketing' ? 'selected' : ''}>Marketing</option>
        <option value="admin"     ${p.role === 'admin'     ? 'selected' : ''}>Admin</option>
      </select>
    </div>`).join('');
  openModal('modalUsers');
}
async function updateRole(uid, role) {
  const { error } = await sb.from('profiles').update({ role }).eq('id', uid);
  if (!error) { const p = allProfs.find(x => x.id === uid); if (p) p.role = role; showToast('Role diubah', '✅'); }
  else showToast('Gagal', '❌');
}

// ── EXPORT CSV ───────────────────────────────────
function exportCSV() {
  const headers = ['Nama','HP','Unit','Kavling','Status','Harga','DP','Tgl Booking','Tgl Follow-up','KPR','Sumber','Marketing','Catatan'];
  const rows = allKons.map(k => [
    k.nama, k.hp, k.unit || '', k.kavling || '',
    sLabel(k.status), k.harga || 0, k.dp || 0,
    k.tgl_booking || '', k.tgl_followup || '',
    kprLabel(k.kpr), sumberLabel(k.sumber),
    ownerName(k.owner_id), (k.catatan || '').replace(/,/g, ';')
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `marketpro-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('Data diekspor ke CSV', '📤');
}

// ── EXPORT PDF via jsPDF ─────────────────────────
function exportPDF() {
  if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
    showToast('Memuat library PDF...', '⏳');
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => _doExportPDF();
    document.head.appendChild(script);
    return;
  }
  _doExportPDF();
}

function _doExportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const now = new Date();
  const isAdmin = myProf?.role === 'admin';
  const k = filterByPeriod(allKons, curPeriod);

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont(undefined, 'bold');
  doc.text('MarketPro — Laporan Penjualan', 14, 12);
  doc.setFontSize(9); doc.setFont(undefined, 'normal');
  doc.text(`Dicetak: ${fDate(now.toISOString())}  |  User: ${myProf?.full_name || me.email}`, 14, 20);
  doc.text(`Periode: ${curPeriod === 'bulan' ? 'Bulan Ini' : curPeriod === 'kuartal' ? 'Kuartal Ini' : curPeriod === 'tahun' ? 'Tahun Ini' : 'Semua'}`, 14, 25);

  // KPI
  doc.setTextColor(30, 30, 60);
  let y = 38;
  const selesai = k.filter(x => x.status === 'selesai').length;
  const nilai   = k.filter(x => x.status === 'selesai').reduce((s, x) => s + (x.harga || 0), 0);
  const dp      = k.reduce((s, x) => s + (x.dp || 0), 0);
  const kpis = [
    ['Total Konsumen', k.length], ['Akad Selesai', selesai],
    ['Nilai Jual', fRp(nilai)],   ['DP Masuk', fRp(dp)]
  ];
  kpis.forEach((kpi, i) => {
    const x = 14 + (i % 2) * 93;
    if (i % 2 === 0 && i > 0) y += 18;
    doc.setFillColor(245, 245, 252); doc.roundedRect(x, y, 88, 14, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont(undefined, 'normal'); doc.setTextColor(100, 100, 140);
    doc.text(kpi[0], x + 4, y + 5);
    doc.setFontSize(12); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 30, 60);
    doc.text(String(kpi[1]), x + 4, y + 12);
  });
  y += 24;

  // Pipeline breakdown
  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(99, 102, 241);
  doc.text('Pipeline', 14, y); y += 5;
  const pipes = [
    ['Booking', k.filter(x => x.status === 'booking').length, [99,102,241]],
    ['Proses DP', k.filter(x => x.status === 'dp').length, [245,158,11]],
    ['Kumpul Berkas', k.filter(x => x.status === 'berkas').length, [168,85,247]],
    ['Selesai', selesai, [16,185,129]],
    ['Batal', k.filter(x => x.status === 'batal').length, [244,63,94]],
  ];
  pipes.forEach(p => {
    const pct = k.length ? Math.round(p[1] / k.length * 100) : 0;
    doc.setFillColor(...p[2]); doc.circle(16, y + 2, 1.5, 'F');
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(30,30,60);
    doc.text(`${p[0]}: ${p[1]} (${pct}%)`, 20, y + 3.5);
    y += 7;
  });
  y += 4;

  // Konsumen table
  doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.setTextColor(99, 102, 241);
  doc.text('Daftar Konsumen', 14, y); y += 5;
  doc.setFillColor(99, 102, 241);
  doc.rect(14, y, 182, 6, 'F');
  doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont(undefined, 'bold');
  const cols = isAdmin
    ? [14, 60, 85, 108, 135, 160]
    : [14, 72, 100, 124, 150];
  const hdrs = isAdmin
    ? ['Nama', 'HP', 'Unit/Kav', 'Status', 'Harga', 'Marketing']
    : ['Nama', 'HP', 'Unit/Kav', 'Status', 'Harga'];
  hdrs.forEach((h, i) => doc.text(h, cols[i] + 2, y + 4));
  y += 6;

  doc.setTextColor(30,30,60); doc.setFont(undefined, 'normal');
  k.slice(0, 60).forEach((item, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) { doc.setFillColor(248,248,255); doc.rect(14, y, 182, 5.5, 'F'); }
    doc.setFontSize(7);
    doc.text(item.nama.slice(0, 20), cols[0] + 1, y + 4);
    doc.text(item.hp || '', cols[1] + 1, y + 4);
    doc.text(`${(item.unit || '—').slice(0,8)}/${item.kavling || '—'}`, cols[2] + 1, y + 4);
    doc.text(sLabel(item.status), cols[3] + 1, y + 4);
    doc.text(fRp(item.harga), cols[4] + 1, y + 4);
    if (isAdmin) doc.text(ownerName(item.owner_id).slice(0, 16), cols[5] + 1, y + 4);
    y += 5.5;
  });
  if (k.length > 60) {
    doc.setFontSize(8); doc.setTextColor(130,130,160);
    doc.text(`... dan ${k.length - 60} konsumen lainnya`, 14, y + 4);
  }

  doc.save(`marketpro-laporan-${now.toISOString().slice(0,10)}.pdf`);
  showToast('Laporan PDF berhasil diunduh', '📄');
}

// ── SETUP GUIDE ──────────────────────────────────
function showSetupGuide() {
  document.body.innerHTML = `
  <div style="min-height:100dvh;background:var(--bg-base);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Outfit',sans-serif">
    <div style="max-width:480px;width:100%">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:28px">
        <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;font-size:22px">🎯</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-1px;color:#f0f0f8">Market<span style="color:#818cf8">Pro</span></div>
      </div>
      <div style="background:#0c0c12;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#f0f0f8;margin-bottom:6px">⚙️ Setup Diperlukan</div>
        <div style="font-size:13px;color:#9898b8;margin-bottom:20px">Konfigurasi Supabase untuk mengaktifkan aplikasi</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="background:#18181f;border-radius:12px;padding:14px">
            <div style="font-size:11px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Step 1 · Jalankan setup.sql di Supabase SQL Editor</div>
          </div>
          <div style="background:#18181f;border-radius:12px;padding:14px">
            <div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Step 2 · Aktifkan Realtime pada tabel konsumen</div>
          </div>
          <div style="background:#18181f;border-radius:12px;padding:14px">
            <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Step 3 · Isi SUPABASE_URL & SUPABASE_ANON_KEY di js/config.js</div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
