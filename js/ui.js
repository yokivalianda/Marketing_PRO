// ── NAVIGATION ───────────────────────────────────
function switchPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
  document.getElementById('pg-' + p).classList.add('on');
  document.getElementById('tab-' + p).classList.add('on');
  curPage = p;
  document.getElementById('scrollArea').scrollTop = 0;
  if (p === 'dashboard') renderDash();
  if (p === 'laporan')   { renderLapKpi(); renderCharts(); }
  if (p === 'kalender')  renderKalender();
}

// ── DASHBOARD ─────────────────────────────────────
function renderDash() {
  const k = allKons;
  document.getElementById('stTotal').textContent      = k.filter(x => x.status !== 'cek-lokasi').length;
  document.getElementById('stSelesai').textContent    = k.filter(x => x.status === 'selesai').length;
  document.getElementById('stDP').textContent         = k.filter(x => x.status === 'dp').length;
  document.getElementById('stBooking').textContent    = k.filter(x => x.status === 'booking').length;
  const elCL = document.getElementById('stCekLokasi');
  if (elCL) elCL.textContent = k.filter(x => x.status === 'cek-lokasi').length;
  const elAcc = document.getElementById('stAcc');
  if (elAcc) elAcc.textContent = k.filter(x => x.status === 'acc').length;
  document.getElementById('stTotalSub').textContent = myProf?.role === 'admin' ? 'Semua tim' : 'Konsumen saya';

  const pipes = [
    { k: 'cek-lokasi', l: 'Prospek Konsumen', c: 'cek-lokasi' },
    { k: 'booking', l: 'Booking', c: 'booking' },
    { k: 'dp', l: 'Proses DP', c: 'dp' },
    { k: 'berkas', l: 'Berkas', c: 'berkas' },
    { k: 'acc',     l: 'SP3K/ACC', c: 'acc' },
    { k: 'selesai', l: 'Selesai', c: 'selesai' },
    { k: 'batal', l: 'Batal', c: 'batal' },
  ];
  document.getElementById('pipeScroll').innerHTML = pipes.map(p => `
    <div class="pc-${p.c}" onclick="setFilter('${p.k}');switchPage('konsumen')">
      <div class="pipe-card">
        <div class="pipe-num">${k.filter(x => x.status === p.k).length}</div>
        <div class="pipe-label">${p.l}</div>
      </div>
    </div>`).join('');

  if (myProf?.role === 'admin') {
    const mt = allProfs.filter(p => p.role !== 'admin');
    document.getElementById('teamGrid').innerHTML = mt.map((p, i) => {
      const cnt  = k.filter(x => x.owner_id === p.id).length;
      const done = k.filter(x => x.owner_id === p.id && x.status === 'selesai').length;
      return `<div class="team-tile"><div class="team-av av${i % 8}">${(p.full_name || '?').charAt(0).toUpperCase()}</div>
        <div><div class="team-name">${p.full_name || p.email}</div><div class="team-sub">${cnt} konsumen · ${done} selesai</div></div></div>`;
    }).join('') || `<div style="color:var(--text-4);font-size:12px;padding:4px">Belum ada anggota</div>`;
  }

  // Upcoming follow-ups
  const upcoming = k.filter(x => x.tgl_followup && new Date(x.tgl_followup) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.tgl_followup) - new Date(b.tgl_followup)).slice(0, 3);
  const upEl = document.getElementById('upcomingFollowup');
  if (upEl) {
    upEl.innerHTML = upcoming.length
      ? upcoming.map((x, i) => `
        <div class="feed-item" onclick="openDetail('${x.id}')">
          <div class="feed-av av${i % 8}">${x.nama.charAt(0).toUpperCase()}</div>
          <div class="feed-info">
            <div class="feed-name">${x.nama}</div>
            <div class="feed-meta"><span class="s-badge s-${x.status}" style="font-size:9px;padding:2px 7px">${sLabel(x.status)}</span></div>
          </div>
          <div class="feed-time" style="color:var(--amber)">${fDateShort(x.tgl_followup)}</div>
        </div>`).join('')
      : `<div style="color:var(--text-4);font-size:12px;padding:8px 0">Tidak ada jadwal follow-up</div>`;
  }

  const recent = k.slice(0, 6);
  const fl = document.getElementById('feedList');
  if (!recent.length) {
    fl.innerHTML = `<div class="empty-state"><div class="empty-ico">📭</div><div class="empty-title">Belum ada data</div><div class="empty-sub">Tambahkan konsumen pertama</div></div>`;
    return;
  }
  fl.innerHTML = recent.map((k, i) => `
    <div class="feed-item" onclick="openDetail('${k.id}')">
      <div class="feed-av av${i % 8}">${k.nama.charAt(0).toUpperCase()}</div>
      <div class="feed-info">
        <div class="feed-name">${k.nama}</div>
        <div class="feed-meta">
          <span>${k.unit || '—'}</span>
          <span class="feed-dot"></span>
          <span class="s-badge s-${k.status}" style="font-size:9px;padding:2px 7px">${sLabel(k.status)}</span>
          ${myProf?.role === 'admin' ? `<span class="feed-dot"></span><span>${ownerName(k.owner_id)}</span>` : ''}
        </div>
      </div>
      <div class="feed-time">${relTime(k.created_at)}</div>
    </div>`).join('');
}

