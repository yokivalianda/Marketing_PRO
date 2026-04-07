// ── INIT ─────────────────────────────────────────
async function init() {
  setLoadTxt('Menginisialisasi...');

  if (SUPABASE_URL === 'GANTI_DENGAN_URL_SUPABASE_ANDA') {
    hideSplash(); showSetupGuide(); return;
  }

  // Init Supabase client
  try {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch(e) {
    hideSplash(); showAuth();
    showAuthErr('Gagal inisialisasi Supabase: ' + e.message);
    return;
  }

  // Password recovery
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

  // Cek sesi
  let session = null;
  try {
    setLoadTxt('Memeriksa sesi...');
    const { data } = await sb.auth.getSession();
    session = data?.session;
  } catch(e) {
    hideSplash(); showAuth();
    showAuthErr('Gagal terhubung ke Supabase. Periksa koneksi internet.');
    return;
  }

  if (!session) { hideSplash(); showAuth(); return; }

  // afterLogin — error di sini tidak boleh muncul sebagai "Gagal terhubung"
  try {
    await afterLogin(session.user);
  } catch(e) {
    console.error('afterLogin error:', e);
    hideSplash(); showAuth();
    showAuthErr('Gagal memuat data: ' + (e.message || 'Unknown error'));
  }
}

// ── AFTER LOGIN ──────────────────────────────────
async function afterLogin(user) {
  me = user;
  setLoadTxt('Memuat profil...');
  let { data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (!prof) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    await sb.from('profiles').insert({
      id: user.id, email: user.email, full_name: name, role: 'marketing', target: 5,
      plan: 'trial', trial_ends: trialEnds.toISOString(),
    });
    ({ data: prof } = await sb.from('profiles').select('*').eq('id', user.id).single());
  }
  myProf = prof;
  setLoadTxt('Memuat data...');
  await Promise.all([loadProfs(), loadKonsWithFallback ? loadKonsWithFallback() : loadKons()]);
  setupRealtime();
  hideSplash(); hideAuth();
  const shell = document.getElementById('shell');
  shell.style.display = 'flex'; shell.classList.add('show');
  updateHeaderUI();
  setupAdminUI();
  await loadTarget();
  if (typeof setupTargetAdminLink === "function") setupTargetAdminLink();
  await loadPlan();
  renderPlanInfo();
  renderDash(); renderKons();
  if (typeof renderMonthFilter === "function") renderMonthFilter();
  // Init push notification setelah login
  if (typeof initOffline === 'function') initOffline();
  setTimeout(() => { if(typeof initPush === 'function') initPush(); }, 1000);
  setTimeout(() => { if(typeof checkAndSendPushReminders === 'function') checkAndSendPushReminders(); }, 2000);
  initTheme();
}

// ── HEADER & ADMIN UI ───────────────────────────
function updateHeaderUI() {
  // Deteksi desktop
  const isDesktop = window.innerWidth >= 768;
  const sidebarUser   = document.getElementById('sidebarUser');
  const sidebarBottom = document.getElementById('sidebarBottom');
  if (sidebarUser)   sidebarUser.style.display   = isDesktop ? 'flex'  : 'none';
  if (sidebarBottom) sidebarBottom.style.display  = isDesktop ? 'flex'  : 'none';
  // Sync sidebar user info
  const sidebarAv   = document.getElementById('sidebarAvatar');
  const sidebarName = document.getElementById('sidebarName');
  const sidebarRole = document.getElementById('sidebarRole');
  const sidebarThemeIco = document.getElementById('sidebarThemeIco');
  const name = myProf?.full_name || me.email;
  const initial = name.charAt(0).toUpperCase();
  const ci = Math.abs(hsh(me.id)) % 8;
  document.getElementById('hAvatar').textContent = initial;
  document.getElementById('hAvatar').className = `pill-avatar av${ci}`;
  document.getElementById('hName').textContent = name.split(' ')[0];
  const rb = document.getElementById('hRole');
  rb.textContent = myProf?.role === 'admin' ? 'Admin' : 'Marketing';
  rb.className = `pill-role${myProf?.role === 'admin' ? ' admin' : ''}`;
  if (sidebarAv)   { sidebarAv.textContent = initial; sidebarAv.className = `sidebar-user-av av${ci}`; }
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarRole) sidebarRole.textContent = myProf?.role === 'admin' ? '👑 Admin' : '📊 Marketing';
  if (sidebarThemeIco) sidebarThemeIco.textContent = document.documentElement.classList.contains('light') ? '☀️' : '🌙';
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
  // Tampilkan backup untuk marketing Pro (dikontrol juga oleh updatePlanUI)
  const mktgBackup = document.getElementById('marketingBackupGrp');
  if (mktgBackup) mktgBackup.style.display = (!isAdmin && typeof isPro === 'function' && isPro()) ? 'block' : 'none';

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
  // Cache ke IndexedDB untuk mode offline
  if (typeof cacheKonsumen === 'function' && allKons.length > 0) {
    cacheKonsumen(allKons).catch(() => {});
  }
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
      if (typeof checkAndSendPushReminders === 'function') checkAndSendPushReminders();
      if (curPage === 'konsumen')  { renderKons(); if (typeof renderMonthFilter === 'function') renderMonthFilter(); }
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
    harga:       getRpValue('fHarga'),
    dp:          getRpValue('fDP'),
    status:      document.getElementById('fStatus').value,
    tgl_booking: document.getElementById('fTglBooking').value || null,
    tgl_followup:document.getElementById('fTglFollowup').value || null,
    kpr:         document.getElementById('fKPR').value,
    sumber:      document.getElementById('fSumber').value,
    catatan:     document.getElementById('fCatatan').value.trim(),
  };
  // Cek mode offline
  if (typeof saveKonsOffline === 'function') {
    const handled = await saveKonsOffline(obj, eid || null);
    if (handled) { closeModal('modalAdd'); return; }
  }
  setBtnLoading('btnSave', true, 'Menyimpan...');
  try {
    if (eid) {
      const ex = allKons.find(k => k.id === eid);

      // ── OPTIMISTIC LOCKING ───────────────────────
      // Bandingkan updated_at yang disimpan saat buka form vs yang ada di DB sekarang
      const savedUpdatedAt = document.getElementById('editUpdatedAt')?.value || '';
      if (savedUpdatedAt) {
        const { data: fresh, error: fetchErr } = await sb
          .from('konsumen').select('updated_at, nama, status, harga, dp, catatan')
          .eq('id', eid).single();

        if (!fetchErr && fresh) {
          const dbTime   = new Date(fresh.updated_at).getTime();
          const formTime = new Date(savedUpdatedAt).getTime();

          if (dbTime > formTime) {
            // KONFLIK — ada perubahan dari user lain sejak form dibuka
            setBtnLoading('btnSave', false, 'Simpan Data');
            showConflictModal(eid, ex, fresh, obj);
            return;
          }
        }
      }
      // ── END OPTIMISTIC LOCKING ───────────────────

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
      obj.berkas = [];
      obj.log = [{ action: 'Konsumen ditambahkan', time: new Date().toISOString(), note: obj.catatan }];
      // Cek limit konsumen untuk plan free
      if (!checkKonsumenLimit()) {
        setBtnLoading('btnSave', false, 'Simpan Data');
        closeModal('modalAdd');
        openUpgradeModal('limit_konsumen');
        return;
      }
      const { error } = await sb.from('konsumen').insert(obj);
      if (error) throw error;
      showToast('Konsumen ditambahkan', '✅');
    }
    closeModal('modalAdd');
  } catch(e) { showToast('Gagal: ' + e.message, '❌'); }
  setBtnLoading('btnSave', false, 'Simpan Data');
}

