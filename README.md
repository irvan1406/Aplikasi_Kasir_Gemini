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

## Memindahkan data dari aplikasi lama

1. Buka **Pengaturan → Ekspor Backup** pada aplikasi lama.
2. Pasang dan buka Warung Scan.
3. Buka **Pengaturan → Impor Backup**, lalu pilih file JSON tadi.
4. Setelah semua barang dan riwayat tampil, aplikasi lama boleh dihapus.

Warung Scan memakai package berbeda, sehingga dapat dipasang berdampingan dengan APK lama selama pengujian.
