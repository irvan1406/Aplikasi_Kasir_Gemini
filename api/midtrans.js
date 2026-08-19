'use strict';

const crypto = require('node:crypto');

const MIDTRANS_SANDBOX_URL = 'https://api.sandbox.midtrans.com';
const MIDTRANS_PRODUCTION_URL = 'https://api.midtrans.com';
const DEFAULT_ALLOWED_ORIGIN = 'https://irvan1406.github.io';
const QRIS_EXPIRY_MINUTES = 15;
const MAX_QR_IMAGE_BYTES = 2 * 1024 * 1024;

class PublicError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'PublicError';
        this.statusCode = statusCode;
    }
}

function sendJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload));
}

function setSecurityHeaders(response) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
}

function getAllowedOrigins() {
    return String(process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGIN)
        .split(',')
        .map(origin => origin.trim().replace(/\/$/, ''))
        .filter(Boolean);
}

function applyCors(request, response) {
    const origin = String(request.headers.origin || '').replace(/\/$/, '');
    if (origin && !getAllowedOrigins().includes(origin)) return false;
    if (origin) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Warung-Token');
    response.setHeader('Access-Control-Max-Age', '600');
    return true;
}

function safeEqual(leftValue, rightValue) {
    const left = Buffer.from(String(leftValue || ''), 'utf8');
    const right = Buffer.from(String(rightValue || ''), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAppToken(request) {
    const expectedToken = String(process.env.WARUNGSCAN_APP_TOKEN || '').trim();
    if (!expectedToken) {
        throw new PublicError(503, 'WARUNGSCAN_APP_TOKEN belum diatur pada Environment Variables Vercel.');
    }
    const suppliedToken = String(request.headers['x-warung-token'] || '').trim();
    if (!safeEqual(suppliedToken, expectedToken)) {
        throw new PublicError(401, 'Token aplikasi tidak cocok. Periksa Token Aplikasi di pengaturan Warung Scan.');
    }
}

function getServerKey() {
    const key = String(process.env.MIDTRANS_SERVER_KEY || '').trim();
    if (!key) throw new PublicError(503, 'MIDTRANS_SERVER_KEY belum diatur pada Environment Variables Vercel.');
    return key;
}

function isProduction() {
    return String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true';
}

function getMidtransBaseUrl() {
    return isProduction() ? MIDTRANS_PRODUCTION_URL : MIDTRANS_SANDBOX_URL;
}

function readBody(request) {
    if (!request.body) return {};
    if (typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
    try {
        const rawBody = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body);
        return JSON.parse(rawBody);
    } catch (error) {
        throw new PublicError(400, 'Body JSON tidak valid.');
    }
}

function getRequestUrl(request) {
    const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'localhost');
    return new URL(request.url || '/', `https://${host}`);
}

function getPublicBackendUrl(request) {
    const configuredUrl = String(process.env.PUBLIC_BACKEND_URL || '').trim().replace(/\/+$/, '');
    if (configuredUrl) {
        let parsed;
        try {
            parsed = new URL(configuredUrl);
        } catch (error) {
            throw new PublicError(503, 'PUBLIC_BACKEND_URL tidak valid.');
        }
        if (parsed.protocol !== 'https:') throw new PublicError(503, 'PUBLIC_BACKEND_URL wajib memakai HTTPS.');
        return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }

    const host = String(request.headers['x-forwarded-host'] || request.headers.host || '').trim();
    if (!host) throw new PublicError(503, 'Alamat publik backend tidak dapat ditentukan.');
    return `https://${host}`;
}

function getWebhookUrl(request) {
    return `${getPublicBackendUrl(request)}/api/midtrans?action=webhook`;
}

function normalizeOrderId(value) {
    const orderId = String(value || '').trim();
    if (!/^[A-Za-z0-9_-]{8,50}$/.test(orderId)) {
        throw new PublicError(400, 'Order ID tidak valid.');
    }
    return orderId;
}

function normalizeAmount(value) {
    const amount = Number(value);
    const configuredMaximum = Number(process.env.MAX_TRANSACTION_AMOUNT) || 100000000;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > configuredMaximum) {
        throw new PublicError(400, `Total pembayaran harus Rp 1 sampai Rp ${configuredMaximum.toLocaleString('id-ID')}.`);
    }
    return amount;
}