// ── KONSUMEN LIST ────────────────────────────────
function fillAdminSel() {
  const sel = document.getElementById('adminSel');
  if (!sel) return;
  sel.innerHTML = '<option value="">Semua Marketing</option>';
  allProfs.filter(p => p.role !== 'admin').forEach(p => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.full_name || p.email;
    sel.appendChild(o);
  });
}

function setFilter(f) {
  curFilter = f;
  document.querySelectorAll('.ftag').forEach(c => c.classList.toggle('on', c.dataset.f === f));
  renderKons();
}

function toggleSort() {
  // Siklus: default → A→Z → Z→A → default
  if (curSort === '')   curSort = 'az';
  else if (curSort === 'az') curSort = 'za';
  else curSort = '';

  const btn = document.getElementById('sortBtn');
  if (curSort === 'az') {
    btn.textContent = 'A→Z';
    btn.classList.add('on');
  } else if (curSort === 'za') {
    btn.textContent = 'Z→A';
    btn.classList.add('on');
  } else {
    btn.textContent = 'A→Z';
    btn.classList.remove('on');
  }
  renderKons();
}


// ── FILTER LANJUTAN ──────────────────────────────
function toggleFilterAdv() {
  if (!requirePro('filter_lanjutan')) return;
  const panel = document.getElementById('filterAdvPanel');
  const btn   = document.getElementById('filterAdvBtn');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('on', !isOpen);
  updateFilterAdvBadge();
}

function setFchip(groupId, val) {
  document.querySelectorAll('#' + groupId + ' .fchip').forEach(c =>
    c.classList.toggle('on', c.dataset.v === val)
  );
  renderKons();
  updateFilterAdvBadge();
}

function getAdvFilters() {
  if (!document.getElementById('filterAdvPanel'))
    return { sumber:'', kpr:'', berkas:'', followup:'', hargaMin:0, hargaMax:0, tglMin:'', tglMax:'' };
  return {
    sumber:   document.querySelector('#fAdvSumber .fchip.on')?.dataset.v   || '',
    kpr:      document.querySelector('#fAdvKpr .fchip.on')?.dataset.v      || '',
    berkas:   document.querySelector('#fAdvBerkas .fchip.on')?.dataset.v   || '',
    followup: document.querySelector('#fAdvFollowup .fchip.on')?.dataset.v || '',
    hargaMin: getRpValue('fAdvHargaMin') || 0,
    hargaMax: getRpValue('fAdvHargaMax') || 0,
    tglMin:   document.getElementById('fAdvTglMin')?.value  || '',
    tglMax:   document.getElementById('fAdvTglMax')?.value  || '',
  };
}

function countActiveAdv() {
  const f = getAdvFilters();
  return [f.sumber, f.kpr, f.berkas, f.followup,
          f.hargaMin > 0, f.hargaMax > 0, f.tglMin, f.tglMax
  ].filter(Boolean).length;
}

function updateFilterAdvBadge() {
  const btn = document.getElementById('filterAdvBtn');
  if (!btn) return;
  const n = countActiveAdv();
  const isOpen = document.getElementById('filterAdvPanel')?.style.display !== 'none';
  btn.classList.toggle('on', n > 0 || isOpen);
  // Badge angka
  const badge = btn.querySelector('.fadv-count');
  if (n > 0) {
    if (!badge) {
      const b = document.createElement('span');
      b.className = 'fadv-count';
      b.textContent = n;
      btn.appendChild(b);
    } else { badge.textContent = n; }
  } else {
    badge?.remove();
  }
}

