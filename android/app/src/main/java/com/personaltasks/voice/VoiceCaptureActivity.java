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
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.io.File;
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
    private TextView mic;
    private TextView timer;
    private TextView status;
    private LinearLayout waveform;
    private LinearLayout previewCard;
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
    private State state = State.IDLE;

    private final Runnable timerTick = new Runnable() {
        @Override public void run() {
            if (!recording) return;
            timer.setText(formatDuration(System.currentTimeMillis() - startedAt));
            animateBars();
            handler.postDelayed(this, 500);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        source = getIntent().getStringExtra("source");
        if (source == null && getIntent().getData() != null) source = "ANDROID_SIDE_BUTTON";
        if (source == null) source = "ANDROID_APP";
        drawBase();
        showIdle();
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 10);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacks(timerTick);
        if (recorder != null) {
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
    }

    private void drawBase() {
        root = Ui.page(this);
        setContentView(root);

        LinearLayout header = Ui.row(this);
        header.setLayoutParams(Ui.matchWrap());
        LinearLayout headings = new LinearLayout(this);
        headings.setOrientation(LinearLayout.VERTICAL);
        title = Ui.title(this, "Голосовая задача");
        subtitle = Ui.subtitle(this, "Создайте одну задачу голосом");
        headings.addView(title);
        headings.addView(subtitle);
        header.addView(headings, Ui.matchWeight(1));

        TextView close = Ui.iconButton(this, "×");
        close.setContentDescription("Закрыть");
        close.setOnClickListener(v -> cancelFlow());
        header.addView(close);
        root.addView(header);
        root.addView(Ui.spacer(this, 18));

        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(content, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        primary = Ui.button(this, "Записать задачу", true);
        secondary = Ui.button(this, "Записать заново", false);
        cancel = Ui.button(this, "Отмена", false);
        cancel.setOnClickListener(v -> cancelFlow());
    }

    private void showIdle() {
        state = State.IDLE;
        content.removeAllViews();
        title.setText("Голосовая задача");
        subtitle.setText("Нажмите и продиктуйте одну задачу");

        mic = bigMic("🎙", Ui.PRIMARY);
        mic.setOnClickListener(v -> startRecording());
        content.addView(mic);

        TextView main = Ui.text(this, "Записать задачу", 26, Ui.TEXT, Typeface.BOLD);
        main.setGravity(Gravity.CENTER);
        content.addView(main);
        Ui.margin(main, 0, 22, 0, 0);

        TextView hint = Ui.subtitle(this, "Например: «купить хлеб сегодня до 18:00»");
        hint.setGravity(Gravity.CENTER);
        content.addView(hint);
        Ui.margin(hint, 0, 8, 0, 24);

        primary.setText("Начать запись");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> startRecording());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 10);

        cancel.setText("Отмена");
        content.addView(cancel, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showRecording() {
        state = State.RECORDING;
        content.removeAllViews();
        title.setText("Говорите…");
        subtitle.setText("Когда закончите, нажмите «Завершить»");

        mic = bigMic("●", Ui.DANGER);
        content.addView(mic);
        Ui.pulse(mic);

        timer = Ui.text(this, "00:00", 42, Ui.TEXT, Typeface.BOLD);
        timer.setGravity(Gravity.CENTER);
        content.addView(timer);
        Ui.margin(timer, 0, 18, 0, 12);

        waveform = waveform();
        content.addView(waveform, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(this, 52)));
        Ui.margin(waveform, 0, 0, 0, 26);

        primary.setText("Завершить");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> stopAndPreview());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 10);

        cancel.setText("Отменить");
        content.addView(cancel, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showProcessing(String step) {
        state = State.UPLOADING;
        content.removeAllViews();
        title.setText("Обработка записи");
        subtitle.setText("Секунду, превращаем голос в задачу");

        LinearLayout card = Ui.card(this, 24);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView icon = Ui.text(this, "↻", 48, Ui.PRIMARY, Typeface.BOLD);
        icon.setGravity(Gravity.CENTER);
        card.addView(icon);
        TextView label = Ui.text(this, step, 22, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        card.addView(label);
        TextView details = Ui.subtitle(this, "Отправляем запись · распознаём голос · формируем задачу");
        details.setGravity(Gravity.CENTER);
        card.addView(details);
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 80, 0, 24);

        secondary.setText("Отмена");
        secondary.setOnClickListener(v -> cancelFlow());
        content.addView(secondary, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showPreview(JSONObject p) {
        state = State.PREVIEW;
        lastPreview = p;
        content.removeAllViews();
        title.setText("Проверьте задачу");
        subtitle.setText("Задача будет создана только после подтверждения");

        previewCard = Ui.card(this, 20);
        String taskTitle = p.optString("title", "Новая задача");
        previewCard.addView(Ui.text(this, taskTitle, 24, Ui.TEXT, Typeface.BOLD));
        addField(previewCard, "Проект", p.optString("projectName"));
        JSONObject display = p.optJSONObject("display");
        addField(previewCard, "Срок", display == null ? "" : display.optString("dueAt"));
        addField(previewCard, "Приоритет", readablePriority(p.optString("priority")));
        addField(previewCard, "Тип", p.optString("type"));
        addField(previewCard, "Описание", p.optString("description"));
        content.addView(previewCard, Ui.matchWrap());
        Ui.margin(previewCard, 0, 0, 0, 18);

        primary.setText("Создать задачу");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> confirm());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 10);

        secondary.setText("Записать заново");
        secondary.setEnabled(true);
        secondary.setOnClickListener(v -> reRecord());
        content.addView(secondary, Ui.matchWrap());
        Ui.margin(secondary, 0, 0, 0, 10);

        cancel.setText("Отменить");
        content.addView(cancel, Ui.matchWrap());
        Ui.fadeIn(content);
    }

    private void showSuccess() {
        state = State.SUCCESS;
        content.removeAllViews();
        title.setText("Готово");
        subtitle.setText("Задача создана");

        LinearLayout card = Ui.card(this, 24);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView check = bigMic("✓", Ui.SUCCESS);
        card.addView(check);
        TextView label = Ui.text(this, "Задача создана", 25, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        card.addView(label);
        if (lastPreview != null) {
            TextView task = Ui.subtitle(this, lastPreview.optString("title", ""));
            task.setGravity(Gravity.CENTER);
            card.addView(task);
        }
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 70, 0, 20);
        successSignal();
        handler.postDelayed(this::finish, 1800);
    }

    private void showOfflineSaved() {
        state = State.OFFLINE;
        content.removeAllViews();
        title.setText("Запись сохранена");
        subtitle.setText("Отправим её, когда появится интернет");
        LinearLayout card = Ui.card(this, 22);
        card.addView(Ui.text(this, "Нет интернета", 22, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Команда сохранена в очереди. После восстановления связи появится уведомление с preview."));
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 60, 0, 20);
        primary.setText("Закрыть");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> finish());
        content.addView(primary, Ui.matchWrap());
    }

    private void showError(String message) {
        state = State.ERROR;
        content.removeAllViews();
        title.setText("Не получилось");
        subtitle.setText(humanError(message));

        LinearLayout card = Ui.card(this, 20);
        card.setBackground(Ui.round(this, 0xFFFFF1F2, Ui.dp(this, 22), 0xFFFECACA, 1));
        card.addView(Ui.text(this, "Попробуйте записать команду ещё раз", 20, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Говорите одной фразой: что сделать, когда и насколько срочно."));
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 30, 0, 18);

        primary.setText("Записать заново");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> startRecording());
        content.addView(primary, Ui.matchWrap());
        Ui.margin(primary, 0, 0, 0, 10);

        cancel.setText("Закрыть");
        content.addView(cancel, Ui.matchWrap());
    }

    private void startRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 10);
            return;
        }
        try {
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
        try { recorder.stop(); } catch (Exception ignored) {}
        try { recorder.release(); } catch (Exception ignored) {}
        recorder = null;
        recording = false;
        long duration = Math.max(500, System.currentTimeMillis() - startedAt);
        showProcessing("Отправляем запись");
        if (!isOnline()) {
            saveOffline(duration);
            return;
        }
        io.execute(() -> {
            try {
                ApiClient api = new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this));
                JSONObject response = api.preview(audioFile, clientCommandId, previewKey, source, duration);
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
        if (recording) {
            handler.removeCallbacks(timerTick);
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
            recording = false;
        }
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

    private TextView bigMic(String label, int color) {
        TextView tv = Ui.text(this, label, 58, android.graphics.Color.WHITE, Typeface.BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setMinWidth(Ui.dp(this, 150));
        tv.setMinHeight(Ui.dp(this, 150));
        tv.setBackground(Ui.round(this, color, Ui.dp(this, 999), color, 1));
        return tv;
    }

    private LinearLayout waveform() {
        LinearLayout row = Ui.row(this);
        row.setGravity(Gravity.CENTER);
        for (int i = 0; i < 7; i++) {
            TextView bar = new TextView(this);
            bar.setBackground(Ui.round(this, Ui.PRIMARY, Ui.dp(this, 999), 0, 0));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(Ui.dp(this, 8), Ui.dp(this, 18 + (i % 3) * 10));
            lp.setMargins(Ui.dp(this, 4), 0, Ui.dp(this, 4), 0);
            row.addView(bar, lp);
        }
        return row;
    }

    private void animateBars() {
        if (waveform == null || !Ui.animationsEnabled(this)) return;
        long tick = System.currentTimeMillis() / 250;
        for (int i = 0; i < waveform.getChildCount(); i++) {
            View bar = waveform.getChildAt(i);
            ViewGroup.LayoutParams lp = bar.getLayoutParams();
            lp.height = Ui.dp(this, 16 + (int) ((tick + i * 7) % 4) * 9);
            bar.setLayoutParams(lp);
        }
    }

    private void addField(LinearLayout card, String label, String value) {
        if (value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value) || "[]".equals(value)) return;
        LinearLayout row = Ui.row(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        TextView l = Ui.text(this, label, 13, Ui.MUTED, Typeface.BOLD);
        TextView v = Ui.text(this, value, 16, Ui.TEXT, Typeface.NORMAL);
        v.setGravity(Gravity.RIGHT);
        row.addView(l, Ui.matchWeight(0.8f));
        row.addView(v, Ui.matchWeight(1.2f));
        card.addView(row, Ui.matchWrap());
        Ui.margin(row, 0, 12, 0, 0);
    }

    private String readablePriority(String raw) {
        if (raw == null) return "";
        switch (raw.toUpperCase()) {
            case "URGENT": return "Срочный";
            case "HIGH": return "Высокий";
            case "LOW": return "Низкий";
            default: return "Обычный";
        }
    }

    private String humanError(String raw) {
        if (raw == null) return "Попробуйте ещё раз";
        if (raw.contains("must describe one new task")) return "Не удалось понять одну конкретную задачу";
        if (raw.contains("401") || raw.contains("Unauthorized")) return "Проверьте подключение устройства в настройках";
        if (raw.contains("timeout") || raw.contains("Unable to resolve")) return "Сервис временно недоступен";
        return "Не удалось распознать или создать задачу";
    }

    private String formatDuration(long ms) {
        long sec = ms / 1000;
        return String.format(java.util.Locale.US, "%02d:%02d", sec / 60, sec % 60);
    }
}
