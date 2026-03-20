# Panduan Setup Google Login & Custom Email — PropMap

---

## BAGIAN 1 — Login dengan Google

### Langkah 1 · Buat Google OAuth Client

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru atau pilih project yang ada → klik **"Select a project"** → **"New Project"**
   - Nama: `PropMap` → klik **Create**
3. Setelah project aktif, buka menu **APIs & Services → OAuth consent screen**
4. Pilih **External** → klik **Create**
5. Isi form:
   - **App name**: `PropMap`
   - **User support email**: email Anda
   - **Developer contact information**: email Anda
   - Klik **Save and Continue** di semua step (tidak perlu isi scope atau test users)
   - Klik **Back to Dashboard**
6. Buka **APIs & Services → Credentials**
7. Klik **+ Create Credentials → OAuth client ID**
8. Pilih **Application type**: `Web application`
9. Nama: `PropMap Web`
10. Di bagian **Authorized redirect URIs**, klik **+ Add URI** dan isi:
    ```
    https://[PROJECT_ID].supabase.co/auth/v1/callback
    ```
    Ganti `[PROJECT_ID]` dengan Project ID Supabase Anda
    (cek di Supabase Dashboard → Project Settings → General → Reference ID)
11. Klik **Create**
12. **Simpan** `Client ID` dan `Client Secret` yang muncul

---

### Langkah 2 · Aktifkan Google Provider di Supabase

1. Buka [supabase.com](https://supabase.com) → pilih project Anda
2. Buka **Authentication → Providers**
3. Cari **Google** → klik toggle untuk mengaktifkan
4. Isi:
   - **Client ID** → paste dari Google Console (langkah 12)
   - **Client Secret** → paste dari Google Console
5. Klik **Save**

---

### Langkah 3 · Tambahkan Redirect URL

1. Di Supabase → **Authentication → URL Configuration**
2. Di bagian **Redirect URLs**, tambahkan URL aplikasi Anda:
   ```
   https://propmadev.netlify.app/
   https://propmadev.netlify.app/index.html
   http://localhost:3000/          ← untuk development lokal
   ```
3. Klik **Save**

---

### Langkah 4 · Test Login Google

1. Deploy aplikasi PropMap ke Netlify/Vercel
2. Buka halaman login → klik **"Masuk dengan Google"**
3. Browser redirect ke Google login
4. Setelah login berhasil, otomatis balik ke PropMap dan masuk

> **Catatan:** User yang login via Google akan otomatis dibuatkan profil dengan role `marketing`.
> Admin perlu mengubah role secara manual dari Pengaturan → Kelola Pengguna.

---

## BAGIAN 2 — Custom Email via Gmail (SMTP)

Supabase menggunakan layanan email bawaan yang terbatas (2 email/jam).
Untuk produksi, sambungkan ke Gmail SMTP agar:
- Terkirim dari alamat email brand Anda (misal: `noreply@propmap.id`)
- Tidak masuk spam
- Tidak ada batasan pengiriman

---

### Langkah 1 · Aktifkan 2FA di Akun Google

1. Buka [myaccount.google.com/security](https://myaccount.google.com/security)
2. Di bagian **"How you sign in to Google"**, aktifkan **2-Step Verification**
3. Selesaikan setup 2FA

---

### Langkah 2 · Buat App Password Gmail

1. Buka [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   (Hanya muncul setelah 2FA aktif)
2. Pada kolom **"App name"**, ketik: `PropMap Supabase`
3. Klik **Create**
4. **Simpan** 16-karakter App Password yang muncul (contoh: `abcd efgh ijkl mnop`)
   → hapus spasi menjadi: `abcdefghijklmnop`

---

### Langkah 3 · Konfigurasi SMTP di Supabase

1. Buka Supabase → **Project Settings → Auth**
2. Scroll ke bagian **SMTP Settings** → aktifkan **Enable Custom SMTP**
3. Isi konfigurasi:

   | Field | Nilai |
   |-------|-------|
   | **Sender name** | `PropMap` |
   | **Sender email** | `email_gmail_anda@gmail.com` |
   | **Host** | `smtp.gmail.com` |
   | **Port number** | `465` |
   | **Username** | `email_gmail_anda@gmail.com` |
   | **Password** | App Password 16 karakter (tanpa spasi) |

4. Klik **Save**
5. Klik **Send test email** → cek inbox Anda

---

### Langkah 4 · Pasang Template Email Konfirmasi

1. Di Supabase → **Authentication → Email Templates**
2. Pilih tab **Confirm signup**
3. Hapus semua isi yang ada
4. Buka file `assets/email-confirm.html` di folder PropMap
5. Salin **seluruh isi** file tersebut → paste ke kolom template
6. Klik **Save**

---

### Langkah 5 · Pasang Template Email Reset Password

1. Di halaman yang sama → pilih tab **Reset Password**
2. Hapus semua isi yang ada
3. Buka file `assets/email-reset.html` di folder PropMap
4. Salin **seluruh isi** file tersebut → paste ke kolom template
5. Klik **Save**

---

### Langkah 6 · Setting URL Email

1. Supabase → **Authentication → URL Configuration**
2. Pastikan **Site URL** sudah diisi dengan URL aplikasi Anda:
   ```
   https://propmadev.netlify.app
   ```
3. Klik **Save**

---

## BAGIAN 3 — Verifikasi Semua Berjalan

Checklist setelah setup selesai:

- [ ] Tombol "Masuk dengan Google" muncul di halaman login PropMap
- [ ] Klik Google button → redirect ke Google login → berhasil masuk PropMap
- [ ] Daftar akun baru → dapat email konfirmasi dari Gmail Anda (bukan noreply@mail.supabase.io)
- [ ] Template email terlihat branded dengan logo PropMap
- [ ] Klik "Lupa password?" → isi email → dapat email reset dari Gmail Anda
- [ ] Klik link di email reset → muncul form password baru di PropMap
- [ ] Password baru berhasil disimpan → bisa login dengan password baru

---

## Troubleshooting

**Google login error "redirect_uri_mismatch"**
→ Pastikan Authorized redirect URI di Google Console persis sama dengan:
`https://[PROJECT_ID].supabase.co/auth/v1/callback`

**Email tidak terkirim / masuk spam**
→ Pastikan App Password tidak ada spasi. Coba kirim test email dari Supabase SMTP settings.

**"Invalid login credentials" setelah login Google**
→ Normal jika akun belum pernah ada. Supabase akan otomatis buat akun baru.

**App Password tidak muncul di Google Account**
→ Pastikan 2FA sudah aktif. Coba akses langsung: myaccount.google.com/apppasswords

**Template email tidak muncul branded**
→ Pastikan seluruh HTML (dari `<!DOCTYPE html>` sampai `</html>`) sudah ter-paste dengan benar.

---

*PropMap v4.2 · Setup Guide · 2026*
