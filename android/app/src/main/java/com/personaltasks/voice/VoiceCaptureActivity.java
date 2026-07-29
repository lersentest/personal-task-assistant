package com.personaltasks.voice;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.media.AudioManager;
import android.media.MediaRecorder;
import android.media.ToneGenerator;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.ActivityCompat;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class VoiceCaptureActivity extends Activity {
    private enum State { IDLE, RECORDING, UPLOADING, PREVIEW, CONFIRMING, SUCCESS, ERROR, OFFLINE }

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private LinearLayout root;
    private LinearLayout content;
    private TextView title;
    private TextView subtitle;
    private TextView timer;
    private WaveBarsView wave;
    private TextView close;
    private Button primary;
    private Button secondary;
    private Button cancel;

    private MediaRecorder recorder;
    private File audioFile;
    private long startedAt;
    private String source;
    private String clientCommandId;
    private String previewKey;
    private String confirmKey;
    private String draftId;
    private JSONObject lastPreview;
    private boolean recording;
    private boolean pendingAutoStart;
    private State state = State.IDLE;

    private final Runnable timerTick = new Runnable() {
        @Override public void run() {
            if (!recording) return;
            timer.setText(formatDuration(System.currentTimeMillis() - startedAt));
            if (wave != null) wave.nextFrame();
            handler.postDelayed(this, 260);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        source = getIntent().getStringExtra(MainActivity.EXTRA_SOURCE);
        if (source == null && getIntent().getData() != null) source = "ANDROID_SIDE_BUTTON";
        if (source == null) source = "ANDROID_APP";
        pendingAutoStart = getIntent().getBooleanExtra(MainActivity.EXTRA_AUTO_START, true);
        drawBase();
        showIdle();
        if (pendingAutoStart) handler.postDelayed(this::startRecording, 280);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(timerTick);
        releaseRecorder(false);
        io.shutdownNow();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 10 && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            if (pendingAutoStart) startRecording();
        } else {
            showError("Нет доступа к микрофону");
        }
    }

    private void drawBase() {
        root = Ui.page(this);
        setContentView(root);

        LinearLayout header = Ui.row(this);
        LinearLayout headings = new LinearLayout(this);
        headings.setOrientation(LinearLayout.VERTICAL);
        title = Ui.title(this, "Голосовая задача");
        subtitle = Ui.subtitle(this, "Создадим задачу только после подтверждения");
        headings.addView(title);
        headings.addView(subtitle);
        header.addView(headings, Ui.matchWeight(1));

        close = Ui.iconButton(this, "×");
        close.setContentDescription("Закрыть");
        close.setOnClickListener(v -> cancelFlow());
        header.addView(close);
        root.addView(header, Ui.matchWrap());

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(content, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        primary = Ui.button(this, "", true);
        secondary = Ui.button(this, "", false);
        cancel = Ui.button(this, "Отменить", false);
        cancel.setOnClickListener(v -> cancelFlow());
    }

    private void showIdle() {
        state = State.IDLE;
        content.removeAllViews();
        title.setText("Новая задача");
        subtitle.setText("Нажмите и продиктуйте одну задачу");
        subtitle.setTextColor(Ui.MUTED);

        OrbView orb = new OrbView(this);
        orb.setOnClickListener(v -> startRecording());
        content.addView(orb, Ui.lp(Ui.dp(this, 230), Ui.dp(this, 230)));

        TextView cta = Ui.text(this, "Запишите задачу", 32, Ui.TEXT, Typeface.BOLD);
        cta.setGravity(Gravity.CENTER);
        content.addView(cta);
        Ui.margin(cta, 0, 22, 0, 0);

        TextView hint = Ui.subtitle(this, "Перед созданием покажем, что распознали.");
        hint.setGravity(Gravity.CENTER);
        content.addView(hint);
        Ui.margin(hint, 0, 4, 0, 26);

        primary.setText("Начать запись");
        primary.setOnClickListener(v -> startRecording());
        content.addView(primary, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showRecording() {
        state = State.RECORDING;
        content.removeAllViews();
        title.setText("Говорите…");
        subtitle.setText("● Запись   |   Задача записывается");
        subtitle.setTextColor(Ui.SUCCESS);

        OrbView orb = new OrbView(this);
        content.addView(orb, Ui.lp(Ui.dp(this, 238), Ui.dp(this, 238)));
        Ui.pulse(orb);

        timer = Ui.text(this, "00:00", 44, Ui.TEXT, Typeface.NORMAL);
        timer.setGravity(Gravity.CENTER);
        content.addView(timer);
        Ui.margin(timer, 0, 24, 0, 4);

        wave = new WaveBarsView(this);
        content.addView(wave, Ui.lp(ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(this, 42)));
        Ui.margin(wave, 44, 0, 44, 22);

        TextView hint = Ui.subtitle(this, "Когда закончите, нажмите «Завершить»");
        hint.setGravity(Gravity.CENTER);
        content.addView(hint);
        Ui.margin(hint, 0, 0, 0, 26);

        LinearLayout buttons = Ui.row(this);
        primary.setText("■  Завершить");
        primary.setOnClickListener(v -> stopAndPreview());
        secondary.setText("Отменить");
        secondary.setOnClickListener(v -> cancelFlow());
        buttons.addView(primary, Ui.matchWeight(1));
        buttons.addView(secondary, Ui.matchWeight(1));
        Ui.margin(secondary, 12, 0, 0, 0);
        content.addView(buttons, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showProcessing(String step) {
        state = State.UPLOADING;
        content.removeAllViews();
        title.setText("Обрабатываю");
        subtitle.setText("Секунду: превращаем голос в задачу");
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 24);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        OrbView orb = new OrbView(this);
        card.addView(orb, Ui.lp(Ui.dp(this, 150), Ui.dp(this, 150)));
        Ui.pulse(orb);
        TextView label = Ui.text(this, step, 24, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        card.addView(label);
        TextView details = Ui.subtitle(this, "Распознаём голос, выделяем дату, проект и приоритет.");
        details.setGravity(Gravity.CENTER);
        card.addView(details);
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 76, 0, 24);
    }

    private void showPreview(JSONObject p) {
        state = State.PREVIEW;
        lastPreview = p;
        AppPrefs.markSynced(this);
        content.removeAllViews();
        title.setText("Проверьте задачу");
        subtitle.setText("Создадим задачу только после подтверждения");
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout sheet = Ui.card(this, 18);
        addPreviewRow(sheet, "T", "Название", p.optString("title", "Новая задача"), null);
        JSONObject display = p.optJSONObject("display");
        addPreviewRow(sheet, "□", "Дата и время", display == null ? "" : display.optString("dueAt"), null);
        addPreviewRow(sheet, "⚑", "Приоритет", readablePriority(p.optString("priority")), readablePriority(p.optString("priority")));
        addPreviewRow(sheet, "▣", "Проект", valueOr(p.optString("projectName"), "Без проекта"), valueOr(p.optString("projectName"), "Нет"));
        addPreviewRow(sheet, "○", "Тип", readableType(p.optString("type")), null);
        String description = p.optString("description");
        if (description != null && !description.trim().isEmpty() && !"null".equalsIgnoreCase(description)) {
            addPreviewRow(sheet, "≡", "Описание", description, null);
        }
        content.addView(sheet, Ui.matchWrap());
        Ui.margin(sheet, 0, 32, 0, 22);

        primary.setText("✓  Создать задачу");
        primary.setOnClickListener(v -> confirm());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 12);

        secondary.setText("↻  Записать заново");
        secondary.setOnClickListener(v -> reRecord());
        content.addView(secondary, Ui.matchWrap());
        Ui.margin(secondary, 0, 0, 0, 12);

        cancel.setText("Отменить");
        content.addView(cancel, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showSuccess() {
        state = State.SUCCESS;
        content.removeAllViews();
        title.setText("Готово");
        subtitle.setText("Задача создана");
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 24);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        OrbView check = new OrbView(this);
        check.setSuccess(true);
        card.addView(check, Ui.lp(Ui.dp(this, 180), Ui.dp(this, 180)));
        TextView label = Ui.text(this, "Задача создана", 28, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        card.addView(label);
        if (lastPreview != null) {
            TextView task = Ui.subtitle(this, lastPreview.optString("title", ""));
            task.setGravity(Gravity.CENTER);
            card.addView(task);
        }
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 76, 0, 20);
        successSignal();
        handler.postDelayed(this::finish, 1700);
    }

    private void showOfflineSaved() {
        state = State.OFFLINE;
        content.removeAllViews();
        title.setText("Запись сохранена");
        subtitle.setText("Отправим, когда появится интернет");
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 22);
        card.addView(Ui.text(this, "Команда в очереди", 24, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Приложение попробует отправить её автоматически. После обработки появится уведомление с предпросмотром."));
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 70, 0, 22);

        primary.setText("Закрыть");
        primary.setOnClickListener(v -> finish());
        content.addView(primary, Ui.matchWrap());
    }

    private void showError(String message) {
        state = State.ERROR;
        content.removeAllViews();
        title.setText("Не получилось");
        subtitle.setText(humanError(message));
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 20);
        card.setBackground(Ui.round(this, 0xFFFFF1F2, Ui.dp(this, 22), 0xFFFECACA, 1));
        card.addView(Ui.text(this, "Попробуйте записать ещё раз", 22, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Говорите одной фразой: что сделать, когда и насколько срочно."));
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 50, 0, 20);

        primary.setText("Записать заново");
        primary.setOnClickListener(v -> startRecording());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 12);

        cancel.setText("Закрыть");
        content.addView(cancel, Ui.matchWrap());
    }

    private void startRecording() {
        pendingAutoStart = false;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingAutoStart = true;
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 10);
            return;
        }
        try {
            subtitle.setTextColor(Ui.MUTED);
            clientCommandId = UUID.randomUUID().toString();
            previewKey = UUID.randomUUID().toString();
            confirmKey = UUID.randomUUID().toString();
            draftId = null;
            lastPreview = null;
            audioFile = new File(getCacheDir(), "voice-" + clientCommandId + ".m4a");
            recorder = new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(96000);
            recorder.setOutputFile(audioFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            startedAt = System.currentTimeMillis();
            recording = true;
            showRecording();
            handler.post(timerTick);
        } catch (Exception e) {
            showError(e.getMessage());
        }
    }

    private void stopAndPreview() {
        handler.removeCallbacks(timerTick);
        releaseRecorder(true);
        long duration = System.currentTimeMillis() - startedAt;
        if (duration < 900) {
            showError("Запись слишком короткая");
            return;
        }
        final long previewDuration = Math.max(900, duration);
        showProcessing("Проверяем запись");
        if (!isOnline()) {
            saveOffline(previewDuration);
            return;
        }
        io.execute(() -> {
            try {
                ApiClient api = new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this));
                JSONObject response = api.preview(audioFile, clientCommandId, previewKey, source, previewDuration);
                draftId = response.optString("draftId", null);
                JSONObject p = response.getJSONObject("preview");
                runOnUiThread(() -> showPreview(p));
            } catch (Exception e) {
                runOnUiThread(() -> showError(e.getMessage()));
            }
        });
    }

    private void confirm() {
        if (draftId == null) return;
        showProcessing("Создаём задачу");
        state = State.CONFIRMING;
        io.execute(() -> {
            try {
                new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).confirm(draftId, confirmKey);
                runOnUiThread(this::showSuccess);
            } catch (Exception e) {
                runOnUiThread(() -> showError(e.getMessage()));
            }
        });
    }

    private void cancelFlow() {
        releaseRecorder(true);
        if (draftId == null) {
            finish();
            return;
        }
        io.execute(() -> {
            try {
                new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).cancel(draftId, UUID.randomUUID().toString());
            } catch (Exception ignored) {}
            runOnUiThread(this::finish);
        });
    }

    private void reRecord() {
        if (draftId != null) {
            io.execute(() -> {
                try {
                    new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).cancel(draftId, UUID.randomUUID().toString());
                } catch (Exception ignored) {}
                draftId = null;
                runOnUiThread(this::startRecording);
            });
        } else {
            startRecording();
        }
    }

    private void releaseRecorder(boolean stop) {
        if (recorder == null) return;
        handler.removeCallbacks(timerTick);
        if (stop) {
            try { recorder.stop(); } catch (Exception ignored) {}
        }
        try { recorder.release(); } catch (Exception ignored) {}
        recorder = null;
        recording = false;
    }

    private void saveOffline(long durationMs) {
        io.execute(() -> {
            VoiceCommandEntity item = new VoiceCommandEntity();
            item.clientCommandId = clientCommandId;
            item.idempotencyKey = previewKey;
            item.audioFilePath = audioFile.getAbsolutePath();
            item.mimeType = "audio/mp4";
            item.durationMs = durationMs;
            item.source = source;
            item.status = "WAITING_FOR_NETWORK";
            item.createdAt = System.currentTimeMillis();
            AppDatabase.get(this).voiceCommands().insert(item);
            Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
            OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(VoiceQueueWorker.class).setConstraints(constraints).build();
            WorkManager.getInstance(this).enqueue(work);
            runOnUiThread(this::showOfflineSaved);
        });
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo info = cm == null ? null : cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void successSignal() {
        if (AppPrefs.soundEnabled(this)) {
            new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70).startTone(ToneGenerator.TONE_PROP_ACK, 180);
        }
        if (!AppPrefs.vibrationEnabled(this)) return;
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (v != null) {
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(180, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(180);
        }
    }

    private void addPreviewRow(LinearLayout parent, String icon, String label, String value, String badge) {
        if (value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value) || "[]".equals(value)) return;
        LinearLayout row = Ui.row(this);
        row.setPadding(0, Ui.dp(this, 10), 0, Ui.dp(this, 10));

        TextView ico = Ui.text(this, icon, 24, Ui.PRIMARY, Typeface.BOLD);
        ico.setGravity(Gravity.CENTER);
        ico.setBackground(Ui.round(this, Ui.PRIMARY_SOFT, Ui.dp(this, 14), 0, 0));
        row.addView(ico, Ui.lp(Ui.dp(this, 56), Ui.dp(this, 56)));

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        texts.addView(Ui.subtitle(this, label));
        texts.addView(Ui.text(this, value, 18, Ui.TEXT, Typeface.BOLD));
        row.addView(texts, Ui.matchWeight(1));
        Ui.margin(texts, 16, 0, 0, 0);

        if (badge != null && !badge.equals(value)) {
            TextView b = Ui.chip(this, badge, Ui.PRIMARY, Ui.PRIMARY_SOFT);
            row.addView(b);
        }
        parent.addView(row, Ui.matchWrap());
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value) ? fallback : value;
    }

    private String readablePriority(String raw) {
        if (raw == null) return "Обычный";
        switch (raw.toUpperCase(Locale.ROOT)) {
            case "URGENT": return "Срочный";
            case "HIGH": return "Высокий";
            case "LOW": return "Низкий";
            default: return "Обычный";
        }
    }

    private String readableType(String raw) {
        if (raw == null) return "Задача";
        switch (raw.toUpperCase(Locale.ROOT)) {
            case "CALL": return "Звонок";
            case "MEETING": return "Встреча";
            case "IDEA": return "Идея";
            case "NOTE": return "Заметка";
            default: return "Задача";
        }
    }

    private String humanError(String raw) {
        if (raw == null) return "Попробуйте ещё раз";
        if (raw.contains("must describe one new task")) return "Команда должна описывать одну конкретную задачу";
        if (raw.contains("401") || raw.contains("Unauthorized")) return "Проверьте подключение устройства в настройках";
        if (raw.contains("timeout") || raw.contains("Unable to resolve")) return "Сервис временно недоступен";
        if (raw.contains("Нет доступа")) return raw;
        return "Не удалось распознать или создать задачу";
    }

    private String formatDuration(long ms) {
        long sec = ms / 1000;
        return String.format(Locale.US, "%02d:%02d", sec / 60, sec % 60);
    }

    @SuppressWarnings("unused")
    private String shortTime(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(ms));
    }
}
