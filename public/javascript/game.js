// ==========================================
// 1. DATA & STATE MANAGEMENT
// ==========================================
const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- PROTEKSI HALAMAN GAME ---
supabaseClient.auth.onAuthStateChange(async function(event, session) {
    if (!session) {
        window.location.replace('/auth');
        return;
    }

    if (session.user && !session.user.email_confirmed_at) {
        alert("Harap verifikasi email Anda terlebih dahulu. Silakan cek kotak masuk email Anda.");
        await supabaseClient.auth.signOut();
        window.location.replace('/auth');
        return;
    }

    // Update inisial user di header sudut kanan atas
    const userInitialEl = document.getElementById('userInitial');
    if (userInitialEl) {
        userInitialEl.textContent = session.user.email.charAt(0).toUpperCase();
    }
});

// Pengecekan kilat saat halaman pertama kali dimuat
(async() => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('/auth');
    }
})();

// Kumpulan Kosakata Utama (Diambil dari Supabase/Database)
let masterVocab = [];
let allVocabPool = []; // Untuk mengambil jawaban salah acak

// Data Dummy sebagai Fallback jika koneksi gagal / belum login
const mockData = [
    { word: "abandon", meaning: "meninggalkan", type: "Verb", context: "Do not abandon the project." },
    { word: "capability", meaning: "kemampuan", type: "Noun", context: "She has the capability to lead." },
    { word: "biodiversity", meaning: "keanekaragaman hayati", type: "Noun", context: "Protecting biodiversity is vital." },
    { word: "carpenter", meaning: "tukang kayu", type: "Noun", context: "The carpenter fixed the table." },
    { word: "overwhelmed", meaning: "kewalahan", type: "Adjective", context: "I feel overwhelmed with work." },
    { "word": "proud", "meaning": "bangga", "type": "Adjective", "context": "I am proud of you." },
    { "word": "certificate", "meaning": "ijazah", "type": "Noun", "context": "He received his graduation certificate." },
    { "word": "spicy", "meaning": "pedas", "type": "Adjective", "context": "This food is very spicy." },
    { "word": "sweet", "meaning": "manis", "type": "Adjective", "context": "The pudding is sweet." },
    { "word": "stubborn", "meaning": "keras kepala", "type": "Adjective", "context": "Don't be so stubborn." }
];

// Definisi 11 Mode Game
const GAMES = [
    { id: 'g1', name: 'Teka Kata', desc: 'Isi huruf yang hilang berdasarkan arti bahasa Indonesia. Ketik menggunakan keyboard.', icon: 'fa-table-cells', color: 'bg-emerald-500' },
    { id: 'g2', name: 'Lengkapi Kalimat', desc: 'Pilih kosakata yang tepat untuk melengkapi kalimat rumpang bahasa Inggris.', icon: 'fa-pen-clip', color: 'bg-blue-500' },
    { id: 'g3', name: 'Memori Pasangan', desc: 'Buka dan cocokkan kartu bahasa Inggris dengan arti bahasa Indonesianya.', icon: 'fa-clone', color: 'bg-purple-500' },
    { id: 'g4', name: 'Acak Huruf', desc: 'Susun huruf acak menjadi kosakata bahasa Inggris yang benar berdasarkan petunjuk arti.', icon: 'fa-font', color: 'bg-orange-500' },
    { id: 'g5', name: 'Hubung Kata', desc: 'Pilih kata di kiri, lalu pilih artinya di kanan untuk menghubungkan mereka.', icon: 'fa-link', color: 'bg-teal-500' },
    { id: 'g6', name: 'Sandi Warna', desc: 'Tebak kata dalam 5 kesempatan. Hijau: Benar. Kuning: Pindah Posisi. Abu: Salah.', icon: 'fa-border-all', color: 'bg-rose-500' },
    { id: 'g7', name: 'Hujan Ketik', desc: 'Ketik kosakata bahasa Inggris sebelum arti Indonesianya menyentuh tanah.', icon: 'fa-cloud-showers-heavy', color: 'bg-cyan-500' },
    { id: 'g8', name: 'Kuis Meteor', desc: 'Pilih terjemahan yang benar di bawah sebelum meteor arti menyentuh batas.', icon: 'fa-meteor', color: 'bg-indigo-500' },
    { id: 'g9', name: 'Tembak Gelembung', desc: 'Pecahkan gelembung yang berisi kosakata bahasa Inggris yang tepat sesuai petunjuk.', icon: 'fa-circle-dot', color: 'bg-pink-500' },
    { id: 'g10', name: 'Kuis Makna', desc: 'Pilih kosakata yang tepat berdasarkan definisi (makna) bahasa Inggrisnya.', icon: 'fa-book-open', color: 'bg-yellow-500' },
    { id: 'g11', name: 'Ucap Kata', desc: 'Baca arti Indonesia, lalu ucapkan bahasa Inggrisnya menggunakan mikrofon.', icon: 'fa-microphone', color: 'bg-red-500' }
];

// State Engine Game Aktif
let currentGameId = null;
let gameState = {
    queue: [], // Antrean vocab untuk sesi ini
    currentIndex: 0,
    score: 0,
    mistakes: [], // Array of vocab object yang salah dijawab
    lives: 3,
    maxLives: 3,
    isActive: false,
    timer: null, // Untuk setInterval/Timeout
    animationFrame: null // Untuk requestAnimationFrame
};

// ==========================================
// 2. UTILITAS & HELPERS
// ==========================================

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

// Ambil N jawaban salah (Distractor) dari pool
function getWrongOptions(correctWord, count) {
    let pool = allVocabPool.filter(v => v.word !== correctWord);
    shuffleArray(pool);
    let wrongWords = pool.slice(0, count).map(v => v.word);
    // Fallback generator jika data tidak cukup
    while (wrongWords.length < count) {
        wrongWords.push("dummy" + Math.floor(Math.random() * 1000));
    }
    return wrongWords;
}

