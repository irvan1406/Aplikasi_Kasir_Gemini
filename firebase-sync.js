import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    setPersistence,
    signInWithEmailAndPassword,
    signOut
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    initializeFirestore,
    onSnapshot,
    persistentLocalCache,
    persistentMultipleTabManager,
    serverTimestamp,
    setDoc,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const LOCAL_SETTING_KEYS = new Set([
    'firebaseConfig',
    'printMode',
    'autoPrint',
    'colorTheme',
    'displayMode',
    'lastPaymentMethod'
]);

const COLLECTIONS = {
    products: {
        getLocal: () => DB.getProducts(),
        getId: record => record.barcode
    },
    history: {
        getLocal: () => DB.getHistory(),
        getId: record => record.syncId || `trx_${record.id}`
    },
    customers: {
        getLocal: () => DB.getCustomers(),
        getId: record => record.id
    },
    debts: {
        getLocal: () => DB.getDebts(),
        getId: record => record.id
    }
};

let firebaseApp = null;
let auth = null;
let firestore = null;
let currentUser = null;
let listeners = [];
let initialized = false;
let initialSyncRunning = false;
let pendingWrites = Promise.resolve();
let settingsWriteTimer = null;

function cleanClone(value) {
    return JSON.parse(JSON.stringify(value));
}

function isValidConfig(config) {
    return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function documentId(value) {
    return encodeURIComponent(String(value || 'unknown')).slice(0, 1400);
}

function userCollection(name) {
    return collection(firestore, 'users', currentUser.uid, name);
}

function userDocument(name, id) {
    return doc(firestore, 'users', currentUser.uid, name, documentId(id));
}

function setStatus(state, message, extra = {}) {
    const detail = {
        state,
        message,
        email: currentUser?.email || '',
        ...extra
    };
    window.dispatchEvent(new CustomEvent('warungscan:firebase-status', { detail }));
    if (typeof window.setFirebaseStatus === 'function') window.setFirebaseStatus(detail);
}

function readableError(error) {
    const code = String(error?.code || '');
    const messages = {
        'auth/invalid-credential': 'Email atau kata sandi salah.',
        'auth/invalid-email': 'Format email belum benar.',
        'auth/email-already-in-use': 'Email ini sudah terdaftar. Tekan Masuk, bukan Buat Akun.',
        'auth/weak-password': 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.',
        'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan di Firebase Authentication.',
        'auth/network-request-failed': 'Internet tidak tersedia. Data lokal tetap dapat dipakai.',
        'auth/unauthorized-domain': 'Domain aplikasi belum diizinkan di Firebase Authentication.',
        'permission-denied': 'Akses Firestore ditolak. Periksa Rules Firebase sesuai panduan.',
        'firestore/permission-denied': 'Akses Firestore ditolak. Periksa Rules Firebase sesuai panduan.',
        'failed-precondition': 'Firestore belum dibuat atau belum siap.',
        'firestore/failed-precondition': 'Firestore belum dibuat atau belum siap.'
    };
    return messages[code] || String(error?.message || 'Firebase tidak dapat dihubungkan.');
}

function recordTimestamp(record) {
    return Number(record?.updatedAt) || Number(record?.createdAt) || 0;
}

function mergeRecords(localRecords, remoteRecords, getId) {
    const merged = new Map();
    remoteRecords.forEach(record => merged.set(String(getId(record)), cleanClone(record)));
    localRecords.forEach(record => {
        const id = String(getId(record));
        const remote = merged.get(id);
        if (!remote || recordTimestamp(record) > recordTimestamp(remote)) merged.set(id, cleanClone(record));
    });
    return [...merged.values()];
}

function sortDataset(name, records) {
    if (name === 'history' || name === 'debts') {
        return records.sort((first, second) => Number(second.createdAt || second.id) - Number(first.createdAt || first.id));
    }
    if (name === 'customers') return records.sort((first, second) => first.name.localeCompare(second.name, 'id'));
    return records.sort((first, second) => first.name.localeCompare(second.name, 'id'));
}

function remoteSettings(settings) {
    const result = {};
    Object.entries(settings || {}).forEach(([key, value]) => {
        if (!LOCAL_SETTING_KEYS.has(key)) result[key] = value;
    });
    return result;
}

function mergeRemoteSettings(remote) {
    const local = DB.getSettings();
    const remoteTimestamp = Number(remote?.sharedSettingsUpdatedAt) || 0;
    const localTimestamp = Number(local.sharedSettingsUpdatedAt) || 0;
    if (localTimestamp > remoteTimestamp) return local;
    return { ...local, ...(remote || {}), firebaseConfig: local.firebaseConfig };
}

async function commitOperations(operations) {
    for (let start = 0; start < operations.length; start += 400) {
        const batch = writeBatch(firestore);
        operations.slice(start, start + 400).forEach(operation => {
            if (operation.type === 'delete') batch.delete(operation.ref);
            else batch.set(operation.ref, {
                ...cleanClone(operation.data),
                _cloudUpdatedAt: serverTimestamp()
            });
        });
        await batch.commit();
    }
}

async function replaceRemoteCollection(name, records) {
    const definition = COLLECTIONS[name];
    const snapshot = await getDocs(userCollection(name));
    const wantedIds = new Set(records.map(record => documentId(definition.getId(record))));
    const operations = snapshot.docs
        .filter(item => !wantedIds.has(item.id))
        .map(item => ({ type: 'delete', ref: item.ref }));
    records.forEach(record => {
        operations.push({
            type: 'set',
            ref: userDocument(name, definition.getId(record)),
            data: record
        });
    });
    await commitOperations(operations);
}

async function syncSingleRecord(name, record) {
    if (!record || !COLLECTIONS[name]) return;
    const definition = COLLECTIONS[name];
    await setDoc(userDocument(name, definition.getId(record)), {
        ...cleanClone(record),
        _cloudUpdatedAt: serverTimestamp()
    });
}

async function initialCollectionSync(name) {
    const definition = COLLECTIONS[name];
    const [remoteSnapshot, localRecords] = await Promise.all([
        getDocs(userCollection(name)),
        Promise.resolve(definition.getLocal())
    ]);
    const remoteRecords = remoteSnapshot.docs.map(item => {
        const data = item.data();
        delete data._cloudUpdatedAt;
        return data;
    });
    const merged = sortDataset(name, mergeRecords(localRecords, remoteRecords, definition.getId));
    DB.replaceLocalDataset(name, merged);

    const remoteMap = new Map(remoteRecords.map(record => [String(definition.getId(record)), record]));
    const operations = merged.filter(record => {
        const remote = remoteMap.get(String(definition.getId(record)));
        return !remote || recordTimestamp(record) > recordTimestamp(remote);
    }).map(record => ({
        type: 'set',
        ref: userDocument(name, definition.getId(record)),
        data: record
    }));
    if (operations.length) await commitOperations(operations);
}

async function initialSettingsSync() {
    const reference = userDocument('settings', 'main');
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) {
        const data = snapshot.data();
        delete data._cloudUpdatedAt;
        const local = DB.getSettings();
        if ((Number(local.sharedSettingsUpdatedAt) || 0) > (Number(data.sharedSettingsUpdatedAt) || 0)) {
            await setDoc(reference, {
                ...remoteSettings(local),
                _cloudUpdatedAt: serverTimestamp()
            });
        } else {
            DB.replaceLocalDataset('settings', mergeRemoteSettings(data));
        }
    } else {
        await setDoc(reference, {
            ...remoteSettings(DB.getSettings()),
            _cloudUpdatedAt: serverTimestamp()
        });
    }
}

