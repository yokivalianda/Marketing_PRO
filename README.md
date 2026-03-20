# PropMap — CRM Tim Marketing Properti

<div align="center">

![version](https://img.shields.io/badge/PropMap-v4.2-6366f1?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge)
![License](https://img.shields.io/badge/Lisensi-MIT-10b981?style=for-the-badge)

**Aplikasi CRM web real-time untuk monitoring dan pengelolaan data konsumen properti.**
Install di HP (PWA), multi-user, sinkronisasi real-time — lengkap dengan sistem monetisasi plan Gratis / Pro / Business.

[🚀 **Coba Demo**](https://propmapid.netlify.app/demo) · [📱 **Buka Aplikasi**](https://propmapid.netlify.app/)

</div>

---

## 📸 Screenshot

<div align="center">
<table>
  <tr>
    <td align="center">
      <img src="screenshots/screen-01-dashboard-dark.svg" width="160" alt="Dashboard"/>
      <br/><sub><b>Dashboard</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-02-konsumen-dark.svg" width="160" alt="Konsumen"/>
      <br/><sub><b>Daftar Konsumen</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-03-filter-dark.svg" width="160" alt="Filter Lanjutan"/>
      <br/><sub><b>Filter Lanjutan</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="screenshots/screen-04-laporan-light.svg" width="160" alt="Laporan"/>
      <br/><sub><b>Laporan & Target ☀️</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-05-kalender-dark.svg" width="160" alt="Kalender"/>
      <br/><sub><b>Kalender Follow-up</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-06-login-light.svg" width="160" alt="Login"/>
      <br/><sub><b>Login & Konfirmasi Email ☀️</b></sub>
    </td>
  </tr>
</table>
</div>

---

## 💰 Paket Langganan per Bulan/Tahun

| | Gratis | Pro | Business |
|---|---|---|---|
| **Harga** | Rp 0 | Rp 100.000/bln | Rp 299.000/bln |
| **Konsumen** | Maks 20 | Tidak terbatas | Tidak terbatas |
| **Trial** | — | 14 hari gratis | - |
| Export Excel/PDF/CSV | ✕ | ✓ | ✓ |
| Upload foto berkas | ✕ | ✓ maks 10/item | ✓ tidak terbatas |
| Filter lanjutan & bulan | ✕ | ✓ | ✓ |
| Target penjualan | ✕ | ✓ | ✓ |
| Notifikasi push | ✕ | ✓ | ✓ |
| Backup & restore | ✕ | ✓ (data sendiri) | ✓ (seluruh tim) |
| Mode offline | ✕ | ✓ | ✓ |
| Import Excel/CSV | ✕ | ✓ | ✓ |
| Template Checklist berkas per bank | X | X | ✓

> Semua user baru otomatis mendapat **trial Pro 14 hari gratis**.

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| ⚡ **Real-time Sync** | Data tersinkronisasi ke semua HP tim secara instan via WebSocket |
| 👥 **Multi-user & Role** | Login per marketing — Admin lihat semua, Marketing lihat data sendiri |
| 🔐 **Row Level Security** | Data terisolasi di level database PostgreSQL, bukan hanya UI |
| 📲 **PWA** | Install di Android/iPhone seperti aplikasi native tanpa App Store |
| 🌙 **Tema Gelap & Terang** | Toggle dari header, default light, tersimpan otomatis |
| 🔑 **Login Google** | Sign in / sign up satu klik dengan akun Google |
| 📧 **Konfirmasi Email** | Panel verifikasi + kirim ulang email konfirmasi |
| 🔒 **Reset Password** | Link reset via email dengan template branded |
| 📍 **7 Status Pipeline** | Prospek → Booking → Proses DP → Berkas → SP3K/ACC → Selesai / Batal |
| 📅 **Kalender Follow-up** | Tampilan kalender bulanan dengan highlight jadwal follow-up |
| 📁 **Checklist Berkas** | Tambah, edit, hapus item berkas. Upload foto (maks 10/item di Pro) |
| 🔍 **Filter Lanjutan** | Filter harga, sumber leads, KPR, tanggal, berkas, follow-up |
| 📆 **Filter Bulan** | Filter konsumen per bulan booking, input, atau follow-up |
| 📊 **Grafik Laporan** | Chart pipeline, tren 6 bulan, sumber leads — filter periode kustom |
| 🎯 **Target Penjualan** | Target bulanan per marketing + history + bulk set Admin |
| 📗 **Export Excel XLSX** | 3 sheet: data konsumen, ringkasan, performa per marketing |
| 📄 **Export PDF & CSV** | Laporan siap cetak dan data mentah |
| 📥 **Import Excel/CSV** | Upload data konsumen, auto-deteksi nama kolom |
| 📵 **Mode Offline** | IndexedDB cache + sync queue otomatis saat online kembali |
| 💾 **Backup & Restore** | JSON backup + restore Merge/Replace + validasi checksum |
| ⚡ **Optimistic Locking** | Deteksi konflik edit bersamaan + modal diff |
| 🔔 **Notifikasi Push** | Reminder follow-up, berkas kurang, jadwal hari ini |
| 🏆 **Ranking Tim** | Performa dan ranking marketing untuk Admin |
| 📞 **Aksi Cepat** | Telepon dan WhatsApp langsung dari detail konsumen |
| 📌 **Log Aktivitas** | Setiap perubahan tercatat otomatis dengan timestamp |
| 💻 **Layout Desktop** | Sidebar navigasi, konten terpusat, support layar lebar |
| 💳 **Checkout Pembayaran** | Modal upgrade + instruksi transfer + salin nomor rekening & Order ID |
| 🔧 **Panel Aktivasi Admin** | Aktivasi plan user setelah pembayaran dikonfirmasi |

---

## 📋 Pipeline Konsumen

```
📍 Prospek  →  📋 Booking  →  💰 Proses DP  →  📁 Kumpul Berkas  →  🏦 SP3K/ACC  →  ✅ Selesai
                                                                                         ❌ Batal
```

> Status **Prospek** tidak dihitung di Total Konsumen dashboard — masuk hitungan setelah berubah ke Booking.

---

## 🛠 Teknologi

```
Frontend      : HTML5 + CSS3 + Vanilla JavaScript (multi-file, zero framework)
Database      : Supabase (PostgreSQL)
Auth          : Supabase Auth — email/password + Google OAuth + reset password
Real-time     : Supabase Realtime (WebSocket / postgres_changes)
Storage       : Supabase Storage (upload foto dokumen berkas)
Keamanan      : Row Level Security — data terisolasi per user di level DB
Charts        : Chart.js (CDN)
PDF Export    : jsPDF (loaded on demand)
Excel Export  : SheetJS / XLSX (loaded on demand)
Excel Import  : SheetJS / XLSX (loaded on demand)
Offline       : IndexedDB + Service Worker + Background Sync API
PWA           : Service Worker + Web App Manifest
Hosting       : Vercel / Netlify (gratis)
```

---

## 📁 Struktur File

```
PropMap/
├── index.html              # Aplikasi utama
├── demo.html               # Halaman demo & landing page
├── manifest.json           # Konfigurasi PWA
├── sw.js                   # Service Worker (offline + push)
├── setup.sql               # SQL setup lengkap untuk Supabase
├── vercel.json             # Konfigurasi deploy Vercel
├── _redirects              # Konfigurasi redirect Netlify
├── css/
│   └── main.css            # Design tokens, komponen, dark/light mode
├── js/
│   ├── config.js           # Supabase config, state global, PLANS, PRO_FEATURES
│   ├── plan.js             # Sistem monetisasi: plan gate, upgrade modal, checkout, aktivasi
│   ├── helpers.js          # Utility: format rupiah, tanggal, tema, PWA
│   ├── auth.js             # Login, Google OAuth, register, reset, konfirmasi email
│   ├── data.js             # CRUD Supabase, realtime, import/export, optimistic lock
│   ├── ui.js               # Dashboard, konsumen, filter lanjutan, filter bulan
│   ├── laporan.js          # Chart.js, KPI, target, export PDF/Excel/CSV
│   ├── kalender.js         # Kalender follow-up bulanan
│   ├── dokumen.js          # Upload foto, lightbox viewer, checklist berkas
│   ├── target.js           # Target penjualan bulanan per marketing
│   ├── backup.js           # Backup & restore data JSON
│   ├── offline.js          # IndexedDB cache, sync queue, background sync
│   └── push.js             # Web Push Notification
├── assets/
│   ├── email-confirm.html  # Template email konfirmasi akun
│   ├── email-reset.html    # Template email reset password
│   └── SETUP_GOOGLE_EMAIL.md  # Panduan Google OAuth & Gmail SMTP
└── screenshots/            # 6 screenshot SVG untuk README
```

---

## 🚀 Cara Setup

### Prasyarat
- Akun [Supabase](https://supabase.com) — gratis
- Akun [Vercel](https://vercel.com) atau [Netlify](https://netlify.com) — gratis

### Langkah 1 — Setup database di Supabase

Buka **Supabase → SQL Editor** → paste seluruh isi [`setup.sql`](./setup.sql) → klik **Run**.

Script membuat: tabel `profiles`, `konsumen`, `target_bulanan`, `subscriptions`, `push_subscriptions`, storage bucket `dokumen`, RLS policies lengkap, dan auto-timestamp trigger.

### Langkah 2 — Konfigurasi `js/config.js`

```javascript
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

Ambil dari **Supabase → Project Settings → API**.

### Langkah 3 — Deploy ke Hosting

**Netlify:** Drag & drop folder ke [app.netlify.com/drop](https://app.netlify.com/drop)

**Vercel:** `npx vercel deploy` atau drag & drop di [vercel.com/new](https://vercel.com/new)

### Langkah 4 — Buat Akun Admin Pertama

1. Buka aplikasi → daftar akun baru
2. Buka **Supabase → Table Editor → `profiles`**
3. Ubah kolom `role` dari `marketing` → `admin`

Atau via SQL:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email_anda@contoh.com';
```

### Langkah 5 — Update Detail Pembayaran

Edit `index.html` bagian modal checkout (cari `checkout-payment-info`):

```html
<div class="cpi-bank">🏦 BCA · 1234567890</div>       ← ganti nomor rekening
<div class="cpi-name">a.n. PropMap Indonesia</div>     ← ganti nama pemilik
<a href="https://wa.me/6281234567890">                 ← ganti nomor WhatsApp
```

### Langkah 6 (Opsional) — Login Google & Custom Email

Ikuti panduan di [`assets/SETUP_GOOGLE_EMAIL.md`](./assets/SETUP_GOOGLE_EMAIL.md)

---

## 📖 Panduan Penggunaan

### Untuk Marketing

| Aksi | Cara |
|------|------|
| Tambah konsumen | Tab Konsumen → tombol **＋** kanan bawah |
| Import dari Excel | Konsumen → tombol **📥 Import** |
| Edit konsumen | Detail konsumen → **✏️ Edit** |
| Upload foto berkas | Detail → Checklist Berkas → tombol **📎** (Pro) |
| Jadwal follow-up | Tambah/Edit → isi **Jadwal Follow-up** |
| Filter lanjutan | Konsumen → tombol **⚙ Filter** (Pro) |
| Filter per bulan | Konsumen → tombol **📆 Bulan** (Pro) |
| Backup data sendiri | Pengaturan → **Data Saya → 💾 Backup** (Pro) |
| Upgrade plan | Pengaturan → **Paket Langganan → Upgrade** |

### Untuk Admin

| Aksi | Cara |
|------|------|
| Lihat semua data | Tab Konsumen — otomatis tampil semua tim |
| Set target marketing | Laporan → Target Penjualan → **⚙ Atur Semua** |
| Export laporan | Laporan → **📗 Excel / 📄 PDF / 📊 CSV** |
| Aktivasi plan user | Pengaturan → Panel Admin → **💳 Aktivasi Plan** |
| Backup seluruh tim | Pengaturan → Panel Admin → **💾 Backup & Restore** |
| Kelola pengguna | Pengaturan → **👥 Kelola Pengguna** |

### Alur Aktivasi Plan

```
User klik Upgrade → Isi form checkout → Transfer bank
  → Konfirmasi WhatsApp ke Admin → Admin buka Aktivasi Plan
  → Klik ✓ Aktifkan → Plan aktif otomatis
```

### Install di HP

**Android (Chrome):** Menu ⋮ → *Tambahkan ke layar utama*

**iPhone (Safari):** Tombol Berbagi ↑ → *Tambahkan ke Layar Utama*

---

## ❓ FAQ

**Q: Data marketing bisa dilihat marketing lain?**
A: Tidak. RLS di PostgreSQL memastikan isolasi data di level database.

**Q: Perbedaan Prospek dan Booking?**
A: Prospek belum dihitung di Total Konsumen dashboard. Booking sudah ada komitmen dan mulai dihitung.

**Q: Bisa dipakai offline?**
A: Ya. Data ter-cache di IndexedDB, tambah/edit saat offline masuk antrian sync otomatis.

**Q: Supabase project pause / tidak bisa login?**
A: Free tier auto-pause setelah 7 hari tidak aktif. Buka [supabase.com/dashboard](https://supabase.com/dashboard) → pilih project → klik **Restore project**.

**Q: Bagaimana cara aktivasi plan setelah user bayar?**
A: Admin buka **Pengaturan → Panel Admin → 💳 Aktivasi Plan** → order pending muncul otomatis → klik ✓ Aktifkan. Atau gunakan form Aktivasi Manual untuk kasus di luar order normal.

**Q: Foto berkas disimpan di mana?**
A: Di Supabase Storage bucket `dokumen`. Bisa dilihat di Supabase Dashboard → Storage.

---

## 🗺 Roadmap

- [x] Real-time sync WebSocket
- [x] PWA installable
- [x] Dark / light mode (default light)
- [x] Login Google OAuth
- [x] Konfirmasi email + reset password
- [x] Template email branded
- [x] 7 status pipeline
- [x] Filter lanjutan + filter bulan
- [x] Kalender follow-up
- [x] Upload foto berkas ke cloud
- [x] Export Excel XLSX 3-sheet
- [x] Export PDF & CSV
- [x] Import Excel/CSV
- [x] Mode offline (IndexedDB + background sync)
- [x] Backup & restore JSON (Admin + Marketing Pro)
- [x] Optimistic locking
- [x] Web Push Notification
- [x] Target penjualan bulanan
- [x] Ranking tim
- [x] Sistem monetisasi 3 tier (Gratis / Pro / Business)
- [x] Trial Pro 14 hari otomatis
- [x] Modal upgrade + checkout pembayaran
- [x] Salin nomor rekening & Order ID
- [x] Panel aktivasi plan Admin
- [x] Template checklist berkas KPR per bank (Business)
- [ ] Integrasi payment gateway (Midtrans / Xendit)
- [ ] Integrasi WhatsApp Business API
- [ ] Template berkas KPR per bank
- [ ] Notifikasi real-time di desktop

---

## 📄 Lisensi

[MIT License](LICENSE) — bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">
  <strong>PropMap v4.2</strong><br/>
  Dibuat dengan ❤️ untuk tim marketing properti Indonesia<br/><br/>
  <a href="demo.html">Demo</a> ·
  <a href="https://supabase.com">Supabase</a> ·
  <a href="https://vercel.com">Vercel</a>
</div>