function cleanText(value, maximumLength, fallback = '') {
    const cleaned = String(value || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (cleaned || fallback).slice(0, maximumLength);
}

function normalizeItems(items, grossAmount) {
    if (!Array.isArray(items) || !items.length) {
        return [{ id: 'WARUNGSCAN', name: 'Belanja Warung Scan', price: grossAmount, quantity: 1 }];
    }

    const normalized = items.slice(0, 49).map((item, index) => ({
        id: cleanText(item?.id, 50, `ITEM-${index + 1}`),
        name: cleanText(item?.name, 50, `Barang ${index + 1}`),
        price: Number(item?.price),
        quantity: Number(item?.quantity)
    })).filter(item => Number.isSafeInteger(item.price)
        && item.price > 0
        && Number.isSafeInteger(item.quantity)
        && item.quantity > 0
        && item.quantity <= 100000);

    const itemTotal = normalized.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (!normalized.length || itemTotal !== grossAmount) {
        return [{ id: 'WARUNGSCAN', name: 'Belanja Warung Scan', price: grossAmount, quantity: 1 }];
    }
    return normalized;
}

function midtransErrorMessage(payload, fallback) {
    const statusMessage = cleanText(payload?.status_message, 180);
    const validationMessages = Array.isArray(payload?.validation_messages)
        ? payload.validation_messages.map(message => cleanText(message, 120)).filter(Boolean).join(' ')
        : '';
    return statusMessage || validationMessages || fallback;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') throw new PublicError(504, 'Midtrans tidak merespons tepat waktu.');
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function midtransRequest(path, { method = 'GET', body = null, headers = {} } = {}) {
    const serverKey = getServerKey();
    const requestHeaders = {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
        ...headers
    };
    if (body !== null) requestHeaders['Content-Type'] = 'application/json';

    const response = await fetchWithTimeout(`${getMidtransBaseUrl()}${path}`, {
        method,
        headers: requestHeaders,
        body: body === null ? undefined : JSON.stringify(body),
        redirect: 'error'
    });
    const responseText = await response.text();
    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new PublicError(502, 'Respons Midtrans tidak dapat dibaca.');
    }
    if (!response.ok) {
        throw new PublicError(502, midtransErrorMessage(payload, `Midtrans merespons ${response.status}.`));
    }
    return payload;
}

async function verifyMidtransAccess() {
    const serverKey = getServerKey();
    const probeOrderId = `WS-HEALTHCHECK-${Date.now()}`;
    let response;
    try {
        response = await fetchWithTimeout(`${getMidtransBaseUrl()}/v2/${probeOrderId}/status`, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`
            },
            redirect: 'error'
        }, 12000);
    } catch (error) {
        if (error instanceof PublicError) throw error;
        throw new PublicError(502, 'Backend aktif, tetapi jaringan ke Midtrans gagal.');
    }

    const responseText = await response.text();
    let payload = {};
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        throw new PublicError(502, 'Respons pemeriksaan Midtrans tidak dapat dibaca.');
    }
    const midtransCode = String(payload.status_code || response.status);
    if (response.status === 401 || midtransCode === '401') {
        throw new PublicError(503, 'Server Key ditolak Midtrans. Pastikan key Sandbox/Production dan mode sudah sesuai.');
    }
    if (response.status === 404 || midtransCode === '404' || response.ok) return true;
    throw new PublicError(502, midtransErrorMessage(payload, `Pemeriksaan Midtrans merespons ${response.status}.`));
}

function isTrustedMidtransImageUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:'
            && (parsed.hostname === 'midtrans.com' || parsed.hostname.endsWith('.midtrans.com'));
    } catch (error) {
        return false;
    }
}

async function fetchQrImageDataUrl(qrUrl) {
    if (!isTrustedMidtransImageUrl(qrUrl)) {
        throw new PublicError(502, 'Midtrans tidak mengirim alamat gambar QR yang tepercaya.');
    }
    const authorization = `Basic ${Buffer.from(`${getServerKey()}:`).toString('base64')}`;
    const response = await fetchWithTimeout(qrUrl, {
        headers: { Accept: 'image/png', Authorization: authorization },
        redirect: 'error'
    });
    if (!response.ok) throw new PublicError(502, 'Gambar QRIS dari Midtrans gagal diambil.');
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/png')) throw new PublicError(502, 'Format gambar QRIS Midtrans tidak didukung.');
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    if (!imageBuffer.length || imageBuffer.length > MAX_QR_IMAGE_BYTES) {
        throw new PublicError(502, 'Ukuran gambar QRIS Midtrans tidak valid.');
    }
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

function normalizeStatus(payload) {
    const transactionStatus = String(payload?.transaction_status || '').toLowerCase();
    const fraudStatus = String(payload?.fraud_status || '').toLowerCase();
    const successfulStatus = transactionStatus === 'settlement' || transactionStatus === 'capture';
    const fraudAccepted = !fraudStatus || fraudStatus === 'accept';
    const isPaid = String(payload?.status_code || '') === '200' && successfulStatus && fraudAccepted;
    const finalStatuses = ['settlement', 'capture', 'expire', 'deny', 'cancel', 'failure', 'refund', 'partial_refund'];

    return {
        ok: true,
        order_id: String(payload?.order_id || ''),
        transaction_id: String(payload?.transaction_id || ''),
        transaction_status: transactionStatus,
        status_code: String(payload?.status_code || ''),
        fraud_status: fraudStatus,
        gross_amount: Number(payload?.gross_amount) || 0,
        currency: String(payload?.currency || 'IDR'),
        issuer: cleanText(payload?.issuer, 60),
        reference_id: cleanText(payload?.reference_id, 100),
        settlement_time: String(payload?.settlement_time || ''),
        expiry_time: String(payload?.expiry_time || ''),
        is_paid: isPaid,
        is_final: finalStatuses.includes(transactionStatus)
    };
}

async function handleHealth(request, response) {
    if (request.method !== 'GET') throw new PublicError(405, 'Gunakan metode GET untuk health check.');
    requireAppToken(request);
    await verifyMidtransAccess();
    sendJson(response, 200, {
        ok: true,
        service: 'Warung Scan Midtrans',
        environment: isProduction() ? 'production' : 'sandbox',
        webhook_url: getWebhookUrl(request),
        app_token_configured: true
    });
}

async function handleCreateQris(request, response) {
    if (request.method !== 'POST') throw new PublicError(405, 'Gunakan metode POST untuk membuat QRIS.');
    requireAppToken(request);
    const body = readBody(request);
    const orderId = normalizeOrderId(body.order_id);
    const grossAmount = normalizeAmount(body.gross_amount);
    const itemDetails = normalizeItems(body.items, grossAmount);
    const acquirer = cleanText(process.env.MIDTRANS_QRIS_ACQUIRER, 20, 'gopay').toLowerCase();

    const chargePayload = {
        payment_type: 'qris',
        transaction_details: { order_id: orderId, gross_amount: grossAmount },
        item_details: itemDetails,
        qris: { acquirer },
        custom_expiry: { expiry_duration: QRIS_EXPIRY_MINUTES, unit: 'minute' }
    };
    const charge = await midtransRequest('/v2/charge', {
        method: 'POST',
        body: chargePayload,
        headers: { 'X-Override-Notification': getWebhookUrl(request) }
    });
    if (String(charge.order_id || '') !== orderId || Number(charge.gross_amount) !== grossAmount) {
        throw new PublicError(502, 'Respons transaksi Midtrans tidak cocok dengan permintaan.');
    }

    const actions = Array.isArray(charge.actions) ? charge.actions : [];
    const qrAction = actions.find(action => action?.name === 'generate-qr-code')
        || actions.find(action => String(action?.method || '').toUpperCase() === 'GET' && /qr/i.test(String(action?.name || '')));
    const qrUrl = String(qrAction?.url || '');
    const qrImage = await fetchQrImageDataUrl(qrUrl);

    sendJson(response, 200, {
        ok: true,
        order_id: String(charge.order_id || orderId),
        transaction_id: String(charge.transaction_id || ''),
        transaction_status: String(charge.transaction_status || 'pending').toLowerCase(),
        status_code: String(charge.status_code || ''),
        gross_amount: Number(charge.gross_amount) || grossAmount,
        expiry_time: String(charge.expiry_time || new Date(Date.now() + QRIS_EXPIRY_MINUTES * 60000).toISOString()),
        qr_url: qrUrl,
        qr_image: qrImage
    });
}

async function getStatus(orderId) {
    const payload = await midtransRequest(`/v2/${encodeURIComponent(orderId)}/status`);
    return normalizeStatus(payload);
}

async function handleStatus(request, response) {
    if (request.method !== 'GET') throw new PublicError(405, 'Gunakan metode GET untuk memeriksa status.');
    requireAppToken(request);
    const orderId = normalizeOrderId(getRequestUrl(request).searchParams.get('order_id'));
    sendJson(response, 200, await getStatus(orderId));
}

async function handleExpire(request, response) {
    if (request.method !== 'POST') throw new PublicError(405, 'Gunakan metode POST untuk membatalkan QRIS.');
    requireAppToken(request);
    const orderId = normalizeOrderId(readBody(request).order_id);
    const payload = await midtransRequest(`/v2/${encodeURIComponent(orderId)}/expire`, { method: 'POST' });
    sendJson(response, 200, {
        ok: true,
        order_id: String(payload.order_id || orderId),
        transaction_status: String(payload.transaction_status || 'expire').toLowerCase(),
        status_code: String(payload.status_code || '')
    });
}

function verifyWebhookSignature(body) {
    const orderId = String(body?.order_id || '');
    const statusCode = String(body?.status_code || '');
    const grossAmount = String(body?.gross_amount || '');
    const suppliedSignature = String(body?.signature_key || '');
    if (!orderId || !statusCode || !grossAmount || !suppliedSignature) return false;
    const expectedSignature = crypto
        .createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}${getServerKey()}`)
        .digest('hex');
    return safeEqual(suppliedSignature.toLowerCase(), expectedSignature);
}

async function handleWebhook(request, response) {
    if (request.method !== 'POST') throw new PublicError(405, 'Gunakan metode POST untuk webhook.');
    const body = readBody(request);
    if (!verifyWebhookSignature(body)) throw new PublicError(401, 'Signature webhook Midtrans tidak valid.');
    const orderId = normalizeOrderId(body.order_id);

    // Jangan mempercayai status dari payload notifikasi saja. Status resmi dibaca ulang
    // langsung dari Midtrans; aplikasi HP kemudian mengambil status yang sama lewat polling.
    const verifiedStatus = await getStatus(orderId);
    sendJson(response, 200, {
        ok: true,
        received: true,
        order_id: verifiedStatus.order_id,
        transaction_status: verifiedStatus.transaction_status,
        is_paid: verifiedStatus.is_paid
    });
}

module.exports = async function midtransHandler(request, response) {
    setSecurityHeaders(response);
    if (!applyCors(request, response)) {
        sendJson(response, 403, { ok: false, message: 'Origin aplikasi tidak diizinkan.' });
        return;
    }
    if (request.method === 'OPTIONS') {
        response.statusCode = 204;
        response.end();
        return;
    }

    const action = getRequestUrl(request).searchParams.get('action') || 'health';
    try {
        if (action === 'health') await handleHealth(request, response);
        else if (action === 'create-qris') await handleCreateQris(request, response);
        else if (action === 'status') await handleStatus(request, response);
        else if (action === 'expire') await handleExpire(request, response);
        else if (action === 'webhook') await handleWebhook(request, response);
        else throw new PublicError(404, 'Aksi API tidak ditemukan.');
    } catch (error) {
        const statusCode = error instanceof PublicError ? error.statusCode : 500;
        const message = error instanceof PublicError ? error.message : 'Backend Midtrans mengalami kesalahan internal.';
        if (!(error instanceof PublicError)) {
            console.error('[Warung Scan Midtrans]', error?.name || 'Error', error?.message || 'Unknown error');
        }
        if (!response.headersSent) sendJson(response, statusCode, { ok: false, message });
        else if (!response.writableEnded) response.end();
    }
};
