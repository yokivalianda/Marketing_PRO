// ═══════════════════════════════════════════════
// FITUR UPLOAD FOTO DOKUMEN
// Pakai Supabase Storage bucket: "dokumen"

// ── TEMPLATE BERKAS KPR PER BANK ─────────────────
const KPR_TEMPLATES = {
  'kpr-btn': {
    label: 'KPR BTN',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Surat Pemesanan Unit',
    ]
  },
  'kpr-bni': {
    label: 'KPR BNI',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Pas Foto 3x4 (2 lembar)',
    ]
  },
  'kpr-bri': {
    label: 'KPR BRI',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Surat Pemesanan Unit',
    ]
  },
  'kpr-mandiri': {
    label: 'KPR Mandiri',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja / SK Pengangkatan',
      'Rekening Tabungan 3 Bulan',
      'Surat Keterangan Belum Memiliki Rumah',
    ]
  },
  'kpr-bsm': {
    label: 'KPR BSM (Syariah)',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Surat Pemesanan Unit',
    ]
  },
  'kpr-bsi': {
    label: 'KPR BSI',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Pas Foto 3x4 (2 lembar)',
    ]
  },
  'kpr-sumsel': {
    label: 'KPR Bank Sumsel Babel',
    items: [
      'KTP Pemohon',
      'KTP Pasangan',
      'Kartu Keluarga',
      'Buku Nikah / Akta Cerai',
      'NPWP',
      'Slip Gaji 3 Bulan Terakhir',
      'Surat Keterangan Kerja',
      'Rekening Tabungan 3 Bulan',
      'Surat Pemesanan Unit',
    ]
  },
};

// Buka modal pilih template KPR (Business only)
async function openKPRTemplateModal(konsumenId, kprValue) {
  if (typeof requirePro === 'function' && !requirePro('kpr_template')) return;

  const template = KPR_TEMPLATES[kprValue];
  if (!template) {
    showToast('Template tidak tersedia untuk bank ini', '\u26a0\ufe0f');
    return;
  }

  const previewItems = template.items.slice(0, 5).map(i => '\u2022 ' + i).join('\n');
  const moreText = template.items.length > 5 ? `\n\u2022 ... +${template.items.length - 5} item lainnya` : '';
  const ok = await showConfirm(
    `Terapkan template checklist <strong>${template.label}</strong>?\n\n${template.items.length} item akan ditambahkan:\n${previewItems}${moreText}\n\nItem yang sudah ada tidak akan dihapus.`,
    '\ud83c\udfe6 Template KPR', `Terapkan ${template.label}`, false
  );
  if (!ok) return;

  applyKPRTemplate(konsumenId, kprValue, template);
}

async function applyKPRTemplate(konsumenId, kprValue, template) {
  const k = allKons.find(x => x.id === konsumenId);
  if (!k) return;

  const existing = normBerkas(k.berkas);
  const existingLabels = existing.map(b => b.label.toLowerCase());

  // Hanya tambah item yang belum ada
  const newItems = template.items.filter(
    item => !existingLabels.includes(item.toLowerCase())
  );

  if (newItems.length === 0) {
    showToast('Semua item template sudah ada di checklist', '✅');
    return;
  }

  // Tambah ke berkas
  const berkasArr = [...existing];
  newItems.forEach(label => {
    const key = 'kpr_' + label.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now() % 10000;
    berkasArr.push({ key, label, done: false });
  });

  setBtnLoading('btnApplyTemplate', true, 'Menerapkan...');
  try {
    const { error } = await sb.from('konsumen')
      .update({ berkas: berkasArr, updated_at: new Date().toISOString() })
      .eq('id', konsumenId);
    if (error) throw error;

    // Update local
    const idx = allKons.findIndex(x => x.id === konsumenId);
    if (idx >= 0) allKons[idx].berkas = berkasArr;

    showToast(`${newItems.length} item template ${template.label} ditambahkan`, '✅');

    // Refresh berkas section
    setTimeout(() => refreshBerkasSection(konsumenId), 300);
  } catch(e) {
    showToast('Gagal: ' + e.message, '❌');
  }
}

// Path: dokumen/{konsumen_id}/{berkas_key}/{filename}
// ═══════════════════════════════════════════════

const STORAGE_BUCKET = 'dokumen';

