const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isProUser = false;
let userWalletBalance = 0;
let userReferralCode = '';

const indonesianBanks = [
    "Bank BCA", "Bank Mandiri", "Bank BNI", "Bank BRI", "Bank Syariah Indonesia (BSI)",
    "Bank CIMB Niaga", "Bank Permata", "Bank Danamon", "Bank Mega", "Bank Tabungan Negara (BTN)",
    "Bank Jago", "SeaBank", "Blu by BCA Digital", "Bank Neo Commerce (BNC)", "Allo Bank",
    "Bank BTPN / Jenius", "Line Bank", "Krom Bank", "Bank Raya", "Bank Aladin Syariah",
    "Bank Muamalat", "Bank BCA Syariah", "Bank Mega Syariah", "Bank BTPN Syariah",
    "Bank Panin", "Bank Bukopin", "Bank OCBC NISP", "Bank DBS Indonesia", "Bank UOB Indonesia",
    "Bank Artha Graha", "Bank Bumi Arta", "Bank Sinarmas", "Bank Maspion", "Bank Mayapada",
    "Bank DKI", "Bank BJB", "Bank Jateng", "Bank Jatim", "Bank DIY",
    "Bank BPD Bali", "Bank Sumut", "Bank Nagari", "Bank Riau Kepri", "Bank Sumsel Babel",
    "Bank Jambi", "Bank Bengkulu", "Bank Aceh Syariah", "Bank Kalbar", "Bank Kaltimtara",
    "Bank Kalsel", "Bank Kalteng", "Bank Sulselbar", "Bank SulutGo", "Bank Sulteng",
    "Bank Sultra", "Bank Maluku Malut", "Bank Papua", "Bank NTT", "Bank NTB Syariah"
];

function populateBankDropdown() {
    const bankSelect = document.getElementById('wdBank');
    if (!bankSelect) return;
    indonesianBanks.sort((a, b) => a.localeCompare(b)).forEach(bank => {
        const option = document.createElement('option');
        option.value = bank;
        option.textContent = bank;
        bankSelect.appendChild(option);
    });
}

window.addEventListener('DOMContentLoaded', async() => {
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
        console.log("Gagal memuat config Midtrans.");
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = '/';
        return;
    }
    currentUser = session.user;
    const defaultName = currentUser.email.split('@')[0].toUpperCase();
    document.getElementById('displayUsername').textContent = defaultName;
});

// --- PROTEKSI HALAMAN ---
supabaseClient.auth.onAuthStateChange(async function(event, session) {
    if (!session) {
        window.location.href = '/auth';
        return;
    }

    if (session.user && !session.user.email_confirmed_at) {
        alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
        await supabaseClient.auth.signOut();
        window.location.href = '/auth';
        return;
    }

    currentUser = session.user;
    const defaultName = currentUser.email.split('@')[0].toUpperCase();
    document.getElementById('displayUsername').textContent = defaultName;

    // Muat data profil untuk mengecek status PRO dan Afiliasi
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
    if (profile) {
        if (profile.username) {
            document.getElementById('displayUsername').textContent = profile.username.toUpperCase();
        }

        const upgradeBtn = document.getElementById('upgradeProBtn');
        const desktopUpgradeCard = document.getElementById('desktopUpgradeCardContainer');
        const desktopAffiliateBtn = document.getElementById('desktopAffiliateBtn');
        const mobileAffiliateBtn = document.getElementById('mobileAffiliateBtn');
        const logoBadge = document.getElementById('logoStatusBadge');

        if (profile.pro_expired_at && new Date(profile.pro_expired_at) > new Date()) {
            isProUser = true;
            if (upgradeBtn) upgradeBtn.classList.add('hidden');
            if (desktopUpgradeCard) desktopUpgradeCard.classList.add('hidden');
            if (desktopAffiliateBtn) desktopAffiliateBtn.classList.replace('hidden', 'flex');
            if (mobileAffiliateBtn) mobileAffiliateBtn.classList.replace('hidden', 'flex');
            if (logoBadge) {
                logoBadge.textContent = 'Pro';
                logoBadge.className = 'text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }

            document.getElementById('mainContent').classList.remove('hidden');
            populateBankDropdown();
            loadAffiliateData(profile);
        } else {
            isProUser = false;
            alert("🔒 AKSES DITOLAK!\n\nProgram Afiliasi hanya terbuka eksklusif untuk member PRO. Upgrade paket kamu dan mulai bagikan link-mu!");
            window.location.href = '/dashboard';
        }
    }
});

window.executeProCheckout = function() {
    const selected = document.querySelector('input[name="proPlan"]:checked');
    if (!selected) return;

    const months = parseInt(selected.value);
    const price = parseInt(selected.getAttribute('data-price'));
    const name = selected.getAttribute('data-name');

    startCheckout(months, price, name);
};

async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    // Ambil kode referral dari URL atau LocalStorage
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

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
                    alert("Pembayaran berhasil! Silakan refresh halaman.");
                    window.location.reload();
                },
                onPending: function() { alert("Menunggu pembayaran selesai."); },
                onError: function() { alert("Pembayaran gagal."); },
                onClose: function() { alert("Popup pembayaran ditutup."); }
            });
        } else {
            throw new Error(data.message || "Gagal membuat transaksi.");
        }
    } catch (err) {
        alert("Error: " + err.message);
    }
}

document.getElementById('logoutBtn').addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
});

function toggleMobileMenu() { document.getElementById('mobileDropdown').classList.toggle('hidden'); }
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileDropdown');
    const btn = document.getElementById('mobileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function showMessage(msg, type) {
    const box = document.getElementById('messageBox');
    const textSpan = document.getElementById('messageBoxText');
    box.className = 'fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-3 shadow-lg';
    if (type === 'success') box.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    else if (type === 'error') box.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    else box.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');

    textSpan.textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 3000);
}