function stopListeners() {
    listeners.forEach(unsubscribe => unsubscribe());
    listeners = [];
}

function startListeners() {
    stopListeners();
    Object.entries(COLLECTIONS).forEach(([name]) => {
        listeners.push(onSnapshot(userCollection(name), snapshot => {
            if (snapshot.metadata.hasPendingWrites) return;
            const records = snapshot.docs.map(item => {
                const data = item.data();
                delete data._cloudUpdatedAt;
                return data;
            });
            DB.replaceLocalDataset(name, sortDataset(name, records));
        }, error => setStatus('error', readableError(error))));
    });

    listeners.push(onSnapshot(userDocument('settings', 'main'), snapshot => {
        if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) return;
        const data = snapshot.data();
        delete data._cloudUpdatedAt;
        const merged = mergeRemoteSettings(data);
        if ((Number(data.sharedSettingsUpdatedAt) || 0) >= (Number(DB.getSettings().sharedSettingsUpdatedAt) || 0)) {
            DB.replaceLocalDataset('settings', merged);
        }
    }, error => setStatus('error', readableError(error))));
}

async function runInitialSync() {
    if (!currentUser || initialSyncRunning) return;
    initialSyncRunning = true;
    setStatus('syncing', 'Menyatukan data HP dengan Firebase…');
    try {
        for (const name of Object.keys(COLLECTIONS)) await initialCollectionSync(name);
        await initialSettingsSync();
        startListeners();
        setStatus('online', 'Data tersinkron otomatis.', { lastSyncAt: Date.now() });
    } catch (error) {
        console.error('Sinkronisasi awal Firebase gagal.', error);
        setStatus('error', readableError(error));
    } finally {
        initialSyncRunning = false;
    }
}