async function hapusKons() {
  const eid = document.getElementById('editId')?.value;
  if (!eid) return;
  const k = allKons.find(x => x.id === eid);
  const nama = k?.nama || 'konsumen ini';
  const ok = await showConfirm(`Hapus data <strong>${nama}</strong>?<br><br>Semua data termasuk berkas dan log akan dihilangkan permanen.`, '🗑️ Hapus Konsumen', 'Ya, Hapus', true);
  if (!ok) return;
  const { error } = await sb.from('konsumen').delete().eq('id', eid);
  if (!error) {
    allKons = allKons.filter(k => k.id !== eid);
    closeModal('modalAdd');
    closeModal('modalDetail');
    renderKons();
    renderDash();
    updateNotifPip();
    showToast('Konsumen dihapus', '🗑️');
  } else {
    showToast('Gagal menghapus', '❌');
  }
}

// ── CONFLICT MODAL ───────────────────────────────
function showConflictModal(id, localData, serverData, pendingObj) {
  // Simpan pending obj untuk opsi force save
  window._conflictPending = { id, pendingObj };

  const diffRows = [];

  const fields = [
    { key: 'nama',    label: 'Nama' },
    { key: 'status',  label: 'Status',  fmt: sLabel },
    { key: 'harga',   label: 'Harga',   fmt: fRpFull },
    { key: 'dp',      label: 'DP',      fmt: fRpFull },
    { key: 'catatan', label: 'Catatan' },
  ];

  fields.forEach(f => {
    const localVal  = localData?.[f.key];
    const serverVal = serverData?.[f.key];
    const pendingVal = pendingObj?.[f.key];
    if (String(serverVal || '') !== String(localVal || '')) {
      diffRows.push({ label: f.label, server: f.fmt ? f.fmt(serverVal) : (serverVal || '—'), yours: f.fmt ? f.fmt(pendingVal) : (pendingVal || '—') });
    }
  });

  document.getElementById('conflictBody').innerHTML = `
    <div style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
      <strong>${serverData.nama || localData?.nama}</strong> sudah diubah oleh pengguna lain
      sejak Anda membuka form edit.
    </div>
    ${diffRows.length ? `
    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.7px;margin-bottom:8px">Perbedaan yang terdeteksi</div>
    <div class="conflict-table">
      <div class="ct-header">
        <span>Field</span><span>Di Database</span><span>Perubahan Anda</span>
      </div>
      ${diffRows.map(r => `
        <div class="ct-row">
          <span class="ct-field">${r.label}</span>
          <span class="ct-server">${r.server}</span>
          <span class="ct-yours">${r.yours}</span>
        </div>`).join('')}
    </div>` : '<div style="font-size:12px;color:var(--text-3)">Data berubah tapi tidak terdeteksi perbedaan di field utama.</div>'}
    <div class="conflict-actions">
      <button class="conflict-btn-reload" onclick="reloadAndDiscard('${id}')">
        🔄 Pakai Data Terbaru
        <span style="font-size:10px;color:var(--text-3);font-weight:400;display:block;margin-top:1px">Perubahan Anda dibatalkan</span>
      </button>
      <button class="conflict-btn-force" onclick="forceOverwrite()">
        ⚡ Simpan Paksa
        <span style="font-size:10px;color:var(--text-3);font-weight:400;display:block;margin-top:1px">Timpa perubahan terbaru</span>
      </button>
    </div>`;

  openModal('modalConflict');
}

