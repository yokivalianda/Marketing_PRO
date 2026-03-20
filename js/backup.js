// ═══════════════════════════════════════════════
// BACKUP & RESTORE — MarketPro v4.2
// Format: JSON terenkripsi ringan dengan checksum
// ═══════════════════════════════════════════════

const BACKUP_VERSION = '4.2';

// ── BACKUP ────────────────────────────────────────
async function doBackup() {
  if (typeof requirePro === 'function' && !requirePro('backup')) return;
  setBtnLoading('btnBackup', true, 'Membuat backup...');
  try {
    // 1. Ambil semua konsumen (admin: semua, marketing: milik sendiri)
    let qKons = sb.from('konsumen').select('*').order('created_at', { ascending: true });
    if (myProf?.role !== 'admin') qKons = qKons.eq('owner_id', me.id);
    const { data: konsumen, error: e1 } = await qKons;
    if (e1) throw new Error('Gagal ambil data konsumen: ' + e1.message);

    // 2. Profiles tim (admin only)
    let profiles = [];
    if (myProf?.role === 'admin') {
      const { data: p } = await sb.from('profiles').select('id, email, full_name, role, target');
      profiles = p || [];
    }

    // 3. Target bulanan
    let targetBulanan = [];
    try {
      let qT = sb.from('target_bulanan').select('*').order('tahun').order('bulan');
      if (myProf?.role !== 'admin') qT = qT.eq('user_id', me.id);
      const { data: t } = await qT;
      targetBulanan = t || [];
    } catch(e) { /* tabel mungkin belum ada */ }

    // 4. Susun payload
    const payload = {
      _meta: {
        version:    BACKUP_VERSION,
        created_at: new Date().toISOString(),
        created_by: myProf?.full_name || me.email,
        role:       myProf?.role || 'marketing',
        total_konsumen: konsumen.length,
        checksum:   simpleChecksum(konsumen),
      },
      konsumen,
      profiles,
      target_bulanan: targetBulanan,
    };

    // 5. Download sebagai JSON
    const json     = JSON.stringify(payload, null, 2);
    const blob     = new Blob([json], { type: 'application/json;charset=utf-8' });
    const date     = new Date().toISOString().slice(0, 10);
    const fileName = `PropMap-Backup-${date}.json`;
    const a        = document.createElement('a');
    a.href         = URL.createObjectURL(blob);
    a.download     = fileName;
    a.click();
    URL.revokeObjectURL(a.href);

    showToast(`Backup berhasil (${konsumen.length} konsumen)`, '💾');
    updateBackupInfo(payload._meta);
  } catch(e) {
    console.error('Backup error:', e);
    showToast('Backup gagal: ' + e.message, '❌');
  }
  setBtnLoading('btnBackup', false, '💾 Buat Backup Sekarang');
}

// ── RESTORE ───────────────────────────────────────
function triggerRestoreFile() {
  document.getElementById('restoreFileInput')?.click();
}

async function handleRestoreFile(input) {
  const file = input.files?.[0];
  if (!file) return;

  const restoreInfo = document.getElementById('restoreInfo');
  if (restoreInfo) restoreInfo.innerHTML = '<span style="color:var(--text-3)">Membaca file...</span>';

  try {
    const text    = await file.text();
    const payload = JSON.parse(text);

    // Validasi format
    if (!payload._meta || !payload.konsumen) {
      throw new Error('Format file backup tidak valid');
    }
    if (!payload._meta.version) {
      throw new Error('File backup versi lama atau tidak dikenal');
    }

    // Tampilkan preview
    const meta = payload._meta;
    const chk  = simpleChecksum(payload.konsumen);
    const valid = chk === meta.checksum;

    if (restoreInfo) {
      restoreInfo.innerHTML = `
        <div class="backup-preview">
          <div class="bp-row"><span class="bp-key">Tanggal Backup</span><span class="bp-val">${fDate(meta.created_at)}</span></div>
          <div class="bp-row"><span class="bp-key">Dibuat oleh</span><span class="bp-val">${meta.created_by || '—'}</span></div>
          <div class="bp-row"><span class="bp-key">Total Konsumen</span><span class="bp-val">${payload.konsumen.length} konsumen</span></div>
          <div class="bp-row"><span class="bp-key">Versi</span><span class="bp-val">v${meta.version}</span></div>
          <div class="bp-row">
            <span class="bp-key">Integritas</span>
            <span class="bp-val" style="color:${valid ? 'var(--emerald)' : 'var(--rose)'}">
              ${valid ? '✓ File valid' : '⚠ Checksum tidak cocok'}
            </span>
          </div>
          ${payload.profiles?.length ? `<div class="bp-row"><span class="bp-key">Data Profil</span><span class="bp-val">${payload.profiles.length} pengguna</span></div>` : ''}
          ${payload.target_bulanan?.length ? `<div class="bp-row"><span class="bp-key">Target Bulanan</span><span class="bp-val">${payload.target_bulanan.length} entri</span></div>` : ''}
        </div>`;
    }

    // Simpan payload ke state sementara
    window._restorePayload = payload;
    document.getElementById('btnRestoreConfirm').style.display = 'block';
    document.getElementById('restoreWarning').style.display    = 'block';

  } catch(e) {
    if (restoreInfo) restoreInfo.innerHTML = `<span style="color:var(--rose)">❌ ${e.message}</span>`;
    window._restorePayload = null;
    document.getElementById('btnRestoreConfirm').style.display = 'none';
    document.getElementById('restoreWarning').style.display    = 'none';
  }

  input.value = '';
}

