const dropdown = document.getElementById('mobileDropdown');
dropdown.classList.toggle('hidden');

window.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileDropdown');
    const btn = document.getElementById('mobileMenuBtn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// Kontrol Modal Profile & Upgrade
function openProfileModal() {
    loadUserProfile();
    document.getElementById('profileModal').classList.remove('hidden');
}

function openUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
}

function openContactModal() {
    document.getElementById('contactModal').classList.remove('hidden');
}

function closeContactModal() {
    document.getElementById('contactModal').classList.add('hidden');
}

async function loadUserProfile() {
    document.getElementById('profileEmail').value = currentUser.email;
    let defaultName = currentUser.email.split('@')[0];
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if (data) {
        document.getElementById('displayUsername').textContent = (data.username || defaultName).toUpperCase();
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

window.executeProCheckout = function() {
    const selected = document.querySelector('input[name="proPlan"]:checked');
    if (!selected) {
        alert("Silakan pilih salah satu paket terlebih dahulu.");
        return;
    }

    const months = parseInt(selected.value);
    const price = parseInt(selected.getAttribute('data-price'));
    const name = selected.getAttribute('data-name');

    startCheckout(months, price, name);
};

async function startCheckout(durationInMonths, priceAmount, packageName) {
    if (!currentUser) return;

    // Ambil kode referral (dari URL atau LocalStorage)
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref') || localStorage.getItem('vocab_ref_code') || 'NONE';

    // Simpan referral ke local storage untuk konsistensi
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

// Fungsi Ekstrak ID YouTube
function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Fungsi Pemutar Suara AI (Text-to-Speech)
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
        fallbackToNativeTTS(text, forceLang);
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

function speakText(text, lang = 'en-US') {
    playGoogleTTS(text, lang);
}

// --- FUNGSI YOUTUBE PLAYER ---
function onPlayerReady(event) {
    playCurrentSegment();
}

function onPlayerStateChange(event) {
    const btn = document.getElementById('playPauseBtn');
    if (event.data == YT.PlayerState.PLAYING) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    } else if (event.data == YT.PlayerState.PAUSED) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Play';
    }
}

// Fungsi Switch Tab Input
function switchTab(mode) {
    const tabYt = document.getElementById('tab-yt');
    const tabLocal = document.getElementById('tab-local');
    const areaYt = document.getElementById('ytInputArea');
    const areaLocal = document.getElementById('localInputArea');

    if (mode === 'youtube') {
        isLocalMode = false;
        tabYt.className = "px-4 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600 transition-colors";
        tabLocal.className = "px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors";
        areaYt.classList.remove('hidden');
        areaLocal.classList.add('hidden');
        document.getElementById('ytUrl').required = true;
        document.getElementById('localSrt').required = false;
    } else {
        isLocalMode = true;
        tabLocal.className = "px-4 py-2 text-sm font-bold text-blue-600 border-b-2 border-blue-600 transition-colors";
        tabYt.className = "px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors";
        areaLocal.classList.remove('hidden');
        areaYt.classList.add('hidden');
        document.getElementById('ytUrl').required = false;
        document.getElementById('localSrt').required = true;
    }
    document.getElementById('transcriptError').classList.add('hidden');
}

// Parser SRT ke JSON
function parseSRT(data) {
    const items = [];
    const blocks = data.replace(/\r/g, '').split('\n\n');

    blocks.forEach(block => {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            let text = lines.slice(2).join(' ').replace(/<[^>]+>/g, '').trim();
            text = text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
            text = text.replace(/[@#$%^&*~`_+=|\\<>{}\/]/g, '');
            text = text.replace(/\s+/g, ' ').trim();

            if (text && text.length > 1) {
                items.push({ text: text });
            }
        }
    });
    return items;
}

document.getElementById('setupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (!isProUser) {
        alert("Akses Ditolak: Memasukkan link secara manual eksklusif untuk pengguna PRO.");
        return;
    }
    startListeningSession();
});

