const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let vocabData = [];
let currentFilter = 'all';
let currentCategory = 'all';
let currentLevelFilter = 'all';
let currentAudio = null;

let currentFlashcardDeck = [];
let currentFlashcardIndex = 0;
let isFlashcardFlipped = false;

// Variabel Pagination State
let currentPage = 1;
const itemsPerPage = 5;

const appScreen = document.getElementById('appScreen');

function toggleMobileMenu() {
    const mobileDropdown = document.getElementById('mobileDropdown');
    if (mobileDropdown) {
        mobileDropdown.classList.toggle('hidden');
    }
}

// Fungsi untuk toggle menu titik tiga
function toggleActionMenu() {
    document.getElementById('actionDropdown').classList.toggle('hidden');
}

// Tutup dropdown (mobile & titik tiga) jika klik di luar area
window.addEventListener('click', function(e) {
    // Logika Mobile Dropdown
    const mobileDropdown = document.getElementById('mobileDropdown');
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileDropdown && mobileBtn && !mobileDropdown.contains(e.target) && !mobileBtn.contains(e.target)) {
        mobileDropdown.classList.add('hidden');
    }

    // Logika Action Dropdown (Titik Tiga)
    const actionDropdown = document.getElementById('actionDropdown');
    const actionBtn = document.getElementById('actionMenuBtn');
    if (actionDropdown && actionBtn && !actionDropdown.contains(e.target) && !actionBtn.contains(e.target)) {
        actionDropdown.classList.add('hidden');
    }
});

window.addEventListener('DOMContentLoaded', async() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        document.getElementById('updatePasswordModal').classList.remove('hidden');
    }

    try {
        if (window.location.protocol.startsWith('http')) {
            const res = await fetch('/api/config');
            const data = await res.json();

            if (data.clientKey) {
                const script = document.createElement('script');
                script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
                // Production : script.src = 'https://app.midtrans.com/snap/snap.js'
                script.setAttribute('data-client-key', data.clientKey);
                document.head.appendChild(script);
            }
        }
    } catch (err) {
        console.log("Mode preview iframe terdeteksi, config dilewati.");
    }
});

document.getElementById('logoutBtn').addEventListener('click', async function() {
    await supabaseClient.auth.signOut();
    window.location.href = '/auth';
});

