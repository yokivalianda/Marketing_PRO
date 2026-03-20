// ═══════════════════════════════════════════════
// WEB PUSH NOTIFICATION — MarketPro v4
// Pendekatan: Notification API langsung via SW
// ═══════════════════════════════════════════════

let pushEnabled = false;

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
  } else {
    updatePushUI(false, 'default');
  }
}

// ── TOGGLE ───────────────────────────────────────
async function togglePushNotification(on) {
  if (on && typeof requirePro === 'function' && !requirePro('notifikasi_push')) {
    // Kembalikan toggle ke posisi off
    const tog = document.getElementById('pushToggle');
    if (tog) tog.checked = false;
    return;
  }
  if (on) await enablePushNotification();
  else         disablePushNotification();
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

  // Kirim notifikasi test langsung
  showNotif('🎉 MarketPro — Notifikasi Aktif', 'Anda akan menerima reminder follow-up, berkas, dan DP secara otomatis.');
}

function disablePushNotification() {
  pushEnabled = false;
  updatePushUI(false, 'granted');
  showToast('Notifikasi dinonaktifkan', '🔕');
}

// ── SHOW NOTIFICATION ─────────────────────────────
// Fungsi inti — satu cara, paling simpel, paling reliable
function showNotif(title, body, opts = {}) {
  if (Notification.permission !== 'granted') return;

  const options = {
    body,
    icon:    opts.icon    || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f3af.png',
    badge:   opts.badge   || 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/72x72/1f514.png',
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
