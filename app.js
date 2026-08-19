let cart = [];
let isAdmin = false;
let editingBarcode = null;
let currentPage = 'page-home';
let currentPaymentMethod = 'cash';
let paymentProcessing = false;
let activeDebtId = null;
let activeLabelBarcode = null;
let firebaseStatusState = 'unconfigured';

let html5QrcodeScanner = null;
let scannerStarting = false;
let scanLocked = false;
let scannerStartTimer = null;
let scannerRestartTimer = null;
let fileScannerBusy = false;
let productBarcodeScanner = null;
let productBarcodeStarting = false;
let productBarcodeLocked = false;
let productBarcodeSession = 0;

let productCameraStream = null;
window.capturedProductPhoto = '';
let activeAppDialog = null;
const APP_PAGE_STATE_KEY = 'warungScanPage';
const COLOR_THEMES = ['teal', 'emerald', 'blue', 'navy', 'purple', 'pink', 'red', 'orange', 'brown', 'slate'];
const DISPLAY_MODES = ['light', 'dark', 'auto'];

const PRODUCT_PLACEHOLDER =
    'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2260%22%20height%3D%2260%22%3E%3Crect%20width%3D%2260%22%20height%3D%2260%22%20fill%3D%22%23f3f4f6%22%2F%3E%3Ctext%20x%3D%2230%22%20y%3D%2234%22%20font-size%3D%2210%22%20text-anchor%3D%22middle%22%20fill%3D%22%239ca3af%22%3EProduk%3C%2Ftext%3E%3C%2Fsvg%3E';
const DEFAULT_QRIS_IMAGE = 'data:image/png;base64,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';

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

function getQrisImageSource(settings = DB.getSettings()) {
    const savedImage = String(settings?.qrisImageBase64 || '');
    return /^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(savedImage)
        ? savedImage
        : DEFAULT_QRIS_IMAGE;
}

function showAppToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('app-toast-container');
    if (!container) {
        console.info(`[Warung Scan] ${message}`);
        return;
    }

    const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${normalizedType}`;
    toast.innerHTML = `
        <span class="app-toast-icon">${icons[normalizedType]}</span>
        <span class="app-toast-message"></span>
        <button type="button" class="app-toast-close" aria-label="Tutup notifikasi">×</button>
    `;
    toast.querySelector('.app-toast-message').textContent = String(message || '');

    const dismiss = () => {
        if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), 220);
    };
    toast.querySelector('.app-toast-close').addEventListener('click', dismiss);
    container.appendChild(toast);
    while (container.children.length > 3) container.firstElementChild?.remove();
    setTimeout(dismiss, Math.max(1800, Number(duration) || 3200));
}
window.showAppToast = showAppToast;

function finishAppDialog(confirmed) {
    if (!activeAppDialog) return;
    const { resolve, mode, keyHandler } = activeAppDialog;
    const dialog = document.getElementById('app-dialog');
    const input = document.getElementById('app-dialog-input');
    document.removeEventListener('keydown', keyHandler);
    activeAppDialog = null;
    dialog.style.display = 'none';
    if (!confirmed) resolve(mode === 'prompt' ? null : false);
    else resolve(mode === 'prompt' ? input.value : true);
}

function openAppDialog({
    title = 'Warung Scan',
    message = '',
    confirmText = 'Lanjutkan',
    cancelText = 'Batal',
    mode = 'confirm',
    defaultValue = '',
    inputMode = 'text',
    icon = '?',
    hideCancel = false
} = {}) {
    if (activeAppDialog) finishAppDialog(false);

    const dialog = document.getElementById('app-dialog');
    const titleElement = document.getElementById('app-dialog-title');
    const messageElement = document.getElementById('app-dialog-message');
    const iconElement = document.getElementById('app-dialog-icon');
    const input = document.getElementById('app-dialog-input');
    const cancelButton = document.getElementById('app-dialog-cancel');
    const confirmButton = document.getElementById('app-dialog-confirm');
    const actions = dialog.querySelector('.app-dialog-actions');

    titleElement.textContent = title;
    messageElement.textContent = message;
    iconElement.textContent = icon;
    cancelButton.textContent = cancelText;
    confirmButton.textContent = confirmText;
    cancelButton.style.display = hideCancel ? 'none' : 'flex';
    actions.classList.toggle('is-single', hideCancel);

    input.style.display = mode === 'prompt' ? 'block' : 'none';
    input.value = mode === 'prompt' ? String(defaultValue ?? '') : '';
    input.inputMode = inputMode;
    dialog.style.display = 'flex';

    return new Promise(resolve => {
        const keyHandler = event => {
            if (event.key === 'Escape') finishAppDialog(false);
            if (event.key === 'Enter' && (mode !== 'prompt' || document.activeElement === input)) {
                event.preventDefault();
                finishAppDialog(true);
            }
        };
        activeAppDialog = { resolve, mode, keyHandler };
        document.addEventListener('keydown', keyHandler);
        cancelButton.onclick = () => finishAppDialog(false);
        confirmButton.onclick = () => finishAppDialog(true);
        if (mode === 'prompt') setTimeout(() => input.focus(), 80);
        else setTimeout(() => confirmButton.focus(), 80);
    });
}

function showAppConfirm(message, options = {}) {
    return openAppDialog({
        title: options.title || 'Konfirmasi',
        message,
        confirmText: options.confirmText || 'Lanjutkan',
        cancelText: options.cancelText || 'Batal',
        icon: options.icon || '?'
    });
}

function showAppPrompt(message, defaultValue = '', options = {}) {
    return openAppDialog({
        title: options.title || 'Masukkan Data',
        message,
        confirmText: options.confirmText || 'Simpan',
        cancelText: options.cancelText || 'Batal',
        mode: 'prompt',
        defaultValue,
        inputMode: options.inputMode || 'text',
        icon: options.icon || '#'
    });
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
                    showAppToast('File gagal disiapkan untuk disimpan.', 'error');
                    return;
                }
                window.WarungScanNative.saveFileBase64(
                    filename,
                    blob.type || 'application/octet-stream',
                    base64Data
                );
            };
            reader.onerror = () => showAppToast('File gagal dibaca sebelum disimpan.', 'error');
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
                if (!isLogo) {
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, width, height);
                }
                context.drawImage(image, 0, 0, width, height);
                resolve(isLogo ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.72));
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = () => reject(new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
        image.src = dataUrl;
    });
}

async function getQrisBase64(file) {
    if (!file) throw new Error('Gambar QRIS tidak ditemukan.');
    if (file.type && !file.type.startsWith('image/')) throw new Error('QRIS harus berupa gambar.');

    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = () => reject(new Error('Gambar QRIS gagal dibaca.'));
        reader.readAsDataURL(file);
    });

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const maxWidth = 900;
                const maxHeight = 1200;
                const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                const context = canvas.getContext('2d');
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                const ratio = canvas.width / canvas.height;
                resolve(ratio >= 0.82 && ratio <= 1.18
                    ? canvas.toDataURL('image/png')
                    : canvas.toDataURL('image/jpeg', 0.9));
            } catch (error) {
                reject(error);
            }
        };
        image.onerror = () => reject(new Error('Format QRIS tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
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
        showAppToast('Foto produk berhasil dipilih.', 'success');
    } catch (error) {
        showAppToast(`Gagal memproses gambar: ${error.message}`, 'error');
    } finally {
        inputElement.value = '';
    }
}

function removeProductPhoto() {
    setProductPhoto('');
}

async function requestCameraPermission(showSuccess = true) {
    if (!navigator.mediaDevices?.getUserMedia) {
        showAppToast('Kamera tidak tersedia di perangkat ini.', 'error');
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
        });
        stream.getTracks().forEach(track => track.stop());
        if (showSuccess) showAppToast('Izin kamera berhasil diaktifkan.', 'success');
        return true;
    } catch (error) {
        showAppToast(`Akses kamera gagal: ${error.message}`, 'error');
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
        const useFallback = await showAppConfirm(
            'Kamera langsung belum dapat dibuka. Gunakan aplikasi kamera bawaan sebagai pengganti?',
            { title: 'Kamera Tidak Tersedia', confirmText: 'Buka Kamera', icon: '📷' }
        );
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
        showAppToast('Kamera belum siap. Tunggu sebentar lalu coba lagi.', 'warning');
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
    showAppToast('Foto produk berhasil diambil.', 'success');
}

// ================= NAVIGASI =================
function switchTab(tabId, options = {}) {
    const target = document.getElementById(tabId);
    if (!target) return;

    const previousPage = currentPage;
    if (options.updateHistory !== false && previousPage !== tabId) {
        window.history.pushState({ [APP_PAGE_STATE_KEY]: tabId }, '', window.location.href);
    }
    currentPage = tabId;
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    target.classList.add('active');

    if (tabId !== 'page-kasir') stopScanner();
    if (tabId !== 'page-barang') {
        closeProductCamera();
        closeProductBarcodeScanner();
    }

    if (tabId === 'page-home') updateDashboardStats();
    if (tabId === 'page-barang') renderProducts();
    if (tabId === 'page-riwayat') renderHistory();
    if (tabId === 'page-piutang') renderDebts();
    if (tabId === 'page-pengaturan') loadSettingsUI();

    window.scrollTo({ top: 0, behavior: 'auto' });
}

function closeVisibleOverlayForBack() {
    if (activeAppDialog) {
        finishAppDialog(false);
        return true;
    }

    const productBarcodeModal = document.getElementById('product-barcode-modal');
    if (productBarcodeModal?.style.display === 'flex') {
        closeProductBarcodeScanner();
        return true;
    }

    const productCameraModal = document.getElementById('product-camera-modal');
    if (productCameraModal?.style.display === 'flex') {
        closeProductCamera();
        return true;
    }

    const debtPaymentModal = document.getElementById('debt-payment-modal');
    if (debtPaymentModal?.style.display === 'flex') {
        closeDebtPaymentModal();
        return true;
    }

    const barcodeLabelModal = document.getElementById('barcode-label-modal');
    if (barcodeLabelModal?.style.display === 'flex') {
        closeBarcodeLabel();
        return true;
    }

    for (const modalId of ['payment-modal', 'preview-modal']) {
        const modal = document.getElementById(modalId);
        if (modal?.style.display === 'flex') {
            modal.style.display = 'none';
            return true;
        }
    }
    return false;
}

function goBackInApp() {
    if (closeVisibleOverlayForBack()) return true;
    if (currentPage === 'page-home') return false;

    if (window.history.state?.[APP_PAGE_STATE_KEY] === currentPage && window.history.length > 1) {
        window.history.back();
    } else {
        switchTab('page-home', { updateHistory: false });
    }
    return true;
}
window.goBackInApp = goBackInApp;

function goToHome() {
    switchTab('page-home');
}

window.addEventListener('popstate', event => {
    if (closeVisibleOverlayForBack()) {
        window.history.pushState({ [APP_PAGE_STATE_KEY]: currentPage }, '', window.location.href);
        return;
    }
    const targetPage = event.state?.[APP_PAGE_STATE_KEY] || 'page-home';
    switchTab(targetPage, { updateHistory: false });
});

async function actionCariBarang() {
    switchTab('page-barang');
    await setAdminMode(false);
    document.getElementById('search-input').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-stock').value = '';
    renderProducts();
    setTimeout(() => document.getElementById('search-input').focus(), 100);
}

async function actionTambahBarang() {
    switchTab('page-barang');
    resetProductForm();
    await setAdminMode(true);
}

function actionPos() {
    switchTab('page-kasir');
}

function actionRiwayat() {
    switchTab('page-riwayat');
}

function actionPiutang() {
    switchTab('page-piutang');
}

async function actionLabels() {
    switchTab('page-barang');
    await setAdminMode(false);
    document.getElementById('search-input').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-stock').value = '';
    renderProducts();
    showAppToast('Pilih tombol Label pada barang yang ingin dicetak.', 'info');
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

    const openDebts = DB.getDebts().filter(debt => debt.remainingAmount > 0);
    const debtTotal = openDebts.reduce((sum, debt) => sum + Number(debt.remainingAmount || 0), 0);
    const debtCustomers = new Set(openDebts.map(debt => debt.customerId || debt.customerName)).size;
    const today = getLocalDateKey();
    const overdueCount = openDebts.filter(debt => debt.dueDate && debt.dueDate < today).length;
    const debtTotalElement = document.getElementById('home-debt-total');
    if (debtTotalElement) debtTotalElement.textContent = formatRupiah(debtTotal);
    const debtCustomersElement = document.getElementById('home-debt-customers');
    if (debtCustomersElement) debtCustomersElement.textContent = `${debtCustomers} pelanggan`;
    const debtOverdueElement = document.getElementById('home-debt-overdue');
    if (debtOverdueElement) debtOverdueElement.textContent = overdueCount ? `${overdueCount} lewat jatuh tempo` : 'Tidak ada yang terlambat';

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
function getEffectiveDisplayMode(settings = DB.getSettings()) {
    const selectedMode = DISPLAY_MODES.includes(settings.displayMode) ? settings.displayMode : 'light';
    if (selectedMode !== 'auto') return selectedMode;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyAppTheme(settings = DB.getSettings()) {
    const colorTheme = COLOR_THEMES.includes(settings.colorTheme) ? settings.colorTheme : 'teal';
    const displayMode = DISPLAY_MODES.includes(settings.displayMode) ? settings.displayMode : 'light';
    const root = document.documentElement;
    root.dataset.colorTheme = colorTheme;
    root.dataset.displayMode = displayMode;
    root.dataset.effectiveMode = getEffectiveDisplayMode(settings);

    const themeColor = getComputedStyle(root).getPropertyValue('--brand-primary').trim();
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && themeColor) metaTheme.setAttribute('content', themeColor);
}

function updateThemeUI() {
    const settings = DB.getSettings();
    const colorTheme = COLOR_THEMES.includes(settings.colorTheme) ? settings.colorTheme : 'teal';
    const displayMode = DISPLAY_MODES.includes(settings.displayMode) ? settings.displayMode : 'light';

    document.querySelectorAll('[data-color-theme]').forEach(button => {
        const active = button.dataset.colorTheme === colorTheme;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-display-mode]').forEach(button => {
        const active = button.dataset.displayMode === displayMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function selectColorTheme(colorTheme) {
    if (!COLOR_THEMES.includes(colorTheme)) return;
    const settings = DB.getSettings();
    settings.colorTheme = colorTheme;
    if (DB.saveSettings(settings)) {
        applyAppTheme(settings);
        updateThemeUI();
        showAppToast('Warna aplikasi berhasil diubah.', 'success');
    }
}

function selectDisplayMode(displayMode) {
    if (!DISPLAY_MODES.includes(displayMode)) return;
    const settings = DB.getSettings();
    settings.displayMode = displayMode;
    if (DB.saveSettings(settings)) {
        applyAppTheme(settings);
        updateThemeUI();
        showAppToast('Mode tampilan berhasil diubah.', 'success');
    }
}

function loadSettingsUI() {
    const settings = DB.getSettings();
    applyAppTheme(settings);
    document.getElementById('setting-autoprint').value = String(settings.autoPrint);
    document.getElementById('setting-printmode').value = settings.printMode || 'rawbt';
    document.getElementById('template-header').value = settings.headerText || 'WARUNGSCAN';
    document.getElementById('template-address').value = settings.storeAddress || '';
    document.getElementById('template-phone').value = settings.storePhone || '';
    document.getElementById('template-footer').value = settings.footerText || 'Terima Kasih';
    document.getElementById('setting-admin-pin').value = settings.adminPin || '';
    document.getElementById('setting-qris-merchant').value = settings.qrisMerchantName || 'AL - STORE';

    const previewContainer = document.getElementById('preview-logo-container');
    const previewImage = document.getElementById('preview-logo');
    if (settings.logoBase64) {
        previewImage.src = safeImageSource(settings.logoBase64);
        previewContainer.style.display = 'flex';
    } else {
        previewImage.removeAttribute('src');
        previewContainer.style.display = 'none';
    }
    const qrisImage = getQrisImageSource(settings);
    document.getElementById('setting-qris-preview').src = qrisImage;
    document.getElementById('setting-qris-preview-name').textContent = settings.qrisMerchantName || 'AL - STORE';
    updatePrintModeUI();
    updateReceiptTemplateUI();
    updateThemeUI();
    loadFirebaseSettingsUI();
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
            showAppToast('Logo PNG berhasil disimpan.', 'success');
        }
    } catch (error) {
        showAppToast(`Logo gagal diproses: ${error.message}`, 'error');
    } finally {
        fileInput.value = '';
    }
}

function hapusLogo() {
    const settings = DB.getSettings();
    settings.logoBase64 = '';
    if (DB.saveSettings(settings)) {
        loadSettingsUI();
        showAppToast('Logo toko dihapus.', 'success');
    }
}

async function handleQrisUpload() {
    const fileInput = document.getElementById('setting-qris-file');
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
        const qrisImageBase64 = await getQrisBase64(file);
        const settings = DB.getSettings();
        settings.qrisImageBase64 = qrisImageBase64;
        if (DB.saveSettings(settings)) {
            loadSettingsUI();
            showAppToast('Gambar QRIS berhasil diperbarui.', 'success');
        }
    } catch (error) {
        showAppToast(`QRIS gagal diproses: ${error.message}`, 'error', 4500);
    } finally {
        fileInput.value = '';
    }
}

function restoreDefaultQris() {
    const settings = DB.getSettings();
    settings.qrisImageBase64 = '';
    settings.qrisMerchantName = 'AL - STORE';
    if (DB.saveSettings(settings)) {
        loadSettingsUI();
        showAppToast('QRIS AL - STORE dipakai kembali.', 'success');
    }
}

function saveSettings() {
    const settings = DB.getSettings();
    settings.autoPrint = document.getElementById('setting-autoprint').value === 'true';
    settings.printMode = document.getElementById('setting-printmode').value;
    settings.headerText = document.getElementById('template-header').value.trim() || 'WARUNGSCAN';
    settings.storeAddress = document.getElementById('template-address').value.trim();
    settings.storePhone = document.getElementById('template-phone').value.trim();
    settings.footerText = document.getElementById('template-footer').value.trim() || 'Terima Kasih';
    settings.adminPin = document.getElementById('setting-admin-pin').value.replace(/\D/g, '').slice(0, 6);
    settings.qrisMerchantName = document.getElementById('setting-qris-merchant').value.trim() || 'AL - STORE';
    DB.saveSettings(settings);
    document.getElementById('setting-qris-preview-name').textContent = settings.qrisMerchantName;
    updateReceiptTemplateUI();
}

function parseFirebaseConfigText(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('Tempel konfigurasi Firebase terlebih dahulu.');

    let parsed = null;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        const result = {};
        ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(key => {
            const match = text.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
            if (match) result[key] = match[1];
        });
        parsed = result;
    }

    const config = {
        apiKey: String(parsed?.apiKey || '').trim(),
        authDomain: String(parsed?.authDomain || '').trim(),
        projectId: String(parsed?.projectId || '').trim(),
        storageBucket: String(parsed?.storageBucket || '').trim(),
        messagingSenderId: String(parsed?.messagingSenderId || '').trim(),
        appId: String(parsed?.appId || '').trim()
    };
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
        throw new Error('Konfigurasi belum lengkap. Pastikan apiKey, authDomain, projectId, dan appId ikut ditempel.');
    }
    return config;
}

function loadFirebaseSettingsUI() {
    const configInput = document.getElementById('setting-firebase-config');
    if (!configInput) return;
    const settings = DB.getSettings();
    if (document.activeElement !== configInput) {
        configInput.value = settings.firebaseConfig ? JSON.stringify(settings.firebaseConfig, null, 2) : '';
    }
    const configured = Boolean(settings.firebaseConfig?.apiKey && settings.firebaseConfig?.projectId);
    document.getElementById('firebase-auth-fields').style.display = configured ? 'block' : 'none';
    document.getElementById('firebase-remove-config').style.display = configured ? 'flex' : 'none';
    if (firebaseStatusState === 'unconfigured') {
        setFirebaseStatus(configured
            ? { state: 'signed-out', message: 'Konfigurasi tersimpan. Menunggu koneksi Firebase…' }
            : { state: 'unconfigured', message: 'Firebase belum dikonfigurasi. Data tetap tersimpan di HP ini.' });
    }
}

function setFirebaseStatus(detail = {}) {
    firebaseStatusState = detail.state || firebaseStatusState;
    const status = document.getElementById('firebase-sync-status');
    const badge = document.getElementById('firebase-sync-badge');
    const account = document.getElementById('firebase-account-label');
    const indicator = document.querySelector('.status-indicator');
    if (status) {
        status.textContent = detail.message || 'Status Firebase belum tersedia.';
        status.className = `firebase-status firebase-status-${firebaseStatusState}`;
    }
    if (badge) {
        const labels = {
            online: 'Tersinkron', syncing: 'Menyinkronkan', offline: 'Offline', error: 'Perlu Dicek',
            'signed-out': 'Belum Masuk', unconfigured: 'Belum Diatur'
        };
        badge.textContent = labels[firebaseStatusState] || 'Lokal';
        badge.dataset.state = firebaseStatusState;
    }
    if (account) account.textContent = detail.email ? `Akun: ${detail.email}` : 'Belum ada akun yang masuk.';
    if (indicator) indicator.dataset.syncState = firebaseStatusState;

    const signedIn = Boolean(detail.email) && ['online', 'syncing', 'offline', 'error'].includes(firebaseStatusState);
    const authActions = document.getElementById('firebase-auth-actions');
    const signedInActions = document.getElementById('firebase-signed-in-actions');
    if (authActions) authActions.style.display = signedIn ? 'none' : 'grid';
    if (signedInActions) signedInActions.style.display = signedIn ? 'grid' : 'none';
}
window.setFirebaseStatus = setFirebaseStatus;

async function saveFirebaseConfiguration() {
    try {
        const config = parseFirebaseConfigText(document.getElementById('setting-firebase-config').value);
        const settings = DB.getSettings();
        settings.firebaseConfig = config;
        if (!DB.saveSettings(settings)) throw new Error('Konfigurasi gagal disimpan di HP.');
        showAppToast('Konfigurasi Firebase tersimpan. Aplikasi dimuat ulang…', 'success');
        setTimeout(() => window.location.reload(), 650);
    } catch (error) {
        showAppToast(error.message || 'Konfigurasi Firebase tidak valid.', 'error', 4800);
    }
}

function getFirebaseCredentials() {
    const email = document.getElementById('firebase-email').value.trim();
    const password = document.getElementById('firebase-password').value;
    if (!email || !password) throw new Error('Isi email dan kata sandi akun toko.');
    if (password.length < 6) throw new Error('Kata sandi minimal 6 karakter.');
    return { email, password };
}

async function firebaseSignIn() {
    try {
        const credentials = getFirebaseCredentials();
        if (!window.FirebaseSync) throw new Error('Modul Firebase belum siap. Pastikan internet aktif lalu buka ulang aplikasi.');
        await window.FirebaseSync.signIn(credentials.email, credentials.password);
        document.getElementById('firebase-password').value = '';
        showAppToast('Berhasil masuk. Data sedang disinkronkan.', 'success');
    } catch (error) {
        showAppToast(error.message || 'Gagal masuk ke Firebase.', 'error', 4800);
    }
}

async function firebaseSignUp() {
    try {
        const credentials = getFirebaseCredentials();
        const confirmed = await showAppConfirm(
            'Buat satu akun toko, lalu gunakan email dan kata sandi yang sama pada semua HP. Jangan bagikan kata sandinya.',
            { title: 'Buat Akun Toko', confirmText: 'Buat Akun', icon: '☁' }
        );
        if (!confirmed) return;
        if (!window.FirebaseSync) throw new Error('Modul Firebase belum siap. Pastikan internet aktif lalu buka ulang aplikasi.');
        await window.FirebaseSync.signUp(credentials.email, credentials.password);
        document.getElementById('firebase-password').value = '';
        showAppToast('Akun toko dibuat. Data lokal sedang diunggah.', 'success', 4200);
    } catch (error) {
        showAppToast(error.message || 'Akun Firebase gagal dibuat.', 'error', 4800);
    }
}

async function firebaseSignOut() {
    try {
        await window.FirebaseSync?.signOut();
        showAppToast('Akun Firebase dikeluarkan. Data lokal di HP tetap tersimpan.', 'success');
    } catch (error) {
        showAppToast(error.message || 'Gagal keluar dari Firebase.', 'error');
    }
}

async function firebaseSyncNow() {
    try {
        if (!window.FirebaseSync) throw new Error('Modul Firebase belum siap.');
        await window.FirebaseSync.syncNow();
        showAppToast('Pemeriksaan sinkronisasi selesai.', 'success');
    } catch (error) {
        showAppToast(error.message || 'Sinkronisasi belum dapat dijalankan.', 'error');
    }
}

async function removeFirebaseConfiguration() {
    const confirmed = await showAppConfirm(
        'Koneksi Firebase akan dilepas dari HP ini. Data lokal tidak dihapus.',
        { title: 'Lepas Firebase', confirmText: 'Lepas Koneksi', icon: '☁' }
    );
    if (!confirmed) return;
    try {
        await window.FirebaseSync?.signOut();
    } catch (error) {
        console.debug('Sesi Firebase tidak dapat ditutup sebelum konfigurasi dilepas.', error);
    }
    const settings = DB.getSettings();
    settings.firebaseConfig = null;
    DB.saveSettings(settings);
    window.location.reload();
}

function selectReceiptTemplate(templateName) {
    const allowedTemplates = ['classic', 'compact', 'modern', 'detailed'];
    if (!allowedTemplates.includes(templateName)) return;
    const settings = DB.getSettings();
    settings.receiptTemplate = templateName;
    if (DB.saveSettings(settings)) {
        updateReceiptTemplateUI();
        const labels = { classic: 'Klasik', compact: 'Ringkas', modern: 'Modern', detailed: 'Detail' };
        showAppToast(`Template ${labels[templateName]} dipilih.`, 'success');
    }
}

function updateReceiptTemplateUI() {
    const settings = DB.getSettings();
    const selected = settings.receiptTemplate || 'classic';
    document.querySelectorAll('[data-receipt-template]').forEach(button => {
        const isActive = button.dataset.receiptTemplate === selected;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    const preview = document.getElementById('receipt-template-preview');
    if (!preview) return;
    preview.textContent = buildReceipt({
        id: 10001,
        waktu: new Date().toLocaleString('id-ID'),
        items: [
            { name: 'Indomie Goreng', barcode: '8991234567890', qty: 2, price: 3500, subtotal: 7000, satuan: 'Pcs' },
            { name: 'Air Mineral', barcode: '8999876543210', qty: 1, price: 4000, subtotal: 4000, satuan: 'Botol' }
        ],
        total: 11000,
        tunai: 15000,
        kembali: 4000,
        paymentMethod: 'cash'
    });
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
function setProductBarcodeMessage(message, isError = false) {
    const element = document.getElementById('product-barcode-message');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('text-error', isError);
}

async function openProductBarcodeScanner() {
    if (productBarcodeStarting || productBarcodeScanner?.isScanning) return;
    if (typeof Html5Qrcode === 'undefined') {
        showAppToast('Modul scanner barcode belum siap. Tutup lalu buka kembali aplikasi.', 'error');
        return;
    }

    closeProductCamera();
    const modal = document.getElementById('product-barcode-modal');
    const reader = document.getElementById('product-barcode-reader');
    const session = ++productBarcodeSession;
    modal.style.display = 'flex';
    reader.innerHTML = '';
    setProductBarcodeMessage('Membuka kamera belakang…');
    productBarcodeStarting = true;

    try {
        const scanner = new Html5Qrcode('product-barcode-reader');
        productBarcodeScanner = scanner;
        await scanner.start(
            { facingMode: 'environment' },
            { fps: 12, qrbox: { width: 250, height: 130 }, aspectRatio: 1.6 },
            decodedText => handleProductBarcodeSuccess(decodedText),
            () => {}
        );

        if (session !== productBarcodeSession || currentPage !== 'page-barang') {
            await closeProductBarcodeScanner();
            return;
        }
        setProductBarcodeMessage('Arahkan barcode ke dalam kotak. Hasil akan terisi otomatis.');
    } catch (error) {
        console.error('Scanner barcode barang gagal dibuka.', error);
        if (session === productBarcodeSession) {
            setProductBarcodeMessage('Kamera gagal dibuka. Periksa izin kamera Warung Scan.', true);
            showAppToast('Kamera barcode gagal dibuka. Izinkan akses kamera lalu coba lagi.', 'error', 4500);
        }
        productBarcodeScanner = null;
    } finally {
        productBarcodeStarting = false;
    }
}

async function handleProductBarcodeSuccess(decodedText) {
    if (productBarcodeLocked) return;
    const barcode = String(decodedText || '').trim();
    if (!barcode) return;

    productBarcodeLocked = true;
    try {
        document.getElementById('input-barcode').value = barcode;
        vibrate(140);
        playBeep();
        await closeProductBarcodeScanner();
        showAppToast(`Barcode ${barcode} berhasil dipindai.`, 'success');
        setTimeout(() => document.getElementById('input-nama')?.focus(), 120);
    } finally {
        productBarcodeLocked = false;
    }
}

async function closeProductBarcodeScanner() {
    productBarcodeSession += 1;
    const scanner = productBarcodeScanner;
    productBarcodeScanner = null;
    productBarcodeStarting = false;

    if (scanner) {
        try {
            if (scanner.isScanning) await scanner.stop();
        } catch (error) {
            console.debug('Scanner barcode barang sudah berhenti.', error);
        }
        try {
            scanner.clear();
        } catch (error) {
            console.debug('Area scanner barcode barang sudah bersih.', error);
        }
    }

    const reader = document.getElementById('product-barcode-reader');
    if (reader) reader.innerHTML = '';
    const modal = document.getElementById('product-barcode-modal');
    if (modal) modal.style.display = 'none';
}

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
        showAppToast('Modul barcode belum termuat. Tutup lalu buka kembali aplikasi.', 'error');
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
        showAppToast(`Kamera gagal diakses: ${error.message}`, 'error');
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
            showAppToast('Barang dengan barcode tersebut belum terdaftar.', 'warning');
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
        showAppToast(`Barcode tidak terdeteksi: ${error.message}`, 'error');
    } finally {
        inputElement.value = '';
        if (resumeLiveScanner) scheduleScannerRestart(500);
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
    else if (filtered.length > 1) showAppToast('Ada beberapa barang yang cocok. Pilih dari daftar.', 'info');
    else showAppToast('Barang tidak ditemukan.', 'warning');
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

async function setAdminMode(enabled) {
    if (enabled && !isAdmin) {
        const adminPin = DB.getSettings().adminPin;
        if (adminPin) {
            const enteredPin = await showAppPrompt('Masukkan PIN untuk membuka form tambah dan edit barang.', '', {
                title: 'PIN Admin', confirmText: 'Buka Form', inputMode: 'numeric', icon: '🔒'
            });
            if (enteredPin !== adminPin) {
                if (enteredPin !== null) showAppToast('PIN Admin salah.', 'error');
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

async function toggleAdminMode() {
    await setAdminMode(!isAdmin);
}

async function editBarang(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;

    editingBarcode = product.barcode;
    const allowed = await setAdminMode(true);
    if (!allowed) {
        editingBarcode = null;
        return;
    }
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
    const wasEditing = Boolean(editingBarcode);
    const barcode = document.getElementById('input-barcode').value.trim();
    const name = document.getElementById('input-nama').value.trim();
    const price = Number(document.getElementById('input-harga').value);
    const purchasePriceInput = document.getElementById('input-harga-beli').value.trim();
    const purchasePrice = purchasePriceInput === '' ? 0 : Number(purchasePriceInput);
    const stock = Number.parseInt(document.getElementById('input-stok').value, 10);
    const unit = document.getElementById('input-satuan').value.trim();
    const category = document.getElementById('input-kategori').value.trim();

    if (!barcode || !name || !category || !unit || !Number.isFinite(price) || !Number.isFinite(purchasePrice) || !Number.isInteger(stock)) {
        showAppToast('Lengkapi Barcode, Nama, Kategori, Harga Jual, Stok, dan Satuan.', 'warning');
        return;
    }
    if (price < 0 || purchasePrice < 0 || stock < 0) {
        showAppToast('Harga dan stok tidak boleh bernilai negatif.', 'warning');
        return;
    }

    const duplicate = DB.getProducts().find(product =>
        product.barcode === barcode && product.barcode !== editingBarcode
    );
    if (duplicate) {
        showAppToast('Barcode sudah dipakai oleh barang lain.', 'warning');
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
        showAppToast('Barang belum tersimpan. Periksa barcode atau kapasitas penyimpanan.', 'error');
        return;
    }

    resetProductForm();
    renderProducts();
    updateDashboardStats();
    showAppToast(wasEditing ? 'Perubahan barang berhasil disimpan.' : 'Barang baru berhasil disimpan.', 'success');
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
                <div class="item-actions">
                    <button data-label-index="${index}" class="btn-outline btn-small">🏷 Label</button>
                    ${isAdmin ? `
                        <button data-restock-index="${index}" class="btn-warning btn-small">+ Stok</button>
                        <button data-edit-index="${index}" class="btn-primary btn-small">Edit</button>
                        <button data-delete-index="${index}" class="btn-danger btn-small">Hapus</button>
                    ` : ''}
                </div>
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
    productList.querySelectorAll('[data-label-index]').forEach(button => {
        button.addEventListener('click', () => openBarcodeLabel(filtered[Number(button.dataset.labelIndex)].barcode));
    });
}

async function restockProduct(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;

    const rawAmount = await showAppPrompt(`Tambahkan stok untuk ${product.name}.`, '1', {
        title: 'Tambah Stok', confirmText: 'Tambahkan', inputMode: 'numeric', icon: '+'
    });
    if (rawAmount === null) return;
    const amount = Number.parseInt(rawAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
        showAppToast('Jumlah restok harus berupa angka lebih dari 0.', 'warning');
        return;
    }

    const saved = DB.saveProduct({ ...product, stok: product.stok + amount }, product.barcode);
    if (!saved) return;
    renderProducts();
    updateDashboardStats();
    showAppToast(`Stok ${product.name} bertambah ${amount} ${product.satuan || 'Pcs'}.`, 'success');
}

async function hapusBarang(barcode) {
    const confirmed = await showAppConfirm('Barang akan dihapus permanen dari katalog. Lanjutkan?', {
        title: 'Hapus Barang', confirmText: 'Hapus', icon: '🗑'
    });
    if (!confirmed) return;
    if (DB.deleteProduct(barcode)) {
        cart = cart.filter(item => item.barcode !== barcode);
        renderProducts();
        renderCart();
        updateDashboardStats();
        showAppToast('Barang berhasil dihapus.', 'success');
    }
}

// ================= LABEL BARCODE =================
function closeBarcodeLabel() {
    document.getElementById('barcode-label-modal').style.display = 'none';
    activeLabelBarcode = null;
}

function drawWrappedCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach(word => {
        const candidate = line ? `${line} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth) line = candidate;
        else {
            if (line) lines.push(line);
            line = word;
        }
    });
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
        let last = visible[visible.length - 1];
        while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
        visible[visible.length - 1] = `${last}…`;
    }
    visible.forEach((entry, index) => context.fillText(entry, x, y + index * lineHeight));
    return y + visible.length * lineHeight;
}

