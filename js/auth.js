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
  document.getElementById('authErr').classList.remove('show');
  document.getElementById('forgotErr').classList.remove('show');
  document.getElementById('forgotOk').classList.remove('show');
  document.getElementById('forgotForm').style.display = 'block';
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
    await sb.from('profiles').upsert({ id: data.user.id, email, full_name: name, role: 'marketing', target: 5 });
    showToast('Akun dibuat! Silakan masuk.', '✅');
    switchAuthTab('masuk');
    document.getElementById('inEmail').value = email;
    setBtnLoading('btnDaftar', false, 'Buat Akun →');
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
  if (!confirm('Yakin ingin keluar?')) return;
  if (rtChan) { sb.removeChannel(rtChan); rtChan = null; }
  await sb.auth.signOut();
  me = null; myProf = null; allKons = []; allProfs = [];
  document.getElementById('shell').classList.remove('show');
  document.getElementById('shell').style.display = 'none';
  showAuth();
}
