// ═══════════════════════════════════════════════
// ONBOARDING — PropMap
// Tampil otomatis hanya untuk user baru (isNewUser flag)
// ═══════════════════════════════════════════════

const ONBOARDING_STEPS = [
  {
    icon: '🏠',
    color: '#6366f1',
    title: 'Selamat datang di PropMap!',
    desc: 'Aplikasi manajemen prospek properti untuk agen & tim marketing. Dalam beberapa langkah, kamu akan paham cara kerjanya.',
    sub: null,
  },
  {
    icon: '👥',
    color: '#10b981',
    title: 'Kelola Konsumen',
    desc: 'Semua data prospek tersimpan di menu <strong>Konsumen</strong>. Tambah konsumen baru, catat status, sumber, hingga progres follow-up.',
    sub: 'Tap kartu konsumen untuk lihat detail, edit, atau tambah catatan kapan saja.',
  },
  {
    icon: '📅',
    color: '#f59e0b',
    title: 'Kalender Follow-Up',
    desc: 'Menu <strong>Kalender</strong> menampilkan jadwal follow-up semua konsumen. Jangan sampai ada yang terlewat.',
    sub: 'Notifikasi push akan mengingatkanmu otomatis jika diaktifkan.',
  },
  {
    icon: '📊',
    color: '#a855f7',
    title: 'Laporan & Target',
    desc: 'Menu <strong>Laporan</strong> merangkum performa penjualan — total konsumen, status deal, dan progres target bulanan.',
    sub: 'Export ke Excel, CSV, atau PDF tersedia di plan Pro.',
  },
  {
    icon: '🎯',
    color: '#0ea5e9',
    title: 'Trial 14 Hari Gratis',
    desc: 'Kamu sedang menikmati akses penuh selama <strong>14 hari</strong>. Semua fitur Pro bisa dicoba tanpa batas.',
    sub: 'Setelah trial berakhir, upgrade ke Pro untuk lanjut menikmati semua fitur.',
  },
  {
    icon: '💬',
    color: '#6366f1',
    title: 'Ada pertanyaan?',
    desc: 'Hubungi kami kapan saja. Kami siap bantu setup, onboarding tim, atau pertanyaan seputar PropMap.',
    sub: null,
    isContact: true,
  },
];

let _obStep = 0;

function showOnboarding() {
  _obStep = 0;
  _renderObStep();
  document.getElementById('modalOnboarding').classList.add('open');
}

function closeOnboarding() {
  document.getElementById('modalOnboarding').classList.remove('open');
}

function obNext() {
  if (_obStep < ONBOARDING_STEPS.length - 1) {
    _obStep++;
    _renderObStep();
  } else {
    closeOnboarding();
  }
}

function obPrev() {
  if (_obStep > 0) {
    _obStep--;
    _renderObStep();
  }
}

function obGoTo(i) {
  _obStep = i;
  _renderObStep();
}

function _renderObStep() {
  const step  = ONBOARDING_STEPS[_obStep];
  const total = ONBOARDING_STEPS.length;
  const isLast = _obStep === total - 1;

  // Icon & color
  const iconEl = document.getElementById('obIcon');
  iconEl.textContent = step.icon;
  iconEl.style.background = step.color + '22';
  iconEl.style.boxShadow  = `0 0 40px ${step.color}40`;

  // Text
  document.getElementById('obTitle').textContent = step.title;
  document.getElementById('obDesc').innerHTML    = step.desc;

  const subEl = document.getElementById('obSub');
  if (step.sub) {
    subEl.innerHTML = step.sub;
    subEl.style.display = 'block';
  } else {
    subEl.style.display = 'none';
  }

  // Contact block
  const contactEl = document.getElementById('obContact');
  contactEl.style.display = step.isContact ? 'flex' : 'none';

  // Dots
  const dotsEl = document.getElementById('obDots');
  dotsEl.innerHTML = ONBOARDING_STEPS.map((_, i) =>
    `<button class="ob-dot ${i === _obStep ? 'active' : ''}"
      onclick="obGoTo(${i})"
      style="${i === _obStep ? `background:${step.color};box-shadow:0 0 8px ${step.color}80` : ''}">
    </button>`
  ).join('');

  // Buttons
  const prevBtn = document.getElementById('obBtnPrev');
  const nextBtn = document.getElementById('obBtnNext');

  prevBtn.style.display = _obStep > 0 ? 'flex' : 'none';

  nextBtn.textContent = isLast ? 'Mulai Sekarang →' : 'Lanjut →';
  nextBtn.style.background = step.color;
  nextBtn.style.boxShadow  = `0 4px 20px ${step.color}60`;

  // Animate card
  const card = document.getElementById('obCard');
  card.classList.remove('ob-animate');
  void card.offsetWidth;
  card.classList.add('ob-animate');
}

// Dipanggil dari afterLogin — hanya untuk user baru
function maybeShowOnboarding(isNewUser) {
  if (!isNewUser) return;
  // Delay sedikit agar shell sudah render
  setTimeout(showOnboarding, 800);
}
