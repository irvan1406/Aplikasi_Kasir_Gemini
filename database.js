// database.js - Pusat manajemen data dengan validasi dan rollback transaksi.
const DB = (() => {
    const KEYS = {
        products: 'kasir_products',
        history: 'kasir_history',
        settings: 'kasir_settings'
    };

    const defaultSettings = {
        autoPrint: false,
        printMode: 'rawbt',
        logoBase64: '',
        colorTheme: 'teal',
        displayMode: 'light',
        qrisMerchantName: 'AL - STORE',
        qrisImageBase64: '',
        lastPaymentMethod: 'cash',
        receiptTemplate: 'classic',
        headerText: 'WARUNGSCAN',
        storeAddress: '',
        storePhone: '',
        footerText: 'Terima Kasih',
        adminPin: ''
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSettings(settingsObj) {
        const settings = { ...defaultSettings, ...(settingsObj && typeof settingsObj === 'object' ? settingsObj : {}) };
        delete settings.qrisMode;
        delete settings.midtransBackendUrl;
        return settings;
    }

    function notify(message, type = 'error') {
        if (typeof window.showAppToast === 'function') window.showAppToast(message, type, 4500);
        else console.warn(message);
    }

    function safeRead(key, fallback) {
        const raw = localStorage.getItem(key);
        if (!raw) return clone(fallback);

        try {
            const parsed = JSON.parse(raw);
            return parsed === null ? clone(fallback) : parsed;
        } catch (error) {
            console.error(`Data ${key} rusak dan diabaikan.`, error);
            return clone(fallback);
        }
    }

    function write(key, value, showAlert = true) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Gagal menyimpan ${key}.`, error);
            if (showAlert) {
                notify('Gagal menyimpan data. Penyimpanan perangkat mungkin penuh. Ekspor backup lalu hapus foto atau data lama.');
            }
            return false;
        }
    }

    function restoreRaw(key, rawValue) {
        if (rawValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, rawValue);
    }

    function normalizeProduct(product) {
        return {
            barcode: String(product?.barcode || '').trim(),
            name: String(product?.name || '').trim(),
            price: Number(product?.price) || 0,
            hargaBeli: Number(product?.hargaBeli) || 0,
            stok: Math.max(0, Number.parseInt(product?.stok, 10) || 0),
            satuan: String(product?.satuan || '').trim(),
            category: String(product?.category || product?.kategori || 'Lainnya').trim() || 'Lainnya',
            photo: typeof product?.photo === 'string' ? product.photo : ''
        };
    }

    function normalizeProductItem(item) {
        const normalized = normalizeProduct(item);
        const qty = Math.max(1, Number.parseInt(item?.qty, 10) || 1);
        return {
            ...normalized,
            qty,
            subtotal: Number(item?.subtotal) || normalized.price * qty
        };
    }

    function normalizeTransaction(transaction) {
        const legacyTimestamp = Number(transaction?.id) || Date.parse(transaction?.waktu || '') || Date.now();
        const paymentMethod = String(transaction?.paymentMethod || 'cash').toLowerCase() === 'qris'
            ? 'qris'
            : 'cash';
        return {
            ...transaction,
            id: Number(transaction?.id) || Date.now(),
            createdAt: Number(transaction?.createdAt) || legacyTimestamp,
            waktu: String(transaction?.waktu || new Date().toLocaleString('id-ID')),
            items: Array.isArray(transaction?.items) ? transaction.items.map(normalizeProductItem) : [],
            total: Number(transaction?.total) || 0,
            tunai: Number(transaction?.tunai) || 0,
            kembali: Number(transaction?.kembali) || 0,
            paymentMethod,
            paymentStatus: String(transaction?.paymentStatus || 'paid'),
            paidAt: Number(transaction?.paidAt) || Number(transaction?.createdAt) || legacyTimestamp
        };
    }

    function getProducts() {
        const products = safeRead(KEYS.products, []);
        return Array.isArray(products) ? products.map(normalizeProduct) : [];
    }

    function getHistory() {
        const history = safeRead(KEYS.history, []);
        return Array.isArray(history) ? history.map(normalizeTransaction) : [];
    }

    function getSettings() {
        const settings = safeRead(KEYS.settings, {});
        return normalizeSettings(settings);
    }

    function saveProduct(product, previousBarcode = null) {
        const normalized = normalizeProduct(product);
        const products = getProducts();
        const oldBarcode = previousBarcode ? String(previousBarcode).trim() : normalized.barcode;
        const oldIndex = products.findIndex(item => item.barcode === oldBarcode);
        const duplicateIndex = products.findIndex(item => item.barcode === normalized.barcode);

        if (duplicateIndex !== -1 && duplicateIndex !== oldIndex) return false;

        if (oldIndex !== -1) products[oldIndex] = normalized;
        else products.push(normalized);

        return write(KEYS.products, products);
    }

    function updateProducts(productsArray) {
        if (!Array.isArray(productsArray)) return false;
        return write(KEYS.products, productsArray.map(normalizeProduct));
    }

    function deleteProduct(barcode) {
        const target = String(barcode);
        const products = getProducts().filter(product => product.barcode !== target);
        return write(KEYS.products, products);
    }

    function saveHistory(transaction) {
        const history = getHistory();
        history.unshift(normalizeTransaction(transaction));
        return write(KEYS.history, history);
    }

    // Menyimpan stok dan riwayat sebagai satu operasi logis. Jika salah satu gagal,
    // nilai awal dikembalikan sehingga stok dan laporan tidak berbeda.
    function commitSale(productsArray, transaction) {
        if (!Array.isArray(productsArray)) return false;

        const previousProducts = localStorage.getItem(KEYS.products);
        const previousHistory = localStorage.getItem(KEYS.history);
        const nextHistory = getHistory();
        nextHistory.unshift(normalizeTransaction(transaction));

        try {
            localStorage.setItem(KEYS.products, JSON.stringify(productsArray.map(normalizeProduct)));
            localStorage.setItem(KEYS.history, JSON.stringify(nextHistory));
            return true;
        } catch (error) {
            console.error('Transaksi gagal disimpan; data dipulihkan.', error);
            try {
                restoreRaw(KEYS.products, previousProducts);
                restoreRaw(KEYS.history, previousHistory);
            } catch (restoreError) {
                console.error('Pemulihan data gagal.', restoreError);
            }
            notify('Transaksi belum tersimpan karena penyimpanan perangkat penuh. Keranjang tidak dihapus.');
            return false;
        }
    }

    function clearHistory() {
        try {
            localStorage.removeItem(KEYS.history);
            return true;
        } catch (error) {
            console.error('Gagal menghapus riwayat.', error);
            return false;
        }
    }

    function saveSettings(settingsObj) {
        return write(KEYS.settings, normalizeSettings(settingsObj));
    }

    function exportData() {
        return JSON.stringify({
            version: 5,
            exportedAt: new Date().toISOString(),
            products: getProducts(),
            history: getHistory(),
            settings: getSettings()
        }, null, 2);
    }

    function importData(payload) {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.history)) {
            throw new Error('Format backup tidak valid.');
        }

        const previous = {
            products: localStorage.getItem(KEYS.products),
            history: localStorage.getItem(KEYS.history),
            settings: localStorage.getItem(KEYS.settings)
        };

        try {
            localStorage.setItem(KEYS.products, JSON.stringify(parsed.products.map(normalizeProduct)));
            localStorage.setItem(KEYS.history, JSON.stringify(parsed.history.map(normalizeTransaction)));
            localStorage.setItem(KEYS.settings, JSON.stringify(normalizeSettings(parsed.settings)));
            return true;
        } catch (error) {
            restoreRaw(KEYS.products, previous.products);
            restoreRaw(KEYS.history, previous.history);
            restoreRaw(KEYS.settings, previous.settings);
            throw error;
        }
    }

    return {
        getProducts,
        saveProduct,
        updateProducts,
        deleteProduct,
        getHistory,
        saveHistory,
        commitSale,
        clearHistory,
        getSettings,
        saveSettings,
        exportData,
        importData
    };
})();