async function startListeningSession(overrideUrl = null) {
    const activeUrl = overrideUrl || document.getElementById('ytUrl').value;
    const videoId = extractVideoID(activeUrl);

    if (!isProUser && !overrideUrl) {
        alert("Akses Ditolak: Memasukkan link secara manual eksklusif untuk pengguna PRO.");
        return;
    }

    const errorBox = document.getElementById('transcriptError');
    const btn = document.getElementById('startListenBtn');
    const originalBtnText = btn ? btn.innerHTML : '';

    if (errorBox) errorBox.classList.add('hidden');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan Latihan...';
        btn.disabled = true;
    }

    try {
        if (overrideUrl) {
            isLocalMode = false;
        }

        if (!isLocalMode) {
            const videoModeBtn = document.getElementById('videoModeBtn');
            if (videoModeBtn) {
                videoModeBtn.classList.remove('hidden');
                videoModeBtn.classList.add('flex');
            }

            if (!videoId) throw new Error("Link YouTube tidak valid!");

            const response = await fetch('/api/get-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: activeUrl })
            });
            const result = await response.json();

            if (!result.success || !Array.isArray(result.data)) {
                throw new Error(result.message || "Gagal menarik transkrip YouTube.");
            }
            sentences = result.data;

            if (result.level && result.topic) {
                document.getElementById('badgeLevel').innerHTML = `<i class="fa-solid fa-signal text-white mr-1"></i> ${result.level}`;
                document.getElementById('badgeTopic').innerHTML = `#${result.topic}`;
                document.getElementById('videoMetaBadges').classList.remove('hidden');
            } else {
                document.getElementById('videoMetaBadges').classList.add('hidden');
            }

            const savedIndex = localStorage.getItem(`vocabmaster_progress_${videoId}`);
            currentIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
            if (currentIndex >= sentences.length) currentIndex = 0;

            initYouTubePlayer(videoId);

        } else {
            document.getElementById('videoModeBtn').classList.remove('flex');
            document.getElementById('videoModeBtn').classList.add('hidden');
            document.getElementById('videoMetaBadges').classList.add('hidden');
            const srtFile = document.getElementById('localSrt').files[0];
            if (!srtFile) throw new Error("File SRT wajib diupload.");

            const srtText = await srtFile.text();
            sentences = parseSRT(srtText);
            if (sentences.length === 0) throw new Error("Format SRT tidak terbaca atau kosong.");

            document.getElementById('player-container').innerHTML = `
                        <div class="w-full h-full bg-gradient-to-br from-indigo-900 to-blue-900 flex flex-col items-center justify-center text-white p-4 text-center">
                            <div class="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-3 relative">
                                <div class="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                                <i class="fa-solid fa-podcast text-4xl"></i>
                            </div>
                            <h3 class="font-bold text-base">Mode Audio Dikte</h3>
                            <p class="text-xs text-indigo-200 mt-1 truncate max-w-xs">${srtFile.name}</p>
                        </div>
                    `;

            currentIndex = 0;
            setTimeout(() => playCurrentSegment(), 800);
        }

        document.getElementById('setupSection').classList.add('hidden');
        document.getElementById('practiceSection').classList.remove('hidden');
        document.getElementById('practiceSection').classList.add('flex');
        updateUI();

    } catch (err) {
        if (errorBox) {
            errorBox.textContent = err.message;
            errorBox.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    }
}

let isYTReady = false;
window.onYouTubeIframeAPIReady = function() {
    isYTReady = true;
};

function initYouTubePlayer(videoId) {
    if (player && typeof player.destroy === 'function') {
        player.destroy();
    }

    document.getElementById('player-container').innerHTML = '<div id="ytplayer"></div>';

    player = new YT.Player('ytplayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'cc_load_policy': 0,
            'rel': 0,
            'controls': 1,
            'autoplay': 0
        },
        events: {
            'onReady': (event) => {
                setTimeout(() => {
                    playCurrentSegment();
                }, 500);
            },
            'onStateChange': onPlayerStateChange
        }
    });
}

