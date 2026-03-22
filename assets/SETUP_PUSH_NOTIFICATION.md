# Setup Push Notification Server — PropMap

Push notification PropMap menggunakan **Supabase Edge Functions** + **Web Push VAPID**.
Setelah setup ini, user akan menerima notifikasi meski browser/app ditutup.

---

## LANGKAH 1 — Generate VAPID Keys

Jalankan perintah ini di terminal (butuh Node.js):

```bash
npx web-push generate-vapid-keys
```

Hasilnya:
```
Public Key:  BNabc123...
Private Key: xyz789...
```

Simpan kedua key ini — dipakai di langkah berikutnya.

---

## LANGKAH 2 — Tambahkan VAPID Key ke Aplikasi

Edit file `js/push.js`, cari baris:
```js
const VAPID_PUBLIC_KEY = 'GANTI_DENGAN_VAPID_PUBLIC_KEY_ANDA';
```

Ganti dengan Public Key dari langkah 1:
```js
const VAPID_PUBLIC_KEY = 'BNabc123...'; // ← Public Key Anda
```

---

## LANGKAH 3 — Deploy Edge Function ke Supabase

### Install Supabase CLI
```bash
C
supabase login
```

### Link ke project Anda
```bash
supabase link --project-ref [PROJECT_REF]
```
Project REF ada di Supabase Dashboard → Project Settings → General → Reference ID

### Deploy function
```bash
supabase functions deploy push-reminder --no-verify-jwt
```

---

## LANGKAH 4 — Set Secrets di Supabase

Buka **Supabase Dashboard → Edge Functions → push-reminder → Secrets**
atau via CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY="BNabc123..."
supabase secrets set VAPID_PRIVATE_KEY="xyz789..."
supabase secrets set VAPID_SUBJECT="mailto:email_anda@gmail.com"
supabase secrets set CRON_SECRET="buat_password_acak_di_sini"
```

> `CRON_SECRET` bebas diisi apa saja — ini password untuk melindungi endpoint function dari akses luar.

---

## LANGKAH 5 — Setup Cron Job di Supabase

Buka **Supabase Dashboard → Database → Extensions**
Aktifkan extension **pg_cron** jika belum aktif.

Lalu buka **SQL Editor** dan jalankan:

```sql
-- Kirim reminder setiap hari jam 07:00 WIB (00:00 UTC)
SELECT cron.schedule(
  'push-reminder-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[PROJECT_REF].supabase.co/functions/v1/push-reminder',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "buat_password_acak_di_sini"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Ganti `[PROJECT_REF]` dengan Reference ID project Anda.
Ganti `buat_password_acak_di_sini` dengan CRON_SECRET yang sama di langkah 4.

---

## LANGKAH 6 — Update RLS Tabel push_subscriptions

Jalankan di Supabase SQL Editor:

```sql
-- User bisa insert/update/delete subscription sendiri
DROP POLICY IF EXISTS "User kelola subscription sendiri" ON push_subscriptions;

CREATE POLICY "User insert subscription"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "User update subscription"
  ON push_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "User delete subscription"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Service role (Edge Function) bisa baca semua
CREATE POLICY "Service baca semua subscription"
  ON push_subscriptions FOR SELECT
  USING (true);
```

---

## LANGKAH 7 — Test

1. Deploy aplikasi PropMap ke Netlify dengan `js/push.js` yang sudah diupdate
2. Login sebagai user Pro/Business
3. Buka Pengaturan → aktifkan toggle Notifikasi
4. Cek Supabase → Table Editor → `push_subscriptions` — harus ada baris baru
5. Test kirim manual via curl:

```bash
curl -X POST \
  https://[PROJECT_REF].supabase.co/functions/v1/push-reminder \
  -H "x-cron-secret: buat_password_acak_di_sini"
```

---

## Jadwal Notifikasi

| Kondisi | Kapan Dikirim |
|---|---|
| Follow-up hari ini | Setiap hari jam 07:00 WIB |
| Follow-up besok | Setiap hari jam 07:00 WIB |
| Booking > 7 hari | Setiap kelipatan 7 hari |
| Berkas belum lengkap | Setiap kelipatan 7 hari (min 7 hari) |

---

## Troubleshooting

**Notifikasi tidak masuk meski sudah setup:**
- Cek `push_subscriptions` di Supabase — pastikan ada data endpoint
- Cek log Edge Function: Supabase Dashboard → Edge Functions → push-reminder → Logs
- Pastikan VAPID_PUBLIC_KEY di `push.js` sama persis dengan yang di Supabase Secrets

**Error `401 Unauthorized` di Edge Function:**
- Cek CRON_SECRET di curl sama dengan yang di Supabase Secrets

**Subscription tidak tersimpan ke DB:**
- Pastikan RLS policy push_subscriptions sudah dijalankan (Langkah 6)

---

*PropMap v4.2 · Push Notification Setup Guide*