// PROTEKSI HALAMAN (HANYA BISA DIAKSES JIKA LOGIN & EMAIL TERVERIFIKASI)
supabaseClient.auth.onAuthStateChange(async function(event, session) {
    if (!session) {
        // Jika tidak ada session, lempar ke auth.html
        window.location.href = '/auth';
        return;
    }

    // Jika ada session, kita bisa memeriksa verifikasi email (opsional di sisi client jika Supabase sudah mewajibkan di server)
    if (session.user && !session.user.email_confirmed_at) {
        alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
        await supabaseClient.auth.signOut();
        window.location.href = '/auth';
        return;
    }

    // Jika aman, eksekusi pemuatan data
    currentUser = session.user;

    const defaultName = currentUser.email.split('@')[0];
    document.getElementById('displayUsername').textContent = defaultName;
    document.getElementById('welcomeName').textContent = defaultName;

    await loadUserProfile();
    loadVocabularies();
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

const typeColors = {
    'Noun': 'bg-blue-100 text-blue-700 border-blue-200',
    'Verb': 'bg-green-100 text-green-700 border-green-200',
    'Adjective': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'Adverb': 'bg-purple-100 text-purple-700 border-purple-200',
    'Pronoun': 'bg-pink-100 text-pink-700 border-pink-200',
    'Preposition': 'bg-teal-100 text-teal-700 border-teal-200',
    'Conjunction': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Determiner': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Interjection': 'bg-cyan-100 text-cyan-700 border-cyan-200',
    'Phrase': 'bg-orange-100 text-orange-700 border-orange-200',
    'Idiom': 'bg-rose-100 text-rose-700 border-rose-200'
};

// FUNGSI BANTUAN UNTUK JEDA WAKTU (DELAY)
const delay = ms => new Promise(res => setTimeout(res, ms));

document.getElementById('vocabForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!currentUser) return;

    const wordInput = document.getElementById('vWord');
    let rawInput = wordInput.value.trim();
    if (!rawInput) return;

    const btn = document.getElementById('vocabSubmitBtn');

    // Cek Limit 150 Kata untuk Free User
    if (!isProUser && vocabData.length >= 150) {
        alert("🔒 LIMIT TERCAPAI!\n\nPengguna Free maksimal hanya dapat menyimpan 150 kosakata di beranda. Upgrade ke VocabMaster PRO untuk simpan tanpa batas!");
        return;
    }

    const extractedWords = rawInput.toLowerCase().match(/\b[a-z]+\b/g);

    if (!extractedWords || extractedWords.length === 0) {
        showMessage("Input tidak valid. Harap masukkan kata/kalimat huruf abjad.", "error");
        return;
    }

    let wordsToProcess = [...new Set(extractedWords)];
    const existingUserWords = new Set(vocabData.map(v => v.word.toLowerCase()));
    const newWordsToProcess = wordsToProcess.filter(w => !existingUserWords.has(w));

    if (newWordsToProcess.length === 0) {
        showMessage("Semua kata dalam input tersebut sudah ada di daftar hafalanmu!", "error");
        wordInput.value = '';
        return;
    }

    if (!isProUser && (vocabData.length + newWordsToProcess.length) > 150) {
        alert(`🔒 LIMIT TERCAPAI!\n\nMaksimal user FREE bisa menyimpan vocab di beranda hanya 150 kata. Sisa kuota kamu tidak cukup.`);
        return;
    }

    const originalBtnHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Data...';
    btn.disabled = true;

    let successCount = 0;

    try {
        const { data: profile } = await supabaseClient.from('profiles').select('ai_vocab_quota').eq('id', currentUser.id).single();
        let currentAiQuota = profile ? profile.ai_vocab_quota : 0;
        let isPro = isProUser;

        for (let i = 0; i < newWordsToProcess.length; i++) {
            let word = newWordsToProcess[i];
            let definition = '';
            let meaning = '';
            let type = 'Auto';
            let context = rawInput.includes(' ') ? rawInput.trim() : '';
            let level = null;
            let synonyms = null;
            let word_family = null;
            let verb_forms = null;

            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menganalisis (${i+1}/${newWordsToProcess.length})...`;

            // Panggilan API Backend untuk Cek Database Global (Bypass RLS)
            const checkReq = await fetch('/api/check-vocab', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: word })
            });
            const checkRes = await checkReq.json();

            let existingGlobalVocab = null;
            if (checkRes.success && checkRes.data) {
                existingGlobalVocab = checkRes.data;
            }

            if (existingGlobalVocab) {
                definition = existingGlobalVocab.definition;
                meaning = existingGlobalVocab.meaning;
                type = existingGlobalVocab.type;
                context = existingGlobalVocab.context;
                level = existingGlobalVocab.level;
                synonyms = existingGlobalVocab.synonyms;
                word_family = existingGlobalVocab.word_family;
                verb_forms = existingGlobalVocab.verb_forms;
            } else {
                // JIKA BUKAN PRO MELAINKAN FREE DAN KUOTA AI HABIS
                if (!isPro && currentAiQuota <= 0) {
                    // Ambil data dari database di table vocabularies
                    const { data: dbVocab } = await supabaseClient
                        .from('vocabularies')
                        .select('*')
                        .ilike('word', word)
                        .limit(1)
                        .maybeSingle();

                    if (dbVocab) {
                        // Jika ada di database
                        definition = dbVocab.definition;
                        meaning = dbVocab.meaning;
                        type = dbVocab.type;
                        context = dbVocab.context;
                        level = dbVocab.level;
                        synonyms = dbVocab.synonyms;
                        word_family = dbVocab.word_family;
                        verb_forms = dbVocab.verb_forms;
                    } else {
                        // Jika vocab ternyata tidak ada di database
                        alert(`Kuota Tambah Vocab dari AI kamu sudah habis. Dan vocab "${word}" tidak ada dalam database.`);
                        continue; // Lewati kata ini
                    }
                } else {
                    // Cek Kuota AI Habis
                    if (!isPro && currentAiQuota <= 0) {
                        alert("Kuota Tambah Vocab dari AI nya hampir habis.");
                        break;
                    }

                    // Tembak Gemini API
                    const aiReq = await fetch('/api/generate-vocab', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ word, meaning, type, context })
                    });

                    const aiRes = await aiReq.json();

                    if (aiRes.success && aiRes.data) {
                        definition = aiRes.data.definition || definition;
                        meaning = aiRes.data.meaning || meaning;
                        type = aiRes.data.type || type;
                        context = aiRes.data.context || context;
                        level = aiRes.data.level || 'A1';
                        synonyms = aiRes.data.synonyms || null;
                        word_family = aiRes.data.word_family || null;
                        verb_forms = aiRes.data.verb_forms || null;

                        if (!isPro) {
                            currentAiQuota--;
                            await supabaseClient.from('profiles').update({
                                ai_vocab_quota: currentAiQuota
                            }).eq('id', currentUser.id);
                        }
                    } else {
                        // Jika AI gagal dan user FREE, arahkan ke table vocabularies atau beritahu
                        if (!isPro) {
                            alert("Kuota Tambah Vocab dari AI nya habis.");
                            break;
                        }
                    }
                }
            }

            let vocabId;
            if (existingGlobalVocab) {
                vocabId = existingGlobalVocab.id;
            } else {
                // Delegasi penyimpanan ke peladen backend (Operasi deduplikasi ID ditangani endpoint save-master-vocab)
                const masterReq = await fetch('/api/save-master-vocab', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word, definition, meaning, type, context, level, synonyms, word_family, verb_forms })
                });
                const masterRes = await masterReq.json();
                if (!masterRes.success) continue;
                vocabId = masterRes.id;
            }

            const res = await supabaseClient.from('user_vocabularies').insert([{
                user_id: currentUser.id,
                vocabulary_id: vocabId,
                is_memorized: false
            }]).select();

            if (!res.error && res.data && res.data.length > 0) {
                const newRel = res.data[0];
                vocabData.unshift({
                    id: newRel.id,
                    vocab_id: vocabId,
                    word: word,
                    definition: definition,
                    meaning: meaning,
                    type: type,
                    context: context,
                    level: level,
                    synonyms: synonyms,
                    word_family: word_family,
                    verb_forms: verb_forms,
                    isMemorized: false,
                    createdAt: new Date(newRel.created_at).getTime()
                });
                successCount++;
                updateUI();
            }

            if (i < newWordsToProcess.length - 1) {
                await delay(1500);
            }
        }

        e.target.reset();
        if (successCount > 0) {
            showMessage(`Berhasil menyimpan ${successCount} kata baru!`, "success");
            document.getElementById('addVocabModalToggle').checked = false;
        }
    } catch (error) {
        console.error("Error Processing Queue:", error);
        showMessage("Terjadi kesalahan sistem saat memproses kata.", "error");
    } finally {
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
    }
});

async function loadVocabularies() {
    if (!currentUser) return;
    document.getElementById('loadingIndicator').classList.remove('hidden');
    try {
        // Fetch data melalui proksi Backend untuk menghindari pemblokiran klien
        const response = await fetch(`/api/vocabularies/${currentUser.id}`);
        const res = await response.json();

        if (!res.success) throw new Error(res.message);

        vocabData = (res.data || []).map(item => ({
            id: item.id, // ID relasi di user_vocabularies
            vocab_id: item.vocabularies.id,
            word: item.vocabularies.word,
            definition: item.vocabularies.definition,
            meaning: item.vocabularies.meaning,
            type: item.vocabularies.type,
            context: item.vocabularies.context,
            level: item.vocabularies.level,
            synonyms: item.vocabularies.synonyms ? (typeof item.vocabularies.synonyms === 'string' ? JSON.parse(item.vocabularies.synonyms) : item.vocabularies.synonyms) : null,
            word_family: item.vocabularies.word_family ? (typeof item.vocabularies.word_family === 'string' ? JSON.parse(item.vocabularies.word_family) : item.vocabularies.word_family) : null,
            verb_forms: item.vocabularies.verb_forms ? (typeof item.vocabularies.verb_forms === 'string' ? JSON.parse(item.vocabularies.verb_forms) : item.vocabularies.verb_forms) : null,
            isMemorized: item.is_memorized,
            createdAt: new Date(item.created_at).getTime()
        }));
        updateUI();
    } catch (error) {
        showMessage("Gagal memuat data: " + error.message, "error");
    } finally {
        document.getElementById('loadingIndicator').classList.add('hidden');
    }
}

window.toggleMemorized = async function(docId, currentStatus) {
    if (!currentUser) return;
    const newStatus = !currentStatus;
    try {
        const res = await supabaseClient.from('user_vocabularies').update({
            is_memorized: newStatus
        }).eq('id', docId);
        if (res.error) throw res.error;

        const item = vocabData.find(v => v.id === docId);
        if (item) item.isMemorized = newStatus;
        updateUI();
    } catch (error) {
        showMessage("Gagal mengubah status.", "error");
    }
};

window.deleteVocab = async function(docId) {
    if (!currentUser) return;
    try {
        // Hanya hapus data dari tabel relasi, bukan dari master dictionary
        const res = await supabaseClient.from('user_vocabularies').delete().eq('id', docId);
        if (res.error) throw res.error;

        vocabData = vocabData.filter(v => v.id !== docId);
        updateUI();
        showMessage("Vocab dihapus.", "info");
    } catch (error) {
        showMessage("Gagal menghapus.", "error");
    }
};

function playGoogleTTS(text, forceLang = null) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    const accentSelect = document.getElementById('accentSelector');
    const lang = forceLang || (accentSelect ? accentSelect.value : 'en-US');
    const encodedText = encodeURIComponent(text.trim());
    if (!encodedText) return;

    const ttsUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=gtx`;
    currentAudio = new Audio(ttsUrl);

    currentAudio.play().catch(error => {
        console.warn("Google TTS API diblokir atau gagal:", error);
        fallbackToNativeTTS(text, lang);
    });
}

function fallbackToNativeTTS(text, lang) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
    }
}

window.speakWord = function(word) {
    playGoogleTTS(word);
};

function getStartOfDay(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

window.setFilter = function(filterType) {
    currentPage = 1;
    currentFilter = filterType;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('tab-active', 'text-gray-800');
        btn.classList.add('text-gray-500');
    });
    const activeTab = document.getElementById('tab-' + filterType);
    if (activeTab) {
        activeTab.classList.add('tab-active', 'text-gray-800');
        activeTab.classList.remove('text-gray-500');
    }
    updateUI();
};

// Fungsi Filter Level via Dropdown
window.changeLevelFilter = function(level) {
    currentPage = 1;
    currentLevelFilter = level;
    updateUI(); // Segarkan tampilan tabel berdasarkan pilihan baru
};

// Fungsi Filter Kategori/Jenis Kata via Dropdown
window.changeCategoryFilter = function(category) {
    currentPage = 1;
    currentCategory = category;
    updateUI(); // Segarkan tampilan tabel berdasarkan pilihan baru
};

function formatDate(ms) {
    if (!ms) return "Baru saja";
    return new Date(ms).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function updateDashboardStats() {
    const totalVocab = vocabData.length;
    const totalMemorized = vocabData.filter(v => v.isMemorized).length;

    // Penguasaan = (Kosakata yang dihafal / Total Kosakata) * 100
    const masteryPercentage = totalVocab > 0 ? Math.round((totalMemorized / totalVocab) * 100) : 0;

    const todayStart = getStartOfDay(new Date());
    const msInDay = 1000 * 60 * 60 * 24;

    let reviewTodayCount = 0;
    let reviewWeekCount = 0;

    vocabData.forEach(item => {
        const itemStartOfDay = getStartOfDay(item.createdAt);
        const diffDays = Math.floor((todayStart - itemStartOfDay) / msInDay);

        if (diffDays === 1) reviewTodayCount++; // Vocab kemarin butuh di-review hari ini
        if (diffDays >= 6 && diffDays <= 8) reviewWeekCount++; // Vocab seminggu lalu
    });

    // Menentukan Level berdasarkan dominasi (modus) level kosakata yang paling sering dipelajari
    let levelCounts = {};
    let topLevel = '-';
    let maxCount = 0;
    vocabData.forEach(v => {
        if (v.level && v.level !== '-') {
            levelCounts[v.level] = (levelCounts[v.level] || 0) + 1;
            if (levelCounts[v.level] > maxCount) {
                maxCount = levelCounts[v.level];
                topLevel = v.level;
            }
        }
    });

    const levelNames = {
        'A1': 'Pemula (A1)',
        'A2': 'Dasar (A2)',
        'B1': 'Menengah (B1)',
        'B2': 'Lanjutan (B2)',
        'C1': 'Mahir (C1)'
    };

    // Kalkulasi Streak (Hari berturut-turut menambahkan kosakata)
    const uniqueDates = [...new Set(vocabData.map(v => getStartOfDay(v.createdAt)))].sort((a, b) => b - a);
    let currentStreak = 0;
    let checkDate = todayStart;

    for (let i = 0; i < uniqueDates.length; i++) {
        if (uniqueDates[i] === checkDate) {
            currentStreak++;
            checkDate -= msInDay; // Mundur satu hari
        } else if (uniqueDates[i] === checkDate - msInDay && currentStreak === 0) {
            // Beri toleransi jika hari ini belum belajar tapi kemarin belajar (streak tetap aman)
            checkDate -= msInDay;
            i--; // Evaluasi ulang tanggal ini
        } else {
            break;
        }
    }

    document.getElementById('statStreak').textContent = currentStreak;
    document.getElementById('statMemorized').textContent = totalMemorized;
    document.getElementById('statTotalVocab').textContent = totalVocab;
    document.getElementById('statReviewToday').textContent = reviewTodayCount;
    document.getElementById('statReviewWeek').textContent = reviewWeekCount;
    document.getElementById('statMastery').textContent = masteryPercentage + '%';
    document.getElementById('statMasteryLevel').textContent = topLevel !== '-' ? 'Level ' + (levelNames[topLevel] || topLevel) : 'Belum ada data';
}

// Fungsi Handler Perubahan Halaman (Pagination)
window.changePage = function(page) {
    if (page < 1) return;
    currentPage = page;
    updateUI();
};

// Fungsi Konstruksi UI Paginasi
function renderPaginationControls(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Tombol Previous (Ditambahkan focus:outline-none untuk menahan border default browser)
    const prevDisabled = currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer';
    html += `<button onclick="changePage(${currentPage - 1})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 transition-colors focus:outline-none ${prevDisabled}" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left text-[10px]"></i></button>`;

    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + 2);

    if (endPage - startPage < 2) {
        startPage = Math.max(1, endPage - 2);
    }

    if (startPage > 1) {
        html += `<button onclick="changePage(1)" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-semibold text-xs transition-colors focus:outline-none">1</button>`;
        if (startPage > 2) {
            html += `<span class="text-gray-400 px-1 text-xs">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 bg-blue-50 font-bold border border-blue-200 text-xs transition-colors focus:outline-none cursor-default">${i}</button>`;
        } else {
            html += `<button onclick="changePage(${i})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-semibold text-xs transition-colors focus:outline-none">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="text-gray-400 px-1 text-xs">...</span>`;
        }
        html += `<button onclick="changePage(${totalPages})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-semibold text-xs transition-colors focus:outline-none">${totalPages}</button>`;
    }

    // Tombol Next
    const nextDisabled = currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer';
    html += `<button onclick="changePage(${currentPage + 1})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 transition-colors focus:outline-none ${nextDisabled}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right text-[10px]"></i></button>`;

    container.innerHTML = html;
}

function updateUI() {
    updateDashboardStats(); // Panggil fungsi hitung statistik agar selalu ter-update

    const container = document.getElementById('vocabListContainer');
    container.innerHTML = '';

    const todayStart = getStartOfDay(new Date());
    const msInDay = 1000 * 60 * 60 * 24;
    let todayCount = 0;

    const searchQuery = document.getElementById('searchBar') ? document.getElementById('searchBar').value.toLowerCase().trim() : '';

    const filteredData = vocabData.filter(item => {
        const itemStartOfDay = getStartOfDay(item.createdAt);
        const diffDays = Math.floor((todayStart - itemStartOfDay) / msInDay);

        if (diffDays === 0) todayCount++;

        if (currentCategory !== 'all') {
            if (!item.type || !item.type.toLowerCase().includes(currentCategory.toLowerCase())) {
                return false;
            }
        }

        if (currentLevelFilter !== 'all') {
            if (!item.level || item.level !== currentLevelFilter) {
                return false;
            }
        }

        if (searchQuery) {
            const matchWord = item.word.toLowerCase().includes(searchQuery);
            const matchMeaning = item.meaning.toLowerCase().includes(searchQuery);
            let matchVerbs = false;

            if (item.verb_forms) {
                const vf = item.verb_forms;
                matchVerbs = (vf.v1 && vf.v1.toLowerCase().includes(searchQuery)) ||
                    (vf.v2 && vf.v2.toLowerCase().includes(searchQuery)) ||
                    (vf.v3 && vf.v3.toLowerCase().includes(searchQuery)) ||
                    (vf.ving && vf.ving.toLowerCase().includes(searchQuery));
            }

            if (!matchWord && !matchMeaning && !matchVerbs) {
                return false;
            }
        }

        if (currentFilter === 'memorized') return item.isMemorized;
        if (currentFilter === 'all') return true;
        if (currentFilter === 'today') return diffDays === 0;
        if (currentFilter === 'yesterday') return diffDays === 1;
        if (currentFilter === 'week') return diffDays >= 6 && diffDays <= 8;
        if (currentFilter === 'month') return diffDays >= 28 && diffDays <= 32;
        return true;
    });

    // Set sumber flashcard selalu pada filter yang aktif saat ini, abaikan pemotongan halaman
    currentFlashcardDeck = [...filteredData];
    document.getElementById('count-today').textContent = todayCount;

    // Hitung variabel Slice Pagination
    const totalFiltered = filteredData.length;
    const totalPages = Math.ceil(totalFiltered / itemsPerPage);

    // Pengaman agar currentPage tidak menunjuk index yang tidak ada
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);

    const paginatedData = filteredData.slice(startIndex, endIndex);

    if (totalFiltered === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'flex flex-col items-center justify-center py-16 text-gray-400 w-full';
        emptyDiv.innerHTML = '<div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><i class="fa-solid fa-folder-open text-3xl text-gray-300"></i></div><p class="text-sm font-medium">Kosakata tidak ditemukan.</p>';
        container.appendChild(emptyDiv);
        document.getElementById('paginationInfo').textContent = `Menampilkan 0 dari total ${vocabData.length} kata`;
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    document.getElementById('paginationInfo').textContent = `Menampilkan ${startIndex + 1}-${endIndex} dari total ${totalFiltered} kata`;
    renderPaginationControls(totalPages);

    // MEMBUAT STRUKTUR TABEL (Sama Persis seperti di Script Asli)
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'w-full overflow-x-auto rounded-xl';

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse min-w-[700px]';

    // Header Tabel
    table.innerHTML = `
            <thead>
                <tr class="text-xs text-gray-400 uppercase tracking-widest font-black">
                    <th class="px-4 py-3 pb-4">Kosakata</th>
                    <th class="px-4 py-3 pb-4 text-center">Level</th>
                    <th class="px-4 py-3 pb-4">Jenis Kata</th>
                    <th class="px-4 py-3 pb-4">Arti</th>
                    <th class="px-4 py-3 pb-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody id="tableBody" class="text-sm"></tbody>
            `;

    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);

    const tbody = table.querySelector('#tableBody');

    // Mengisi Baris Tabel dengan Array Hasil Pagination
    paginatedData.forEach(vocab => {
        const typeClass = typeColors[vocab.type] || 'bg-gray-100 text-gray-700 border-gray-200';

        // Menyesuaikan tampilan row dengan gambar: putih bersih, hover halus
        const memorizedClass = vocab.isMemorized ? 'opacity-60' : 'hover:bg-gray-50/80 transition-colors';

        const levelDisplay = vocab.level ? vocab.level : '-';

        const tr = document.createElement('tr');
        tr.className = `group ${memorizedClass}`;

        tr.innerHTML = `
                <td class="p-4 align-middle">
                    <div class="flex items-center gap-4">
                        <label class="cursor-pointer shrink-0" title="Tandai sudah hafal">
                            <div class="relative flex items-center">
                                <input type="checkbox" class="sr-only" ${vocab.isMemorized ? 'checked' : ''} onchange="toggleMemorized('${vocab.id}', ${vocab.isMemorized})">
                                <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${vocab.isMemorized ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300 group-hover:border-blue-400'}">
                                    <i class="fa-solid fa-check text-white text-[10px] ${vocab.isMemorized ? 'block' : 'hidden'}"></i>
                                </div>
                            </div>
                        </label>
                        <span class="font-black text-base text-gray-900">${vocab.word}</span>
                        <button onclick="speakWord('${vocab.word.replace(/'/g, "\\'")}')" class="text-blue-500 hover:text-white bg-blue-50 hover:bg-blue-600 w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ml-1 shadow-sm" title="Dengarkan kata">
                            <i class="fa-solid fa-volume-high text-xs"></i>
                        </button>
                    </div>
                </td>
                <td class="p-4 align-middle text-center font-bold text-gray-600">
                    ${levelDisplay}
                </td>
                <td class="p-4 align-middle">
                    <span class="inline-block text-[10px] font-bold px-3 py-1 rounded-lg border ${typeClass} uppercase tracking-wider">${vocab.type}</span>
                </td>
                <td class="p-4 align-middle text-gray-600 font-medium truncate max-w-[200px]">
                    ${vocab.meaning}
                </td>
                <td class="p-4 align-middle text-center">
                    <div class="flex items-center justify-center gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button class="text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 w-8 h-8 rounded-lg transition-all detail-btn shadow-sm" title="Lihat Detail Lengkap">
                            <i class="fa-solid fa-book-open text-xs"></i>
                        </button>
                        <button onclick="deleteVocab('${vocab.id}')" class="text-red-500 hover:text-white bg-red-50 hover:bg-red-500 w-8 h-8 rounded-lg transition-all shadow-sm" title="Hapus Kosakata">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
                `;

        // Event listener khusus untuk tombol detail agar objek vocab bisa di-passing
        tr.querySelectorAll('.detail-btn').forEach(btn => btn.addEventListener('click', () => openVocabDetail(vocab)));

        tbody.appendChild(tr);
    });
}

