let cart = [];
let isAdmin = false;
let html5QrcodeScanner = null;
let editingBarcode = null;

// ================= UTILS & FORMAT =================
function formatRupiah(angka) {
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// BEEP SOUND BISA HIDUP TANPA FILE MP3 EKSTERNAL
function playBeep() {
    try {
        let ctx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = ctx.createOscillator();
        let gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, ctx.currentTime); // Frekuensi Bip Kasir
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime); // Volume
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15); // Durasi Bip
    } catch(e) { console.log("Audio not supported"); }
}

async function getBase64(file, isLogo = false) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = isLogo ? 200 : 400; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
        reader.onerror = error => reject(error);
    });
}

// ================= PERMISSION & NATIVE CAMERA (FOTO PRODUK) =================
async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); 
        alert("Izin Kamera berhasil diaktifkan!");
    } catch (err) {
        alert("Akses ditolak atau kamera tidak ditemukan: " + err.message);
    }
}

async function handleProductPhoto(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        try {
            let base64 = await getBase64(inputElement.files[0], false);
            window.capturedProductPhoto = base64;
            document.getElementById('preview-foto-barang').style.display = 'block';
            document.getElementById('img-preview-barang').src = base64;
        } catch (e) {
            alert("Gagal memproses gambar.");
        }
        inputElement.value = ""; 
    }
}

async function scanBarcodeFromFile(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        const file = inputElement.files[0];
        const html5QrCode = new Html5Qrcode("reader");
        try {
            const decodedText = await html5QrCode.scanFile(file, true);
            onScanSuccess(decodedText);
        } catch (err) {
            alert("Barcode tidak terdeteksi pada gambar ini. Pastikan gambar jelas.");
        }
        inputElement.value = ""; 
    }
}

// ================= NAVIGASI & PENGATURAN =================
function switchTab(tabId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'page-home') updateDashboardStats();
    if (tabId === 'page-barang') renderProducts();
    if (tabId === 'page-riwayat') renderHistory();
    if (tabId === 'page-pengaturan') loadSettingsUI();
    
    if (tabId !== 'page-kasir' && html5QrcodeScanner) stopScanner();
    window.scrollTo(0, 0);
}

function goToHome() {
    switchTab('page-home');
}

// AKSI TOMBOL DASHBOARD
function actionScan() { switchTab('page-kasir'); setTimeout(startScanner, 300); }
function actionCariBarang() { switchTab('page-barang'); setTimeout(() => document.getElementById('search-input').focus(), 300); }
function actionDaftarBarang() { switchTab('page-barang'); }
function actionRiwayat() { switchTab('page-riwayat'); }
function actionTambahBarang() { 
    switchTab('page-barang');
    if (!isAdmin) toggleAdminMode();
    window.scrollTo(0, 0);
}
function actionPos() { switchTab('page-kasir'); }

function updateDashboardStats() {
    let products = DB.getProducts();
    let menipis = products.filter(p => p.stok > 0 && p.stok <= 5).length;
    let habis = products.filter(p => p.stok === 0).length;
    
    document.getElementById('stat-barang').innerText = products.length;
    document.getElementById('stat-menipis').innerText = menipis;
    document.getElementById('stat-habis').innerText = habis;
}

function loadSettingsUI() {
    let settings = DB.getSettings();
    document.getElementById('setting-autoprint').value = settings.autoPrint.toString();
    document.getElementById('template-header').value = settings.headerText || 'WARUNGSCAN';
    document.getElementById('template-footer').value = settings.footerText || 'Terima Kasih';
    
    let previewContainer = document.getElementById('preview-logo-container');
    let previewImg = document.getElementById('preview-logo');
    if (settings.logoBase64) {
        previewImg.src = settings.logoBase64;
        previewContainer.style.display = 'flex';
    } else {
        previewContainer.style.display = 'none';
    }
}