function renderBarcodeLabelCanvas(product, canvas) {
    const showPrice = document.getElementById('label-show-price')?.checked !== false;
    const showName = document.getElementById('label-show-name')?.checked !== false;
    canvas.width = 384;
    canvas.height = 230;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111111';
    context.textAlign = 'center';
    let top = 23;

    if (showName) {
        context.font = '700 20px Arial, sans-serif';
        top = drawWrappedCanvasText(context, product.name, canvas.width / 2, top, 350, 23, 2) + 2;
    }
    if (showPrice) {
        context.font = '800 24px Arial, sans-serif';
        context.fillText(formatRupiah(product.price), canvas.width / 2, top + 20);
        top += 30;
    }

    const barcodeCanvas = document.createElement('canvas');
    if (typeof JsBarcode !== 'function') throw new Error('Pembuat barcode belum tersedia. Tutup lalu buka kembali aplikasi saat internet aktif.');
    JsBarcode(barcodeCanvas, String(product.barcode), {
        format: 'CODE128',
        width: 2,
        height: 76,
        displayValue: true,
        font: 'Arial',
        fontSize: 18,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000'
    });
    const maxBarcodeWidth = 360;
    const maxBarcodeHeight = 120;
    const scale = Math.min(maxBarcodeWidth / barcodeCanvas.width, maxBarcodeHeight / barcodeCanvas.height, 1);
    const barcodeWidth = Math.round(barcodeCanvas.width * scale);
    const barcodeHeight = Math.round(barcodeCanvas.height * scale);
    const barcodeY = Math.min(canvas.height - barcodeHeight - 15, Math.max(top + 2, 76));
    context.imageSmoothingEnabled = false;
    context.drawImage(barcodeCanvas, (canvas.width - barcodeWidth) / 2, barcodeY, barcodeWidth, barcodeHeight);
    context.strokeStyle = '#111111';
    context.lineWidth = 2;
    context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    return canvas;
}

