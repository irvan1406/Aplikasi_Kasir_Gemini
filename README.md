# Warung Scan

Aplikasi kasir berbasis web dengan pembungkus Android native untuk penggunaan langsung dari HP.

## Unduh APK

APK terbaru tersedia di:

https://github.com/irvan1406/Aplikasi_Kasir_Gemini/releases/latest/download/Warung-Scan.apk

GitHub Actions membangun APK otomatis saat bagian Android berubah. File build juga tersedia pada tab **Actions** sebagai artifact.

## Dukungan Android

- Nama aplikasi: **Warung Scan**
- Package ID: `com.warungscan.app`
- Android minimum: Android 7
- Kamera dan scanner barcode melalui izin kamera Android
- Galeri dan impor backup melalui pemilih file Android
- Ekspor backup/CSV melalui dialog simpan Android
- Printer utama: **RPP02N**, Bluetooth Classic SPP, ESC/POS 58 mm
- RawBT tetap tersedia sebagai metode cetak cadangan
- Memuat web terbaru dari GitHub Pages dan memakai salinan bawaan saat offline

APK awal ini adalah build pengujian. Perubahan web tetap diterima dari GitHub Pages tanpa memasang ulang APK. Jika lapisan Android native dibangun ulang sebelum kunci rilis pribadi disiapkan, ekspor backup terlebih dahulu karena APK mungkin perlu dipasang ulang.

## Update web tanpa memasang APK lagi

Perubahan pada `index.html`, `app.js`, `style.css`, dan `database.js` dimuat dari GitHub Pages. Jika Warung Scan sudah terpasang, tutup aplikasi sepenuhnya dari daftar aplikasi terbaru lalu buka lagi. Unduh APK hanya diperlukan jika ada rilis yang mengubah bagian native di folder `android/`.

## Setup Midtrans Otomatis

Integrasi ini membuat QRIS dinamis sesuai total belanja, memeriksa status ke Midtrans setiap 10 detik, menyimpan transaksi setelah status pembayaran terverifikasi, lalu mencetak struk. QRIS statis yang diunggah tetap tersedia sebagai cadangan manual.

### 1. Siapkan backend dari HP

1. Masuk ke [Vercel](https://vercel.com/) melalui browser HP dan pilih **Add New → Project**.
2. Hubungkan GitHub, lalu impor repo `irvan1406/Aplikasi_Kasir_Gemini`.
3. Biarkan **Framework Preset** sebagai `Other`, lalu tambahkan Environment Variables berikut:
   - `MIDTRANS_SERVER_KEY`: Server Key dari dashboard Midtrans. Jangan pernah menaruh nilainya di GitHub atau kolom aplikasi.
   - `MIDTRANS_IS_PRODUCTION`: isi `false` untuk Sandbox; ubah menjadi `true` setelah siap menerima pembayaran asli.
   - `WARUNGSCAN_APP_TOKEN`: gunakan tombol **Buat / Salin** pada kolom Token Aplikasi di Warung Scan, lalu tempel hasilnya di Vercel. Nilainya hanya disimpan di HP dan Vercel.
   - `ALLOWED_ORIGINS`: `https://irvan1406.github.io`
4. Tekan **Deploy**, kemudian salin alamat seperti `https://nama-proyek.vercel.app`.

Contoh nama variabel tanpa rahasia juga tersedia di [`.env.example`](.env.example). Backend berada di [`api/midtrans.js`](api/midtrans.js) dan tidak membutuhkan package tambahan.

### 2. Hubungkan Warung Scan

1. Buka **Pengaturan → Pembayaran QRIS**.
2. Pilih **Midtrans Otomatis**.
3. Isi **URL Backend Vercel** dengan alamat hasil deploy tanpa `/api/midtrans`.
4. Isi **Token Aplikasi** dengan nilai `WARUNGSCAN_APP_TOKEN` yang sama.
5. Tekan **Tes Koneksi Midtrans**. Mulai dari Sandbox terlebih dahulu.
6. Salin **Alamat Webhook Midtrans** dari aplikasi dan masukkan sebagai Payment Notification URL di dashboard Midtrans. Backend juga mengirim alamat ini melalui `X-Override-Notification` untuk setiap transaksi.

Server memverifikasi signature webhook, lalu membaca ulang status transaksi langsung dari Midtrans. Aplikasi juga melakukan polling sebagai jalur yang andal ketika HP tidak sedang terbuka tepat saat webhook diterima. Hanya status `settlement` atau `capture` yang valid dengan status fraud diterima yang dianggap lunas.

### 3. Upload QRIS statis/cadangan

Buka **Pengaturan → Pembayaran QRIS → Upload / Ganti QRIS**, lalu pilih gambar PNG/JPG/WebP dari galeri HP. QRIS statis memerlukan konfirmasi dana secara manual dan tidak dapat memicu cetak otomatis dari webhook Midtrans.

Panduan API resmi: [QRIS Core API](https://docs.midtrans.com/reference/qris), [HTTP Notification/Webhook](https://docs.midtrans.com/docs/https-notification-webhooks), dan [Get Status API](https://docs.midtrans.com/docs/get-status-api-requests).

## Memindahkan data dari aplikasi lama

1. Buka **Pengaturan → Ekspor Backup** pada aplikasi lama.
2. Pasang dan buka Warung Scan.
3. Buka **Pengaturan → Impor Backup**, lalu pilih file JSON tadi.
4. Setelah semua barang dan riwayat tampil, aplikasi lama boleh dihapus.

Warung Scan memakai package berbeda, sehingga dapat dipasang berdampingan dengan APK lama selama pengujian.