async function handleLogoUpload() {
    let fileInput = document.getElementById('setting-logo');
    if (fileInput.files.length > 0) {
        let base64 = await getBase64(fileInput.files[0], true);
        let settings = DB.getSettings();
        settings.logoBase64 = base64;
        DB.saveSettings(settings);
        loadSettingsUI();
        alert("Logo berhasil disimpan!");
    }
}

function hapusLogo() {
    let settings = DB.getSettings();
    settings.logoBase64 = '';
    DB.saveSettings(settings);
    document.getElementById('setting-logo').value = '';
    loadSettingsUI();
}

function saveSettings() {
    let settings = DB.getSettings();
    settings.autoPrint = (document.getElementById('setting-autoprint').value === 'true');
    settings.headerText = document.getElementById('template-header').value || 'WARUNGSCAN';
    settings.footerText = document.getElementById('template-footer').value || 'Terima Kasih';
    DB.saveSettings(settings);
}

// ================= FITUR SCANNER SIMPLE =================
function startScanner() {
    document.getElementById('btn-start-scan').style.display = 'none';
    document.getElementById('btn-stop-scan').style.display = 'block';

    html5QrcodeScanner = new Html5Qrcode("reader");
    // Hardcode: Kamera belakang murni, FPS 15 untuk optimasi HP
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 150 } },
        onScanSuccess,
        (err) => {}
    ).catch(err => {
        alert("Kamera gagal diakses. Coba izin kamera atau pakai Scan Foto Galeri.");
        stopScanner();
    });
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            document.getElementById('btn-start-scan').style.display = 'block';
            document.getElementById('btn-stop-scan').style.display = 'none';
        }).catch(err => console.log(err));
    }
}

function onScanSuccess(decodedText) {
    if (navigator.vibrate) navigator.vibrate(100); 
    playBeep(); // FITUR BARU: BUNYI BIP KASIR

    let product = DB.getProducts().find(p => p.barcode === decodedText);
    if (product) {
        addToCart(product);
        if(html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            stopScanner();
            setTimeout(() => { startScanner(); }, 1500); 
        }
    } else { alert("Barang tidak ditemukan dalam database!"); }
}

function cariBarangKasir() {
    let keyword = document.getElementById('manual-barcode').value.toLowerCase();
    let resultContainer = document.getElementById('kasir-search-results');
    
    if (keyword.length === 0) { resultContainer.style.display = 'none'; return; }

    let filtered = DB.getProducts().filter(p => 
        p.barcode.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword)
    );

    if (filtered.length > 0) {
        resultContainer.innerHTML = '';
        filtered.forEach(p => {
            resultContainer.innerHTML += `
                <li onclick="pilihBarangKasir('${p.barcode}')">
                    <div style="flex:1;">
                        <strong style="font-size:15px; color:#111827;">${p.name}</strong><br>
                        <small style="color:#6b7280;">BC: ${p.barcode}</small>
                    </div>
                    <div><span style="color:#10b981; font-weight:700;">${formatRupiah(p.price)}</span></div>
                </li>`;
        });
        resultContainer.style.display = 'block';
    } else {
        resultContainer.innerHTML = '<li style="color:#ef4444; justify-content:center; font-weight:600;">Tidak ditemukan</li>';
        resultContainer.style.display = 'block';
    }
}

function pilihBarangKasir(barcode) {
    let product = DB.getProducts().find(p => p.barcode === barcode);
    if (product) {
        addToCart(product);
        document.getElementById('manual-barcode').value = '';
        document.getElementById('kasir-search-results').style.display = 'none';
    }
}

function addManualBarcode() {
    let keyword = document.getElementById('manual-barcode').value.toLowerCase();
    if (!keyword) return;
    
    let exactMatch = DB.getProducts().find(p => p.barcode.toLowerCase() === keyword);
    if (exactMatch) { pilihBarangKasir(exactMatch.barcode); return; }

    let filtered = DB.getProducts().filter(p => p.barcode.toLowerCase().includes(keyword) || p.name.toLowerCase().includes(keyword));
    if (filtered.length === 1) pilihBarangKasir(filtered[0].barcode); 
    else if (filtered.length > 1) alert("Ada lebih dari 1 barang yang cocok. Pilih dari daftar.");
    else alert("Barang tidak ditemukan!");
}

