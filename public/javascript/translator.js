const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isProUser = false;
let userTranslatorQuota = 5;

function toggleMobileMenu() {
    const dropdown = document.getElementById('mobileDropdown');
    dropdown.classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileDropdown');
    const btn = document.getElementById('mobileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

window.addEventListener('DOMContentLoaded', async() => {
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        refCode = localStorage.getItem('vocab_ref_code');
    }

    if (refCode && refCode !== 'NONE') {
        // Menyisipkan ?ref= otomatis ke seluruh menu navigasi/sidebar agar tidak terputus
        document.querySelectorAll('a[href]').forEach(link => {
            let href = link.getAttribute('href');
            if (href && href.startsWith('/') && !href.startsWith('//')) {
                const url = new URL(href, window.location.origin);
                url.searchParams.set('ref', refCode);
                link.setAttribute('href', url.pathname + url.search);
            }
        });
    }

    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.clientKey) {
            const script = document.createElement('script');
            script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
            script.setAttribute('data-client-key', data.clientKey);
            document.head.appendChild(script);
        }
    } catch (err) {
        console.log("Config loaded.");
    }

    // Cek Session Supabase dengan onAuthStateChange
    supabaseClient.auth.onAuthStateChange(async function(event, session) {
        if (!session) {
            // Jika tidak ada session, alihkan (redirect) pengguna ke halaman otentikasi
            window.location.href = '/auth';
            return;
        }

        // Jika ada session, periksa apakah email pengguna sudah diverifikasi
        if (session.user && !session.user.email_confirmed_at) {
            alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
            await supabaseClient.auth.signOut();
            // Setelah sesi dihapus, alihkan kembali ke halaman otentikasi
            window.location.href = '/auth';
            return;
        }

        // Jika session valid dan aman, inisialisasi data pengguna
        currentUser = session.user;

        // Tampilkan antarmuka utama aplikasi (appScreen)
        document.getElementById('appScreen').classList.remove('hidden');

        // Opsional: Sembunyikan elemen loginScreen jika masih ada di struktur HTML
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.classList.add('hidden');
        }

        // Render nama pengguna pada antarmuka
        const defaultName = currentUser.email.split('@')[0];
        document.getElementById('displayUsername').textContent = defaultName;

        // Muat profil pengguna secara asinkron
        await loadUserProfile();
    });
});

document.getElementById('loginBtn').addEventListener('click', async function(e) {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const authErrorMsg = document.getElementById('authErrorMsg');

    if (!email || !password) {
        authErrorMsg.textContent = "Email dan password wajib diisi!";
        authErrorMsg.classList.remove('hidden');
        return;
    }

    try {
        const res = await supabaseClient.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        window.location.reload();
    } catch (error) {
        authErrorMsg.textContent = "Gagal masuk: " + error.message;
        authErrorMsg.classList.remove('hidden');
    }
});

document.getElementById('logoutBtn').addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
});

function showMessage(msg, type) {
    const box = document.getElementById('messageBox');
    const textSpan = document.getElementById('messageBoxText');
    box.className = 'absolute top-20 right-4 lg:top-4 lg:right-8 px-4 py-3 rounded-xl z-50 flex items-center gap-3 shadow-lg font-medium';
    if (type === 'success') box.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    else if (type === 'error') box.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    else box.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');

    textSpan.textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 3000);
}

