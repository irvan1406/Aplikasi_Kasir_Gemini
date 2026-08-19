let cart = [];
let isAdmin = false;
let editingBarcode = null;
let currentPage = 'page-home';

let html5QrcodeScanner = null;
let scannerStarting = false;
let scanLocked = false;
let scannerStartTimer = null;
let scannerRestartTimer = null;
let fileScannerBusy = false;

let productCameraStream = null;
window.capturedProductPhoto = '';

const PRODUCT_PLACEHOLDER =
    'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2260%22%20height%3D%2260%22%3E%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22%23f3f4f6%22%2F%3E%3Ctext%20x%3D%2230%22%20y%3D%2234%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20fill%3D%22%239ca3af%22%3EProduk%3C%2Ftext%3E%3C%2Fsvg%3E';

// ================= UTILITAS =================
function formatRupiah(value) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function safeImageSource(value) {
    return /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(value || '')
        ? value
        : PRODUCT_PLACEHOLDER;
}

function playBeep() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(850, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.15);
        oscillator.addEventListener('ended', () => audioContext.close());
    } catch (error) {
        console.debug('Audio tidak tersedia.', error);
    }
}

function vibrate(duration = 100) {
    try {
        if (navigator.vibrate) navigator.vibrate(duration);
    } catch (error) {
        console.debug('Getar tidak tersedia.', error);
    }
}

function downloadBlob(blob, filename) {
    try {
        if (window.WarungScanNative?.isNativeApp?.()) {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = String(reader.result || '');
                const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
                if (!base64Data) {
                    alert('File gagal disiapkan untuk disimpan.');
                    return;
                }
                window.WarungScanNative.saveFileBase64(
                    filename,
                    blob.type || 'application/octet-stream',
                    base64Data
                );
            };
            reader.onerror = () => alert('File gagal dibaca sebelum disimpan.');
            reader.readAsDataURL(blob);
            return;
        }
    } catch (error) {
        console.debug('Penyimpanan native tidak tersedia; memakai unduhan browser.', error);
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getLocalDateKey(timestamp = Date.now()) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function getBase64(file, isLogo = false) {
    if (!file) throw new Error('File gambar tidak ditemukan.');
    if (file.type && !file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = () => reject(new Error('File gambar gagal dibaca.'));
        reader.readAsDataURL(file);
    });

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const maxWidth = isLogo ? 240 : 420;
                const maxHeight = isLogo ? 240 : 420;
                const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
                const width = Math.max(1, Math.round(image.width * scale));
                const height = Math.max(1, Math.round(image.height * scale));

                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, width, height);
                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', isLogo ? 0.86 : 0.72));
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = () => reject(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
        image.src = dataUrl;
    });
}

// ================= FOTO PRODUK & KAMERA =================
function setProductPhoto(base64) {
    window.capturedProductPhoto = base64 || '';
    const preview = document.getElementById('preview-foto-barang');
    const image = document.getElementById('img-preview-barang');

    if (window.capturedProductPhoto) {
        image.src = window.capturedProductPhoto;
        preview.style.display = 'block';
    } else {
        image.removeAttribute('src');
        preview.style.display = 'none';
    }
}

async function handleProductPhoto(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;

    try {
        const base64 = await getBase64(file, false);
        setProductPhoto(base64);
    } catch (error) {
        alert(`Gagal memproses gambar: ${error.message}`);
    } finally {
        inputElement.value = '';
    }
}

function removeProductPhoto() {
    setProductPhoto('');
}

async function requestCameraPermission(showSuccess = true) {
    if (!navigator.mediaDevices?.getUserMedia) {
        alert('Kamera web tidak tersedia di browser/APK ini.');
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        });
        stream.getTracks().forEach(track => track.stop());
        if (showSuccess) alert('Izin kamera berhasil diaktifkan.');
        return true;
    } catch (error) {
        alert(`Akses kamera gagal: ${error.message}`);
        return false;
    }
}

async function openProductCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        document.getElementById('native-camera-input').click();
        return;
    }

    try {
        productCameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        const video = document.getElementById('product-camera-video');
        video.srcObject = productCameraStream;
        document.getElementById('product-camera-modal').style.display = 'flex';
        await video.play();
    } catch (error) {
        console.error('Kamera produk gagal dibuka.', error);
        const useFallback = confirm('Kamera langsung tidak tersedia. Buka aplikasi kamera bawaan sebagai pengganti?');
        if (useFallback) document.getElementById('native-camera-input').click();
    }
}

function closeProductCamera() {
    if (productCameraStream) {
        productCameraStream.getTracks().forEach(track => track.stop());
        productCameraStream = null;
    }
    const video = document.getElementById('product-camera-video');
    if (video) video.srcObject = null;
    document.getElementById('product-camera-modal').style.display = 'none';
}