function renderBarcodeLabelPreview() {
    const product = DB.getProducts().find(item => item.barcode === activeLabelBarcode);
    const canvas = document.getElementById('barcode-label-canvas');
    if (!product || !canvas) return;
    try {
        renderBarcodeLabelCanvas(product, canvas);
        document.getElementById('barcode-label-error').textContent = '';
    } catch (error) {
        document.getElementById('barcode-label-error').textContent = error.message;
    }
}

function openBarcodeLabel(barcode) {
    const product = DB.getProducts().find(item => item.barcode === barcode);
    if (!product) return;
    activeLabelBarcode = product.barcode;
    document.getElementById('barcode-label-product').textContent = product.name;
    document.getElementById('barcode-label-code').textContent = product.barcode;
    document.getElementById('label-copies').value = '1';
    document.getElementById('label-show-name').checked = true;
    document.getElementById('label-show-price').checked = true;
    document.getElementById('barcode-label-modal').style.display = 'flex';
    renderBarcodeLabelPreview();
}

function createRepeatedLabelImage(sourceCanvas, copies) {
    const gap = 10;
    const composite = document.createElement('canvas');
    composite.width = sourceCanvas.width;
    composite.height = (sourceCanvas.height + gap) * copies;
    const context = composite.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, composite.width, composite.height);
    for (let index = 0; index < copies; index += 1) {
        context.drawImage(sourceCanvas, 0, index * (sourceCanvas.height + gap));
    }
    return composite.toDataURL('image/png');
}

async function printBarcodeLabel() {
    const product = DB.getProducts().find(item => item.barcode === activeLabelBarcode);
    if (!product) {
        showAppToast('Barang untuk label tidak ditemukan.', 'error');
        return;
    }
    const copies = Math.min(10, Math.max(1, Number.parseInt(document.getElementById('label-copies').value, 10) || 1));
    const button = document.getElementById('barcode-label-print-button');
    button.disabled = true;
    try {
        const canvas = renderBarcodeLabelCanvas(product, document.getElementById('barcode-label-canvas'));
        const labelImage = canvas.toDataURL('image/png');
        const settings = DB.getSettings();

        if (isNativePrinterAvailable() || settings.printMode === 'bluetooth') {
            for (let index = 0; index < copies; index += 1) {
                const printed = await connectAndPrintBluetooth('', labelImage, true);
                if (!printed) throw new Error(`Label ke-${index + 1} belum berhasil dicetak.`);
            }
        } else {
            if (settings.printMode === 'rawbt') {
                showAppToast('Label bergambar dibuka melalui dialog cetak. Pilih Bluetooth Langsung untuk RPP02N.', 'info', 4200);
            }
            printViaBrowser('', createRepeatedLabelImage(canvas, copies));
        }
        showAppToast(`${copies} label ${product.name} disiapkan untuk dicetak.`, 'success');
    } catch (error) {
        console.error('Cetak label gagal.', error);
        showAppToast(error.message || 'Label barcode gagal dicetak.', 'error', 4800);
    } finally {
        button.disabled = false;
    }
}