async function reloadAndDiscard(id) {
  closeModal('modalConflict');
  closeModal('modalAdd');
  // Refresh data dari server
  await loadKons();
  renderKons(); renderDash();
  // Buka ulang form dengan data terbaru
  setTimeout(() => openEditModal(id), 300);
  showToast('Form diperbarui dengan data terbaru', 'ℹ️');
  window._conflictPending = null;
}

async function forceOverwrite() {
  const { id, pendingObj } = window._conflictPending || {};
  if (!id || !pendingObj) return;

  closeModal('modalConflict');
  setBtnLoading('btnSave', true, 'Menyimpan...');

  try {
    const ex = allKons.find(k => k.id === id);
    pendingObj.log = [...(ex?.log || [])];
    pendingObj.log.push({ action: 'Data ditimpa (force save)', time: new Date().toISOString(), note: '' });
    if (ex && ex.status !== pendingObj.status) {
      pendingObj.log.push({ action: `Status: ${sLabel(ex.status)} → ${sLabel(pendingObj.status)}`, time: new Date().toISOString(), note: '' });
    }

    // Update TANPA cek updated_at (force)
    const { error } = await sb.from('konsumen').update(pendingObj).eq('id', id);
    if (error) throw error;

    closeModal('modalAdd');
    showToast('Data berhasil disimpan (paksa)', '✅');
  } catch(e) {
    showToast('Gagal simpan paksa: ' + e.message, '❌');
  }

  setBtnLoading('btnSave', false, 'Simpan Data');
  window._conflictPending = null;
}

async function toggleBerkas(id, key) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  const berkas = normBerkas(k.berkas).map(b =>
    b.key === key ? { ...b, done: !b.done } : b
  );
  const item = berkas.find(b => b.key === key);
  const log  = [...(k.log || []), {
    action: `Berkas ${item?.label || key}: ${item?.done ? '✅ Sudah' : '❌ Belum'}`,
    time: new Date().toISOString(), note: ''
  }];
  const { error } = await sb.from('konsumen').update({ berkas, log }).eq('id', id);
  if (!error) {
    const i = allKons.findIndex(x => x.id === id);
    if (i >= 0) allKons[i] = { ...allKons[i], berkas, log };
  }
  showToast(item?.done ? `${item?.label} ✓` : `${item?.label} belum`, item?.done ? '✅' : '📋');
  openDetail(id);
}

