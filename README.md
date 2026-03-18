# 🎯 MarketPro — CRM Tim Marketing Properti

<div align="center">

![version](https://img.shields.io/badge/versi-3.0-6366f1?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge)
![License](https://img.shields.io/badge/Lisensi-MIT-10b981?style=for-the-badge)

**Aplikasi web real-time untuk monitoring dan pengelolaan data konsumen properti.**
Dapat diinstall di HP (PWA), mendukung multi-user, dan sinkronisasi data secara langsung ke seluruh tim.

[🚀 **Buka Demo**](https://yokivalianda.github.io/Marketing_PRO/demo.html) · [📱 **Buka Aplikasi**](https://marketing-pro-id.vercel.app/) · [⭐ **Beri Bintang**](#)

</div>

---

## 📸 Screenshot

<div align="center">
<table>
  <tr>
    <td align="center">
      <img src="screenshots/screen-01-dashboard-dark.svg" width="200" alt="Dashboard Gelap"/>
      <br/><sub><b>Dashboard · Tema Gelap</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-02-konsumen-dark.svg" width="200" alt="Konsumen Gelap"/>
      <br/><sub><b>Daftar Konsumen</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-03-konsumen-light.svg" width="200" alt="Konsumen Terang"/>
      <br/><sub><b>Tema Terang ☀️</b></sub>
    </td>
    <td align="center">
      <img src="screenshots/screen-04-detail-dark.svg" width="200" alt="Detail Konsumen"/>
      <br/><sub><b>Detail & Checklist</b></sub>
    </td>
  </tr>
</table>
</div>

---

## ✨ Fitur Utama

| Fitur | Keterangan |
|-------|-----------|
| ⚡ **Real-time Sync** | Data tersinkronisasi ke semua HP tim secara instan via WebSocket |
| 👥 **Multi-user** | Login per marketing, data terisolasi dengan Row Level Security |
| 🔐 **Admin & Marketing** | Dua level akses — Admin lihat semua, Marketing lihat data sendiri |
| 📲 **PWA** | Install di Android/iPhone seperti aplikasi native tanpa App Store |
| 🌙 **Tema Gelap & Terang** | Toggle dari header, tersimpan otomatis, mengikuti preferensi sistem |
| 📁 **Checklist Berkas KPR** | 6 item berkas per konsumen dengan progress indicator |
| 🔔 **Pengingat Otomatis** | Alert follow-up, berkas kurang, DP belum selesai |
| 📊 **Ranking Tim** | Laporan performa dan ranking marketing untuk Admin |
| 📞 **Aksi Cepat** | Telepon dan WhatsApp langsung dari detail konsumen |
| 📌 **Log Aktivitas** | Setiap perubahan tercatat otomatis dengan timestamp |

---

## 📋 Pipeline Konsumen

```
📋 Booking  →  💰 Proses DP  →  📁 Kumpul Berkas  →  ✅ Selesai
                                                        ❌ Batal
```

---

## 🛠 Teknologi

```
Frontend      : HTML5 + CSS3 + Vanilla JavaScript (zero dependencies)
Database      : Supabase (PostgreSQL)
Auth          : Supabase Auth (email/password)
Real-time     : Supabase Realtime (WebSocket / postgres_changes)
Keamanan      : Row Level Security — data terisolasi per user di level DB
PWA           : Service Worker + Web App Manifest
Hosting       : Vercel / Netlify (gratis)
Font          : Outfit + JetBrains Mono (Google Fonts)
```

---

## 🚀 Cara Setup

### Prasyarat
- Akun [Supabase](https://supabase.com) — gratis
- Akun [Vercel](https://vercel.com) atau [Netlify](https://netlify.com) — gratis

### Langkah 1 — Clone & buka folder

```bash
git clone https://github.com/YOUR_USERNAME/marketpro.git
cd marketpro
```

### Langkah 2 — Jalankan SQL di Supabase

Buka **Supabase → SQL Editor** → paste seluruh isi [`setup.sql`](./setup.sql) → klik **Run**.

Script akan membuat:
- Tabel `profiles` (data pengguna & role)
- Tabel `konsumen` (data konsumen properti)
- Row Level Security policies lengkap
- Auto-update timestamp trigger

### Langkah 3 — Aktifkan Realtime

```
Supabase Dashboard → Table Editor → konsumen → ⚡ Realtime → Enable
```

Atau via SQL:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE konsumen;
```

### Langkah 4 — Konfigurasi `index.html`

Temukan 2 baris ini dan isi dengan kredensial dari **Supabase → Project Settings → API**:

```javascript
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### Langkah 5 — Deploy ke Hosting

**Vercel** (direkomendasikan):
```bash
npx vercel deploy
```
Atau drag & drop folder ke [vercel.com/new](https://vercel.com/new)

**Netlify:**
Drag & drop folder ke [app.netlify.com/drop](https://app.netlify.com/drop)

Anda akan mendapat URL seperti: `https://marketpro-tim.vercel.app`

### Langkah 6 — Buat Akun Admin Pertama

1. Buka aplikasi → daftar akun baru
2. Buka **Supabase → Table Editor → `profiles`**
3. Cari baris email Anda → ubah kolom `role` dari `marketing` → `admin`
4. Refresh aplikasi ✅

> Setelah jadi Admin, penambahan admin berikutnya bisa dilakukan dari **Pengaturan → Panel Admin → Kelola Pengguna** — tidak perlu ke Supabase lagi.

**Atau via SQL:**
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'email_anda@contoh.com';
```

---

## 📁 Struktur File

```
marketpro/
├── index.html          # Aplikasi utama (satu file lengkap, ~2400 baris)
├── demo.html           # Halaman demo & landing page
├── manifest.json       # Konfigurasi PWA
├── sw.js               # Service Worker (offline support)
├── setup.sql           # SQL setup lengkap untuk Supabase
├── screenshots/
│   ├── screen-01-dashboard-dark.svg
│   ├── screen-02-konsumen-dark.svg
│   ├── screen-03-konsumen-light.svg
│   └── screen-04-detail-dark.svg
└── README.md
```

---

## 📖 Panduan Penggunaan

### Untuk Marketing

| Aksi | Cara |
|------|------|
| Tambah konsumen | Tab Konsumen → tombol **＋** kanan bawah |
| Edit konsumen | Detail konsumen → **✏️ Edit** |
| Centang berkas | Detail → bagian **Checklist Berkas** |
| Tambah catatan | Detail → **📝 Catat** |
| Telepon / WA | Detail → tombol **📞** / **💬** |
| Lihat pengingat | Tap **🔔** di header |
| Ganti tema | Tap **🌙/☀️** di header atau Pengaturan → Tampilan |

### Untuk Admin

| Aksi | Cara |
|------|------|
| Lihat semua data | Tab Konsumen — otomatis tampil semua tim |
| Filter per marketing | Konsumen → dropdown **Filter tim** |
| Lihat ranking | Laporan → **🏆 Ranking Tim** |
| Ubah role | Pengaturan → **Kelola Pengguna** |
| Export data | Pengaturan → **Export Data Tim** |

### Install di HP

**Android (Chrome):** Menu ⋮ → *Tambahkan ke layar utama*

**iPhone (Safari):** Tombol Berbagi ↑ → *Tambahkan ke Layar Utama*

---

## ❓ FAQ

**Q: Apakah data seorang marketing bisa dilihat marketing lain?**
A: Tidak. Row Level Security di PostgreSQL memastikan setiap marketing hanya bisa mengakses data konsumennya sendiri di level database — bukan hanya di level UI.

**Q: Berapa banyak pengguna yang didukung?**
A: Supabase free tier mendukung hingga 50.000 baris dan 500MB storage. Untuk 6–20 orang dengan ratusan konsumen, ini lebih dari cukup. Upgrade ke Pro ($25/bulan) jika sudah besar.

**Q: Bisa dipakai offline?**
A: Tampilan aplikasi tetap muncul (Service Worker cache), namun data butuh koneksi internet karena database ada di Supabase cloud.

**Q: Jika dua marketing edit data yang sama bersamaan?**
A: Data terakhir yang tersimpan yang menang (last-write-wins). Perubahan tersinkronisasi real-time ke semua perangkat.

**Q: Bisa dipakai di laptop/browser desktop?**
A: Ya, tampilan responsif dan berfungsi penuh di browser desktop.

---

## 🗺 Roadmap

- [ ] Reset password mandiri dari dalam aplikasi
- [ ] Web Push Notification ke HP
- [ ] Export laporan ke PDF / Excel
- [ ] Upload foto dokumen / berkas konsumen
- [ ] Kalender jadwal follow-up
- [ ] Filter laporan berdasarkan rentang tanggal
- [ ] Multi-proyek (satu marketing handle beberapa proyek)
- [ ] Integrasi WhatsApp Business API

---

## 🤝 Kontribusi

Kontribusi sangat disambut!

```bash
# Fork repository, lalu:
git checkout -b fitur/nama-fitur
git commit -m 'feat: tambah fitur nama-fitur'
git push origin fitur/nama-fitur
# Buat Pull Request
```

---

## 📄 Lisensi

[MIT License](LICENSE) — bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">
  <strong>MarketPro v3.0</strong><br/>
  Dibuat dengan ❤️ untuk tim marketing properti Indonesia<br/><br/>
  <a href="https://YOUR_USERNAME.github.io/marketpro/demo.html">Demo</a> ·
  <a href="https://supabase.com">Supabase</a> ·
  <a href="https://vercel.com">Vercel</a>
</div>
