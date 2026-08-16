// database.js - Pusat Manajemen Data
const DB = {
    // ======== MANAJEMEN PRODUK ========
    getProducts: () => JSON.parse(localStorage.getItem('kasir_products')) || [],
    
    saveProduct: (product) => {
        let products = DB.getProducts();
        let index = products.findIndex(p => p.barcode === product.barcode);
        if (index !== -1) {
            products[index] = product;
        } else {
            products.push(product);
        }
        try {
            localStorage.setItem('kasir_products', JSON.stringify(products));
            return true; 
        } catch (e) {
            alert("GAGAL MENYIMPAN: Memori penuh!");
            return false; 
        }
    },
    
    updateProducts: (productsArray) => {
        try {
            localStorage.setItem('kasir_products', JSON.stringify(productsArray));
        } catch (e) {
            console.error("Gagal update stok: Memori penuh.");
        }
    },
    
    deleteProduct: (barcode) => {
        let products = DB.getProducts().filter(p => p.barcode !== barcode);
        localStorage.setItem('kasir_products', JSON.stringify(products));
        return products;
    },

    // ======== MANAJEMEN RIWAYAT ========
    getHistory: () => JSON.parse(localStorage.getItem('kasir_history')) || [],
    
    saveHistory: (transaction) => {
        let history = DB.getHistory();
        history.unshift(transaction);
        try {
            localStorage.setItem('kasir_history', JSON.stringify(history));
        } catch (e) {
            console.error("Gagal menyimpan riwayat: Memori penuh.");
        }
    },

    clearHistory: () => {
        localStorage.removeItem('kasir_history');
    },

    // ======== MANAJEMEN PENGATURAN (SETTINGS) ========
    getSettings: () => {
        let defaultSettings = {
            autoPrint: false,
            logoBase64: ''
        };
        return JSON.parse(localStorage.getItem('kasir_settings')) || defaultSettings;
    },

    saveSettings: (settingsObj) => {
        try {
            localStorage.setItem('kasir_settings', JSON.stringify(settingsObj));
            return true;
        } catch (e) {
            alert("Gagal menyimpan pengaturan: Memori penuh.");
            return false;
        }
    }
};