function speakText(text, lang = null) {
    playGoogleTTS(text, lang);
}

function openVocabDetail(vocab) {
    document.getElementById('modalWord').textContent = vocab.word;
    document.getElementById('modalType').textContent = vocab.type;
    document.getElementById('modalMeaning').textContent = vocab.meaning;
    document.getElementById('modalDefinition').textContent = vocab.definition;

    // Tampilkan Level (Default '-' jika data lama belum punya)
    const levelBadge = document.getElementById('modalLevel');
    if (vocab.level) {
        levelBadge.innerHTML = `<i class="fa-solid fa-signal text-yellow-800 mr-1"></i> ${vocab.level}`;
        levelBadge.classList.remove('hidden');
    } else {
        levelBadge.classList.add('hidden');
    }

    // Atur Verb Forms
    const verbSection = document.getElementById('verbFormsSection');
    if (vocab.type && vocab.type.toLowerCase().includes('verb') && vocab.verb_forms) {
        let vf = typeof vocab.verb_forms === 'string' ? JSON.parse(vocab.verb_forms) : vocab.verb_forms;
        document.getElementById('verbV1').textContent = vf.v1 || vocab.word;
        document.getElementById('verbV2').textContent = vf.v2 || '-';
        document.getElementById('verbV3').textContent = vf.v3 || '-';
        document.getElementById('verbVing').textContent = vf.ving || '-';
        verbSection.classList.remove('hidden');
    } else {
        verbSection.classList.add('hidden');
    }

    // Atur Sinonim
    const synContainer = document.getElementById('modalSynonyms');
    synContainer.innerHTML = '';
    if (vocab.synonyms && Array.isArray(vocab.synonyms) && vocab.synonyms.length > 0) {
        vocab.synonyms.forEach(syn => {
            synContainer.innerHTML += `<span class="bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-lg font-bold border border-indigo-100">${syn}</span>`;
        });
    } else {
        synContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Belum ada data sinonim.</span>';
    }

    // Atur Word Family
    const wfContainer = document.getElementById('modalWordFamily');
    wfContainer.innerHTML = '';
    if (vocab.word_family && Array.isArray(vocab.word_family) && vocab.word_family.length > 0) {
        vocab.word_family.forEach(wf => {
            wfContainer.innerHTML += `
                    <div class="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                        <span class="font-bold text-gray-700">${wf.word}</span>
                        <span class="text-[10px] text-purple-600 bg-purple-100 px-2 py-1 rounded-lg font-bold uppercase tracking-wider">${wf.type}</span>
                    </div>
                `;
        });
    } else {
        wfContainer.innerHTML = '<span class="text-xs text-gray-400 italic">Belum ada data keluarga kata.</span>';
    }

    // Atur 5 Contoh Kalimat
    const contextContainer = document.getElementById('modalContextList');
    contextContainer.innerHTML = '';

    if (vocab.context) {
        const sentences = vocab.context.split('\n').filter(s => s.trim() !== '');
        sentences.forEach((sentence, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-start gap-3 p-4 bg-white hover:bg-gray-50 rounded-2xl border border-gray-100 transition-colors group shadow-sm';
            div.innerHTML = `
                    <div class="bg-gray-100 text-gray-500 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">${index + 1}</div>
                    <div class="text-sm text-gray-800 leading-relaxed flex-1 font-medium">
                        ${sentence}
                    </div>
                    <button class="text-blue-500 hover:text-white bg-blue-50 hover:bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm opacity-50 group-hover:opacity-100" title="Dengarkan pengucapan kalimat">
                        <i class="fa-solid fa-volume-high text-xs"></i>
                    </button>
                `;

            const playBtn = div.querySelector('button');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cleanEnglishSentence = sentence.replace(/\(.*?\)/g, '').replace(/^\d+\.\s*/, '').trim();
                speakText(cleanEnglishSentence);
            });

            contextContainer.appendChild(div);
        });
    } else {
        contextContainer.innerHTML = '<p class="text-sm text-gray-400 italic p-3 bg-white rounded-xl border border-gray-100">Tidak ada contoh kalimat.</p>';
    }

    document.getElementById('vocabDetailModal').classList.remove('hidden');
}

