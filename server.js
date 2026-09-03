require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const midtransClient = require('midtrans-client');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();

// Tingkatkan limit json dan urlencoded jika sewaktu-waktu dibutuhkan
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(__dirname));
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/grammar_checker', (req, res) => {
    res.sendFile(path.join(__dirname, 'grammar_checker.html'));
});

app.get('/payment-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment-success.html'));
});

app.get('/payment-failed', (req, res) => {
    res.sendFile(path.join(__dirname, 'payment-failed.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/translator', (req, res) => {
    res.sendFile(path.join(__dirname, 'translator.html'));
});

app.get('/speaking_naskah', (req, res) => {
    res.sendFile(path.join(__dirname, 'speaking_naskah.html'));
});

app.get('/listening', (req, res) => {
    res.sendFile(path.join(__dirname, 'listening.html'));
});

app.get('/withdrawal', (req, res) => {
    res.sendFile(path.join(__dirname, 'withdrawal.html'));
});

app.get('/affiliate', (req, res) => {
    res.sendFile(path.join(__dirname, 'affiliate.html'));
});

app.get('/community', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'game.html'));
});

const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const snap = new midtransClient.Snap({
    isProduction: false,
    // Production: isProduction: true
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.ADMIN_EMAIL, 
        pass: process.env.ADMIN_EMAIL_PASSWORD 
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        clientKey: process.env.MIDTRANS_CLIENT_KEY
    });
});

