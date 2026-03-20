// ═══════════════════════════════════════════════
// PLAN & MONETISASI — PropMap v4.2
// ═══════════════════════════════════════════════

// ── LOAD PLAN ─────────────────────────────────────
async function loadPlan() {
  if (!sb || !me) return;
  try {
    const { data } = await sb.from('profiles')
      .select('plan, plan_expires, trial_ends')
      .eq('id', me.id).single();
    if (!data) return;

    planExpires = data.plan_expires ? new Date(data.plan_expires) : null;
    trialEnds   = data.trial_ends   ? new Date(data.trial_ends)   : null;

    // Tentukan plan aktif
    const now = new Date();
    if (data.plan === 'trial' && trialEnds && trialEnds > now) {
      myPlan = 'trial';
    } else if (['pro','business'].includes(data.plan) && (!planExpires || planExpires > now)) {
      myPlan = data.plan;
    } else {
      myPlan = 'free';
    }

    updatePlanUI();
  } catch(e) {
    console.warn('loadPlan:', e.message);
    myPlan = 'free';
  }
}

// ── CEK AKSES FITUR ───────────────────────────────
function canUse(feature) {
  if (['pro','trial','business'].includes(myPlan)) return true;
  return !PRO_FEATURES.includes(feature);
}

function isPro() {
  return ['pro','trial','business'].includes(myPlan);
}

function isBusiness() {
  return myPlan === 'business';
}

function getDaysLeft() {
  if (myPlan === 'trial' && trialEnds) {
    return Math.max(0, Math.ceil((trialEnds - new Date()) / 86400000));
  }
  if (['pro','business'].includes(myPlan) && planExpires) {
    return Math.max(0, Math.ceil((planExpires - new Date()) / 86400000));
  }
  return null;
}

// ── CEK LIMIT KONSUMEN ────────────────────────────
function checkKonsumenLimit() {
  if (isPro()) return true;
  const myKons = myProf?.role === 'admin'
    ? allKons.length
    : allKons.filter(k => k.owner_id === me.id).length;
  return myKons < PLANS.free.maxKons;
}

// ── INTERCEPT FITUR BERBAYAR ─────────────────────
// Panggil sebelum menjalankan fitur Pro — return true jika boleh lanjut
function requirePro(featureName, cb) {
  if (canUse(featureName)) { if (cb) cb(); return true; }
  openUpgradeModal(featureName);
  return false;
}

// ── UPDATE UI PLAN ────────────────────────────────
function updatePlanUI() {
  const cfg  = PLANS[myPlan] || PLANS.free;
  const days = getDaysLeft();

  // Badge plan di header / sidebar
  const badgeEl = document.getElementById('planBadge');
  if (badgeEl) {
    badgeEl.textContent = cfg.name;
    badgeEl.style.background = cfg.color + '22';
    badgeEl.style.color = cfg.color;
    badgeEl.style.display = 'inline-flex';
  }

  // Trial countdown banner
  const bannerEl = document.getElementById('trialBanner');
  if (bannerEl) {
    if (myPlan === 'trial' && days !== null) {
      bannerEl.style.display = 'flex';
      document.getElementById('trialDays').textContent = days;
    } else if (myPlan === 'free') {
      bannerEl.style.display = 'flex';
      document.getElementById('trialDays').textContent = '0';
      const trialMsg = bannerEl.querySelector('.trial-msg');
      if (trialMsg) trialMsg.textContent = 'Trial berakhir. Upgrade ke Pro untuk lanjut.';
    } else {
      bannerEl.style.display = 'none';
    }
  }

  // Tampilkan/sembunyikan menu upgrade di pengaturan
  const upgradeRow = document.getElementById('upgradeRow');
  if (upgradeRow) {
    upgradeRow.style.display = isPro() ? 'none' : 'flex';
  }
  const manageRow = document.getElementById('manageRow');
  if (manageRow) {
    manageRow.style.display = isPro() ? 'flex' : 'none';
  }
  // Tampilkan backup section untuk marketing Pro
  const mktgBackup = document.getElementById('marketingBackupGrp');
  if (mktgBackup) {
    const isAdmin = myProf?.role === 'admin';
    mktgBackup.style.display = (!isAdmin && isPro()) ? 'block' : 'none';
  }
}