function closeVocabDetail() {
    document.getElementById('vocabDetailModal').classList.add('hidden');
    window.speechSynthesis.cancel();
}

// --- Fungsi Modal Contact Us ---
function openContactModal() {
    document.getElementById('contactModal').classList.remove('hidden');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.add('hidden');
}

function openPremiumModal() {
    if (!isProUser) {
        alert("🔒 AKSES DITOLAK!\n\nMateri PDF Eksklusif ini hanya tersedia untuk pengguna PRO. Silakan upgrade paketmu untuk mengunduhnya.");
        return;
    }
    document.getElementById('premiumModal').classList.remove('hidden');
}

function closePremiumModal() {
    document.getElementById('premiumModal').classList.add('hidden');
}

// --- Logika Fitur Export PDF ---
let exportSelection = [];
let currentExportViewData = [];

function openExportModal() {
    if (vocabData.length === 0) {
        showMessage("Belum ada kosakata untuk diexport.", "error");
        return;
    }
    const filterEl = document.getElementById('exportCategoryFilter');
    if (filterEl) filterEl.value = 'all';
    document.getElementById('exportSort').value = 'date-desc';

    exportSelection = vocabData.map(v => v.id);
    renderExportList();
    document.getElementById('exportPdfModal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('exportPdfModal').classList.add('hidden');
}

function toggleSelectAllExport() {
    const visibleIds = currentExportViewData.map(v => v.id);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => exportSelection.includes(id));

    if (allVisibleChecked) {
        exportSelection = exportSelection.filter(id => !visibleIds.includes(id));
        document.getElementById('btnSelectAllExport').textContent = "Pilih Semua";
    } else {
        visibleIds.forEach(id => {
            if (!exportSelection.includes(id)) exportSelection.push(id);
        });
        document.getElementById('btnSelectAllExport').textContent = "Batal Pilih Semua";
    }
    renderExportList();
}

