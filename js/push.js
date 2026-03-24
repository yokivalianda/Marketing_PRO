// ═══════════════════════════════════════════════
// WEB PUSH NOTIFICATION — MarketPro v4
// Pendekatan: Notification API langsung via SW
// ═══════════════════════════════════════════════

let pushEnabled = false;

// VAPID Public Key — harus sama dengan yang di Supabase Secrets
// Generate di: https://vapidkeys.com atau jalankan: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BOvFp7f2wYwyBrih2O4aP7nQvj08L96HIkkSgBT7ZSQjns4sLOlly2bCM5dkan7gB5sqhuiFiPjirrr9Zi_DK0g';

// Konversi VAPID key ke Uint8Array untuk PushManager
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Simpan subscription ke Supabase
// Deteksi nama device dari user agent
function getDeviceName() {
  const ua = navigator.userAgent;
  let os = 'Desktop';
  if (/android/i.test(ua))       os = 'Android';
  else if (/iphone/i.test(ua))   os = 'iPhone';
  else if (/ipad/i.test(ua))     os = 'iPad';
  else if (/windows/i.test(ua))  os = 'Windows';
  else if (/mac/i.test(ua))      os = 'Mac';
  else if (/linux/i.test(ua))    os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua))           browser = 'Edge';
  else if (/chrome/i.test(ua))   browser = 'Chrome';
  else if (/firefox/i.test(ua))  browser = 'Firefox';
  else if (/safari/i.test(ua))   browser = 'Safari';
  else if (/brave/i.test(ua))    browser = 'Brave';

  return `${os} · ${browser}`;
}

