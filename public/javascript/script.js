document.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');

      if (refCode) {
          // 1. Simpan langsung ke LocalStorage saat user mendarat di index.html
          localStorage.setItem('vocab_ref_code', refCode);

          // 2. Tempelkan query ?ref= ke seluruh tautan/tombol yang mengarah ke /auth
          document.querySelectorAll('a[href="/auth"], a[href^="/auth?"]').forEach(anchor => {
              anchor.href = `/auth?ref=${encodeURIComponent(refCode)}`;
          });
      }
});