function updateExportSelection(id, isChecked) {
    if (isChecked) {
        if (!exportSelection.includes(id)) exportSelection.push(id);
    } else {
        exportSelection = exportSelection.filter(item => item !== id);
    }

    const visibleIds = currentExportViewData.map(v => v.id);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(vid => exportSelection.includes(vid));
    document.getElementById('btnSelectAllExport').textContent = allVisibleChecked ? "Batal Pilih Semua" : "Pilih Semua";
}

function renderExportList() {
    const listContainer = document.getElementById('exportVocabList');
    const sortVal = document.getElementById('exportSort').value;
    const filterVal = document.getElementById('exportCategoryFilter') ? document.getElementById('exportCategoryFilter').value : 'all';

    listContainer.innerHTML = '';

    let filteredData = vocabData.filter(v => {
        if (filterVal === 'all') return true;
        return v.type && v.type.toLowerCase().includes(filterVal.toLowerCase());
    });

    if (sortVal === 'date-desc') filteredData.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortVal === 'date-asc') filteredData.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortVal === 'alpha-asc') filteredData.sort((a, b) => a.word.localeCompare(b.word));
    else if (sortVal === 'alpha-desc') filteredData.sort((a, b) => b.word.localeCompare(a.word));
    else if (sortVal === 'type-asc') filteredData.sort((a, b) => a.type.localeCompare(b.type) || a.word.localeCompare(b.word));
    else if (sortVal === 'type-desc') filteredData.sort((a, b) => b.type.localeCompare(a.type) || a.word.localeCompare(b.word));

    currentExportViewData = filteredData;

    const visibleIds = currentExportViewData.map(v => v.id);
    const allVisibleChecked = visibleIds.length > 0 && visibleIds.every(id => exportSelection.includes(id));
    document.getElementById('btnSelectAllExport').textContent = allVisibleChecked ? "Batal Pilih Semua" : "Pilih Semua";

    if (filteredData.length === 0) {
        listContainer.innerHTML = '<p class="text-sm text-gray-400 text-center py-4 font-medium">Tidak ada kosakata pada kategori ini.</p>';
        return;
    }

    filteredData.forEach(vocab => {
        const isChecked = exportSelection.includes(vocab.id) ? 'checked' : '';
        const div = document.createElement('div');
        div.className = 'flex items-center gap-3 p-3 hover:bg-gray-100 bg-white rounded-xl border border-gray-200 transition-colors shadow-sm';
        div.innerHTML = `
                <input type="checkbox" id="exp-${vocab.id}" class="export-checkbox w-4 h-4 text-blue-600 rounded cursor-pointer border-gray-300" ${isChecked} onchange="updateExportSelection('${vocab.id}', this.checked)">
                <label for="exp-${vocab.id}" class="flex-1 cursor-pointer select-none">
                    <div class="font-bold text-gray-800 text-sm">${vocab.word} <span class="text-[10px] text-blue-600 font-black ml-1 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded">${vocab.type}</span></div>
                    <div class="text-xs text-gray-500 truncate mt-1 font-medium">${vocab.meaning}</div>
                </label>
            `;
        listContainer.appendChild(div);
    });
}