async function savePushSubscription(subscription) {
  if (!sb || !me) return;
  const key  = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');
  if (!key || !auth) return;

  const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)))
    .replace(/\+/g, '-').replace(/\//g, '_');
  const authStr = btoa(String.fromCharCode(...new Uint8Array(auth)))
    .replace(/\+/g, '-').replace(/\//g, '_');
  const deviceName = getDeviceName();

  try {
    // Hapus dulu data lama user ini, baru insert baru
    // Hindari konflik UNIQUE constraint (user_id, endpoint)
    await sb.from('push_subscriptions').delete().eq('user_id', me.id);
    const { error } = await sb.from('push_subscriptions').insert({
      user_id:     me.id,
      endpoint:    subscription.endpoint,
      p256dh,
      auth:        authStr,
      device_name: deviceName,
    });
    if (error) throw error;
    console.log('Push subscription saved:', deviceName);
    renderPushDeviceList();
  } catch(e) {
    console.warn('Save push subscription failed:', e.message);
  }
}

// Hapus subscription dari DB saat nonaktif
async function removePushSubscription() {
  if (!sb || !me) return;
  try {
    await sb.from('push_subscriptions').delete().eq('user_id', me.id);
    renderPushDeviceList();
  } catch(e) {
    console.warn('Remove push subscription failed:', e.message);
  }
}

// Tampilkan daftar device terdaftar di UI pengaturan
async function renderPushDeviceList() {
  const el = document.getElementById('pushDeviceList');
  if (!el || !sb || !me) return;
  try {
    const { data } = await sb.from('push_subscriptions')
      .select('device_name, created_at')
      .eq('user_id', me.id);
    if (!data?.length) {
      el.textContent = 'Belum ada device terdaftar';
      return;
    }
    el.innerHTML = data.map(d => {
      const nama   = d.device_name || 'Device tidak diketahui';
      const tgl    = d.created_at
        ? new Date(d.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })
        : '';
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--glass-border)">
        <span style="font-size:16px">📱</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text-1)">${nama}</div>
          ${tgl ? `<div style="font-size:11px;color:var(--text-4)">Terdaftar ${tgl}</div>` : ''}
        </div>
        <span style="margin-left:auto;font-size:10px;background:rgba(16,185,129,.12);color:var(--emerald);padding:2px 8px;border-radius:20px;font-weight:700">Aktif</span>
      </div>`;
    }).join('');
  } catch(e) {
    el.textContent = 'Gagal memuat device';
  }
}

// ── INIT ─────────────────────────────────────────
async function initPush() {
  if (typeof requirePro === 'function' && !requirePro('notifikasi_push')) return;
  if (!('Notification' in window)) {
    updatePushUI(false, 'unsupported'); return;
  }
  const perm = Notification.permission;
  if (perm === 'denied')  { updatePushUI(false, 'denied');  return; }
  if (perm === 'granted') {
    pushEnabled = true;
    updatePushUI(true, 'granted');
    renderPushDeviceList();
  } else {
    updatePushUI(false, 'default');
  }
}

// ── TOGGLE ───────────────────────────────────────
async function togglePushNotification(on) {
  if (on) {
    if (typeof requirePro === 'function' && !requirePro('notifikasi_push')) {
      const tog = document.getElementById('pushToggle');
      if (tog) tog.checked = false;
      return;
    }
    await enablePushNotification();
  } else {
    disablePushNotification();
  }
}

async function enablePushNotification() {
  if (!('Notification' in window)) {
    showToast('Browser ini tidak mendukung notifikasi', '⚠️');
    updatePushUI(false, 'unsupported'); return;
  }

  // Minta izin — HARUS dari gesture user (klik toggle sudah memenuhi syarat)
  const perm = await Notification.requestPermission();

  if (perm !== 'granted') {
    showToast('Izin notifikasi ditolak', '⚠️');
    updatePushUI(false, 'denied'); return;
  }

  pushEnabled = true;
  updatePushUI(true, 'granted');
  showToast('Notifikasi diaktifkan!', '🔔');

  // Subscribe ke PushManager untuk push dari server
  try {
    if (!('PushManager' in window)) throw new Error('Browser tidak mendukung Web Push');
    if (VAPID_PUBLIC_KEY === 'GANTI_DENGAN_VAPID_PUBLIC_KEY_ANDA') throw new Error('VAPID key belum diisi');

    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) throw new Error('PushManager tidak tersedia');

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await savePushSubscription(sub);
    console.log('Push subscription berhasil ✅');

  } catch(e) {
    console.warn('PushManager subscribe failed:', e.message);

    // Deteksi Brave / browser yang blokir push
    const isBraveBrowser = navigator.brave && await navigator.brave.isBrave().catch(() => false);
    if (isBraveBrowser || e.message?.includes('push service')) {
      showToast('Notifikasi lokal aktif. Untuk push server, pakai Chrome atau matikan Brave Shield.', '⚠️');
    }
    // Notifikasi lokal tetap aktif meski server push gagal
  }

  // Kirim notifikasi test langsung
  showNotif('🎉 PropMap — Notifikasi Aktif', 'Anda akan menerima reminder follow-up, berkas, dan DP secara otomatis.');
}

async function disablePushNotification() {
  pushEnabled = false;
  updatePushUI(false, 'granted');
  showToast('Notifikasi dinonaktifkan', '🔕');

  // Unsubscribe dari PushManager dan hapus dari DB
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await removePushSubscription();
  } catch(e) {
    console.warn('Unsubscribe failed:', e.message);
  }
}

// ── SHOW NOTIFICATION ─────────────────────────────
// Fungsi inti — satu cara, paling simpel, paling reliable
function showNotif(title, body, opts = {}) {
  if (Notification.permission !== 'granted') return;

  const options = {
    body,
    icon:    opts.icon    || '/icons/icon-192.png',
    badge:   opts.badge   || '/icons/icon-72.png',
    tag:     opts.tag     || 'mp-' + Date.now(),
    vibrate: [200, 100, 200],
    data:    opts.data    || {},
    requireInteraction: false,
  };

  // Prioritas 1: showNotification via SW registration (bisa muncul walau tab tidak aktif)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(title, options))
      .catch(() => {
        // Fallback: Notification API biasa
        try { new Notification(title, options); } catch(e) { console.warn('Notif gagal:', e); }
      });
    return;
  }

  // Prioritas 2: Notification API langsung (SW belum aktif)
  try {
    new Notification(title, options);
  } catch(e) {
    console.warn('Notification gagal:', e);
  }
}

// ── CEK & KIRIM REMINDER ─────────────────────────
function checkAndSendPushReminders() {
  if (!pushEnabled || Notification.permission !== 'granted') return;

  const today    = new Date();
  const todayStr = today.toDateString();

  allKons.forEach(k => {
    // ── Follow-up hari ini
    if (k.tgl_followup) {
      const fd   = new Date(k.tgl_followup + 'T00:00:00');
      const diff = Math.round((fd - new Date(todayStr)) / 86400000);

      if (diff === 0) {
        const key = `notif-fu-today-${k.id}-${todayStr}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showNotif(
            '📅 Follow-up Hari Ini!',
            `${k.nama} — ${sLabel(k.status)}${k.unit ? ' · ' + k.unit : ''}`,
            { tag: 'fu-today-' + k.id, data: { konsumenId: k.id } }
          );
        }
      }

      // Follow-up besok (kirim setelah jam 17)
      if (diff === 1 && today.getHours() >= 17) {
        const key = `notif-fu-tmr-${k.id}-${todayStr}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showNotif(
            '📅 Reminder: Follow-up Besok',
            `${k.nama} — Jadwal ${fDateShort(k.tgl_followup)}`,
            { tag: 'fu-tmr-' + k.id, data: { konsumenId: k.id } }
          );
        }
      }
    }

    // ── Booking terlalu lama (tiap 7 hari)
    if ((k.status === 'booking' || k.status === 'cek-lokasi') && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      if (d > 0 && d % 7 === 0) {
        const key = `notif-booking-${k.id}-${d}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showNotif(
            '⏰ Booking Perlu Ditindaklanjuti',
            `${k.nama} sudah booking ${d} hari lalu — segera follow up!`,
            { tag: 'booking-' + k.id, data: { konsumenId: k.id } }
          );
        }
      }
    }

    // ── Proses DP terlalu lama (setelah 14 hari, tiap 7 hari)
    if (k.status === 'dp' && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      if (d >= 14 && d % 7 === 0) {
        const key = `notif-dp-${k.id}-${d}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showNotif(
            '💰 Proses DP Masih Berlangsung',
            `${k.nama} — Proses DP sudah ${d} hari, perlu dicek`,
            { tag: 'dp-' + k.id, data: { konsumenId: k.id } }
          );
        }
      }
    }

    // ── Berkas belum lengkap > 7 hari di status berkas
    if (k.status === 'berkas' && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      const kurang = (Array.isArray(k.berkas) ? k.berkas : []).filter(b => !b.done).length;
      if (d >= 7 && kurang > 0 && d % 7 === 0) {
        const key = `notif-berkas-${k.id}-${d}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          showNotif(
            '📁 Berkas Belum Lengkap',
            `${k.nama} — ${kurang} berkas belum dikumpulkan`,
            { tag: 'berkas-' + k.id, data: { konsumenId: k.id } }
          );
        }
      }
    }
  });
}

