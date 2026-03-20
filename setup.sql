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
-- SETUP SUPABASE STORAGE — Upload Foto Dokumen
-- CARA MENJALANKAN:
--   Supabase Dashboard → SQL Editor → paste → Run
-- JIKA SUDAH PERNAH SETUP, JALANKAN ULANG — aman
-- ════════════════════════════════════════════════

-- ── LANGKAH 1: Buat / update bucket ──────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dokumen',
  'dokumen',
  true,        -- public: URL foto bisa langsung dibuka
  10485760,    -- 10 MB maks per file
  ARRAY['image/jpeg','image/jpg','image/png','image/gif',
        'image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types= EXCLUDED.allowed_mime_types;

-- ── LANGKAH 2: Hapus SEMUA policy lama di bucket dokumen ──
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
  END LOOP;
END $$;

-- ── LANGKAH 3: Buat policy baru yang sederhana ────
-- PRINSIP: siapa saja yang sudah login (authenticated) boleh
-- melakukan semua operasi pada bucket "dokumen".
-- Keamanan data dijaga di level aplikasi (RLS tabel konsumen).

CREATE POLICY "dokumen_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dokumen');

CREATE POLICY "dokumen_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dokumen');

CREATE POLICY "dokumen_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dokumen');

CREATE POLICY "dokumen_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dokumen');

-- ── SELESAI ───────────────────────────────────────
-- Cek hasilnya:
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'dokumen%';

-- ════════════════════════════════════════════════
-- WEB PUSH NOTIFICATION — Tabel Subscriptions
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- User hanya bisa lihat & kelola subscription miliknya sendiri
CREATE POLICY "User kelola subscription sendiri"
  ON push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin bisa baca semua subscription (untuk kirim push ke semua user)
CREATE POLICY "Admin baca semua subscription"
  ON push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ════════════════════════════════════════════════
-- TARGET PENJUALAN BULANAN — v4.2
-- Jalankan di Supabase SQL Editor
-- ════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS target_bulanan (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users ON DELETE CASCADE,
  tahun       int  NOT NULL,
  bulan       int  NOT NULL,   -- 1-12
  target      int  NOT NULL DEFAULT 5,
  catatan     text DEFAULT '',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, tahun, bulan)
);

ALTER TABLE target_bulanan ENABLE ROW LEVEL SECURITY;

-- Marketing bisa lihat & ubah target milik sendiri
CREATE POLICY "User kelola target sendiri"
  ON target_bulanan FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin bisa lihat & ubah semua target
CREATE POLICY "Admin kelola semua target"
  ON target_bulanan FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ════════════════════════════════════════════════════════
-- MONETISASI — PropMap Plan System
-- Jalankan di Supabase SQL Editor
-- ════════════════════════════════════════════════════════

-- 1. Tambah kolom plan ke tabel profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan          text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_expires  timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends    timestamptz;

-- Set semua user yang sudah ada ke trial 14 hari
UPDATE profiles
  SET plan = 'trial',
      trial_ends = now() + interval '14 days'
  WHERE plan = 'free';

-- 2. Tabel subscriptions — catat history pembayaran
CREATE TABLE IF NOT EXISTS subscriptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES auth.users ON DELETE CASCADE,
  plan         text NOT NULL,               -- 'pro' | 'business'
  status       text NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'cancelled'
  amount       int  NOT NULL,               -- dalam Rupiah
  payment_ref  text,                        -- referensi dari Midtrans/Xendit
  started_at   timestamptz DEFAULT now(),
  expires_at   timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin lihat subscription workspace"
  ON subscriptions FOR SELECT
  USING (
    workspace_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Function: cek plan aktif user
CREATE OR REPLACE FUNCTION get_active_plan(uid uuid)
RETURNS text AS $$
DECLARE
  p text;
  te timestamptz;
  pe timestamptz;
BEGIN
  SELECT plan, trial_ends, plan_expires
    INTO p, te, pe
    FROM profiles WHERE id = uid;

  -- Trial masih aktif
  IF p = 'trial' AND te IS NOT NULL AND te > now() THEN
    RETURN 'trial';
  END IF;

  -- Pro/Business masih aktif
  IF p IN ('pro', 'business') AND (pe IS NULL OR pe > now()) THEN
    RETURN p;
  END IF;

  -- Default: free
  RETURN 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function: cek limit konsumen per workspace
CREATE OR REPLACE FUNCTION check_konsumen_limit(uid uuid)
RETURNS boolean AS $$
DECLARE
  current_plan text;
  cnt int;
BEGIN
  current_plan := get_active_plan(uid);
  IF current_plan != 'free' THEN RETURN true; END IF;

  SELECT COUNT(*) INTO cnt FROM konsumen WHERE owner_id = uid;
  RETURN cnt < 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE subscriptions IS 'History langganan PropMap per workspace';