// ── NORMALIZE BERKAS (support format lama & baru) ─
function normBerkas(raw) {
  // Format baru: array [{key, label, done}]
  if (Array.isArray(raw)) return raw;
  // Format lama: object {ktp: bool, kk: bool, ...}
  if (raw && typeof raw === 'object') {
    const labels = { ktp:'KTP / e-KTP', kk:'Kartu Keluarga', slip:'Slip Gaji / SK Kerja',
                     tabungan:'Rekening Tabungan 3 Bln', npwp:'NPWP', surat:'Surat Keterangan Lainnya' };
    return Object.entries(raw).map(([key, done]) => ({
      key, label: labels[key] || key, done: !!done
    }));
  }
  return [];
}

// ── TAMBAH ITEM BERKAS ────────────────────────────
async function tambahBerkas(id, label) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  label = label.trim();
  if (!label) return;
  const berkas = normBerkas(k.berkas);
  // Buat key unik dari label
  const key = 'custom_' + Date.now();
  berkas.push({ key, label, done: false });
  const log = [...(k.log||[]), { action: `Berkas ditambahkan: ${label}`, time: new Date().toISOString(), note: '' }];
  const { error } = await sb.from('konsumen').update({ berkas, log }).eq('id', id);
  if (!error) {
    const i = allKons.findIndex(x => x.id === id);
    if (i >= 0) allKons[i] = { ...allKons[i], berkas, log };
    showToast(`"${label}" ditambahkan`, '✅');
  } else {
    showToast('Gagal menambah berkas', '❌');
  }
  openDetail(id);
}

// ── EDIT LABEL BERKAS ─────────────────────────────
async function editBerkas(id, key, newLabel) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  newLabel = newLabel.trim();
  if (!newLabel) return;
  const berkas = normBerkas(k.berkas).map(b =>
    b.key === key ? { ...b, label: newLabel } : b
  );
  const { error } = await sb.from('konsumen').update({ berkas }).eq('id', id);
  if (!error) {
    const i = allKons.findIndex(x => x.id === id);
    if (i >= 0) allKons[i] = { ...allKons[i], berkas };
    showToast('Nama berkas diubah', '✅');
  } else {
    showToast('Gagal mengubah', '❌');
  }
  openDetail(id);
}

// ── HAPUS ITEM BERKAS ─────────────────────────────
async function hapusBerkasItem(konsumenId, key) {
  const k = allKons.find(x => x.id === konsumenId);
  const item = normBerkas(k?.berkas).find(b => b.key === key);
  const ok = await showConfirm(`Hapus item berkas <strong>"${item?.label || key}"</strong>?`, '🗑️ Hapus Berkas', 'Ya, Hapus', true);
  if (!ok) return;
  const berkas = normBerkas(k.berkas).filter(b => b.key !== key);
  const log = [...(k.log||[]), { action: `Berkas dihapus: ${item?.label || key}`, time: new Date().toISOString(), note: '' }];
  const { error } = await sb.from('konsumen').update({ berkas, log }).eq('id', konsumenId);
  if (!error) {
    const i = allKons.findIndex(x => x.id === konsumenId);
    if (i >= 0) allKons[i] = { ...allKons[i], berkas, log };
    showToast(`"${item?.label}" dihapus`, '🗑️');
  } else {
    showToast('Gagal menghapus', '❌');
  }
  openDetail(konsumenId); // [FIX #1] was `id` (undefined) → konsumenId
}