// ── UPLOAD FOTO ──────────────────────────────────
async function uploadFotoDokumen(konsumenId, berkasKey, file) {
  if (typeof requirePro === 'function' && !requirePro('upload_foto')) return null;
  const ext  = file.name.split('.').pop().toLowerCase();
  const safe = ['jpg','jpeg','png','gif','webp','pdf','heic','heif'];
  if (!safe.includes(ext)) {
    showToast('Format tidak didukung. Gunakan JPG, PNG, PDF, atau HEIC.', '⚠️');
    return null;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran file maksimal 10 MB', '⚠️');
    return null;
  }

  const ts       = Date.now();
  const filename = `${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  // Path: {user_id}/{konsumen_id}/{berkas_key}/{filename}
  // Folder pertama = user_id agar cocok dengan RLS policy
  const path     = `${me.id}/${konsumenId}/${berkasKey}/${filename}`;

  showToast('Mengupload...', '⏳');

  const { error } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) {
    if (error.message?.includes('bucket') || error.message?.includes('not found')) {
      showToast('Storage belum disetup. Lihat panduan setup.', '❌');
    } else {
      showToast('Upload gagal: ' + error.message, '❌');
    }
    return null;
  }

  return path;
}

// ── AMBIL SEMUA FOTO SATU BERKAS ─────────────────
async function listFotoBerkas(konsumenId, berkasKey) {
  const k       = allKons.find(x => x.id === konsumenId);
  const ownerId = k?.owner_id || me.id;

  // Coba dengan owner_id dulu (path standar)
  const tryList = async (uid) => {
    const { data, error } = await sb.storage
      .from(STORAGE_BUCKET)
      .list(`${uid}/${konsumenId}/${berkasKey}`, { sortBy: { column: 'created_at', order: 'asc' } });
    if (error || !data) return [];
    return data.filter(f => f.name && !f.name.startsWith('.')).map(f => ({
      name: f.name,
      path: `${uid}/${konsumenId}/${berkasKey}/${f.name}`,
      size: f.metadata?.size || 0,
    }));
  };

  let result = await tryList(ownerId);

  // Fallback: coba dengan me.id jika owner berbeda dan result kosong
  if (result.length === 0 && ownerId !== me.id) {
    result = await tryList(me.id);
  }

  return result;
}

// ── GET PUBLIC URL ────────────────────────────────
function getFotoUrl(path) {
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

// ── HAPUS FOTO ────────────────────────────────────
async function hapusFoto(path) {
  const { error } = await sb.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) { showToast('Gagal menghapus foto', '❌'); return false; }
  showToast('Foto dihapus', '🗑️');
  return true;
}

// ── RENDER BERKAS ITEM DENGAN FOTO ───────────────
async function renderBerkasWithFoto(konsumenId, berkasKey, berkasLabel, isDone, canEdit) {
  const fotos  = await listFotoBerkas(konsumenId, berkasKey);
  const count  = fotos.length;
  const thumbs = fotos.slice(0, 3).map(f => {
    const url = getFotoUrl(f.path);
    const isPdf = f.name.toLowerCase().endsWith('.pdf');
    return isPdf
      ? `<div class="berkas-thumb berkas-thumb-pdf" onclick="openFotoViewer('${konsumenId}','${berkasKey}','${f.path}',${fotos.indexOf(f)})" title="${f.name}">PDF</div>`
      : `<img class="berkas-thumb" src="${url}" onclick="openFotoViewer('${konsumenId}','${berkasKey}','${f.path}',${fotos.indexOf(f)})" loading="lazy" title="${f.name}" onerror="this.style.display='none'"/>`;
  }).join('');
  const more = count > 3 ? `<div class="berkas-thumb berkas-thumb-more">+${count - 3}</div>` : '';

  // Sanitize label & key untuk onclick string
  const safeLbl = berkasLabel.replace(/'/g, "\'");

  return `
    <div class="berkas-item-wrap" data-key="${berkasKey}">
      <div class="berkas-item" onclick="${canEdit ? `toggleBerkas('${konsumenId}','${berkasKey}')` : ''}" style="${canEdit ? '' : 'cursor:default'}">
        <div class="berkas-check ${isDone ? 'done' : ''}">${isDone ? '✓' : ''}</div>
        <div class="berkas-label ${isDone ? 'done' : ''}">${berkasLabel}</div>
        <div class="berkas-right">
          ${count > 0 ? `<span class="berkas-foto-count">${count} foto</span>` : ''}
          ${canEdit ? `
            <button class="berkas-upload-btn" onclick="event.stopPropagation();triggerUploadFoto('${konsumenId}','${berkasKey}')" title="Upload foto">📎</button>
            <button class="berkas-edit-btn" onclick="event.stopPropagation();promptEditBerkas('${konsumenId}','${berkasKey}','${safeLbl}')" title="Ubah nama">✏️</button>
            <button class="berkas-del-btn"  onclick="event.stopPropagation();hapusBerkasItem('${konsumenId}','${berkasKey}')" title="Hapus item">✕</button>
          ` : ''}
        </div>
      </div>
      ${count > 0 ? `
        <div class="berkas-thumbs" onclick="event.stopPropagation()">
          ${thumbs}${more}
        </div>` : ''}
      <input type="file" id="fileInput_${berkasKey}" accept="image/*,.pdf"
        style="display:none" multiple
        onchange="handleFotoUpload('${konsumenId}','${berkasKey}',this)"/>
    </div>`;
}

// ── PROMPT EDIT LABEL ─────────────────────────────
async function promptEditBerkas(konsumenId, key, currentLabel) {
  const newLabel = await showPrompt('Nama baru untuk berkas ini:', currentLabel, '\u270f\ufe0f Ubah Nama Berkas');
  if (newLabel && newLabel !== currentLabel) {
    editBerkas(konsumenId, key, newLabel);
  }
}

// ── TRIGGER FILE INPUT ────────────────────────────
function triggerUploadFoto(konsumenId, berkasKey) {
  if (typeof requirePro === 'function' && !requirePro('upload_foto')) return;
  const inp = document.getElementById(`fileInput_${berkasKey}`);
  if (inp) inp.click();
}

// ── HANDLE FILE UPLOAD ────────────────────────────
async function handleFotoUpload(konsumenId, berkasKey, input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  // Cek batas foto per berkas sesuai plan
  const maxFoto = PLANS[myPlan]?.maxFoto ?? 0;
  if (maxFoto === 0) {
    // Plan gratis — tidak bisa upload sama sekali
    if (typeof requirePro === 'function') requirePro('upload_foto');
    input.value = '';
    return;
  }
  // Hitung foto yang sudah ada di berkas ini
  const existing = await listFotoBerkas(konsumenId, berkasKey);
  const totalAfter = existing.length + files.length;
  if (maxFoto < 9999 && totalAfter > maxFoto) {
    const sisa = Math.max(0, maxFoto - existing.length);
    if (sisa === 0) {
      showToast(`Maks ${maxFoto} foto per berkas (plan ${PLANS[myPlan]?.name})`, '⚠️');
      input.value = '';
      return;
    }
    showToast(`Hanya ${sisa} foto lagi yang bisa ditambah (maks ${maxFoto})`, '⚠️');
  }

  const allowedFiles = maxFoto < 9999
    ? files.slice(0, Math.max(0, maxFoto - existing.length))
    : files;

  let uploaded = 0;
  for (const file of allowedFiles) {
    const path = await uploadFotoDokumen(konsumenId, berkasKey, file);
    if (path) uploaded++;
  }
  input.value = '';

  if (uploaded > 0) {
    showToast(`${uploaded} foto berhasil diupload`, '✅');

    // Log aktivitas
    const k = allKons.find(x => x.id === konsumenId);
    if (k) {
      const berkasLabels = { ktp:'KTP',kk:'Kartu Keluarga',slip:'Slip Gaji',tabungan:'Rekening Tabungan',npwp:'NPWP',surat:'Surat Lainnya' };
      const log = [...(k.log||[]), {
        action: `Foto ${berkasLabels[berkasKey] || berkasKey} diupload (${uploaded} file)`,
        time: new Date().toISOString(), note: ''
      }];
      await sb.from('konsumen').update({ log }).eq('id', konsumenId);
    }

    // Refresh hanya bagian berkas — tidak re-render seluruh modal
    // Delay sedikit agar Supabase Storage selesai mengindex file
    await new Promise(r => setTimeout(r, 600));
    await refreshBerkasSection(konsumenId);
  }
}

// ── FOTO VIEWER / LIGHTBOX ────────────────────────
let _viewerFotos  = [];
let _viewerIndex  = 0;
let _viewerKonsId = '';
let _viewerKey    = '';

async function openFotoViewer(konsumenId, berkasKey, clickedPath, startIndex) {
  _viewerKonsId = konsumenId;
  _viewerKey    = berkasKey;
  _viewerIndex  = startIndex || 0;
  _viewerFotos  = await listFotoBerkas(konsumenId, berkasKey);

  if (!_viewerFotos.length) return;
  renderViewer();
  openModal('modalFotoViewer');
}

function renderViewer() {
  const foto   = _viewerFotos[_viewerIndex];
  if (!foto) return;
  const url    = getFotoUrl(foto.path);
  const isPdf  = foto.name.toLowerCase().endsWith('.pdf');
  const canDel = myProf?.role === 'admin' || allKons.find(k => k.id === _viewerKonsId)?.owner_id === me.id;
  const total  = _viewerFotos.length;

  document.getElementById('viewerContent').innerHTML = isPdf
    ? `<div class="viewer-pdf-wrap">
        <div class="viewer-pdf-icon">📄</div>
        <div class="viewer-pdf-name">${foto.name}</div>
        <a href="${url}" target="_blank" class="viewer-pdf-open">Buka PDF ↗</a>
       </div>`
    : `<img src="${url}" class="viewer-img" onclick="event.stopPropagation()" onerror="this.src='';this.alt='Gagal memuat foto'"/>`;

  document.getElementById('viewerCounter').textContent = `${_viewerIndex + 1} / ${total}`;
  document.getElementById('viewerFilename').textContent = foto.name;
  document.getElementById('viewerPrev').style.display = _viewerIndex > 0        ? 'flex' : 'none';
  document.getElementById('viewerNext').style.display = _viewerIndex < total - 1 ? 'flex' : 'none';
  document.getElementById('viewerDelete').style.display = canDel ? 'flex' : 'none';
  document.getElementById('viewerDownload').href = url;
}

function viewerPrev() { if (_viewerIndex > 0) { _viewerIndex--; renderViewer(); } }
function viewerNext() { if (_viewerIndex < _viewerFotos.length - 1) { _viewerIndex++; renderViewer(); } }

async function viewerDelete() {
  const foto = _viewerFotos[_viewerIndex];
  if (!foto) return;
  const ok = await showConfirm(`Hapus foto "${foto.name}"?\nTindakan ini tidak dapat dibatalkan.`, '\ud83d\uddd1\ufe0f Hapus Foto', 'Ya, Hapus', true);
  if (!ok) return;
  const done = await hapusFoto(foto.path);
  if (done) {
    _viewerFotos.splice(_viewerIndex, 1);
    if (!_viewerFotos.length) {
      closeModal('modalFotoViewer');
      setTimeout(() => openDetail(_viewerKonsId), 200);
      return;
    }
    _viewerIndex = Math.min(_viewerIndex, _viewerFotos.length - 1);
    renderViewer();
    setTimeout(() => openDetail(_viewerKonsId), 300);
  }
}

// ── REFRESH HANYA SECTION BERKAS (tanpa re-render seluruh modal) ──
async function refreshBerkasSection(konsumenId) {
  const sec = document.getElementById('berkasSection');
  if (!sec) return; // Modal sudah ditutup

  const k = allKons.find(x => x.id === konsumenId);
  if (!k) return;
  const canEdit = myProf?.role === 'admin' || k.owner_id === me.id;

  // Tampilkan loading singkat
  sec.querySelector('.berkas-grid') && (sec.querySelector('.berkas-grid').style.opacity = '0.5');

  const berkasHtml = await buildBerkasSection(k, canEdit);
  // Cek lagi apakah section masih ada (user mungkin sudah tutup modal)
  const secNow = document.getElementById('berkasSection');
  if (secNow) {
    secNow.innerHTML = `
      <div class="det-sec-label">Checklist Berkas & Dokumen
        ${canEdit ? '<span style="font-size:10px;color:var(--text-4);font-weight:400;margin-left:6px">Ketuk 📎 untuk upload foto</span>' : ''}
      </div>
      <div class="berkas-grid">${berkasHtml}</div>`;
  }
}

// ── RENDER CHECKLIST BERKAS DENGAN FOTO (ASYNC) ──
async function buildBerkasSection(k, canEdit) {
  const list = normBerkas(k.berkas);

  // Parallel fetch semua foto
  const berkasHtmls = await Promise.all(
    list.map(bx => renderBerkasWithFoto(k.id, bx.key, bx.label, !!bx.done, canEdit))
  );

  // Tombol tambah item + template KPR (Business only)
  let addBtn = '';
  if (canEdit) {
    const kprVal = k.kpr || '';
    const hasTemplate = KPR_TEMPLATES[kprVal] && typeof isBusiness === 'function' && isBusiness();
    const templateBtn = hasTemplate ? `
      <button class="berkas-template-btn" id="btnApplyTemplate"
        onclick="openKPRTemplateModal('${k.id}','${kprVal}')">
        🏦 Template ${KPR_TEMPLATES[kprVal]?.label}
      </button>` : '';
    addBtn = `
      <div class="berkas-add-row">
        ${templateBtn}
        <button class="berkas-add-btn" onclick="promptTambahBerkas('${k.id}')">
          ＋ Tambah Item Berkas
        </button>
      </div>`;
  }

  return berkasHtmls.join('') + addBtn;
}

// ── PROMPT TAMBAH BERKAS ──────────────────────────
async function promptTambahBerkas(konsumenId) {
  const label = await showPrompt('Nama item berkas baru:', '', '\u002b Tambah Berkas');
  if (label) tambahBerkas(konsumenId, label);
}
