# 📚 VocabMaster.ai

> Platform pembelajaran kosakata Bahasa Inggris berbasis AI yang dirancang untuk membantu pengguna belajar, menghafal, dan memahami kosakata dengan cara yang lebih cepat, interaktif, dan terstruktur.

🔗 **Live Demo:** https://vocabmaster-ashen.vercel.app/

---

## 📖 About Project

**VocabMaster.ai** adalah platform pembelajaran Bahasa Inggris yang berfokus pada peningkatan kemampuan kosakata pengguna.

Platform ini membantu pengguna mempelajari kosakata melalui informasi yang lebih lengkap seperti arti kata, jenis kata, sinonim, bentuk kata, serta contoh penggunaan dalam kalimat.

Selain pembelajaran kosakata, VocabMaster.ai juga menyediakan berbagai fitur interaktif untuk membantu pengguna meningkatkan kemampuan Bahasa Inggris secara lebih menyeluruh.

Project ini dikembangkan sebagai **full-stack web application** dengan integrasi database, authentication, AI, payment gateway, dan berbagai layanan eksternal.

### 🎯 Tujuan Project

- Membantu pengguna menghafal kosakata Bahasa Inggris dengan lebih efektif.
- Menyediakan informasi kosakata yang lengkap dan mudah dipahami.
- Membuat proses belajar menjadi lebih interaktif melalui game dan latihan.
- Membantu pengguna berlatih Bahasa Inggris melalui berbagai jenis latihan.
- Menyediakan sistem pembelajaran yang dapat digunakan secara mandiri.

---

## ✨ Features

### 📚 Vocabulary Learning

- Menampilkan daftar kosakata Bahasa Inggris.
- Informasi arti dan penggunaan kata.
- Kategori berdasarkan jenis kata.
- Pencarian kosakata.
- Penyimpanan kosakata yang ingin dipelajari.
- Sistem review untuk membantu mengingat kosakata.

### 🧠 Interactive Learning

- Latihan kosakata secara interaktif.
- Quiz untuk menguji pemahaman.
- Game pembelajaran kosakata.
- Sistem latihan berdasarkan kosakata yang telah dipelajari.

### 🎮 Vocabulary Games

Tersedia beberapa jenis permainan untuk membuat proses menghafal kosakata menjadi lebih menyenangkan, seperti:

- Multiple Choice
- Word Scramble
- Matching
- Memory Game
- Missing Word
- Vocabulary Challenge

### 📊 Dashboard

Dashboard menyediakan informasi mengenai aktivitas dan perkembangan belajar pengguna.

Beberapa informasi yang dapat ditampilkan antara lain:

- Kosakata yang telah dipelajari.
- Progress pembelajaran.
- Review kosakata.
- Aktivitas belajar.
- Statistik pembelajaran.

### 🎧 Listening Practice

Fitur listening digunakan untuk membantu pengguna melatih kemampuan memahami Bahasa Inggris melalui audio/video.

Pengguna dapat berlatih memahami percakapan dan kosakata berdasarkan materi yang tersedia.

### 🗣️ Speaking Practice

Fitur speaking membantu pengguna berlatih kemampuan berbicara Bahasa Inggris melalui materi dan latihan yang tersedia di platform.

### ✍️ Grammar Checker

Fitur grammar checker digunakan untuk membantu pengguna memeriksa struktur kalimat Bahasa Inggris dan mendapatkan feedback terhadap kesalahan grammar.

### 🌐 Translator

Translator membantu pengguna menerjemahkan teks untuk mendukung proses pembelajaran Bahasa Inggris.

### 👤 Authentication

- Registrasi akun.
- Login pengguna.
- Session management.
- Data pembelajaran terhubung dengan akun pengguna.

### 💎 PRO Membership

VocabMaster.ai menyediakan sistem membership dengan fitur tambahan untuk pengguna PRO.

Sistem membership terintegrasi dengan payment gateway sehingga pengguna dapat melakukan upgrade paket secara online.

### 💳 Payment Integration

Payment system menggunakan **Midtrans** untuk menangani proses pembayaran membership.

### 📧 Email Integration

Menggunakan **Nodemailer** untuk kebutuhan pengiriman email dari aplikasi.

---

## 🛠️ Tech Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Tailwind CSS
- Font Awesome

### Backend

- Node.js
- Express.js

### Database & Authentication

- Supabase
- Supabase Authentication
- PostgreSQL

### API & Services

- AI API
- YouTube Transcript
- Midtrans
- Nodemailer

### Deployment

- Vercel
- GitHub

---

## 📸 Screenshots

### 🏠 Landing Page

![Landing Page](screenshots/landing-page.png)

### 📊 Dashboard

![Dashboard](screenshots/dashboard.png)

### 📚 Vocabulary

![Vocabulary](screenshots/vocabulary.png)

### 🎮 Vocabulary Game

![Vocabulary Game](screenshots/game.png)

### 🎧 Listening

![Listening](screenshots/listening.png)

### ✍️ Grammar Checker

![Grammar Checker](screenshots/grammar-checker.png)

> **Note:** Letakkan screenshot project di folder `screenshots/` pada repository agar gambar dapat ditampilkan di README.

---

## ⚙️ Installation
Berikut adalah instruksi teknis untuk mempersiapkan lingkungan pengembangan secara lokal:
1.  Lakukan kloning pada repositori ini ke dalam direktori lokal:
    ```bash
    git clone https://github.com/Shinta505/vocab-app.git
    ```
2.  Arahkan command line / terminal ke dalam direktori proyek:
    ```bash
    cd vocab-app
    ```
3.  Lakukan instalasi seluruh dependensi yang dibutuhkan oleh sistem menggunakan NPM:
    ```bash
    npm install
    ```

## Cara Menjalankan Sistem (How to Run)
Untuk menjalankan peladen (server) pengembangan lokal dan mengakses aplikasi, ikuti langkah berikut:
1.  Eksekusi berkas server utama menggunakan Node.js:
    ```bash
    node server.js
    ```
    *(Alternatif: Gunakan perintah `npm start` apabila telah dikonfigurasi pada environment `package.json`)*
2.  Buka peramban web (web browser) dan akses alamat localhost sesuai porta yang tertera pada terminal (contoh: `http://localhost:3000` atau `http://localhost:8080`).

## Penulis (Author)
*   **Nama     :** Shinta Nursobah Chairani
*   **LinkedIn :** https://linkedIn.com/in/shinta-nursobah-chairani