async function addLog(id) {
  const note = await showPrompt('Tambah catatan aktivitas:', '', '📝 Tambah Catatan');
  if (!note) return;
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
  if (!requirePro('export')) return;
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
  a.download = `propmap-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('Data diekspor ke CSV', '📤');
}

// ── EXPORT EXCEL XLSX ────────────────────────────
function exportXLSX() {
  if (!requirePro('export')) return;
  if (typeof XLSX === 'undefined') {
    showToast('Memuat library Excel...', '⏳');
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = _doExportXLSX;
    document.head.appendChild(s);
    return;
  }
  _doExportXLSX();
}

function _doExportXLSX() {
  try {
    const wb    = XLSX.utils.book_new();
    const k     = filterByPeriod(allKons, curPeriod);
    const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });

    // ── SHEET 1: Data Konsumen ────────────────────
    const konsHeaders = [
      'No','Nama Konsumen','No. HP','Unit','Kavling',
      'Status','Harga (Rp)','DP (Rp)','Tgl Booking',
      'Tgl Follow-up','KPR/Pembiayaan','Sumber Leads',
      'Marketing','Berkas Lengkap','Catatan'
    ];
    const konsRows = k.map((c, i) => {
      const bList = normBerkas(c.berkas || []);
      const bOk   = bList.filter(b => b.done).length;
      const bTot  = bList.length;
      return [
        i + 1,
        c.nama || '',
        c.hp || '',
        c.unit || '',
        c.kavling || '',
        sLabel(c.status),
        c.harga || 0,
        c.dp || 0,
        c.tgl_booking || '',
        c.tgl_followup || '',
        kprLabel(c.kpr),
        sumberLabel(c.sumber),
        ownerName(c.owner_id),
        bTot > 0 ? `${bOk}/${bTot}` : '-',
        c.catatan || ''
      ];
    });

    const wsKons = XLSX.utils.aoa_to_sheet([konsHeaders, ...konsRows]);

    // Lebar kolom
    wsKons['!cols'] = [
      {wch:4},{wch:24},{wch:16},{wch:10},{wch:8},
      {wch:14},{wch:16},{wch:16},{wch:12},
      {wch:12},{wch:18},{wch:14},
      {wch:16},{wch:12},{wch:30}
    ];

    // Style header (bold + background)
    const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: '6366F1' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } };
    konsHeaders.forEach((_, ci) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (wsKons[cellRef]) wsKons[cellRef].s = headerStyle;
    });

    XLSX.utils.book_append_sheet(wb, wsKons, 'Data Konsumen');

    // ── SHEET 2: Ringkasan ────────────────────────
    const statuses = [
      { k: 'cek-lokasi', l: 'Prospek Konsumen' },
      { k: 'booking',    l: 'Booking' },
      { k: 'dp',         l: 'Proses DP' },
      { k: 'berkas',     l: 'Kumpul Berkas' },
      { k: 'acc',        l: 'SP3K/ACC' },
      { k: 'selesai',    l: 'Selesai (Akad)' },
      { k: 'batal',      l: 'Batal' },
    ];
    const totalSelesai = k.filter(x => x.status === 'selesai');
    const totalNilai   = totalSelesai.reduce((s, x) => s + (x.harga || 0), 0);
    const totalDP      = k.reduce((s, x) => s + (x.dp || 0), 0);

    const ringkasanData = [
      ['LAPORAN RINGKASAN PROPMAP', ''],
      ['Tanggal Export', today],
      ['Periode', getPeriodLabel()],
      ['', ''],
      ['PIPELINE STATUS', 'Jumlah Konsumen'],
      ...statuses.map(s => [s.l, k.filter(x => x.status === s.k).length]),
      ['', ''],
      ['TOTAL KONSUMEN (excl. Prospek)', k.filter(x => x.status !== 'cek-lokasi').length],
      ['Akad Selesai', totalSelesai.length],
      ['Total Nilai Jual (Rp)', totalNilai],
      ['Total DP Masuk (Rp)', totalDP],
    ];

    // Sumber leads breakdown
    ringkasanData.push(['', '']);
    ringkasanData.push(['SUMBER LEADS', 'Jumlah']);
    const sumberMap = {};
    k.forEach(x => { const s = x.sumber || 'Lainnya'; sumberMap[s] = (sumberMap[s]||0)+1; });
    Object.entries(sumberMap).sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => {
      ringkasanData.push([sumberLabel(s), n]);
    });

    // KPR breakdown
    ringkasanData.push(['', '']);
    ringkasanData.push(['JENIS PEMBIAYAAN', 'Jumlah']);
    const kprMap = {};
    k.forEach(x => { if (x.kpr) kprMap[x.kpr] = (kprMap[x.kpr]||0)+1; });
    Object.entries(kprMap).sort((a,b)=>b[1]-a[1]).forEach(([k2,n]) => {
      ringkasanData.push([kprLabel(k2), n]);
    });

    const wsRingkasan = XLSX.utils.aoa_to_sheet(ringkasanData);
    wsRingkasan['!cols'] = [{wch:30},{wch:22}];
    XLSX.utils.book_append_sheet(wb, wsRingkasan, 'Ringkasan');

    // ── SHEET 3: Per Marketing (admin only) ───────
    if (myProf?.role === 'admin' && allProfs.length > 0) {
      const mktg = allProfs.filter(p => p.role !== 'admin');
      if (mktg.length > 0) {
        const mktgHeaders = ['Marketing', 'Total Konsumen', 'Prospek', 'Booking', 'Proses DP', 'Berkas', 'SP3K/ACC', 'Selesai', 'Batal', 'Nilai Jual (Rp)', 'DP Masuk (Rp)'];
        const mktgRows = mktg.map(p => {
          const mk = k.filter(x => x.owner_id === p.id);
          return [
            p.full_name || p.email,
            mk.filter(x => x.status !== 'cek-lokasi').length,
            mk.filter(x => x.status === 'cek-lokasi').length,
            mk.filter(x => x.status === 'booking').length,
            mk.filter(x => x.status === 'dp').length,
            mk.filter(x => x.status === 'berkas').length,
            mk.filter(x => x.status === 'acc').length,
            mk.filter(x => x.status === 'selesai').length,
            mk.filter(x => x.status === 'batal').length,
            mk.filter(x => x.status === 'selesai').reduce((s,x)=>s+(x.harga||0),0),
            mk.reduce((s,x)=>s+(x.dp||0),0),
          ];
        });
        const wsMktg = XLSX.utils.aoa_to_sheet([mktgHeaders, ...mktgRows]);
        wsMktg['!cols'] = [{wch:20},{wch:14},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:18},{wch:16}];
        XLSX.utils.book_append_sheet(wb, wsMktg, 'Per Marketing');
      }
    }

    // Download
    const fileName = `PropMap-Laporan-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('Laporan Excel berhasil diunduh', '📊');

  } catch(e) {
    console.error('exportXLSX:', e);
    showToast('Gagal export Excel: ' + e.message, '❌');
  }
}