// ── UPDATE UI ─────────────────────────────────────
function updatePushUI(enabled, state) {
  const toggle = document.getElementById('pushToggle');
  const label  = document.getElementById('pushLabel');
  const desc   = document.getElementById('pushDesc');
  const thumb  = document.getElementById('pushThumb');
  if (!toggle) return;

  if (state === 'unsupported') {
    if (desc) desc.textContent = 'Browser ini tidak mendukung notifikasi';
    toggle.disabled = true; toggle.checked = false; return;
  }
  if (state === 'denied') {
    if (desc) desc.textContent = 'Izin diblokir — ubah di pengaturan browser';
    toggle.disabled = true; toggle.checked = false; return;
  }

  toggle.disabled = false;
  toggle.checked  = enabled;
  if (thumb) thumb.textContent = enabled ? '🔔' : '🔕';
  if (label) label.textContent = enabled ? '🔔 Notifikasi Aktif' : '🔕 Notifikasi Nonaktif';
  if (desc)  desc.textContent  = enabled
    ? 'Reminder follow-up, berkas, & DP akan muncul di HP ini'
    : 'Aktifkan untuk menerima reminder otomatis';
}

// ── HANDLE KLIK NOTIFIKASI (deep link) ───────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'NOTIFICATION_CLICK' && e.data.konsumenId) {
      const id = e.data.konsumenId;
      if (allKons?.find(x => x.id === id)) {
        switchPage('konsumen');
        setTimeout(() => openDetail(id), 300);
      }
    }
  });
}
