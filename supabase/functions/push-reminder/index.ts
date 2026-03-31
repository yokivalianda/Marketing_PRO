// ═══════════════════════════════════════════════════════════
// PropMap — Supabase Edge Function: push-reminder
// Deno-native Web Push (tanpa dependency npm web-push)
// Menggunakan Web Crypto API untuk VAPID signing + payload encryption
// Jadwal: setiap hari jam 07:00 WIB (00:00 UTC) via pg_cron
// ═══════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@propmap.id';
const CRON_SECRET   = Deno.env.get('CRON_SECRET')       ?? '';

// ── BASE64URL HELPERS ─────────────────────────────
function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const pad = '='.repeat((4 - str.length % 4) % 4);
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ── CONCAT BUFFERS ────────────────────────────────
function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

// ── HKDF USING WEB CRYPTO ─────────────────────────
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // HKDF-Extract: PRK = HMAC-SHA256(salt, ikm)
  const extractKey = await crypto.subtle.importKey(
    'raw', salt.length ? salt : new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', extractKey, ikm));

  // HKDF-Expand: OKM = HMAC-SHA256(PRK, info || 0x01) truncated to length
  const expandKey = await crypto.subtle.importKey(
    'raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const t = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, concat(info, new Uint8Array([1]))));
  return t.slice(0, length);
}

// ── VAPID JWT GENERATION ──────────────────────────
async function generateVapidAuth(audience: string): Promise<string> {
  const publicKeyBytes = b64urlDecode(VAPID_PUBLIC);
  const x = b64urlEncode(publicKeyBytes.slice(1, 33));
  const y = b64urlEncode(publicKeyBytes.slice(33, 65));
  const d = VAPID_PRIVATE;

  const signingKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  const enc = new TextEncoder();
  const header  = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64urlEncode(enc.encode(JSON.stringify({
    aud: audience, exp: now + 86400, sub: VAPID_SUBJECT,
  })));

  const input = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    enc.encode(input)
  );

  const jwt = `${input}.${b64urlEncode(signature)}`;
  return `vapid t=${jwt}, k=${VAPID_PUBLIC}`;
}

// ── WEB PUSH ENCRYPTION (RFC 8291, aes128gcm) ────
async function encryptPayload(
  p256dhStr: string,
  authStr: string,
  payloadStr: string,
): Promise<Uint8Array> {
  const subscriberPublicRaw = b64urlDecode(p256dhStr);
  const authSecret = b64urlDecode(authStr);
  const plaintext = new TextEncoder().encode(payloadStr);

  // Import subscriber's ECDH public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw', subscriberPublicRaw,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const ephemeralPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey)
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberKey },
      ephemeral.privateKey, 256
    )
  );

  // RFC 8291 key derivation
  const enc = new TextEncoder();
  const keyInfo = concat(enc.encode('WebPush: info\0'), subscriberPublicRaw, ephemeralPublicRaw);
  const ikm    = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  const salt     = crypto.getRandomValues(new Uint8Array(16));
  const cek      = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce    = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  // Pad + encrypt (0x02 = final record delimiter)
  const padded   = concat(plaintext, new Uint8Array([2]));
  const aesKey   = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  );

  // aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([65]), ephemeralPublicRaw, ciphertext);
}

// ── KIRIM SATU NOTIFIKASI ─────────────────────────
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  title: string,
  body: string,
  konsumenId?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const payload = JSON.stringify({
      title, body,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag:   'propmap-' + Date.now(),
      data:  { konsumenId: konsumenId ?? '' },
    });

    const encrypted = await encryptPayload(p256dh, auth, payload);

    const url      = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidAuth = await generateVapidAuth(audience);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization':     vapidAuth,
        'TTL':              '86400',
        'Urgency':          'normal',
      },
      body: encrypted,
    });

    if (response.ok || response.status === 201) {
      return { ok: true, status: response.status };
    }
    return { ok: false, status: response.status, error: await response.text() };
  } catch (e: unknown) {
    const err = e as { message?: string };
    return { ok: false, error: err.message };
  }
}

