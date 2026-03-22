// ═══════════════════════════════════════════════
// ⚙️  KONFIGURASI — GANTI DI SINI
// ═══════════════════════════════════════════════
const SUPABASE_URL      = 'https://mmpubrcuasdebzzanlfs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcHVicmN1YXNkZWJ6emFubGZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MDAzNTMsImV4cCI6MjA4OTM3NjM1M30.C5e-B0kak1C997FeJmClobvNSp4PyVfmbxWYZHg2p_Q';
// ═══════════════════════════════════════════════

// Global state
let sb, me, myProf;
let allKons  = [];
let allProfs = [];
let rtChan   = null;

// UI state
let curPage      = 'dashboard';
let curFilter    = 'semua';
let curPeriod    = 'bulan';   // laporan period filter
let calYear      = new Date().getFullYear();
let calMonth     = new Date().getMonth();
let calSelected  = null;

// Chart instances (Chart.js)
let chartPipeline = null;
let chartTren     = null;
let chartSumber   = null;

let curSort = '';   // '' = default (terbaru), 'az' = A→Z, 'za' = Z→A
let allTarget = [];   // cache target_bulanan

// ── PLAN CONFIG ───────────────────────────────────
const PLANS = {
  free:     { name: 'Gratis',   maxUsers: 3,   maxKons: 20,  maxFoto: 0,    storage: 0,    color: '#888780' },
  trial:    { name: 'Pro Trial',maxUsers: 10,  maxKons: 9999,maxFoto: 10,   storage: 5120, color: '#6366f1' },
  pro:      { name: 'Pro',      maxUsers: 10,  maxKons: 9999,maxFoto: 10,   storage: 5120, color: '#6366f1' },
  business: { name: 'Business', maxUsers: 9999,maxKons: 9999,maxFoto: 9999, storage: 20480,color: '#10b981' },
};

// Fitur yang hanya tersedia di Pro ke atas
const PRO_FEATURES = [
  'export','upload_foto','filter_lanjutan','filter_bulan',
  'target','notifikasi_push','backup','offline','import',
  'kpr_template'
];

let myPlan = 'free';       // plan aktif user/workspace
let planExpires = null;    // kapan plan berakhir
let trialEnds = null;      // kapan trial berakhir
