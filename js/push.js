// ═══════════════════════════════════════════════
// WEB PUSH NOTIFICATION — MarketPro
//
// Arsitektur (Pure Frontend, tanpa backend):
//  1. Browser subscribe ke push service → dapat PushSubscription
//  2. Subscription disimpan ke Supabase tabel push_subscriptions
//  3. Saat trigger (follow-up, berkas, dll), kirim push pakai
//     Web Push Protocol langsung dari browser via fetch ke push endpoint
//  4. Service Worker menangkap push event dan tampilkan notifikasi
//
// CATATAN: Untuk production, kirim push sebaiknya dari server/Edge Function
// agar VAPID private key tidak exposed. Setup ini cocok untuk tim internal.
// ═══════════════════════════════════════════════

// ── VAPID PUBLIC KEY ─────────────────────────────
// Ganti dengan VAPID keys Anda sendiri (generate dengan web-push library)
// atau gunakan yang sudah ada di bawah ini (contoh)
const VAPID_PUBLIC_KEY = 'BAwojF3hgUJnG19rMW56ww8jkraryTW4-P3wmh6ssA3TvR0BLBjL1ByD5OTe-5Td6Qdoi0VMUZ9cVhwVHzcicgs';

// ── STATE ────────────────────────────────────────
let pushEnabled = false;
let pushSub     = null;

// ── INIT ─────────────────────────────────────────
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push tidak didukung browser ini');
    updatePushUI(false, 'unsupported');
    return;
  }
  // Cek permission yang ada
  const perm = Notification.permission;
  if (perm === 'denied') { updatePushUI(false, 'denied'); return; }

  // Cek apakah sudah subscribe
  try {
    const reg = await navigator.serviceWorker.ready;
    pushSub = await reg.pushManager.getSubscription();
    if (pushSub) {
      pushEnabled = true;
      await syncSubscriptionToDb(pushSub);
    }
    updatePushUI(pushEnabled, perm);
  } catch(e) {
    console.warn('initPush:', e);
    updatePushUI(false, 'error');
  }
}

// ── SUBSCRIBE ────────────────────────────────────
async function enablePushNotification() {
  // Cek dukungan dasar Notification API
  if (!('Notification' in window)) {
    showToast('Browser ini tidak mendukung notifikasi', '⚠️'); return;
  }

  // Minta izin notifikasi
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') {
    showToast('Izin notifikasi ditolak — aktifkan di pengaturan browser', '⚠️');
    updatePushUI(false, 'denied');
    return;
  }

  pushEnabled = true;
  updatePushUI(true, 'granted');
  showToast('Notifikasi aktif!', '🔔');

  // Coba subscribe ke push service (opsional — untuk push dari server)
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await syncSubscriptionToDb(pushSub);
    } catch(e) {
      // Gagal subscribe push service — notifikasi lokal tetap jalan
      console.warn('Push subscription failed (notif lokal tetap aktif):', e.message);
    }
  }

  // Test notifikasi
  await sendLocalPush({
    title: 'MarketPro — Notifikasi Aktif! 🎉',
    body:  'Anda akan menerima reminder follow-up, berkas, dan DP secara otomatis.',
    tag:   'push-test',
  });
}

// ── UNSUBSCRIBE ──────────────────────────────────
async function disablePushNotification() {
  try {
    if (pushSub) {
      await pushSub.unsubscribe();
      await removeSubscriptionFromDb(pushSub);
      pushSub = null;
    }
    pushEnabled = false;
    updatePushUI(false, 'granted');
    showToast('Notifikasi dinonaktifkan', '🔕');
  } catch(e) {
    console.error('disablePush:', e);
    showToast('Gagal menonaktifkan notifikasi', '❌');
  }
}

// ── TOGGLE ───────────────────────────────────────
async function togglePushNotification(enable) {
  if (enable) await enablePushNotification();
  else await disablePushNotification();
}

// ── SYNC KE DATABASE ─────────────────────────────
async function syncSubscriptionToDb(sub) {
  if (!sb || !me) return;
  const subJson = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert({
    user_id:  me.id,
    endpoint: sub.endpoint,
    p256dh:   subJson.keys?.p256dh || '',
    auth:     subJson.keys?.auth || '',
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' });
  if (error) console.warn('syncSubscription:', error.message);
}

async function removeSubscriptionFromDb(sub) {
  if (!sb || !me) return;
  await sb.from('push_subscriptions')
    .delete()
    .eq('user_id', me.id)
    .eq('endpoint', sub.endpoint);
}

// ── UPDATE UI ─────────────────────────────────────
function updatePushUI(enabled, state) {
  const toggle  = document.getElementById('pushToggle');
  const label   = document.getElementById('pushLabel');
  const desc    = document.getElementById('pushDesc');
  const row     = document.getElementById('pushRow');

  if (!toggle) return;

  if (state === 'unsupported') {
    if (row) row.style.opacity = '.5';
    if (desc) desc.textContent = 'Browser ini tidak mendukung push notification';
    toggle.disabled = true;
    return;
  }
  if (state === 'denied') {
    if (desc) desc.textContent = 'Izin notifikasi diblokir — ubah di pengaturan browser';
    toggle.checked = false;
    toggle.disabled = true;
    return;
  }

  toggle.checked  = enabled;
  toggle.disabled = false;
  const thumb = document.getElementById('pushThumb');
  if (thumb) thumb.textContent = enabled ? '🔔' : '🔕';
  if (label) label.textContent = enabled ? '🔔 Notifikasi Aktif' : '🔕 Notifikasi Nonaktif';
  if (desc)  desc.textContent  = enabled
    ? 'Reminder follow-up, berkas, & DP dikirim ke HP ini'
    : 'Aktifkan untuk menerima reminder otomatis di HP';

  // Update device list
  if (enabled && sb && me) updatePushDeviceList();
}

// ── SEND LOCAL NOTIFICATION ──────────────────────
// Strategi berlapis:
// 1. Coba Notification API langsung (paling reliable di halaman aktif)
// 2. Fallback ke registration.showNotification() via SW
// 3. Fallback ke postMessage ke SW active
async function sendLocalPush({ title, body, icon, tag, url, data }) {
  if (Notification.permission !== 'granted') return;

  const opts = {
    body:    body    || '',
    icon:    icon    || './manifest.json',
    badge:   './manifest.json',
    tag:     tag     || 'mp-' + Date.now(),
    data:    { ...(data || {}), url: url || '/' },
    vibrate: [200, 100, 200],
  };

  try {
    // Cara 1: registration.showNotification — paling reliable
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, opts);
    return;
  } catch(e1) {
    console.warn('SW showNotification failed:', e1);
  }

  try {
    // Cara 2: Notification API langsung (fallback)
    new Notification(title, opts);
    return;
  } catch(e2) {
    console.warn('Notification API failed:', e2);
  }

  try {
    // Cara 3: postMessage ke SW active
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: 'SHOW_NOTIFICATION', title, ...opts });
    }
  } catch(e3) {
    console.warn('postMessage to SW failed:', e3);
  }
}