function captureProductCamera() {
    const video = document.getElementById('product-camera-video');
    if (!video.videoWidth || !video.videoHeight) {
        alert('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
        return;
    }

    const canvas = document.createElement('canvas');
    const maxWidth = 420;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setProductPhoto(canvas.toDataURL('image/jpeg', 0.72));
    closeProductCamera();
}

// ================= NAVIGASI =================
function switchTab(tabId) {
    const target = document.getElementById(tabId);
    if (!target) return;

    currentPage = tabId;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    target.classList.add('active');

    if (tabId !== 'page-kasir') stopScanner();
    if (tabId !== 'page-barang') closeProductCamera();

    if (tabId === 'page-home') updateDashboardStats();
    if (tabId === 'page-barang') renderProducts();
    if (tabId === 'page-riwayat') renderHistory();
    if (tabId === 'page-pengaturan') loadSettingsUI();

    window.scrollTo({ top: 0, behavior: 'auto' });
}

function goToHome() {
    switchTab('page-home');
}

function actionCariBarang() {
    switchTab('page-barang');
    setAdminMode(false);
    document.getElementById('search-input').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-stock').value = '';
    renderProducts();
    setTimeout(() => document.getElementById('search-input').focus(), 100);
}

function actionTambahBarang() {
    switchTab('page-barang');
    resetProductForm();
    setAdminMode(true);
}

function actionPos() {
    switchTab('page-kasir');
}

function actionRiwayat() {
    switchTab('page-riwayat');
}

function updateDashboardStats() {
    const products = DB.getProducts();
    const lowStock = products.filter(product => product.stok > 0 && product.stok <= 5).length;
    const outOfStock = products.filter(product => product.stok === 0).length;

    document.getElementById('stat-barang').textContent = products.length;
    document.getElementById('stat-menipis').textContent = lowStock;
    document.getElementById('stat-habis').textContent = outOfStock;

    const todayKey = getLocalDateKey();
    const todayHistory = DB.getHistory().filter(transaction =>
        getLocalDateKey(transaction.createdAt || transaction.id) === todayKey
    );
    const todayRevenue = todayHistory.reduce((sum, transaction) => sum + Number(transaction.total || 0), 0);
    const todayItems = todayHistory.reduce((sum, transaction) =>
        sum + transaction.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0), 0
    );

    document.getElementById('home-today-revenue').textContent = formatRupiah(todayRevenue);
    document.getElementById('home-today-transactions').textContent = todayHistory.length;
    document.getElementById('home-today-items').textContent = todayItems;
    document.getElementById('home-today-average').textContent = formatRupiah(
        todayHistory.length ? todayRevenue / todayHistory.length : 0
    );

    const criticalProducts = products
        .filter(product => product.stok <= 5)
        .sort((first, second) => first.stok - second.stok || first.name.localeCompare(second.name, 'id'))
        .slice(0, 5);
    const criticalList = document.getElementById('home-low-stock-list');

    if (!criticalProducts.length) {
        criticalList.innerHTML = '<div class="dashboard-empty">Stok barang masih aman.</div>';
    } else {
        criticalList.innerHTML = criticalProducts.map(product => `
            <div class="low-stock-row">
                <span class="stock-signal ${product.stok === 0 ? 'is-out' : 'is-low'}"></span>
                <div class="low-stock-info">
                    <strong>${escapeHtml(product.name)}</strong>
                    <small>${escapeHtml(product.category)} · ${escapeHtml(product.satuan || 'Pcs')}</small>
                </div>
                <span class="low-stock-count ${product.stok === 0 ? 'stock-out' : 'stock-low'}">${product.stok}</span>
            </div>
        `).join('');
    }
}

function openLowStockProducts() {
    switchTab('page-barang');
    setAdminMode(false);
    document.getElementById('filter-stock').value = 'critical';
    document.getElementById('filter-category').value = '';
    document.getElementById('search-input').value = '';
    renderProducts();
}

// ================= PENGATURAN =================
function loadSettingsUI() {
    const settings = DB.getSettings();
    document.getElementById('setting-autoprint').value = String(settings.autoPrint);
    document.getElementById('setting-printmode').value = settings.printMode || 'rawbt';
    document.getElementById('template-header').value = settings.headerText || 'WARUNGSCAN';
    document.getElementById('template-footer').value = settings.footerText || 'Terima Kasih';
    document.getElementById('setting-admin-pin').value = settings.adminPin || '';

    const previewContainer = document.getElementById('preview-logo-container');
    const previewImage = document.getElementById('preview-logo');
    if (settings.logoBase64) {
        previewImage.src = safeImageSource(settings.logoBase64);
        previewContainer.style.display = 'flex';
    } else {
        previewImage.removeAttribute('src');
        previewContainer.style.display = 'none';
    }
    updatePrintModeUI();
}

async function handleLogoUpload() {
    const fileInput = document.getElementById('setting-logo');
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
        const logoBase64 = await getBase64(file, true);
        const settings = DB.getSettings();
        settings.logoBase64 = logoBase64;
        if (DB.saveSettings(settings)) {
            loadSettingsUI();
            alert('Logo berhasil disimpan.');
        }
    } catch (error) {
        alert(`Logo gagal diproses: ${error.message}`);
    } finally {
        fileInput.value = '';
    }
}

function hapusLogo() {
    const settings = DB.getSettings();
    settings.logoBase64 = '';
    if (DB.saveSettings(settings)) loadSettingsUI();
}