// ── MODAL UPGRADE ─────────────────────────────────
const FEATURE_LABELS = {
  export:           '📊 Export Excel / PDF / CSV',
  upload_foto:      '📎 Upload Foto Berkas',
  filter_bulan:     '📆 Filter Bulan',
  filter_lanjutan:  '🔍 Filter Lanjutan',
  target:           '🎯 Target Penjualan',
  notifikasi_push:  '🔔 Notifikasi Push',
  backup:           '💾 Backup & Restore',
  offline:          '📵 Mode Offline',
  import:           '📥 Import Excel/CSV',
  limit_konsumen:   '👥 Tambah Konsumen (maks 20 di Gratis)',
};

function openUpgradeModal(feature) {
  const label = FEATURE_LABELS[feature] || feature;
  document.getElementById('upgradeFeatureLabel').textContent = label;
  document.getElementById('upgradeCurrentPlan').textContent =
    myPlan === 'trial' ? 'Trial Anda sudah berakhir.' : 'Anda menggunakan plan Gratis.';
  openModal('modalUpgrade');
}

function openUpgradePage() {
  openModal('modalUpgrade');
  document.getElementById('upgradeFeatureLabel').textContent = 'Semua fitur Pro';
  document.getElementById('upgradeCurrentPlan').textContent =
    `Plan saat ini: ${PLANS[myPlan]?.name || 'Gratis'}`;
}

// ── PILIH PLAN & CHECKOUT ─────────────────────────
async function choosePlan(plan) {
  closeModal('modalUpgrade');
  // Tampilkan modal checkout
  const prices = { pro: 100000, business: 299000 };
  const price  = prices[plan];
  const label  = PLANS[plan]?.name;

  document.getElementById('checkoutPlanName').textContent  = label;
  document.getElementById('checkoutPrice').textContent     = 'Rp ' + price.toLocaleString('id-ID');
  document.getElementById('checkoutPlanKey').value         = plan;
  document.getElementById('checkoutEmail').value           = me.email || '';
  document.getElementById('checkoutErr').textContent       = '';
  document.getElementById('checkoutSuccess').style.display = 'none';
  document.getElementById('checkoutForm').style.display    = 'block';
  openModal('modalCheckout');
}

async function submitCheckout() {
  const plan  = document.getElementById('checkoutPlanKey').value;
  const name  = document.getElementById('checkoutName').value.trim();
  const email = document.getElementById('checkoutEmail').value.trim();
  const phone = document.getElementById('checkoutPhone').value.trim();

  if (!name || !email || !phone) {
    document.getElementById('checkoutErr').textContent = 'Semua kolom wajib diisi';
    return;
  }

  setBtnLoading('btnCheckout', true, 'Memproses...');
  document.getElementById('checkoutErr').textContent = '';

  // Buat order ID dulu
  const orderId = `ORDER-${Date.now()}`;

  // Coba simpan ke DB — tidak blocking jika tabel belum ada
  try {
    await sb.from('subscriptions').insert({
      workspace_id: me.id,
      plan,
      status: 'pending',
      amount: plan === 'pro' ? 100000 : 299000,
      payment_ref: orderId,
    });
  } catch(e) {
    console.warn('subscriptions insert:', e.message);
    // Lanjut tampilkan instruksi walau DB gagal
  }

  // Selalu tampilkan instruksi pembayaran
  document.getElementById('checkoutForm').style.display    = 'none';
  document.getElementById('checkoutSuccess').style.display = 'block';
  document.getElementById('checkoutOrderId').textContent   = orderId;
  document.getElementById('checkoutPlanDisplay').textContent = PLANS[plan]?.name;
  document.getElementById('checkoutPriceDisplay').textContent =
    'Rp ' + (plan === 'pro' ? '100.000' : '299.000');

  setBtnLoading('btnCheckout', false, 'Lanjut Pembayaran →');
}

// ── AKTIVASI MANUAL OLEH ADMIN (setelah konfirmasi bayar) ─
async function activatePlan(userId, plan, months) {
  if (myProf?.role !== 'admin') return;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);

  const { error } = await sb.from('profiles').update({
    plan,
    plan_expires: expires.toISOString(),
    trial_ends: null,
  }).eq('id', userId);

  if (!error) {
    showToast(`Plan ${PLANS[plan]?.name} aktif hingga ${expires.toLocaleDateString('id-ID')}`, '✅');
    await loadPlan();
  } else {
    showToast('Gagal aktivasi: ' + error.message, '❌');
  }
}

