// Transport ESC/POS: Android native memakai Bluetooth Classic SPP untuk RPP02N.
// Browser biasa tetap dapat memakai Web Bluetooth LE atau RawBT sebagai cadangan.

const PRINTER_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    '0000ff00-0000-1000-8000-00805f9b34fb'
];

let bluetoothDevice = null;
let printCharacteristic = null;
let nativePrinterConnected = false;
const nativePrinterRequests = new Map();

function notifyPrinter(message, type = 'error') {
    if (typeof window.showAppToast === 'function') window.showAppToast(message, type, 4500);
    else console.warn(message);
}

function getNativePrinterBridge() {
    try {
        return window.WarungScanNative || null;
    } catch (error) {
        return null;
    }
}

function isNativePrinterAvailable() {
    const bridge = getNativePrinterBridge();
    try {
        return Boolean(bridge?.isNativeApp?.() && bridge?.isBluetoothSupported?.());
    } catch (error) {
        return false;
    }
}

function isNativePrinterConnected() {
    const bridge = getNativePrinterBridge();
    try {
        return nativePrinterConnected || Boolean(bridge?.isPrinterConnected?.());
    } catch (error) {
        return nativePrinterConnected;
    }
}

function callNativePrinter(method, payload = '') {
    const bridge = getNativePrinterBridge();
    if (!bridge) return Promise.reject(new Error('Jembatan Android tidak tersedia.'));

    return new Promise((resolve, reject) => {
        const requestId = `printer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const timeout = setTimeout(() => {
            nativePrinterRequests.delete(requestId);
            reject(new Error('Printer tidak merespons. Pastikan RPP02N menyala dan sudah dipasangkan.'));
        }, 30000);

        nativePrinterRequests.set(requestId, { resolve, reject, timeout });
        try {
            if (method === 'connect') bridge.connectPrinter(requestId);
            else if (method === 'disconnect') bridge.disconnectPrinter(requestId);
            else if (method === 'print') bridge.printBase64(requestId, payload);
            else throw new Error('Perintah printer native tidak dikenal.');
        } catch (error) {
            clearTimeout(timeout);
            nativePrinterRequests.delete(requestId);
            reject(error);
        }
    });
}

window.__warungScanNativeResult = function nativePrinterResult(
    requestId,
    success,
    message,
    printerName
) {
    const pending = nativePrinterRequests.get(requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    nativePrinterRequests.delete(requestId);
    if (success) pending.resolve({ message, printerName });
    else pending.reject(new Error(message || 'Perintah printer gagal.'));
};

function concatenateBytes(parts) {
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;
    parts.forEach(part => {
        output.set(part, offset);
        offset += part.length;
    });
    return output;
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}

function updatePrinterStatus(message, connected = false) {
    const status = document.getElementById('status-printer');
    if (!status) return;

    status.textContent = message;
    status.classList.toggle('status-online', connected);
    status.classList.toggle('status-offline', !connected);
}

function handleBluetoothDisconnected() {
    printCharacteristic = null;
    nativePrinterConnected = false;
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
    if (isNativePrinterAvailable()) {
        try {
            updatePrinterStatus('Menghubungkan RPP02N…', false);
            const result = await callNativePrinter('connect');
            nativePrinterConnected = true;
            updatePrinterStatus(`Terhubung: ${result.printerName || 'RPP02N'}`, true);
            return true;
        } catch (error) {
            nativePrinterConnected = false;
            console.error('Gagal menghubungkan printer native.', error);
            updatePrinterStatus('RPP02N belum terhubung', false);
            notifyPrinter(`Gagal konek RPP02N: ${error.message}`);
            return false;
        }
    }

    if (!navigator.bluetooth) {
        notifyPrinter('Web Bluetooth tidak tersedia. Pilih Bluetooth Langsung RPP02N atau RawBT.');
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
        if (error.name !== 'NotFoundError') notifyPrinter(`Gagal konek Bluetooth: ${error.message}`);
        return false;
    }
}

async function disconnectBluetoothPrinter() {
    if (isNativePrinterAvailable()) {
        try {
            await callNativePrinter('disconnect');
        } catch (error) {
            console.debug('Printer native sudah terputus.', error);
        }
        nativePrinterConnected = false;
        updatePrinterStatus('RPP02N belum terhubung', false);
        return;
    }

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
    if (isNativePrinterAvailable()) {
        try {
            if (!isNativePrinterConnected()) {
                const connected = await connectBluetoothPrinter();
                if (!connected) return false;
            }

            const parts = [];
            if (logoBase64) {
                parts.push(new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x01]));
                const logoBytes = await generateLogoRaster(logoBase64);
                if (logoBytes.length) parts.push(logoBytes);
            }
            parts.push(new Uint8Array([0x1B, 0x40, 0x1B, 0x61, 0x00]));
            parts.push(new TextEncoder().encode(`${customReceiptText}\n\n\n`));

            const result = await callNativePrinter('print', bytesToBase64(concatenateBytes(parts)));
            nativePrinterConnected = true;
            updatePrinterStatus(`Terhubung: ${result.printerName || 'RPP02N'}`, true);
            return true;
        } catch (error) {
            nativePrinterConnected = false;
            console.error('Gagal mencetak melalui Android native.', error);
            updatePrinterStatus('Gagal mencetak ke RPP02N', false);
            notifyPrinter(`Gagal print: ${error.message}`);
            return false;
        }
    }

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
        notifyPrinter(`Gagal print: ${error.message}`);
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