function saveSettings() {
    const settings = DB.getSettings();
    settings.autoPrint = document.getElementById('setting-autoprint').value === 'true';
    settings.printMode = document.getElementById('setting-printmode').value;
    settings.headerText = document.getElementById('template-header').value.trim() || 'WARUNGSCAN';
    settings.footerText = document.getElementById('template-footer').value.trim() || 'Terima Kasih';
    settings.adminPin = document.getElementById('setting-admin-pin').value.replace(/\D/g, '').slice(0, 6);
    DB.saveSettings(settings);
}

function updatePrintModeUI() {
    const mode = document.getElementById('setting-printmode')?.value || DB.getSettings().printMode;
    const bluetoothActions = document.getElementById('bluetooth-printer-actions');
    if (!bluetoothActions) return;

    bluetoothActions.style.display = mode === 'bluetooth' ? 'grid' : 'none';
    if (mode === 'rawbt') updatePrinterStatus('Mode RawBT siap digunakan', true);
    else if (mode === 'browser') updatePrinterStatus('Dialog cetak browser siap digunakan', true);
    else if (isNativePrinterConnected()) {
        updatePrinterStatus('Terhubung: RPP02N', true);
    } else if (bluetoothDevice?.gatt?.connected) {
        updatePrinterStatus(`Terhubung: ${bluetoothDevice.name || 'Printer'}`, true);
    } else {
        updatePrinterStatus('Printer Bluetooth belum terhubung', false);
    }
}

// ================= SCANNER BARCODE =================
function setScannerMessage(message, isError = false) {
    const element = document.getElementById('scanner-message');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('text-error', isError);
}

function clearScannerTimers() {
    clearTimeout(scannerStartTimer);
    clearTimeout(scannerRestartTimer);
    scannerStartTimer = null;
    scannerRestartTimer = null;
}

function updateScannerButtons(isScanning = false, isBusy = false) {
    const startButton = document.getElementById('btn-start-scan');
    const stopButton = document.getElementById('btn-stop-scan');
    if (!startButton || !stopButton) return;

    startButton.style.display = isScanning ? 'none' : 'flex';
    stopButton.style.display = isScanning ? 'flex' : 'none';
    startButton.disabled = isBusy;
    stopButton.disabled = isBusy;
}

async function startScanner() {
    clearTimeout(scannerStartTimer);
    scannerStartTimer = null;
    if (currentPage !== 'page-kasir' || scannerStarting || html5QrcodeScanner?.isScanning) return;

    if (typeof Html5Qrcode === 'undefined') {
        setScannerMessage('Modul scanner gagal dimuat. Periksa koneksi internet lalu buka ulang aplikasi.', true);
        alert('Modul barcode belum termuat. Periksa internet lalu muat ulang aplikasi.');
        return;
    }

    scannerStarting = true;
    updateScannerButtons(false, true);
    setScannerMessage('Membuka kamera…');

    try {
        if (html5QrcodeScanner) {
            try { html5QrcodeScanner.clear(); } catch (error) { /* sudah bersih */ }
        }
        html5QrcodeScanner = new Html5Qrcode('reader');
        await html5QrcodeScanner.start(
            { facingMode: 'environment' },
            { fps: 12, qrbox: { width: 250, height: 150 } },
            onScanSuccess,
            () => {}
        );

        if (currentPage !== 'page-kasir') {
            await stopScanner();
            return;
        }
        updateScannerButtons(true, false);
        setScannerMessage('Arahkan kamera ke barcode produk.');
    } catch (error) {
        console.error('Kamera scanner gagal dibuka.', error);
        html5QrcodeScanner = null;
        updateScannerButtons(false, false);
        setScannerMessage('Kamera gagal dibuka. Gunakan tombol foto barcode atau periksa izin kamera.', true);
        alert(`Kamera gagal diakses: ${error.message}`);
    } finally {
        scannerStarting = false;
    }
}

async function stopScanner(cancelTimers = true) {
    if (cancelTimers) clearScannerTimers();
    const scanner = html5QrcodeScanner;
    html5QrcodeScanner = null;

    if (scanner) {
        try {
            if (scanner.isScanning) await scanner.stop();
        } catch (error) {
            console.debug('Scanner sudah berhenti.', error);
        }
        try {
            scanner.clear();
        } catch (error) {
            console.debug('Area scanner sudah bersih.', error);
        }
    }

    updateScannerButtons(false, false);
    if (currentPage === 'page-kasir') setScannerMessage('Scanner berhenti. Tekan Mulai Scan untuk melanjutkan.');
}

function scheduleScannerRestart(delay = 1200) {
    clearTimeout(scannerRestartTimer);
    if (currentPage !== 'page-kasir') return;
    scannerRestartTimer = setTimeout(() => {
        scannerRestartTimer = null;
        if (currentPage === 'page-kasir') startScanner();
    }, delay);
}

