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
