const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isProUser = false;
let userGrammarQuota = 5;
let userTranslatorQuota = 5;
let currentAudio = null;

// --- SISTEM AUTENTIKASI ---
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

    // Memuat konfigurasi Midtrans
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

    // Menggunakan onAuthStateChange untuk sistem autentikasi & proteksi
    supabaseClient.auth.onAuthStateChange(async function(event, session) {
        if (!session) {
            // Jika tidak ada session, lempar ke auth.html
            window.location.href = '/auth';
            return;
        }

        // Cek verifikasi email
        if (session.user && !session.user.email_confirmed_at) {
            alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
            await supabaseClient.auth.signOut();
            window.location.href = '/auth';
            return;
        }

        currentUser = session.user;

        // Set default username di navbar
        const defaultName = currentUser.email.split('@')[0];
        document.getElementById('displayUsername').textContent = defaultName;

        // Mengambil data profil untuk cek status PRO dan Quota
        const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
        if (profile) {
            document.getElementById('displayUsername').textContent = profile.username || defaultName;
            userGrammarQuota = profile.grammar_quota ?? 5;
            userTranslatorQuota = profile.translator_quota ?? 5;

            if (profile.pro_expired_at && new Date(profile.pro_expired_at) > new Date()) {
                isProUser = true;
            } else {
                isProUser = false;
            }

            const upgradeBtn = document.getElementById('upgradeProBtn');
            const desktopUpgradeCard = document.getElementById('desktopUpgradeCardContainer');
            const desktopAffiliateBtn = document.getElementById('desktopAffiliateBtn');
            const mobileAffiliateBtn = document.getElementById('mobileAffiliateBtn');
            const logoBadge = document.getElementById('logoStatusBadge');

            if (isProUser) {
                if (upgradeBtn) {
                    upgradeBtn.classList.remove('flex');
                    upgradeBtn.classList.add('hidden');
                }
                if (desktopUpgradeCard) desktopUpgradeCard.classList.add('hidden');
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
                if (upgradeBtn) {
                    upgradeBtn.classList.remove('hidden');
                    upgradeBtn.classList.add('flex');
                }
                if (desktopUpgradeCard) desktopUpgradeCard.classList.remove('hidden');
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

        await loadUserProfile();
        // Inisialisasi tampilan default topik speaking
        handleVlogLevelChange('A1');
    });
});

document.getElementById('logoutBtn').addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
});

async function loadUserProfile() {
    if (!currentUser) return;
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];

    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();

    if (data) {
        document.getElementById('displayUsername').textContent = data.username || defaultName;
        document.getElementById('profileUsername').value = data.username || '';
        document.getElementById('profileDob').value = data.dob || '';
    }
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

        if (password && password.length >= 8) {
            const { error: passErr } = await supabaseClient.auth.updateUser({ password });
            if (passErr) throw passErr;
        }

        statusMsg.textContent = "Profil berhasil diperbarui!";
        statusMsg.className = 'text-sm p-3 rounded-xl border font-medium bg-green-50 border-green-200 text-green-700 block';

        document.getElementById('displayUsername').textContent = username;

        setTimeout(() => {
            document.getElementById('profileModal').classList.add('hidden');
            statusMsg.classList.add('hidden');
        }, 1500);

    } catch (err) {
        statusMsg.textContent = "Gagal memperbarui profil: " + (err.message || err);
        statusMsg.className = 'text-sm p-3 rounded-xl border font-medium bg-red-50 border-red-200 text-red-700 block';
    }
});

// --- UI HELPERS ---
function toggleMobileMenu() {
    document.getElementById('mobileDropdown').classList.toggle('hidden');
}

window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileDropdown');
    const btn = document.getElementById('mobileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function showMessage(msg, type) {
    const box = document.getElementById('messageBox');
    if (!box) return;
    const textSpan = document.getElementById('messageBoxText');
    box.className = 'fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-3 shadow-lg';
    if (type === 'success') box.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
    else if (type === 'error') box.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
    else box.classList.add('bg-blue-100', 'border', 'border-blue-400', 'text-blue-700');

    textSpan.textContent = msg;
    box.classList.remove('hidden');
    setTimeout(() => box.classList.add('hidden'), 3000);
}

