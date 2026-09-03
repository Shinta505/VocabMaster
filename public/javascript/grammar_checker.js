const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isProUser = false;
let userGrammarQuota = 5;
let userAiVocabQuota = 8;
let currentAudio = null;

const appScreen = document.getElementById('appScreen');

window.addEventListener('DOMContentLoaded', async() => {
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        // Simpan ke localStorage agar awet
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        // Ambil dari localStorage jika URL saat ini tidak ada param ref
        refCode = localStorage.getItem('vocab_ref_code');
    }

    // Jika ada kode rujukan, tempelkan ke semua tautan menu internal aplikasi
    if (refCode && refCode !== 'NONE') {
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href');

            // Pastikan hanya menargetkan link internal lokal (bukan URL luar, anchor #, atau javascript)
            if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript')) {
                const urlObj = new URL(href, window.location.origin);
                urlObj.searchParams.set('ref', refCode);
                link.setAttribute('href', urlObj.pathname + urlObj.search);
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
        console.log("Gagal memuat config Midtrans.");
    }
});

// Toggle dropdown menu titik tiga mobile
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

// Supabase Auth State
supabaseClient.auth.onAuthStateChange(async function(event, session) {
    if (!session) {
        // Jika tidak ada session, arahkan ke halaman autentikasi
        window.location.href = '/auth';
        return;
    }

    // Jika ada session, periksa verifikasi email
    if (session.user && !session.user.email_confirmed_at) {
        alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
        await supabaseClient.auth.signOut();
        window.location.href = '/auth';
        return;
    }

    // Jika aman, eksekusi pemuatan data
    currentUser = session.user;

    // PENTING: Tampilkan layar utama aplikasi
    appScreen.classList.remove('hidden');

    const defaultName = currentUser.email.split('@')[0];
    document.getElementById('displayUsername').textContent = defaultName;

    await loadUserProfile();
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

document.getElementById('logoutBtn').addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
});

async function loadUserProfile() {
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];

    const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();

    if (data) {
        document.getElementById('displayUsername').textContent = data.username || defaultName;
        document.getElementById('profileUsername').value = data.username || '';
        document.getElementById('profileDob').value = data.dob || '';

        userGrammarQuota = data.grammar_quota ?? 5;
        userAiVocabQuota = data.ai_vocab_quota ?? 8;
        isProUser = false;

        if (data.pro_expired_at) {
            const expiredDate = new Date(data.pro_expired_at);
            const today = new Date();
            if (expiredDate > today) {
                isProUser = true;
            }
        }

        // --- LOGIC MENAMPILKAN/MENYEMBUNYIKAN TOMBOL AFFILIATE & UPGRADE ---
        const upgradeBtn = document.getElementById('upgradeProBtn');
        const desktopUpgradeCard = document.getElementById('desktopUpgradeCardContainer');
        const desktopAffiliateBtn = document.getElementById('desktopAffiliateBtn');
        const mobileAffiliateBtn = document.getElementById('mobileAffiliateBtn');
        const logoBadge = document.getElementById('logoStatusBadge');

        if (isProUser) {
            // Jika PRO: Sembunyikan tombol Upgrade, Munculkan tombol Afiliasi
            if (upgradeBtn) {
                upgradeBtn.classList.remove('flex');
                upgradeBtn.classList.add('hidden');
            }
            if (desktopUpgradeCard) desktopUpgradeCard.classList.add('hidden'); // TAMBAHKAN BARIS INI

            if (desktopAffiliateBtn) {
                desktopAffiliateBtn.classList.remove('hidden');
                desktopAffiliateBtn.classList.add('flex');
            }
            if (mobileAffiliateBtn) {
                mobileAffiliateBtn.classList.remove('hidden');
                mobileAffiliateBtn.classList.add('flex');
            }
            if (logoBadge) {
                logoBadge.textContent = 'Pro';
                logoBadge.className = 'text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }
        } else {
            // Jika FREE: Munculkan tombol Upgrade, Sembunyikan tombol Afiliasi
            if (upgradeBtn) {
                upgradeBtn.classList.remove('hidden');
                upgradeBtn.classList.add('flex');
            }
            if (desktopUpgradeCard) desktopUpgradeCard.classList.remove('hidden'); // TAMBAHKAN BARIS INI

            if (desktopAffiliateBtn) {
                desktopAffiliateBtn.classList.remove('flex');
                desktopAffiliateBtn.classList.add('hidden');
            }
            if (mobileAffiliateBtn) {
                mobileAffiliateBtn.classList.remove('flex');
                mobileAffiliateBtn.classList.add('hidden');
            }
            if (logoBadge) {
                logoBadge.textContent = 'Free';
                logoBadge.className = 'text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }
        }
    }
}

// Logic Modal Profil
function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
}

