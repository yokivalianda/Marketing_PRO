// ── AUTH PANEL NAVIGATION ────────────────────────
function showAuth() { document.getElementById('auth').classList.add('show'); }
function hideAuth() { document.getElementById('auth').classList.remove('show'); }

function switchAuthTab(t) {
  document.getElementById('tabMasuk').classList.toggle('on', t === 'masuk');
  document.getElementById('tabDaftar').classList.toggle('on', t === 'daftar');
  document.getElementById('formMasuk').style.display  = t === 'masuk'  ? 'block' : 'none';
  document.getElementById('formDaftar').style.display = t === 'daftar' ? 'block' : 'none';
  hideAuthErr();
}
function showAuthErr(m) { const e = document.getElementById('authErr'); e.textContent = m; e.classList.add('show'); }
function hideAuthErr()  { document.getElementById('authErr').classList.remove('show'); }

function showMainPanel() {
  document.getElementById('authPanelMain').style.display   = 'block';
  document.getElementById('authPanelForgot').style.display = 'none';
  document.getElementById('authPanelNewPass').style.display = 'none';
  document.getElementById('authPanelVerify').style.display = 'none';
  document.getElementById('authErr').classList.remove('show');
  document.getElementById('forgotErr').classList.remove('show');
  document.getElementById('forgotOk').classList.remove('show');
  document.getElementById('forgotForm').style.display = 'block';
}
function showVerifyPanel(email) {
  document.getElementById('authPanelMain').style.display   = 'none';
  document.getElementById('authPanelForgot').style.display = 'none';
  document.getElementById('authPanelNewPass').style.display = 'none';
  document.getElementById('authPanelVerify').style.display = 'block';
  document.getElementById('resendOk').classList.remove('show');
  // Tampilkan email user
  const el = document.getElementById('verifyEmailDisplay');
  if (el) el.textContent = email;
  // Simpan email untuk resend
  window._verifyEmail = email;
}

function goToLoginAfterVerify() {
  const email = window._verifyEmail || '';
  showMainPanel();
  switchAuthTab('masuk');
  if (email) document.getElementById('inEmail').value = email;
}

async function resendVerifyEmail() {
  const email = window._verifyEmail;
  if (!email) return;
  try {
    await sb.auth.resend({ type: 'signup', email });
    document.getElementById('resendOk').classList.add('show');
    setTimeout(() => document.getElementById('resendOk').classList.remove('show'), 4000);
  } catch(e) {
    showToast('Gagal kirim ulang: ' + e.message, '❌');
  }
}

function showForgotPanel() {
  document.getElementById('authPanelMain').style.display   = 'none';
  document.getElementById('authPanelForgot').style.display = 'block';
  document.getElementById('authPanelNewPass').style.display = 'none';
  const loginEmail = document.getElementById('inEmail').value.trim();
  if (loginEmail) document.getElementById('forgotEmail').value = loginEmail;
  hideAuthErr();
  document.getElementById('forgotErr').classList.remove('show');
  document.getElementById('forgotOk').classList.remove('show');
  document.getElementById('forgotForm').style.display = 'block';
  setTimeout(() => document.getElementById('forgotEmail').focus(), 100);
}
function showNewPassPanel() {
  document.getElementById('authPanelMain').style.display    = 'none';
  document.getElementById('authPanelForgot').style.display  = 'none';
  document.getElementById('authPanelNewPass').style.display = 'block';
  document.getElementById('newPassErr').classList.remove('show');
  document.getElementById('newPassOk').classList.remove('show');
  document.getElementById('newPassForm').style.display = 'block';
  setTimeout(() => document.getElementById('newPassInput').focus(), 100);
}

function showForgotErr(msg) { const el = document.getElementById('forgotErr'); el.textContent = msg; el.classList.add('show'); }
function showNewPassErr(msg) { const el = document.getElementById('newPassErr'); el.textContent = msg; el.classList.add('show'); }

// ── LOGIN ────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('inEmail').value.trim();
  const pass  = document.getElementById('inPass').value;
  if (!email || !pass) { showAuthErr('Email dan password wajib diisi'); return; }
  setBtnLoading('btnMasuk', true, 'Memproses...');
  hideAuthErr();
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    await afterLogin(data.user);
  } catch(e) {
    const msg = e.message || '';
    if (msg.includes('Invalid login') || msg.includes('credentials')) {
      showAuthErr('Email atau password salah. Coba lagi atau klik "Lupa password?"');
    } else {
      showAuthErr(msg || 'Login gagal. Periksa koneksi Anda.');
    }
    setBtnLoading('btnMasuk', false, 'Masuk →');
  }
}