// ================= MANAJEMEN BARANG & ADMIN =================
function toggleAdminMode() {
    isAdmin = !isAdmin;
    let btn = document.getElementById('btn-admin-toggle');
    let form = document.getElementById('admin-form');
    let title = document.getElementById('title-barang');
    
    if (isAdmin) {
        btn.innerText = "Batal Edit";
        btn.classList.replace('btn-pill-light', 'btn-danger');
        form.style.display = 'block';
        title.innerText = "Tambah / Edit";
    } else {
        btn.innerText = "Mode Edit: OFF";
        btn.classList.replace('btn-danger', 'btn-pill-light');
        form.style.display = 'none';
        title.innerText = "Manajemen Barang";
        
        editingBarcode = null;
        document.getElementById('input-barcode').value = '';
        document.getElementById('input-nama').value = '';
        document.getElementById('input-harga').value = '';
        document.getElementById('input-harga-beli').value = '';
        document.getElementById('input-stok').value = '';
        document.getElementById('input-satuan').value = '';
        window.capturedProductPhoto = null;
        document.getElementById('preview-foto-barang').style.display = 'none';
    }
    renderProducts();
}

function editBarang(barcode) {
    let product = DB.getProducts().find(p => p.barcode === barcode);
    if (product) {
        document.getElementById('input-barcode').value = product.barcode;
        document.getElementById('input-nama').value = product.name;
        document.getElementById('input-harga').value = product.price;
        document.getElementById('input-harga-beli').value = product.hargaBeli || '';
        document.getElementById('input-stok').value = product.stok;
        document.getElementById('input-satuan').value = product.satuan || '';
        
        window.capturedProductPhoto = product.photo; 
        if(product.photo) {
            document.getElementById('preview-foto-barang').style.display = 'block';
            document.getElementById('img-preview-barang').src = product.photo;
        } else {
            document.getElementById('preview-foto-barang').style.display = 'none';
        }
        
        editingBarcode = product.barcode; 
        window.scrollTo(0, 0); 
    }
}

function simpanBarang() {
    let barcode = document.getElementById('input-barcode').value;
    let nama = document.getElementById('input-nama').value;
    let harga = parseInt(document.getElementById('input-harga').value);
    let hargaBeli = parseInt(document.getElementById('input-harga-beli').value) || 0;
    let stok = parseInt(document.getElementById('input-stok').value);
    let satuan = document.getElementById('input-satuan').value;

    if (!barcode || !nama || isNaN(harga) || isNaN(stok)) {
        alert("Lengkapi data wajib (Barcode, Nama, Harga Jual, Stok)!");
        return;
    }

    if (editingBarcode && editingBarcode !== barcode) {
        DB.deleteProduct(editingBarcode);
    }

    let photoBase64 = window.capturedProductPhoto || '';
    if (!photoBase64) {
        let ex = DB.getProducts().find(p => p.barcode === barcode) || DB.getProducts().find(p => p.barcode === editingBarcode);
        if (ex && ex.photo) photoBase64 = ex.photo;
    }

    let isSaved = DB.saveProduct({ 
        barcode: barcode, name: nama, price: harga, stok: stok, 
        photo: photoBase64, hargaBeli: hargaBeli, satuan: satuan 
    });
    
    if (isSaved) {
        editingBarcode = null; 
        window.capturedProductPhoto = null;
        document.getElementById('preview-foto-barang').style.display = 'none';
        document.getElementById('input-barcode').value = '';
        document.getElementById('input-nama').value = '';
        document.getElementById('input-harga').value = '';
        document.getElementById('input-harga-beli').value = '';
        document.getElementById('input-stok').value = '';
        document.getElementById('input-satuan').value = '';
        renderProducts();
        alert("Data barang berhasil tersimpan!");
    }
}