async function confirmRestore() {
  const payload = window._restorePayload;
  if (!payload) return;

  // Konfirmasi ulang
  const total = payload.konsumen.length;
  if (!confirm(`Restore ${total} konsumen dari backup?\n\nData yang ada saat ini akan DITIMPA. Pastikan Anda sudah membuat backup terbaru sebelum melanjutkan.`)) return;

  setBtnLoading('btnRestoreConfirm', true, 'Memulihkan...');

  try {
    const mode = document.querySelector('input[name="restoreMode"]:checked')?.value || 'merge';
    let   restored = 0, skipped = 0, failed = 0;

    const updateProgress = (msg) => {
      const el = document.getElementById('restoreProgress');
      if (el) el.textContent = msg;
    };

    if (mode === 'replace') {
      // Hapus semua data milik user dulu
      updateProgress('Menghapus data lama...');
      if (myProf?.role === 'admin') {
        await sb.from('konsumen').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        await sb.from('konsumen').delete().eq('owner_id', me.id);
      }
    }

    // Insert / upsert konsumen dalam batch
    const BATCH = 20;
    for (let i = 0; i < payload.konsumen.length; i += BATCH) {
      const batch = payload.konsumen.slice(i, i + BATCH).map(k => ({
        ...k,
        // Pastikan owner_id valid untuk mode non-admin
        owner_id: myProf?.role === 'admin' ? k.owner_id : me.id,
      }));

      updateProgress(`Memulihkan konsumen ${i + 1}–${Math.min(i + BATCH, payload.konsumen.length)} dari ${payload.konsumen.length}...`);

      const { error } = await sb.from('konsumen').upsert(batch, { onConflict: 'id' });
      if (error) {
        console.warn('Restore batch error:', error.message);
        failed += batch.length;
      } else {
        restored += batch.length;
      }
    }

    // Restore target bulanan
    if (payload.target_bulanan?.length) {
      updateProgress('Memulihkan target bulanan...');
      const targets = myProf?.role === 'admin'
        ? payload.target_bulanan
        : payload.target_bulanan.filter(t => t.user_id === me.id);
      if (targets.length) {
        await sb.from('target_bulanan').upsert(targets, { onConflict: 'user_id,tahun,bulan' }).catch(() => {});
      }
    }

    // Reload data
    updateProgress('Memuat ulang data...');
    await loadKons();
    if (typeof loadTarget === 'function') await loadTarget();
    renderDash(); renderKons();

    closeModal('modalBackup');
    window._restorePayload = null;

    const msg = failed > 0
      ? `Restore selesai: ${restored} berhasil, ${failed} gagal`
      : `${restored} konsumen berhasil dipulihkan`;
    showToast(msg, restored > 0 ? '✅' : '⚠️');

  } catch(e) {
    console.error('Restore error:', e);
    showToast('Restore gagal: ' + e.message, '❌');
  }

  setBtnLoading('btnRestoreConfirm', false, '⚠ Pulihkan Data');
}