function playCurrentSegment() {
    if (!sentences || !sentences[currentIndex]) return;

    if (playInterval) {
        clearTimeout(playInterval);
        playInterval = null;
    }
    if (playAnimationId) {
        cancelAnimationFrame(playAnimationId);
        playAnimationId = null;
    }

    if (!isLocalMode) {
        if (!player || typeof player.seekTo !== 'function') return;

        const startTime = Number(sentences[currentIndex].start) || 0;
        const endTime = Number(sentences[currentIndex].end) || (startTime + 3);
        const duration = Math.max(0, (endTime - startTime - 0.1) * 1000);

        player.seekTo(startTime, true);
        player.playVideo();

        playInterval = setTimeout(() => {
            if (player && typeof player.pauseVideo === 'function') {
                player.pauseVideo();
            }
        }, duration);

    } else if (isLocalMode) {
        speakText(sentences[currentIndex].text);
        document.getElementById('playPauseBtn').innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    }
}

function togglePlay() {
    if (!isLocalMode && player && typeof player.getPlayerState === 'function') {
        if (player.getPlayerState() === 1) {
            player.pauseVideo();
            if (playInterval) clearInterval(playInterval);
            if (playAnimationId) cancelAnimationFrame(playAnimationId);
        } else {
            playCurrentSegment();
        }
    } else if (isLocalMode) {
        if (currentAudio && !currentAudio.paused) {
            currentAudio.pause();
            document.getElementById('playPauseBtn').innerHTML = '<i class="fa-solid fa-play"></i> Play';
        } else if (currentAudio && currentAudio.paused) {
            currentAudio.play();
            document.getElementById('playPauseBtn').innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
        } else {
            playCurrentSegment();
        }
    }
}

// Variabel Sesi Latihan
let sessionTotalWords = 0;
let sessionCorrectWords = 0;
let revealedIndices = new Set();
let currentTargetWords = [];

let isAudioOnlyMode = false;

function toggleVideoMode() {
    isAudioOnlyMode = !isAudioOnlyMode;
    const overlay = document.getElementById('audioOnlyOverlay');
    const btn = document.getElementById('videoModeBtn');

    if (isAudioOnlyMode) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        btn.innerHTML = '<i class="fa-solid fa-eye"></i> Tampilkan Video';
        btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'hover:bg-indigo-200');
        btn.classList.add('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');
    } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Sembunyikan Video';
        btn.classList.remove('bg-indigo-600', 'text-white', 'hover:bg-indigo-700');
        btn.classList.add('bg-indigo-100', 'text-indigo-700', 'hover:bg-indigo-200');
    }
}

function updateUI() {
    document.getElementById('sentenceCounter').textContent = `${currentIndex + 1} / ${sentences.length}`;
    document.getElementById('userTyping').value = '';
    document.getElementById('correctionArea').classList.add('hidden');

    document.getElementById('checkBtn').classList.remove('hidden');
    document.getElementById('nextBtn').classList.add('hidden');

    revealedIndices.clear();
    const targetText = sentences[currentIndex].text;
    currentTargetWords = targetText.trim().split(/\s+/);

    const censoredArea = document.getElementById('censoredTargetArea');
    censoredArea.innerHTML = '';

    currentTargetWords.forEach((word, idx) => {
        const censoredWord = word.replace(/[a-zA-Z0-9]/g, '*');
        censoredArea.innerHTML += `
                    <button type="button" id="hint-btn-${idx}" onclick="revealWord(${idx})" class="px-2.5 py-1 bg-white hover:bg-gray-200 text-gray-500 rounded-lg text-sm font-mono tracking-widest transition-colors border border-gray-200 shadow-sm flex items-center gap-1" title="Lihat Kata">
                        <i class="fa-solid fa-eye text-[10px] opacity-50"></i> ${censoredWord}
                    </button>
                `;
    });

    document.getElementById('userTyping').focus();
}