// ── PLAN INFO DI PENGATURAN ───────────────────────
function renderPlanInfo() {
  const el = document.getElementById('planInfoSection');
  if (!el) return;

  const cfg   = PLANS[myPlan] || PLANS.free;
  const days  = getDaysLeft();
  const myKonsCount = myProf?.role === 'admin'
    ? allKons.length
    : allKons.filter(k => k.owner_id === me.id).length;

  el.innerHTML = `
    <div class="plan-info-card">
      <div class="plan-info-head">
        <div>
          <div class="plan-info-name" style="color:${cfg.color}">${cfg.name}</div>
          <div class="plan-info-sub">
            ${myPlan === 'trial'
              ? `Trial berakhir dalam <strong>${days} hari</strong>`
              : myPlan === 'free'
              ? 'Upgrade ke Pro untuk fitur lengkap'
              : planExpires
              ? `Aktif hingga ${planExpires.toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}`
              : 'Aktif tanpa batas waktu'}
          </div>
        </div>
        ${!isPro() ? `
          <button onclick="openUpgradePage()"
            style="padding:7px 14px;background:#6366f1;border:none;border-radius:var(--r-full);
                   color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body)">
            Upgrade →
          </button>` : ''}
      </div>
      <div class="plan-usage">
        <div class="plan-usage-row">
          <span>Konsumen</span>
          <span><strong>${myKonsCount}</strong> / ${isPro() ? '∞' : PLANS.free.maxKons + ' (maks gratis)'}</span>
        </div>
        ${!isPro() ? `
        <div class="plan-usage-bar">
          <div class="plan-usage-fill" style="width:${Math.min(100,myKonsCount/PLANS.free.maxKons*100)}%;
               background:${myKonsCount >= PLANS.free.maxKons ? 'var(--rose)' : '#6366f1'}"></div>
        </div>` : ''}
      </div>
      ${!isPro() ? `
      <div class="plan-locked-features">
        <div class="plan-locked-title">🔒 Fitur Pro yang terkunci</div>
        <div class="plan-locked-list">
          <span class="plan-locked-item">📊 Export Excel/PDF</span>
          <span class="plan-locked-item">📎 Upload Foto Berkas</span>
          <span class="plan-locked-item">🎯 Target Penjualan</span>
          <span class="plan-locked-item">🔍 Filter Lanjutan</span>
          <span class="plan-locked-item">🔔 Notifikasi Push</span>
          <span class="plan-locked-item">💾 Backup Data</span>
          <span class="plan-locked-item">📵 Mode Offline</span>
          <span class="plan-locked-item">📥 Import Excel</span>
        </div>
      </div>` : ''}
    </div>`;
}