document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('profileUsername');
    const dobInput = document.getElementById('profileDob');
    const passwordInput = document.getElementById('profilePassword');
    const statusMsg = document.getElementById('profileStatusMsg');

    const username = usernameInput.value.trim();
    const dob = dobInput.value;
    const newPassword = passwordInput ? passwordInput.value : '';

    if (!username || !dob) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Nama pengguna dan tanggal lahir wajib diisi!';
        statusMsg.classList.remove('hidden');
        return;
    }

    const { data: existing } = await supabaseClient.from('profiles').select('id').ilike('username', username).neq('id', currentUser.id);

    if (existing && existing.length > 0) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Nama pengguna sudah digunakan orang lain!';
        statusMsg.classList.remove('hidden');
        return;
    }

    try {
        const { error } = await supabaseClient.from('profiles').update({ username: username, dob: dob }).eq('id', currentUser.id);
        if (error) throw error;

        if (newPassword) {
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!passwordPattern.test(newPassword)) {
                statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
                statusMsg.textContent = 'Password baru minimal 8 karakter, ada huruf besar, kecil, angka, & simbol.';
                statusMsg.classList.remove('hidden');
                return;
            }
            await supabaseClient.auth.updateUser({ password: newPassword });
        }

        statusMsg.className = 'text-sm p-3 rounded-xl border bg-green-50 text-green-700 font-medium';
        statusMsg.textContent = 'Profil berhasil diperbarui!';
        statusMsg.classList.remove('hidden');

        await loadUserProfile();
        setTimeout(() => {
            document.getElementById('profileModal').classList.add('hidden');
            statusMsg.classList.add('hidden');
        }, 1500);

    } catch (err) {
        statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
        statusMsg.textContent = 'Gagal menyimpan: ' + err.message;
        statusMsg.classList.remove('hidden');
    }
});

// --- Fungsi Modal Contact Us ---
function openContactModal() {
    document.getElementById('contactModal').classList.remove('hidden');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.add('hidden');
}