async function onScanSuccess(decodedText) {
    if (scanLocked) return;
    scanLocked = true;
    const shouldRestart = Boolean(html5QrcodeScanner?.isScanning);

    try {
        if (shouldRestart) await stopScanner(false);
        const barcode = String(decodedText || '').trim();
        const product = DB.getProducts().find(item => item.barcode === barcode);

        if (product) {
            vibrate();
            playBeep();
            addToCart(product);
            setScannerMessage(`${product.name} ditambahkan ke keranjang.`);
        } else {
            setScannerMessage(`Barcode ${barcode} belum terdaftar.`, true);
            alert('Barang tidak ditemukan dalam database.');
        }
    } finally {
        scanLocked = false;
        if (shouldRestart) scheduleScannerRestart();
    }
}

async function decodeBarcodeFile(file) {
    if (typeof Html5Qrcode === 'undefined') throw new Error('Modul barcode belum termuat.');
    if (fileScannerBusy) throw new Error('Foto barcode lain sedang diproses.');
    fileScannerBusy = true;

    const readerElement = document.getElementById('file-reader');
    readerElement.innerHTML = '';
    const fileScanner = new Html5Qrcode('file-reader');

    try {
        return await fileScanner.scanFile(file, false);
    } finally {
        try { fileScanner.clear(); } catch (error) { /* tidak ada resource aktif */ }
        readerElement.innerHTML = '';
        fileScannerBusy = false;
    }
}

async function scanBarcodeFromFile(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;
    const resumeLiveScanner = Boolean(html5QrcodeScanner?.isScanning);

    try {
        if (resumeLiveScanner) await stopScanner(false);
        setScannerMessage('Membaca barcode dari foto…');
        const decodedText = await decodeBarcodeFile(file);
        await onScanSuccess(decodedText);
    } catch (error) {
        console.error('Barcode foto gagal dibaca.', error);
        setScannerMessage('Barcode tidak terdeteksi pada foto.', true);
        alert(`Barcode tidak terdeteksi: ${error.message}`);
    } finally {
        inputElement.value = '';
        if (resumeLiveScanner) scheduleScannerRestart(500);
    }
}

async function scanProductBarcodeFromFile(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;

    try {
        const decodedText = await decodeBarcodeFile(file);
        document.getElementById('input-barcode').value = String(decodedText).trim();
        vibrate();
        playBeep();
        alert('Barcode berhasil dimasukkan ke form barang.');
    } catch (error) {
        console.error('Barcode produk gagal dibaca.', error);
        alert(`Barcode tidak terdeteksi: ${error.message}`);
    } finally {
        inputElement.value = '';
    }
}

// ================= PENCARIAN POS =================
function cariBarangKasir() {
    const keyword = document.getElementById('manual-barcode').value.trim().toLowerCase();
    const resultContainer = document.getElementById('kasir-search-results');

    if (!keyword) {
        resultContainer.style.display = 'none';
        resultContainer.innerHTML = '';
        return;
    }

    const filtered = DB.getProducts().filter(product =>
        product.barcode.toLowerCase().includes(keyword) ||
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword)
    );

    if (!filtered.length) {
        resultContainer.innerHTML = '<li class="empty-result">Tidak ditemukan</li>';
    } else {
        resultContainer.innerHTML = filtered.map((product, index) => `
            <li data-product-index="${index}">
                <div class="item-info">
                    <h4>${escapeHtml(product.name)}</h4>
                    <p>${escapeHtml(product.category)} · BC: ${escapeHtml(product.barcode)} · Stok ${product.stok}</p>
                </div>
                <strong class="text-success">${formatRupiah(product.price)}</strong>
            </li>
        `).join('');

        resultContainer.querySelectorAll('[data-product-index]').forEach(element => {
            element.addEventListener('click', () => pilihBarangKasir(filtered[Number(element.dataset.productIndex)].barcode));
        });
    }
    resultContainer.style.display = 'block';
}

function pilihBarangKasir(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;
    addToCart(product);
    document.getElementById('manual-barcode').value = '';
    document.getElementById('kasir-search-results').style.display = 'none';
}

function addManualBarcode() {
    const keyword = document.getElementById('manual-barcode').value.trim().toLowerCase();
    if (!keyword) return;

    const products = DB.getProducts();
    const exactMatch = products.find(product => product.barcode.toLowerCase() === keyword);
    if (exactMatch) {
        pilihBarangKasir(exactMatch.barcode);
        return;
    }

    const filtered = products.filter(product =>
        product.barcode.toLowerCase().includes(keyword) ||
        product.name.toLowerCase().includes(keyword) ||
        product.category.toLowerCase().includes(keyword)
    );
    if (filtered.length === 1) pilihBarangKasir(filtered[0].barcode);
    else if (filtered.length > 1) alert('Ada lebih dari satu barang yang cocok. Pilih dari daftar.');
    else alert('Barang tidak ditemukan.');
}

// ================= MANAJEMEN BARANG =================
function resetProductForm() {
    editingBarcode = null;
    ['input-barcode', 'input-nama', 'input-harga', 'input-harga-beli', 'input-stok']
        .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('input-satuan').value = 'Pcs';
    document.getElementById('input-kategori').value = 'Lainnya';
    setProductPhoto('');
    document.getElementById('title-barang').textContent = isAdmin ? 'Tambah Barang' : 'Manajemen Barang';
}