// ── SCHEDULED CHECK ───────────────────────────────
// Dijalankan saat app dibuka & saat data berubah
// Cek reminder dan kirim push jika pushEnabled
function checkAndSendPushReminders() {
  if (!pushEnabled || !pushSub) return;

  const today    = new Date();
  const todayStr = today.toDateString();

  allKons.forEach(k => {
    // Follow-up hari ini
    if (k.tgl_followup) {
      const fd   = new Date(k.tgl_followup + 'T00:00:00');
      const diff = Math.floor((fd - today) / 86400000);
      if (diff === 0) {
        const key = `push-fu-today-${k.id}-${todayStr}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          sendLocalPush({
            title: '📅 Follow-up Hari Ini!',
            body:  `${k.nama} — ${sLabel(k.status)} · ${k.unit || '—'}`,
            tag:   'fu-today-' + k.id,
            url:   '/?open=' + k.id,
            data:  { konsumenId: k.id },
          });
        }
      }
      // Follow-up besok — kirim malam hari
      if (diff === 1 && today.getHours() >= 18) {
        const key = `push-fu-tmr-${k.id}-${todayStr}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          sendLocalPush({
            title: '📅 Reminder Follow-up Besok',
            body:  `${k.nama} — Jadwal besok ${fDateShort(k.tgl_followup)}`,
            tag:   'fu-tmr-' + k.id,
            url:   '/?open=' + k.id,
            data:  { konsumenId: k.id },
          });
        }
      }
    }

    // Booking > 7 hari tanpa follow-up
    if (k.status === 'booking' && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      if (d >= 7 && d % 7 === 0) {
        const key = `push-booking-${k.id}-${d}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          sendLocalPush({
            title: '⏰ Booking Perlu Ditindaklanjuti',
            body:  `${k.nama} sudah booking ${d} hari — segera follow up!`,
            tag:   'booking-' + k.id,
            url:   '/?open=' + k.id,
          });
        }
      }
    }

    // DP belum selesai > 14 hari
    if (k.status === 'dp' && k.tgl_booking) {
      const d = Math.floor((today - new Date(k.tgl_booking)) / 86400000);
      if (d >= 14 && d % 7 === 0) {
        const key = `push-dp-${k.id}-${d}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          sendLocalPush({
            title: '💰 Proses DP Belum Selesai',
            body:  `${k.nama} — Proses DP sudah ${d} hari, perlu dicek`,
            tag:   'dp-' + k.id,
            url:   '/?open=' + k.id,
          });
        }
      }
    }
  });
}

// ── UTILS ─────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ── HANDLE NOTIF CLICK (deep link) ───────────────
// Dipanggil saat SW mengirim pesan balik ke client
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'NOTIFICATION_CLICK' && e.data.konsumenId) {
      // Buka detail konsumen yang diklik dari notifikasi
      const k = allKons?.find(x => x.id === e.data.konsumenId);
      if (k) {
        switchPage('konsumen');
        setTimeout(() => openDetail(e.data.konsumenId), 300);
      }
    }
  });
}

// ── DEVICE LIST ───────────────────────────────────
async function updatePushDeviceList() {
  const el = document.getElementById('pushDeviceList');
  if (!el || !sb || !me) return;
  const { data } = await sb.from('push_subscriptions')
    .select('endpoint, user_agent, updated_at')
    .eq('user_id', me.id)
    .order('updated_at', { ascending: false });
  if (!data || !data.length) {
    el.innerHTML = '<span style="color:var(--text-4)">Belum ada device terdaftar</span>';
    return;
  }
  el.innerHTML = data.map(d => {
    const ua    = d.user_agent || '';
    const name  = ua.includes('iPhone') || ua.includes('iPad') ? '📱 iPhone/iPad'
                : ua.includes('Android') ? '📱 Android'
                : ua.includes('Chrome')  ? '💻 Chrome'
                : ua.includes('Firefox') ? '💻 Firefox'
                : ua.includes('Safari')  ? '💻 Safari'
                : '🖥 Browser';
    const when = fDate(d.updated_at);
    return \`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px">
      <span style="color:var(--text-2)">\${name}</span>
      <span style="color:var(--text-4)">\${when}</span>
    </div>\`;
  }).join('');
}