function getPeriodLabel() {
  if (curDateFrom || curDateTo) {
    const from = curDateFrom ? new Date(curDateFrom).toLocaleDateString('id-ID') : '—';
    const to   = curDateTo   ? new Date(curDateTo).toLocaleDateString('id-ID')   : '—';
    return `${from} – ${to}`;
  }
  const labels = { bulan: 'Bulan Ini', kuartal: 'Kuartal Ini', tahun: 'Tahun Ini', semua: 'Semua Waktu' };
  return labels[curPeriod] || 'Semua Waktu';
}

// ── EXPORT PDF via jsPDF ─────────────────────────
function exportPDF() {
  if (!requirePro('export')) return;
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
  doc.text('PropMap — Laporan Penjualan', 14, 12);
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

  doc.save(`propmap-laporan-${now.toISOString().slice(0,10)}.pdf`);
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

// ── IMPORT EXCEL ──────────────────────────────────
function openImportModal() {
  if (!requirePro('import')) return;
  document.getElementById('importDropzone').classList.remove('dragover');
  document.getElementById('importFileInput').value = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importPreviewWrap').style.display = 'none';
  document.getElementById('importStatus').innerHTML = '';
  document.getElementById('btnImportConfirm').style.display = 'none';
  window._importRows = [];
  openModal('modalImport');
}

function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('importDropzone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
}

function handleImportFile(input) {
  const file = input.files[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    showImportStatus('❌ File harus berformat .xlsx, .xls, atau .csv', 'error');
    return;
  }

  showImportStatus('⏳ Membaca file...', 'info');

  if (typeof XLSX === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => _readExcel(file);
    document.head.appendChild(s);
  } else {
    _readExcel(file);
  }
}

function _readExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!raw.length) { showImportStatus('❌ Sheet kosong atau tidak ada data', 'error'); return; }

      // Auto-detect column mapping (flexible header names)
      const sample = Object.keys(raw[0]);
      const map = autoMapColumns(sample);
      const rows = raw.map(r => mapRow(r, map)).filter(r => r != null && r.nama && r.hp);

      if (!rows.length) {
        showImportStatus(`❌ Tidak ada baris valid. Pastikan ada kolom Nama dan HP/No. HP`, 'error');
        return;
      }

      window._importRows = rows;
      renderImportPreview(rows, sample, map);
      showImportStatus(`✅ ${rows.length} baris siap diimport${raw.length - rows.length > 0 ? ` (${raw.length - rows.length} baris dilewati karena nama/HP kosong)` : ''}`, 'success');
      document.getElementById('btnImportConfirm').style.display = 'block';
    } catch(err) {
      showImportStatus('❌ Gagal membaca file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Map header variations ke field internal
function autoMapColumns(headers) {
  const norm = h => h.toLowerCase().replace(/[\s_\-\.\/]/g,'');
  const aliases = {
    nama:        ['nama','name','namalengkap','namakonsumen','fullname'],
    hp:          ['hp','nohp','telepon','phone','notelp','nomortelepon','wa','whatsapp','nowa','handphone'],
    unit:        ['unit','tipeunit','typeunit','tipeproperty','tipe'],
    kavling:     ['kavling','nokavling','kavlingnomor','no','nokav','blok'],
    harga:       ['harga','price','hargajual','hargaunit','nilai'],
    dp:          ['dp','uangmuka','downpayment','jumlahdp'],
    status:      ['status','pipeline','fase'],
    tgl_booking: ['tglbooking','tanggalbooking','tglbook','bookingdate','tgltransaksibooking'],
    tgl_followup:['tglfollowup','followup','jadwalfollowup','tglfu','followupdate'],
    kpr:         ['kpr','pembiayaan','jeniskpr','tipekpr','financing'],
    sumber:      ['sumber','sumberleads','leads','channel','sourceofleads','asal'],
    catatan:     ['catatan','notes','keterangan','note','remark'],
  };
  const result = {};
  headers.forEach(h => {
    const n = norm(h);
    for (const [field, aliasArr] of Object.entries(aliases)) {
      if (aliasArr.some(a => n.includes(a) || a.includes(n))) {
        if (!result[field]) result[field] = h;
        break;
      }
    }
  });
  return result;
}

function mapRow(row, map) {
  const get = f => map[f] ? String(row[map[f]] ?? '').trim() : '';
  const nama = get('nama');
  const hp   = get('hp').replace(/\D/g,'').replace(/^62/,'0').replace(/^0{2}62/,'0');
  if (!nama || !hp) return null;

  // Normalize status
  const rawStatus = get('status').toLowerCase();
  const statusMap = {
    booking:['booking','book'], dp:['dp','proses dp','uang muka','down payment'],
    berkas:['berkas','kumpul berkas','dokumen'], selesai:['selesai','akad','done','lunas'],
    batal:['batal','cancel','batal']
  };
  let status = 'booking';
  for (const [k,v] of Object.entries(statusMap)) { if (v.some(s => rawStatus.includes(s))) { status = k; break; } }

  // Normalize KPR
  const rawKpr = get('kpr').toLowerCase();
  let kpr = '';
  if (rawKpr.includes('btn')) kpr = 'kpr-btn';
  else if (rawKpr.includes('bni')) kpr = 'kpr-bni';
  else if (rawKpr.includes('bri')) kpr = 'kpr-bri';
  else if (rawKpr.includes('mandiri')) kpr = 'kpr-mandiri';
  else if (rawKpr.includes('syariah')||rawKpr.includes('bsm')) kpr = 'kpr-bsm';
  else if (rawKpr.includes('keras')) kpr = 'cash-keras';
  else if (rawKpr.includes('bertahap')) kpr = 'cash-bertahap';
  else if (rawKpr.includes('subsidi')||rawKpr.includes('flpp')) kpr = 'subsidi';

  // Normalize sumber
  const rawSumber = get('sumber').toLowerCase();
  let sumber = '';
  if (rawSumber.includes('referral')) sumber = 'referral';
  else if (rawSumber.includes('medsos')||rawSumber.includes('sosial')||rawSumber.includes('instagram')||rawSumber.includes('facebook')) sumber = 'medsos';
  else if (rawSumber.includes('pameran')) sumber = 'pameran';
  else if (rawSumber.includes('brosur')||rawSumber.includes('spanduk')) sumber = 'brosur';
  else if (rawSumber.includes('website')||rawSumber.includes('online')) sumber = 'website';
  else if (rawSumber.includes('walk')) sumber = 'walk-in';
  else if (rawSumber.includes('telepon')||rawSumber.includes('call')) sumber = 'telepon';

  // Parse harga & dp
  const parseRp = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g,'')); return isNaN(n) ? 0 : n < 1000 ? n * 1e6 : n; };

  // Parse date
  const parseDate = v => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0,10);
    const s = String(v).trim();
    if (!s) return null;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) { const y = m[3].length===2?'20'+m[3]:m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
    // Try YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    return null;
  };

  return {
    nama, hp,
    unit:        get('unit'),
    kavling:     get('kavling'),
    harga:       parseRp(get('harga')),
    dp:          parseRp(get('dp')),
    status, kpr, sumber,
    tgl_booking: parseDate(map.tgl_booking ? row[map.tgl_booking] : ''),
    tgl_followup:parseDate(map.tgl_followup ? row[map.tgl_followup] : ''),
    catatan:     get('catatan'),
  };
}