function setAdminMode(enabled) {
    if (enabled && !isAdmin) {
        const adminPin = DB.getSettings().adminPin;
        if (adminPin) {
            const enteredPin = prompt('Masukkan PIN Admin:');
            if (enteredPin !== adminPin) {
                if (enteredPin !== null) alert('PIN Admin salah.');
                return false;
            }
        }
    }

    isAdmin = Boolean(enabled);
    const button = document.getElementById('btn-admin-toggle');
    const form = document.getElementById('admin-form');
    const title = document.getElementById('title-barang');

    form.style.display = isAdmin ? 'block' : 'none';
    button.textContent = isAdmin ? 'Tutup Form' : 'Tambah / Edit';
    button.classList.toggle('btn-danger', isAdmin);
    button.classList.toggle('btn-pill-light', !isAdmin);
    title.textContent = isAdmin ? (editingBarcode ? 'Edit Barang' : 'Tambah Barang') : 'Manajemen Barang';

    if (!isAdmin) resetProductForm();
    renderProducts();
    return true;
}

function toggleAdminMode() {
    setAdminMode(!isAdmin);
}

function editBarang(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;

    editingBarcode = product.barcode;
    setAdminMode(true);
    document.getElementById('input-barcode').value = product.barcode;
    document.getElementById('input-nama').value = product.name;
    document.getElementById('input-harga').value = product.price;
    document.getElementById('input-harga-beli').value = product.hargaBeli || '';
    document.getElementById('input-stok').value = product.stok;
    document.getElementById('input-satuan').value = product.satuan || '';
    document.getElementById('input-kategori').value = product.category || 'Lainnya';
    setProductPhoto(product.photo || '');
    document.getElementById('title-barang').textContent = 'Edit Barang';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function simpanBarang() {
    const barcode = document.getElementById('input-barcode').value.trim();
    const name = document.getElementById('input-nama').value.trim();
    const price = Number(document.getElementById('input-harga').value);
    const purchasePriceInput = document.getElementById('input-harga-beli').value.trim();
    const purchasePrice = purchasePriceInput === '' ? 0 : Number(purchasePriceInput);
    const stock = Number.parseInt(document.getElementById('input-stok').value, 10);
    const unit = document.getElementById('input-satuan').value.trim();
    const category = document.getElementById('input-kategori').value.trim();

    if (!barcode || !name || !category || !unit || !Number.isFinite(price) || !Number.isFinite(purchasePrice) || !Number.isInteger(stock)) {
        alert('Lengkapi Barcode, Nama, Kategori, Harga Jual, Stok, dan Satuan.');
        return;
    }
    if (price < 0 || purchasePrice < 0 || stock < 0) {
        alert('Harga dan stok tidak boleh bernilai negatif.');
        return;
    }

    const duplicate = DB.getProducts().find(product =>
        product.barcode === barcode && product.barcode !== editingBarcode
    );
    if (duplicate) {
        alert('Barcode sudah dipakai oleh barang lain.');
        return;
    }

    const saved = DB.saveProduct({
        barcode,
        name,
        price,
        hargaBeli: purchasePrice,
        stok: stock,
        satuan: unit,
        category,
        photo: window.capturedProductPhoto || ''
    }, editingBarcode);

    if (!saved) {
        alert('Barang belum tersimpan. Periksa barcode atau kapasitas penyimpanan.');
        return;
    }

    resetProductForm();
    renderProducts();
    updateDashboardStats();
    alert('Data barang berhasil tersimpan.');
}

function renderProducts() {
    const productList = document.getElementById('product-list');
    const searchKeyword = document.getElementById('search-input').value.trim().toLowerCase();
    const categoryFilter = document.getElementById('filter-category').value;
    const stockFilter = document.getElementById('filter-stock').value;
    const filtered = DB.getProducts().filter(product =>
        (product.name.toLowerCase().includes(searchKeyword) ||
        product.barcode.toLowerCase().includes(searchKeyword) ||
        product.category.toLowerCase().includes(searchKeyword)) &&
        (!categoryFilter || product.category === categoryFilter) &&
        (!stockFilter ||
            (stockFilter === 'available' && product.stok > 0) ||
            (stockFilter === 'critical' && product.stok <= 5) ||
            (stockFilter === 'low' && product.stok >= 1 && product.stok <= 5) ||
            (stockFilter === 'out' && product.stok === 0))
    );

    document.getElementById('catalog-count').textContent = filtered.length;

    if (!filtered.length) {
        productList.innerHTML = '<li class="empty-state">Belum ada barang yang cocok.</li>';
        return;
    }

    productList.innerHTML = filtered.map((product, index) => {
        const stockClass = product.stok === 0 ? 'stock-out' : product.stok <= 5 ? 'stock-low' : '';
        return `
            <li>
                <img src="${safeImageSource(product.photo)}" class="product-img" alt="">
                <div class="item-info">
                    <h4>${escapeHtml(product.name)}</h4>
                    <span class="category-badge">${escapeHtml(product.category)}</span>
                    <p class="${stockClass}">Stok: <strong>${product.stok}</strong> ${escapeHtml(product.satuan)} · ${formatRupiah(product.price)}</p>
                    <p class="barcode-caption">BC: ${escapeHtml(product.barcode)}</p>
                </div>
                ${isAdmin ? `
                    <div class="item-actions">
                        <button data-restock-index="${index}" class="btn-warning btn-small">+ Stok</button>
                        <button data-edit-index="${index}" class="btn-primary btn-small">Edit</button>
                        <button data-delete-index="${index}" class="btn-danger btn-small">Hapus</button>
                    </div>
                ` : ''}
            </li>
        `;
    }).join('');

    productList.querySelectorAll('[data-edit-index]').forEach(button => {
        button.addEventListener('click', () => editBarang(filtered[Number(button.dataset.editIndex)].barcode));
    });
    productList.querySelectorAll('[data-restock-index]').forEach(button => {
        button.addEventListener('click', () => restockProduct(filtered[Number(button.dataset.restockIndex)].barcode));
    });
    productList.querySelectorAll('[data-delete-index]').forEach(button => {
        button.addEventListener('click', () => hapusBarang(filtered[Number(button.dataset.deleteIndex)].barcode));
    });
}

function restockProduct(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;

    const rawAmount = prompt(`Tambahkan stok untuk ${product.name}:`, '1');
    if (rawAmount === null) return;
    const amount = Number.parseInt(rawAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
        alert('Jumlah restok harus berupa angka lebih dari 0.');
        return;
    }

    const saved = DB.saveProduct({ ...product, stok: product.stok + amount }, product.barcode);
    if (!saved) return;
    renderProducts();
    updateDashboardStats();
    alert(`Stok ${product.name} bertambah ${amount} ${product.satuan || 'Pcs'}.`);
}

function hapusBarang(barcode) {
    if (!confirm('Yakin ingin menghapus barang ini secara permanen?')) return;
    if (DB.deleteProduct(barcode)) {
        cart = cart.filter(item => item.barcode !== barcode);
        renderProducts();
        renderCart();
        updateDashboardStats();
    }
}

// ================= KERANJANG =================
function addToCart(product) {
    const existing = cart.find(item => item.barcode === product.barcode);
    if (existing) {
        if (existing.qty >= product.stok) {
            alert('Stok tidak mencukupi.');
            return;
        }
        existing.qty += 1;
        existing.subtotal = existing.qty * existing.price;
    } else {
        if (product.stok <= 0) {
            alert('Stok barang kosong.');
            return;
        }
        cart.push({ ...product, qty: 1, subtotal: product.price });
    }
    renderCart();
}

function ubahQty(barcode, delta) {
    const item = cart.find(entry => entry.barcode === barcode);
    const product = DB.getProducts().find(entry => entry.barcode === barcode);
    if (!item || !product) return;

    const nextQuantity = item.qty + delta;
    if (nextQuantity <= 0) {
        cart = cart.filter(entry => entry.barcode !== barcode);
    } else if (nextQuantity <= product.stok) {
        item.qty = nextQuantity;
        item.subtotal = item.qty * item.price;
    } else {
        alert(`Stok tersisa ${product.stok}.`);
    }
    renderCart();
}

function ketikQtyManual(barcode, inputElement) {
    const item = cart.find(entry => entry.barcode === barcode);
    const product = DB.getProducts().find(entry => entry.barcode === barcode);
    if (!item || !product) return;

    let quantity = Number.parseInt(inputElement.value, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) quantity = 1;
    if (quantity > product.stok) {
        alert(`Stok gudang hanya tersisa ${product.stok}.`);
        quantity = product.stok;
    }
    if (quantity <= 0) cart = cart.filter(entry => entry.barcode !== barcode);
    else {
        item.qty = quantity;
        item.subtotal = item.qty * item.price;
    }
    renderCart();
}

function renderCart() {
    const cartList = document.getElementById('cart-list');
    if (!cart.length) {
        cartList.innerHTML = '<li class="empty-state">Keranjang masih kosong.</li>';
        document.getElementById('cart-total').textContent = formatRupiah(0);
        return;
    }

    cartList.innerHTML = cart.map((item, index) => `
        <li class="cart-item">
            <div class="item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p class="text-primary">${formatRupiah(item.price)}</p>
            </div>
            <div class="qty-controls">
                <button data-minus-index="${index}" aria-label="Kurangi">−</button>
                <input type="number" class="qty-input-box" value="${item.qty}" min="1" data-qty-index="${index}">
                <button data-plus-index="${index}" aria-label="Tambah">+</button>
            </div>
            <strong class="cart-subtotal">${formatRupiah(item.subtotal)}</strong>
        </li>
    `).join('');

    cartList.querySelectorAll('[data-minus-index]').forEach(button => {
        button.addEventListener('click', () => ubahQty(cart[Number(button.dataset.minusIndex)].barcode, -1));
    });
    cartList.querySelectorAll('[data-plus-index]').forEach(button => {
        button.addEventListener('click', () => ubahQty(cart[Number(button.dataset.plusIndex)].barcode, 1));
    });
    cartList.querySelectorAll('[data-qty-index]').forEach(input => {
        input.addEventListener('change', () => ketikQtyManual(cart[Number(input.dataset.qtyIndex)].barcode, input));
    });

    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    document.getElementById('cart-total').textContent = formatRupiah(total);
}

// ================= PEMBAYARAN & CETAK =================
function openPaymentModal() {
    if (!cart.length) {
        alert('Keranjang kosong.');
        return;
    }
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    document.getElementById('modal-total-belanja').textContent = formatRupiah(total);
    document.getElementById('input-tunai').value = '';
    document.getElementById('modal-kembalian').textContent = formatRupiah(0);
    document.getElementById('payment-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('input-tunai').focus(), 100);
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
}

function closePreviewModal() {
    document.getElementById('preview-modal').style.display = 'none';
}

function hitungKembalian() {
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const cash = Number(document.getElementById('input-tunai').value) || 0;
    document.getElementById('modal-kembalian').textContent = formatRupiah(Math.max(0, cash - total));
}

function buildReceipt(transaction, isCopy = false) {
    const settings = DB.getSettings();
    let receipt = `${settings.headerText || 'WARUNGSCAN'}\n`;
    receipt += `${transaction.waktu}${isCopy ? ' (COPY)' : ''}\n`;
    receipt += '--------------------------------\n';
    transaction.items.forEach(item => {
        receipt += `${item.name}\n`;
        const subtotal = Number(item.subtotal).toLocaleString('id-ID');
        const quantityAndPrice = `${item.qty} x ${Number(item.price).toLocaleString('id-ID')}`;
        const spaces = Math.max(1, 32 - quantityAndPrice.length - subtotal.length);
        receipt += `${quantityAndPrice}${' '.repeat(spaces)}${subtotal}\n`;
    });
    receipt += '--------------------------------\n';
    receipt += `TOTAL:    Rp ${Number(transaction.total).toLocaleString('id-ID')}\n`;
    receipt += `TUNAI:    Rp ${Number(transaction.tunai).toLocaleString('id-ID')}\n`;
    receipt += `KEMBALI:  Rp ${Number(transaction.kembali).toLocaleString('id-ID')}\n`;
    receipt += '--------------------------------\n';
    receipt += `     ${settings.footerText || 'Terima Kasih'}     \n`;
    return receipt;
}

async function prosesKePreview() {
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const cash = Number(document.getElementById('input-tunai').value) || 0;
    if (cash < total) {
        alert('Uang tunai pembeli kurang.');
        return;
    }

    const products = DB.getProducts();
    for (const cartItem of cart) {
        const product = products.find(item => item.barcode === cartItem.barcode);
        if (!product || product.stok < cartItem.qty) {
            alert(`Stok ${cartItem.name} berubah atau tidak mencukupi. Perbarui keranjang.`);
            return;
        }
        product.stok -= cartItem.qty;
    }

    const now = Date.now();
    const transaction = {
        id: now,
        createdAt: now,
        waktu: new Date(now).toLocaleString('id-ID'),
        items: cart.map(item => ({ ...item })),
        total,
        tunai: cash,
        kembali: cash - total
    };

    if (!DB.commitSale(products, transaction)) return;

    const receiptText = buildReceipt(transaction);
    document.getElementById('print-text-preview').value = receiptText;
    cart = [];
    renderCart();
    closePaymentModal();
    updateDashboardStats();

    const settings = DB.getSettings();
    if (settings.autoPrint) {
        const printed = await printReceipt(receiptText);
        if (!printed) document.getElementById('preview-modal').style.display = 'flex';
    } else {
        document.getElementById('preview-modal').style.display = 'flex';
    }
}

function cetakViaRawBT(textData) {
    try {
        const encodedText = encodeURIComponent(textData);
        window.location.href = `intent:${encodedText}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        return true;
    } catch (error) {
        console.error('RawBT gagal dibuka.', error);
        alert('Gagal memanggil RawBT. Pastikan aplikasi RawBT sudah terinstal.');
        return false;
    }
}

function printViaBrowser(textData, logoBase64) {
    const fallbackLogo = document.getElementById('print-area-logo');
    if (logoBase64) {
        fallbackLogo.src = safeImageSource(logoBase64);
        fallbackLogo.style.display = 'block';
    } else {
        fallbackLogo.removeAttribute('src');
        fallbackLogo.style.display = 'none';
    }
    document.getElementById('print-raw-text').textContent = textData;
    window.print();
    return true;
}

async function printReceipt(textData) {
    const settings = DB.getSettings();
    if (settings.printMode === 'bluetooth') {
        return connectAndPrintBluetooth(textData, settings.logoBase64);
    }
    if (settings.printMode === 'browser') {
        return printViaBrowser(textData, settings.logoBase64);
    }
    return cetakViaRawBT(textData);
}

async function executePrint() {
    const receiptText = document.getElementById('print-text-preview').value;
    document.getElementById('preview-modal').style.display = 'none';
    const printed = await printReceipt(receiptText);
    if (!printed) document.getElementById('preview-modal').style.display = 'flex';
}

async function testPrint() {
    saveSettings();
    const now = new Date().toLocaleString('id-ID');
    const testReceipt =
        `${DB.getSettings().headerText || 'WARUNGSCAN'}\n` +
        'TES PRINTER\n' +
        `${now}\n` +
        '--------------------------------\n' +
        'Printer berhasil menerima data.\n\n\n';
    await printReceipt(testReceipt);
}

// ================= RIWAYAT & LAPORAN =================
function calculateTransactionProfit(transaction) {
    return transaction.items.reduce((sum, item) => {
        return sum + (Number(item.price) - Number(item.hargaBeli || 0)) * Number(item.qty || 0);
    }, 0);
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    const histories = DB.getHistory();
    const todayKey = getLocalDateKey();
    const filterKey = document.getElementById('history-date-filter').value;

    let todayRevenue = 0;
    let todayProfit = 0;
    let todayTransactions = 0;

    histories.forEach(transaction => {
        if (getLocalDateKey(transaction.createdAt || transaction.id) === todayKey) {
            todayRevenue += transaction.total;
            todayProfit += calculateTransactionProfit(transaction);
            todayTransactions += 1;
        }
    });

    document.getElementById('report-today-revenue').textContent = formatRupiah(todayRevenue);
    document.getElementById('report-today-profit').textContent = formatRupiah(todayProfit);
    document.getElementById('report-today-trx').textContent = `${todayTransactions} trx`;

    const filtered = filterKey
        ? histories.filter(transaction => getLocalDateKey(transaction.createdAt || transaction.id) === filterKey)
        : histories;

    if (!filtered.length) {
        historyList.innerHTML = '<li class="empty-state">Belum ada transaksi pada periode ini.</li>';
        return;
    }

    historyList.innerHTML = filtered.map((transaction, index) => {
        const itemNames = transaction.items
            .map(item => `${escapeHtml(item.name)} (${item.qty})`)
            .join(', ');
        return `
            <li>
                <div class="item-info">
                    <h4>No. Ref: ${escapeHtml(transaction.id)}</h4>
                    <p class="text-success">${escapeHtml(transaction.waktu)}</p>
                    <p>${itemNames}</p>
                    <button data-reprint-index="${index}" class="btn-outline btn-small history-print">🖨️ Cetak Ulang</button>
                </div>
                <strong class="history-total">${formatRupiah(transaction.total)}</strong>
            </li>
        `;
    }).join('');

    historyList.querySelectorAll('[data-reprint-index]').forEach(button => {
        button.addEventListener('click', () => cetakUlangStruk(filtered[Number(button.dataset.reprintIndex)].id));
    });
}

function clearHistoryFilter() {
    document.getElementById('history-date-filter').value = '';
    renderHistory();
}

function cetakUlangStruk(transactionId) {
    const transaction = DB.getHistory().find(item => item.id === Number(transactionId));
    if (!transaction) {
        alert('Transaksi tidak ditemukan.');
        return;
    }
    document.getElementById('print-text-preview').value = buildReceipt(transaction, true);
    document.getElementById('preview-modal').style.display = 'flex';
}

function hapusSemuaRiwayat() {
    if (!confirm('Hapus semua riwayat transaksi? Data barang tidak ikut terhapus.')) return;
    if (DB.clearHistory()) renderHistory();
}

function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportHistoryCsv() {
    const histories = DB.getHistory();
    if (!histories.length) {
        alert('Belum ada riwayat untuk diekspor.');
        return;
    }

    const rows = [
        ['ID', 'Tanggal', 'Barang', 'Total', 'Tunai', 'Kembali', 'Estimasi Laba'],
        ...histories.map(transaction => [
            transaction.id,
            transaction.waktu,
            transaction.items.map(item => `${item.name} x${item.qty}`).join('; '),
            transaction.total,
            transaction.tunai,
            transaction.kembali,
            calculateTransactionProfit(transaction)
        ])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `riwayat-kasir-${getLocalDateKey()}.csv`);
}

// ================= BACKUP =================
function exportBackup() {
    const backup = DB.exportData();
    downloadBlob(
        new Blob([backup], { type: 'application/json;charset=utf-8' }),
        `backup-warungscan-${getLocalDateKey()}.json`
    );
}

async function importBackup(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;
    try {
        if (!confirm('Impor backup akan mengganti data yang ada di perangkat ini. Lanjutkan?')) return;
        DB.importData(await file.text());
        cart = [];
        renderCart();
        renderProducts();
        renderHistory();
        updateDashboardStats();
        loadSettingsUI();
        alert('Backup berhasil dipulihkan.');
    } catch (error) {
        console.error('Backup gagal diimpor.', error);
        alert(`Backup gagal diimpor: ${error.message}`);
    } finally {
        inputElement.value = '';
    }
}

// ================= INIT & CLEANUP =================
function initializeNativeDefaults() {
    try {
        if (!window.WarungScanNative?.isNativeApp?.()) return;
        const markerKey = 'warungscan_native_defaults_v1';
        if (localStorage.getItem(markerKey)) return;

        const settings = DB.getSettings();
        settings.printMode = 'bluetooth';
        DB.saveSettings(settings);
        localStorage.setItem(markerKey, 'true');
    } catch (error) {
        console.debug('Pengaturan awal Android tidak dapat diterapkan.', error);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopScanner();
        closeProductCamera();
    }
});
window.addEventListener('pagehide', () => {
    stopScanner();
    closeProductCamera();
});

initializeNativeDefaults();
renderProducts();
renderCart();
updateDashboardStats();
loadSettingsUI();