// TTS Sound Function
function speakText(text) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    const encodedText = encodeURIComponent(text.trim());
    if (!encodedText) return;
    const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en-US&client=gtx`;
    currentAudio = new Audio(ttsUrl);
    currentAudio.play().catch(error => {
        console.warn("Google TTS API diblokir:", error);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            window.speechSynthesis.speak(utterance);
        }
    });
}

// Logic Grammar Checker (Dari app.html dipindah kesini)
document.getElementById('correctorForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const inputField = document.getElementById('sentenceInput');
    const sentence = inputField.value.trim();
    if (!sentence) return;

    // Validasi Kuota
    if (!isProUser && userGrammarQuota <= 0) {
        alert("🔒 LIMIT TERCAPAI!\n\nKuota Grammar Checker gratis kamu (5x) sudah habis. Silakan Upgrade ke PRO untuk mengoreksi kalimat tanpa batas!");
        return;
    }

    const btn = document.getElementById('checkSentenceBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Sedang Menganalisis...';
    btn.disabled = true;

    const resultContainer = document.getElementById('correctorResult');
    resultContainer.classList.add('hidden');

    try {
        const req = await fetch('/api/correct-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence })
        });

        const res = await req.json();

        if (res.success && res.data) {
            const correctedString = res.data.corrected;
            const correctedContainer = document.getElementById('correctedText');
            correctedContainer.innerHTML = ''; // Kosongkan

            // Pecah kalimat berdasarkan spasi/kata agar tiap kata bisa diklik
            const wordsArray = correctedString.split(' ');
            wordsArray.forEach(w => {
                // Bersihkan tanda baca untuk keperluan lookup jika perlu, tapi tampilkan apa adanya
                const cleanWord = w.replace(/[^a-zA-Z]/g, '');
                const span = document.createElement('spanclass');
                span.className = 'cursor-pointer hover:bg-purple-200 hover:text-purple-900 rounded px-1 transition-colors inline-block';
                span.textContent = w + ' ';

                if (cleanWord.length > 0) {
                    span.addEventListener('click', () => fetchWordDetailForModal(cleanWord));
                }
                correctedContainer.appendChild(span);
            });

            document.getElementById('explanationText').textContent = res.data.explanation;
            resultContainer.classList.remove('hidden');

            // Kurangi Kuota Jika Bukan PRO
            if (!isProUser) {
                userGrammarQuota--;
                await supabaseClient.from('profiles').update({
                    grammar_quota: userGrammarQuota
                }).eq('id', currentUser.id);
            }
        } else {
            showMessage("Gagal mengoreksi kalimat: " + (res.message || "Kesalahan server"), "error");
        }
    } catch (error) {
        console.error("Error:", error);
        showMessage("Gagal terhubung ke server AI. Coba lagi nanti.", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

// --- LOGIC CHECKOUT MIDTRANS & MODAL UPGRADE ---
function openUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
}

async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    // Ambil kode rujukan dari URL (jika ada) atau LocalStorage
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

    // Simpan ke LocalStorage jika ada di URL
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
                onSuccess: function(result) {
                    alert("Pembayaran berhasil! Silakan refresh halaman.");
                    window.location.reload();
                },
                onPending: function(result) {
                    alert("Menunggu pembayaran selesai.");
                },
                onError: function(result) {
                    alert("Pembayaran gagal.");
                },
                onClose: function() {
                    alert("Popup pembayaran ditutup.");
                }
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

    const months = parseInt(selected.value);
    const price = parseInt(selected.getAttribute('data-price'));
    const name = selected.getAttribute('data-name');

    startCheckout(months, price, name);
};

// Fungsi Detail Kata
let selectedWordData = null;

async function fetchWordDetailForModal(word) {
    showMessage(`Mencari detail kata "${word}"...`, "info");
    try {
        // 1. CEK DULU KE DATABASE (TABLE VOCABULARIES)
        const checkReq = await fetch('/api/check-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: word })
        });
        const checkRes = await checkReq.json();

        if (checkRes.success && checkRes.data) {
            // JIKA ADA DI DATABASE: Langsung tampilkan tanpa mengurangi kuota AI
            selectedWordData = checkRes.data;
            selectedWordData.word = word; // Pastikan kata tersimpan

            document.getElementById('modalWord').textContent = word;
            document.getElementById('modalType').textContent = selectedWordData.type || 'Word';
            document.getElementById('modalMeaning').textContent = selectedWordData.meaning || 'Tidak ada arti';
            document.getElementById('modalLevel').textContent = selectedWordData.level || 'A1';
            document.getElementById('modalContext').textContent = selectedWordData.context || 'Contoh tidak tersedia';

            document.getElementById('vocabDetailModal').classList.remove('hidden');
            return; // Stop fungsi disini karena sudah pakai data DB
        }

        // 2. JIKA TIDAK ADA DI DATABASE: Cek Kuota AI Vocab untuk User Free
        if (!isProUser && userAiVocabQuota <= 0) {
            alert(`🚨 PERINGATAN!\n\nKuota AI Vocab kamu sudah habis dan kata "${word}" belum tersimpan di dalam database kami.\n\nSilakan Upgrade ke PRO untuk generate vocab menggunakan AI tanpa batas!`);
            return; // Batalkan proses generate AI
        }

        // 3. JIKA LOLOS CEK KUOTA: Generate pakai AI Gemini
        showMessage(`Membuat detail kata "${word}" menggunakan AI...`, "info");
        const req = await fetch('/api/generate-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: word, meaning: '', type: '', context: '' })
        });
        const res = await req.json();

        if (res.success && res.data) {
            selectedWordData = res.data;
            selectedWordData.word = word;

            document.getElementById('modalWord').textContent = word;
            document.getElementById('modalType').textContent = res.data.type || 'Word';
            document.getElementById('modalMeaning').textContent = res.data.meaning || 'Tidak ada arti';
            document.getElementById('modalLevel').textContent = res.data.level || 'A1';
            document.getElementById('modalContext').textContent = res.data.context || 'Contoh tidak tersedia';

            document.getElementById('vocabDetailModal').classList.remove('hidden');

            // 4. KURANGI KUOTA AI VOCAB KARENA BARU SAJA MENGGUNAKAN AI (Jika bukan PRO)
            if (!isProUser) {
                userAiVocabQuota--;
                await supabaseClient.from('profiles').update({
                    ai_vocab_quota: userAiVocabQuota
                }).eq('id', currentUser.id);
            }
        } else {
            showMessage("Gagal memuat detail kata.", "error");
        }
    } catch (err) {
        console.error(err);
        showMessage("Terjadi kesalahan koneksi saat memuat kata.", "error");
    }
}

function closeVocabDetail() {
    document.getElementById('vocabDetailModal').classList.add('hidden');
}

async function saveWordFromModal() {
    if (!selectedWordData || !currentUser) return;

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    saveBtn.disabled = true;

    try {
        // 1. Simpan ke tabel master vocabularies via API Backend (Bypass RLS & Anti Duplikat)
        const req = await fetch('/api/save-master-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: selectedWordData.word,
                meaning: selectedWordData.meaning,
                type: selectedWordData.type,
                context: selectedWordData.context,
                level: selectedWordData.level || 'A1',
                synonyms: selectedWordData.synonyms || null,
                word_family: selectedWordData.word_family || null,
                verb_forms: selectedWordData.verb_forms || null
            })
        });

        const res = await req.json();

        if (!res.success) {
            throw new Error(res.message || "Gagal menyimpan ke master vocab.");
        }

        // 2. Simpan relasinya ke tabel user_vocabularies menggunakan ID dari backend
        const { error: userVocabError } = await supabaseClient.from('user_vocabularies').insert([{
            user_id: currentUser.id,
            vocabulary_id: res.id,
            is_memorized: false
        }]);

        if (userVocabError) throw userVocabError;

        showMessage(`Berhasil menyimpan "${selectedWordData.word}" ke daftar vocab!`, "success");
        closeVocabDetail();
    } catch (err) {
        showMessage("Gagal menyimpan: " + err.message, "error");
    } finally {
        saveBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah ke Daftar Vocab';
        saveBtn.disabled = false;
    }
}