function generatePDF() {
    let finalData = currentExportViewData.filter(v => exportSelection.includes(v.id));

    if (finalData.length === 0) {
        showMessage("Pilih setidaknya 1 kosakata pada kategori ini untuk diexport.", "error");
        return;
    }

    const {
        jsPDF
    } = window.jspdf;
    const doc = new jsPDF();
    const sortVal = document.getElementById('exportSort').value;

    if (sortVal === 'date-desc') finalData.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortVal === 'date-asc') finalData.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortVal === 'alpha-asc') finalData.sort((a, b) => a.word.localeCompare(b.word));
    else if (sortVal === 'alpha-desc') finalData.sort((a, b) => b.word.localeCompare(a.word));
    else if (sortVal === 'type-asc') finalData.sort((a, b) => a.type.localeCompare(b.type) || a.word.localeCompare(b.word));
    else if (sortVal === 'type-desc') finalData.sort((a, b) => b.type.localeCompare(a.type) || a.word.localeCompare(b.word));

    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("VocabMaster PRO - Daftar Kosakata", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    const username = document.getElementById('displayUsername').textContent;
    const dateStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    doc.text(`Dicetak oleh: ${username} | Tanggal: ${dateStr}`, 14, 30);

    const filterEl = document.getElementById('exportCategoryFilter');
    const categoryLabel = filterEl && filterEl.value !== 'all' ? filterEl.options[filterEl.selectedIndex].text : "Semua Kategori";
    doc.text(`Kategori: ${categoryLabel} | Total: ${finalData.length} Kata`, 14, 36);

    const tableColumn = ["No", "Kosakata (Word)", "Jenis Kata", "Arti (Meaning)"];
    const tableRows = [];

    finalData.forEach((vocab, index) => {
        tableRows.push([index + 1, vocab.word, vocab.type, vocab.meaning]);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 42,
        theme: 'grid',
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 3
        },
        headStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [243, 244, 246]
        },
        columnStyles: {
            0: {
                cellWidth: 12,
                halign: 'center'
            },
            1: {
                cellWidth: 50,
                fontStyle: 'bold',
                textColor: [31, 41, 55]
            },
            2: {
                cellWidth: 35,
                fontStyle: 'italic',
                textColor: [59, 130, 246]
            },
            3: {
                cellWidth: 'auto'
            }
        }
    });

    const fileName = `VocabMaster_${categoryLabel.split(' ')[0]}_${dateStr.replace(/ /g, '_')}.pdf`;
    doc.save(fileName);

    closeExportModal();
    showMessage("File PDF berhasil diunduh!", "success");
}