async function handleLocalChange(detail) {
    if (!currentUser || !detail) return;
    setStatus('syncing', 'Menyimpan perubahan ke Firebase…');
    try {
        if (detail.dataset === 'sale') {
            const operations = (detail.products || []).map(record => ({
                type: 'set', ref: userDocument('products', record.barcode), data: record
            }));
            if (detail.transaction) operations.push({
                type: 'set', ref: userDocument('history', detail.transaction.syncId || `trx_${detail.transaction.id}`), data: detail.transaction
            });
            if (detail.customer) operations.push({
                type: 'set', ref: userDocument('customers', detail.customer.id), data: detail.customer
            });
            if (detail.debt) operations.push({
                type: 'set', ref: userDocument('debts', detail.debt.id), data: detail.debt
            });
            await commitOperations(operations);
        } else if (detail.dataset === 'debtPayment') {
            const operations = [];
            if (detail.debt) operations.push({ type: 'set', ref: userDocument('debts', detail.debt.id), data: detail.debt });
            if (detail.transaction) operations.push({
                type: 'set', ref: userDocument('history', detail.transaction.syncId || `trx_${detail.transaction.id}`), data: detail.transaction
            });
            if (detail.customer) operations.push({ type: 'set', ref: userDocument('customers', detail.customer.id), data: detail.customer });
            await commitOperations(operations);
        } else if (detail.dataset === 'all') {
            for (const [name, definition] of Object.entries(COLLECTIONS)) {
                await replaceRemoteCollection(name, definition.getLocal());
            }
            await setDoc(userDocument('settings', 'main'), {
                ...remoteSettings(DB.getSettings()),
                _cloudUpdatedAt: serverTimestamp()
            });
        } else if (detail.dataset === 'settings') {
            await setDoc(userDocument('settings', 'main'), {
                ...remoteSettings(DB.getSettings()),
                _cloudUpdatedAt: serverTimestamp()
            });
        } else if (COLLECTIONS[detail.dataset]) {
            if (detail.action === 'delete') {
                await deleteDoc(userDocument(detail.dataset, detail.id));
            } else if (detail.action === 'replace') {
                await replaceRemoteCollection(detail.dataset, COLLECTIONS[detail.dataset].getLocal());
            } else if (detail.record) {
                if (detail.previousId && detail.previousId !== detail.id) {
                    await deleteDoc(userDocument(detail.dataset, detail.previousId));
                }
                await syncSingleRecord(detail.dataset, detail.record);
            }
        }
        setStatus('online', 'Data tersinkron otomatis.', { lastSyncAt: Date.now() });
    } catch (error) {
        console.error('Perubahan lokal belum tersinkron.', error);
        setStatus('offline', 'Perubahan tersimpan di HP dan akan dicoba lagi saat online.');
    }
}

function queueLocalChange(detail) {
    if (detail?.dataset === 'settings') {
        clearTimeout(settingsWriteTimer);
        settingsWriteTimer = setTimeout(() => {
            pendingWrites = pendingWrites.then(() => handleLocalChange(detail));
        }, 700);
        return;
    }
    pendingWrites = pendingWrites.then(() => handleLocalChange(detail));
}

async function signInAccount(email, password) {
    if (!auth) throw new Error('Konfigurasi Firebase belum disimpan.');
    setStatus('syncing', 'Sedang masuk ke akun toko…');
    try {
        await signInWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
        return true;
    } catch (error) {
        setStatus('error', readableError(error));
        throw new Error(readableError(error));
    }
}

async function createAccount(email, password) {
    if (!auth) throw new Error('Konfigurasi Firebase belum disimpan.');
    setStatus('syncing', 'Membuat akun toko…');
    try {
        await createUserWithEmailAndPassword(auth, String(email || '').trim(), String(password || ''));
        return true;
    } catch (error) {
        setStatus('error', readableError(error));
        throw new Error(readableError(error));
    }
}

async function signOutAccount() {
    if (!auth) return;
    stopListeners();
    await signOut(auth);
}

async function syncNow() {
    if (!currentUser) throw new Error('Masuk ke akun Firebase terlebih dahulu.');
    await runInitialSync();
}

async function initialize() {
    if (initialized) return;
    initialized = true;
    const config = DB.getSettings().firebaseConfig;
    if (!isValidConfig(config)) {
        setStatus('unconfigured', 'Firebase belum dikonfigurasi. Data tetap tersimpan di HP ini.');
        return;
    }

    try {
        firebaseApp = initializeApp(config);
        auth = getAuth(firebaseApp);
        await setPersistence(auth, browserLocalPersistence);
        try {
            firestore = initializeFirestore(firebaseApp, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
        } catch (error) {
            console.debug('Cache persisten tidak tersedia; memakai cache standar.', error);
            firestore = getFirestore(firebaseApp);
        }

        onAuthStateChanged(auth, user => {
            currentUser = user || null;
            if (!currentUser) {
                stopListeners();
                setStatus('signed-out', 'Firebase siap. Masuk agar data antarp HP tersinkron.');
                return;
            }
            runInitialSync();
        });
        setStatus('signed-out', 'Firebase siap. Memeriksa sesi akun…');
    } catch (error) {
        console.error('Firebase gagal diinisialisasi.', error);
        setStatus('error', readableError(error));
    }
}

window.addEventListener('warungscan:data-changed', event => queueLocalChange(event.detail));
window.addEventListener('online', () => {
    if (currentUser) runInitialSync();
});
window.addEventListener('offline', () => setStatus('offline', 'Internet terputus. Aplikasi memakai data lokal.'));

window.FirebaseSync = {
    initialize,
    signIn: signInAccount,
    signUp: createAccount,
    signOut: signOutAccount,
    syncNow,
    getState: () => ({
        configured: Boolean(auth),
        signedIn: Boolean(currentUser),
        email: currentUser?.email || ''
    })
};

initialize();