// ================= KERANJANG =================
function addToCart(product) {
    const existing = cart.find(item => item.barcode === product.barcode);
    if (existing) {
        if (existing.qty >= product.stok) {
            showAppToast('Stok tidak mencukupi.', 'warning');
            return;
        }
        existing.qty += 1;
        existing.subtotal = existing.qty * existing.price;
    } else {
        if (product.stok <= 0) {
            showAppToast('Stok barang kosong.', 'warning');
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
        showAppToast(`Stok tersisa ${product.stok}.`, 'warning');
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
        showAppToast(`Stok gudang hanya tersisa ${product.stok}.`, 'warning');
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
function populateCustomerSuggestions() {
    const datalist = document.getElementById('customer-suggestions');
    if (!datalist) return;
    datalist.innerHTML = DB.getCustomers()
        .sort((first, second) => first.name.localeCompare(second.name, 'id'))
        .map(customer => `<option value="${escapeHtml(customer.name)}" data-phone="${escapeHtml(customer.phone)}">${escapeHtml(customer.phone)}</option>`)
        .join('');
}

function fillCheckoutCustomerPhone() {
    const name = document.getElementById('checkout-customer-name').value.trim();
    const customer = DB.getCustomers().find(item => item.name.toLocaleLowerCase('id') === name.toLocaleLowerCase('id'));
    if (customer && !document.getElementById('checkout-customer-phone').value.trim()) {
        document.getElementById('checkout-customer-phone').value = customer.phone || '';
    }
}

function updateQrisPaymentUI() {
    const settings = DB.getSettings();
    const image = document.getElementById('qris-payment-image');
    const placeholder = document.getElementById('qris-image-placeholder');
    const modeBadge = document.getElementById('qris-payment-mode-badge');
    const instruction = document.getElementById('qris-payment-instruction');
    const confirmNote = document.getElementById('qris-confirm-note');
    const confirmButton = document.getElementById('payment-confirm-button');
    const printButton = document.getElementById('qris-print-button');
    image.src = getQrisImageSource(settings);
    image.style.display = 'block';
    placeholder.style.display = 'none';
    modeBadge.textContent = 'QRIS STATIS';
    instruction.textContent = 'Pembeli memindai QR lalu memasukkan total pembayaran yang tertera.';
    confirmNote.textContent = 'Pastikan dana sudah terlihat masuk di aplikasi bank/merchant sebelum menekan tombol konfirmasi.';
    confirmNote.style.display = 'block';
    confirmButton.textContent = 'Dana Sudah Masuk & Cetak';
    printButton.disabled = false;

    const status = document.getElementById('qris-manual-status');
    if (status) status.className = 'qris-manual-status';
    const titleElement = document.getElementById('qris-status-title');
    const detailElement = document.getElementById('qris-status-detail');
    if (titleElement) titleElement.textContent = 'QRIS statis siap';
    if (detailElement) detailElement.textContent = 'Status pembayaran dikonfirmasi manual setelah dana masuk.';
}

function openPaymentModal() {
    if (!cart.length) {
        showAppToast('Keranjang masih kosong.', 'warning');
        return;
    }
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const settings = DB.getSettings();
    document.getElementById('modal-total-belanja').textContent = formatRupiah(total);
    document.getElementById('qris-payment-total').textContent = formatRupiah(total);
    document.getElementById('qris-payment-merchant').textContent = settings.qrisMerchantName || 'AL - STORE';
    document.getElementById('input-tunai').value = '';
    document.getElementById('modal-kembalian').textContent = formatRupiah(0);
    document.getElementById('checkout-customer-name').value = '';
    document.getElementById('checkout-customer-phone').value = '';
    document.getElementById('credit-due-date').value = '';
    document.getElementById('credit-note').value = '';
    populateCustomerSuggestions();
    const initialMethod = settings.lastPaymentMethod === 'qris' ? 'qris' : 'cash';
    selectPaymentMethod(initialMethod, false);
    document.getElementById('payment-modal').style.display = 'flex';
    if (currentPaymentMethod === 'cash') setTimeout(() => document.getElementById('input-tunai').focus(), 100);
}

function closePaymentModal() {
    document.getElementById('payment-modal').style.display = 'none';
    paymentProcessing = false;
    const button = document.getElementById('payment-confirm-button');
    if (button) button.disabled = false;
}

function closePreviewModal() {
    document.getElementById('preview-modal').style.display = 'none';
}

function hitungKembalian() {
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    const cash = Number(document.getElementById('input-tunai').value) || 0;
    document.getElementById('modal-kembalian').textContent = formatRupiah(Math.max(0, cash - total));
}

function selectPaymentMethod(method, persist = true) {
    currentPaymentMethod = ['qris', 'credit'].includes(method) ? method : 'cash';
    const isQris = currentPaymentMethod === 'qris';
    const isCredit = currentPaymentMethod === 'credit';
    document.getElementById('cash-payment-panel').style.display = (!isQris && !isCredit) ? 'block' : 'none';
    document.getElementById('qris-payment-panel').style.display = isQris ? 'block' : 'none';
    document.getElementById('credit-payment-panel').style.display = isCredit ? 'block' : 'none';
    document.getElementById('payment-method-cash').classList.toggle('is-active', !isQris && !isCredit);
    document.getElementById('payment-method-qris').classList.toggle('is-active', isQris);
    document.getElementById('payment-method-credit').classList.toggle('is-active', isCredit);
    document.getElementById('payment-method-cash').setAttribute('aria-pressed', String(!isQris && !isCredit));
    document.getElementById('payment-method-qris').setAttribute('aria-pressed', String(isQris));
    document.getElementById('payment-method-credit').setAttribute('aria-pressed', String(isCredit));
    document.getElementById('payment-confirm-button').textContent = isQris
        ? 'Proses QRIS'
        : (isCredit ? 'Simpan Bon & Cetak' : 'Proses Tunai');

    if (persist) {
        const settings = DB.getSettings();
        settings.lastPaymentMethod = currentPaymentMethod === 'credit' ? 'cash' : currentPaymentMethod;
        DB.saveSettings(settings);
    }
    if (isQris) updateQrisPaymentUI();
    if (!isQris && !isCredit) setTimeout(() => document.getElementById('input-tunai')?.focus(), 80);
    if (isCredit) setTimeout(() => document.getElementById('checkout-customer-name')?.focus(), 80);
}

function receiptMoney(value) {
    return Number(value || 0).toLocaleString('id-ID');
}

function wrapReceiptText(value, width = 32) {
    const text = String(value || '').trim();
    if (!text) return [];
    const lines = [];
    let current = '';

    text.split(/\s+/).forEach(word => {
        let remaining = word;
        while (remaining.length > width) {
            if (current) {
                lines.push(current);
                current = '';
            }
            lines.push(remaining.slice(0, width));
            remaining = remaining.slice(width);
        }
        if (!remaining) return;
        if (!current) current = remaining;
        else if (`${current} ${remaining}`.length <= width) current += ` ${remaining}`;
        else {
            lines.push(current);
            current = remaining;
        }
    });
    if (current) lines.push(current);
    return lines;
}

function centerReceiptText(value, width = 32) {
    return wrapReceiptText(value, width).map(line => {
        const padding = Math.max(0, Math.floor((width - line.length) / 2));
        return `${' '.repeat(padding)}${line}`;
    });
}

function receiptColumns(leftValue, rightValue, width = 32) {
    const right = String(rightValue ?? '');
    const maxLeft = Math.max(1, width - right.length - 1);
    const left = String(leftValue ?? '').slice(0, maxLeft);
    return `${left}${' '.repeat(Math.max(1, width - left.length - right.length))}${right}`;
}

function receiptStoreHeader(settings, width = 32, compact = false) {
    const lines = centerReceiptText(settings.headerText || 'WARUNGSCAN', width);
    if (!compact && settings.storeAddress) lines.push(...centerReceiptText(settings.storeAddress, width));
    if (settings.storePhone) lines.push(...centerReceiptText(settings.storePhone, width));
    return lines;
}

function receiptPaymentLines(transaction, width = 32) {
    const method = String(transaction.paymentMethod || 'cash').toLowerCase();
    const customerLines = transaction.customerName
        ? wrapReceiptText(`PELANGGAN: ${transaction.customerName}`, width)
        : [];
    if (method === 'credit') {
        const remaining = Number.isFinite(Number(transaction.debtRemainingAmount))
            ? Number(transaction.debtRemainingAmount)
            : Number(transaction.total || 0);
        const lines = [
            ...customerLines,
            receiptColumns('METODE BAYAR', 'BON', width),
            receiptColumns('TOTAL HUTANG', `Rp ${receiptMoney(transaction.total)}`, width),
            receiptColumns('SISA HUTANG', `Rp ${receiptMoney(remaining)}`, width)
        ];
        if (transaction.creditDueDate) lines.push(receiptColumns('JATUH TEMPO', transaction.creditDueDate, width));
        if (transaction.creditNote) lines.push(...wrapReceiptText(`CATATAN: ${transaction.creditNote}`, width));
        return lines;
    }
    const isQris = method === 'qris';
    if (isQris) {
        return [
            ...customerLines,
            receiptColumns('METODE BAYAR', 'QRIS', width),
            receiptColumns('DIBAYAR', `Rp ${receiptMoney(transaction.total)}`, width)
        ];
    }
    return [
        ...customerLines,
        receiptColumns('METODE BAYAR', 'TUNAI', width),
        receiptColumns('TUNAI', `Rp ${receiptMoney(transaction.tunai)}`, width),
        receiptColumns('KEMBALI', `Rp ${receiptMoney(transaction.kembali)}`, width)
    ];
}

function buildReceipt(transaction, isCopy = false) {
    const settings = DB.getSettings();
    const template = settings.receiptTemplate || 'classic';
    const width = 32;
    const thinLine = '-'.repeat(width);
    const thickLine = '='.repeat(width);
    const copyLabel = isCopy ? 'COPY' : '';
    const items = Array.isArray(transaction.items) ? transaction.items : [];
    const lines = [];

    if (template === 'compact') {
        lines.push(...receiptStoreHeader(settings, width, true));
        lines.push(receiptColumns(String(transaction.waktu || ''), copyLabel, width));
        lines.push(thinLine);
        items.forEach(item => {
            const subtotal = receiptMoney(item.subtotal);
            const nameLines = wrapReceiptText(item.name, width);
            lines.push(...nameLines);
            lines.push(receiptColumns(`${item.qty}x${receiptMoney(item.price)}`, subtotal, width));
        });
        lines.push(thinLine);
        lines.push(receiptColumns('TOTAL', `Rp ${receiptMoney(transaction.total)}`, width));
        lines.push(...receiptPaymentLines(transaction, width));
        lines.push(...centerReceiptText(settings.footerText || 'Terima Kasih', width));
    } else if (template === 'modern') {
        lines.push(...receiptStoreHeader(settings, width));
        lines.push(thickLine);
        lines.push(receiptColumns(`TRX #${transaction.id || '-'}`, copyLabel, width));
        lines.push(...wrapReceiptText(transaction.waktu || '', width));
        lines.push(thinLine);
        items.forEach(item => {
            lines.push(...wrapReceiptText(item.name, width));
            const quantity = `${item.qty} ${item.satuan || ''} x ${receiptMoney(item.price)}`.replace(/\s+/g, ' ').trim();
            lines.push(receiptColumns(quantity, receiptMoney(item.subtotal), width));
        });
        lines.push(thickLine);
        lines.push(receiptColumns('TOTAL BELANJA', `Rp ${receiptMoney(transaction.total)}`, width));
        lines.push(...receiptPaymentLines(transaction, width));
        lines.push(thickLine);
        lines.push(...centerReceiptText(settings.footerText || 'Terima Kasih', width));
    } else if (template === 'detailed') {
        lines.push(...receiptStoreHeader(settings, width));
        lines.push(thickLine);
        lines.push(receiptColumns(`No: ${transaction.id || '-'}`, copyLabel, width));
        lines.push(...wrapReceiptText(transaction.waktu || '', width));
        lines.push(thinLine);
        items.forEach(item => {
            lines.push(...wrapReceiptText(item.name, width));
            if (item.barcode) lines.push(...wrapReceiptText(`BC: ${item.barcode}`, width));
            const quantity = `${item.qty} ${item.satuan || ''} x Rp ${receiptMoney(item.price)}`.replace(/\s+/g, ' ').trim();
            lines.push(receiptColumns(quantity, receiptMoney(item.subtotal), width));
        });
        lines.push(thinLine);
        lines.push(receiptColumns('TOTAL', `Rp ${receiptMoney(transaction.total)}`, width));
        lines.push(...receiptPaymentLines(transaction, width));
        lines.push(thickLine);
        lines.push(...centerReceiptText(settings.footerText || 'Terima Kasih', width));
    } else {
        lines.push(...receiptStoreHeader(settings, width));
        lines.push(thinLine);
        lines.push(receiptColumns(`No. ${transaction.id || '-'}`, copyLabel, width));
        lines.push(...wrapReceiptText(transaction.waktu || '', width));
        lines.push(thinLine);
        items.forEach(item => {
            lines.push(...wrapReceiptText(item.name, width));
            const quantityAndPrice = `${item.qty} x ${receiptMoney(item.price)}`;
            lines.push(receiptColumns(quantityAndPrice, receiptMoney(item.subtotal), width));
        });
        lines.push(thinLine);
        lines.push(receiptColumns('TOTAL', `Rp ${receiptMoney(transaction.total)}`, width));
        lines.push(...receiptPaymentLines(transaction, width));
        lines.push(thinLine);
        lines.push(...centerReceiptText(settings.footerText || 'Terima Kasih', width));
    }

    return `${lines.join('\n')}\n`;
}

function compactPaymentItems(items) {
    return items.map(item => ({
        barcode: String(item.barcode || ''),
        name: String(item.name || 'Barang'),
        category: String(item.category || 'Lainnya'),
        hargaBeli: Number(item.hargaBeli) || 0,
        price: Number(item.price) || 0,
        stok: Math.max(0, Number(item.stok) || 0),
        satuan: String(item.satuan || 'Pcs'),
        qty: Math.max(1, Number(item.qty) || 1),
        subtotal: Number(item.subtotal) || (Number(item.price) || 0) * (Number(item.qty) || 1),
        photo: ''
    }));
}

function createTransaction(paymentMethod, paymentData = {}) {
    const sourceItems = Array.isArray(paymentData.items) ? compactPaymentItems(paymentData.items) : compactPaymentItems(cart);
    const calculatedTotal = sourceItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    const total = Number(paymentData.total) || calculatedTotal;
    const isQris = paymentMethod === 'qris';
    const isCredit = paymentMethod === 'credit';
    const customerName = String(paymentData.customerName ?? document.getElementById('checkout-customer-name')?.value ?? '').trim();
    const customerPhone = String(paymentData.customerPhone ?? document.getElementById('checkout-customer-phone')?.value ?? '').trim();
    if (isCredit && !customerName) {
        showAppToast('Nama pelanggan wajib diisi untuk transaksi bon.', 'warning');
        document.getElementById('checkout-customer-name')?.focus();
        return null;
    }
    const cash = (isQris || isCredit) ? (isQris ? total : 0) : Number(document.getElementById('input-tunai').value) || 0;
    if (!isQris && !isCredit && cash < total) {
        showAppToast('Uang tunai pembeli masih kurang.', 'warning');
        return null;
    }

    const now = Date.now();
    const settings = DB.getSettings();
    return {
        id: now,
        syncId: DB.newId('trx'),
        createdAt: now,
        updatedAt: now,
        paidAt: isCredit ? 0 : now,
        waktu: new Date(now).toLocaleString('id-ID'),
        items: sourceItems.map(item => ({ ...item })),
        total,
        tunai: cash,
        kembali: (isQris || isCredit) ? 0 : cash - total,
        paymentMethod: isCredit ? 'credit' : (isQris ? 'qris' : 'cash'),
        paymentStatus: String(paymentData.paymentStatus || (isCredit ? 'unpaid' : 'paid')),
        paymentMerchant: isQris ? (settings.qrisMerchantName || 'AL - STORE') : '',
        customerName,
        customerPhone,
        creditDueDate: isCredit ? String(document.getElementById('credit-due-date')?.value || '') : '',
        creditNote: isCredit ? String(document.getElementById('credit-note')?.value || '').trim() : ''
    };
}

function applyTransactionStock(transaction, allowStockShortage = false) {
    const products = DB.getProducts();
    for (const soldItem of transaction.items) {
        const product = products.find(item => item.barcode === soldItem.barcode);
        if (!product) {
            if (allowStockShortage) continue;
            showAppToast(`Barang ${soldItem.name} tidak ditemukan. Perbarui keranjang.`, 'warning');
            return null;
        }
        if (product.stok < soldItem.qty && !allowStockShortage) {
            showAppToast(`Stok ${soldItem.name} berubah atau tidak mencukupi. Perbarui keranjang.`, 'warning');
            return null;
        }
        product.stok = Math.max(0, product.stok - soldItem.qty);
    }
    return products;
}

async function finalizePaidTransaction(transaction, forcePrint = false, allowStockShortage = false) {
    const products = applyTransactionStock(transaction, allowStockShortage);
    const customer = transaction.customerName ? {
        name: transaction.customerName,
        phone: transaction.customerPhone
    } : null;
    const debt = transaction.paymentMethod === 'credit' ? {
        dueDate: transaction.creditDueDate,
        note: transaction.creditNote
    } : null;
    if (!products || !DB.commitSale(products, transaction, customer, debt)) return false;

    const receiptText = buildReceipt(transaction);
    document.getElementById('print-text-preview').value = receiptText;
    cart = [];
    renderCart();
    closePaymentModal();
    updateDashboardStats();
    if (currentPage === 'page-piutang') renderDebts();

    const settings = DB.getSettings();
    if (forcePrint || settings.autoPrint) {
        const printed = await printReceipt(receiptText);
        if (!printed) document.getElementById('preview-modal').style.display = 'flex';
        else showAppToast(
            transaction.paymentMethod === 'credit'
                ? 'Bon tersimpan dan catatan berhasil dikirim ke printer.'
                : 'Pembayaran tersimpan dan struk berhasil dikirim ke printer.',
            'success', 4200
        );
    } else {
        document.getElementById('preview-modal').style.display = 'flex';
    }
    return true;
}

async function processSelectedPayment() {
    if (paymentProcessing) return;
    paymentProcessing = true;
    const button = document.getElementById('payment-confirm-button');
    button.disabled = true;

    try {
        if (currentPaymentMethod === 'qris') {
            const confirmed = await showAppConfirm(
                'Pastikan dana QRIS sudah benar-benar masuk. Setelah dikonfirmasi, stok akan berkurang dan struk langsung dicetak.',
                { title: 'Konfirmasi Dana QRIS', confirmText: 'Dana Sudah Masuk', icon: '✓' }
            );
            if (!confirmed) return;
        } else if (currentPaymentMethod === 'credit') {
            const customerName = document.getElementById('checkout-customer-name').value.trim();
            if (!customerName) {
                showAppToast('Nama pelanggan wajib diisi untuk bon.', 'warning');
                document.getElementById('checkout-customer-name').focus();
                return;
            }
            const confirmed = await showAppConfirm(
                `Simpan seluruh belanja sebagai hutang atas nama ${customerName}? Stok akan langsung berkurang.`,
                { title: 'Konfirmasi Bon', confirmText: 'Simpan Bon', icon: '🧾' }
            );
            if (!confirmed) return;
        }

        const transaction = createTransaction(currentPaymentMethod);
        if (!transaction) return;
        await finalizePaidTransaction(transaction, currentPaymentMethod === 'qris');
    } catch (error) {
        console.error('Pembayaran gagal diproses.', error);
        showAppToast(error.message || 'Pembayaran gagal diproses.', 'error', 4800);
    } finally {
        paymentProcessing = false;
        button.disabled = false;
    }
}

async function prosesKePreview() {
    selectPaymentMethod('cash', false);
    await processSelectedPayment();
}

function cetakViaRawBT(textData) {
    try {
        const encodedText = encodeURIComponent(textData);
        window.location.href = `intent:${encodedText}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        return true;
    } catch (error) {
        console.error('RawBT gagal dibuka.', error);
        showAppToast('RawBT tidak dapat dibuka. Pastikan aplikasinya sudah terpasang.', 'error');
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

function buildQrisPrintText(total = 0) {
    const settings = DB.getSettings();
    const width = 32;
    const lines = [
        ...centerReceiptText('QRIS', width),
        ...centerReceiptText(settings.qrisMerchantName || 'AL - STORE', width)
    ];
    if (Number(total) > 0) {
        lines.push('-'.repeat(width));
        lines.push(...centerReceiptText(`TOTAL ${formatRupiah(total)}`, width));
    }
    lines.push('-'.repeat(width));
    lines.push(...centerReceiptText('Scan dengan aplikasi berlogo QRIS', width));
    lines.push(...centerReceiptText('Pastikan nama merchant sesuai', width));
    return `${lines.join('\n')}\n\n`;
}

async function printQrisImage(total = 0) {
    const settings = DB.getSettings();
    const qrisImage = getQrisImageSource(settings);
    const qrisText = buildQrisPrintText(total);
    let printed = false;

    if (isNativePrinterAvailable() || settings.printMode === 'bluetooth') {
        printed = await connectAndPrintBluetooth(qrisText, qrisImage, true);
    } else if (settings.printMode === 'browser') {
        printed = printViaBrowser(qrisText, qrisImage);
    } else {
        showAppToast('Gambar QRIS tidak dapat dicetak lewat RawBT. Pilih Bluetooth Langsung RPP02N atau Dialog Browser.', 'warning', 4800);
        return false;
    }

    if (printed) showAppToast('QRIS berhasil dikirim ke printer.', 'success');
    return printed;
}

async function printStoredQris() {
    saveSettings();
    await printQrisImage(0);
}

async function printCurrentQris() {
    const total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    if (!total) {
        showAppToast('Keranjang kosong. Tidak ada total QRIS untuk dicetak.', 'warning');
        return;
    }
    await printQrisImage(total);
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

// ================= PELANGGAN & PIUTANG =================
function formatShortDate(value) {
    if (!value) return '-';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
        ? new Date(`${value}T00:00:00`)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function debtStatusLabel(status) {
    if (status === 'paid') return 'Lunas';
    if (status === 'partial') return 'Dicicil';
    return 'Belum Lunas';
}

function renderDebts() {
    const list = document.getElementById('debt-list');
    if (!list) return;
    const debts = DB.getDebts();
    const search = document.getElementById('debt-search').value.trim().toLocaleLowerCase('id');
    const filter = document.getElementById('debt-status-filter').value;
    const todayKey = getLocalDateKey();
    const outstanding = debts.filter(debt => debt.remainingAmount > 0);
    const outstandingTotal = outstanding.reduce((sum, debt) => sum + debt.remainingAmount, 0);
    const customerCount = new Set(outstanding.map(debt => debt.customerId || debt.customerName)).size;
    const collectedToday = debts.reduce((sum, debt) => sum + debt.payments
        .filter(payment => getLocalDateKey(payment.createdAt) === todayKey)
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0), 0);

    document.getElementById('debt-total-outstanding').textContent = formatRupiah(outstandingTotal);
    document.getElementById('debt-customer-count').textContent = customerCount;
    document.getElementById('debt-collected-today').textContent = formatRupiah(collectedToday);

    const filtered = debts.filter(debt => {
        const matchesSearch = !search || [debt.customerName, debt.customerPhone, debt.note, debt.transactionId]
            .some(value => String(value || '').toLocaleLowerCase('id').includes(search));
        const matchesStatus = !filter || (filter === 'open' ? debt.remainingAmount > 0 : debt.status === filter);
        return matchesSearch && matchesStatus;
    });
    document.getElementById('debt-count-badge').textContent = filtered.length;

    if (!filtered.length) {
        list.innerHTML = '<li class="empty-state">Belum ada catatan piutang yang cocok.</li>';
        return;
    }

    list.innerHTML = filtered.map((debt, index) => {
        const isOverdue = debt.remainingAmount > 0 && debt.dueDate && debt.dueDate < todayKey;
        const payments = debt.payments.length
            ? debt.payments.map(payment => `
                <div class="debt-payment-row">
                    <span>${escapeHtml(payment.waktu)} · ${payment.method === 'qris' ? 'QRIS' : 'Tunai'}</span>
                    <strong>${formatRupiah(payment.amount)}</strong>
                    ${payment.note ? `<small>${escapeHtml(payment.note)}</small>` : ''}
                </div>
            `).join('')
            : '<p class="helper-text">Belum ada pembayaran cicilan.</p>';
        return `
            <li class="debt-card-item">
                <div class="debt-card-head">
                    <div>
                        <span class="category-badge debt-status-${escapeHtml(debt.status)}">${debtStatusLabel(debt.status)}</span>
                        ${isOverdue ? '<span class="category-badge debt-overdue-badge">Terlambat</span>' : ''}
                        <h4>${escapeHtml(debt.customerName || 'Tanpa nama')}</h4>
                        <p>${escapeHtml(debt.customerPhone || 'Nomor HP tidak dicatat')} · Ref ${escapeHtml(debt.transactionId || '-')}</p>
                    </div>
                    <strong class="debt-remaining">${formatRupiah(debt.remainingAmount)}</strong>
                </div>
                <div class="debt-amount-grid">
                    <div><span>Hutang awal</span><strong>${formatRupiah(debt.amount)}</strong></div>
                    <div><span>Sudah dibayar</span><strong>${formatRupiah(debt.paidAmount)}</strong></div>
                    <div><span>Dibuat</span><strong>${formatShortDate(debt.createdAt)}</strong></div>
                    <div><span>Jatuh tempo</span><strong>${formatShortDate(debt.dueDate)}</strong></div>
                </div>
                ${debt.note ? `<p class="debt-note">Catatan: ${escapeHtml(debt.note)}</p>` : ''}
                <details class="debt-details">
                    <summary>Riwayat pembayaran (${debt.payments.length})</summary>
                    <div class="debt-payment-history">${payments}</div>
                </details>
                <div class="debt-actions">
                    ${debt.remainingAmount > 0 ? `<button data-debt-pay-index="${index}" class="btn-primary">+ Catat Pembayaran</button>` : ''}
                    <button data-debt-print-index="${index}" class="btn-outline">🖨️ Cetak Catatan</button>
                </div>
            </li>
        `;
    }).join('');

    list.querySelectorAll('[data-debt-pay-index]').forEach(button => {
        button.addEventListener('click', () => openDebtPaymentModal(filtered[Number(button.dataset.debtPayIndex)].id));
    });
    list.querySelectorAll('[data-debt-print-index]').forEach(button => {
        button.addEventListener('click', () => printDebtStatement(filtered[Number(button.dataset.debtPrintIndex)].id));
    });
}

function clearDebtFilters() {
    document.getElementById('debt-search').value = '';
    document.getElementById('debt-status-filter').value = 'open';
    renderDebts();
}

function openDebtPaymentModal(debtId) {
    const debt = DB.getDebts().find(item => item.id === String(debtId));
    if (!debt || debt.remainingAmount <= 0) return;
    activeDebtId = debt.id;
    document.getElementById('debt-payment-customer').textContent = debt.customerName;
    document.getElementById('debt-payment-remaining').textContent = formatRupiah(debt.remainingAmount);
    document.getElementById('debt-payment-amount').value = debt.remainingAmount;
    document.getElementById('debt-payment-method').value = 'cash';
    document.getElementById('debt-payment-note').value = '';
    document.getElementById('debt-payment-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('debt-payment-amount').focus(), 80);
}

function closeDebtPaymentModal() {
    document.getElementById('debt-payment-modal').style.display = 'none';
    activeDebtId = null;
}

function buildDebtStatement(debt, paymentOnly = false) {
    const settings = DB.getSettings();
    const width = 32;
    const line = '-'.repeat(width);
    const latestPayment = debt.payments[debt.payments.length - 1];
    const lines = [
        ...receiptStoreHeader(settings, width),
        '='.repeat(width),
        ...centerReceiptText(paymentOnly ? 'BUKTI BAYAR PIUTANG' : 'CATATAN PIUTANG', width),
        line,
        ...wrapReceiptText(`PELANGGAN: ${debt.customerName || '-'}`, width)
    ];
    if (debt.customerPhone) lines.push(...wrapReceiptText(`HP: ${debt.customerPhone}`, width));
    lines.push(receiptColumns('NO. TRANSAKSI', debt.transactionId || '-', width));
    lines.push(receiptColumns('TANGGAL BON', formatShortDate(debt.createdAt), width));
    if (debt.dueDate) lines.push(receiptColumns('JATUH TEMPO', formatShortDate(debt.dueDate), width));
    lines.push(line);
    lines.push(receiptColumns('HUTANG AWAL', `Rp ${receiptMoney(debt.amount)}`, width));
    if (paymentOnly && latestPayment) {
        lines.push(receiptColumns('BAYAR SEKARANG', `Rp ${receiptMoney(latestPayment.amount)}`, width));
        lines.push(receiptColumns('CARA BAYAR', latestPayment.method === 'qris' ? 'QRIS' : 'TUNAI', width));
    }
    lines.push(receiptColumns('TOTAL TERBAYAR', `Rp ${receiptMoney(debt.paidAmount)}`, width));
    lines.push(receiptColumns('SISA HUTANG', `Rp ${receiptMoney(debt.remainingAmount)}`, width));
    lines.push(receiptColumns('STATUS', debtStatusLabel(debt.status).toUpperCase(), width));
    if (debt.note) lines.push(...wrapReceiptText(`CATATAN: ${debt.note}`, width));
    if (!paymentOnly && debt.payments.length) {
        lines.push(line);
        lines.push(...centerReceiptText('RIWAYAT BAYAR', width));
        debt.payments.forEach(payment => {
            lines.push(receiptColumns(formatShortDate(payment.createdAt), `Rp ${receiptMoney(payment.amount)}`, width));
        });
    }
    lines.push(line);
    lines.push(...centerReceiptText(settings.footerText || 'Terima Kasih', width));
    return `${lines.join('\n')}\n\n`;
}

async function submitDebtPayment() {
    const debt = DB.getDebts().find(item => item.id === activeDebtId);
    if (!debt) return;
    const amount = Number(document.getElementById('debt-payment-amount').value) || 0;
    const method = document.getElementById('debt-payment-method').value;
    const note = document.getElementById('debt-payment-note').value.trim();
    if (amount <= 0 || amount > debt.remainingAmount) {
        showAppToast(`Nominal pembayaran harus antara Rp 1 dan ${formatRupiah(debt.remainingAmount)}.`, 'warning');
        return;
    }
    const confirmed = await showAppConfirm(
        `Catat pembayaran ${formatRupiah(amount)} dari ${debt.customerName}?`,
        { title: 'Pembayaran Piutang', confirmText: 'Simpan Pembayaran', icon: '✓' }
    );
    if (!confirmed) return;

    const updated = DB.recordDebtPayment(debt.id, amount, method, note);
    if (!updated) {
        showAppToast('Pembayaran belum berhasil disimpan.', 'error');
        return;
    }
    closeDebtPaymentModal();
    renderDebts();
    updateDashboardStats();
    const receipt = buildDebtStatement(updated, true);
    document.getElementById('print-text-preview').value = receipt;
    if (DB.getSettings().autoPrint) {
        const printed = await printReceipt(receipt);
        if (!printed) document.getElementById('preview-modal').style.display = 'flex';
    } else {
        document.getElementById('preview-modal').style.display = 'flex';
    }
    showAppToast(updated.status === 'paid' ? 'Piutang lunas dan pembayaran tercatat.' : 'Cicilan berhasil dicatat.', 'success');
}

function printDebtStatement(debtId) {
    const debt = DB.getDebts().find(item => item.id === String(debtId));
    if (!debt) return;
    document.getElementById('print-text-preview').value = buildDebtStatement(debt, false);
    document.getElementById('preview-modal').style.display = 'flex';
}

function exportDebtsCsv() {
    const debts = DB.getDebts();
    if (!debts.length) {
        showAppToast('Belum ada data piutang untuk diekspor.', 'warning');
        return;
    }
    const rows = [
        ['ID Piutang', 'No Transaksi', 'Pelanggan', 'Telepon', 'Tanggal', 'Jatuh Tempo', 'Hutang Awal', 'Terbayar', 'Sisa', 'Status', 'Catatan', 'Riwayat Pembayaran'],
        ...debts.map(debt => [
            debt.id,
            debt.transactionId,
            debt.customerName,
            debt.customerPhone,
            new Date(debt.createdAt).toLocaleString('id-ID'),
            debt.dueDate,
            debt.amount,
            debt.paidAmount,
            debt.remainingAmount,
            debtStatusLabel(debt.status),
            debt.note,
            debt.payments.map(payment => `${payment.waktu}: ${payment.amount} (${payment.method})`).join('; ')
        ])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `piutang-warungscan-${getLocalDateKey()}.csv`);
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
        const paymentLabel = transaction.paymentMethod === 'qris'
            ? 'QRIS'
            : (transaction.paymentMethod === 'credit' ? 'BON' : 'TUNAI');
        const creditStatus = transaction.paymentMethod === 'credit'
            ? `<span class="category-badge debt-status-${escapeHtml(transaction.paymentStatus)}">${transaction.paymentStatus === 'paid' ? 'LUNAS' : (transaction.paymentStatus === 'partial' ? 'DICICIL' : 'BELUM LUNAS')}</span>`
            : '';
        return `
            <li>
                <div class="item-info">
                    <h4>No. Ref: ${escapeHtml(transaction.id)}</h4>
                    <p class="text-success">${escapeHtml(transaction.waktu)}</p>
                    <span class="category-badge">${paymentLabel}</span>
                    ${creditStatus}
                    ${transaction.customerName ? `<p>👤 ${escapeHtml(transaction.customerName)}${transaction.customerPhone ? ` · ${escapeHtml(transaction.customerPhone)}` : ''}</p>` : ''}
                    <p>${itemNames}</p>
                    <button data-reprint-index="${index}" class="btn-outline btn-small history-print">🖨️ Cetak Ulang</button>
                </div>
                <strong class="history-total">${formatRupiah(transaction.total)}</strong>
            </li>
        `;
    }).join('');

    historyList.querySelectorAll('[data-reprint-index]').forEach(button => {
        button.addEventListener('click', () => cetakUlangStruk(
            filtered[Number(button.dataset.reprintIndex)].syncId || filtered[Number(button.dataset.reprintIndex)].id
        ));
    });
}

function clearHistoryFilter() {
    document.getElementById('history-date-filter').value = '';
    renderHistory();
}

function cetakUlangStruk(transactionId) {
    const transaction = DB.getHistory().find(item =>
        item.syncId === String(transactionId) || item.id === Number(transactionId)
    );
    if (!transaction) {
        showAppToast('Transaksi tidak ditemukan.', 'error');
        return;
    }
    document.getElementById('print-text-preview').value = buildReceipt(transaction, true);
    document.getElementById('preview-modal').style.display = 'flex';
}

async function hapusSemuaRiwayat() {
    const confirmed = await showAppConfirm('Semua riwayat transaksi akan dihapus. Data barang dan catatan piutang tetap disimpan.', {
        title: 'Kosongkan Riwayat', confirmText: 'Hapus Semua', icon: '🗑'
    });
    if (!confirmed) return;
    if (DB.clearHistory()) {
        renderHistory();
        updateDashboardStats();
        showAppToast('Riwayat transaksi berhasil dikosongkan.', 'success');
    }
}

function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportHistoryCsv() {
    const histories = DB.getHistory();
    if (!histories.length) {
        showAppToast('Belum ada riwayat untuk diekspor.', 'warning');
        return;
    }

    const rows = [
        ['ID', 'Tanggal', 'Pelanggan', 'Telepon', 'Metode Pembayaran', 'Status', 'Barang', 'Total', 'Tunai', 'Kembali', 'Estimasi Laba'],
        ...histories.map(transaction => [
            transaction.id,
            transaction.waktu,
            transaction.customerName || '',
            transaction.customerPhone || '',
            transaction.paymentMethod === 'qris' ? 'QRIS' : (transaction.paymentMethod === 'credit' ? 'Bon' : 'Tunai'),
            transaction.paymentStatus || 'paid',
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

function buildProductsCsv(products) {
    const rows = [
        ['barcode', 'nama_barang', 'kategori', 'harga_beli', 'harga_jual', 'stok', 'satuan'],
        ...products.map(product => [
            product.barcode,
            product.name,
            product.category,
            product.hargaBeli || 0,
            product.price || 0,
            product.stok || 0,
            product.satuan || 'Pcs'
        ])
    ];
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\n');
}

function exportProductsCsv() {
    const products = DB.getProducts();
    if (!products.length) {
        showAppToast('Belum ada produk untuk diekspor.', 'warning');
        return;
    }
    downloadBlob(
        new Blob([buildProductsCsv(products)], { type: 'text/csv;charset=utf-8' }),
        `produk-warungscan-${getLocalDateKey()}.csv`
    );
    showAppToast(`${products.length} produk disiapkan dalam format CSV.`, 'success');
}

function downloadProductCsvTemplate() {
    const sampleProducts = [{
        barcode: '8991234567890',
        name: 'Contoh Produk',
        category: 'Lainnya',
        hargaBeli: 0,
        price: 10000,
        stok: 10,
        satuan: 'Pcs'
    }];
    downloadBlob(
        new Blob([buildProductsCsv(sampleProducts)], { type: 'text/csv;charset=utf-8' }),
        'contoh-format-produk-warungscan.csv'
    );
}

function detectCsvDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
    let commas = 0;
    let semicolons = 0;
    let quoted = false;
    for (let index = 0; index < firstLine.length; index += 1) {
        if (firstLine[index] === '"') quoted = !quoted;
        else if (!quoted && firstLine[index] === ',') commas += 1;
        else if (!quoted && firstLine[index] === ';') semicolons += 1;
    }
    return semicolons > commas ? ';' : ',';
}

function parseCsvRows(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const delimiter = detectCsvDelimiter(source);
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (character === '"') {
            if (quoted && source[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (character === delimiter && !quoted) {
            row.push(cell.trim());
            cell = '';
        } else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && source[index + 1] === '\n') index += 1;
            row.push(cell.trim());
            if (row.some(value => value !== '')) rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += character;
        }
    }
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
    return rows;
}

function normalizeCsvHeader(value) {
    return String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function findCsvColumn(headers, aliases) {
    return headers.findIndex(header => aliases.includes(header));
}

function parseCsvInteger(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const numeric = Number(text.replace(/[^0-9-]/g, ''));
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : null;
}

async function importProductsCsv(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;

    try {
        const rows = parseCsvRows(await file.text());
        if (rows.length < 2) throw new Error('File CSV tidak memiliki data produk.');

        const headers = rows[0].map(normalizeCsvHeader);
        const columns = {
            barcode: findCsvColumn(headers, ['barcode', 'kode', 'kode_barang', 'sku', 'ean', 'upc']),
            name: findCsvColumn(headers, ['nama', 'nama_barang', 'produk', 'nama_produk', 'product', 'product_name', 'item', 'item_name']),
            category: findCsvColumn(headers, ['kategori', 'category', 'jenis']),
            purchasePrice: findCsvColumn(headers, ['harga_beli', 'modal', 'cost', 'cost_price', 'purchase_price']),
            price: findCsvColumn(headers, ['harga_jual', 'harga', 'price', 'selling_price', 'sale_price']),
            stock: findCsvColumn(headers, ['stok', 'stock', 'qty', 'quantity', 'jumlah']),
            unit: findCsvColumn(headers, ['satuan', 'unit', 'uom'])
        };
        if (columns.barcode < 0 || columns.name < 0) {
            throw new Error('Kolom barcode dan nama barang wajib tersedia. Gunakan contoh format CSV.');
        }

        const incoming = rows.slice(1).map(row => ({
            barcode: String(row[columns.barcode] || '').trim(),
            name: String(row[columns.name] || '').trim(),
            category: columns.category >= 0 ? String(row[columns.category] || '').trim() : '',
            hargaBeli: columns.purchasePrice >= 0 ? parseCsvInteger(row[columns.purchasePrice]) : null,
            price: columns.price >= 0 ? parseCsvInteger(row[columns.price]) : null,
            stok: columns.stock >= 0 ? parseCsvInteger(row[columns.stock]) : null,
            satuan: columns.unit >= 0 ? String(row[columns.unit] || '').trim() : ''
        })).filter(product => product.barcode && product.name);
        if (!incoming.length) throw new Error('Tidak ada baris produk valid yang dapat diimpor.');

        const existingProducts = DB.getProducts();
        const productMap = new Map(existingProducts.map(product => [product.barcode, product]));
        let newCount = 0;
        let updatedCount = 0;
        incoming.forEach(product => {
            const previous = productMap.get(product.barcode);
            if (previous) updatedCount += 1;
            else newCount += 1;
            productMap.set(product.barcode, {
                barcode: product.barcode,
                name: product.name,
                category: product.category || previous?.category || 'Lainnya',
                hargaBeli: product.hargaBeli ?? previous?.hargaBeli ?? 0,
                price: product.price ?? previous?.price ?? 0,
                stok: product.stok ?? previous?.stok ?? 0,
                satuan: product.satuan || previous?.satuan || 'Pcs',
                photo: previous?.photo || ''
            });
        });

        const confirmed = await showAppConfirm(
            `${incoming.length} produk valid ditemukan: ${newCount} baru dan ${updatedCount} pembaruan. Produk dengan barcode yang sama akan diperbarui.`,
            { title: 'Impor Produk CSV', confirmText: 'Impor Produk', icon: '↥' }
        );
        if (!confirmed) return;
        if (!DB.updateProducts([...productMap.values()])) throw new Error('Produk gagal disimpan.');

        renderProducts();
        updateDashboardStats();
        showAppToast(`${newCount} produk baru dan ${updatedCount} produk diperbarui.`, 'success', 4200);
    } catch (error) {
        console.error('Impor CSV produk gagal.', error);
        showAppToast(`Impor CSV gagal: ${error.message}`, 'error', 4800);
    } finally {
        inputElement.value = '';
    }
}

// ================= BACKUP =================
function exportBackup() {
    const backup = DB.exportData();
    downloadBlob(
        new Blob([backup], { type: 'application/json;charset=utf-8' }),
        `backup-warungscan-${getLocalDateKey()}.json`
    );
    showAppToast('Backup lengkap siap disimpan.', 'success');
}

async function importBackup(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) return;
    try {
        const confirmed = await showAppConfirm(
            'Impor backup akan mengganti data barang, riwayat, logo, template, dan pengaturan yang ada. Lanjutkan?',
            { title: 'Impor Backup Lengkap', confirmText: 'Impor Sekarang', icon: '↥' }
        );
        if (!confirmed) return;
        DB.importData(await file.text());
        cart = [];
        renderCart();
        renderProducts();
        renderHistory();
        renderDebts();
        updateDashboardStats();
        loadSettingsUI();
        showAppToast('Backup lengkap berhasil dipulihkan.', 'success');
    } catch (error) {
        console.error('Backup gagal diimpor.', error);
        showAppToast(`Backup gagal diimpor: ${error.message}`, 'error', 4500);
    } finally {
        inputElement.value = '';
    }
}

// ================= INIT & CLEANUP =================
function cleanupLegacyPaymentIntegration() {
    try {
        localStorage.removeItem('warungscan_midtrans_app_token');
        localStorage.removeItem('kasir_pending_midtrans');
    } catch (error) {
        console.debug('Data integrasi pembayaran lama tidak dapat dibersihkan.', error);
    }
}

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
        closeProductBarcodeScanner();
    }
});

window.addEventListener('warungscan:remote-updated', event => {
    const dataset = event.detail?.dataset;
    if (dataset === 'products') {
        renderProducts();
        renderCart();
    }
    if (dataset === 'history') renderHistory();
    if (dataset === 'customers') populateCustomerSuggestions();
    if (dataset === 'debts') renderDebts();
    if (dataset === 'settings') loadSettingsUI();
    updateDashboardStats();
});
window.addEventListener('pagehide', () => {
    stopScanner();
    closeProductCamera();
    closeProductBarcodeScanner();
});

if (!window.history.state?.[APP_PAGE_STATE_KEY]) {
    window.history.replaceState({ [APP_PAGE_STATE_KEY]: 'page-home' }, '', window.location.href);
}

const systemThemeQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
systemThemeQuery?.addEventListener?.('change', () => {
    if (DB.getSettings().displayMode === 'auto') applyAppTheme();
});

cleanupLegacyPaymentIntegration();
initializeNativeDefaults();
applyAppTheme();
renderProducts();
renderCart();
updateDashboardStats();
loadSettingsUI();
