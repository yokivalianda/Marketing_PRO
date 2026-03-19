-- ═══════════════════════════════════════════════════════════
-- MarketPro v2 — SQL Setup Script untuk Supabase
-- Jalankan seluruh skrip ini di: Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════

-- ── 1. TABEL PROFILES (Data pengguna / marketing) ──────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid REFERENCES auth.users ON DELETE CASCADE,
  email       text,
  full_name   text,
  role        text NOT NULL DEFAULT 'marketing',  -- 'marketing' atau 'admin'
  target      int  NOT NULL DEFAULT 5,            -- target penjualan bulanan
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Semua user bisa baca profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "User bisa update profile sendiri"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "User bisa insert profile sendiri"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);


-- ── 2. TABEL KONSUMEN (Data konsumen properti) ─────────────
CREATE TABLE IF NOT EXISTS konsumen (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  owner_name  text,
  nama        text NOT NULL,
  hp          text NOT NULL,
  unit        text,
  kavling     text,
  harga       bigint  DEFAULT 0,
  dp          bigint  DEFAULT 0,
  status      text    DEFAULT 'booking',  -- booking|dp|berkas|selesai|batal
  tgl_booking date,
  kpr         text,
  sumber      text,
  catatan     text,
  berkas      jsonb   DEFAULT '{"ktp":false,"kk":false,"slip":false,"tabungan":false,"npwp":false,"surat":false}',
  log         jsonb   DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Row Level Security
ALTER TABLE konsumen ENABLE ROW LEVEL SECURITY;

-- Marketing hanya lihat data sendiri; Admin lihat semua
CREATE POLICY "Marketing lihat konsumen sendiri, Admin lihat semua"
  ON konsumen FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Marketing insert konsumen sendiri"
  ON konsumen FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Marketing update konsumen sendiri, Admin update semua"
  ON konsumen FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Marketing delete konsumen sendiri, Admin delete semua"
  ON konsumen FOR DELETE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER konsumen_updated_at
  BEFORE UPDATE ON konsumen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. AKTIFKAN REALTIME ────────────────────────────────────
-- Supabase Dashboard → Table Editor → konsumen → ⚡ Realtime → Enable
-- ATAU jalankan:
ALTER PUBLICATION supabase_realtime ADD TABLE konsumen;


-- ═══════════════════════════════════════════════════════════
-- SETELAH SETUP:
-- 1. Daftar akun pertama via aplikasi
-- 2. Buka Supabase → Table Editor → profiles
-- 3. Edit baris Anda → ubah kolom 'role' menjadi 'admin'
-- 4. Refresh aplikasi → Anda sekarang menjadi Admin
-- ═══════════════════════════════════════════════════════════

-- ════════════════════════════════════
-- MIGRATION: Add tgl_followup column
-- (run this if upgrading from v3)
-- ════════════════════════════════════
ALTER TABLE konsumen ADD COLUMN IF NOT EXISTS tgl_followup DATE;

-- ════════════════════════════════════════════════
-- SETUP SUPABASE STORAGE untuk Upload Foto Dokumen
-- Jalankan di: Supabase → SQL Editor
-- ════════════════════════════════════════════════

-- 1. Buat bucket "dokumen" (public agar bisa ditampilkan langsung)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dokumen', 'dokumen', true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif','application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- 2. Policy: user login bisa upload ke folder miliknya
CREATE POLICY "User upload foto konsumen sendiri"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dokumen'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Policy: semua user login bisa baca (untuk preview foto)
CREATE POLICY "User bisa baca semua foto dokumen"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dokumen' AND auth.role() = 'authenticated');

-- 4. Policy: user bisa hapus foto di folder konsumen yang dia punya
--    (cek owner_id konsumen)
CREATE POLICY "User hapus foto konsumen sendiri"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dokumen'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );

-- Catatan: (storage.foldername(name))[1] = konsumen_id (bagian pertama path)
-- Path format: {konsumen_id}/{berkas_key}/{filename}
