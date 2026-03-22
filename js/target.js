// ═══════════════════════════════════════════════
// TARGET PENJUALAN BULANAN — PropMap v4.2
// ═══════════════════════════════════════════════

const BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

// ── LOAD TARGET ──────────────────────────────────
async function loadTarget() {
  if (!sb || !me) return;
  // Wrapped ketat — tidak boleh throw ke caller
  allTarget = [];
  try {
    let q = sb.from('target_bulanan')
      .select('*')
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false });
    if (myProf?.role !== 'admin') q = q.eq('user_id', me.id);
    const res = await q;
    if (res.error) {
      // Tabel belum ada atau RLS error — silent, tidak crash app
      console.warn('loadTarget (akan normal setelah SQL dijalankan):', res.error.message);
    } else {
      allTarget = res.data || [];
    }
  } catch(e) {
    // Jangan re-throw — cukup log
    console.warn('loadTarget exception:', e.message);
  }
}

// ── GET TARGET BULAN INI ─────────────────────────
function getTargetBulan(userId, tahun, bulan) {
  const row = allTarget.find(t => t.user_id === userId && t.tahun === tahun && t.bulan === bulan);
  if (row) return row.target;
  // Fallback ke target di profil
  const prof = allProfs.find(p => p.id === userId);
  return prof?.target || 5;
}

