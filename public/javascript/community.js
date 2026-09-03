const supabaseUrl = 'https://sbnzxduuaimpyfoxoaft.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibnp4ZHV1YWltcHlmb3hvYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU0MTAsImV4cCI6MjEwMjcwMTQxMH0.YetlOf6hjNBiHVZFPRpXaAzjcVrdawLM3VIYEv18yR0';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let communityData = [];
let isProUser = false;
let isUnderage = false;

// --- PROTEKSI HALAMAN REAL-TIME ---
supabaseClient.auth.onAuthStateChange(async(event, session) => {
    if (!session) {
        window.location.replace('/auth');
    } else if (!session.user.email_confirmed_at) {
        await supabaseClient.auth.signOut();
        window.location.replace('/auth');
    }
});

window.addEventListener('DOMContentLoaded', async() => {
    const urlParams = new URLSearchParams(window.location.search);
    let refCode = urlParams.get('ref');

    if (refCode) {
        // 1. Simpan ke LocalStorage agar aman
        localStorage.setItem('vocab_ref_code', refCode);
    } else {
        // 2. Ambil dari LocalStorage jika di URL tidak ada
        refCode = localStorage.getItem('vocab_ref_code');
    }

    // 3. Otomatis tempelkan ?ref=... ke SEMUA link navigasi internal (dashboard, translator, dll)
    if (refCode && refCode !== 'NONE') {
        document.querySelectorAll('a[href]').forEach(anchor => {
            const href = anchor.getAttribute('href');
            // Hanya ubah link internal (yang diawali dengan / atau tidak memiliki http)
            if (href && (href.startsWith('/') || !href.startsWith('http'))) {
                // Bersihkan dulu kalau sudah ada query sebelumnya agar tidak double
                const cleanHref = href.split('?')[0];
                anchor.href = `${cleanHref}?ref=${encodeURIComponent(refCode)}`;
            }
        });
    }

    // --- CEK SESI SAAT HALAMAN DIMUAT ---
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('/auth');
        return;
    }
    if (!session.user.email_confirmed_at) {
        alert("Harap verifikasi email Anda terlebih dahulu.");
        await supabaseClient.auth.signOut();
        window.location.replace('/auth');
        return;
    }

    currentUser = session.user;

    // Load Midtrans
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

    const defaultName = currentUser.email.split('@')[0].toUpperCase();
    document.getElementById('displayUsername').textContent = defaultName;

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('username, pro_expired_at, grammar_quota, translator_quota, dob')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (profile) {
        if (profile.dob) {
            const birthDate = new Date(profile.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            isUnderage = age < 18;
        }
        if (!isUnderage) {
            const adultFilterWrapper = document.getElementById('adultFilterWrapper');
            adultFilterWrapper.classList.remove('hidden');
            adultFilterWrapper.classList.add('flex');
        }
        if (profile.username) {
            document.getElementById('displayUsername').textContent = profile.username.toUpperCase();
        }
        if (profile.grammar_quota !== undefined) userGrammarQuota = profile.grammar_quota;
        if (profile.translator_quota !== undefined) userTranslatorQuota = profile.translator_quota;

        // --- PERBAIKAN CEK STATUS PRO DI SINI ---
        if (profile.pro_expired_at && new Date(profile.pro_expired_at) > new Date()) {
            isProUser = true;
        } else {
            isProUser = false;
        }

        // Sinkronisasi Tampilan Elemen PRO / Free
        const upgradeBtn = document.getElementById('upgradeProBtn');
        const desktopUpgradeCard = document.getElementById('desktopUpgradeCardContainer');
        const desktopAffiliateBtn = document.getElementById('desktopAffiliateBtn');
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
            if (logoBadge) {
                logoBadge.textContent = 'Free';
                logoBadge.className = 'text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold align-middle';
            }
        }
    }

    loadCommunityRecommendations();
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

// Toggle dropdown menu titik tiga
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

let currentPage = 1;
const itemsPerPage = 4;

window.changePage = function(page) {
    if (page < 1) return;
    currentPage = page;
    loadCommunityRecommendations();
};

function renderPaginationControls(totalPages) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    const prevDisabled = currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer';
    html += `<button onclick="changePage(${currentPage - 1})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 transition-colors focus:outline-none ${prevDisabled}" ${currentPage === 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left text-[10px]"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="w-8 h-8 rounded-lg flex items-center justify-center text-indigo-600 bg-indigo-50 font-bold border border-indigo-200 text-xs">${i}</button>`;
        } else {
            html += `<button onclick="changePage(${i})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 font-semibold text-xs">${i}</button>`;
        }
    }

    const nextDisabled = currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer';
    html += `<button onclick="changePage(${currentPage + 1})" class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 transition-colors focus:outline-none ${nextDisabled}" ${currentPage === totalPages ? 'disabled' : ''}><i class="fa-solid fa-chevron-right text-[10px]"></i></button>`;

    container.innerHTML = html;
}

