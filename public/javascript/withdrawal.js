const urlParams = new URLSearchParams(window.location.search);
const wdId = urlParams.get('id');

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMsg = document.getElementById('errorMsg');
const form = document.getElementById('adminWdForm');

function toggleProofInput() {
    const status = document.getElementById('wdStatus').value;
    const proofContainer = document.getElementById('proofContainer');
    if (status === 'success') {
        proofContainer.classList.remove('hidden');
        // Optional: kamu bisa bikin `required = true` di sini jika ingin memaksa admin ngisi link
        // document.getElementById('wdProofLink').required = true;
    } else {
        proofContainer.classList.add('hidden');
        document.getElementById('wdProofLink').required = false;
        document.getElementById('wdProofLink').value = '';
    }
}

function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text);
    alert('Tersalin: ' + text);
}

async function loadData() {
    if (!wdId) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMsg.textContent = "ID Penarikan tidak ditemukan di URL.";
        return;
    }

    try {
        const res = await fetch('/api/admin/withdrawal/' + wdId);
        const result = await res.json();

        loadingState.classList.add('hidden');

        if (result.success) {
            const data = result.data;
            document.getElementById('wdId').value = data.id;
            document.getElementById('displayId').textContent = data.id.substring(0, 8).toUpperCase();
            document.getElementById('displayBalance').textContent = 'Rp ' + data.current_balance.toLocaleString('id-ID');
            document.getElementById('displayAmount').textContent = 'Rp ' + data.amount.toLocaleString('id-ID');
            document.getElementById('displayBank').textContent = data.bank_name;
            document.getElementById('displayAccountNo').textContent = data.account_number;
            document.getElementById('displayAccountName').textContent = data.account_name;

            document.getElementById('wdStatus').value = data.status;
            toggleProofInput();

            // Kunci tampilan jika sudah diproses
            if (data.status !== 'pending') {
                document.getElementById('wdStatus').disabled = true;
                document.getElementById('submitBtn').disabled = true;
                document.getElementById('submitBtn').classList.replace('bg-gray-800', 'bg-gray-400');
                document.getElementById('submitBtn').textContent = 'Sudah Diproses';
                document.getElementById('proofContainer').classList.add('hidden');
                document.getElementById('updateStatusMsg').textContent = "Penarikan ini sudah berstatus " + data.status.toUpperCase();
                document.getElementById('updateStatusMsg').classList.remove('hidden');
                document.getElementById('updateStatusMsg').classList.add('bg-blue-50', 'text-blue-700', 'border-blue-200');
            }

            form.classList.remove('hidden');
        } else {
            errorState.classList.remove('hidden');
            errorMsg.textContent = result.message;
        }
    } catch (err) {
        loadingState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMsg.textContent = "Gagal terhubung ke server.";
    }
}

form.addEventListener('submit', async(e) => {
    e.preventDefault();
    const status = document.getElementById('wdStatus').value;
    const proofLink = document.getElementById('wdProofLink').value;
    const btn = document.getElementById('submitBtn');
    const msgBox = document.getElementById('updateStatusMsg');

    if (status === 'pending') {
        alert('Silakan ubah status menjadi Success atau Failed terlebih dahulu.');
        return;
    }

    msgBox.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';

    try {
        const res = await fetch('/api/admin/update-withdrawal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: document.getElementById('wdId').value,
                status: status,
                proofLink: proofLink
            })
        });

        const result = await res.json();

        if (result.success) {
            msgBox.textContent = result.message;
            msgBox.className = 'p-3 rounded-lg text-sm border font-medium bg-green-50 text-green-700 border-green-200 mt-4';
            msgBox.classList.remove('hidden');
            document.getElementById('wdStatus').disabled = true;
            document.getElementById('wdProofLink').disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Selesai';
        } else {
            msgBox.textContent = result.message;
            msgBox.className = 'p-3 rounded-lg text-sm border font-medium bg-red-50 text-red-700 border-red-200 mt-4';
            msgBox.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
        }
    } catch (err) {
        msgBox.textContent = "Terjadi kesalahan sistem.";
        msgBox.className = 'p-3 rounded-lg text-sm border font-medium bg-red-50 text-red-700 border-red-200 mt-4';
        msgBox.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
    }
});

// Load data saat halaman pertama kali dibuka
loadData();