function renderProducts() {
    let productList = document.getElementById('product-list');
    let searchKeyword = document.getElementById('search-input').value.toLowerCase();
    
    productList.innerHTML = '';
    DB.getProducts().filter(p => p.name.toLowerCase().includes(searchKeyword) || p.barcode.includes(searchKeyword))
    .forEach(p => {
        let imgSrc = p.photo ? p.photo : 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2250%22%20height%3D%2250%22%20style%3D%22background%3A%23f0f0f0%22%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%20fill%3D%22%23aaa%22%20font-size%3D%2212%22%3EProduk%3C%2Ftext%3E%3C%2Fsvg%3E';
        
        let actionButtons = isAdmin ? `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <button onclick="editBarang('${p.barcode}')" class="btn-primary" style="padding: 6px 14px; font-size: 12px; border-radius: 6px;">Edit</button>
                <button onclick="hapusBarang('${p.barcode}')" class="btn-danger" style="padding: 6px 14px; font-size: 12px; border-radius: 6px;">Hapus</button>
            </div>` : '';

        productList.innerHTML += `
            <li>
                <img src="${imgSrc}" class="product-img">
                <div class="item-info">
                    <h4>${p.name}</h4>
                    <p>Stok: <strong>${p.stok}</strong> ${p.satuan || ''} | ${formatRupiah(p.price)}</p>
                    <p style="font-size:11px; color:#9ca3af; margin-top:2px;">BC: ${p.barcode}</p>
                </div>
                ${actionButtons}
            </li>`;
    });
}

function hapusBarang(barcode) {
    if(confirm("Yakin hapus barang ini permanen?")) { DB.deleteProduct(barcode); renderProducts(); }
}

// ================= KERANJANG (QTY DIKETIK) =================
function addToCart(product) {
    let item = cart.find(c => c.barcode === product.barcode);
    if (item) {
        if(item.qty < product.stok) { item.qty++; item.subtotal = item.qty * item.price; } 
        else { alert("Stok tidak mencukupi!"); }
    } else {
        if(product.stok > 0) cart.push({...product, qty: 1, subtotal: product.price});
        else alert("Stok kosong di gudang!");
    }
    renderCart();
}

function ubahQty(barcode, delta) {
    let item = cart.find(i => i.barcode === barcode);
    let product = DB.getProducts().find(p => p.barcode === barcode);
    if (item && product) {
        let newQty = item.qty + delta;
        if (newQty > 0 && newQty <= product.stok) {
            item.qty = newQty; item.subtotal = item.qty * item.price;
        } else if (newQty === 0) {
            cart = cart.filter(i => i.barcode !== barcode);
        }
    }
    renderCart();
}

function ketikQtyManual(barcode, inputElement) {
    let val = parseInt(inputElement.value);
    let item = cart.find(i => i.barcode === barcode);
    let product = DB.getProducts().find(p => p.barcode === barcode);
    
    if (item && product) {
        if (isNaN(val) || val <= 0) val = 1; 
        if (val > product.stok) {
            alert("Stok gudang hanya tersisa " + product.stok);
            val = product.stok;
        }
        item.qty = val;
        item.subtotal = item.qty * item.price;
        renderCart();
    }
}

function renderCart() {
    let cartList = document.getElementById('cart-list');
    cartList.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        total += item.subtotal;
        cartList.innerHTML += `
            <li>
                <div class="item-info">
                    <h4>${item.name}</h4><p style="color:var(--brand-primary); font-weight:600;">${formatRupiah(item.price)}</p>
                </div>
                <div class="qty-controls">
                    <button onclick="ubahQty('${item.barcode}', -1)">-</button>
                    <input type="number" class="qty-input-box" value="${item.qty}" min="1" onchange="ketikQtyManual('${item.barcode}', this)">
                    <button onclick="ubahQty('${item.barcode}', 1)">+</button>
                </div>
                <div style="margin-left:12px; text-align:right;"><strong>${formatRupiah(item.subtotal)}</strong></div>
            </li>`;
    });
    document.getElementById('cart-total').innerText = formatRupiah(total);
}