function renderImportPreview(rows, allHeaders, map) {
  const wrap = document.getElementById('importPreviewWrap');
  const el   = document.getElementById('importPreview');
  wrap.style.display = 'block';

  // Show mapping summary
  const mappedFields = Object.entries(map).filter(([,v])=>v).map(([k,v])=>`<span style="background:var(--brand-soft);color:var(--brand-light);padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${v} → ${k}</span>`).join(' ');
  const unmapped = allHeaders.filter(h => !Object.values(map).includes(h));

  let html = `
    <div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">Kolom Terdeteksi</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${mappedFields || '<span style="color:var(--text-4);font-size:12px">Tidak ada kolom terdeteksi</span>'}</div>
      ${unmapped.length ? `<div style="font-size:10px;color:var(--text-4);margin-top:5px">Dilewati: ${unmapped.join(', ')}</div>` : ''}
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Preview (maks. 5 baris)</div>
    <div style="overflow-x:auto;border-radius:var(--r-sm);border:1px solid var(--glass-border)">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="background:var(--bg-elevated)">
          <th style="padding:7px 10px;text-align:left;color:var(--text-3);font-weight:700">Nama</th>
          <th style="padding:7px 10px;text-align:left;color:var(--text-3);font-weight:700">HP</th>
          <th style="padding:7px 10px;text-align:left;color:var(--text-3);font-weight:700">Unit</th>
          <th style="padding:7px 10px;text-align:left;color:var(--text-3);font-weight:700">Status</th>
          <th style="padding:7px 10px;text-align:left;color:var(--text-3);font-weight:700">Harga</th>
        </tr>
      </thead>
      <tbody>
        ${rows.slice(0,5).map((r,i)=>`
          <tr style="border-top:1px solid var(--glass-border);background:${i%2?'var(--glass-10)':'transparent'}">
            <td style="padding:7px 10px;font-weight:600">${r.nama}</td>
            <td style="padding:7px 10px;color:var(--text-2)">${r.hp}</td>
            <td style="padding:7px 10px;color:var(--text-2)">${r.unit||'—'}</td>
            <td style="padding:7px 10px"><span class="s-badge s-${r.status}" style="font-size:9px">${sLabel(r.status)}</span></td>
            <td style="padding:7px 10px;color:var(--text-2)">${fRp(r.harga)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>
    ${rows.length > 5 ? `<div style="font-size:11px;color:var(--text-4);margin-top:6px;text-align:center">... dan ${rows.length-5} baris lainnya</div>` : ''}`;
  el.innerHTML = html;
}

function showImportStatus(msg, type) {
  const colors = { error: 'var(--rose)', success: 'var(--emerald)', info: 'var(--brand-light)' };
  document.getElementById('importStatus').innerHTML =
    `<div style="font-size:13px;font-weight:600;color:${colors[type]||'var(--text-1)'};padding:10px 0">${msg}</div>`;
}

async function confirmImport() {
  const rows = window._importRows;
  if (!rows || !rows.length) return;

  const btn = document.getElementById('btnImportConfirm');
  btn.disabled = true; btn.textContent = `Mengimport 0/${rows.length}...`;

  let ok = 0, fail = 0;
  const batchSize = 20;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => ({
      ...r,
      owner_id:   me.id,
      owner_name: myProf?.full_name || me.email,
      berkas:     [],
      log:        [{ action: 'Diimport dari Excel', time: new Date().toISOString(), note: r.catatan || '' }],
    }));
    const { error } = await sb.from('konsumen').insert(batch);
    if (error) { fail += batch.length; }
    else        { ok  += batch.length; }
    btn.textContent = `Mengimport ${Math.min(i+batchSize, rows.length)}/${rows.length}...`;
  }

  await loadKons();
  closeModal('modalImport');
  if (fail === 0) {
    showToast(`✅ ${ok} konsumen berhasil diimport!`, '');
  } else {
    showToast(`⚠️ ${ok} berhasil, ${fail} gagal`, '');
  }
  if (curPage === 'konsumen') renderKons();
  if (curPage === 'dashboard') renderDash();
}
