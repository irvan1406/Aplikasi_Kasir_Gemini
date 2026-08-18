// printer-bluetooth.js - Transport Bluetooth LE ESC/POS opsional.
// RawBT tetap menjadi mode bawaan karena lebih kompatibel dengan APK/WebView.

const PRINTER_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb'
];

let bluetoothDevice = null;
let printCharacteristic = null;

function updatePrinterStatus(message, connected = false) {
    const status = document.getElementById('status-printer');
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('status-online', connected);
    status.classList.toggle('status-offline', !connected);
}

function handleBluetoothDisconnected() {
    printCharacteristic = null;
    updatePrinterStatus('Printer Bluetooth terputus', false);
}

async function findWritableCharacteristic(server) {
    for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
            const service = await server.getPrimaryService(serviceUuid);
            const characteristics = await service.getCharacteristics();
            const writable = characteristics.find(characteristic =>
                characteristic.properties.writeWithoutResponse || characteristic.properties.write
            );
            if (writable) return writable;
        } catch (error) {
            // Printer tidak menyediakan service ini; lanjut mencoba UUID berikutnya.
        }
    }
    return null;
}

async function connectBluetoothPrinter() {
    if (!navigator.bluetooth) {
        alert('Web Bluetooth tidak tersedia di browser/APK ini. Pilih mode RawBT pada pengaturan printer.');
        updatePrinterStatus('Web Bluetooth tidak didukung', false);
        return false;
    }

    try {
        updatePrinterStatus('Mencari printer Bluetooth…', false);
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: PRINTER_SERVICE_UUIDS
        });

        bluetoothDevice.removeEventListener('gattserverdisconnected', handleBluetoothDisconnected);
        bluetoothDevice.addEventListener('gattserverdisconnected', handleBluetoothDisconnected);

        const server = await bluetoothDevice.gatt.connect();
        printCharacteristic = await findWritableCharacteristic(server);

        if (!printCharacteristic) {
            throw new Error('Service tulis ESC/POS tidak ditemukan. Printer mungkin memakai Bluetooth Classic; gunakan RawBT.');
        }

        const printerName = bluetoothDevice.name || 'Printer tanpa nama';
        updatePrinterStatus(`Terhubung: ${printerName}`, true);
        return true;
    } catch (error) {
        console.error('Gagal menghubungkan printer Bluetooth.', error);
        updatePrinterStatus('Printer belum terhubung', false);
        if (error.name !== 'NotFoundError') alert(`Gagal konek Bluetooth: ${error.message}`);
        return false;
    }
}

function disconnectBluetoothPrinter() {
    if (bluetoothDevice?.gatt?.connected) bluetoothDevice.gatt.disconnect();
    bluetoothDevice = null;
    printCharacteristic = null;
    updatePrinterStatus('Printer belum terhubung', false);
}

async function generateLogoRaster(base64Logo) {
    if (!base64Logo) return new Uint8Array();

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const targetWidth = 384;
                const targetHeight = Math.max(1, Math.round((img.height / img.width) * targetWidth));

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                const pixels = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
                const bytesWidth = targetWidth / 8;
                const buffer = new Uint8Array(8 + bytesWidth * targetHeight);

                buffer.set([
                    0x1D, 0x76, 0x30, 0x00,
                    bytesWidth & 0xFF,
                    (bytesWidth >> 8) & 0xFF,
                    targetHeight & 0xFF,
                    (targetHeight >> 8) & 0xFF
                ]);

                let offset = 8;
                for (let y = 0; y < targetHeight; y++) {
                    for (let byteX = 0; byteX < bytesWidth; byteX++) {
                        let value = 0;
                        for (let bit = 0; bit < 8; bit++) {
                            const pixelOffset = (y * targetWidth + byteX * 8 + bit) * 4;
                            const brightness =
                                pixels[pixelOffset] * 0.299 +
                                pixels[pixelOffset + 1] * 0.587 +
                                pixels[pixelOffset + 2] * 0.114;
                            if (brightness < 145 && pixels[pixelOffset + 3] > 128) value |= 1 << (7 - bit);
                        }
                        buffer[offset++] = value;
                    }
                }
                resolve(buffer);
            } catch (error) {
                reject(error);
            }
        };
        img.onerror = () => reject(new Error('Logo gagal dibaca.'));
        img.src = base64Logo;
    });
}

async function connectAndPrintBluetooth(customReceiptText, logoBase64) {
    try {
        if (!bluetoothDevice?.gatt?.connected || !printCharacteristic) {
            const connected = await connectBluetoothPrinter();
            if (!connected) return false;
        }

        // ESC @ (init), ESC a 1 (center) untuk logo.
        if (logoBase64) {
            await sendToPrinterInChunks(new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x01]));
            const logoBytes = await generateLogoRaster(logoBase64);
            if (logoBytes.length) await sendToPrinterInChunks(logoBytes);
        }

        // Kembalikan rata kiri dan kirim teks struk.
        const prefix = new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x00]);
        await sendToPrinterInChunks(prefix);
        await sendToPrinterInChunks(new TextEncoder().encode(`${customReceiptText}\n\n\n`));

        updatePrinterStatus(`Terhubung: ${bluetoothDevice.name || 'Printer'}`, true);
        return true;
    } catch (error) {
        console.error('Gagal mencetak melalui Bluetooth.', error);
        updatePrinterStatus('Gagal mencetak melalui Bluetooth', false);
        alert(`Gagal print: ${error.message}`);
        return false;
    }
}

async function sendToPrinterInChunks(data) {
    if (!printCharacteristic) throw new Error('Printer belum terhubung.');

    const chunkSize = 120;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize);
        if (printCharacteristic.properties.writeWithoutResponse) {
            await printCharacteristic.writeValueWithoutResponse(chunk);
        } else {
            await printCharacteristic.writeValue(chunk);
        }
        // Sebagian printer murah kehilangan byte jika paket dikirim tanpa jeda.
        await new Promise(resolve => setTimeout(resolve, 15));
    }
}