// ================= PEMBAYARAN & PREVIEW STRUK =================
function openPaymentModal() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    let total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    document.getElementById('modal-total-belanja').innerText = formatRupiah(total);
    document.getElementById('input-tunai').value = '';
    document.getElementById('modal-kembalian').innerText = 'Rp 0';
    document.getElementById('payment-modal').style.display = 'flex';
}

function closePaymentModal() { document.getElementById('payment-modal').style.display = 'none'; }
function closePreviewModal() { document.getElementById('preview-modal').style.display = 'none'; }

function hitungKembalian() {
    let total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let tunai = parseInt(document.getElementById('input-tunai').value) || 0;
    document.getElementById('modal-kembalian').innerText = formatRupiah(tunai >= total ? tunai - total : 0);
}

function prosesKePreview() {
    let total = cart.reduce((sum, item) => sum + item.subtotal, 0);
    let tunai = parseInt(document.getElementById('input-tunai').value) || 0;
    
    if (tunai < total) return alert("Uang tunai pembeli kurang!");

    let kembali = tunai - total;
    let waktu = new Date().toLocaleString('id-ID');
    let settings = DB.getSettings();

    // Potong Stok
    let allProducts = DB.getProducts();
    cart.forEach(cItem => {
        let prod = allProducts.find(p => p.barcode === cItem.barcode);
        if(prod) prod.stok -= cItem.qty;
    });
    DB.updateProducts(allProducts);

    // Simpan Riwayat
    let newTransactionId = Date.now();
    DB.saveHistory({ id: newTransactionId, waktu: waktu, items: [...cart], total: total, tunai: tunai, kembali: kembali });

    // Rakit Text Struk
    let headerTitle = settings.headerText || 'WARUNGSCAN';
    let footerText = settings.footerText || 'Terima Kasih';

    let receiptText = "";
    receiptText += headerTitle + "\n";
    receiptText += waktu + "\n";
    receiptText += "--------------------------------\n";
    cart.forEach(item => {
        receiptText += item.name + "\n";
        let sub = item.subtotal.toLocaleString('id-ID');
        let qtyPrice = `${item.qty} x ${item.price.toLocaleString('id-ID')}`;
        let spaces = 32 - qtyPrice.length - sub.length;
        if (spaces < 1) spaces = 1;
        receiptText += qtyPrice + " ".repeat(spaces) + sub + "\n";
    });
    receiptText += "--------------------------------\n";
    receiptText += "TOTAL:    Rp " + total.toLocaleString('id-ID') + "\n";
    receiptText += "TUNAI:    Rp " + tunai.toLocaleString('id-ID') + "\n";
    receiptText += "KEMBALI:  Rp " + kembali.toLocaleString('id-ID') + "\n";
    receiptText += "--------------------------------\n";
    receiptText += "     " + footerText + "     \n";

    document.getElementById('print-text-preview').value = receiptText;

    cart = [];
    renderCart();
    closePaymentModal();

    if (settings.autoPrint) { executePrint(); } 
    else { document.getElementById('preview-modal').style.display = 'flex'; }
}

async function executePrint() {
    let finalReceiptText = document.getElementById('print-text-preview').value;
    let settings = DB.getSettings();
    document.getElementById('preview-modal').style.display = 'none';

    if (settings.autoPrint && bluetoothDevice) {
        if (typeof connectAndPrintBluetooth === "function") await connectAndPrintBluetooth(finalReceiptText, settings.logoBase64);
    } else {
        let mauBluetooth = confirm("Cetak struk menggunakan BLUETOOTH?");
        if (mauBluetooth) {
            if (typeof connectAndPrintBluetooth === "function") await connectAndPrintBluetooth(finalReceiptText, settings.logoBase64);
        } else {
            let fallbackLogo = document.getElementById('print-area-logo');
            if(settings.logoBase64) {
                fallbackLogo.src = settings.logoBase64;
                fallbackLogo.style.display = 'block';
            } else { fallbackLogo.style.display = 'none'; }
            
            document.getElementById('print-raw-text').innerText = finalReceiptText;
            window.print();
        }
    }
}