// --- Logika Flashcard ---
function startFlashcard() {
    if (currentFlashcardDeck.length === 0) {
        showMessage("Tidak ada kosakata pada tab/kategori ini untuk dilatih.", "error");
        return;
    }

    currentFlashcardDeck = currentFlashcardDeck.sort(() => Math.random() - 0.5);
    currentFlashcardIndex = 0;

    document.getElementById('flashcardModal').classList.remove('hidden');
    renderFlashcardCard();
}

function closeFlashcard() {
    document.getElementById('flashcardModal').classList.add('hidden');
    updateUI();
}

function renderFlashcardCard() {
    const fcCard = document.getElementById('fcCard');
    const btnHafal = document.getElementById('fcBtnHafal');
    const btnNext = document.getElementById('fcBtnNext');

    if (currentFlashcardIndex >= currentFlashcardDeck.length) {
        document.getElementById('fcFront').innerHTML = `
                <div class="text-center flex flex-col items-center mt-10">
                    <div class="bg-yellow-100 text-yellow-500 w-24 h-24 rounded-full flex items-center justify-center mb-6 text-5xl shadow-inner">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <h3 class="text-3xl font-black text-gray-800">Selesai!</h3>
                    <p class="text-gray-500 text-sm mt-2 font-medium">Kamu telah mereview semua kosakata di sesi ini.</p>
                </div>
            `;
        fcCard.style.transform = 'rotateY(0deg)';
        fcCard.onclick = null;
        btnHafal.classList.add('hidden');
        btnHafal.classList.remove('flex');

        btnNext.innerHTML = '<i class="fa-solid fa-check"></i> Tutup Latihan';
        btnNext.onclick = closeFlashcard;
        return;
    }

    const vocab = currentFlashcardDeck[currentFlashcardIndex];
    document.getElementById('fcCounter').textContent = `${currentFlashcardIndex + 1} / ${currentFlashcardDeck.length}`;
    document.getElementById('fcWord').textContent = vocab.word;
    document.getElementById('fcType').textContent = vocab.type;
    document.getElementById('fcMeaning').textContent = vocab.meaning;

    const contextContainer = document.getElementById('fcContext');
    if (vocab.context) {
        contextContainer.innerHTML = vocab.context.split('\n')
            .filter(s => s.trim() !== '')
            .map((s, i) => `<p><span class="text-blue-300 font-bold">${i+1}.</span> ${s}</p>`)
            .join('');
    } else {
        contextContainer.innerHTML = '<p class="text-white/50 italic">Tidak ada contoh kalimat.</p>';
    }

    fcCard.style.transform = 'rotateY(0deg)';
    fcCard.onclick = flipFlashcard;
    isFlashcardFlipped = false;

    btnHafal.classList.add('hidden');
    btnHafal.classList.remove('flex');

    btnNext.innerHTML = 'Lihat Arti <i class="fa-solid fa-rotate"></i>';
    btnNext.onclick = flipFlashcard;
}

function flipFlashcard() {
    if (currentFlashcardIndex >= currentFlashcardDeck.length) return;

    const fcCard = document.getElementById('fcCard');
    const btnHafal = document.getElementById('fcBtnHafal');
    const btnNext = document.getElementById('fcBtnNext');

    if (!isFlashcardFlipped) {
        fcCard.style.transform = 'rotateY(180deg)';
        isFlashcardFlipped = true;

        const vocab = currentFlashcardDeck[currentFlashcardIndex];
        btnHafal.classList.remove('hidden');
        btnHafal.classList.add('flex');

        if (vocab.isMemorized) {
            btnHafal.innerHTML = '<i class="fa-solid fa-times"></i> Batal Hafal';
            btnHafal.className = 'flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl transition-all items-center justify-center gap-2 flex shadow-lg shadow-amber-500/30';
        } else {
            btnHafal.innerHTML = '<i class="fa-solid fa-check-circle"></i> Sudah Hafal';
            btnHafal.className = 'flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all items-center justify-center gap-2 flex shadow-lg shadow-emerald-500/30';
        }

        btnNext.innerHTML = 'Lanjut <i class="fa-solid fa-arrow-right"></i>';
        btnNext.onclick = nextFlashcard;
    } else {
        fcCard.style.transform = 'rotateY(0deg)';
        isFlashcardFlipped = false;

        btnHafal.classList.add('hidden');
        btnHafal.classList.remove('flex');

        btnNext.innerHTML = 'Lihat Arti <i class="fa-solid fa-rotate"></i>';
        btnNext.onclick = flipFlashcard;
    }
}

function nextFlashcard() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    currentFlashcardIndex++;
    renderFlashcardCard();
}

async function markFlashcardMemorized() {
    const vocab = currentFlashcardDeck[currentFlashcardIndex];
    const newStatus = !vocab.isMemorized;
    const btnHafal = document.getElementById('fcBtnHafal');
    const originalHTML = btnHafal.innerHTML;

    btnHafal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btnHafal.disabled = true;

    try {
        const res = await supabaseClient.from('user_vocabularies').update({
            is_memorized: newStatus
        }).eq('id', vocab.id);
        if (res.error) throw res.error;

        vocab.isMemorized = newStatus;
        const globalVocab = vocabData.find(v => v.id === vocab.id);
        if (globalVocab) globalVocab.isMemorized = newStatus;

        nextFlashcard();
    } catch (error) {
        showMessage("Gagal menyimpan status hafalan ke server.", "error");
        btnHafal.innerHTML = originalHTML;
    } finally {
        btnHafal.disabled = false;
    }
}