function resetFilterAdv() {
  ['fAdvSumber','fAdvKpr','fAdvBerkas','fAdvFollowup'].forEach(id => {
    document.querySelectorAll('#' + id + ' .fchip').forEach(c =>
      c.classList.toggle('on', c.dataset.v === '')
    );
  });
  ['fAdvHargaMin','fAdvHargaMax'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.dataset.raw = ''; }
  });
  ['fAdvTglMin','fAdvTglMax'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderKons();
  updateFilterAdvBadge();
}

function applyAdvFilters(list) {
  const f   = getAdvFilters();
  const now = new Date();
  const todayStr = now.toDateString();

  if (f.sumber)   list = list.filter(k => k.sumber === f.sumber);
  if (f.kpr)      list = list.filter(k => k.kpr === f.kpr);
  if (f.hargaMin) list = list.filter(k => (k.harga || 0) >= f.hargaMin);
  if (f.hargaMax) list = list.filter(k => (k.harga || 0) <= f.hargaMax);
  if (f.tglMin)   list = list.filter(k => k.tgl_booking && k.tgl_booking >= f.tglMin);
  if (f.tglMax)   list = list.filter(k => k.tgl_booking && k.tgl_booking <= f.tglMax);

  if (f.berkas) {
    list = list.filter(k => {
      const bList = normBerkas(k.berkas);
      if (f.berkas === 'kosong')  return bList.length === 0;
      if (f.berkas === 'lengkap') return bList.length > 0 && bList.every(b => b.done);
      if (f.berkas === 'belum')   return bList.length > 0 && bList.some(b => !b.done);
      return true;
    });
  }

  if (f.followup) {
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - now.getDay());
    const endWeek   = new Date(startWeek); endWeek.setDate(startWeek.getDate() + 6);
    list = list.filter(k => {
      const fd = k.tgl_followup ? new Date(k.tgl_followup + 'T00:00:00') : null;
      if (f.followup === 'belum-ada')   return !k.tgl_followup;
      if (!fd) return false;
      if (f.followup === 'hari-ini')    return fd.toDateString() === todayStr;
      if (f.followup === 'minggu-ini')  return fd >= startWeek && fd <= endWeek;
      if (f.followup === 'terlambat')   return fd < new Date(todayStr);
      return true;
    });
  }

  return list;
}

// ── FILTER BULAN ─────────────────────────────────
let curMonthKey = ''; // format: YYYY-MM

function toggleMonthFilter() {
  const bar = document.getElementById('monthFilterBar');
  const btn = document.getElementById('monthFilterBtn');
  if (!bar) return;
  const isOpen = bar.style.display !== 'none';
  bar.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('on', !isOpen);
  if (!isOpen) renderMonthFilter();
}

function renderMonthFilter() {
  const chipsEl = document.getElementById('monthChips');
  if (!chipsEl) return;

  const field = document.getElementById('monthFilterField')?.value || 'tgl_booking';

  // Kumpulkan semua bulan yang ada dari field yang dipilih
  const monthSet = {};
  allKons.forEach(k => {
    const raw = k[field];
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d)) return;
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    if (!monthSet[key]) monthSet[key] = label;
  });

  // Sort terbaru dulu
  const months = Object.entries(monthSet).sort((a, b) => b[0].localeCompare(a[0]));

  if (!months.length) {
    chipsEl.innerHTML = '<span style="font-size:12px;color:var(--text-4)">Tidak ada data</span>';
    return;
  }

  chipsEl.innerHTML = months.map(([key, label]) => `
    <button class="mchip ${curMonthKey === key ? 'on' : ''}"
            onclick="setMonthFilter('${key}')">
      ${label}
      <span class="mchip-count">${countByMonth(key, field)}</span>
    </button>`).join('');
}

function countByMonth(monthKey, field) {
  return allKons.filter(k => {
    const raw = k[field]; if (!raw) return false;
    const d = new Date(raw); if (isNaN(d)) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return key === monthKey;
  }).length;
}

function setMonthFilter(key) {
  curMonthKey = curMonthKey === key ? '' : key; // toggle
  const clearBtn = document.getElementById('monthFilterClear');
  const btn      = document.getElementById('monthFilterBtn');
  if (clearBtn) clearBtn.style.display = curMonthKey ? 'flex' : 'none';
  if (btn) btn.classList.toggle('on', !!curMonthKey || document.getElementById('monthFilterBar')?.style.display !== 'none');
  renderMonthFilter();
  renderKons();
  updateMonthFilterBadge();
}