window.revealWord = function(idx) {
    revealedIndices.add(idx);
    const btn = document.getElementById(`hint-btn-${idx}`);
    btn.innerHTML = currentTargetWords[idx];
    btn.className = 'px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-bold transition-colors border border-amber-200 shadow-sm';
    btn.onclick = null;
    document.getElementById('userTyping').focus();
};

function checkAnswer() {
    const userInput = document.getElementById('userTyping').value.trim();
    const targetText = sentences[currentIndex].text;

    if (!userInput) {
        alert("Ketik jawabanmu terlebih dahulu!");
        return;
    }

    const cleanWord = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const userWordsClean = userInput.split(/\s+/).map(cleanWord).filter(w => w !== '');

    let resultHTML = '';
    let correctCount = 0;
    let validWordsInSentence = 0;

    currentTargetWords.forEach((displayWord, idx) => {
        const cWord = cleanWord(displayWord);
        if (cWord === "") {
            resultHTML += `<span class="text-gray-800">${displayWord}</span> `;
            return;
        }

        validWordsInSentence++;
        const userWordIndex = userWordsClean.indexOf(cWord);

        if (userWordIndex > -1) {
            if (revealedIndices.has(idx)) {
                resultHTML += `<span class="text-amber-500 font-bold border-b-2 border-amber-500" title="Benar (Pakai Petunjuk)">${displayWord}</span> `;
            } else {
                correctCount++;
                resultHTML += `<span class="text-green-600 font-bold">${displayWord}</span> `;
            }
            userWordsClean.splice(userWordIndex, 1);
        } else {
            resultHTML += `<span class="text-red-500 font-bold line-through" title="Terlewat/Salah ketik">${displayWord}</span> `;
        }
    });

    sessionTotalWords += validWordsInSentence;
    sessionCorrectWords += correctCount;

    if (!isLocalMode) {
        const activeUrl = document.getElementById('ytUrl').value;
        const videoId = extractVideoID(activeUrl);
        if (videoId) {
            const nextIndexToSave = (currentIndex + 1 < sentences.length) ? currentIndex + 1 : currentIndex;
            localStorage.setItem(`vocabmaster_progress_${videoId}`, nextIndexToSave);
        }
    }

    document.getElementById('correctionText').innerHTML = resultHTML;

    const clickableTargetWords = targetText.split(' ').map(word => {
        const pureWord = word.replace(/[^a-zA-Z]/g, '');
        if (!pureWord) return word;
        return `<span onclick="openVocabDetail('${pureWord}')" class="cursor-pointer hover:text-blue-600 hover:underline transition-colors">${word}</span>`;
    }).join(' ');

    document.getElementById('targetTextDisplay').innerHTML = clickableTargetWords;

    document.getElementById('correctionArea').classList.remove('hidden');

    document.getElementById('checkBtn').classList.add('hidden');
    document.getElementById('nextBtn').classList.remove('hidden');

    const sentenceScore = validWordsInSentence > 0 ? (correctCount / validWordsInSentence) * 100 : 100;
    if (sentenceScore >= 80) correctSound.play();
    else wrongSound.play();
}

