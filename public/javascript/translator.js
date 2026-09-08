const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isProUser = false;
let userTranslatorQuota = 5;

// === GLOBAL FUNCTIONS ===
function toggleMobileMenu() {
    const dropdown = document.getElementById('mobileDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function showMessage(msg, type) {
    const box = document.getElementById('messageBox');
    const textSpan = document.getElementById('messageBoxText');
    
    if (!box || !textSpan) return;

    box.className = 'absolute top-20 right-4 lg:top-4 lg:right-8 px-4 py-3 rounded-xl z-50 flex items-center gap-3 shadow-lg font-medium';
    if (type === 'success') box.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    else if (type === 'error') box.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    else box.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');

    textSpan.textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 3000);
}

// === WINDOW EVENTS ===
window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileDropdown');
    const btn = document.getElementById('mobileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

window.addEventListener('DOMContentLoaded', async() => {
    // 1. Handle Referral Code
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        refCode = localStorage.getItem('vocab_ref_code');
    }

    if (refCode && refCode !== 'NONE') {
        document.querySelectorAll('a[href]').forEach(link => {
            let href = link.getAttribute('href');
            if (href && href.startsWith('/') && !href.startsWith('//')) {
                const url = new URL(href, window.location.origin);
                url.searchParams.set('ref', refCode);
                link.setAttribute('href', url.pathname + url.search);
            }
        });
    }

    // 2. Fetch Midtrans Config
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
        console.log("Midtrans config loaded statically or fetch failed.");
    }

    // 3. Supabase Auth State Check
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

        const appScreen = document.getElementById('appScreen');
        if (appScreen) appScreen.classList.remove('hidden');

        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) loginScreen.classList.add('hidden');

        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername) {
            const defaultName = currentUser.email.split('@')[0];
            displayUsername.textContent = defaultName;
        }

        await loadUserProfile();
    });
});

// === PROFILE LOGIC ===
async function loadUserProfile() {
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) profileEmail.value = currentUser.email;

    let defaultName = currentUser.email.split('@')[0];

    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
            
        // Log jika internet putus/gagal fetch dari Supabase, tanpa membuat crash
        if (error) console.warn("Network issue fetching profile:", error.message);

        if (data) {
            const displayUsername = document.getElementById('displayUsername');
            const profileUsername = document.getElementById('profileUsername');
            const profileDob = document.getElementById('profileDob');

            if (displayUsername) displayUsername.textContent = data.username || defaultName;
            if (profileUsername) profileUsername.value = data.username || '';
            if (profileDob) profileDob.value = data.dob || '';

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
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
        await supabaseClient.auth.signOut();
        window.location.href = '/auth';
    });
}

const profileForm = document.getElementById('profileForm');
if (profileForm) {
    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('button[type="submit"]');
        const statusMsg = document.getElementById('profileStatusMsg');
        const usernameInput = document.getElementById('profileUsername');
        const dobInput = document.getElementById('profileDob');
        const passwordInput = document.getElementById('profilePassword');

        if (!usernameInput || !dobInput || !statusMsg) return;

        const username = usernameInput.value.trim();
        const dob = dobInput.value;
        const newPassword = passwordInput ? passwordInput.value : '';

        if (!username || !dob) {
            statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
            statusMsg.textContent = 'Nama pengguna dan tanggal lahir wajib diisi!';
            statusMsg.classList.remove('hidden');
            return;
        }

        if (btn) {
            btn.textContent = 'Menyimpan...';
            btn.disabled = true;
        }
        statusMsg.classList.add('hidden');

        try {
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('id')
                .ilike('username', username)
                .neq('id', currentUser.id);

            if (existing && existing.length > 0) {
                statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
                statusMsg.textContent = 'Nama pengguna sudah digunakan orang lain!';
                statusMsg.classList.remove('hidden');
                return;
            }

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

            const displayUsername = document.getElementById('displayUsername');
            if (displayUsername) displayUsername.textContent = username.toUpperCase();

            setTimeout(() => {
                const profileModal = document.getElementById('profileModal');
                if (profileModal) profileModal.classList.add('hidden');
                statusMsg.classList.add('hidden');
            }, 1500);

        } catch (err) {
            statusMsg.textContent = "Gagal memperbarui profil: " + err.message;
            statusMsg.className = "text-sm p-3 rounded-xl border font-medium bg-red-50 text-red-700 border-red-200";
            statusMsg.classList.remove('hidden');
        } finally {
            if (btn) {
                btn.textContent = 'Simpan Profil';
                btn.disabled = false;
            }
        }
    });
}

// === TRANSLATOR LOGIC ===
const MAX_WORDS = 250;
const translateInput = document.getElementById('translateInput');
const wordCountDisplay = document.getElementById('wordCountDisplay');
const translateError = document.getElementById('translateError');
const translatorForm = document.getElementById('translatorForm');

if (translateInput && wordCountDisplay && translateError) {
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
}

if (translatorForm) {
    translatorForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!translateInput) return;

        const text = translateInput.value.trim();
        const words = text.split(/\s+/).filter(w => w.length > 0);

        if (words.length > MAX_WORDS) return;

        if (!isProUser && userTranslatorQuota <= 0) {
            alert("🔒 LIMIT TERCAPAI!\n\nKuota ID-EN Translator gratis kamu (5x) sudah habis. Silakan Upgrade ke PRO untuk menerjemahkan teks tanpa batas!");
            return;
        }

        const btn = document.getElementById('translateBtn');
        let originalHTML = '';
        
        if (btn) {
            originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
            btn.disabled = true;
        }

        const resultArea = document.getElementById('translateResultArea');
        if (resultArea) resultArea.classList.add('hidden');

        try {
            const req = await fetch('/api/humanize-translation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const res = await req.json();

            if (res.success && res.data) {
                const translatedOutput = document.getElementById('translatedOutput');
                if (translatedOutput) translatedOutput.textContent = res.data;
                
                if (resultArea) resultArea.classList.remove('hidden');

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
            if (btn) {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }
        }
    });
}

// === MODALS & UTILS ===
function copyTranslation() {
    const output = document.getElementById('translatedOutput');
    if (output) {
        const text = output.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showMessage("Teks berhasil disalin!", "success");
        });
    }
}

function openUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) modal.classList.remove('hidden');
}

function openProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) modal.classList.remove('hidden');
}

function openContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) modal.classList.remove('hidden');
}

function closeContactModal() {
    const modal = document.getElementById('contactModal');
    if (modal) modal.classList.add('hidden');
}

// === PAYMENT LOGIC ===
async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

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
                referralCode: refCode
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

// Register global functions ke objek window agar bisa di-call dari HTML via atribut onclick="..."
window.copyTranslation = copyTranslation;
window.openUpgradeModal = openUpgradeModal;
window.openProfileModal = openProfileModal;
window.openContactModal = openContactModal;
window.closeContactModal = closeContactModal;
window.toggleMobileMenu = toggleMobileMenu;
window.executeProCheckout = function() {
    const selected = document.querySelector('input[name="proPlan"]:checked');
    if (!selected) return;
    startCheckout(parseInt(selected.value), parseInt(selected.getAttribute('data-price')), selected.getAttribute('data-name'));
};