// ── PANEL AKTIVASI (Admin only) ───────────────────
async function openAktivasiModal() {
  // Isi dropdown user
  const sel = document.getElementById('aktivasiUserId');
  sel.innerHTML = '<option value="">— Pilih user —</option>';
  allProfs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.full_name || p.email} (${p.email})`;
    sel.appendChild(opt);
  });

  // Reset state
  document.getElementById('aktivasiErr').textContent = '';
  document.getElementById('aktivasiOk').style.display = 'none';

  // Load pending orders
  await loadPendingOrders();

  openModal('modalAktivasi');
}

async function loadPendingOrders() {
  const el = document.getElementById('pendingOrderList');
  if (!el) return;

  el.innerHTML = '<div style="font-size:12px;color:var(--text-4);padding:6px 0">Memuat...</div>';

  try {
    // Query tanpa join profiles — hindari RLS conflict
    const { data, error } = await sb.from('subscriptions')
      .select('id, workspace_id, plan, amount, payment_ref, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!data || data.length === 0) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-4);padding:6px 0">Tidak ada order pending.</div>';
      return;
    }

    el.innerHTML = data.map(o => {
      // Enrich nama dari allProfs yang sudah di memori
      const prof = (allProfs || []).find(p => p.id === o.workspace_id);
      const user = prof?.full_name || prof?.email || o.workspace_id;
      const date = new Date(o.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'});
      const planLabel = PLANS[o.plan]?.name || o.plan;
      return `
        <div class="order-item">
          <div class="order-info">
            <div class="order-user">${user}</div>
            <div class="order-meta">${planLabel} · Rp ${o.amount.toLocaleString('id-ID')} · ${date}</div>
            <div class="order-ref">${o.payment_ref}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="order-btn-approve" onclick="approveOrder('${o.id}','${o.workspace_id}','${o.plan}')">
              ✓ Aktifkan
            </button>
            <button class="order-btn-reject" onclick="rejectOrder('${o.id}')">
              ✕
            </button>
          </div>
        </div>`;
    }).join('');

  } catch(e) {
    el.innerHTML = `<div style="font-size:12px;color:var(--rose);padding:6px 0">
      ⚠ Gagal memuat order: ${e.message}
    </div>`;
    console.error('loadPendingOrders:', e);
  }
}

async function approveOrder(orderId, userId, plan) {
  if (!confirm(`Aktifkan plan ${PLANS[plan]?.name} untuk user ini?`)) return;
  try {
    // Aktivasi plan 1 bulan
    await activatePlan(userId, plan, 1);
    // Update status order
    await sb.from('subscriptions').update({ status: 'active' }).eq('id', orderId);
    showToast('Plan berhasil diaktifkan!', '✅');
    await loadPendingOrders();
  } catch(e) {
    showToast('Gagal: ' + e.message, '❌');
  }
}

async function rejectOrder(orderId) {
  if (!confirm('Tolak order ini?')) return;
  await sb.from('subscriptions').update({ status: 'cancelled' }).eq('id', orderId);
  showToast('Order ditolak', '🗑️');
  await loadPendingOrders();
}

async function submitAktivasi() {
  const userId  = document.getElementById('aktivasiUserId').value;
  const plan    = document.getElementById('aktivasiPlan').value;
  const durasi  = parseInt(document.getElementById('aktivasiDurasi').value);
  const errEl   = document.getElementById('aktivasiErr');
  const okEl    = document.getElementById('aktivasiOk');

  errEl.textContent = '';
  okEl.style.display = 'none';

  if (!userId) { errEl.textContent = 'Pilih user terlebih dahulu'; return; }

  setBtnLoading('btnAktivasi', true, 'Mengaktifkan...');
  try {
    // Hitung expires
    let expires = null;
    if (durasi > 0) {
      expires = new Date();
      expires.setMonth(expires.getMonth() + durasi);
    }

    // Update profiles
    const updateData = { plan };
    if (plan === 'free') {
      updateData.plan_expires = null;
      updateData.trial_ends   = null;
    } else if (plan === 'trial') {
      const trialExp = new Date();
      trialExp.setDate(trialExp.getDate() + 14);
      updateData.trial_ends   = trialExp.toISOString();
      updateData.plan_expires = null;
    } else {
      updateData.plan_expires = expires ? expires.toISOString() : null;
      updateData.trial_ends   = null;
    }

    const { error } = await sb.from('profiles').update(updateData).eq('id', userId);
    if (error) throw error;

    // Catat di subscriptions
    if (!['free','trial'].includes(plan)) {
      await sb.from('subscriptions').insert({
        workspace_id: userId,
        plan,
        status: 'active',
        amount: plan === 'pro' ? 100000 : 299000,
        payment_ref: `MANUAL-${Date.now()}`,
        started_at: new Date().toISOString(),
        expires_at: expires ? expires.toISOString() : null,
      });
    }

    const user = allProfs.find(p => p.id === userId);
    const userName = user?.full_name || user?.email || 'User';
    const planLabel = PLANS[plan]?.name || plan;
    const expiresStr = expires
      ? expires.toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})
      : 'tanpa batas waktu';

    okEl.style.display = 'block';
    okEl.textContent = `✅ ${userName} → ${planLabel}${durasi > 0 ? ` hingga ${expiresStr}` : ' (tidak terbatas)'}`;

    showToast(`${planLabel} aktif untuk ${userName}`, '✅');

    // Kalau mengaktifkan diri sendiri, reload plan
    if (userId === me.id) { await loadPlan(); renderPlanInfo(); }

  } catch(e) {
    errEl.textContent = 'Gagal: ' + e.message;
  }
  setBtnLoading('btnAktivasi', false, '✓ Aktifkan Sekarang');
}