function clearMonthFilter() {
  curMonthKey = '';
  const clearBtn = document.getElementById('monthFilterClear');
  if (clearBtn) clearBtn.style.display = 'none';
  updateMonthFilterBadge();
  renderMonthFilter();
  renderKons();
}

function updateMonthFilterBadge() {
  const btn = document.getElementById('monthFilterBtn');
  if (!btn) return;
  const isOpen = document.getElementById('monthFilterBar')?.style.display !== 'none';
  btn.classList.toggle('on', !!curMonthKey || isOpen);
  // Badge bulan aktif
  const badge = btn.querySelector('.mfilter-badge');
  if (curMonthKey) {
    const d = new Date(curMonthKey + '-01');
    const short = d.toLocaleDateString('id-ID', { month: 'short' });
    if (!badge) {
      const b = document.createElement('span');
      b.className = 'mfilter-badge';
      b.textContent = short;
      btn.appendChild(b);
    } else badge.textContent = short;
  } else {
    badge?.remove();
  }
}

function applyMonthFilter(list) {
  if (!curMonthKey) return list;
  const field = document.getElementById('monthFilterField')?.value || 'tgl_booking';
  return list.filter(k => {
    const raw = k[field]; if (!raw) return false;
    const d = new Date(raw); if (isNaN(d)) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    return key === curMonthKey;
  });
}

function renderKons() {
  const q  = (document.getElementById('searchFld')?.value || '').toLowerCase();
  const ow = document.getElementById('adminSel')?.value || '';
  let list = [...allKons];
  if (curFilter !== 'semua') list = list.filter(k => k.status === curFilter);
  if (ow) list = list.filter(k => k.owner_id === ow);
  if (q)  list = list.filter(k =>
    k.nama.toLowerCase().includes(q) ||
    (k.hp || '').includes(q) ||
    (k.unit || '').toLowerCase().includes(q) ||
    (k.kavling || '').toLowerCase().includes(q)
  );

  // Filter lanjutan
  list = applyAdvFilters(list);
  // Filter bulan
  list = applyMonthFilter(list);

  if (curSort === 'az') list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  if (curSort === 'za') list.sort((a, b) => b.nama.localeCompare(a.nama, 'id'));

  const el = document.getElementById('konsFeed');

  // Counter hasil
  const counter = document.getElementById('konsResultCount');
  if (counter) {
    const total = allKons.length;
    const hasFilter = countActiveAdv() > 0 || q || (curFilter !== 'semua') || ow;
    if (hasFilter && list.length < total) {
      counter.textContent = list.length + ' dari ' + total + ' konsumen';
      counter.style.display = 'block';
    } else {
      counter.style.display = 'none';
    }
  }

  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-ico">🔍</div><div class="empty-title">Tidak ditemukan</div><div class="empty-sub">Ubah filter atau kata kunci</div></div>`;
    return;
  }

  el.innerHTML = list.map(k => cardHtml(k)).join('');
}