// Kontrol Modal Umum
function openContactModal() { document.getElementById('contactModal').classList.remove('hidden'); }

function closeContactModal() { document.getElementById('contactModal').classList.add('hidden'); }

function openAddRecommendationModal() {
    if (!isProUser) {
        alert("Akses Ditolak: Fitur penambahan saran komunitas hanya tersedia untuk pengguna VocabMaster PRO.");
        return;
    }
    document.getElementById('addRecModal').classList.remove('hidden');
}

function closeAddModal() { document.getElementById('addRecModal').classList.add('hidden'); }

// Fungsi Prediksi Level & Usia menggunakan AI (Untuk Form Add)
async function autoClassifyContent() {
    const title = document.getElementById('recTitle').value.trim();
    const category = document.getElementById('recCategory').value;
    const creator = document.getElementById('recCreator').value.trim();

    if (!title) {
        alert("Peringatan: Harap isi kolom 'Judul Konten' terlebih dahulu agar AI dapat memprediksi data!");
        document.getElementById('recTitle').focus();
        return;
    }

    const btn = document.getElementById('aiClassifyBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Sedang Menganalisis...';
    btn.disabled = true;

    try {
        const req = await fetch('/api/classify-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, creator })
        });

        const res = await req.json();

        if (res.success && res.data) {
            const levelSelect = document.getElementById('recLevel');
            if (res.data.level && Array.from(levelSelect.options).some(opt => opt.value === res.data.level)) {
                levelSelect.value = res.data.level;
            }

            const adultSelect = document.getElementById('recIsAdult');
            adultSelect.value = res.data.is_adult ? 'true' : 'false';

            alert(`✨ AI Berhasil Memprediksi!\n\nLevel Bahasa: ${res.data.level}\nKonten Dewasa 18+: ${res.data.is_adult ? 'Ya' : 'Tidak'}\n\nSilakan cek kembali sebelum men-submit.`);
        } else {
            alert("Gagal memprediksi konten. AI tidak mengenali judul tersebut, silakan atur manual.");
        }
    } catch (err) {
        alert("Terjadi kesalahan koneksi saat menghubungi AI.");
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

let currentListFilter = 'all';

window.setListFilter = function(filter) {
    currentPage = 1;
    currentListFilter = filter;

    const baseClass = 'w-full px-4 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-xs md:text-sm border border-gray-200 shadow-sm';
    const activeClass = 'w-full px-4 py-2.5 rounded-xl font-bold bg-indigo-50 text-indigo-700 transition-all flex items-center justify-center gap-2 text-xs md:text-sm border border-indigo-100 shadow-sm';

    document.querySelectorAll('[id^="btnList-"]').forEach(btn => {
        btn.className = baseClass;
    });

    const activeBtn = document.getElementById(`btnList-${filter}`);
    activeBtn.className = activeClass;

    loadCommunityRecommendations();
};

// Menggunakan LocalStorage untuk Fitur Simpan Daftar
function getSavedLists() {
    return JSON.parse(localStorage.getItem(`vocab_saved_recs_${currentUser.id}`)) || {};
}

window.openSaveModal = function(id, title, currentStatus) {
    document.getElementById('saveRecId').value = id;
    document.getElementById('saveRecTitle').textContent = title;

    document.querySelectorAll('input[name="saveStatus"]').forEach(radio => {
        radio.checked = (radio.value === currentStatus);
    });
    document.getElementById('saveRecModal').classList.remove('hidden');
};

window.closeSaveModal = function() {
    document.getElementById('saveRecModal').classList.add('hidden');
};

window.removeSavedRec = function() {
    const id = document.getElementById('saveRecId').value;
    const lists = getSavedLists();
    delete lists[id];
    localStorage.setItem(`vocab_saved_recs_${currentUser.id}`, JSON.stringify(lists));
    closeSaveModal();
    loadCommunityRecommendations();
};

document.getElementById('saveRecForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('saveRecId').value;
    const status = document.querySelector('input[name="saveStatus"]:checked').value;

    const lists = getSavedLists();
    lists[id] = status;
    localStorage.setItem(`vocab_saved_recs_${currentUser.id}`, JSON.stringify(lists));

    closeSaveModal();
    loadCommunityRecommendations();
});

async function loadCommunityRecommendations() {
    const container = document.getElementById('recommendationListContainer');
    container.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10"><i class="fa-solid fa-spinner fa-spin text-2xl mb-2"></i><br>Memuat data...</p>';

    const catFilter = document.getElementById('filterCategory').value;
    const lvlFilter = document.getElementById('filterLevel').value;

    let query = supabaseClient.from('recommendations')
        .select('*')
        .order('created_at', { ascending: false });

    if (catFilter !== 'all') query = query.eq('category', catFilter);
    if (lvlFilter !== 'all') query = query.eq('level', lvlFilter);

    if (isUnderage) {
        query = query.eq('is_adult', false);
    } else {
        const showAdult = document.getElementById('filterAdult').checked;
        if (!showAdult) query = query.eq('is_adult', false);
    }

    const { data, error } = await query;
    communityData = data || [];

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10">Belum ada konten di kategori ini.</p>';
        document.getElementById('paginationInfo').textContent = 'Menampilkan 0 dari 0 data';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    const savedLists = getSavedLists();

    let filteredData = data.filter(item => {
        if (currentListFilter === 'saved') {
            return savedLists[item.id] === 'plan' || savedLists[item.id] === 'progress';
        } else if (currentListFilter === 'completed') {
            return savedLists[item.id] === 'completed';
        } else if (currentListFilter === 'my-posts') {
            return item.user_id === currentUser.id;
        }
        return true;
    });

    if (filteredData.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-gray-400 py-10">Tidak ada data di daftar ini.</p>';
        document.getElementById('paginationInfo').textContent = 'Menampilkan 0 dari 0 data';
        document.getElementById('paginationControls').innerHTML = '';
        return;
    }

    // --- LOGIKA PAGINATION (4 Card per Halaman) ---
    const totalFiltered = filteredData.length;
    const totalPages = Math.ceil(totalFiltered / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);
    const paginatedData = filteredData.slice(startIndex, endIndex);

    document.getElementById('paginationInfo').textContent = `Menampilkan ${startIndex + 1}-${endIndex} dari total ${totalFiltered} data`;
    renderPaginationControls(totalPages);

    container.innerHTML = '';
    paginatedData.forEach(item => {
        const yearBadge = item.release_year ? `<span class="bg-gray-200 text-gray-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-2">${item.release_year}</span>` : '';
        const linkButton = item.access_link ?
            `<a href="${item.access_link}" target="_blank" class="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 font-medium"><i class="fa-solid fa-link"></i> Buka di ${item.access_place}</a>` :
            `<span class="mt-2 block text-xs text-gray-500 font-medium"><i class="fa-solid fa-location-dot"></i> Tersedia di: ${item.access_place}</span>`;

        const adultBadge = item.is_adult ? `<span class="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider border border-red-200">18+</span>` : '';

        const savedStatus = savedLists[item.id];
        let savedBadge = '';
        if (savedStatus === 'plan' || savedStatus === 'progress') {
            savedBadge = `<span class="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-amber-200 ml-1"><i class="fa-solid fa-bookmark"></i> Tersimpan</span>`;
        } else if (savedStatus === 'completed') {
            savedBadge = `<span class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-200 ml-1"><i class="fa-solid fa-check-double"></i> Selesai</span>`;
        }

        const hasReported = (item.reported_by || []).includes(currentUser.id);
        const reportBtn = hasReported ?
            `<button onclick="alert('Anda sudah melaporkan konten ini.')" class="text-red-400 cursor-not-allowed text-xs"><i class="fa-solid fa-flag"></i></button>` :
            `<button onclick="openReportModal('${item.id}', '${item.title.replace(/'/g, "\\'")}')" class="text-gray-300 hover:text-red-500 text-xs" title="Laporkan Konten"><i class="fa-solid fa-flag"></i></button>`;

        const editBtn = item.user_id === currentUser.id ?
            `<button onclick="openEditRecModal('${item.id}')" class="text-gray-400 hover:text-blue-500 text-xs" title="Edit Konten"><i class="fa-solid fa-pen"></i></button>` : '';

        const saveBtn = `<button onclick="openSaveModal('${item.id}', '${item.title.replace(/'/g, "\\'")}', '${savedStatus || ''}')" class="text-indigo-400 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg text-xs transition-colors mb-auto" title="Kelola Daftar Saya"><i class="fa-solid fa-bookmark"></i></button>`;

        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-4 transition-transform hover:-translate-y-1';
        div.innerHTML = `
            ${item.image_url ? `<img src="${item.image_url}" class="w-16 h-24 object-cover rounded-lg shadow-sm shrink-0">` : `<div class="w-16 h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 shrink-0"><i class="fa-solid fa-image text-2xl"></i></div>`}
            <div class="flex-1">
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                    <span class="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">${item.category} • Lv ${item.level}</span>
                    ${adultBadge}
                    ${savedBadge}
                </div>
                <h4 class="font-bold text-gray-900 leading-tight">${item.title} ${yearBadge}</h4>
                <p class="text-xs text-gray-500 font-medium mt-1">oleh ${item.creator || 'Anonim'}</p>
                ${linkButton}
            </div>
            <div class="flex flex-col items-end gap-3 border-l pl-3 border-gray-100 shrink-0">
                ${saveBtn}
                <div class="flex items-center gap-3">
                    ${editBtn}
                    ${reportBtn}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function changeFilter() {
    currentPage = 1;
    loadCommunityRecommendations();
}

// Membuka Modal Edit dan Mengisi Data Lama
window.openEditRecModal = function(id) {
    const item = communityData.find(x => x.id === id);
    if(!item) return;

    document.getElementById('editRecId').value = item.id;
    document.getElementById('editRecCategory').value = item.category || 'Film';
    document.getElementById('editRecLevel').value = item.level || 'A1';
    document.getElementById('editRecTitle').value = item.title || '';
    document.getElementById('editRecCreator').value = item.creator || '';
    document.getElementById('editRecYear').value = item.release_year || '';
    document.getElementById('editRecAccessPlace').value = item.access_place || '';
    document.getElementById('editRecAccessLink').value = item.access_link || '';
    document.getElementById('editRecImage').value = item.image_url || '';
    document.getElementById('editRecIsAdult').value = item.is_adult ? 'true' : 'false';

    document.getElementById('editRecModal').classList.remove('hidden');
};

// Menutup Modal Edit
window.closeEditModal = function() {
    document.getElementById('editRecModal').classList.add('hidden');
};

// Proses Update/Simpan ke Database Supabase
document.getElementById('editRecForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...'; 
    btn.disabled = true;

    const id = document.getElementById('editRecId').value;
    const updateData = {
        category: document.getElementById('editRecCategory').value,
        level: document.getElementById('editRecLevel').value,
        title: document.getElementById('editRecTitle').value,
        creator: document.getElementById('editRecCreator').value,
        release_year: parseInt(document.getElementById('editRecYear').value),
        access_place: document.getElementById('editRecAccessPlace').value,
        access_link: document.getElementById('editRecAccessLink').value,
        image_url: document.getElementById('editRecImage').value,
        is_adult: document.getElementById('editRecIsAdult').value === 'true'
    };

    const { error } = await supabaseClient.from('recommendations').update(updateData).eq('id', id);
    
    if (error) {
        alert("Gagal menyimpan perubahan!");
    } else {
        alert("Saran berhasil diperbarui!");
        closeEditModal();
        loadCommunityRecommendations(); // Refresh UI
    }
    btn.innerHTML = originalText; 
    btn.disabled = false;
});

// Deteksi AI untuk Form Edit
window.autoClassifyEditContent = async function() {
    const title = document.getElementById('editRecTitle').value.trim();
    const category = document.getElementById('editRecCategory').value;
    const creator = document.getElementById('editRecCreator').value.trim();
    
    if (!title) {
        alert("Peringatan: Harap isi kolom 'Judul Konten' terlebih dahulu!");
        document.getElementById('editRecTitle').focus();
        return;
    }
    
    const btn = document.getElementById('aiClassifyEditBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menganalisis...';
    btn.disabled = true;
    
    try {
        const req = await fetch('/api/classify-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, creator })
        });
        const res = await req.json();
        if (res.success && res.data) {
            const levelSelect = document.getElementById('editRecLevel');
            if (res.data.level && Array.from(levelSelect.options).some(opt => opt.value === res.data.level)) {
                levelSelect.value = res.data.level;
            }
            document.getElementById('editRecIsAdult').value = res.data.is_adult ? 'true' : 'false';
            alert(`✨ AI Berhasil Memprediksi!\n\nLevel: ${res.data.level}\nKonten Dewasa: ${res.data.is_adult ? 'Ya' : 'Tidak'}`);
        } else {
            alert("Gagal memprediksi konten.");
        }
    } catch (err) {
        alert("Terjadi kesalahan saat menghubungi AI.");
    }
    btn.innerHTML = originalText;
    btn.disabled = false;
};

document.getElementById('addRecForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengirim...'; 
    btn.disabled = true;

    const newData = {
        user_id: currentUser.id,
        category: document.getElementById('recCategory').value,
        level: document.getElementById('recLevel').value,
        title: document.getElementById('recTitle').value,
        creator: document.getElementById('recCreator').value,
        release_year: parseInt(document.getElementById('recYear').value),
        access_place: document.getElementById('recAccessPlace').value,
        access_link: document.getElementById('recAccessLink').value,
        image_url: document.getElementById('recImage').value,
        is_adult: document.getElementById('recIsAdult').value === 'true'
    };

    const { error } = await supabaseClient.from('recommendations').insert([newData]);
    
    if (error) {
        alert("Gagal mengirim data!");
    } else {
        alert("Berhasil dikirim ke komunitas!");
        closeAddModal();
        this.reset();
        loadCommunityRecommendations();
    }
    btn.innerHTML = 'Kirim ke Komunitas'; btn.disabled = false;
});

// Kontrol Buka/Tutup Modal Report
function openReportModal(contentId, contentTitle) {
    document.getElementById('reportContentId').value = contentId;
    document.getElementById('reportContentTitle').value = contentTitle;
    document.getElementById('reportReason').value = '';
    document.getElementById('reportDetail').value = '';
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

// Logika Pengiriman Form Laporan
document.getElementById('reportForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = this.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...'; 
    btn.disabled = true;

    const contentId = document.getElementById('reportContentId').value;
    const contentTitle = document.getElementById('reportContentTitle').value;
    const reason = document.getElementById('reportReason').value;
    const detail = document.getElementById('reportDetail').value;

    const { data, error: fetchErr } = await supabaseClient
        .from('recommendations')
        .select('reports_count, reported_by')
        .eq('id', contentId)
        .single();

    if (fetchErr || !data) {
        alert("Kesalahan Sistem: Gagal memproses laporan dari basis data.");
        closeReportModal();
        return;
    }

    let reportedBy = data.reported_by || [];
    let currentCount = data.reports_count || 0;

    if (reportedBy.includes(currentUser.id)) {
        alert("Validasi Ditolak: Anda tidak dapat melaporkan entitas yang sama lebih dari satu kali.");
        closeReportModal();
        return;
    }

    reportedBy.push(currentUser.id);
    currentCount += 1;

    if (currentCount >= 8) {
        await supabaseClient.from('recommendations').delete().eq('id', contentId);
        alert("Eksekusi Berhasil: Konten telah dihapus otomatis secara sistematis berdasarkan akumulasi rasio pelaporan.");
    } else {
        await supabaseClient.from('recommendations')
            .update({ reports_count: currentCount, reported_by: reportedBy })
            .eq('id', contentId);
        
        alert("Laporan berhasil direkam beserta detail alasan. Terima kasih atas partisipasi Anda.");
        
        fetch("https://formsubmit.co/ajax/shinta.nur119@gmail.com", {
            method: "POST",
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                Subjek: "Laporan Konten Komunitas Baru",
                ID_Konten: contentId,
                Judul_Konten: contentTitle,
                Alasan_Utama: reason,
                Detail_Penjelasan: detail,
                Metrik_Laporan: `${currentCount} dari batas ambang 8 laporan`
            })
        }).catch(err => console.error("Transmisi notifikasi gagal", err));
    }
    
    btn.innerHTML = 'Kirim Laporan'; 
    btn.disabled = false;
    closeReportModal();
    loadCommunityRecommendations();
});

function openUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
}

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