// Text-to-Speech (TTS) Wrapper
function playTTS(text, lang = 'en-US') {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toastMessage');
    toast.textContent = msg;
    toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all duration-300 transform`;

    if (type === 'success') toast.classList.add('bg-emerald-500');
    else if (type === 'error') toast.classList.add('bg-red-500');
    else toast.classList.add('bg-blue-500');

    toast.classList.remove('-translate-y-24', 'opacity-0');

    setTimeout(() => {
        toast.classList.add('-translate-y-24', 'opacity-0');
    }, 3000);
}

// ==========================================
// 3. FSM UI CONTROLLERS
// ==========================================

function renderMenu() {
    const grid = document.getElementById('gameGrid');
    grid.innerHTML = '';
    GAMES.forEach(g => {
        grid.innerHTML += `
                    <div onclick="selectGame('${g.id}')" class="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden">
                        <div class="absolute -right-4 -top-4 w-24 h-24 ${g.color} opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform"></div>
                        <div class="w-14 h-14 ${g.color} text-white rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-md">
                            <i class="fa-solid ${g.icon}"></i>
                        </div>
                        <h3 class="text-xl font-black text-slate-800 mb-2">${g.name}</h3>
                        <p class="text-sm text-slate-500 font-medium leading-snug">${g.desc}</p>
                    </div>
                `;
    });
}

function showScreen(screenName) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden', 'flex'));
    document.querySelectorAll('main > section').forEach(s => s.classList.remove('flex'));

    const target = document.getElementById(`screen-${screenName}`);
    if (target) {
        target.classList.remove('hidden');
        if (screenName !== 'menu') target.classList.add('flex');
    }
}

function selectGame(id) {
    if (masterVocab.length < 5) {
        showToast("Daftar kosakatamu minimal harus 5 kata untuk bermain.", "error");
        return;
    }
    currentGameId = id;
    const game = GAMES.find(g => g.id === id);

    document.getElementById('inst-title').textContent = game.name;
    document.getElementById('inst-desc').textContent = game.desc;
    document.getElementById('inst-icon').className = `w-24 h-24 mx-auto rounded-3xl mb-6 flex items-center justify-center text-5xl text-white shadow-lg ${game.color}`;
    document.getElementById('inst-icon').innerHTML = `<i class="fa-solid ${game.icon}"></i>`;

    showScreen('instruction');
}

// ==========================================
// 4. GAME ENGINE CORE LOGIC
// ==========================================

function startGameEngine() {
    // Setup Session Data
    let baseQueue = shuffleArray([...masterVocab]).slice(0, 15);

    if (currentGameId === 'g2' && baseQueue.length < 15) {
        let needed = 15 - baseQueue.length;
        let extraQueue = [];

        for (let i = 0; i < needed; i++) {
            // Ambil kosakata acak dari baseQueue untuk diduplikasi
            extraQueue.push(baseQueue[Math.floor(Math.random() * baseQueue.length)]);
        }
        // Gabungkan queue awal dengan queue duplikasi lalu acak ulang
        gameState.queue = shuffleArray([...baseQueue, ...extraQueue]);
    } else {
        gameState.queue = baseQueue; // Normal untuk game lain
    }

    gameState.currentIndex = 0;
    gameState.score = 0;
    gameState.mistakes = [];
    gameState.lives = 3;
    gameState.isActive = true;
    gameState.usedContexts = {};

    const gameConfig = GAMES.find(g => g.id === currentGameId);
    document.getElementById('hud-game-title').textContent = gameConfig.name;

    // Konfigurasi Nyawa HUD
    const livesContainer = document.getElementById('hud-lives-container');
    if (['g6', 'g7', 'g8'].includes(currentGameId)) {
        livesContainer.classList.remove('invisible');
        updateLivesHUD();
    } else {
        livesContainer.classList.add('invisible'); // Game tanpa sistem nyawa (hanya true/false next)
    }

    showScreen('gameplay');
    loadNextQuestion();
}

function updateLivesHUD() {
    const container = document.getElementById('hud-lives');
    container.innerHTML = '';
    for (let i = 0; i < gameState.maxLives; i++) {
        if (i < gameState.lives) container.innerHTML += '<i class="fa-solid fa-heart"></i>';
        else container.innerHTML += '<i class="fa-solid fa-heart text-slate-600"></i>';
    }
}

function updateProgressHUD() {
    document.getElementById('hud-progress').textContent = `${gameState.currentIndex + 1} / ${gameState.queue.length}`;
}

function handleMistake(vocab) {
    if (!gameState.mistakes.find(m => m.word === vocab.word)) {
        gameState.mistakes.push(vocab);
    }
    if (!['g1', 'g4', 'g6'].includes(currentGameId)) {
        // Game selain yg butuh multi-try akan langsung mengurangi nyawa (jika mode ber-nyawa)
        if (!document.getElementById('hud-lives-container').classList.contains('invisible')) {
            gameState.lives--;
            updateLivesHUD();
            if (gameState.lives <= 0) {
                setTimeout(endGameSession, 1000);
            }
        }
    }
}

function handleCorrect(vocab) {
    playTTS(vocab.word);
    gameState.score++;
}

function clearEngines() {
    clearInterval(gameState.timer);
    clearTimeout(gameState.timer);
    cancelAnimationFrame(gameState.animationFrame);
    if (window.speechRec) window.speechRec.abort(); // Matikan mic jika ada
    const canvas = document.getElementById('game-canvas');
    canvas.innerHTML = '';
    // Lepas listener keyboard global
    window.onkeydown = null;
}

function loadNextQuestion() {
    clearEngines();

    if (gameState.currentIndex >= gameState.queue.length) {
        endGameSession();
        return;
    }

    updateProgressHUD();
    const vocab = gameState.queue[gameState.currentIndex];
    if (!vocab) {
        proceedNext();
        return;
    }
    const canvas = document.getElementById('game-canvas');

    // ROUTING KE LOGIKA GAME SPESIFIK
    switch (currentGameId) {
        case 'g1':
            initGame1(canvas, vocab);
            break;
        case 'g2':
            initGame2(canvas, vocab);
            break;
        case 'g3':
            initGame3(canvas);
            break; // Game 3 memproses batch, abaikan currentIndex
        case 'g4':
            initGame4(canvas, vocab);
            break;
        case 'g5':
            initGame5(canvas);
            break; // Game 5 memproses batch
        case 'g6':
            initGame6(canvas, vocab);
            break;
        case 'g7':
            initGame7(canvas);
            break; // Kontinu drop
        case 'g8':
            initGame8(canvas, vocab);
            break;
        case 'g9':
            initGame9(canvas, vocab);
            break;
        case 'g10':
            initGame10(canvas, vocab);
            break;
        case 'g11':
            initGame11(canvas, vocab);
            break;
    }
}

function proceedNext() {
    gameState.currentIndex++;
    setTimeout(loadNextQuestion, 1200); // Jeda sebelum soal berikutnya
}

function pauseGame() {
    gameState.isActive = false;
    document.getElementById('modal-pause').classList.remove('hidden');
    document.getElementById('modal-pause').classList.add('flex');
}

function resumeGame() {
    gameState.isActive = true;
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-pause').classList.remove('flex');
}

function exitGame() {
    clearEngines();
    document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('modal-pause').classList.remove('flex');
    showScreen('menu');
}

function endGameSession() {
    clearEngines();

    // Hitung Akurasi
    let playedCount = Math.min(gameState.currentIndex, gameState.queue.length);
    if (currentGameId === 'g3' || currentGameId === 'g5' || currentGameId === 'g7') playedCount = gameState.queue.length; // Batch games

    let accuracy = playedCount === 0 ? 0 : Math.round((gameState.score / playedCount) * 100);
    if (accuracy > 100) accuracy = 100;

    document.getElementById('res-accuracy').textContent = `${accuracy}%`;

    const mistList = document.getElementById('mistakes-list');
    const mistContainer = document.getElementById('mistakes-container');

    if (gameState.mistakes.length > 0) {
        mistContainer.classList.remove('hidden');
        mistList.innerHTML = gameState.mistakes.map(m => `
                    <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100 shadow-sm">
                        <div>
                            <div class="font-black text-slate-800">${m.word}</div>
                            <div class="text-xs font-medium text-slate-500">${m.meaning}</div>
                        </div>
                        <button onclick="playTTS('${m.word}')" class="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-colors">
                            <i class="fa-solid fa-volume-high text-xs"></i>
                        </button>
                    </div>
                `).join('');
    } else {
        mistContainer.classList.add('hidden');
    }

    showScreen('result');
}

// ==========================================
// 5. IMPLEMENTASI MINI-GAMES SPESIFIK
// ==========================================

// GAME 1: Teka Kata (Guess Word w/ Keyboard)
function initGame1(canvas, vocab) {
    let targetWord = vocab.word.toUpperCase();

    canvas.innerHTML = `
        <div class="w-full max-w-lg text-center flex flex-col items-center cursor-pointer" onclick="document.getElementById('hidden-input-g1').focus()">
            <div class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold mb-8 shadow-lg text-xl tracking-wide w-full">
                ${vocab.meaning}
            </div>
            <div id="g1-boxes" class="flex justify-center gap-2 mb-4 flex-wrap">
                ${Array(targetWord.length).fill(0).map(() => `<div class="w-12 h-14 border-b-4 border-slate-600 bg-slate-800 text-white text-3xl font-black flex items-center justify-center rounded-t-xl transition-all"></div>`).join('')}
            </div>
            <div class="text-slate-400 text-sm font-medium animate-pulse">
                <i class="fa-solid fa-hand-pointer"></i> Ketuk area ini untuk memunculkan keyboard
            </div>
            <!-- Input tersembunyi untuk memancing keyboard HP -->
            <input type="text" id="hidden-input-g1" class="absolute opacity-0 -z-10" autocomplete="off" spellcheck="false" maxlength="${targetWord.length}">
        </div>
    `;

    const inputElement = document.getElementById('hidden-input-g1');
    const boxes = document.getElementById('g1-boxes').children;
    
    setTimeout(() => inputElement.focus(), 100); // Auto focus di awal

    inputElement.addEventListener('input', (e) => {
        if(!gameState.isActive) return;
        let val = e.target.value.toUpperCase();
        let correctCount = 0;

        for (let i = 0; i < targetWord.length; i++) {
            let char = val[i] || "";
            boxes[i].textContent = char;
            
            if (char === "") {
                boxes[i].className = "w-12 h-14 border-b-4 border-slate-600 bg-slate-800 text-white text-3xl font-black flex items-center justify-center rounded-t-xl";
            } else if (char === targetWord[i]) {
                // Huruf Benar -> Hijau
                boxes[i].className = "w-12 h-14 border-b-4 border-emerald-500 bg-emerald-600 text-white text-3xl font-black flex items-center justify-center rounded-t-xl";
                correctCount++;
            } else {
                // Huruf Salah -> Merah
                boxes[i].className = "w-12 h-14 border-b-4 border-red-500 bg-red-600 text-white text-3xl font-black flex items-center justify-center rounded-t-xl";
            }
        }

        if (correctCount === targetWord.length) {
            inputElement.disabled = true;
            handleCorrect(vocab);
            proceedNext();
        } else if (val.length === targetWord.length && correctCount !== targetWord.length) {
            handleMistake(vocab);
            document.getElementById('g1-boxes').classList.add('animate-shake');
            setTimeout(() => document.getElementById('g1-boxes').classList.remove('animate-shake'), 400);
        }
    });
}

// GAME 2: Lengkapi Kalimat
function initGame2(canvas, vocab) {
    // 1. Pisahkan kalimat berdasarkan baris baru/nomor
    let contextData = vocab.context || `The answer is ${vocab.word}.`;
    let contextList = contextData.split('\n').filter(c => c.trim() !== '');
    
    // TAMBAHKAN: Mekanisme pelacakan kalimat agar kalimat yang sama tidak keluar dua kali
    if (!gameState.usedContexts[vocab.word]) {
        gameState.usedContexts[vocab.word] = [];
    }
    
    let used = gameState.usedContexts[vocab.word];
    // Filter kalimat yang belum pernah dipakai
    let availableContexts = contextList.filter(c => !used.includes(c));

    // Jika seluruh kalimat dari suatu kata sudah habis (edge case), reset filter
    if (availableContexts.length === 0) {
        availableContexts = contextList;
    }

    // 2. Ambil 1 kalimat secara acak dari himpunan kalimat yang tersedia (available)
    let randomContext = availableContexts[Math.floor(Math.random() * availableContexts.length)];
    gameState.usedContexts[vocab.word].push(randomContext); // Tandai kalimat ini sebagai terpakai
    
    // 3. Bersihkan angka (1., 2.) di depan dan arti di dalam kurung ( )
    let cleanedContext = randomContext
        .replace(/^\d+\.\s*/, '')      
        .replace(/\s*\([^)]*\)/g, '');

    // Ganti vocab.context dengan cleanedContext
    let sentence = cleanedContext;
    
    // Censor the word
    let regex = new RegExp(vocab.word, 'gi');
    let displaySentence = sentence.replace(regex, "_________");

    let options = shuffleArray([vocab.word, ...getWrongOptions(vocab.word, 3)]);

    canvas.innerHTML = `
        <div class="w-full max-w-2xl text-center overflow-y-auto max-h-[60vh]">
            <div class="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-8">
                <p class="text-2xl lg:text-3xl font-bold text-slate-800 leading-relaxed">${displaySentence}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                ${options.map(opt => `
                    <button onclick="checkGame2(this, '${opt}', '${vocab.word}')" class="g2-btn bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold py-6 rounded-2xl shadow-md transition-all active:scale-95">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    window.checkGame2 = function(btn, selected, correct) {
        if(!gameState.isActive) return;
        document.querySelectorAll('.g2-btn').forEach(b => b.disabled = true); // Lock

        if(selected === correct) {
            btn.classList.replace('bg-blue-600', 'bg-emerald-500');
            btn.classList.replace('hover:bg-blue-700', 'bg-emerald-500');
            handleCorrect(vocab);
            proceedNext();
        } else {
            btn.classList.replace('bg-blue-600', 'bg-red-500');
            btn.classList.add('animate-shake');
            handleMistake(vocab);
            // Find correct and highlight
            document.querySelectorAll('.g2-btn').forEach(b => {
                if(b.textContent.trim() === correct) {
                    b.classList.replace('bg-blue-600', 'bg-emerald-500');
                }
            });
            setTimeout(proceedNext, 2000);
        }
    }
}

// GAME 3: Memori Pasangan (Matching Pairs) - BATCH MODE
function initGame3(canvas) {
    document.getElementById('hud-progress').parentElement.classList.add('hidden'); // Sembunyikan progress per soal
    
    let pool = gameState.queue.slice(0, 6); // Ambil maks 6 pasang (12 kartu)
    let cards = [];
    pool.forEach((v, index) => {
        cards.push({ text: v.word, type: 'en', id: index, vocab: v });
        cards.push({ text: v.meaning, type: 'id', id: index, vocab: v });
    });
    shuffleArray(cards);

    canvas.innerHTML = `
        <div class="grid grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4 max-w-3xl w-full perspective-1000">
            ${cards.map((c, i) => `
                <div class="relative w-full aspect-[4/3] cursor-pointer group" onclick="flipG3(this, ${c.id}, '${c.type}', ${i})">
                    <div id="g3-card-${i}" class="w-full h-full absolute transition-transform duration-500 transform-style-3d shadow-sm rounded-xl">
                        <!-- Front (Cover) -->
                        <div class="absolute inset-0 backface-hidden bg-slate-700 rounded-xl flex items-center justify-center border-2 border-slate-600 hover:bg-slate-600 transition-colors">
                            <i class="fa-solid fa-question text-slate-500 text-3xl"></i>
                        </div>
                        <!-- Back (Text) -->
                        <div class="absolute inset-0 backface-hidden rotate-y-180 ${c.type === 'en' ? 'bg-blue-500' : 'bg-amber-500'} rounded-xl flex items-center justify-center p-2 text-center text-white font-bold text-sm lg:text-base border-2 border-white/20">
                            ${c.text}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    let flipped = [];
    let matchedCount = 0;
    let isProcessing = false;

    window.flipG3 = function(element, pairId, type, domId) {
        if(isProcessing || !gameState.isActive) return;
        let cardInner = document.getElementById(`g3-card-${domId}`);
        
        // Prevent flipping already flipped or matched cards
        if(cardInner.classList.contains('rotate-y-180') || cardInner.classList.contains('opacity-0')) return;

        cardInner.style.transform = 'rotateY(180deg)';
        cardInner.classList.add('rotate-y-180');
        
        // Jika ini kartu Inggris, ucapkan
        if(type === 'en') {
            let vocabObj = pool.find((_, i) => i === pairId);
            if(vocabObj) playTTS(vocabObj.word);
        }

        flipped.push({ id: pairId, domId: domId, type: type });

        if(flipped.length === 2) {
            isProcessing = true;
            setTimeout(() => {
                let c1 = flipped[0];
                let c2 = flipped[1];

                if(c1.id === c2.id && c1.type !== c2.type) {
                    // Match
                    document.getElementById(`g3-card-${c1.domId}`).parentElement.classList.add('animate-pop');
                    document.getElementById(`g3-card-${c2.domId}`).parentElement.classList.add('animate-pop');
                    matchedCount++;
                    gameState.score += 2; // Score for both parts

                    if(matchedCount === pool.length) {
                        endGameSession();
                    }
                } else {
                    // Mismatch
                    document.getElementById(`g3-card-${c1.domId}`).style.transform = 'rotateY(0deg)';
                    document.getElementById(`g3-card-${c1.domId}`).classList.remove('rotate-y-180');
                    document.getElementById(`g3-card-${c2.domId}`).style.transform = 'rotateY(0deg)';
                    document.getElementById(`g3-card-${c2.domId}`).classList.remove('rotate-y-180');
                    
                    // Log mistake
                    let vocabObj = pool.find((_, i) => i === c1.id);
                    if(vocabObj) handleMistake(vocabObj);
                }
                flipped = [];
                isProcessing = false;
            }, 1000);
        }
    };
}

// GAME 4: Susun Huruf (Anagram)
function initGame4(canvas, vocab) {
    let word = vocab.word.toUpperCase();
    let letters = shuffleArray(word.split(''));
    let filled = Array(word.length).fill(null);

    canvas.innerHTML = `
        <div class="w-full max-w-xl text-center">
            <div class="text-xl font-bold text-slate-400 mb-2 uppercase tracking-widest">Makna</div>
            <div class="text-3xl font-black text-white mb-10 bg-blue-600 p-6 rounded-[2rem] shadow-lg leading-tight">
                "${vocab.meaning}"
            </div>
            
            <!-- Slot Tujuan -->
            <div id="g4-slots" class="flex justify-center gap-2 mb-10 flex-wrap">
                ${word.split('').map((_, i) => `
                    <div class="g4-slot w-12 h-14 border-b-4 border-slate-600 bg-slate-800 text-white text-3xl font-black flex items-center justify-center rounded-t-xl transition-all cursor-pointer" onclick="returnLetter(${i})"></div>
                `).join('')}
            </div>

            <!-- Huruf Acak -->
            <div id="g4-letters" class="flex justify-center gap-3 flex-wrap bg-white/5 p-6 rounded-3xl border border-white/10">
                ${letters.map((l, i) => `
                    <button id="g4-l-${i}" onclick="putLetter('${l}', ${i})" class="w-14 h-14 bg-white text-slate-800 text-3xl font-black rounded-xl shadow-md hover:-translate-y-1 transition-all active:scale-95 border border-slate-200">${l}</button>
                `).join('')}
            </div>
        </div>
    `;

    window.putLetter = function(char, sourceIndex) {
        if(!gameState.isActive) return;
        let emptyIndex = filled.findIndex(v => v === null);
        if(emptyIndex !== -1) {
            filled[emptyIndex] = { char, sourceIndex };
            
            const slot = document.getElementById('g4-slots').children[emptyIndex];
            slot.textContent = char;
            slot.classList.replace('bg-slate-800', 'bg-blue-600');
            slot.classList.replace('border-slate-600', 'border-blue-500');

            document.getElementById(`g4-l-${sourceIndex}`).style.visibility = 'hidden';

            checkG4Complete();
        }
    };

    window.returnLetter = function(slotIndex) {
        if(!gameState.isActive || !filled[slotIndex]) return;
        let data = filled[slotIndex];
        
        document.getElementById(`g4-l-${data.sourceIndex}`).style.visibility = 'visible';
        
        filled[slotIndex] = null;
        const slot = document.getElementById('g4-slots').children[slotIndex];
        slot.textContent = '';
        slot.className = "g4-slot w-12 h-14 border-b-4 border-slate-600 bg-slate-800 text-white text-3xl font-black flex items-center justify-center rounded-t-xl transition-all cursor-pointer";
    };

    function checkG4Complete() {
        if(!filled.includes(null)) {
            let attempt = filled.map(f => f.char).join('');
            const slots = document.getElementById('g4-slots').children;

            if(attempt === word) {
                for(let s of slots) s.className = "g4-slot w-12 h-14 bg-emerald-600 border-b-4 border-emerald-500 text-white text-3xl font-black flex items-center justify-center rounded-t-xl pointer-events-none";
                handleCorrect(vocab);
                proceedNext();
            } else {
                // --- KODE PENGECEKAN WARNA HIJAU/MERAH DITARUH DI SINI ---
                for (let i = 0; i < word.length; i++) {
                    let currentBox = slots[i];
                    let currentChar = currentBox.innerText.toUpperCase();
                    
                    if (currentChar === word[i].toUpperCase()) {
                        // Jika huruf dan posisinya sudah benar -> Warna Hijau & Kunci
                        currentBox.className = "g4-slot w-12 h-14 bg-emerald-600 border-b-4 border-emerald-500 text-white text-3xl font-black flex items-center justify-center rounded-t-xl pointer-events-none";
                    } else {
                        // Jika posisinya masih salah -> Warna Merah
                        currentBox.className = "g4-slot w-12 h-14 bg-red-600 border-b-4 border-red-500 text-white text-3xl font-black flex items-center justify-center rounded-t-xl cursor-pointer";
                    }
                }
                
                document.getElementById('g4-slots').classList.add('animate-shake');
                handleMistake(vocab);
                
                setTimeout(() => {
                    document.getElementById('g4-slots').classList.remove('animate-shake');
                    
                    // --- MODIFIKASI RETURN: Hanya kembalikan huruf yang posisinya salah ---
                    filled.forEach((f, i) => { 
                        // Cek apakah huruf di slot ini tidak sama dengan huruf yang seharusnya
                        if(f && f.char !== word[i]) {
                            returnLetter(i); 
                        }
                    });
                }, 800);
            }
        }
    }
}

// GAME 5: Hubung Kata (Mode Drag/Touch) - BATCH
function initGame5(canvas) {
    document.getElementById('hud-progress').parentElement.classList.add('hidden');
    let pool = gameState.queue.slice(0, 5); // Maks 5 agar muat di layar
    
    let enCol = shuffleArray(pool.map(v => ({ text: v.word, id: v.word, vocab: v })));
    let idCol = shuffleArray(pool.map(v => ({ text: v.meaning, id: v.word, vocab: v })));

    // 1. Hapus fungsi onclick, ganti dengan class drop-zone dan atribut data-*
    canvas.innerHTML = `
        <div class="w-full max-w-4xl flex gap-8 justify-between px-4">
            <div id="g5-col-en" class="flex flex-col gap-3 w-1/2">
                ${enCol.map((e, i) => `<div id="g5-en-${i}" data-word="${e.id}" class="drag-item touch-none py-4 px-6 bg-white text-blue-700 font-bold text-lg rounded-2xl shadow-sm border-2 border-white transition-all text-left truncate cursor-pointer select-none">${e.text}</div>`).join('')}
            </div>
            <div id="g5-col-id" class="flex flex-col gap-3 w-1/2">
                ${idCol.map((e, i) => `<div id="g5-id-${i}" data-meaning="${e.id}" class="drop-zone py-4 px-6 bg-slate-800 text-white font-bold text-lg rounded-2xl shadow-sm border-2 border-slate-800 transition-all text-right truncate select-none">${e.text}</div>`).join('')}
            </div>
        </div>
        <div class="text-center mt-6 text-slate-400 font-medium text-sm w-full"><i class="fa-regular fa-hand-pointer"></i> Tekan kosakata lalu geser ke arti yang tepat</div>
    `;

    let draggedItem = null;
    let matched = 0; // Untuk menghitung progress

    // Fungsi untuk menangani event touch & drag
    function addDragEvents(element) {
        element.addEventListener('touchstart', (e) => {
            if(!gameState.isActive) return;
            draggedItem = e.target;
            draggedItem.style.opacity = '0.7';
            draggedItem.classList.add('ring-4', 'ring-amber-400/30', 'border-amber-400');
            
            // Play audio otomatis saat disentuh
            let wordId = draggedItem.dataset.word;
            let v = enCol.find(x => x.id === wordId).vocab;
            if(v) playTTS(v.word);
        }, {passive: true});

        element.addEventListener('touchend', (e) => {
            if(!draggedItem) return;
            draggedItem.style.opacity = '1';
            draggedItem.classList.remove('ring-4', 'ring-amber-400/30', 'border-amber-400');
            
            // Dapatkan elemen tempat jari dilepas
            let touch = e.changedTouches[0];
            let dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            
            // Pastikan dilepas di atas elemen "Arti" (kanan)
            if (dropTarget && dropTarget.classList.contains('drop-zone')) {
                let word = draggedItem.dataset.word;
                let meaning = dropTarget.dataset.meaning;
                
                if (word === meaning) {
                    // BENAR -> Warna Hijau & Matikan interaksi (Kunci)
                    draggedItem.className = "py-4 px-6 bg-emerald-100 text-emerald-700 font-bold text-lg rounded-2xl shadow-sm border-2 border-emerald-500 transition-all text-left truncate pointer-events-none opacity-50";
                    dropTarget.className = "drop-zone py-4 px-6 bg-emerald-600 text-white font-bold text-lg rounded-2xl shadow-sm border-2 border-emerald-500 transition-all text-right truncate pointer-events-none";
                    
                    matched++;
                    gameState.score += 2;
                    
                    // Cek jika game selesai
                    if(matched === pool.length) {
                        setTimeout(endGameSession, 500);
                    }
                } else {
                    // SALAH -> Border Merah & Getar
                    draggedItem.classList.add('border-red-500', 'animate-shake');
                    dropTarget.classList.replace('border-slate-800', 'border-red-500');
                    dropTarget.classList.add('animate-shake');
                    
                    // Catat kesalahan ke engine
                    let vErr = enCol.find(x => x.id === word).vocab;
                    handleMistake(vErr);

                    // Kembalikan ke warna normal setelah 0.8 detik
                    setTimeout(() => {
                        draggedItem.classList.remove('border-red-500', 'animate-shake');
                        dropTarget.classList.replace('border-red-500', 'border-slate-800');
                        dropTarget.classList.remove('animate-shake');
                    }, 800);
                }
            }
            draggedItem = null;
        });
    }

    // 2. Terapkan fungsi event touch di atas kepada seluruh item di kolom kiri (Kosakata Bahasa Inggris)
    document.querySelectorAll('.drag-item').forEach(item => {
        addDragEvents(item);
    });
}

// GAME 6: Sandi Kata (Wordle Clone)
function initGame6(canvas, vocab) {
    let targetWord = vocab.word.toUpperCase();
    let attempts = 5;
    let currentAttempt = 0;
    let currentGuess = "";

    // QWERTY Layout
    const keys = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

    canvas.innerHTML = `
        <div class="w-full max-w-lg flex flex-col items-center h-full pt-4">
            <div class="text-center mb-6 w-full">
                <div class="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-sm w-full truncate">
                    ${vocab.meaning}
                </div>
            </div>
            
            <div id="g6-grid" class="flex flex-col gap-2 mb-8 flex-1 justify-center">
                ${Array(attempts).fill(0).map((_, row) => `
                    <div class="flex gap-2 justify-center">
                        ${Array(targetWord.length).fill(0).map((_, col) => `
                            <div id="g6-box-${row}-${col}" class="w-10 h-10 sm:w-12 sm:h-12 border-2 border-slate-700 bg-slate-800 text-white text-2xl font-bold flex items-center justify-center rounded-lg uppercase transition-colors duration-500"></div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>

            <!-- On-Screen Keyboard -->
            <div class="w-full max-w-md flex flex-col gap-2 pb-4">
                ${keys.map((row, rIdx) => `
                    <div class="flex justify-center gap-1 sm:gap-2">
                        ${rIdx === 2 ? `<button onclick="handleG6Key('ENTER')" class="key-btn bg-slate-200 text-slate-700 font-bold px-2 sm:px-4 py-3 rounded text-xs sm:text-sm">ENTER</button>` : ''}
                        ${row.split('').map(k => `
                            <button id="g6-key-${k}" onclick="handleG6Key('${k}')" class="key-btn flex-1 max-w-[40px] bg-slate-200 text-slate-800 font-bold py-3 rounded text-sm sm:text-base">${k}</button>
                        `).join('')}
                        ${rIdx === 2 ? `<button onclick="handleG6Key('BACKSPACE')" class="key-btn bg-slate-200 text-slate-700 font-bold px-3 sm:px-5 py-3 rounded"><i class="fa-solid fa-delete-left"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    window.handleG6Key = function(key) {
        if(!gameState.isActive || currentAttempt >= attempts) return;

        if(key === 'BACKSPACE') {
            currentGuess = currentGuess.slice(0, -1);
        } else if(key === 'ENTER') {
            if(currentGuess.length === targetWord.length) {
                evaluateG6Guess();
            } else {
                showToast("Kata terlalu pendek", "error");
            }
        } else if(currentGuess.length < targetWord.length) {
            currentGuess += key;
        }

        // Render current row
        for(let i=0; i<targetWord.length; i++) {
            let box = document.getElementById(`g6-box-${currentAttempt}-${i}`);
            box.textContent = currentGuess[i] || "";
            if(currentGuess[i]) box.classList.replace('border-slate-700', 'border-slate-500');
            else box.classList.replace('border-slate-500', 'border-slate-700');
        }
    };

    window.onkeydown = (e) => {
        if(e.key === "Enter") handleG6Key('ENTER');
        else if(e.key === "Backspace") handleG6Key('BACKSPACE');
        else if(/^[a-zA-Z]$/.test(e.key)) handleG6Key(e.key.toUpperCase());
    }

    function evaluateG6Guess() {
        let targetArr = targetWord.split('');
        let guessArr = currentGuess.split('');
        let states = Array(targetWord.length).fill('bg-slate-500'); // Abu (Salah)

        // Pass 1: Cek Hijau (Benar Posisi)
        for(let i=0; i<targetWord.length; i++) {
            if(guessArr[i] === targetArr[i]) {
                states[i] = 'bg-emerald-500';
                targetArr[i] = null; // Tandai sudah dipakai
                guessArr[i] = null;
            }
        }

        // Pass 2: Cek Kuning (Benar Huruf, Salah Posisi)
        for(let i=0; i<targetWord.length; i++) {
            if(guessArr[i] !== null) {
                let idx = targetArr.indexOf(guessArr[i]);
                if(idx !== -1) {
                    states[i] = 'bg-amber-500';
                    targetArr[idx] = null;
                }
            }
        }

        // Animasikan & Warnai
        guessArr = currentGuess.split('');
        guessArr.forEach((char, i) => {
            setTimeout(() => {
                let box = document.getElementById(`g6-box-${currentAttempt}-${i}`);
                box.classList.remove('bg-slate-800', 'border-slate-500');
                box.classList.add(states[i], 'border-transparent');

                // Warnai Keyboard
                let keyBtn = document.getElementById(`g6-key-${char}`);
                if(!keyBtn.classList.contains('bg-emerald-500')) {
                    keyBtn.classList.remove('bg-slate-200', 'text-slate-800');
                    keyBtn.classList.add('text-white');
                    if(states[i] === 'bg-emerald-500') keyBtn.classList.add('bg-emerald-500');
                    else if(states[i] === 'bg-amber-500' && !keyBtn.classList.contains('bg-amber-500')) keyBtn.classList.add('bg-amber-500');
                    else if(states[i] === 'bg-slate-500') keyBtn.classList.add('bg-slate-600');
                }
            }, i * 150); // Delay per huruf
        });

        setTimeout(() => {
            if(currentGuess === targetWord) {
                handleCorrect(vocab);
                setTimeout(proceedNext, 1000);
            } else {
                currentAttempt++;
                currentGuess = "";
                if(currentAttempt >= attempts) {
                    handleMistake(vocab);
                    showToast(`Jawaban: ${targetWord}`);
                    setTimeout(proceedNext, 2000);
                }
            }
        }, targetWord.length * 150 + 200);
    }
}

// GAME 7: Hujan Ketik (Word Rain) - MOBILE & HINT TIMER
function initGame7(canvas) {
    document.getElementById('hud-progress').parentElement.classList.add('hidden');
    
    // 1. Tambahkan overlay ketuk dan input tersembunyi agar keyboard mobile keluar
    canvas.innerHTML = `
        <div id="g7-sky" class="w-full h-full relative border-2 border-slate-700/50 rounded-3xl bg-slate-900/50 overflow-hidden cursor-pointer" onclick="document.getElementById('hidden-input-g7').focus()">
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                <i class="fa-solid fa-hand-pointer text-white/20 text-4xl mb-2 animate-bounce"></i>
                <span class="text-white/20 font-bold text-xl">Ketuk area ini untuk keyboard</span>
            </div>
            <div class="absolute bottom-0 w-full h-2 bg-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.5)]"></div>
        </div>
        <input type="text" id="hidden-input-g7" class="absolute opacity-0 -z-10" autocomplete="off">
        <div class="mt-4 text-slate-400 font-bold text-sm tracking-wider flex items-center gap-2">
            <i class="fa-regular fa-keyboard"></i> KETIK KATA DALAM BAHASA INGGRIS
        </div>
    `;

    setTimeout(() => document.getElementById('hidden-input-g7').focus(), 100);

    const sky = document.getElementById('g7-sky');
    const hiddenInput = document.getElementById('hidden-input-g7');
    
    let activeWords = [];
    let focusedWordObj = null; // Kata yang sedang diketik user
    let dropInterval = 2000; // MS antar muncul kata
    let speed = 0.5; // Pixel per frame
    let hintTimer = null; // Timer untuk 10 detik

    function spawnWord() {
        if(!gameState.isActive || gameState.lives <= 0) return;
        
        let v = gameState.queue[Math.floor(Math.random() * gameState.queue.length)];
        let wordStr = v.word.toLowerCase();
        
        if(activeWords.find(aw => aw.word[0] === wordStr[0])) return;

        let el = document.createElement('div');
        el.className = 'falling-object flex flex-col items-center bg-slate-800/80 p-3 rounded-xl border border-slate-600 shadow-xl';
        el.style.left = Math.random() * 70 + 10 + '%'; 
        el.style.top = '-50px';

        // 2. Sembunyikan huruf-huruf awalnya menggunakan underscore (_)
        el.innerHTML = `
            <span class="text-xs font-bold text-amber-400 mb-1 uppercase tracking-wider">${v.meaning}</span>
            <div class="flex gap-1">
                ${wordStr.split('').map(c => `<span class="g7-char text-lg font-black text-white w-6 h-8 bg-slate-700 rounded flex items-center justify-center">_</span>`).join('')}
            </div>
        `;
        sky.appendChild(el);

        activeWords.push({
            vocab: v,
            word: wordStr,
            element: el,
            top: -50,
            typedCount: 0
        });
    }

    let lastSpawn = 0;
    function gameLoop(timestamp) {
        if(!gameState.isActive) {
            gameState.animationFrame = requestAnimationFrame(gameLoop);
            return;
        }

        if(timestamp - lastSpawn > dropInterval) {
            spawnWord();
            lastSpawn = timestamp;
            dropInterval = Math.max(800, dropInterval - 50); 
            speed += 0.05; 
        }

        let bottomLimit = sky.clientHeight;

        for(let i = activeWords.length - 1; i >= 0; i--) {
            let obj = activeWords[i];
            obj.top += speed;
            obj.element.style.top = obj.top + 'px';

            if(obj.top + obj.element.clientHeight >= bottomLimit) {
                // Kena bawah = Salah
                obj.element.classList.add('bg-red-900/80', 'border-red-500');
                handleMistake(obj.vocab);
                setTimeout(() => obj.element.remove(), 300);
                activeWords.splice(i, 1);
                
                if(focusedWordObj === obj) {
                    focusedWordObj = null;
                    clearTimeout(hintTimer);
                }
            }
        }

        if(gameState.lives > 0) {
            gameState.animationFrame = requestAnimationFrame(gameLoop);
        }
    }

    // 3. Fungsi Logika Penyelesaian Kata 
    function finishWord(obj) {
        clearTimeout(hintTimer);
        obj.element.classList.add('animate-pop');
        handleCorrect(obj.vocab);
        
        setTimeout(() => {
            if(obj && obj.element && obj.element.parentNode) {
                obj.element.remove();
            }
        }, 300);
        
        activeWords = activeWords.filter(aw => aw !== obj);
        if(focusedWordObj === obj) focusedWordObj = null;

        if(gameState.score >= 15) { // Syarat menang
            endGameSession();
        }
    }

    // 4. Logika Bantuan 10 Detik
    function resetHintTimer() {
        clearTimeout(hintTimer);
        if (focusedWordObj && focusedWordObj.typedCount < focusedWordObj.word.length) {
            hintTimer = setTimeout(() => {
                if(!focusedWordObj || !gameState.isActive) return;
                
                // Bantuan: Komputer otomatis membukakan huruf selanjutnya
                let charEls = focusedWordObj.element.querySelectorAll('.g7-char');
                let targetChar = focusedWordObj.word[focusedWordObj.typedCount];
                
                charEls[focusedWordObj.typedCount].textContent = targetChar;
                // Beri warna kuning gelap agar ketahuan itu dari Hint/Bantuan
                charEls[focusedWordObj.typedCount].classList.replace('bg-slate-700', 'bg-amber-500'); 
                
                focusedWordObj.typedCount++;
                
                if(focusedWordObj.typedCount === focusedWordObj.word.length) {
                    finishWord(focusedWordObj);
                } else {
                    resetHintTimer(); // Mulai ulang timer 10 detik lagi untuk huruf berikutnya
                }
            }, 10000); 
        }
    }

    // 5. Eksekusi Ketikan (Gabungan fungsi fisik & virtual keyboard)
    function handleKeystroke(key) {
        if(!gameState.isActive) return;
        if(!/^[a-z]$/.test(key)) return;

        // Jika belum ada kata yang difokuskan, cari kata yang huruf pertamanya cocok
        if(!focusedWordObj) {
            focusedWordObj = activeWords.find(aw => aw.word[0] === key);
            if(focusedWordObj) resetHintTimer(); // Mulai timer 10 detik
        }

        if(focusedWordObj) {
            if(focusedWordObj.word[focusedWordObj.typedCount] === key) {
                // Huruf diketik dengan benar
                let charEls = focusedWordObj.element.querySelectorAll('.g7-char');
                
                charEls[focusedWordObj.typedCount].textContent = key;
                charEls[focusedWordObj.typedCount].classList.replace('bg-slate-700', 'bg-emerald-500'); // Warna hijau
                
                focusedWordObj.typedCount++;
                resetHintTimer(); // Reset timer saat benar

                if(focusedWordObj.typedCount === focusedWordObj.word.length) {
                    finishWord(focusedWordObj);
                }
            } else {
                // Salah ketik
                focusedWordObj.element.classList.add('animate-shake');
                setTimeout(() => {
                    if(focusedWordObj) focusedWordObj.element.classList.remove('animate-shake');
                }, 200);
            }
        }
    }

    // Menerima ketikan dari PC (Keyboard Fisik)
    window.onkeydown = (e) => handleKeystroke(e.key.toLowerCase());

    // Menerima ketikan dari Mobile (Input Tersembunyi)
    hiddenInput.addEventListener('input', (e) => {
        let val = e.target.value.toLowerCase();
        if(val.length > 0) {
            handleKeystroke(val[val.length - 1]);
            e.target.value = ''; // Segera kosongkan input agar tidak menumpuk
        }
    });

    gameState.animationFrame = requestAnimationFrame(gameLoop);
}

// GAME 8: Kuis Meteor (Falling Meaning, Choose Vocab)
function initGame8(canvas, vocab) {
    let options = shuffleArray([vocab.word, ...getWrongOptions(vocab.word, 3)]);

    canvas.innerHTML = `
        <div id="g8-sky" class="w-full flex-1 relative bg-slate-900 rounded-t-3xl overflow-hidden border border-slate-700 mb-2">
            <div class="absolute bottom-0 w-full h-1 bg-red-500/80"></div>
        </div>
        <div class="grid grid-cols-2 gap-3 w-full shrink-0">
            ${options.map(opt => `
                <button onclick="checkG8('${opt}', '${vocab.word}')" class="g8-btn bg-slate-800 text-white hover:bg-blue-600 font-bold py-5 rounded-2xl border border-slate-600 transition-colors text-lg">${opt}</button>
            `).join('')}
        </div>
    `;

    const sky = document.getElementById('g8-sky');
    let meteor = document.createElement('div');
    meteor.className = 'absolute bg-gradient-to-b from-amber-200 to-orange-500 text-slate-900 font-black px-6 py-3 rounded-full shadow-[0_10px_20px_rgba(245,158,11,0.6)] left-1/2 -translate-x-1/2 flex flex-col items-center border-2 border-white/50';
    meteor.innerHTML = `
        <i class="fa-solid fa-fire text-white/50 absolute -top-4 text-3xl"></i>
        <span class="relative z-10">${vocab.meaning}</span>
    `;
    meteor.style.top = '0px';
    sky.appendChild(meteor);

    let pos = 0;
    let speed = sky.clientHeight / (4000 / 16); // Waktu jatuh ~4 detik
    let isAnswered = false;

    function fallLoop() {
        if(isAnswered || !gameState.isActive) return;
        
        pos += speed;
        meteor.style.top = pos + 'px';

        if(pos + meteor.clientHeight >= sky.clientHeight) {
            // Nabrak bawah = salah
            handleMistake(vocab);
            meteor.classList.replace('to-orange-500', 'to-red-600');
            showToast("Waktu Habis!", "error");
            document.querySelectorAll('.g8-btn').forEach(b => {
                if(b.textContent === vocab.word) b.classList.replace('bg-slate-800', 'bg-emerald-500');
            });
            setTimeout(proceedNext, 1500);
        } else {
            gameState.animationFrame = requestAnimationFrame(fallLoop);
        }
    }

    window.checkG8 = function(selected, correct) {
        if(isAnswered || !gameState.isActive) return;
        isAnswered = true;

        document.querySelectorAll('.g8-btn').forEach(b => {
            b.disabled = true;
            if(b.textContent === correct) {
                b.classList.replace('bg-slate-800', 'bg-emerald-500');
                b.classList.replace('border-slate-600', 'border-emerald-400');
            } else if(b.textContent === selected) {
                b.classList.replace('bg-slate-800', 'bg-red-500');
            }
        });

        if(selected === correct) {
            handleCorrect(vocab);
            meteor.classList.add('animate-pop');
            setTimeout(proceedNext, 800);
        } else {
            handleMistake(vocab);
            meteor.style.top = (sky.clientHeight - meteor.clientHeight) + 'px'; // Nabrak bawah visual
            setTimeout(proceedNext, 1500);
        }
    };

    gameState.animationFrame = requestAnimationFrame(fallLoop);
}

// GAME 9: Tembak Gelembung
function initGame9(canvas, vocab) {
    let options = shuffleArray([vocab.word, ...getWrongOptions(vocab.word, 4)]); // 5 Gelembung

    canvas.innerHTML = `
        <div class="absolute top-6 z-10 w-full text-center px-4 pointer-events-none">
            <div class="inline-block bg-white text-slate-800 px-8 py-4 rounded-full font-black text-2xl shadow-xl shadow-blue-900/20 border-4 border-blue-100">
                ${vocab.meaning}
            </div>
        </div>
        <div id="g9-space" class="w-full h-full relative">
            <!-- Gelembung disuntik disini -->
        </div>
    `;

    const space = document.getElementById('g9-space');
    let isAnswered = false;

    options.forEach((opt, index) => {
        let bub = document.createElement('button');
        // Warna pastel acak
        const colors = ['bg-pink-300', 'bg-purple-300', 'bg-blue-300', 'bg-emerald-300', 'bg-amber-300'];
        
        bub.className = `absolute w-24 h-24 rounded-full ${colors[index]} text-slate-800 font-bold shadow-inner border-2 border-white/50 flex items-center justify-center hover:scale-110 transition-transform hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]`;
        bub.textContent = opt;
        
        // Posisi awal acak
        bub.style.left = (Math.random() * 70 + 10) + '%';
        bub.style.top = (Math.random() * 60 + 20) + '%';

        bub.onclick = () => {
            if(isAnswered || !gameState.isActive) return;
            
            if(opt === vocab.word) {
                isAnswered = true;
                bub.classList.add('animate-pop');
                handleCorrect(vocab);
                setTimeout(proceedNext, 600);
            } else {
                bub.classList.replace(colors[index], 'bg-red-500');
                bub.classList.add('text-white');
                bub.classList.add('animate-shake');
                handleMistake(vocab);
            }
        };

        space.appendChild(bub);

        // Gerakan melayang acak (Floating)
        let angle = Math.random() * Math.PI * 2;
        let speed = 0.5;
        function float() {
            if(isAnswered || !gameState.isActive) return;
            let rect = bub.getBoundingClientRect();
            let spaceRect = space.getBoundingClientRect();

            let currentLeft = parseFloat(bub.style.left);
            let currentTop = parseFloat(bub.style.top);

            // Konversi % ke px untuk logic mantul
            let pxLeft = (currentLeft / 100) * spaceRect.width;
            let pxTop = (currentTop / 100) * spaceRect.height;

            pxLeft += Math.cos(angle) * speed;
            pxTop += Math.sin(angle) * speed;

            // Pantul di pinggir
            if(pxLeft <= 0 || pxLeft + rect.width >= spaceRect.width) angle = Math.PI - angle;
            if(pxTop <= 0 || pxTop + rect.height >= spaceRect.height) angle = -angle;

            bub.style.left = (pxLeft / spaceRect.width * 100) + '%';
            bub.style.top = (pxTop / spaceRect.height * 100) + '%';

            requestAnimationFrame(float);
        }
        requestAnimationFrame(float);
    });
}

// GAME 10: Kuis Makna (Definition to Word)
function initGame10(canvas, vocab) {
    let options = shuffleArray([vocab.word, ...getWrongOptions(vocab.word, 3)]);
    
    // Gunakan vocab.definition, tapi jika kosong pakai vocab.meaning sebagai cadangan
    let definition = vocab.definition || vocab.meaning || "Definisi tidak tersedia";

    canvas.innerHTML = `
        <div class="w-full h-full max-w-3xl flex flex-col">
            
            <!-- Bagian Atas: Icon & Definisi (Bisa mengisi ruang sisa & scrollable) -->
            <div class="flex-1 flex flex-col items-center min-h-0 mb-4 mt-2">
                
                <!-- Ikon (ditambah shrink-0 agar tidak bisa lonjong/gepeng) -->
                <div class="w-16 h-16 shrink-0 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm">
                    <i class="fa-solid fa-book-open-reader"></i>
                </div>
                
                <!-- Kotak Definisi -->
                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-200 w-full text-center relative flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-indigo-500 z-10 shrink-0"></div>
                    <!-- Area ini yang akan scroll jika teks sangat panjang -->
                    <div class="p-6 overflow-y-auto flex-1 mt-2">
                        <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Definisi (Makna)</h3>
                        <p class="text-lg md:text-2xl font-black text-slate-800 leading-relaxed">"${definition}"</p>
                    </div>
                </div>
            </div>
            
            <!-- Bagian Bawah: Pilihan Ganda (TETAP DIAM & TIDAK PENYOK karena shrink-0) -->
            <div class="shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pb-2">
                ${options.map(opt => `
                    <button onclick="checkG10(this, '${opt}', '${vocab.word}')" class="g10-btn group relative p-5 bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all text-left shadow-sm hover:shadow-md overflow-hidden">
                        <div class="absolute inset-0 bg-blue-50 w-0 group-hover:w-full transition-all duration-300 ease-out z-0"></div>
                        <span class="relative z-10 font-bold text-lg text-slate-700 group-hover:text-blue-700 transition-colors">${opt}</span>
                    </button>
                `).join('')}
            </div>
            
        </div>
    `;

    window.checkG10 = function(btn, selected, correct) {
        if(!gameState.isActive) return;
        document.querySelectorAll('.g10-btn').forEach(b => {
            b.disabled = true;
            // Reset styling to solid colors for result
            b.querySelector('div').style.display = 'none'; 
            b.classList.replace('bg-white', 'bg-slate-100');
            b.classList.remove('hover:border-blue-500', 'group-hover:text-blue-700');
        });

        if(selected === correct) {
            btn.classList.replace('bg-slate-100', 'bg-emerald-500');
            btn.classList.replace('border-slate-200', 'border-emerald-600');
            btn.querySelector('span').classList.add('text-white');
            handleCorrect(vocab);
            setTimeout(proceedNext, 1000);
        } else {
            btn.classList.replace('bg-slate-100', 'bg-red-500');
            btn.classList.replace('border-slate-200', 'border-red-600');
            btn.querySelector('span').classList.add('text-white');
            btn.classList.add('animate-shake');
            
            handleMistake(vocab);

            document.querySelectorAll('.g10-btn').forEach(b => {
                if(b.querySelector('span').textContent === correct) {
                    b.classList.replace('bg-slate-100', 'bg-emerald-500');
                    b.classList.replace('border-slate-200', 'border-emerald-600');
                    b.querySelector('span').classList.add('text-white');
                }
            });
            
            setTimeout(proceedNext, 2000);
        }
    }
}

// GAME 11: Ucap Kata (Voice Flashcard)
function initGame11(canvas, vocab) {
    let attempts = 5;
    let currentAttempt = 0;

    canvas.innerHTML = `
        <div class="w-full max-w-sm relative perspective-1000 h-[400px]">
            <div id="g11-card" class="w-full h-full absolute transition-transform duration-700 transform-style-3d shadow-2xl rounded-[2.5rem]">
                
                <!-- Depan: Indonesia -->
                <div class="absolute inset-0 backface-hidden bg-white border-4 border-red-50 flex flex-col items-center justify-center p-8 rounded-[2.5rem]">
                    <div class="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest"><i class="fa-solid fa-language text-red-400 mr-2"></i>Bahasa Indonesia</div>
                    <h2 class="text-4xl font-black text-slate-800 text-center leading-tight mb-8">${vocab.meaning}</h2>
                    
                    <div class="w-full">
                        <button id="g11-mic-btn" onclick="startRecognition()" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-500/30 transition-all active:scale-95">
                            <i class="fa-solid fa-microphone text-xl"></i> Mulai Bicara
                        </button>
                        <p id="g11-status" class="text-center text-sm font-medium text-slate-500 mt-4 h-5"></p>
                        <p class="text-center text-xs text-slate-400 mt-2">Sisa Percobaan: <span id="g11-tries" class="font-bold text-slate-600">${attempts}</span></p>
                    </div>
                </div>

                <!-- Belakang: Inggris -->
                <div class="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center p-8 rounded-[2.5rem] text-white">
                    <div class="text-sm font-bold text-blue-200 mb-4 uppercase tracking-widest">Bahasa Inggris</div>
                    <h2 class="text-5xl font-black text-white text-center mb-6">${vocab.word}</h2>
                    <button onclick="playTTS('${vocab.word}')" class="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center text-2xl hover:scale-110 transition-transform shadow-lg">
                        <i class="fa-solid fa-volume-high"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Setup Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) {
        document.getElementById('g11-status').textContent = "Browser tidak mendukung fitur mikrofon.";
        document.getElementById('g11-mic-btn').disabled = true;
        document.getElementById('g11-mic-btn').classList.replace('bg-red-500', 'bg-slate-400');
        return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    window.speechRec = rec; // Save to global to abort on exit

    window.startRecognition = function() {
        if(!gameState.isActive || currentAttempt >= attempts) return;
        
        const btn = document.getElementById('g11-mic-btn');
        const status = document.getElementById('g11-status');
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xl"></i> Mendengarkan...';
        btn.classList.add('animate-pulse');
        status.textContent = "Silakan ucapkan terjemahannya...";
        status.className = "text-center text-sm font-bold text-blue-500 mt-4 h-5";

        try {
            rec.start();
        } catch(e) {
            console.log("Mic already started");
        }
    };

    rec.onresult = (event) => {
        const speechResult = event.results[0][0].transcript.toLowerCase().replace(/[.,?!]/g, '');
        const targetWord = vocab.word.toLowerCase();
        
        const btn = document.getElementById('g11-mic-btn');
        btn.innerHTML = '<i class="fa-solid fa-microphone text-xl"></i> Coba Lagi';
        btn.classList.remove('animate-pulse');

        if(speechResult === targetWord || speechResult.includes(targetWord)) {
            // BENAR
            document.getElementById('g11-status').innerHTML = `<span class="text-emerald-500"><i class="fa-solid fa-check"></i> Kamu mengucapkan: "${speechResult}"</span>`;
            handleCorrect(vocab);
            flipCardAndNext();
        } else {
            // SALAH
            currentAttempt++;
            document.getElementById('g11-tries').textContent = attempts - currentAttempt;
            document.getElementById('g11-status').innerHTML = `<span class="text-red-500"><i class="fa-solid fa-times"></i> Terdengar: "${speechResult}"</span>`;
            
            if(currentAttempt >= attempts) {
                handleMistake(vocab);
                flipCardAndNext();
            }
        }
    };

    rec.onerror = (event) => {
        const btn = document.getElementById('g11-mic-btn');
        btn.innerHTML = '<i class="fa-solid fa-microphone text-xl"></i> Mulai Bicara';
        btn.classList.remove('animate-pulse');
        document.getElementById('g11-status').innerHTML = `<span class="text-red-500">Error: ${event.error}</span>`;
    };

    function flipCardAndNext() {
        const card = document.getElementById('g11-card');
        card.style.transform = 'rotateY(180deg)';
        playTTS(vocab.word);
        setTimeout(proceedNext, 2500);
    }
}


// ==========================================
// 6. INISIALISASI & FETCH DATA
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    renderMenu();

    // Setup Backend Supabase Fetch
    const loadingData = document.getElementById('loadingData');
    
    try {
        // 1. Ambil param mode dari URL
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode') || 'all';
    
        // 2. Gunakan supabaseClient (bukan supabase)
        const { data: { session } } = await supabaseClient.auth.getSession();
    
        if (session && session.user) {
            loadingData.classList.remove('hidden');
            document.getElementById('userInitial').textContent = session.user.email.charAt(0).toUpperCase();
    
            // 3. Fetch data melalui proksi Backend
            const response = await fetch(`/api/vocabularies/${session.user.id}`);
            const res = await response.json();
            
            if (!res.success) throw new Error(res.message || "Gagal mengambil data dari server");
            const userData = res.data;
    
            if (userData && userData.length > 0) {
                // 4. Logika Filter Data sesuai `mode` URL
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                const msInDay = 1000 * 60 * 60 * 24;
    
                let filteredData = userData.filter(item => {
                    const itemStartOfDay = new Date(item.created_at);
                    itemStartOfDay.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((todayStart.getTime() - itemStartOfDay.getTime()) / msInDay);
    
                    if (mode === 'memorized') return item.is_memorized;
                    if (mode === 'today') return diffDays === 0;
                    if (mode === 'yesterday' || mode === 'daily') return diffDays === 1;
                    if (mode === 'week' || mode === 'weekly') return diffDays >= 6 && diffDays <= 8;
                    if (mode === 'month' || mode === 'monthly') return diffDays >= 28 && diffDays <= 32;
                    return true; // 'all'
                });
    
                // Jika hasil filter kosong (misal hari ini belum nambah vocab), pakai semua data
                if (filteredData.length === 0) {
                    filteredData = userData;
                    showToast(`Tidak ada kata di mode '${mode}', menggunakan semua kata`, 'info');
                }
    
                masterVocab = filteredData
                    .map(item => item.vocabularies)
                    .filter(vocab => vocab !== null && vocab !== undefined);
            } else {
                masterVocab = [];
            }
    
            // 5. Ambil data pengecoh global menggunakan supabaseClient
            const { data: globalVocab, error: globalError } = await supabaseClient
                .from('vocabularies')
                .select('word, meaning, type')
                .limit(100);
    
            if (!globalError && globalVocab && globalVocab.length > 0) {
                allVocabPool = globalVocab;
            } else {
                allVocabPool = [...masterVocab];
            }
    
        } else {
            // Not logged in, use mock
            masterVocab = [];
            allVocabPool = [...mockData];
        }
    } catch (error) {
        console.error("Gagal mengambil data dari server:", error);
        masterVocab = []; // Fallback
        allVocabPool = [...mockData];
    } finally {
        loadingData.classList.add('hidden');
        
        // Validasi akhir untuk memastikan allVocabPool tidak kosong
        if (allVocabPool.length === 0) {
            allVocabPool = [...masterVocab];
        }
    }
});
