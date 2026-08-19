package com.warungscan.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String REMOTE_URL = "https://irvan1406.github.io/Aplikasi_Kasir_Gemini/";
    private static final String REMOTE_HOST = "irvan1406.github.io";
    private static final String LOCAL_URL = "file:///android_asset/www/index.html";
    private static final String TARGET_PRINTER_NAME = "RPP02N";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private static final int REQUEST_FILE_CHOOSER = 1001;
    private static final int REQUEST_ENABLE_BLUETOOTH = 1002;
    private static final int REQUEST_SAVE_FILE = 1003;
    private static final int REQUEST_CAMERA_PERMISSION = 2001;
    private static final int REQUEST_BLUETOOTH_PERMISSION = 2002;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private PermissionRequest pendingCameraRequest;
    private Runnable pendingBluetoothAction;
    private String pendingBluetoothRequestId;
    private byte[] pendingSaveData;
    private String pendingSaveMimeType;
    private String pendingSaveFilename;
    private boolean usingLocalFallback;

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket printerSocket;
    private OutputStream printerOutput;
    private String connectedPrinterName = TARGET_PRINTER_NAME;
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        bluetoothAdapter = bluetoothManager == null ? null : bluetoothManager.getAdapter();
        createWebView();
        loadRemotePage();
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void createWebView() {
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(getColorStateList(R.color.brand_primary));

        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        FrameLayout.LayoutParams progressLayout = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                Math.max(4, (int) (3 * getResources().getDisplayMetrics().density))
        );
        root.addView(progressBar, progressLayout);
        setContentView(root);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " WarungScan/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        webView.setBackgroundColor(Color.rgb(248, 250, 252));
        webView.addJavascriptInterface(new NativeBridge(), "WarungScanNative");
        webView.setWebViewClient(new WarungScanWebViewClient());
        webView.setWebChromeClient(new WarungScanChromeClient());
    }

    private void loadRemotePage() {
        usingLocalFallback = false;
        webView.loadUrl(REMOTE_URL + "?native=android&ts=" + System.currentTimeMillis());
    }

    private void loadLocalFallback() {
        if (usingLocalFallback) return;
        usingLocalFallback = true;
        Toast.makeText(this, "Mode offline: memakai data aplikasi bawaan", Toast.LENGTH_LONG).show();
        webView.loadUrl(LOCAL_URL);
    }

    private boolean isTrustedUri(Uri uri) {
        if (uri == null || uri.getScheme() == null) return false;
        if ("file".equalsIgnoreCase(uri.getScheme())) {
            return uri.toString().startsWith("file:///android_asset/www/");
        }
        return "https".equalsIgnoreCase(uri.getScheme())
                && REMOTE_HOST.equalsIgnoreCase(uri.getHost());
    }

    private void openExternalUri(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception error) {
            Toast.makeText(this, "Tidak ada aplikasi yang dapat membuka tautan ini", Toast.LENGTH_LONG).show();
        }
    }

    private final class WarungScanWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleNavigation(request.getUrl().toString());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleNavigation(url);
        }

        private boolean handleNavigation(String url) {
            if (url == null || url.isEmpty()) return false;
            if (url.startsWith("intent:")) {
                try {
                    Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    startActivity(intent);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "RawBT belum terpasang", Toast.LENGTH_LONG).show();
                }
                return true;
            }

            Uri uri = Uri.parse(url);
            if (isTrustedUri(uri) || "about".equalsIgnoreCase(uri.getScheme())
                    || "blob".equalsIgnoreCase(uri.getScheme())
                    || "data".equalsIgnoreCase(uri.getScheme())) {
                return false;
            }
            openExternalUri(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
            if (request.isForMainFrame() && !usingLocalFallback) loadLocalFallback();
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (request.isForMainFrame() && errorResponse.getStatusCode() >= 400 && !usingLocalFallback) {
                loadLocalFallback();
            }
        }
    }

    private final class WarungScanChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            progressBar.setProgress(newProgress);
            progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
        }

        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params
        ) {
            String currentUrl = view.getUrl();
            if (currentUrl == null || !isTrustedUri(Uri.parse(currentUrl))) {
                callback.onReceiveValue(null);
                return true;
            }
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = callback;

            Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.setType(resolveAcceptType(params.getAcceptTypes()));
            picker.putExtra(
                    Intent.EXTRA_ALLOW_MULTIPLE,
                    params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE
            );
            try {
                startActivityForResult(Intent.createChooser(picker, "Pilih foto atau file"), REQUEST_FILE_CHOOSER);
            } catch (Exception error) {
                fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = null;
                Toast.makeText(MainActivity.this, "Pemilih file tidak tersedia", Toast.LENGTH_LONG).show();
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> handleWebPermissionRequest(request));
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingCameraRequest == request) pendingCameraRequest = null;
        }
    }

    private String resolveAcceptType(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return "*/*";
        for (String acceptType : acceptTypes) {
            if (acceptType != null && acceptType.startsWith("image/")) return "image/*";
            if (acceptType != null && !acceptType.trim().isEmpty()) return acceptType;
        }
        return "*/*";
    }

    private void handleWebPermissionRequest(PermissionRequest request) {
        if (!isTrustedUri(request.getOrigin())) {
            request.deny();
            return;
        }

        boolean requestsCamera = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                requestsCamera = true;
                break;
            }
        }
        if (!requestsCamera) {
            request.deny();
            return;
        }

        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            if (pendingCameraRequest != null) pendingCameraRequest.deny();
            pendingCameraRequest = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, REQUEST_CAMERA_PERMISSION);
        }
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private void runWithBluetoothPermission(String requestId, Runnable action) {
        if (hasBluetoothPermission()) {
            action.run();
            return;
        }
        pendingBluetoothAction = action;
        pendingBluetoothRequestId = requestId;
        requestPermissions(
                new String[]{Manifest.permission.BLUETOOTH_CONNECT},
                REQUEST_BLUETOOTH_PERMISSION
        );
    }

    private void ensureBluetoothEnabled(String requestId, Runnable action) {
        if (bluetoothAdapter == null) {
            sendNativeResult(requestId, false, "Bluetooth tidak tersedia di HP ini", "");
            return;
        }
        if (bluetoothAdapter.isEnabled()) {
            action.run();
            return;
        }
        pendingBluetoothAction = action;
        pendingBluetoothRequestId = requestId;
        try {
            startActivityForResult(
                    new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),
                    REQUEST_ENABLE_BLUETOOTH
            );
        } catch (Exception error) {
            sendNativeResult(requestId, false, "Bluetooth gagal diaktifkan", "");
        }
    }

    private BluetoothDevice findTargetPrinter() throws Exception {
        Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();
        BluetoothDevice partialMatch = null;
        for (BluetoothDevice device : bondedDevices) {
            String name = device.getName();
            if (name == null) continue;
            if (TARGET_PRINTER_NAME.equalsIgnoreCase(name.trim())) return device;
            String upperName = name.toUpperCase(Locale.ROOT);
            if (upperName.contains(TARGET_PRINTER_NAME) || upperName.contains("RPP02")) {
                partialMatch = device;
            }
        }
        if (partialMatch != null) return partialMatch;
        throw new Exception("RPP02N belum dipasangkan di Pengaturan Bluetooth");
    }

    private synchronized String ensurePrinterSocket() throws Exception {
        if (printerSocket != null && printerSocket.isConnected() && printerOutput != null) {
            return connectedPrinterName;
        }

        closePrinterSocket();
        BluetoothDevice printer = findTargetPrinter();
        String printerName = printer.getName();
        Exception lastError = null;

        List<BluetoothSocket> candidates = new ArrayList<>();
        try {
            candidates.add(printer.createRfcommSocketToServiceRecord(SPP_UUID));
        } catch (Exception error) {
            lastError = error;
        }
        try {
            candidates.add(printer.createInsecureRfcommSocketToServiceRecord(SPP_UUID));
        } catch (Exception error) {
            lastError = error;
        }
        try {
            Method channelMethod = printer.getClass().getMethod("createRfcommSocket", int.class);
            Object reflectedSocket = channelMethod.invoke(printer, 1);
            if (reflectedSocket instanceof BluetoothSocket) candidates.add((BluetoothSocket) reflectedSocket);
        } catch (Exception error) {
            lastError = error;
        }

        for (BluetoothSocket candidate : candidates) {
            try {
                candidate.connect();
                printerSocket = candidate;
                printerOutput = candidate.getOutputStream();
                connectedPrinterName = printerName == null ? TARGET_PRINTER_NAME : printerName;
                return connectedPrinterName;
            } catch (Exception error) {
                lastError = error;
                try {
                    candidate.close();
                } catch (Exception ignored) {
                    // Kandidat berikutnya masih dapat dicoba.
                }
            }
        }
        throw new Exception(lastError == null ? "Koneksi SPP tidak tersedia" : lastError.getMessage());
    }

    private synchronized void closePrinterSocket() {
        try {
            if (printerOutput != null) printerOutput.close();
        } catch (Exception ignored) {
            // Socket tetap ditutup di bawah.
        }
        try {
            if (printerSocket != null) printerSocket.close();
        } catch (Exception ignored) {
            // Tidak ada tindakan tambahan saat socket sudah tertutup.
        }
        printerOutput = null;
        printerSocket = null;
    }

    private void connectPrinter(String requestId) {
        runWithBluetoothPermission(requestId, () -> ensureBluetoothEnabled(requestId, () ->
                ioExecutor.execute(() -> {
                    try {
                        String printerName = ensurePrinterSocket();
                        sendNativeResult(requestId, true, "Printer terhubung", printerName);
                    } catch (Exception error) {
                        sendNativeResult(requestId, false, safeMessage(error, "RPP02N gagal dihubungkan"), "");
                        if (safeMessage(error, "").contains("belum dipasangkan")) {
                            runOnUiThread(() -> {
                                Toast.makeText(
                                        MainActivity.this,
                                        "Pasangkan RPP02N terlebih dahulu, lalu kembali ke Warung Scan",
                                        Toast.LENGTH_LONG
                                ).show();
                                startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
                            });
                        }
                    }
                })
        ));
    }

    private void printToPrinter(String requestId, String base64Data) {
        runWithBluetoothPermission(requestId, () -> ensureBluetoothEnabled(requestId, () ->
                ioExecutor.execute(() -> {
                    try {
                        byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                        if (data.length == 0) throw new Exception("Data struk kosong");
                        String printerName = ensurePrinterSocket();
                        for (int offset = 0; offset < data.length; offset += 256) {
                            int count = Math.min(256, data.length - offset);
                            printerOutput.write(data, offset, count);
                            printerOutput.flush();
                            Thread.sleep(12);
                        }
                        sendNativeResult(requestId, true, "Struk berhasil dikirim", printerName);
                    } catch (Exception error) {
                        closePrinterSocket();
                        sendNativeResult(requestId, false, safeMessage(error, "Gagal mencetak ke RPP02N"), "");
                    }
                })
        ));
    }

    private String safeMessage(Exception error, String fallback) {
        String message = error == null ? null : error.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    private void sendNativeResult(
            String requestId,
            boolean success,
            String message,
            String printerName
    ) {
        String script = "window.__warungScanNativeResult&&window.__warungScanNativeResult("
                + JSONObject.quote(requestId) + ","
                + success + ","
                + JSONObject.quote(message == null ? "" : message) + ","
                + JSONObject.quote(printerName == null ? "" : printerName) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private void beginSaveFile(String filename, String mimeType, byte[] data) {
        pendingSaveFilename = filename == null || filename.trim().isEmpty() ? "warung-scan.dat" : filename;
        pendingSaveMimeType = mimeType == null || mimeType.trim().isEmpty()
                ? "application/octet-stream"
                : mimeType;
        pendingSaveData = data;

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(pendingSaveMimeType);
        intent.putExtra(Intent.EXTRA_TITLE, pendingSaveFilename);
        try {
            startActivityForResult(intent, REQUEST_SAVE_FILE);
        } catch (Exception error) {
            clearPendingSave();
            Toast.makeText(this, "Penyimpanan file tidak tersedia", Toast.LENGTH_LONG).show();
        }
    }

    private void savePendingFile(Uri destination) {
        byte[] data = pendingSaveData;
        String filename = pendingSaveFilename;
        clearPendingSave();
        if (destination == null || data == null) return;

        ioExecutor.execute(() -> {
            try (OutputStream output = getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new Exception("Lokasi penyimpanan tidak dapat dibuka");
                output.write(data);
                output.flush();
                runOnUiThread(() -> Toast.makeText(
                        MainActivity.this,
                        filename + " berhasil disimpan",
                        Toast.LENGTH_LONG
                ).show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(
                        MainActivity.this,
                        "File gagal disimpan: " + safeMessage(error, "kesalahan tidak diketahui"),
                        Toast.LENGTH_LONG
                ).show());
            }
        });
    }

    private void clearPendingSave() {
        pendingSaveData = null;
        pendingSaveMimeType = null;
        pendingSaveFilename = null;
    }

    private final class NativeBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public boolean isBluetoothSupported() {
            return bluetoothAdapter != null;
        }

        @JavascriptInterface
        public boolean isPrinterConnected() {
            return printerSocket != null && printerSocket.isConnected() && printerOutput != null;
        }

        @JavascriptInterface
        public void connectPrinter(String requestId) {
            runOnUiThread(() -> MainActivity.this.connectPrinter(requestId));
        }

        @JavascriptInterface
        public void disconnectPrinter(String requestId) {
            ioExecutor.execute(() -> {
                closePrinterSocket();
                sendNativeResult(requestId, true, "Printer diputus", "");
            });
        }

        @JavascriptInterface
        public void printBase64(String requestId, String base64Data) {
            runOnUiThread(() -> MainActivity.this.printToPrinter(requestId, base64Data));
        }

        @JavascriptInterface
        public void saveFileBase64(String filename, String mimeType, String base64Data) {
            try {
                byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                runOnUiThread(() -> beginSaveFile(filename, mimeType, data));
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(
                        MainActivity.this,
                        "Data file tidak valid",
                        Toast.LENGTH_LONG
                ).show());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_FILE_CHOOSER) {
            if (fileChooserCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null) {
                    result = new Uri[clipData.getItemCount()];
                    for (int index = 0; index < clipData.getItemCount(); index++) {
                        result[index] = clipData.getItemAt(index).getUri();
                    }
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
            return;
        }

        if (requestCode == REQUEST_ENABLE_BLUETOOTH) {
            Runnable action = pendingBluetoothAction;
            String requestId = pendingBluetoothRequestId;
            pendingBluetoothAction = null;
            pendingBluetoothRequestId = null;
            if (resultCode == RESULT_OK && action != null) action.run();
            else if (requestId != null) sendNativeResult(requestId, false, "Bluetooth tidak diaktifkan", "");
            return;
        }

        if (requestCode == REQUEST_SAVE_FILE) {
            if (resultCode == RESULT_OK && data != null) savePendingFile(data.getData());
            else clearPendingSave();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (requestCode == REQUEST_CAMERA_PERMISSION) {
            PermissionRequest request = pendingCameraRequest;
            pendingCameraRequest = null;
            if (request != null) {
                if (granted) request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                else request.deny();
            }
            return;
        }

        if (requestCode == REQUEST_BLUETOOTH_PERMISSION) {
            Runnable action = pendingBluetoothAction;
            String requestId = pendingBluetoothRequestId;
            pendingBluetoothAction = null;
            pendingBluetoothRequestId = null;
            if (granted && action != null) action.run();
            else if (requestId != null) {
                sendNativeResult(requestId, false, "Izin perangkat di sekitar ditolak", "");
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (pendingCameraRequest != null) pendingCameraRequest.deny();
        closePrinterSocket();
        ioExecutor.shutdownNow();
        if (webView != null) {
            webView.removeJavascriptInterface("WarungScanNative");
            webView.destroy();
        }
        super.onDestroy();
    }
}