// ================= RIWAYAT, LAPORAN & CETAK ULANG (REPRINT) =================
function renderHistory() {
    let historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    let histories = DB.getHistory();
    let todayStr = new Date().toLocaleDateString('id-ID'); // Format: DD/MM/YYYY
    
    let totalPendapatanHariIni = 0;
    let totalTrxHariIni = 0;

    histories.forEach(h => {
        // Kalkulasi Pendapatan khusus HARI INI
        if (h.waktu.includes(todayStr)) {
            totalPendapatanHariIni += h.total;
            totalTrxHariIni++;
        }

        let itemNames = h.items.map(i => `${i.name} (${i.qty})`).join(', ');
        historyList.innerHTML += `
            <li>
                <div class="item-info">
                    <h4>No. Ref: ${h.id}</h4>
                    <p style="color:var(--brand-success); font-weight:600; margin: 4px 0;">${h.waktu}</p>
                    <p>${itemNames}</p>
                    <button onclick="cetakUlangStruk(${h.id})" class="btn-outline" style="margin-top:8px; padding:6px 12px; font-size:12px;">🖨️ Cetak Ulang</button>
                </div>
                <div style="text-align:right;">
                    <strong style="font-size: 16px; color: var(--text-dark);">${formatRupiah(h.total)}</strong>
                </div>
            </li>`;
    });

    // Update Banner Laporan Pendapatan Hari Ini
    document.getElementById('report-today-revenue').innerText = formatRupiah(totalPendapatanHariIni);
    document.getElementById('report-today-trx').innerText = totalTrxHariIni + " trx";
}

// Fitur Baru: Cetak Ulang Struk
function cetakUlangStruk(trxId) {
    let h = DB.getHistory().find(x => x.id === trxId);
    if(!h) return alert("Transaksi tidak ditemukan!");

    let settings = DB.getSettings();
    let headerTitle = settings.headerText || 'WARUNGSCAN';
    let footerText = settings.footerText || 'Terima Kasih';

    let receiptText = "";
    receiptText += headerTitle + "\n";
    receiptText += h.waktu + " (COPY)\n";
    receiptText += "--------------------------------\n";
    h.items.forEach(item => {
        receiptText += item.name + "\n";
        let sub = item.subtotal.toLocaleString('id-ID');
        let qtyPrice = `${item.qty} x ${item.price.toLocaleString('id-ID')}`;
        let spaces = 32 - qtyPrice.length - sub.length;
        if (spaces < 1) spaces = 1;
        receiptText += qtyPrice + " ".repeat(spaces) + sub + "\n";
    });
    receiptText += "--------------------------------\n";
    receiptText += "TOTAL:    Rp " + h.total.toLocaleString('id-ID') + "\n";
    receiptText += "TUNAI:    Rp " + h.tunai.toLocaleString('id-ID') + "\n";
    receiptText += "KEMBALI:  Rp " + h.kembali.toLocaleString('id-ID') + "\n";
    receiptText += "--------------------------------\n";
    receiptText += "     " + footerText + "     \n";

    // Lempar ke layar preview agar bisa diedit/dilihat sebelum benar-benar di-print
    document.getElementById('print-text-preview').value = receiptText;
    document.getElementById('preview-modal').style.display = 'flex';
}

function hapusSemuaRiwayat() {
    if(confirm("Hapus semua riwayat transaksi? Tindakan ini tidak bisa dibatalkan.")) {
        DB.clearHistory(); renderHistory();
    }
}

// INIT
renderProducts();
updateDashboardStats();
