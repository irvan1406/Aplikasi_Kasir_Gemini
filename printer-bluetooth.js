// printer-bluetooth.js - Modul Bluetooth & ESC/POS dengan Fitur Logo

let bluetoothDevice = null;
let printCharacteristic = null;

// Fungsi untuk menghubungkan dan menyimpan sesi Printer Bluetooth
async function connectBluetoothPrinter() {
    try {
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
        });

        const server = await bluetoothDevice.gatt.connect();
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
        const characteristics = await service.getCharacteristics();
        
        printCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
        
        if (!printCharacteristic) {
            throw new Error("Karakteristik penulis pada printer tidak ditemukan.");
        }
        
        alert("Berhasil terhubung ke printer: " + bluetoothDevice.name);
        document.getElementById('status-printer').innerText = "Terhubung: " + bluetoothDevice.name;
        document.getElementById('status-printer').style.color = "#4CAF50";
        return true;
    } catch (error) {
        console.error(error);
        alert("Gagal konek Bluetooth: " + error.message);
        return false;
    }
}

// Fungsi konversi gambar Base64 menjadi data byte khusus Printer Thermal (Monokrom Raster)
async function generateLogoRaster(base64Logo) {
    if (!base64Logo) return new Uint8Array();
    return new Promise((resolve) => {
        let img = new Image();
        img.onload = () => {
            let canvas = document.createElement('canvas');
            let targetWidth = 384; // Standar maksimal lebar printer 58mm (384 dot)
            let targetHeight = Math.round((img.height / img.width) * targetWidth);
            
            // Pastikan lebar adalah kelipatan 8 byte
            targetWidth = Math.floor(targetWidth / 8) * 8;

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            
            let imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            let pixels = imgData.data;
            
            let bytesWidth = targetWidth / 8;
            let buffer = new Uint8Array(8 + (bytesWidth * targetHeight));
            
            // Perintah ESC/POS GS v 0 (Print Raster Image)
            buffer[0] = 0x1D; // GS
            buffer[1] = 0x76; // v
            buffer[2] = 0x30; // 0
            buffer[3] = 0x00; // m (normal)
            buffer[4] = bytesWidth & 0xFF; // xL
            buffer[5] = (bytesWidth >> 8) & 0xFF; // xH
            buffer[6] = targetHeight & 0xFF; // yL
            buffer[7] = (targetHeight >> 8) & 0xFF; // yH
            
            let offset = 8;
            for (let y = 0; y < targetHeight; y++) {
                for (let x = 0; x < bytesWidth; x++) {
                    let byte = 0;
                    for (let b = 0; b < 8; b++) {
                        let px = (y * targetWidth + (x * 8 + b)) * 4;
                        let r = pixels[px];
                        let g = pixels[px + 1];
                        let b_col = pixels[px + 2];
                        let a = pixels[px + 3];
                        
                        let brightness = (r * 0.299 + g * 0.587 + b_col * 0.114);
                        if (brightness < 128 && a > 128) {
                            byte |= (1 << (7 - b));
                        }
                    }
                    buffer[offset++] = byte;
                }
            }
            resolve(buffer);
        };
        img.src = base64Logo;
    });
}

// Fungsi utama cetak struk via Bluetooth (Menerima raw text dari Preview)
async function connectAndPrintBluetooth(customReceiptText, logoBase64) {
    try {
        if (!bluetoothDevice || !printCharacteristic || !bluetoothDevice.gatt.connected) {
            let connected = await connectBluetoothPrinter();
            if (!connected) return;
        }

        // 1. Eksekusi Logo jika ada
        if (logoBase64) {
            let logoBytes = await generateLogoRaster(logoBase64);
            if (logoBytes.length > 0) {
                await sendToPrinterInChunks(logoBytes);
            }
        }

        // 2. Format Inisiasi Printer & Kirim Teks
        const ESC = "\x1B";
        const INIT = ESC + "@";          
        const ENTER = "\x0A";

        // Teks dikirim persis apa adanya dari kolom Preview (sudah ditata dari app.js)
        let finalData = INIT + customReceiptText + ENTER + ENTER + ENTER;

        let encoder = new TextEncoder("utf-8");
        let textData = encoder.encode(finalData);

        // 3. Kirim teks struk
        await sendToPrinterInChunks(textData);

    } catch (error) {
        console.error(error);
        alert("Gagal print: " + error.message);
    }
}

// Helper untuk mengirim data terpotong (Syarat Bluetooth LE max 512 bytes)
async function sendToPrinterInChunks(uint8ArrayData) {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < uint8ArrayData.length; i += CHUNK_SIZE) {
        let chunk = uint8ArrayData.slice(i, i + CHUNK_SIZE);
        if (printCharacteristic.properties.writeWithoutResponse) {
            await printCharacteristic.writeValueWithoutResponse(chunk);
        } else {
            await printCharacteristic.writeValue(chunk);
        }
    }
}