// ── GOOGLE LOGIN ────────────────────────────────
async function doLoginGoogle() {
  setBtnLoading('btnGoogle', true, 'Menghubungkan...');
  hideAuthErr();
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });
    if (error) throw error;
    // Browser akan redirect ke Google — loading state tetap
  } catch(e) {
    showAuthErr(e.message || 'Login Google gagal. Coba lagi.');
    setBtnLoading('btnGoogle', false, '');
  }
}

// Handle redirect balik dari Google OAuth
async function handleOAuthCallback() {
  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return;

  // Pastikan profil ada di tabel profiles
  const user = session.user;
  const { data: prof } = await sb.from('profiles').select('id').eq('id', user.id).single();
  if (!prof) {
    const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0];
    await sb.from('profiles').insert({
      id: user.id,
      email: user.email,
      full_name: name,
      role: 'marketing',
      target: 5
    });
  }
}

// ── REGISTER ────────────────────────────────────
async function doRegister() {
  const name  = document.getElementById('inRegName').value.trim();
  const email = document.getElementById('inRegEmail').value.trim();
  const pass  = document.getElementById('inRegPass').value;
  if (!name || !email || !pass) { showAuthErr('Semua kolom wajib diisi'); return; }
  if (pass.length < 6) { showAuthErr('Password minimal 6 karakter'); return; }
  setBtnLoading('btnDaftar', true, 'Mendaftar...');
  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name } } });
    if (error) throw error;
    // Cek apakah Supabase butuh konfirmasi email
    // identities kosong = email sudah terdaftar sebelumnya
    const needsConfirm = data.user && !data.session;
    if (needsConfirm) {
      // Email konfirmasi diperlukan — tampilkan panel verifikasi
      setBtnLoading('btnDaftar', false, 'Buat Akun →');
      showVerifyPanel(email);
    } else {
      // Email confirm dinonaktifkan di Supabase — langsung masuk
      await sb.from('profiles').upsert({ id: data.user.id, email, full_name: name, role: 'marketing', target: 5 });
      showToast('Akun dibuat! Silakan masuk.', '✅');
      switchAuthTab('masuk');
      document.getElementById('inEmail').value = email;
      setBtnLoading('btnDaftar', false, 'Buat Akun →');
    }
  } catch(e) {
    showAuthErr(e.message || 'Pendaftaran gagal.');
    setBtnLoading('btnDaftar', false, 'Buat Akun →');
  }
}

// ── FORGOT PASSWORD ───────────────────────────────
async function doForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showForgotErr('Masukkan email Anda terlebih dahulu'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showForgotErr('Format email tidak valid'); return; }
  setBtnLoading('btnForgot', true, 'Mengirim...');
  document.getElementById('forgotErr').classList.remove('show');
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  } catch(e) {
    console.warn('resetPasswordForEmail:', e.message);
  } finally {
    setBtnLoading('btnForgot', false, 'Kirim Link Reset →');
    document.getElementById('forgotForm').style.display = 'none';
    document.getElementById('forgotOk').classList.add('show');
  }
}

// ── SET PASSWORD BARU ─────────────────────────────
async function doSetNewPassword() {
  const newPass     = document.getElementById('newPassInput').value;
  const confirmPass = document.getElementById('newPassConfirm').value;
  if (!newPass) { showNewPassErr('Password baru tidak boleh kosong'); return; }
  if (newPass.length < 6) { showNewPassErr('Password minimal 6 karakter'); return; }
  if (newPass !== confirmPass) { showNewPassErr('Konfirmasi password tidak cocok'); return; }
  setBtnLoading('btnNewPass', true, 'Menyimpan...');
  document.getElementById('newPassErr').classList.remove('show');
  try {
    const { error } = await sb.auth.updateUser({ password: newPass });
    if (error) throw error;
    document.getElementById('newPassForm').style.display = 'none';
    document.getElementById('newPassOk').classList.add('show');
    await sb.auth.signOut();
    setTimeout(() => {
      showMainPanel();
      switchAuthTab('masuk');
      showToast('Password berhasil diubah! Silakan masuk.', '✅');
    }, 2200);
  } catch(e) {
    showNewPassErr(e.message || 'Gagal mengubah password. Coba minta link reset ulang.');
    setBtnLoading('btnNewPass', false, 'Simpan Password Baru →');
  }
}

// ── LOGOUT ───────────────────────────────────────
async function doLogout() {
  const ok = await showConfirm('Akhiri sesi dan keluar dari PropMap?', '🚪 Keluar', 'Ya, Keluar', false);
  if (!ok) return;
  if (rtChan) { sb.removeChannel(rtChan); rtChan = null; }
  await sb.auth.signOut();
  me = null; myProf = null; allKons = []; allProfs = [];
  document.getElementById('shell').classList.remove('show');
  document.getElementById('shell').style.display = 'none';
  showAuth();
}