// ── SIMPAN TARGET ─────────────────────────────────
async function saveTargetBulan(userId, tahun, bulan, target, catatan = '') {
  target = parseInt(target) || 1;
  const { data, error } = await sb.from('target_bulanan').upsert({
    user_id: userId, tahun, bulan, target, catatan,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,tahun,bulan' }).select().single();

  if (error) { showToast('Gagal simpan target: ' + error.message, '❌'); return false; }
  // Update cache lokal
  const idx = allTarget.findIndex(t => t.user_id === userId && t.tahun === tahun && t.bulan === bulan);
  if (idx >= 0) allTarget[idx] = data; else allTarget.unshift(data);
  return true;
}

// ── RENDER TARGET DI LAPORAN ─────────────────────
function renderTargetSection() {
  const el = document.getElementById('lapTarget');
  if (!el) return;
  try {

  const now      = new Date();
  const tahun    = now.getFullYear();
  const bulan    = now.getMonth() + 1;
  const isAdmin  = myProf?.role === 'admin';

  if (isAdmin) {
    renderTargetAdmin(el, tahun, bulan);
  } else {
    renderTargetMarketing(el, tahun, bulan);
  }
  } catch(e) {
    console.warn('renderTargetSection error:', e.message);
    el.innerHTML = '<div style="color:var(--text-4);font-size:12px;padding:8px">Target belum tersedia. Jalankan SQL setup terlebih dahulu.</div>';
  }
}

// Target view untuk Marketing — history 6 bulan + edit bulan ini
function renderTargetMarketing(el, tahunNow, bulanNow) {
  // History 6 bulan terakhir
  const months = [];
  for (let i = 0; i < 6; i++) {
    let b = bulanNow - i, t = tahunNow;
    if (b <= 0) { b += 12; t--; }
    months.push({ tahun: t, bulan: b });
  }

  const targetNow = getTargetBulan(me.id, tahunNow, bulanNow);
  const selesaiNow = allKons.filter(k => {
    if (k.status !== 'selesai' || k.owner_id !== me.id) return false;
    const d = new Date(k.created_at);
    return d.getFullYear() === tahunNow && d.getMonth() + 1 === bulanNow;
  }).length;
  const pct = Math.min(Math.round(selesaiNow / targetNow * 100), 100);

  el.innerHTML = `
    <!-- Target bulan ini -->
    <div class="target-card" style="margin-bottom:12px">
      <div class="target-head">
        <div>
          <div class="target-label">Akad Selesai — ${BULAN_NAMA[bulanNow-1]} ${tahunNow}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">Target bulan ini</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="target-num">${selesaiNow}<span style="font-size:14px;color:var(--text-3);font-family:var(--font-body);font-weight:500"> / ${targetNow}</span></div>
          <button onclick="openEditTargetSelf(${tahunNow},${bulanNow})"
                  style="font-size:11px;padding:4px 10px;border-radius:var(--r-full);background:var(--glass-10);border:1px solid var(--glass-border);color:var(--text-2);cursor:pointer;font-family:var(--font-body);font-weight:700">
            ✏️ Edit
          </button>
        </div>
      </div>
      <div class="target-track"><div class="target-fill" style="width:${pct}%"></div></div>
      <div class="target-pct" style="color:${pct>=100?'var(--emerald)':pct>=70?'var(--amber)':'var(--text-3)'}">${pct}% tercapai${pct>=100?' 🎉':''}</div>
    </div>

    <!-- History 6 bulan -->
    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin:16px 0 10px">History 6 Bulan</div>
    <div class="target-history">
      ${months.map(m => {
        const t = getTargetBulan(me.id, m.tahun, m.bulan);
        const s = allKons.filter(k => {
          if (k.status !== 'selesai' || k.owner_id !== me.id) return false;
          const d = new Date(k.created_at);
          return d.getFullYear() === m.tahun && d.getMonth() + 1 === m.bulan;
        }).length;
        const p = Math.min(Math.round(s / t * 100), 100);
        const isNow = m.tahun === tahunNow && m.bulan === bulanNow;
        return `<div class="th-row ${isNow ? 'th-row-now' : ''}">
          <div class="th-bulan">${BULAN_NAMA[m.bulan-1].slice(0,3)} ${m.tahun}</div>
          <div class="th-bar-wrap">
            <div class="th-bar-track">
              <div class="th-bar-fill" style="width:${p}%;background:${p>=100?'var(--emerald)':p>=70?'var(--amber)':'var(--brand)'}"></div>
            </div>
            <span class="th-pct">${p}%</span>
          </div>
          <div class="th-nums">${s}<span style="color:var(--text-4)">/${t}</span></div>
        </div>`;
      }).join('')}
    </div>`;
}

// Target view untuk Admin — semua marketing bulan ini + bisa edit
function renderTargetAdmin(el, tahunNow, bulanNow) {
  const marketing = allProfs.filter(p => p.role !== 'admin');
  if (!marketing.length) {
    el.innerHTML = '<div style="color:var(--text-4);font-size:12px;padding:8px 0">Belum ada tim marketing.</div>';
    return;
  }

  el.innerHTML = `
    <!-- Bulan & tahun selector -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <select id="targetTahunSel" class="admin-select" style="width:auto" onchange="renderTargetSection()">
        ${[tahunNow, tahunNow-1, tahunNow-2].map(t =>
          `<option value="${t}" ${t===tahunNow?'selected':''}>${t}</option>`
        ).join('')}
      </select>
      <select id="targetBulanSel" class="admin-select" style="width:auto" onchange="renderTargetSection()">
        ${BULAN_NAMA.map((n, i) =>
          `<option value="${i+1}" ${i+1===bulanNow?'selected':''}>${n}</option>`
        ).join('')}
      </select>
    </div>

    <!-- Kartu per marketing -->
    <div id="targetAdminGrid"></div>

    <!-- History semua marketing -->
    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin:20px 0 10px">History Tim — 6 Bulan</div>
    <div id="targetAdminHistory"></div>`;

  // Isi grid setelah render (pakai value dari selector)
  setTimeout(renderTargetAdminGrid, 0);
}

function renderTargetAdminGrid() {
  const grid = document.getElementById('targetAdminGrid');
  const hist = document.getElementById('targetAdminHistory');
  if (!grid) return;

  const tahun  = parseInt(document.getElementById('targetTahunSel')?.value) || new Date().getFullYear();
  const bulan  = parseInt(document.getElementById('targetBulanSel')?.value) || new Date().getMonth() + 1;
  const mktg   = allProfs.filter(p => p.role !== 'admin');

  grid.innerHTML = mktg.map((p, i) => {
    const t = getTargetBulan(p.id, tahun, bulan);
    const s = allKons.filter(k => {
      if (k.status !== 'selesai' || k.owner_id !== p.id) return false;
      const d = new Date(k.created_at);
      return d.getFullYear() === tahun && d.getMonth() + 1 === bulan;
    }).length;
    const pct = Math.min(Math.round(s / t * 100), 100);

    return `<div class="target-card" style="margin-bottom:10px">
      <div class="target-head">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="rank-av av${i%8}" style="width:32px;height:32px;border-radius:9px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${(p.full_name||p.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size:13px;font-weight:700">${p.full_name||p.email}</div>
            <div style="font-size:11px;color:var(--text-3)">${BULAN_NAMA[bulan-1]} ${tahun}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="target-num" style="font-size:18px">${s}<span style="font-size:12px;color:var(--text-3);font-family:var(--font-body);font-weight:500"> / ${t}</span></div>
          <button onclick="openEditTargetAdmin('${p.id}','${p.full_name||p.email}',${tahun},${bulan})"
                  style="font-size:11px;padding:4px 10px;border-radius:var(--r-full);background:var(--glass-10);border:1px solid var(--glass-border);color:var(--text-2);cursor:pointer;font-family:var(--font-body);font-weight:700">
            ✏️ Set
          </button>
        </div>
      </div>
      <div class="target-track"><div class="target-fill" style="width:${pct}%;background:${pct>=100?'var(--emerald)':pct>=70?'var(--amber)':'var(--brand)'}"></div></div>
      <div class="target-pct" style="color:${pct>=100?'var(--emerald)':pct>=70?'var(--amber)':'var(--text-3)'}">${pct}% tercapai${pct>=100?' 🎉':''}</div>
    </div>`;
  }).join('');

  // History 6 bulan semua marketing
  if (!hist) return;
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    let b = now.getMonth() + 1 - i, t = now.getFullYear();
    if (b <= 0) { b += 12; t--; }
    months.push({ tahun: t, bulan: b });
  }

  hist.innerHTML = `
    <div class="th-header-row">
      <div class="th-col-name">Marketing</div>
      ${months.map(m => `<div class="th-col-month">${BULAN_NAMA[m.bulan-1].slice(0,3)}</div>`).join('')}
    </div>
    ${mktg.map((p, i) => `
      <div class="th-grid-row">
        <div class="th-col-name">
          <div class="th-av av${i%8}">${(p.full_name||p.email).charAt(0).toUpperCase()}</div>
          <span>${(p.full_name||p.email).split(' ')[0]}</span>
        </div>
        ${months.map(m => {
          const t = getTargetBulan(p.id, m.tahun, m.bulan);
          const s = allKons.filter(k => {
            if (k.status !== 'selesai' || k.owner_id !== p.id) return false;
            const d = new Date(k.created_at);
            return d.getFullYear() === m.tahun && d.getMonth() + 1 === m.bulan;
          }).length;
          const pct = Math.min(Math.round(s/t*100), 100);
          const color = pct >= 100 ? 'var(--emerald)' : pct >= 70 ? 'var(--amber)' : pct > 0 ? 'var(--brand-light)' : 'var(--text-4)';
          return `<div class="th-col-cell" style="color:${color}" title="${s}/${t} (${pct}%)">${s}/${t}</div>`;
        }).join('')}
      </div>`).join('')}`;
}

// ── MODAL EDIT TARGET ────────────────────────────
function openEditTargetSelf(tahun, bulan) {
  if (typeof requirePro === 'function' && !requirePro('target')) return;
  openEditTargetAdmin(me.id, myProf?.full_name || me.email, tahun, bulan);
}

function openEditTargetAdmin(userId, namaUser, tahun, bulan) {
  if (typeof requirePro === 'function' && !requirePro('target')) return;
  const cur = getTargetBulan(userId, tahun, bulan);
  const row = allTarget.find(t => t.user_id === userId && t.tahun === tahun && t.bulan === bulan);

  document.getElementById('modalTargetBody').innerHTML = `
    <input type="hidden" id="targetUserId" value="${userId}"/>
    <input type="hidden" id="targetTahun" value="${tahun}"/>
    <input type="hidden" id="targetBulan" value="${bulan}"/>
    <div style="text-align:center;padding:4px 0 16px">
      <div style="font-size:13px;font-weight:700">${namaUser}</div>
      <div style="font-size:12px;color:var(--text-3)">${BULAN_NAMA[bulan-1]} ${tahun}</div>
    </div>
    <div class="field">
      <label class="field-label">Target Akad / Bulan</label>
      <input type="number" class="field-input" id="targetNilai" value="${cur}" min="1" max="999"
             style="font-size:24px;font-weight:800;text-align:center;font-family:var(--font-mono)"
             oninput="updateTargetPreview(this.value)"/>
    </div>
    <div id="targetPreview" style="text-align:center;padding:8px 0 4px;font-size:12px;color:var(--text-3)"></div>
    <div class="field">
      <label class="field-label">Catatan (opsional)</label>
      <input type="text" class="field-input" id="targetCatatan"
             placeholder="Misal: Launching cluster baru" value="${row?.catatan||''}"/>
    </div>`;

  updateTargetPreview(cur);
  openModal('modalTarget');
}

function updateTargetPreview(val) {
  const el = document.getElementById('targetPreview');
  const n = parseInt(val) || 0;
  if (el) el.textContent = n > 0
    ? `Target: ${n} akad per bulan`
    : 'Masukkan jumlah target';
}

async function saveTargetModal() {
  const userId  = document.getElementById('targetUserId')?.value;
  const tahun   = parseInt(document.getElementById('targetTahun')?.value);
  const bulan   = parseInt(document.getElementById('targetBulan')?.value);
  const target  = document.getElementById('targetNilai')?.value;
  const catatan = document.getElementById('targetCatatan')?.value || '';

  if (!target || parseInt(target) < 1) {
    showToast('Target minimal 1', '⚠️'); return;
  }

  setBtnLoading('btnSaveTarget', true, 'Menyimpan...');
  const ok = await saveTargetBulan(userId, tahun, bulan, target, catatan);
  setBtnLoading('btnSaveTarget', false, 'Simpan Target');

  if (ok) {
    closeModal('modalTarget');
    showToast(`Target ${BULAN_NAMA[bulan-1]} disimpan`, '✅');
    renderTargetSection();
  }
}

// ── BULK SET TARGET (Admin — semua marketing sekaligus) ───────────────────────
function openSetTargetBulk() {
  if (typeof requirePro === 'function' && !requirePro('target')) return;
  const now    = new Date();
  const tahun  = now.getFullYear();
  const bulan  = now.getMonth() + 1;
  const mktg   = allProfs.filter(p => p.role !== 'admin');

  document.getElementById('modalTargetBody').innerHTML = `
    <input type="hidden" id="targetUserId" value="bulk"/>
    <input type="hidden" id="targetTahun" value="${tahun}"/>
    <input type="hidden" id="targetBulan" value="${bulan}"/>
    <div style="font-size:12px;color:var(--text-3);padding:0 0 14px">
      Set target untuk semua marketing — ${BULAN_NAMA[bulan-1]} ${tahun}
    </div>
    ${mktg.map(p => {
      const cur = getTargetBulan(p.id, tahun, bulan);
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--glass-border)">
        <div class="rank-av av${Math.abs(hsh(p.id))%8}" style="width:30px;height:30px;border-radius:9px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${(p.full_name||p.email).charAt(0).toUpperCase()}
        </div>
        <div style="flex:1;font-size:13px;font-weight:600">${p.full_name||p.email}</div>
        <input type="number" class="bulk-target-input" data-uid="${p.id}"
               value="${cur}" min="1" max="999"
               style="width:64px;padding:7px 10px;text-align:center;font-size:14px;font-weight:700;
                      font-family:var(--font-mono);background:var(--glass-10);
                      border:1px solid var(--glass-border);border-radius:var(--r-sm);
                      color:var(--text-1);outline:none"/>
      </div>`;
    }).join('')}`;

  // Override tombol simpan untuk bulk
  const btn = document.getElementById('btnSaveTarget');
  if (btn) { btn.textContent = 'Simpan Semua'; btn.onclick = saveTargetBulk; }

  openModal('modalTarget');
}

async function saveTargetBulk() {
  const tahun = parseInt(document.getElementById('targetTahun')?.value);
  const bulan = parseInt(document.getElementById('targetBulan')?.value);
  const inputs = [...document.querySelectorAll('.bulk-target-input')];
  if (!inputs.length) return;

  setBtnLoading('btnSaveTarget', true, 'Menyimpan...');
  let ok = 0;
  for (const inp of inputs) {
    const uid = inp.dataset.uid;
    const val = parseInt(inp.value) || 1;
    const saved = await saveTargetBulan(uid, tahun, bulan, val);
    if (saved) ok++;
  }
  setBtnLoading('btnSaveTarget', false, 'Simpan Semua');

  if (ok > 0) {
    closeModal('modalTarget');
    showToast(`Target ${BULAN_NAMA[bulan-1]} disimpan untuk ${ok} marketing`, '✅');
    renderTargetSection();
  }
}

// Tampilkan link "Atur Semua" untuk admin
function setupTargetAdminLink() {
  const el = document.getElementById('targetAdminLink');
  if (el) el.style.display = myProf?.role === 'admin' ? 'block' : 'none';
}