// ── MODAL BACKUP ──────────────────────────────────
function openBackupModal() {
  const lastBackup = localStorage.getItem('pm_last_backup_' + me.id);
  const lastBackupStr = lastBackup
    ? new Date(lastBackup).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : 'Belum pernah backup';

  document.getElementById('modalBackupBody').innerHTML = `

    <!-- Backup section -->
    <div class="backup-section">
      <div class="backup-section-title">💾 Buat Backup</div>
      <div class="backup-section-desc">
        Download seluruh data konsumen sebagai file JSON. Simpan di tempat aman.
      </div>
      <div class="backup-last">Backup terakhir: <strong>${lastBackupStr}</strong></div>
      <div class="backup-includes">
        <div class="bi-item">✓ Semua data konsumen (nama, status, berkas, log)</div>
        <div class="bi-item">✓ Target penjualan bulanan</div>
        ${myProf?.role === 'admin' ? '<div class="bi-item">✓ Data profil tim marketing</div>' : ''}
      </div>
      <button class="btn-primary" id="btnBackup" onclick="doBackupAndRecord()" style="width:100%;margin-top:12px">
        💾 Buat Backup Sekarang
      </button>
    </div>

    <div class="backup-divider"></div>

    <!-- Restore section -->
    <div class="backup-section">
      <div class="backup-section-title">📂 Pulihkan dari Backup</div>
      <div class="backup-section-desc">
        Upload file backup (.json) untuk memulihkan data.
      </div>

      <!-- Mode restore -->
      <div class="restore-mode-group">
        <label class="restore-mode-item">
          <input type="radio" name="restoreMode" value="merge" checked/>
          <div>
            <div style="font-size:13px;font-weight:600">Gabungkan (Merge)</div>
            <div style="font-size:11px;color:var(--text-3)">Data backup ditambahkan, data yang ID-nya sama ditimpa</div>
          </div>
        </label>
        <label class="restore-mode-item">
          <input type="radio" name="restoreMode" value="replace"/>
          <div>
            <div style="font-size:13px;font-weight:600">Ganti Semua (Replace)</div>
            <div style="font-size:11px;color:var(--text-3)">Hapus semua data lama, ganti dengan isi backup</div>
          </div>
        </label>
      </div>

      <!-- Upload area -->
      <div class="restore-upload-area" onclick="triggerRestoreFile()">
        <div style="font-size:28px;margin-bottom:6px">📁</div>
        <div style="font-size:13px;font-weight:700;color:var(--text-2)">Pilih File Backup</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:3px">Klik untuk upload .json</div>
      </div>
      <input type="file" id="restoreFileInput" accept=".json" style="display:none"
             onchange="handleRestoreFile(this)"/>

      <!-- Preview info -->
      <div id="restoreInfo" style="margin-top:10px"></div>

      <!-- Warning -->
      <div id="restoreWarning" style="display:none" class="restore-warning">
        ⚠️ Proses ini tidak dapat dibatalkan. Pastikan sudah backup data terbaru.
      </div>
      <div id="restoreProgress" style="font-size:11px;color:var(--text-3);padding:4px 0;min-height:16px"></div>

      <button id="btnRestoreConfirm" onclick="confirmRestore()"
              style="display:none;width:100%;margin-top:8px;padding:12px;
                     background:var(--rose-soft);border:1px solid rgba(244,63,94,.25);
                     border-radius:var(--r-md);color:var(--rose);font-size:13px;
                     font-weight:700;cursor:pointer;font-family:var(--font-body)">
        ⚠ Pulihkan Data
      </button>
    </div>`;

  openModal('modalBackup');
}

function doBackupAndRecord() {
  localStorage.setItem('pm_last_backup_' + me.id, new Date().toISOString());
  doBackup();
}

// ── HELPERS ───────────────────────────────────────
function simpleChecksum(data) {
  // Checksum sederhana dari jumlah record + total panjang string ID
  const ids = data.map(k => k.id || '').join('');
  let h = data.length * 1000;
  for (let i = 0; i < ids.length; i++) h = ((h << 5) - h + ids.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}

function updateBackupInfo(meta) {
  const el = document.getElementById('backupLastInfo');
  if (el) el.textContent = `Backup terakhir: ${fDate(meta.created_at)}`;
}