async function loadUserProfile() {
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];

    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();

    if (data) {
        document.getElementById('displayUsername').textContent = data.username || defaultName;
        document.getElementById('profileUsername').value = data.username || '';
        document.getElementById('profileDob').value = data.dob || '';

        userTranslatorQuota = data.translator_quota ?? 5;
        isProUser = false;

        if (data.pro_expired_at) {
            const expiredDate = new Date(data.pro_expired_at);
            if (expiredDate > new Date()) {
                isProUser = true;
            }
        }

        const upgradeBtn = document.getElementById('upgradeProBtn');
        const desktopUpgradeCard = document.getElementById('desktopUpgradeCardContainer');
        const desktopAffiliateBtn = document.getElementById('desktopAffiliateBtn');
        const mobileAffiliateBtn = document.getElementById('mobileAffiliateBtn');
        const logoBadge = document.getElementById('logoStatusBadge');

        if (isProUser) {
            if (upgradeBtn) upgradeBtn.classList.add('hidden');
            if (desktopUpgradeCard) desktopUpgradeCard.classList.add('hidden');
            if (desktopAffiliateBtn) desktopAffiliateBtn.classList.replace('hidden', 'flex');
            if (mobileAffiliateBtn) mobileAffiliateBtn.classList.replace('hidden', 'flex');
            if (logoBadge) {
                logoBadge.textContent = 'Pro';
                logoBadge.className = 'text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }
        } else {
            if (upgradeBtn) upgradeBtn.classList.replace('hidden', 'flex');
            if (desktopUpgradeCard) desktopUpgradeCard.classList.remove('hidden');
            if (logoBadge) {
                logoBadge.textContent = 'Free';
                logoBadge.className = 'text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }
        }
    }
}

document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const statusMsg = document.getElementById('profileStatusMsg');
    const usernameInput = document.getElementById('profileUsername');
    const dobInput = document.getElementById('profileDob');
    const passwordInput = document.getElementById('profilePassword');

    if (!usernameInput || !dobInput) return;

    const username = usernameInput.value.trim();
    const dob = dobInput.value;
    const newPassword = passwordInput ? passwordInput.value : '';

    if (!username || !dob) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Nama pengguna dan tanggal lahir wajib diisi!';
        statusMsg.classList.remove('hidden');
        return;
    }

    btn.textContent = 'Menyimpan...';
    btn.disabled = true;
    statusMsg.classList.add('hidden');

    try {
        // Cek apakah username sudah digunakan oleh user lain di database Supabase
        const { data: existing } = await supabaseClient
            .from('profiles')
            .select('id')
            .ilike('username', username)
            .neq('id', currentUser.id);

        if (existing && existing.length > 0) {
            statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
            statusMsg.textContent = 'Nama pengguna sudah digunakan orang lain!';
            statusMsg.classList.remove('hidden');
            return; // Hentikan proses simpan
        }

        // Jika unik, lakukan update profil
        const { error: profileErr } = await supabaseClient
            .from('profiles')
            .update({ username: username, dob: dob })
            .eq('id', currentUser.id);

        if (profileErr) throw profileErr;

        if (newPassword) {
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!passwordPattern.test(newPassword)) {
                statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
                statusMsg.textContent = 'Password baru minimal 8 karakter, ada huruf besar, kecil, angka, & simbol.';
                statusMsg.classList.remove('hidden');
                return;
            }
            const { error: passErr } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (passErr) throw passErr;
        }

        statusMsg.textContent = "Profil berhasil diperbarui!";
        statusMsg.className = "text-sm p-3 rounded-xl border font-medium bg-green-50 text-green-700 border-green-200";
        statusMsg.classList.remove('hidden');

        document.getElementById('displayUsername').textContent = username.toUpperCase();

        setTimeout(() => {
            document.getElementById('profileModal').classList.add('hidden');
            statusMsg.classList.add('hidden');
        }, 1500);

    } catch (err) {
        statusMsg.textContent = "Gagal memperbarui profil: " + err.message;
        statusMsg.className = "text-sm p-3 rounded-xl border font-medium bg-red-50 text-red-700 border-red-200";
        statusMsg.classList.remove('hidden');
    } finally {
        btn.textContent = 'Simpan Profil';
        btn.disabled = false;
    }
});

// Translator Logic
const MAX_WORDS = 250;
const translateInput = document.getElementById('translateInput');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const translateError = document.getElementById('translateError');

translateInput.addEventListener('input', function() {
    const words = this.value.trim().split(/\s+/).filter(w => w.length > 0);
    const count = words.length;
    wordCountDisplay.textContent = `${count} / ${MAX_WORDS} kata`;

    if (count > MAX_WORDS) {
        wordCountDisplay.classList.add('text-red-500');
        translateError.classList.remove('hidden');
    } else {
        wordCountDisplay.classList.remove('text-red-500');
        translateError.classList.add('hidden');
    }
});

document.getElementById('translatorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const text = translateInput.value.trim();
    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (words.length > MAX_WORDS) return;

    if (!isProUser && userTranslatorQuota <= 0) {
        alert("🔒 LIMIT TERCAPAI!\n\nKuota ID-EN Translator gratis kamu (5x) sudah habis. Silakan Upgrade ke PRO untuk menerjemahkan teks tanpa batas!");
        return;
    }

    const btn = document.getElementById('translateBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    const resultArea = document.getElementById('translateResultArea');
    resultArea.classList.add('hidden');

    try {
        const req = await fetch('/api/humanize-translation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        const res = await req.json();

        if (res.success && res.data) {
            document.getElementById('translatedOutput').textContent = res.data;
            resultArea.classList.remove('hidden');

            if (!isProUser) {
                userTranslatorQuota--;
                await supabaseClient.from('profiles').update({
                    translator_quota: userTranslatorQuota
                }).eq('id', currentUser.id);
            }
        } else {
            showMessage("Gagal menerjemahkan: " + (res.message || "Kesalahan server"), "error");
        }
    } catch (error) {
        console.error("Error:", error);
        showMessage("Gagal terhubung ke server API.", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

function copyTranslation() {
    const text = document.getElementById('translatedOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showMessage("Teks berhasil disalin!", "success");
    });
}

function openUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
}

function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
}

function openContactModal() {
    document.getElementById('contactModal').classList.remove('hidden');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.add('hidden');
}

async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    // Tangkap kode referral dari URL atau LocalStorage
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

    // Simpan ke LocalStorage agar tidak hilang jika user berpindah halaman
    if (urlParams.get('ref')) {
        localStorage.setItem('vocab_ref_code', urlParams.get('ref'));
    }

    try {
        const response = await fetch('/api/create-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                durationMonths: durationInMonths,
                amount: priceAmount,
                packageName: packageName,
                referralCode: refCode // Kirim ke backend
            })
        });

        const data = await response.json();
        if (data.success && data.token && window.snap) {
            window.snap.pay(data.token, {
                onSuccess: function() {
                    alert("Pembayaran berhasil!");
                    window.location.reload();
                },
                onPending: function() { alert("Menunggu pembayaran."); },
                onError: function() { alert("Pembayaran gagal."); }
            });
        } else {
            throw new Error(data.message || "Gagal membuat transaksi.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

window.executeProCheckout = function() {
    const selected = document.querySelector('input[name="proPlan"]:checked');
    if (!selected) return;
    startCheckout(parseInt(selected.value), parseInt(selected.getAttribute('data-price')), selected.getAttribute('data-name'));
};