async function loadAffiliateData(profileData) {
    userWalletBalance = profileData.wallet_balance || 0;
    userReferralCode = profileData.referral_code;

    if (!userReferralCode) {
        let baseName = profileData.username ? profileData.username : currentUser.email.split('@')[0];
        baseName = baseName.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const currentYear = new Date().getFullYear();
        userReferralCode = baseName + currentYear;
        await supabaseClient.from('profiles').update({ referral_code: userReferralCode }).eq('id', currentUser.id);
    }

    document.getElementById('walletBalanceDisplay').textContent = 'Rp ' + userWalletBalance.toLocaleString('id-ID');
    const refLink = window.location.origin + '/?ref=' + userReferralCode;
    document.getElementById('referralLinkInput').value = refLink;

    const wdBtn = document.getElementById('wdSubmitBtn');
    if (userWalletBalance < 15000) {
        wdBtn.disabled = true;
        wdBtn.textContent = 'Saldo Belum Mencapai Minimum (Rp 15.000)';
        wdBtn.classList.replace('bg-green-600', 'bg-gray-400');
        wdBtn.classList.replace('hover:bg-green-700', 'hover:bg-gray-400');
    } else {
        wdBtn.disabled = false;
        wdBtn.textContent = 'Ajukan Penarikan';
        wdBtn.classList.replace('bg-gray-400', 'bg-green-600');
        wdBtn.classList.replace('hover:bg-gray-400', 'hover:bg-green-700');
    }
}

function copyReferralLink() {
    const input = document.getElementById('referralLinkInput');
    input.select();
    navigator.clipboard.writeText(input.value);
    showMessage("Link Referral berhasil disalin!", "success");
}

document.getElementById('withdrawalForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const errorMsg = document.getElementById('wdErrorMsg');
    const requestAmount = parseInt(document.getElementById('wdAmount').value);

    if (requestAmount < 15000) {
        errorMsg.textContent = "Minimal penarikan adalah Rp 15.000.";
        errorMsg.classList.remove('hidden');
        return;
    }
    if (requestAmount > userWalletBalance) {
        errorMsg.textContent = "Nominal penarikan melebihi saldo kamu saat ini.";
        errorMsg.classList.remove('hidden');
        return;
    }

    const bank = document.getElementById('wdBank').value;
    const accountNo = document.getElementById('wdAccount').value.trim();
    const accountName = document.getElementById('wdName').value.trim();
    const btn = document.getElementById('wdSubmitBtn');

    errorMsg.classList.add('hidden');
    const originalText = btn.textContent;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/request-withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                email: currentUser.email,
                bankName: bank,
                accountNumber: accountNo,
                accountName: accountName,
                amount: requestAmount
            })
        });

        const resData = await response.json();

        if (resData.success) {
            showMessage("Pengajuan penarikan berhasil! Admin akan segera memprosesnya.", "success");
            this.reset();
        } else {
            errorMsg.textContent = resData.message;
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        errorMsg.textContent = "Terjadi kesalahan sistem saat menghubungi server.";
        errorMsg.classList.remove('hidden');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

function openContactModal() { document.getElementById('contactModal').classList.remove('hidden'); }

function closeContactModal() { document.getElementById('contactModal').classList.add('hidden'); }

function openUpgradeModal() { document.getElementById('upgradeModal').classList.remove('hidden'); }

async function loadUserProfile() {
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];

    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();

    if (data) {
        document.getElementById('displayUsername').textContent = data.username || defaultName;
        document.getElementById('profileUsername').value = data.username || '';
        document.getElementById('profileDob').value = data.dob || '';

        isProUser = false;
        if (data.pro_expired_at && new Date(data.pro_expired_at) > new Date()) {
            isProUser = true;
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

function openProfileModal() {
    loadUserProfile();
    document.getElementById('profileModal').classList.remove('hidden');
}

document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const statusMsg = document.getElementById('profileStatusMsg');
    const newUsername = document.getElementById('profileUsername').value.trim();
    const newDob = document.getElementById('profileDob').value;
    const newPassword = document.getElementById('profilePassword').value;

    btn.textContent = 'Menyimpan...';
    btn.disabled = true;
    statusMsg.classList.add('hidden');

    if (!newUsername || !newDob) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Nama pengguna dan tanggal lahir wajib diisi!';
        statusMsg.classList.remove('hidden');
        btn.textContent = 'Simpan Profil';
        btn.disabled = false;
        return;
    }

    // Cek apakah username unik
    const {
        data: existing
    } = await supabaseClient
        .from('profiles')
        .select('id')
        .ilike('username', newUsername)
        .neq('id', currentUser.id);

    if (existing && existing.length > 0) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Nama pengguna sudah digunakan orang lain!';
        statusMsg.classList.remove('hidden');
        btn.textContent = 'Simpan Profil';
        btn.disabled = false;
        return;
    }

    try {
        const updateData = { username: newUsername, dob: newDob };
        const { error: profileErr } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', currentUser.id);

        if (profileErr) throw profileErr;

        if (newPassword) {
            const { error: passErr } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (passErr) throw passErr;
        }

        statusMsg.textContent = "Profil berhasil diperbarui!";
        statusMsg.className = "text-sm p-3 rounded-xl border font-medium bg-green-50 text-green-700 border-green-200";
        statusMsg.classList.remove('hidden');

        document.getElementById('displayUsername').textContent = newUsername.toUpperCase();

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