// --- Logika Profil & Komunitas ---
let currentUserAge = 0;
let isProUser = false;
let userGrammarQuota = 5;
let userTranslatorQuota = 5;

function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
}

async function loadUserProfile() {
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];

    try {
        // Fetch profil melalui proksi Backend
        const response = await fetch(`/api/profile/${currentUser.id}`);
        const res = await response.json();

        if (res.success && res.data) {
            const data = res.data;
            document.getElementById('displayUsername').textContent = data.username || defaultName;
            document.getElementById('welcomeName').textContent = data.username || defaultName;
            document.getElementById('profileUsername').value = data.username || '';
            document.getElementById('profileDob').value = data.dob || '';

            // --- PAYWALL LOGIC: Cek Status PRO & Expired ---
            userGrammarQuota = data.grammar_quota ?? 5;
            userTranslatorQuota = data.translator_quota ?? 5;
            isProUser = false;

            if (data.pro_expired_at) {
                const expiredDate = new Date(data.pro_expired_at);
                const today = new Date();

                if (expiredDate > today) {
                    isProUser = true; // Status masih aktif
                } else {
                    isProUser = false;
                    // Fallback jika ingin update status ke db, biarkan via supabase client untuk sementara 
                    // atau pindahkan ke backend di iterasi selanjutnya
                    await supabaseClient.from('profiles').update({
                        pro_expired_at: null
                    }).eq('id', currentUser.id);

                    setTimeout(() => {
                        showMessage("Masa aktif PRO berakhir. Status kembali ke Free.", "info");
                    }, 1500);
                }
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

            if (data.dob) {
                const birthDate = new Date(data.dob);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                currentUserAge = age;
            }
        } else {
            throw new Error("Data tidak ditemukan");
        }
    } catch (error) {
        document.getElementById('displayUsername').textContent = defaultName;
        document.getElementById('welcomeName').textContent = defaultName;
        document.getElementById('profileUsername').value = '';
        document.getElementById('profileDob').value = '';
        currentUserAge = 0;
        isProUser = false;
        console.error("Gagal memuat profil:", error);
    }
}

// Simpan Profil
document.getElementById('profileForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('profileUsername');
    const dobInput = document.getElementById('profileDob');
    const passwordInput = document.getElementById('profilePassword');
    const statusMsg = document.getElementById('profileStatusMsg');

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

    // Cek apakah username unik
    const {
        data: existing
    } = await supabaseClient
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

    try {
        // Gunakan UPDATE langsung berdasarkan ID user yang sedang aktif login
        const {
            error
        } = await supabaseClient
            .from('profiles')
            .update({
                username: username,
                dob: dob
            })
            .eq('id', currentUser.id);

        if (error) throw error;

        if (newPassword) {
            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
            if (!passwordPattern.test(newPassword)) {
                statusMsg.className = 'text-sm p-3 rounded-xl border bg-red-50 text-red-700 font-medium';
                statusMsg.textContent = 'Password baru minimal 8 karakter, ada huruf besar, kecil, angka, & simbol.';
                statusMsg.classList.remove('hidden');
                return;
            }
            await supabaseClient.auth.updateUser({
                password: newPassword
            });
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

function openUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
}

async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    // 1. Ambil kode referral dari URL atau LocalStorage
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

    // Jika ada di URL, simpan ke LocalStorage agar tidak hilang saat user pindah halaman
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
                referralCode: refCode // --> KIRIM KE BACKEND
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

// Implementasi Fitur Drag-to-Scroll untuk Desktop
const tabContainer = document.getElementById('tabContainer');
let isDown = false;
let startX;
let scrollLeft;

if (tabContainer) {
    // Ubah kursor menjadi 'grab' (tangan terbuka) secara default
    tabContainer.style.cursor = 'grab';

    tabContainer.addEventListener('mousedown', (e) => {
        isDown = true;
        // Ubah kursor menjadi 'grabbing' (tangan menggenggam) saat diklik
        tabContainer.style.cursor = 'grabbing';

        // Kalkulasi posisi awal kursor relatif terhadap elemen
        startX = e.pageX - tabContainer.offsetLeft;
        scrollLeft = tabContainer.scrollLeft;
    });

    tabContainer.addEventListener('mouseleave', () => {
        isDown = false;
        tabContainer.style.cursor = 'grab';
    });

    tabContainer.addEventListener('mouseup', () => {
        isDown = false;
        tabContainer.style.cursor = 'grab';
    });

    tabContainer.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault(); // Mencegah blok teks ter-highlight secara tidak sengaja

        const x = e.pageX - tabContainer.offsetLeft;
        const walk = (x - startX) * 2; // Angka 2 adalah kecepatan scroll (bisa disesuaikan)
        tabContainer.scrollLeft = scrollLeft - walk;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        // Amankan ke LocalStorage agar tidak hilang
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        // Jika tidak ada di URL, ambil dari LocalStorage
        refCode = localStorage.getItem('vocab_ref_code');
    }

    if (refCode && refCode !== 'NONE') {
        // Tempelkan parameter ?ref= ke seluruh link menu internal (.html atau route tanpa ekstensi)
        document.querySelectorAll('a').forEach(anchor => {
            let href = anchor.getAttribute('href');
            // Hanya ubah link internal (yang dimulai dengan '/' atau tidak memiliki protokol http)
            if (href && (href.startsWith('/') || (!href.startsWith('http') && !href.startsWith('#')))) {
                // Bersihkan query lama jika ada, lalu pasang ref yang aktif
                const baseUrl = href.split('?')[0];
                anchor.href = `${baseUrl}?ref=${encodeURIComponent(refCode)}`;
            }
        });

        // Lakukan hal yang sama untuk tombol menu mobile dropdown (tag <button onclick="...">)
        document.querySelectorAll('#mobileDropdown button[onclick]').forEach(btn => {
            let onclickAttr = btn.getAttribute('onclick');
            if (onclickAttr && onclickAttr.includes('window.location.href=')) {
                // Ekstrak URL di dalam onclick
                const match = onclickAttr.match(/window\.location\.href=['"]([^'"]+)['"]/);
                if (match) {
                    let targetUrl = match[1].split('?')[0];
                    btn.setAttribute('onclick', `window.location.href='${targetUrl}?ref=${encodeURIComponent(refCode)}'`);
                }
            }
        });
    }
});
