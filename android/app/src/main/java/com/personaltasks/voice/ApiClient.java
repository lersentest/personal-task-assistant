package com.personaltasks.voice;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class ApiClient {
    private final String baseUrl;
    private final String token;

    public ApiClient(String baseUrl, String token) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.token = token;
    }

    public JSONObject preview(File audio, String clientCommandId, String idempotencyKey, String source, long durationMs) throws Exception {
        String boundary = "----pta-" + System.currentTimeMillis();
        HttpURLConnection c = open("/api/voice-command/preview");
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        try (OutputStream out = new BufferedOutputStream(c.getOutputStream())) {
            field(out, boundary, "clientCommandId", clientCommandId);
            field(out, boundary, "idempotencyKey", idempotencyKey);
            field(out, boundary, "source", source);
            field(out, boundary, "durationMs", String.valueOf(durationMs));
            out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Disposition: form-data; name=\"audio\"; filename=\"voice.m4a\"\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(("Content-Type: audio/mp4\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            try (FileInputStream in = new FileInputStream(audio)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }
        return readJson(c);
    }

    public JSONObject confirm(String draftId, String idempotencyKey) throws Exception {
        return postJson("/api/voice-command/confirm", new JSONObject()
                .put("draftId", draftId)
                .put("idempotencyKey", idempotencyKey));
    }

    public JSONObject cancel(String draftId, String idempotencyKey) throws Exception {
        return postJson("/api/voice-command/cancel", new JSONObject()
                .put("draftId", draftId)
                .put("idempotencyKey", idempotencyKey));
    }

    private JSONObject postJson(String path, JSONObject body) throws Exception {
        HttpURLConnection c = open(path);
        c.setRequestProperty("Content-Type", "application/json");
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream out = c.getOutputStream()) {
            out.write(bytes);
        }
        return readJson(c);
    }

    private HttpURLConnection open(String path) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(baseUrl + path).openConnection();
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setConnectTimeout(20_000);
        c.setReadTimeout(120_000);
        c.setRequestProperty("Authorization", "Bearer " + token);
        return c;
    }

    private void field(OutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write((value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private JSONObject readJson(HttpURLConnection c) throws Exception {
        int code = c.getResponseCode();
        try (BufferedInputStream in = new BufferedInputStream(code >= 400 ? c.getErrorStream() : c.getInputStream())) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) > 0) buffer.write(chunk, 0, n);
            byte[] bytes = buffer.toByteArray();
            String text = new String(bytes, StandardCharsets.UTF_8);
            if (code >= 400) throw new IOException(text);
            return new JSONObject(text);
        }
    }
}
