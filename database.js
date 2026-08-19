// database.js - Penyimpanan lokal, buku piutang, dan penghubung sinkronisasi.
const DB = (() => {
    const KEYS = {
        products: 'kasir_products',
        history: 'kasir_history',
        settings: 'kasir_settings',
        customers: 'kasir_customers',
        debts: 'kasir_debts'
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
        adminPin: '',
        firebaseConfig: null,
        sharedSettingsUpdatedAt: 0
    };

    const clone = value => JSON.parse(JSON.stringify(value));

    function now() {
        return Date.now();
    }

    function newId(prefix = 'id') {
        return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    }

    function normalizeSettings(settingsObj) {
        const settings = {
            ...defaultSettings,
            ...(settingsObj && typeof settingsObj === 'object' ? settingsObj : {})
        };
        delete settings.qrisMode;
        delete settings.midtransBackendUrl;
        settings.firebaseConfig = settings.firebaseConfig && typeof settings.firebaseConfig === 'object'
            ? {
                apiKey: String(settings.firebaseConfig.apiKey || '').trim(),
                authDomain: String(settings.firebaseConfig.authDomain || '').trim(),
                projectId: String(settings.firebaseConfig.projectId || '').trim(),
                storageBucket: String(settings.firebaseConfig.storageBucket || '').trim(),
                messagingSenderId: String(settings.firebaseConfig.messagingSenderId || '').trim(),
                appId: String(settings.firebaseConfig.appId || '').trim()
            }
            : null;
        settings.sharedSettingsUpdatedAt = Number(settings.sharedSettingsUpdatedAt) || 0;
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
            if (showAlert) notify('Gagal menyimpan data. Penyimpanan perangkat mungkin penuh. Ekspor backup lalu hapus foto atau data lama.');
            return false;
        }
    }

    function restoreRaw(key, rawValue) {
        if (rawValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, rawValue);
    }

    function emitChange(dataset, action, payload = {}) {
        window.dispatchEvent(new CustomEvent('warungscan:data-changed', {
            detail: { dataset, action, changedAt: now(), ...clone(payload) }
        }));
    }

    function emitRemoteUpdate(dataset) {
        window.dispatchEvent(new CustomEvent('warungscan:remote-updated', { detail: { dataset } }));
    }

    function normalizeProduct(product) {
        const createdAt = Number(product?.createdAt) || Number(product?.updatedAt) || 0;
        return {
            barcode: String(product?.barcode || '').trim(),
            name: String(product?.name || '').trim(),
            price: Number(product?.price) || 0,
            hargaBeli: Number(product?.hargaBeli) || 0,
            stok: Math.max(0, Number.parseInt(product?.stok, 10) || 0),
            satuan: String(product?.satuan || '').trim(),
            category: String(product?.category || product?.kategori || 'Lainnya').trim() || 'Lainnya',
            photo: typeof product?.photo === 'string' ? product.photo : '',
            createdAt,
            updatedAt: Number(product?.updatedAt) || createdAt
        };
    }

    function normalizeProductItem(item) {
        const normalized = normalizeProduct(item);
        const qty = Math.max(1, Number.parseInt(item?.qty, 10) || 1);
        return {
            ...normalized,
            qty,
            subtotal: Number(item?.subtotal) || normalized.price * qty,
            photo: ''
        };
    }

    function normalizeTransaction(transaction) {
        const legacyTimestamp = Number(transaction?.id) || Date.parse(transaction?.waktu || '') || now();
        const rawMethod = String(transaction?.paymentMethod || 'cash').toLowerCase();
        const paymentMethod = ['qris', 'credit'].includes(rawMethod) ? rawMethod : 'cash';
        const id = Number(transaction?.id) || legacyTimestamp;
        const createdAt = Number(transaction?.createdAt) || legacyTimestamp;
        const isCredit = paymentMethod === 'credit';
        return {
            ...transaction,
            id,
            syncId: String(transaction?.syncId || `trx_${id}`),
            createdAt,
            updatedAt: Number(transaction?.updatedAt) || createdAt,
            waktu: String(transaction?.waktu || new Date(createdAt).toLocaleString('id-ID')),
            items: Array.isArray(transaction?.items) ? transaction.items.map(normalizeProductItem) : [],
            total: Math.max(0, Number(transaction?.total) || 0),
            tunai: Math.max(0, Number(transaction?.tunai) || 0),
            kembali: Math.max(0, Number(transaction?.kembali) || 0),
            paymentMethod,
            paymentStatus: String(transaction?.paymentStatus || (isCredit ? 'unpaid' : 'paid')),
            paidAt: isCredit ? (Number(transaction?.paidAt) || 0) : (Number(transaction?.paidAt) || createdAt),
            customerId: String(transaction?.customerId || ''),
            customerName: String(transaction?.customerName || '').trim(),
            customerPhone: String(transaction?.customerPhone || '').trim(),
            debtId: String(transaction?.debtId || '')
        };
    }

    function normalizeCustomer(customer) {
        const createdAt = Number(customer?.createdAt) || Number(customer?.updatedAt) || now();
        return {
            id: String(customer?.id || newId('cust')),
            name: String(customer?.name || '').trim(),
            phone: String(customer?.phone || '').trim(),
            address: String(customer?.address || '').trim(),
            note: String(customer?.note || '').trim(),
            createdAt,
            updatedAt: Number(customer?.updatedAt) || createdAt,
            lastTransactionAt: Number(customer?.lastTransactionAt) || 0
        };
    }

    function normalizeDebtPayment(payment) {
        const createdAt = Number(payment?.createdAt) || now();
        return {
            id: String(payment?.id || newId('pay')),
            amount: Math.max(0, Number(payment?.amount) || 0),
            method: String(payment?.method || 'cash').toLowerCase() === 'qris' ? 'qris' : 'cash',
            note: String(payment?.note || '').trim(),
            createdAt,
            waktu: String(payment?.waktu || new Date(createdAt).toLocaleString('id-ID'))
        };
    }

    function normalizeDebt(debt) {
        const createdAt = Number(debt?.createdAt) || now();
        const amount = Math.max(0, Number(debt?.amount) || 0);
        const payments = Array.isArray(debt?.payments)
            ? debt.payments.map(normalizeDebtPayment).filter(payment => payment.amount > 0)
            : [];
        const paidFromPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const paidAmount = Math.min(amount, Math.max(paidFromPayments, Number(debt?.paidAmount) || 0));
        const remainingAmount = Math.max(0, amount - paidAmount);
        return {
            id: String(debt?.id || newId('debt')),
            transactionId: Number(debt?.transactionId) || 0,
            transactionSyncId: String(debt?.transactionSyncId || ''),
            customerId: String(debt?.customerId || ''),
            customerName: String(debt?.customerName || '').trim(),
            customerPhone: String(debt?.customerPhone || '').trim(),
            amount,
            paidAmount,
            remainingAmount,
            status: remainingAmount <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'),
            dueDate: String(debt?.dueDate || ''),
            note: String(debt?.note || '').trim(),
            payments,
            createdAt,
            updatedAt: Number(debt?.updatedAt) || createdAt,
            paidAt: remainingAmount <= 0 ? (Number(debt?.paidAt) || createdAt) : 0
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
        return normalizeSettings(safeRead(KEYS.settings, {}));
    }

    function getCustomers() {
        const customers = safeRead(KEYS.customers, []);
        return Array.isArray(customers) ? customers.map(normalizeCustomer) : [];
    }

    function getDebts() {
        const debts = safeRead(KEYS.debts, []);
        return Array.isArray(debts) ? debts.map(normalizeDebt) : [];
    }

    function saveProduct(product, previousBarcode = null) {
        const timestamp = now();
        const normalized = normalizeProduct(product);
        normalized.createdAt = normalized.createdAt || timestamp;
        normalized.updatedAt = timestamp;
        const products = getProducts();
        const oldBarcode = previousBarcode ? String(previousBarcode).trim() : normalized.barcode;
        const oldIndex = products.findIndex(item => item.barcode === oldBarcode);
        const duplicateIndex = products.findIndex(item => item.barcode === normalized.barcode);
        if (duplicateIndex !== -1 && duplicateIndex !== oldIndex) return false;
        if (oldIndex !== -1) products[oldIndex] = normalized;
        else products.push(normalized);
        if (!write(KEYS.products, products)) return false;
        emitChange('products', 'upsert', { id: normalized.barcode, previousId: oldBarcode, record: normalized });
        return true;
    }

    function updateProducts(productsArray) {
        if (!Array.isArray(productsArray)) return false;
        const timestamp = now();
        const products = productsArray.map(product => {
            const normalized = normalizeProduct(product);
            normalized.createdAt = normalized.createdAt || timestamp;
            normalized.updatedAt = timestamp;
            return normalized;
        });
        if (!write(KEYS.products, products)) return false;
        emitChange('products', 'replace', { records: products });
        return true;
    }

    function deleteProduct(barcode) {
        const target = String(barcode);
        const products = getProducts().filter(product => product.barcode !== target);
        if (!write(KEYS.products, products)) return false;
        emitChange('products', 'delete', { id: target });
        return true;
    }

    function saveHistory(transaction) {
        const history = getHistory();
        const normalized = normalizeTransaction({ ...transaction, updatedAt: now() });
        history.unshift(normalized);
        if (!write(KEYS.history, history)) return false;
        emitChange('history', 'upsert', { id: normalized.syncId, record: normalized });
        return true;
    }

    function saveCustomer(customer) {
        const timestamp = now();
        const normalized = normalizeCustomer(customer);
        normalized.updatedAt = timestamp;
        normalized.createdAt = normalized.createdAt || timestamp;
        const customers = getCustomers();
        const index = customers.findIndex(item => item.id === normalized.id);
        if (index !== -1) customers[index] = normalized;
        else customers.push(normalized);
        if (!write(KEYS.customers, customers)) return null;
        emitChange('customers', 'upsert', { id: normalized.id, record: normalized });
        return normalized;
    }

    function findCustomerByIdentity(name, phone = '') {
        const normalizedName = String(name || '').trim().toLocaleLowerCase('id');
        const normalizedPhone = String(phone || '').replace(/\D/g, '');
        return getCustomers().find(customer => {
            const sameName = customer.name.toLocaleLowerCase('id') === normalizedName;
            const samePhone = normalizedPhone && customer.phone.replace(/\D/g, '') === normalizedPhone;
            return samePhone || sameName;
        }) || null;
    }

    function prepareCustomer(customerInput) {
        if (!customerInput?.name?.trim()) return null;
        const existing = customerInput.id
            ? getCustomers().find(customer => customer.id === String(customerInput.id))
            : findCustomerByIdentity(customerInput.name, customerInput.phone);
        const timestamp = now();
        return normalizeCustomer({
            ...existing,
            ...customerInput,
            id: existing?.id || customerInput.id || newId('cust'),
            createdAt: existing?.createdAt || timestamp,
            updatedAt: timestamp,
            lastTransactionAt: timestamp
        });
    }

    // Stok, transaksi, pelanggan, dan piutang disimpan sebagai satu operasi lokal.
    function commitSale(productsArray, transaction, customerInput = null, debtInput = null) {
        if (!Array.isArray(productsArray)) return false;
        const previous = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, localStorage.getItem(key)]));
        const timestamp = now();
        const soldBarcodes = new Set((transaction?.items || []).map(item => String(item.barcode || '')));
        const nextProducts = productsArray.map(product => {
            const normalized = normalizeProduct(product);
            if (soldBarcodes.has(normalized.barcode)) normalized.updatedAt = timestamp;
            normalized.createdAt = normalized.createdAt || timestamp;
            return normalized;
        });

        const customer = prepareCustomer(customerInput || (transaction?.customerName ? {
            id: transaction.customerId,
            name: transaction.customerName,
            phone: transaction.customerPhone
        } : null));
        let normalizedTransaction = normalizeTransaction({
            ...transaction,
            customerId: customer?.id || transaction?.customerId || '',
            customerName: customer?.name || transaction?.customerName || '',
            customerPhone: customer?.phone || transaction?.customerPhone || '',
            updatedAt: timestamp
        });

        let debt = null;
        if (normalizedTransaction.paymentMethod === 'credit') {
            debt = normalizeDebt({
                ...debtInput,
                id: debtInput?.id || normalizedTransaction.debtId || newId('debt'),
                transactionId: normalizedTransaction.id,
                transactionSyncId: normalizedTransaction.syncId,
                customerId: customer?.id || normalizedTransaction.customerId,
                customerName: customer?.name || normalizedTransaction.customerName,
                customerPhone: customer?.phone || normalizedTransaction.customerPhone,
                amount: normalizedTransaction.total,
                createdAt: normalizedTransaction.createdAt,
                updatedAt: timestamp
            });
            normalizedTransaction = normalizeTransaction({
                ...normalizedTransaction,
                debtId: debt.id,
                paymentStatus: debt.status,
                paidAt: debt.paidAt,
                updatedAt: timestamp
            });
        }

        const nextHistory = getHistory();
        nextHistory.unshift(normalizedTransaction);
        const nextCustomers = getCustomers();
        if (customer) {
            const index = nextCustomers.findIndex(item => item.id === customer.id);
            if (index !== -1) nextCustomers[index] = customer;
            else nextCustomers.push(customer);
        }
        const nextDebts = getDebts();
        if (debt) nextDebts.unshift(debt);

        try {
            localStorage.setItem(KEYS.products, JSON.stringify(nextProducts));
            localStorage.setItem(KEYS.history, JSON.stringify(nextHistory));
            if (customer) localStorage.setItem(KEYS.customers, JSON.stringify(nextCustomers));
            if (debt) localStorage.setItem(KEYS.debts, JSON.stringify(nextDebts));
        } catch (error) {
            console.error('Transaksi gagal disimpan; data dipulihkan.', error);
            Object.entries(KEYS).forEach(([name, key]) => restoreRaw(key, previous[name]));
            notify('Transaksi belum tersimpan karena penyimpanan perangkat penuh. Keranjang tidak dihapus.');
            return false;
        }

        emitChange('sale', 'commit', {
            products: nextProducts.filter(product => soldBarcodes.has(product.barcode)),
            transaction: normalizedTransaction,
            customer,
            debt
        });
        return true;
    }

    function recordDebtPayment(debtId, amount, method = 'cash', note = '') {
        const targetId = String(debtId || '');
        const numericAmount = Math.max(0, Number(amount) || 0);
        const debts = getDebts();
        const debtIndex = debts.findIndex(item => item.id === targetId);
        if (debtIndex < 0 || numericAmount <= 0) return null;
        const current = debts[debtIndex];
        if (numericAmount > current.remainingAmount) return null;

        const timestamp = now();
        const payment = normalizeDebtPayment({ amount: numericAmount, method, note, createdAt: timestamp });
        const updatedDebt = normalizeDebt({
            ...current,
            payments: [...current.payments, payment],
            paidAmount: current.paidAmount + numericAmount,
            updatedAt: timestamp,
            paidAt: current.remainingAmount === numericAmount ? timestamp : 0
        });
        debts[debtIndex] = updatedDebt;

        const history = getHistory();
        const transactionIndex = history.findIndex(transaction =>
            transaction.syncId === updatedDebt.transactionSyncId ||
            (updatedDebt.transactionId && transaction.id === updatedDebt.transactionId)
        );
        let updatedTransaction = null;
        if (transactionIndex >= 0) {
            updatedTransaction = normalizeTransaction({
                ...history[transactionIndex],
                paymentStatus: updatedDebt.status,
                paidAt: updatedDebt.paidAt,
                debtPaidAmount: updatedDebt.paidAmount,
                debtRemainingAmount: updatedDebt.remainingAmount,
                updatedAt: timestamp
            });
            history[transactionIndex] = updatedTransaction;
        }

        const customers = getCustomers();
        const customerIndex = customers.findIndex(customer => customer.id === updatedDebt.customerId);
        let customer = null;
        if (customerIndex >= 0) {
            customer = normalizeCustomer({ ...customers[customerIndex], updatedAt: timestamp });
            customers[customerIndex] = customer;
        }

        const previous = {
            debts: localStorage.getItem(KEYS.debts),
            history: localStorage.getItem(KEYS.history),
            customers: localStorage.getItem(KEYS.customers)
        };
        try {
            localStorage.setItem(KEYS.debts, JSON.stringify(debts));
            localStorage.setItem(KEYS.history, JSON.stringify(history));
            localStorage.setItem(KEYS.customers, JSON.stringify(customers));
        } catch (error) {
            restoreRaw(KEYS.debts, previous.debts);
            restoreRaw(KEYS.history, previous.history);
            restoreRaw(KEYS.customers, previous.customers);
            notify('Pembayaran piutang belum tersimpan. Coba kembali setelah ruang penyimpanan tersedia.');
            return null;
        }

        emitChange('debtPayment', 'commit', {
            debt: updatedDebt,
            payment,
            transaction: updatedTransaction,
            customer
        });
        return updatedDebt;
    }

    function clearHistory() {
        try {
            localStorage.removeItem(KEYS.history);
            emitChange('history', 'replace', { records: [] });
            return true;
        } catch (error) {
            console.error('Gagal menghapus riwayat.', error);
            return false;
        }
    }

    function saveSettings(settingsObj) {
        const settings = normalizeSettings(settingsObj);
        const previous = getSettings();
        const localOnly = new Set(['firebaseConfig', 'printMode', 'autoPrint', 'colorTheme', 'displayMode', 'lastPaymentMethod', 'sharedSettingsUpdatedAt']);
        const sharedPart = value => Object.fromEntries(Object.entries(value).filter(([key]) => !localOnly.has(key)));
        settings.sharedSettingsUpdatedAt = JSON.stringify(sharedPart(previous)) === JSON.stringify(sharedPart(settings))
            ? Number(previous.sharedSettingsUpdatedAt) || 0
            : now();
        if (!write(KEYS.settings, settings)) return false;
        emitChange('settings', 'upsert', { id: 'main', record: settings });
        return true;
    }

    function replaceLocalDataset(dataset, value, options = {}) {
        if (!Object.hasOwn(KEYS, dataset)) return false;
        let normalized;
        if (dataset === 'products') normalized = Array.isArray(value) ? value.map(normalizeProduct) : [];
        else if (dataset === 'history') normalized = Array.isArray(value) ? value.map(normalizeTransaction) : [];
        else if (dataset === 'customers') normalized = Array.isArray(value) ? value.map(normalizeCustomer) : [];
        else if (dataset === 'debts') normalized = Array.isArray(value) ? value.map(normalizeDebt) : [];
        else normalized = normalizeSettings(value);
        if (!write(KEYS[dataset], normalized, false)) return false;
        if (options.silent !== false) emitRemoteUpdate(dataset);
        else emitChange(dataset, 'replace', { records: normalized });
        return true;
    }

    function exportData() {
        return JSON.stringify({
            version: 6,
            exportedAt: new Date().toISOString(),
            products: getProducts(),
            history: getHistory(),
            customers: getCustomers(),
            debts: getDebts(),
            settings: getSettings()
        }, null, 2);
    }

    function importData(payload) {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.history)) {
            throw new Error('Format backup tidak valid.');
        }
        const previous = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, localStorage.getItem(key)]));
        const imported = {
            products: parsed.products.map(normalizeProduct),
            history: parsed.history.map(normalizeTransaction),
            customers: Array.isArray(parsed.customers) ? parsed.customers.map(normalizeCustomer) : [],
            debts: Array.isArray(parsed.debts) ? parsed.debts.map(normalizeDebt) : [],
            settings: normalizeSettings(parsed.settings)
        };
        try {
            Object.entries(imported).forEach(([name, value]) => localStorage.setItem(KEYS[name], JSON.stringify(value)));
        } catch (error) {
            Object.entries(KEYS).forEach(([name, key]) => restoreRaw(key, previous[name]));
            throw error;
        }
        emitChange('all', 'replace', { snapshot: imported });
        return true;
    }

    return {
        newId,
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
        getCustomers,
        saveCustomer,
        findCustomerByIdentity,
        getDebts,
        recordDebtPayment,
        replaceLocalDataset,
        exportData,
        importData
    };
})();