function playGoogleTTS(text, forceLang = 'en-US') {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    const encodedText = encodeURIComponent(text.trim());
    if (!encodedText) return;

    const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${forceLang}&client=gtx`;
    currentAudio = new Audio(ttsUrl);
    currentAudio.play().catch(error => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = forceLang;
            window.speechSynthesis.speak(utterance);
        }
    });
}

function speakText(text) {
    playGoogleTTS(text);
}

// --- LOGIKA SPEAKING PRACTICE ---
async function loadStaticTopics(level) {
    const topicSelect = document.getElementById('vlogTopicSelect');
    if (!topicSelect) return;

    topicSelect.innerHTML = '<option value="">Memuat topik...</option>';
    try {
        const { data, error } = await supabaseClient.from('speaking_scripts').select('topic').eq('level', level);
        if (error) throw error;
        const uniqueTopics = [...new Set(data.map(item => item.topic))];
        topicSelect.innerHTML = '<option value="">-- Pilih Topik Latihan --</option>';
        if (uniqueTopics.length > 0) {
            uniqueTopics.forEach(topic => {
                const opt = document.createElement('option');
                opt.value = topic;
                opt.textContent = topic;
                topicSelect.appendChild(opt);
            });
        } else {
            topicSelect.innerHTML = '<option value="">Topik belum tersedia</option>';
        }
    } catch (err) {
        topicSelect.innerHTML = '<option value="">Gagal memuat topik</option>';
    }
}

function handleVlogLevelChange(level) {
    const selectEl = document.getElementById('vlogTopicSelect');
    const inputEl = document.getElementById('vlogTopic');

    if (isProUser) {
        selectEl.classList.add('hidden');
        inputEl.classList.remove('hidden');
        selectEl.required = false;
        inputEl.required = true;
    } else {
        inputEl.classList.add('hidden');
        selectEl.classList.remove('hidden');
        inputEl.required = false;
        selectEl.required = true;
        loadStaticTopics(level);
    }
}

document.getElementById('vlogForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const level = document.getElementById('vlogLevel').value;
    const resultArea = document.getElementById('vlogResultArea');
    resultArea.classList.add('hidden');
    resultArea.innerHTML = '';

    const btn = document.getElementById('vlogGenerateBtn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Naskah...';
    btn.disabled = true;

    try {
        let scriptText = '';
        if (!isProUser) {
            const selectedTopic = document.getElementById('vlogTopicSelect').value;
            if (!selectedTopic) {
                showMessage("Silakan pilih topik terlebih dahulu!", "error");
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                return;
            }
            const { data, error } = await supabaseClient.from('speaking_scripts').select('content').eq('level', level).eq('topic', selectedTopic);
            if (error) throw error;

            if (data && data.length > 0) {
                const randomIndex = Math.floor(Math.random() * data.length);
                scriptText = data[randomIndex].content;
            } else {
                showMessage("Naskah untuk topik ini tidak ditemukan.", "error");
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                return;
            }
        } else {
            const topic = document.getElementById('vlogTopic').value.trim();
            if (!topic) return;

            const req = await fetch('/api/generate-vlog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, topic })
            });
            const res = await req.json();
            if (res.success && res.data) {
                scriptText = res.data;
            } else {
                throw new Error("Gagal membuat naskah AI.");
            }
        }

        const sentences = scriptText.match(/[^.!?]+[.!?]+/g) || [scriptText];

        sentences.forEach((sentence, index) => {
            const cleanSentence = sentence.trim();
            if (!cleanSentence) return;

            // Ubah setiap kata dalam kalimat utama agar bisa diklik
            const clickableWordsHtml = cleanSentence.split(' ').map(word => {
                const pureWord = word.replace(/[^a-zA-Z]/g, '');
                if (!pureWord) return word;
                return `<span onclick="openVocabDetail('${pureWord}')" class="cursor-pointer hover:text-blue-600 hover:underline transition-colors">${word}</span>`;
            }).join(' ');

            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-50 border border-gray-200 rounded-xl';
            div.innerHTML = `
                        <div class="flex items-start justify-between gap-4 mb-3">
                            <p id="target-text-${index}" class="text-gray-800 text-sm font-medium leading-relaxed flex-1">${clickableWordsHtml}</p>
                            <div class="relative w-12 h-12 flex items-center justify-center shrink-0" title="Skor Pelafalan">
                                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path class="text-gray-200" stroke-width="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path id="progress-ring-${index}" class="text-gray-300 transition-all duration-700 ease-out" stroke-dasharray="0, 100" stroke-width="3" stroke-linecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span id="progress-text-${index}" class="absolute text-[10px] font-bold text-gray-500">0%</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button type="button" onclick="speakText('${cleanSentence.replace(/'/g, "\\'")}')" class="text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                                <i class="fa-solid fa-volume-high"></i> Dengar
                            </button>
                            <button type="button" onclick="startPronunciationCheck(${index})" id="mic-btn-${index}" class="text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                                <i class="fa-solid fa-microphone"></i> Rekam Suara
                            </button>
                        </div>
                        <p id="feedback-text-${index}" class="mt-3 text-xs hidden bg-white p-3 rounded-lg border border-gray-100"></p>
                    `;
            resultArea.appendChild(div);
        });

        resultArea.classList.remove('hidden');
    } catch (error) {
        showMessage("Terjadi kesalahan saat memuat naskah.", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

function startPronunciationCheck(index) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Maaf, browsermu tidak mendukung fitur rekam suara otomatis. Gunakan Google Chrome.");
        return;
    }

    const micBtn = document.getElementById(`mic-btn-${index}`);
    const feedbackEl = document.getElementById(`feedback-text-${index}`);
    const targetText = document.getElementById(`target-text-${index}`).innerText;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
        micBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mendengarkan...';
        micBtn.classList.replace('bg-red-500', 'bg-gray-600');
        feedbackEl.classList.add('hidden');
    };

    recognition.onresult = function(event) {
        const spokenText = event.results[0][0].transcript;
        const targetWords = targetText.replace(/[.,!?]/g, '').split(' ');
        const spokenWordsArray = spokenText.toLowerCase().replace(/[.,!?]/g, '').split(' ');

        let correctCount = 0;
        let resultHTML = '<span class="font-bold text-gray-500 mb-2 block">Hasil analisismu:</span><div class="leading-loose">';

        targetWords.forEach((word, i) => {
            const cleanWord = word.toLowerCase();
            const pureWord = word.replace(/[^a-zA-Z]/g, '');
            if (spokenWordsArray.includes(cleanWord)) {
                correctCount++;
                resultHTML += `<span onclick="openVocabDetail('${pureWord}')" class="text-green-600 font-bold text-base cursor-pointer hover:underline">${word}</span> `;
            } else {
                const heardWord = spokenWordsArray[i] ? spokenWordsArray[i] : 'terlewat';
                resultHTML += `
                        <span class="inline-flex items-baseline mx-0.5">
                            <span onclick="openVocabDetail('${pureWord}')" class="text-red-500 font-bold line-through text-base cursor-pointer hover:underline">${word}</span>
                            <span class="text-[10px] text-gray-500 bg-gray-100 rounded px-1 ml-1 border border-gray-200" title="Sistem mendengar kata ini">dengar: ${heardWord}</span>
                        </span> `;
            }
        });

        resultHTML += '</div>';
        feedbackEl.innerHTML = resultHTML + `
                    <div class="mt-4 pt-2 border-t border-gray-100 text-xs text-gray-400">
                        Teks utuh yang tertangkap mic: <br>"<i>${spokenText}</i>"
                    </div>`;
        feedbackEl.classList.remove('hidden');

        const percentage = Math.round((correctCount / targetWords.length) * 100);
        const ringEl = document.getElementById(`progress-ring-${index}`);
        const textEl = document.getElementById(`progress-text-${index}`);

        ringEl.setAttribute('stroke-dasharray', `${percentage}, 100`);
        textEl.textContent = `${percentage}%`;

        const correctSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
        const wrongSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2954/2954-preview.mp3');

        if (percentage >= 80) {
            ringEl.setAttribute('class', 'text-green-500 transition-all duration-700 ease-out');
            textEl.className = 'absolute text-[10px] font-bold text-green-600';
            correctSound.play();
        } else if (percentage >= 50) {
            ringEl.setAttribute('class', 'text-yellow-500 transition-all duration-700 ease-out');
            textEl.className = 'absolute text-[10px] font-bold text-yellow-600';
            wrongSound.play();
        } else {
            ringEl.setAttribute('class', 'text-red-500 transition-all duration-700 ease-out');
            textEl.className = 'absolute text-[10px] font-bold text-red-600';
            wrongSound.play();
        }
    };

    recognition.onerror = function(event) {
        alert("Gagal merekam suara: " + event.error);
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Coba Lagi';
        micBtn.classList.replace('bg-gray-600', 'bg-red-500');
    };

    recognition.onend = function() {
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Rekam Ulang';
        micBtn.classList.replace('bg-gray-600', 'bg-red-500');
    };

    recognition.start();
}

// --- FUNGSI MODAL BANTUAN & PROFIL ---
function openContactModal() { document.getElementById('contactModal').classList.remove('hidden'); }

function closeContactModal() { document.getElementById('contactModal').classList.add('hidden'); }

function openProfileModal() { document.getElementById('profileModal').classList.remove('hidden'); }

function openUpgradeModal() { document.getElementById('upgradeModal').classList.remove('hidden'); }

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
                referralCode: refCode
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

// --- LOGIKA MODAL DETAIL & SIMPAN VOCAB ---
let selectedActiveWord = '';
let selectedWordData = null; // Menyimpan data lengkap dari API

async function openVocabDetail(word) {
    if (!word) return;
    selectedActiveWord = word.toLowerCase();

    // Format huruf awal kapital (Title Case)
    const formattedWord = selectedActiveWord.charAt(0).toUpperCase() + selectedActiveWord.slice(1);

    document.getElementById('modalVocabWord').textContent = formattedWord;
    document.getElementById('modalVocabLevel').textContent = 'A1';
    document.getElementById('modalVocabPos').textContent = 'Memuat...';
    document.getElementById('modalVocabMeaning').textContent = 'Memuat arti...';
    document.getElementById('modalVocabExamples').innerHTML = 'Memuat contoh kalimat...';
    document.getElementById('vocabDetailModal').classList.remove('hidden');

    try {
        // Gunakan API AI /api/generate-vocab persis seperti di grammar_checker.html agar akurat dan lengkap
        const req = await fetch('/api/generate-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: selectedActiveWord, meaning: '', type: '', context: '' })
        });
        const res = await req.json();

        if (res.success && res.data) {
            selectedWordData = res.data;
            selectedWordData.word = selectedActiveWord;

            document.getElementById('modalVocabLevel').textContent = res.data.level || 'A1';
            document.getElementById('modalVocabPos').textContent = res.data.type || 'NOUN';
            document.getElementById('modalVocabMeaning').textContent = res.data.meaning || 'Tidak ada arti';

            // Format contoh kalimat (biasanya dipisah enter \n atau array)
            const contextText = res.data.context || '';
            const examplesArray = contextText.split('\n').filter(Boolean);

            if (examplesArray.length > 0) {
                document.getElementById('modalVocabExamples').innerHTML = examplesArray.map((ex, idx) =>
                    `<div>${idx + 1}. ${ex}</div>`
                ).join('');
            } else {
                document.getElementById('modalVocabExamples').innerHTML = `<div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation. <i>(Dia menggunakan kata ini dalam percakapan sehari-hari.)</i></div>`;
            }
        } else {
            throw new Error("Gagal mengambil detail kata.");
        }
    } catch (err) {
        document.getElementById('modalVocabPos').textContent = 'NOUN';
        document.getElementById('modalVocabMeaning').textContent = 'Kosakata umum bahasa Inggris.';
        document.getElementById('modalVocabExamples').innerHTML = `
                    <div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation. <i>(Dia menggunakan kata ini dalam percakapan sehari-hari.)</i></div>
                `;
    }
}

function closeVocabDetailModal() {
    document.getElementById('vocabDetailModal').classList.add('hidden');
}

async function openVocabDetail(word) {
    if (!word) return;
    selectedActiveWord = word.toLowerCase();

    // Format huruf awal kapital (Title Case)
    const formattedWord = selectedActiveWord.charAt(0).toUpperCase() + selectedActiveWord.slice(1);

    document.getElementById('modalVocabWord').textContent = formattedWord;
    document.getElementById('modalVocabLevel').textContent = '...';
    document.getElementById('modalVocabPos').textContent = 'Memuat...';
    document.getElementById('modalVocabMeaning').textContent = 'Memuat arti...';
    document.getElementById('modalVocabExamples').innerHTML = 'Memuat contoh kalimat...';
    document.getElementById('vocabDetailModal').classList.remove('hidden');

    try {
        // Gunakan API AI /api/generate-vocab
        const req = await fetch('/api/generate-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: selectedActiveWord, meaning: '', type: '', context: '' })
        });
        const res = await req.json();

        if (res.success && res.data) {
            selectedWordData = res.data;
            selectedWordData.word = selectedActiveWord;

            document.getElementById('modalVocabLevel').textContent = res.data.level || 'A1';
            document.getElementById('modalVocabPos').textContent = res.data.type || 'NOUN';
            document.getElementById('modalVocabMeaning').textContent = res.data.meaning || 'Tidak ada arti';

            // Format contoh kalimat
            const contextText = res.data.context || '';
            const examplesArray = contextText.split('\n').filter(Boolean);

            if (examplesArray.length > 0) {
                document.getElementById('modalVocabExamples').innerHTML = examplesArray.map((ex, idx) =>
                    `<div>${idx + 1}. ${ex}</div>`
                ).join('');
            } else {
                document.getElementById('modalVocabExamples').innerHTML = `<div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation. <i>(Dia menggunakan kata ini dalam percakapan sehari-hari.)</i></div>`;
            }
        } else {
            // TANGKAP PENOLAKAN KATA BUKAN BAHASA INGGRIS
            closeVocabDetailModal();
            showMessage(res.message || "Gagal mengambil detail kata.", "error");
        }
    } catch (err) {
        closeVocabDetailModal();
        showMessage("Terjadi kesalahan saat memuat data kata.", "error");
    }
}

async function saveVocabToDatabase() {
    // Pastikan selectedWordData ada untuk mengirim struktur data yang lengkap
    if (!currentUser || !selectedActiveWord || !selectedWordData) return;

    const btn = document.getElementById('modalSaveVocabBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        // 1. Tembak API Backend untuk menyimpan ke Master Vocabularies (Bypass RLS)
        const saveMasterRes = await fetch('/api/save-master-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: selectedWordData.word,
                meaning: selectedWordData.meaning,
                type: selectedWordData.type,
                context: selectedWordData.context,
                level: selectedWordData.level,
                synonyms: selectedWordData.synonyms,
                word_family: selectedWordData.word_family,
                verb_forms: selectedWordData.verb_forms
            })
        });

        const masterData = await saveMasterRes.json();

        if (!masterData.success) {
            throw new Error(masterData.message || "Gagal menyimpan data master ke database.");
        }

        const vocabId = masterData.id;

        // 2. Validasi redundansi untuk mencegah duplikasi relasi pada user_vocabularies
        const { data: duplicateCheck, error: checkError } = await supabaseClient
            .from('user_vocabularies')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('vocabulary_id', vocabId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (duplicateCheck) {
            showMessage("Kosakata ini sudah tersimpan di daftar Anda.", "error");
            closeVocabDetailModal();
            return;
        }

        // 3. Pembuatan relasi data (Foreign Keys) ke junction table user_vocabularies
        const { error: insertRelError } = await supabaseClient
            .from('user_vocabularies')
            .insert([{
                user_id: currentUser.id,
                vocabulary_id: vocabId,
                is_memorized: false
            }]);

        if (insertRelError) throw insertRelError;

        showMessage("Kosakata berhasil disimpan ke daftar vocab!", "success");
        setTimeout(() => {
            closeVocabDetailModal();
        }, 1000);
    } catch (err) {
        console.error("Kesalahan sistem:", err);
        showMessage(err.message || "Terjadi kesalahan saat menyimpan kosakata.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