app.post('/api/create-payment', async(req, res) => {
    try {
        // TANGKAP referralCode dari req.body
        const { email, durationMonths, amount, packageName, referralCode } = req.body; 
        
        const parameter = {
            transaction_details: {
                order_id: `VM-PRO-${durationMonths}M-${Date.now()}`,
                gross_amount: amount
            },
            customer_details: { email: email },
            custom_field1: durationMonths.toString(),
            custom_field2: email,
            custom_field3: referralCode || 'NONE', // --> INJEKSI KE MIDTRANS
            item_details: [{
                id: `pro_${durationMonths}_months`,
                price: amount,
                quantity: 1,
                name: `VocabMaster Pro - ${packageName}`
            }]
        };
        const transaction = await snap.createTransaction(parameter);
        res.json({ success: true, token: transaction.token, redirect_url: transaction.redirect_url });
    } catch (error) {
        console.error("Midtrans Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Deklarasikan Set ini di luar rute untuk mencegah webhook ganda (Idempotency)
const processedOrders = new Set();

app.post('/api/midtrans-webhook', (req, res) => {
    const notification = req.body;
    snap.transaction.notification(notification)
        .then(async(statusResponse) => {
            let transactionStatus = statusResponse.transaction_status;
            let durationMonths = parseInt(statusResponse.custom_field1 || '1', 10);
            let userEmail = statusResponse.custom_field2 || (statusResponse.customer_details ? statusResponse.customer_details.email : null);
            let referralCode = statusResponse.custom_field3;
            let grossAmount = parseFloat(statusResponse.gross_amount);
            let orderId = statusResponse.order_id; // Ambil order ID

            // 1. PENCEGAHAN DOUBLE ENTRY (MEMORI)
            if (processedOrders.has(orderId)) {
                return res.status(200).json({ status: "OK", message: "Already processed" });
            }

            if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
                
                // 2. PENCEGAHAN DOUBLE ENTRY (DATABASE)
                if (referralCode && referralCode !== 'NONE') {
                    const fiveMinsAgo = new Date(Date.now() - 5 * 60000).toISOString();
                    const { data: existingLog } = await supabase
                        .from('commission_history')
                        .select('id')
                        .eq('buyer_email', userEmail)
                        .gte('created_at', fiveMinsAgo)
                        .maybeSingle();

                    if (existingLog) {
                        processedOrders.add(orderId);
                        return res.status(200).json({ status: "OK", message: "Duplicate prevented by DB" });
                    }
                }

                processedOrders.add(orderId);

                // ==========================================
                // SOLUSI REFERRED_BY: Variabel diangkat (Hoisted)
                // ==========================================
                let targetUserId = null; 

                // --- 3. LOGIKA UPDATE STATUS PRO ---
                if (userEmail) {
                    const { data: users } = await supabase.auth.admin.listUsers();
                    const targetUser = users?.users.find(u => u.email === userEmail);

                    if (targetUser) {
                        targetUserId = targetUser.id; // Simpan ID ke variabel di luar blok
                        
                        let expiredDate = new Date();
                        expiredDate.setMonth(expiredDate.getMonth() + durationMonths);

                        await supabase.from('profiles').update({ 
                            pro_expired_at: expiredDate.toISOString(),
                            is_pro: true 
                        }).eq('id', targetUserId);
                    }
                }

                // --- 4. LOGIKA PENAMBAHAN KOMISI AFILIASI & RIWAYAT ---
                if (referralCode && referralCode !== 'NONE') {
                    const { data: referrerProfile } = await supabase
                        .from('profiles')
                        .select('id, wallet_balance')
                        .eq('referral_code', referralCode)
                        .single();
                
                    if (referrerProfile) {
                        const commission = grossAmount * 0.25;
                        const currentBalance = referrerProfile.wallet_balance || 0;
                        const newBalance = currentBalance + commission;
                
                        // A. Eksekusi pembaruan saldo dompet afiliator
                        await supabase
                            .from('profiles')
                            .update({ wallet_balance: newBalance })
                            .eq('id', referrerProfile.id);
                        
                        // B. Insersi data log transaksi ke dalam tabel riwayat
                        await supabase
                            .from('commission_history')
                            .insert([{
                                referrer_id: referrerProfile.id,
                                buyer_email: userEmail,
                                commission_amount: commission
                            }]);
                
                        // C. Pembaruan relasi (referred_by) pada entitas pembeli (Sekarang akan berhasil)
                        if (targetUserId) {
                            await supabase
                                .from('profiles')
                                .update({ referred_by: referralCode })
                                .eq('id', targetUserId);
                        }
                
                        console.log(`Komisi Rp${commission} ditambahkan untuk ${referralCode} dan riwayat dicatat.`);
                    }
                }
            }
            res.status(200).json({ status: "OK" });
        })
        .catch((err) => {
            console.error("Webhook Error:", err.message);
            res.status(500).json({ error: err.message });
        });
});

// --- API GET YOUTUBE TRANSCRIPT & AUTO-SAVE KE BANK VIDEO ---
app.post('/api/get-transcript', async (req, res) => {
    try {
        const { videoUrl } = req.body;
        
        if (!videoUrl) return res.status(400).json({ success: false, message: "URL YouTube tidak boleh kosong." });

        const match = videoUrl.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        const videoId = (match && match[2].length === 11) ? match[2] : null;

        if (!videoId) return res.status(400).json({ success: false, message: "Link YouTube tidak valid." });

        // ==============================================================
        // 1. CEK DULU DI SUPABASE (BANK VIDEO)
        // ==============================================================
        const { data: existingVideo } = await supabase.from('video_bank').select('*').eq('video_id', videoId).single();

        // JIKA SUDAH ADA DI DATABASE: Langsung kembalikan data tanpa nembak API luar!
        if (existingVideo && existingVideo.transcript_data) {
            console.log(`✅ [CACHE HIT] Mengambil transkrip video ${videoId} langsung dari Supabase...`);
            return res.json({ 
                success: true, 
                data: existingVideo.transcript_data, 
                level: existingVideo.level, 
                topic: existingVideo.topic,
                title: existingVideo.title 
            });
        }

        // ==============================================================
        // 2. JIKA BELUM ADA, BARU TEMBAK TRANSCRIPT API
        // ==============================================================
        console.log(`🌐 [API CALL] Mengambil transkrip video ${videoId} dari TranscriptAPI...`);
        const targetUrl = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${videoId}&format=json`;
        
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${process.env.TRANSCRIPT_API_KEY}` }
        });

        if (!response.ok) throw new Error(`Koneksi API ditolak (HTTP ${response.status})`);

        const data = await response.json();
        if (!data || !data.transcript || !Array.isArray(data.transcript)) {
            throw new Error("Transkrip tidak ditemukan di video ini.");
        }

        // Olah dan bersihkan data transkrip
        const transcriptArray = data.transcript.map(item => {
            const start = item.start || item.offset || 0;
            const duration = item.duration || 2;
            let text = item.text || "";

            text = text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
            text = text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '');
            text = text.replace(/[@#$%^&*~`_+=|\\<>{}\/]/g, '');
            text = text.replace(/\s+/g, ' ').trim();

            return {
                text: text,
                start: parseFloat(start),
                end: parseFloat(start) + parseFloat(duration)
            };
        }).filter(item => item.text.length > 1);

        if (transcriptArray.length === 0) throw new Error("Transkrip kosong atau hanya berisi audio latar/musik.");

        // ==============================================================
        // 3. AI KLASIFIKASI & AUTO-SAVE KE SUPABASE
        // ==============================================================
        let videoLevel = "B1"; 
        let videoTopic = "Others"; 
        let videoTitle = "English Learning Video";

        try {
            const apiKey = getNextApiKey();
            if (apiKey) {
                const sampleText = transcriptArray.map(t => t.text).join(' ').substring(0, 1500);
                
                const prompt = `Analyze this English video transcript snippet.
                1. Determine its English proficiency level (A1, A2, B1, B2, or C1).
                2. Determine its closest topic category from this strict list: [Daily Conversation, TED Talks, BBC Learning, US/UK Song, Science, Others].
                3. Create a short, clean, descriptive title for this video based on its content (maximum 6 words).
                
                Transcript: "${sampleText}"
                
                Return ONLY valid JSON format: {"level": "A2", "topic": "Daily Conversation", "title": "Ordering Food at a Restaurant"}`;

                const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.2 }
                    })
                });

                const aiData = await aiRes.json();
                if (aiData.candidates && aiData.candidates[0].content.parts[0].text) {
                    let cleanJson = aiData.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);

                    videoLevel = parsed.level || 'B1';
                    videoTopic = parsed.topic || 'Others';
                    videoTitle = parsed.title || 'English Learning Video';
                }
            }

            // SIMPAN KE SUPABASE (Termasuk kolom title dan transcript_data)
            await supabase.from('video_bank').insert([{
                video_id: videoId,
                url: videoUrl,
                level: videoLevel,
                topic: videoTopic,
                title: videoTitle,
                transcript_data: transcriptArray 
            }]);

        } catch (err) {
            console.error("Gagal klasifikasi & simpan video:", err.message);
        }

        res.json({ success: true, data: transcriptArray, level: videoLevel, topic: videoTopic, title: videoTitle });
    } catch (error) {
        console.error("Transcript API Error:", error.message);
        res.status(500).json({ success: false, message: "Gagal mengambil transkrip: " + error.message });
    }
});

const geminiApiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(key => key !== undefined && key !== ''); 

let currentKeyIndex = 0;

function getNextApiKey() {
    if (geminiApiKeys.length === 0) return null;
    const key = geminiApiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % geminiApiKeys.length;
    return key;
}

app.post('/api/generate-vocab', async(req, res) => {
    try {
        const { word, meaning, type, context } = req.body;
        const apiKey = getNextApiKey();

        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Tidak ada GEMINI_API_KEY yang terdeteksi di .env" });
        }

        const prompt = `Analisis masukan berikut: "${word}".
        Tugas pertamamu adalah mendeteksi apakah masukan tersebut adalah kata atau kalimat bahasa Inggris yang valid.
        - Jika BUKAN bahasa Inggris (misalnya bahasa Indonesia, bahasa gaul lokal, atau sekadar ketikan acak), atur "is_english" menjadi false dan biarkan field lainnya null.
        - Jika BENAR bahasa Inggris, atur "is_english" menjadi true dan bedah secara lengkap layaknya kamus profesional Oxford/Cambridge.
        
        Kondisi saat ini dari pengguna:
        - Arti: ${meaning ? meaning : 'Otomatis temukan terjemahan bahasa Indonesianya yang paling akurat.'}
        - Jenis Kata: ${type !== 'Auto' ? type : 'Tentukan (Noun, Verb, Adjective, Adverb, Pronoun, Preposition, Conjunction, Phrase, Determiner, Interjection, atau Idiom).'}
        - Contoh dari user: ${context ? `"${context}"` : 'Tidak ada.'}
        
        SYARAT OUTPUT MUTLAK (HANYA DALAM FORMAT JSON MURNI TANPA MARKDOWN):
        {
            "is_english": true atau false,
            "definition": "Makna atau definisi kata dalam bahasa Inggris (English definition. Null jika bukan bahasa Inggris)",
            "meaning": "Terjemahan bahasa Indonesia yang relevan (null jika bukan bahasa inggris)",
            "type": "Jenis kata (null jika bukan bahasa inggris)",
            "level": "A1/A2/B1/B2/C1 (null jika bukan bahasa inggris)",
            "context": "5 contoh kalimat dipisah (dan artinya dalam bahasa indonesia di dalam kurung setelah kalimat bahasa inggrisnya) \\n (null jika bukan bahasa inggris)",
            "synonyms": ["sinonim1", "sinonim2"],
            "word_family": [
                {"word": "action", "type": "Noun"},
                {"word": "actor", "type": "Noun"},
                {"word": "active", "type": "Adjective"},
                {"word": "actively", "type": "Adverb"},
                {"word": "inative", "type": "Adjective"},
                {"word": "react", "type": "Verb"}
            ],
            "verb_forms": null // Isi v1,v2,v3,ving JIKA DAN HANYA JIKA Verb.
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let textOutput = data.candidates[0].content.parts[0].text.trim();
            textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(textOutput);
            
            if (parsedJson.is_english === false) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Kata "${word}" ditolak karena bukan bahasa Inggris yang valid.` 
                });
            }

            res.json({ success: true, data: parsedJson });
        } else {
            throw new Error("Gagal mendapatkan respons dari Gemini AI.");
        }

    } catch (error) {
        console.error("Gemini Backend Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API KLASIFIKASI KONTEN BANTUAN AI ---
app.post('/api/classify-content', async(req, res) => {
    try {
        const { title, category, creator, tahun } = req.body;
        const apiKey = getNextApiKey();

        if (!apiKey) {
            return res.status(500).json({ success: false, message: "Tidak ada GEMINI_API_KEY yang terdeteksi." });
        }

        if (!title) {
            return res.status(400).json({ success: false, message: "Judul konten wajib diisi." });
        }

        const prompt = `Sebagai kurator konten dan ahli literasi bahasa, analisislah karya berikut:
        Kategori: ${category}
        Judul: ${title}
        Pembuat/Penulis/Artis: ${creator || 'Tidak spesifik'}
        Tahun Rilis: ${tahun}

        Tugas Anda adalah memprediksi 2 metrik secara akurat:
        1. "level": Tingkat kesulitan bahasa Inggris (A1, A2, B1, B2, atau C1). Prediksi kompleksitas dialog/kosa kata yang umumnya ada pada judul karya tersebut.
        2. "is_adult": Boolean (true/false). Analisis apakah konten tersebut diklasifikasikan sebagai 18+ atau untuk penonton dewasa (misal memuat kekerasan grafis, bahasa kasar, atau unsur seksual) berdasar standar rating film/buku/lagu internasional (R-rated, Mature, Parental Advisory).

        KEMBALIKAN OUTPUT HANYA DALAM BENTUK JSON MURNI TANPA MARKDOWN DAN TANPA TEKS LAINNYA.
        Contoh Format Output:
        {
            "level": "B2",
            "is_adult": false
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 } // Temperature rendah agar prediksi deterministik
            })
        });

        const data = await response.json();

        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let textOutput = data.candidates[0].content.parts[0].text.trim();
            // Pembersihan markdown JSON pembungkus
            textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(textOutput);
            
            res.json({ success: true, data: parsedJson });
        } else {
            throw new Error("Gagal mendapatkan respons konklusif dari AI.");
        }

    } catch (error) {
        console.error("Gemini Classification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API GENERATE VLOG SCRIPT ---
app.post('/api/generate-vlog', async(req, res) => {
            try {
                const { level, topic } = req.body;
                const apiKey = getNextApiKey();
        
                if (!apiKey) {
                    return res.status(500).json({ success: false, message: "Tidak ada GEMINI_API_KEY yang terdeteksi." });
                }
        
                const prompt = `Bertindaklah sebagai pembuat naskah bahasa Inggris yang profesional tapi kalimat awal jangan pakai kalimat umum seperti Hello, welcome back my channel serta kalimat akhir nya jangan nyuruh komen atau subscribe atau berterima kasih karena terlalu basic.
        Buatkan naskah bahasa Inggris level ${level} dengan topik "${topic}" menggunakan grammar yang benar.
        Syarat mutlak:
        1. Panjang naskah MINIMAL 200 KATA dan MAKSIMAL 300 KATA.
        2. Panjang SETIAP KALIMAT minimal 7 kata dan maksimal 10 kata (kalimat pendek-pendek).
        3. Gunakan gaya bahasa natural, kasual, "spoken English", atau "native-like" yang cocok untuk diucapkan di video.
        4. Berikan HANYA teks naskahnya saja tanpa tambahan markdown, tanpa judul, dan tanpa penutup/pembuka dari AI.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let textOutput = data.candidates[0].content.parts[0].text.trim();
            res.json({ success: true, data: textOutput });
        } else {
            throw new Error("Gagal membuat naskah.");
        }
    } catch (error) {
        console.error("Vlog Generator Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/correct-sentence', async(req, res) => {
            try {
                const { sentence } = req.body;
                const apiKey = getNextApiKey();
        
                if (!apiKey) {
                    return res.status(500).json({ success: false, message: "Tidak ada GEMINI_API_KEY yang terdeteksi di .env" });
                }
        
                if (!sentence) {
                    return res.status(400).json({ success: false, message: "Kalimat tidak boleh kosong." });
                }
        
                const prompt = `Bertindaklah sebagai guru bahasa Inggris (English Teacher). Tolong periksa dan perbaiki grammar, vocabulary, dan struktur dari kalimat bahasa Inggris berikut: "${sentence}".
        Jika kalimat sudah benar, beritahu bahwa kalimat tersebut sudah tepat, tetapi berikan alternatif kalimat yang lebih natural (native-like) jika memungkinkan.
        
        Berikan respons HANYA dalam format JSON murni tanpa markdown, dengan struktur persis seperti ini:
        {
            "original": "kalimat asli",
            "corrected": "Kalimat yang sudah diperbaiki atau versi lebih natural",
            "explanation": "Penjelasan singkat dalam bahasa Indonesia mengenai apa yang salah, mengapa disalahkan, dan alasan di balik perbaikannya."
        }`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let textOutput = data.candidates[0].content.parts[0].text.trim();
            textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedJson = JSON.parse(textOutput);
            
            res.json({ success: true, data: parsedJson });
        } else {
            throw new Error("Gagal mendapatkan respons dari Gemini AI.");
        }

    } catch (error) {
        console.error("Gemini Corrector Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/humanize-translation', async(req, res) => {
            try {
                const { text } = req.body;
                const apiKey = getNextApiKey();
        
                if (!apiKey) {
                    return res.status(500).json({ success: false, message: "Tidak ada GEMINI_API_KEY yang terdeteksi." });
                }
        
                if (!text) {
                    return res.status(400).json({ success: false, message: "Teks masukan tidak boleh kosong." });
                }
        
                const prompt = `Translate the following Indonesian text into English. After translating, YOU MUST act as a writing editor and apply the "Humanizer" guidelines provided below to the English translation to remove all signs of AI-generated text.
        
        INDONESIAN TEXT TO TRANSLATE:
        """
        ${text}
        """
        
        HUMANIZER GUIDELINES (Strictly Follow These):
        1. Rewrite, don't delete - Replace AI-isms with natural alternatives, preserving the original meaning and structure.
        2. PERSONALITY AND SOUL: Vary your rhythm (mix short punchy sentences with longer ones). Let some mess in. Do not use sterile, voiceless writing.
        3. CONTENT PATTERNS TO AVOID: Do not use undue emphasis on significance (e.g., "stands as", "testament to", "pivotal moment"). Avoid superficial "-ing" endings ("highlighting...", "showcasing..."). Avoid promotional language ("vibrant", "breathtaking"). Avoid formulaic outline-like sections.
        4. VOCABULARY TO AVOID: Delve, intricate, tapestry, vibrant, bustling, pivotal, showcase, underscore, testament, elevate, seamless. Avoid copula avoidance (use simple "is/are" instead of "serves as/boasts").
        5. STYLE PATTERNS TO AVOID: Cut all Em Dashes (—) and En Dashes (–). Avoid elegant variation (synonym cycling). Do not use conversational rhetorical openers like "Look," or "Honestly?".
        6. FILLER AND HEDGING: Avoid excessive hedging and filler phrases ("In order to achieve this goal" -> "To achieve this"). Do not end with generic positive conclusions (e.g., "The future looks bright").
        
        OUTPUT FORMAT INSTRUCTION:
        Return ONLY the final, humanized English text. Do not output any conversational filler, explanations, or markdown formatting (do NOT wrap the output in \`\`\` or any JSON blocks). Just the raw translated text.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }
            })
        });

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            let textOutput = data.candidates[0].content.parts[0].text.trim();
            res.json({ success: true, data: textOutput });
        } else {
            throw new Error("Gagal melakukan proses translasi.");
        }

    } catch (error) {
        console.error("Gemini Humanizer Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/report-recommendation', async(req, res) => {
    try {
        const { itemId, reason, userId } = req.body; 

        const { data: rec } = await supabase.from('recommendations').select('*').eq('id', itemId).single();
        if (!rec) return res.status(404).json({ success: false, message: "Konten tidak ditemukan" });

        let reportedBy = rec.reported_by || [];
        if (reportedBy.includes(userId)) {
            return res.status(400).json({ success: false, message: "Kamu sudah pernah melaporkan konten ini." });
        }

        reportedBy.push(userId);
        const currentReports = (rec.reports_count || 0) + 1;
        const limitToDelete = 5;

        if (currentReports >= limitToDelete) {
            await supabase.from('recommendations').delete().eq('id', itemId);
        } else {
            await supabase.from('recommendations').update({ 
                reports_count: currentReports, 
                reported_by: reportedBy 
            }).eq('id', itemId);
        }

        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: 'shinta.nur119@gmail.com',
            subject: `[PERINGATAN] Konten Komunitas Dilaporkan: ${rec.title}`,
            text: `Halo Admin,\n\nSebuah konten rekomendasi di VocabMaster telah dilaporkan.\n\nDetail:\n- Judul: ${rec.title}\n- Kategori: ${rec.category}\n- Alasan: ${reason}\n- Total Laporan: ${currentReports}\n\n${currentReports >= limitToDelete ? 'Konten ini telah DIHAPUS OTOMATIS.' : 'Silakan review manual.'}`
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Laporan berhasil diproses." });
    } catch (error) {
        console.error("Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- API Pengajuan Penarikan Dana (Oleh User) ---
app.post('/api/request-withdrawal', async (req, res) => {
    try {
        const { userId, email, bankName, accountNumber, accountName, amount } = req.body;
        const requestAmount = parseInt(amount, 10);

        // 1. Cek apakah user masih memiliki penarikan berstatus 'pending'
        const { data: pendingWd } = await supabase.from('withdrawals').select('id').eq('user_id', userId).eq('status', 'pending');
        if (pendingWd && pendingWd.length > 0) {
            return res.status(400).json({ success: false, message: "Kamu masih memiliki pengajuan penarikan yang sedang diproses. Mohon tunggu." });
        }

        // 2. Cek Saldo User (Mencegah Bypass)
        const { data: userProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', userId).single();
        
        if (!userProfile || userProfile.wallet_balance < 15000 || userProfile.wallet_balance < requestAmount) {
            return res.status(400).json({ success: false, message: "Saldo tidak mencukupi untuk ditarik." });
        }

        // 3. Catat penarikan ke tabel Withdrawals (Saldo BELUM dipotong)
        const { data: wdRecord, error: wdError } = await supabase.from('withdrawals').insert([{
            user_id: userId,
            bank_name: bankName,
            account_number: accountNumber,
            account_name: accountName,
            amount: requestAmount,
            status: 'pending'
        }]).select().single();

        if (wdError) throw wdError;

        // 4. Kirim Notifikasi WA ke Admin dengan format yang sudah terbukti berhasil
        const adminWhatsapp = "6285743256774"; 
        
        // Menggunakan format lamamu yang aman dari blokir, cukup diselipkan ID Penarikan
        const waMessage = `🚨 *PENARIKAN BARU MASUK!* 🚨\n\nDari: ${email}\nJumlah: Rp ${requestAmount.toLocaleString('id-ID')}\nSaldo Dia: Rp ${userProfile.wallet_balance.toLocaleString('id-ID')}\n\nBank: ${bankName}\nRekening: ${accountNumber}\nNama: ${accountName}\nID: ${wdRecord.id}\n\nSilakan transfer secara manual dan ubah status di web admin.`;
        
        try {
            const fonnteResponse = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': process.env.FONNTE_TOKEN
                },
                body: new URLSearchParams({
                    target: adminWhatsapp,
                    message: waMessage
                })
            });

            const fonnteData = await fonnteResponse.json();
            if (!fonnteData.status) {
                console.error("❌ API FONNTE DITOLAK:", fonnteData.reason);
            }
        } catch (fonnteErr) {
            console.error("❌ GAGAL MENGHUBUNGI FONNTE:", fonnteErr.message);
        }

        res.json({ success: true, message: "Penarikan diajukan. Mohon tunggu proses dari admin." });
    } catch (err) {
        console.error("DETAIL WITHDRAWAL ERROR:", err.message, err.stack);
        res.status(500).json({ success: false, message: "Kesalahan server: " + err.message });
    }
});

// --- API Pengambilan Data Penarikan untuk Halaman Admin ---
app.get('/api/admin/withdrawal/:id', async (req, res) => {
    try {
        const { data: wd, error } = await supabase.from('withdrawals').select('*').eq('id', req.params.id).single();
        if (error || !wd) throw new Error("Data penarikan tidak ditemukan.");
        
        // Ambil saldo terbaru user
        const { data: profile } = await supabase.from('profiles').select('wallet_balance').eq('id', wd.user_id).single();
        
        res.json({ success: true, data: { ...wd, current_balance: profile ? profile.wallet_balance : 0 } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- API Eksekusi/Update Penarikan oleh Admin ---
app.post('/api/admin/update-withdrawal', async (req, res) => {
    try {
        const { id, status, proofLink } = req.body; 
        
        // 1. Verifikasi Status Penarikan
        const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', id).single();
        if (!wd) return res.status(404).json({ success: false, message: "Data penarikan tidak ditemukan." });
        if (wd.status !== 'pending') return res.status(400).json({ success: false, message: "Penarikan ini sudah pernah diproses." });

        // 2. Dapatkan Email User & Profil
        const { data: profile } = await supabase.from('profiles').select('wallet_balance, id').eq('id', wd.user_id).single();
        const { data: authData } = await supabase.auth.admin.getUserById(wd.user_id);
        const userEmail = authData?.user?.email;

        if (status === 'success') {
            // Verifikasi saldo lagi sebelum memotong
            if (profile.wallet_balance < wd.amount) {
                return res.status(400).json({ success: false, message: "Saldo user saat ini tidak mencukupi!" });
            }
            
            // POTONG SALDO SECARA RESMI DI DATABASE
            const newBalance = profile.wallet_balance - wd.amount;
            await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', wd.user_id);
            
            // UBAH STATUS PENARIKAN (Jika ada kolom proof_link di database, bisa disimpan. Jika tidak, simpan status saja)
            await supabase.from('withdrawals').update({ status: 'success' }).eq('id', id);

            // KIRIM EMAIL BUKTI TRANSFER KE USER (Link GDrive diletakkan di body email)
            if (userEmail) {
                const proofHtml = proofLink 
                    ? `<div style="margin-top: 15px; padding: 10px; border-left: 4px solid #2563eb; background-color: #eff6ff;">
                          <p style="margin: 0; color: #1e3a8a;"><strong>Link Bukti Transfer:</strong> <a href="${proofLink}" target="_blank" style="color: #2563eb; word-break: break-all;">Lihat Bukti Transfer</a></p>
                       </div>`
                    : '';

                const mailOptions = {
                    from: `"VocabMaster Admin" <${process.env.ADMIN_EMAIL}>`,
                    to: userEmail,
                    subject: '✅ Penarikan Dana Kamu Berhasil',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
                            <h2 style="color: #16a34a; text-align: center;">Penarikan Berhasil!</h2>
                            <p>Halo,</p>
                            <p>Pengajuan penarikan dana kamu sebesar <b>Rp ${wd.amount.toLocaleString('id-ID')}</b> telah berhasil kami transfer ke rekening berikut:</p>
                            
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p style="margin: 0;">Bank/E-Wallet: <b>${wd.bank_name}</b></p>
                                <p style="margin: 0;">Nomor Rekening: <b>${wd.account_number}</b></p>
                                <p style="margin: 0;">Atas Nama: <b>${wd.account_name}</b></p>
                            </div>

                            <p>Sisa saldo di dompet kamu saat ini adalah <b>Rp ${newBalance.toLocaleString('id-ID')}</b>.</p>
                            
                            ${proofHtml}

                            <p style="margin-top: 20px;">Terima kasih telah bergabung di program afiliasi VocabMaster!</p>
                        </div>
                    `
                };
                await transporter.sendMail(mailOptions);
            }
        } else if (status === 'failed') {
            // JIKA GAGAL: Update status saja, SALDO TIDAK DIPOTONG
            await supabase.from('withdrawals').update({ status: 'failed' }).eq('id', id);
            
            if (userEmail) {
                const mailOptions = {
                    from: `"VocabMaster Admin" <${process.env.ADMIN_EMAIL}>`,
                    to: userEmail,
                    subject: '❌ Penarikan Dana Dibatalkan',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
                            <h2 style="color: #dc2626; text-align: center;">Penarikan Gagal/Dibatalkan</h2>
                            <p>Halo,</p>
                            <p>Mohon maaf, pengajuan penarikan kamu sebesar <b>Rp ${wd.amount.toLocaleString('id-ID')}</b> tidak dapat diproses saat ini atau dibatalkan oleh admin.</p>
                            <p><b>Tenang saja, saldo di akun kamu tidak dipotong.</b></p>
                            <p>Silakan periksa kembali apakah nomor rekening/e-wallet kamu sudah valid, atau hubungi admin untuk informasi lebih lanjut.</p>
                        </div>
                    `
                };
                await transporter.sendMail(mailOptions);
            }
        }

        res.json({ success: true, message: `Status penarikan berhasil diubah menjadi ${status.toUpperCase()}.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- API BYPASS RLS: SIMPAN KE TABEL MASTER VOCABULARIES ---
app.post('/api/save-master-vocab', async (req, res) => {
    try {
        const { word, definition, meaning, type, context, level, synonyms, word_family, verb_forms } = req.body;
        
        // 1. Validasi Eksistensi Data (Mencegah Redundansi Data Master)
        const { data: existingVocab, error: searchError } = await supabase
            .from('vocabularies')
            .select('id')
            .ilike('word', word)
            .limit(1)
            .maybeSingle();

        if (searchError) throw searchError;

        // 2. Apabila kosakata sudah terdaftar, kembalikan primary key (ID) yang sudah ada
        if (existingVocab) {
            return res.json({ success: true, id: existingVocab.id });
        }

        // 3. Eksekusi insersi data baru apabila record belum tersedia (Bypass RLS)
        const { data, error } = await supabase.from('vocabularies').insert([{
            word, definition, meaning, type, context, level, synonyms, word_family, verb_forms
        }]).select('id').single();

        if (error) throw error;
        res.json({ success: true, id: data.id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- API UNTUK CEK KOSAKATA DI DATABASE MASTER SEBELUM GENERATE AI ---
app.post('/api/check-vocab', async (req, res) => {
    try {
        const { word } = req.body;

        // Menggunakan supabase service key dari environment peladen untuk mem-bypass RLS
        const { data: existingVocab, error } = await supabase
            .from('vocabularies')
            .select('*')
            .ilike('word', word)
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (existingVocab) {
            res.json({ success: true, data: existingVocab });
        } else {
            res.json({ success: false, message: "Vocab tidak ditemukan di database." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- API FETCH VOCABULARIES (BFF PROXY) ---
app.get('/api/vocabularies/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase.from('user_vocabularies').select(`
            id,
            is_memorized,
            created_at,
            vocabularies ( id, word, definition, meaning, type, context, level, synonyms, word_family, verb_forms )
        `).eq('user_id', userId).order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// --- API FETCH PROFILE (BFF PROXY) ---
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server Midtrans berjalan di port ${PORT}`);
});