function cardHtml(k) {
  const bList = normBerkas(k.berkas);
  const bOk   = bList.filter(b => b.done).length;
  const bTot  = bList.length;
  const hasFollowup = k.tgl_followup && new Date(k.tgl_followup) >= new Date(new Date().toDateString());
  return `<div class="kons-card st-${k.status}" ${k._pending ? 'data-pending="true"' : ''} onclick="openDetail('${k.id}')">
    <div class="card-top">
      <div>
        <div class="card-name">${k.nama}</div>
        <div class="card-unit">${k.unit || '—'} · Kav. ${k.kavling || '—'}</div>
        ${myProf?.role === 'admin' ? `<div class="card-owner">👤 ${ownerName(k.owner_id)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="s-badge s-${k.status}">${sLabel(k.status)}</span>
        ${hasFollowup ? `<span style="font-size:9px;color:var(--amber);font-weight:700">📅 ${fDateShort(k.tgl_followup)}</span>` : ''}
      </div>
    </div>
    <div class="card-footer">
      <div class="card-stat">📞 ${k.hp}</div>
      <div class="card-stat">💰 ${fRp(k.harga)}</div>
      <div class="card-stat">📁 ${bOk}/${bTot}</div>
    </div>
  </div>`;
}

// ── DETAIL MODAL ──────────────────────────────────
async function openDetail(id) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  const canEdit = myProf?.role === 'admin' || k.owner_id === me.id;
  const ci = Math.abs(hsh(id)) % 8;
  const logHtml = (k.log || []).slice().reverse().map(l => `
    <div class="tl-item">
      <div class="tl-dot">📌</div>
      <div class="tl-body">
        <div class="tl-action">${l.action}</div>
        <div class="tl-time">${fDate(l.time)}</div>
        ${l.note ? `<div class="tl-note">${l.note}</div>` : ''}
      </div>
    </div>`).join('') || `<div style="color:var(--text-4);font-size:12px;padding:8px 0">Belum ada log</div>`;

  // Skeleton dulu biar modal langsung terbuka
  document.getElementById('detailSheet').innerHTML = `
    <div class="sheet-pill"></div>
    <div class="sheet-head">
      <div class="sheet-title">Detail Konsumen</div>
      <button class="sheet-close" onclick="closeModal('modalDetail')">✕</button>
    </div>
    <div class="det-hero">
      <div class="det-avatar av${ci}">${k.nama.charAt(0).toUpperCase()}</div>
      <div>
        <div class="det-name">${k.nama}</div>
        <div class="det-unit">${k.unit || '—'} · Kav. ${k.kavling || '—'}</div>
        <span class="s-badge s-${k.status}" style="display:inline-block;margin-top:6px">${sLabel(k.status)}</span>
        ${k.tgl_followup ? `<div style="font-size:11px;color:var(--amber);margin-top:4px;font-weight:600">📅 Follow-up: ${fDateShort(k.tgl_followup)}</div>` : ''}
      </div>
    </div>
    <div class="qa-row">
      <button class="qa-btn qa-call" onclick="window.open('tel:${k.hp}')"><span class="qa-ico">📞</span>Telepon</button>
      <button class="qa-btn qa-wa"   onclick="window.open('https://wa.me/62${(k.hp || '').replace(/^0/, '')}')"><span class="qa-ico">💬</span>WhatsApp</button>
      ${canEdit ? `<button class="qa-btn qa-edit" onclick="openEditModal('${id}')"><span class="qa-ico">✏️</span>Edit</button>` : '<div></div>'}
      <button class="qa-btn qa-log"  onclick="addLog('${id}')"><span class="qa-ico">📝</span>Catat</button>
    </div>
    <div class="det-section">
      <div class="det-sec-label">Informasi</div>
      <div class="det-row"><span class="det-key">No. HP</span><a href="tel:${k.hp}" style="color:var(--brand-light);font-weight:700;text-decoration:none;font-size:12px">${k.hp}</a></div>
      <div class="det-row"><span class="det-key">Harga Unit</span><span class="det-val" style="color:var(--brand-light)">${fRpFull(k.harga)}</span></div>
      <div class="det-row"><span class="det-key">Jumlah DP</span><span class="det-val">${fRpFull(k.dp)}</span></div>
      <div class="det-row"><span class="det-key">Tgl. Booking</span><span class="det-val">${k.tgl_booking || '—'}</span></div>
      <div class="det-row"><span class="det-key">Follow-up</span><span class="det-val" style="color:var(--amber)">${k.tgl_followup ? fDateShort(k.tgl_followup) : '—'}</span></div>
      <div class="det-row"><span class="det-key">Pembiayaan</span><span class="det-val">${kprLabel(k.kpr)}</span></div>
      <div class="det-row"><span class="det-key">Sumber</span><span class="det-val">${sumberLabel(k.sumber)}</span></div>
      <div class="det-row"><span class="det-key">Marketing</span><span class="det-val">${ownerName(k.owner_id)}</span></div>
      ${k.catatan ? `<div class="det-row" style="flex-direction:column;gap:6px"><span class="det-key">Catatan</span><div class="tl-note">${k.catatan}</div></div>` : ''}
    </div>
    <div class="det-section" id="berkasSection">
      <div class="det-sec-label">Checklist Berkas & Dokumen</div>
      <div class="berkas-loading">
        <div class="berkas-skeleton"></div><div class="berkas-skeleton"></div>
        <div class="berkas-skeleton"></div><div class="berkas-skeleton"></div>
        <div class="berkas-skeleton"></div><div class="berkas-skeleton"></div>
      </div>
    </div>
    <div class="det-section" style="padding-bottom:24px">
      <div class="det-sec-label">Log Aktivitas</div>
      <div class="tl" style="padding-top:8px">${logHtml}</div>
    </div>`;
  openModal('modalDetail');

  // Load foto async setelah modal terbuka
  const berkasHtml = await buildBerkasSection(k, canEdit);
  const sec = document.getElementById('berkasSection');
  if (sec) sec.innerHTML = `
    <div class="det-sec-label">Checklist Berkas & Dokumen
      ${canEdit ? `<span style="font-size:10px;color:var(--text-4);font-weight:400;margin-left:6px">Ketuk 📎 untuk upload foto</span>` : ''}
    </div>
    <div class="berkas-grid">${berkasHtml}</div>`;
}

// ── ADD / EDIT MODAL ──────────────────────────────
function openAddModal() {
  document.getElementById('mAddTitle').textContent = 'Tambah Konsumen';
  document.getElementById('editId').value = '';
  document.getElementById('btnHapus').style.display = 'none';
  ['fNama','fHP','fUnit','fKavling','fTglBooking','fTglFollowup','fCatatan'].forEach(id => document.getElementById(id).value = '');
  setRpValue('fHarga', 0); setRpValue('fDP', 0);
  document.getElementById('fStatus').value = 'booking';
  document.getElementById('fKPR').value = '';
  document.getElementById('fSumber').value = '';
  openModal('modalAdd');
}
function openEditModal(id) {
  const k = allKons.find(x => x.id === id); if (!k) return;
  document.getElementById('mAddTitle').textContent = 'Edit Konsumen';
  document.getElementById('editId').value = id;
  // Simpan timestamp untuk optimistic locking
  document.getElementById('editUpdatedAt').value = k.updated_at || '';
  document.getElementById('btnHapus').style.display = 'block';
  document.getElementById('fNama').value      = k.nama;
  document.getElementById('fHP').value        = k.hp;
  document.getElementById('fUnit').value      = k.unit || '';
  document.getElementById('fKavling').value   = k.kavling || '';
  setRpValue('fHarga', k.harga || 0);
  setRpValue('fDP',    k.dp    || 0);
  document.getElementById('fStatus').value    = k.status;
  document.getElementById('fTglBooking').value = k.tgl_booking || '';
  document.getElementById('fTglFollowup').value = k.tgl_followup || '';
  document.getElementById('fKPR').value       = k.kpr || '';
  document.getElementById('fSumber').value    = k.sumber || '';
  document.getElementById('fCatatan').value   = k.catatan || '';
  closeModal('modalDetail');
  openModal('modalAdd');
}

// ── NOTIFIKASI ───────────────────────────────────
function buildReminders() {
  const today = new Date(); const r = [];
  const todayStr = today.toDateString();
  allKons.forEach(k => {
    if (k.tgl_followup) {
      const fd = new Date(k.tgl_followup);
      const diff = Math.floor((fd - today) / 86400000);
      if (diff === 0) r.push({ ico: '📅', txt: `${k.nama} — Follow-up HARI INI!`, col: 'var(--rose)' });
      else if (diff === 1) r.push({ ico: '📅', txt: `${k.nama} — Follow-up besok (${fDateShort(k.tgl_followup)})`, col: 'var(--amber)' });
      else if (diff > 0 && diff <= 3) r.push({ ico: '📅', txt: `${k.nama} — Follow-up ${diff} hari lagi`, col: 'var(--brand-light)' });
    }
    if (k.status === 'booking' && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      if (d >= 7) r.push({ ico: '⏰', txt: `${k.nama} — Booking ${d} hari lalu, follow up!`, col: 'var(--amber)' });
    }
    if (k.status === 'berkas') {
      const m = k.berkas ? Object.values(k.berkas).filter(v => !v).length : 6;
      if (m > 0) r.push({ ico: '📁', txt: `${k.nama} — ${m} berkas belum`, col: 'var(--violet)' });
    }
    if (k.status === 'dp') r.push({ ico: '💰', txt: `${k.nama} — Proses DP belum selesai`, col: 'var(--brand-light)' });
  });
  return r;
}
function updateNotifPip() {
  const r = buildReminders();
  document.getElementById('notifPip').classList.toggle('show', r.length > 0);
}
function openNotif() {
  const r = buildReminders();
  document.getElementById('notifBody').innerHTML = r.length
    ? r.map(x => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--glass-border);align-items:flex-start">
        <span style="font-size:20px;flex-shrink:0">${x.ico}</span>
        <span style="font-size:13px;color:${x.col};font-weight:600;line-height:1.5">${x.txt}</span>
      </div>`).join('')
    : `<div class="empty-state"><div class="empty-ico">🎉</div><div class="empty-title">Semua beres!</div><div class="empty-sub">Tidak ada pengingat aktif</div></div>`;
  openModal('modalNotif');
}