function exitPracticeSession() {
    if (!isLocalMode) {
        const activeUrl = document.getElementById('ytUrl').value;
        const videoId = extractVideoID(activeUrl);
        if (videoId) {
            localStorage.setItem(`vocabmaster_progress_${videoId}`, currentIndex);
        }
    }

    if (player && typeof player.stopVideo === 'function') player.stopVideo();
    if (playInterval) clearInterval(playInterval);
    if (playAnimationId) cancelAnimationFrame(playAnimationId);

    document.getElementById('setupSection').classList.remove('hidden');
    document.getElementById('practiceSection').classList.add('hidden');
    document.getElementById('practiceSection').classList.remove('flex');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextSentence() {
    if (currentIndex + 1 < sentences.length) {
        currentIndex++;
        updateUI();
        playCurrentSegment();
    } else {
        if (!isLocalMode) {
            const activeUrl = document.getElementById('ytUrl').value;
            const videoId = extractVideoID(activeUrl);
            if (videoId) {
                localStorage.removeItem(`vocabmaster_progress_${videoId}`);
            }
        }

        const finalScore = sessionTotalWords > 0 ? Math.round((sessionCorrectWords / sessionTotalWords) * 100) : 0;
        alert(`🎉 LATIHAN SELESAI!\n\nSkor Akhir Kamu: ${finalScore}%\nKata Benar: ${sessionCorrectWords} dari ${sessionTotalWords} kata.`);

        sessionTotalWords = 0;
        sessionCorrectWords = 0;

        document.getElementById('setupSection').classList.remove('hidden');
        document.getElementById('practiceSection').classList.add('hidden');
        document.getElementById('practiceSection').classList.remove('flex');
        document.getElementById('setupForm').reset();

        if (player && player.stopVideo) player.stopVideo();
        if (playInterval) clearInterval(playInterval);
        if (playAnimationId) cancelAnimationFrame(playAnimationId);

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// --- LOGIKA GALERI BANK VIDEO & PAGINATION ---
let galleryData = [];
let currentGalleryTopic = 'all';
let currentGalleryPage = 1;
const itemsPerPage = 3;

async function loadGallery() {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = '<div class="col-span-full text-center text-sm text-gray-400 py-8"><i class="fa-solid fa-spinner fa-spin mb-2 text-xl"></i><br>Memuat Galeri Video...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('video_bank')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        galleryData = data || [];
        renderGallery();
    } catch (err) {
        grid.innerHTML = '<p class="text-sm text-red-500 col-span-full text-center py-8">Gagal memuat rekomendasi video.</p>';
    }
}

window.setGalleryTopic = function(topic) {
    currentGalleryTopic = topic;
    currentGalleryPage = 1;

    document.querySelectorAll('.topic-btn').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-600');
    });
    event.currentTarget.classList.remove('bg-gray-100', 'text-gray-600');
    event.currentTarget.classList.add('bg-blue-600', 'text-white');

    renderGallery();
}

window.resetGalleryPage = function() {
    currentGalleryPage = 1;
}

window.prevGalleryPage = function() {
    if (currentGalleryPage > 1) {
        currentGalleryPage--;
        renderGallery();
    }
}

window.nextGalleryPage = function() {
    const levelFilter = document.getElementById('galleryLevelFilter').value;
    let filtered = getFilteredGallery(levelFilter);
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (currentGalleryPage < totalPages) {
        currentGalleryPage++;
        renderGallery();
    }
}

function getFilteredGallery(levelFilter) {
    return galleryData.filter(v => {
        let matchLevel = (levelFilter === 'all') || (v.level === levelFilter);
        let matchTopic = true;
        if (currentGalleryTopic !== 'all') {
            const t = v.topic.toLowerCase();
            if (currentGalleryTopic === 'daily') matchTopic = t.includes('daily');
            else if (currentGalleryTopic === 'ted') matchTopic = t.includes('ted');
            else if (currentGalleryTopic === 'bbc') matchTopic = t.includes('bbc');
            else if (currentGalleryTopic === 'song') matchTopic = t.includes('song');
            else if (currentGalleryTopic === 'science') matchTopic = t.includes('science');
        }
        return matchLevel && matchTopic;
    });
}

