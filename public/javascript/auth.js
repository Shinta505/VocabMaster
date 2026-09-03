const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authMsgBox = document.getElementById('authMsgBox');

// Fungsi Toggle Password
function togglePassword() {
    const input = document.getElementById('passwordInput');
    const icon = document.getElementById('toggleIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
}

// Cek URL Hash untuk form Update Password & TANGKAP REFERRAL CODE
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        // Fallback: Jika di URL auth tidak ada, cek dari localStorage yang disimpan oleh index.html
        refCode = localStorage.getItem('vocab_ref_code');
    }

    // Cek form update password
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        document.getElementById('updatePasswordModal').classList.remove('hidden');
    }
});

// Redirect jika sudah login (bawa ref dari URL atau dari LocalStorage)
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session && event === 'SIGNED_IN') {
        const urlParams = new URLSearchParams(window.location.search);
        const currentRef = urlParams.get('ref') || localStorage.getItem('vocab_ref_code');

        if (currentRef && currentRef !== 'NONE') {
            window.location.href = `/dashboard?ref=${encodeURIComponent(currentRef)}`;
        } else {
            window.location.href = '/dashboard';
        }
    }
});

function showMessage(msg, type) {
    authMsgBox.className = 'text-sm p-3.5 rounded-xl border font-medium flex items-start gap-2';
    if (type === 'error') {
        authMsgBox.classList.add('bg-red-50', 'border-red-200', 'text-red-700');
        authMsgBox.innerHTML = `<i class="fa-solid fa-circle-exclamation mt-0.5"></i> <span>${msg}</span>`;
    } else if (type === 'success') {
        authMsgBox.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-700');
        authMsgBox.innerHTML = `<i class="fa-solid fa-circle-check mt-0.5"></i> <span>${msg}</span>`;
    } else {
        authMsgBox.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-700');
        authMsgBox.innerHTML = `<i class="fa-solid fa-circle-info mt-0.5"></i> <span>${msg}</span>`;
    }
    authMsgBox.classList.remove('hidden');
}

// --- LOGIN ---
document.getElementById('loginBtn').addEventListener('click', async function(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Email dan password wajib diisi!", "error");
        return;
    }

    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Masuk...';
    btn.disabled = true;
    authMsgBox.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            if (error.message.includes("Email not confirmed")) {
                throw new Error("Email belum diverifikasi. Silakan cek kotak masuk/spam email kamu dan klik link verifikasi.");
            }
            throw error;
        }

        // Jika sukses, onAuthStateChange akan trigger dan redirect.
    } catch (error) {
        let msg = error.message;
        if (msg === "Invalid login credentials") msg = "Email atau password salah.";
        showMessage(msg, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// --- DAFTAR ---
document.getElementById('registerFreeBtn').addEventListener('click', async function() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    authMsgBox.classList.add('hidden');

    if (!email || !email.includes('@')) {
        showMessage("Masukkan email valid terlebih dahulu.", "error");
        return;
    }
    if (!passwordPattern.test(password)) {
        showMessage("Password minimal 8 karakter dan wajib mengandung huruf besar, huruf kecil, angka, serta simbol.", "error");
        return;
    }

    const btn = document.getElementById('registerFreeBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mendaftar...';
    btn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) throw error;

        // Beri tahu user untuk verifikasi
        showMessage("Pendaftaran berhasil! Link verifikasi telah dikirim. Silakan periksa kotak masuk atau folder SPAM email kamu.", "success");
        passwordInput.value = ''; // clear password
    } catch (err) {
        showMessage(err.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

// --- LUPA PASSWORD ---
document.getElementById('resetForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmailInput').value.trim();
    const statusMsg = document.getElementById('resetStatusMsg');
    const submitBtn = document.getElementById('resetBtn');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Mengirim...';
    statusMsg.classList.add('hidden');

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/auth', // Kembali ke halaman ini
        });
        if (error) throw error;

        statusMsg.className = 'text-sm p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 font-medium';
        statusMsg.textContent = 'Tautan reset password telah dikirim ke email Anda.';
        statusMsg.classList.remove('hidden');
    } catch (err) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-medium';
        statusMsg.textContent = err.message;
        statusMsg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kirim Link Reset';
    }
});

// --- UPDATE PASSWORD BARU ---
document.getElementById('updatePasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const newPassword = document.getElementById('newPasswordInput').value;
    const statusMsg = document.getElementById('updateStatusMsg');
    const submitBtn = document.getElementById('updatePwdBtn');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    statusMsg.classList.add('hidden');

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordPattern.test(newPassword)) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-medium';
        statusMsg.textContent = 'Password minimal 8 karakter (huruf besar, kecil, angka, simbol).';
        statusMsg.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Password';
        return;
    }

    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;

        statusMsg.className = 'text-sm p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 font-medium';
        statusMsg.textContent = 'Password berhasil diperbarui! Silakan login.';
        statusMsg.classList.remove('hidden');

        setTimeout(() => {
            document.getElementById('updatePasswordModal').classList.add('hidden');
            window.location.hash = '';
        }, 2000);
    } catch (err) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 border-red-200 text-red-700 font-medium';
        statusMsg.textContent = err.message;
        statusMsg.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Password';
    }
});