// ── MAIN ──────────────────────────────────────────
Deno.serve(async (req) => {
  // Verifikasi CRON_SECRET
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys belum diset di Supabase Secrets' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now      = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tom      = new Date(now); tom.setDate(now.getDate() + 1);
  const tomStr   = tom.toISOString().split('T')[0];

  // Ambil semua push subscriptions
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth');

  if (subErr) {
    return new Response(
      JSON.stringify({ error: 'Gagal ambil subscriptions: ' + subErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!subs?.length) {
    return new Response(
      JSON.stringify({ sent: 0, message: 'Tidak ada subscriber aktif' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // [FIX #2] Ambil konsumen aktif — termasuk cek-lokasi
  const { data: konsumens } = await supabase
    .from('konsumen')
    .select('id, nama, status, tgl_followup, tgl_booking, unit, owner_id, berkas')
    .in('status', ['cek-lokasi', 'booking', 'dp', 'berkas']);

  const allKons = konsumens ?? [];
  let sent = 0;
  let skipped = 0;
  // [FIX #3] Track invalid endpoints, bukan user_id
  const invalidEndpoints: string[] = [];
  const errs: string[] = [];

  for (const sub of subs) {
    const myKons = allKons.filter(k => k.owner_id === sub.user_id);
    const notifs: { title: string; body: string; konsumenId: string }[] = [];

    for (const k of myKons) {
      // Follow-up hari ini
      if (k.tgl_followup === todayStr) {
        notifs.push({
          title: '📅 Follow-up Hari Ini!',
          body:  `${k.nama}${k.unit ? ' · ' + k.unit : ''} — segera hubungi!`,
          konsumenId: k.id,
        });
      }
      // Follow-up besok
      if (k.tgl_followup === tomStr) {
        notifs.push({
          title: '📅 Reminder Follow-up Besok',
          body:  `${k.nama} — jadwal follow-up besok`,
          konsumenId: k.id,
        });
      }
      // [FIX #2] Booking & cek-lokasi > 7 hari (tiap 7 hari)
      if ((k.status === 'booking' || k.status === 'cek-lokasi') && k.tgl_booking) {
        const days = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        if (days > 0 && days % 7 === 0) {
          notifs.push({
            title: '⏰ Konsumen Perlu Ditindaklanjuti',
            body:  `${k.nama} sudah ${days} hari sejak booking — segera follow up!`,
            konsumenId: k.id,
          });
        }
      }
      // DP >= 14 hari (tiap 7 hari)
      if (k.status === 'dp' && k.tgl_booking) {
        const days = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        if (days >= 14 && days % 7 === 0) {
          notifs.push({
            title: '💰 Proses DP Masih Berlangsung',
            body:  `${k.nama} — Proses DP sudah ${days} hari`,
            konsumenId: k.id,
          });
        }
      }
      // Berkas belum lengkap >= 7 hari (tiap 7 hari)
      if (k.status === 'berkas' && k.tgl_booking) {
        const days  = Math.floor((now.getTime() - new Date(k.tgl_booking).getTime()) / 86400000);
        const kurang = (Array.isArray(k.berkas) ? k.berkas : [])
          .filter((b: { done: boolean }) => !b.done).length;
        if (days >= 7 && kurang > 0 && days % 7 === 0) {
          notifs.push({
            title: '📁 Berkas Belum Lengkap',
            body:  `${k.nama} — ${kurang} berkas masih kurang`,
            konsumenId: k.id,
          });
        }
      }
    }

    if (!notifs.length) { skipped++; continue; }

    for (const n of notifs) {
      const res = await sendPush(sub.endpoint, sub.p256dh, sub.auth, n.title, n.body, n.konsumenId);
      if (res.ok) {
        sent++;
      } else if (res.status === 410 || res.status === 404) {
        // [FIX #3] Simpan endpoint, bukan user_id — agar device lain tidak ikut terhapus
        invalidEndpoints.push(sub.endpoint);
        break;
      } else {
        errs.push(`${sub.user_id}: ${res.error}`);
      }
    }
  }

  // [FIX #3] Hapus hanya endpoint yang expired (410 Gone), bukan semua device user
  if (invalidEndpoints.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', invalidEndpoints);
  }

  return new Response(
    JSON.stringify({
      sent, skipped,
      invalid_removed: invalidEndpoints.length,
      errors: errs.slice(0, 5),
      timestamp: now.toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