window.renderGallery = function() {
    const grid = document.getElementById('videoGrid');
    const levelFilter = document.getElementById('galleryLevelFilter').value;
    const paginationContainer = document.getElementById('galleryPagination');

    grid.innerHTML = '';

    let filtered = getFilteredGallery(levelFilter);
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

    if (currentGalleryPage > totalPages) {
        currentGalleryPage = totalPages;
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="text-sm text-gray-500 col-span-full text-center py-8"><i class="fa-solid fa-video-slash text-2xl mb-2 text-gray-300"></i><br>Belum ada video di kategori ini.</p>';
        paginationContainer.classList.add('hidden');
        return;
    }

    paginationContainer.classList.remove('hidden');

    const startIndex = (currentGalleryPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, endIndex);

    paginatedItems.forEach(v => {
        const thumbUrl = `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`;

        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group flex flex-col';

        card.onclick = () => {
            switchTab('youtube');
            document.getElementById('ytUrl').value = v.url;

            window.scrollTo({
                top: document.getElementById('setupSection').offsetTop - 20,
                behavior: 'smooth'
            });

            startListeningSession(v.url);
        };

        card.innerHTML = `
                    <div class="relative aspect-video bg-gray-100 overflow-hidden">
                        <img src="${thumbUrl}" alt="Thumbnail" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                        <div class="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded">
                            ${v.level}
                        </div>
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div class="w-12 h-12 bg-blue-600/90 rounded-full flex items-center justify-center text-white shadow-lg">
                                <i class="fa-solid fa-play ml-1 text-lg"></i>
                            </div>
                        </div>
                    </div>
                    <div class="p-3 bg-white flex flex-col gap-1.5 flex-1">
                        <span class="inline-block self-start text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">${v.topic}</span>
                        <h4 class="text-xs font-bold text-gray-800 line-clamp-2 leading-snug">${v.title || 'Video Latihan Listening'}</h4>
                    </div>
                `;
        grid.appendChild(card);
    });

    document.getElementById('pageIndicator').textContent = `Halaman ${currentGalleryPage} dari ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = (currentGalleryPage === 1);
    document.getElementById('nextPageBtn').disabled = (currentGalleryPage === totalPages);
}

// FUNGSI DETAIL VOCAB YANG SUDAH DIPERBARUI
let selectedActiveWord = '';
let selectedWordData = null;

async function openVocabDetail(word) {
    if (!word) return;
    selectedActiveWord = word.toLowerCase();

    const formattedWord = selectedActiveWord.charAt(0).toUpperCase() + selectedActiveWord.slice(1);

    // Tampilkan state loading UI
    document.getElementById('modalVocabWord').textContent = formattedWord;
    document.getElementById('modalVocabLevel').textContent = '...';
    document.getElementById('modalVocabPos').textContent = 'Memuat...';
    document.getElementById('modalVocabMeaning').textContent = 'Memuat arti...';
    document.getElementById('modalVocabExamples').innerHTML = 'Memuat contoh kalimat...';
    document.getElementById('vocabDetailModal').classList.remove('hidden');

    try {
        // --- TAHAP 1: CEK DI DATABASE MASTER TERLEBIH DAHULU ---
        const checkReq = await fetch('/api/check-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: selectedActiveWord })
        });
        const checkRes = await checkReq.json();

        if (checkRes.success && checkRes.data) {
            // Vocab sudah ada di Database, langsung gunakan (hemat AI)
            selectedWordData = checkRes.data;

            document.getElementById('modalVocabLevel').textContent = checkRes.data.level || 'A1';
            document.getElementById('modalVocabPos').textContent = checkRes.data.type || 'NOUN';
            document.getElementById('modalVocabMeaning').textContent = checkRes.data.meaning || 'Tidak ada arti';

            const contextText = checkRes.data.context || '';
            const examplesArray = contextText.split('\n').filter(Boolean);

            if (examplesArray.length > 0) {
                document.getElementById('modalVocabExamples').innerHTML = examplesArray.map((ex, idx) =>
                    `<div>${idx + 1}. ${ex}</div>`
                ).join('');
            } else {
                document.getElementById('modalVocabExamples').innerHTML = `<div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation.</div>`;
            }
            return; // Selesai, hentikan fungsi agar tidak memanggil AI
        }

        // --- TAHAP 2: VALIDASI KUOTA AI UNTUK USER FREE ---
        if (!isProUser && userAiVocabQuota <= 0) {
            closeVocabDetailModal();
            alert(`Peringatan: Kuota AI Vocab kamu telah habis dan kata "${formattedWord}" belum tersedia di database kami.\n\nSilakan upgrade ke paket PRO untuk generate vocab tanpa batas!`);
            return; // Hentikan proses, tidak jadi fetch ke AI
        }

        // --- TAHAP 3: GENERATE MENGGUNAKAN AI ---
        document.getElementById('modalVocabPos').textContent = 'Generate AI...';

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

            const contextText = res.data.context || '';
            const examplesArray = contextText.split('\n').filter(Boolean);

            if (examplesArray.length > 0) {
                document.getElementById('modalVocabExamples').innerHTML = examplesArray.map((ex, idx) =>
                    `<div>${idx + 1}. ${ex}</div>`
                ).join('');
            } else {
                document.getElementById('modalVocabExamples').innerHTML = `<div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation.</div>`;
            }

            // --- TAHAP 4: POTONG KUOTA USER FREE JIKA GENERATE BERHASIL ---
            if (!isProUser) {
                userAiVocabQuota -= 1;
                // Update ke backend Supabase
                await supabaseClient
                    .from('profiles')
                    .update({ ai_vocab_quota: userAiVocabQuota })
                    .eq('id', currentUser.id);
            }

        } else {
            throw new Error(res.message || "Gagal mengambil detail kata dari AI.");
        }
    } catch (err) {
        console.error(err);
        document.getElementById('modalVocabPos').textContent = 'NOUN';
        document.getElementById('modalVocabMeaning').textContent = 'Kosakata umum bahasa Inggris.';
        document.getElementById('modalVocabExamples').innerHTML = `<div>1. She uses <b>${selectedActiveWord}</b> in her daily conversation.</div>`;
    }
}

function closeVocabDetailModal() {
    document.getElementById('vocabDetailModal').classList.add('hidden');
}

async function saveVocabToDatabase() {
    if (!currentUser || !selectedActiveWord) return;

    const btn = document.getElementById('modalSaveVocabBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const meaningText = document.getElementById('modalVocabMeaning').textContent;
        const typeText = document.getElementById('modalVocabPos').textContent;
        const levelText = document.getElementById('modalVocabLevel').textContent;
        const contextText = document.getElementById('modalVocabExamples').innerText;

        let vocabId = null;

        // Tahap 1 & 2: Gunakan API backend untuk Bypass RLS dan simpan ke Master Vocabularies
        const apiReq = await fetch('/api/save-master-vocab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                word: selectedActiveWord,
                meaning: meaningText,
                type: typeText,
                context: contextText,
                level: levelText || 'A1',
                synonyms: selectedWordData ?.synonyms || [],
                word_family: selectedWordData ?.word_family || [],
                verb_forms: selectedWordData ?.verb_forms || null
            })
        });

        const apiRes = await apiReq.json();

        if (!apiRes.success) {
            throw new Error(apiRes.message || "Gagal memverifikasi master kosakata.");
        }

        // Dapatkan ID vocabulary dari response API
        vocabId = apiRes.id;

        // Tahap 3: Penyisipan relasi Many-to-Many pada tabel 'user_vocabularies'
        const { error: relationError } = await supabaseClient
            .from('user_vocabularies')
            .insert([{
                user_id: currentUser.id,
                vocabulary_id: vocabId,
                is_memorized: false
            }]);

        if (relationError) {
            // Penanganan kasus duplikasi relasi (jika pengguna sudah menyimpan kata yang sama)
            if (relationError.code === '23505') {
                throw new Error("Kosakata ini sudah terdapat di dalam daftar simpanan Anda.");
            }
            throw relationError;
        }

        alert("Kosakata berhasil disimpan ke daftar vocab!");
        closeVocabDetailModal();
    } catch (err) {
        console.error("Kesalahan integrasi basis data: ", err);
        alert(err.message || "Terjadi kesalahan sistem saat menyimpan kosakata.");
        closeVocabDetailModal();
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
