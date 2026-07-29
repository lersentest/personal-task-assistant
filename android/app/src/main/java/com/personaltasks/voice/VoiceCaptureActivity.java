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
    private OrbView currentOrb;
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
            float level = readRecorderLevel();
            if (wave != null) wave.setLevel(level);
            if (currentOrb != null) currentOrb.setLevel(level);
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
    }

    @Override
    public void onBackPressed() {
        if (state == State.UPLOADING || state == State.CONFIRMING) {
            Toast.makeText(this, "Дождитесь завершения обработки", Toast.LENGTH_SHORT).show();
            return;
        }
        cancelFlow();
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

    private void detachActionButtons() {
        detachFromParent(primary);
        detachFromParent(secondary);
        detachFromParent(cancel);
    }

    private void detachFromParent(View view) {
        if (view == null) return;
        if (view.getParent() instanceof ViewGroup) {
            ((ViewGroup) view.getParent()).removeView(view);
        }
    }

    private void showIdle() {
        state = State.IDLE;
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        title.setText("Новая задача");
        subtitle.setText(connectionLabel());
        subtitle.setTextColor(AppPrefs.deviceToken(this).isEmpty() ? Ui.DANGER : Ui.SUCCESS);

        OrbView orb = new OrbView(this);
        currentOrb = orb;
        orb.setMode(OrbView.Mode.IDLE);
        orb.setOnClickListener(v -> startRecording());
        content.addView(orb, Ui.lp(Ui.dp(this, 260), Ui.dp(this, 260)));
        Ui.pulse(orb);

        TextView cta = Ui.text(this, "Запишите задачу", 32, Ui.TEXT, Typeface.BOLD);
        cta.setGravity(Gravity.CENTER);
        content.addView(cta);
        Ui.margin(cta, 0, 22, 0, 0);

        TextView hint = Ui.subtitle(this, "Перед созданием покажем, что распознали.");
        hint.setGravity(Gravity.CENTER);
        content.addView(hint);
        Ui.margin(hint, 0, 4, 0, 0);
        Ui.fadeIn(content);
    }

    private void showRecording() {
        state = State.RECORDING;
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        title.setText("Говорите…");
        subtitle.setText("● Запись   |   Задача записывается");
        subtitle.setTextColor(Ui.SUCCESS);

        OrbView orb = new OrbView(this);
        currentOrb = orb;
        orb.setMode(OrbView.Mode.RECORDING);
        content.addView(orb, Ui.lp(Ui.dp(this, 280), Ui.dp(this, 280)));
        Ui.pulse(orb);

        timer = Ui.text(this, "00:00", 48, Ui.TEXT, Typeface.NORMAL);
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
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        title.setText("Обрабатываю");
        subtitle.setText("Секунду: превращаем голос в задачу");
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 24);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        OrbView orb = new OrbView(this);
        currentOrb = orb;
        orb.setMode(OrbView.Mode.PROCESSING);
        card.addView(orb, Ui.lp(Ui.dp(this, 150), Ui.dp(this, 150)));
        Ui.pulse(orb);
        TextView label = Ui.text(this, step, 24, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        card.addView(label);
        TextView details = Ui.subtitle(this, "Распознаём голос, выделяем дату, проект и приоритет.");
        details.setGravity(Gravity.CENTER);
        card.addView(details);
        addProcessingSteps(card, step);
        content.addView(card, Ui.matchWrap());
        Ui.margin(card, 0, 48, 0, 22);

        TextView wait = Ui.subtitle(this, "Не закрывайте экран, пока идёт распознавание.");
        wait.setGravity(Gravity.CENTER);
        content.addView(wait);
    }

    private void showPreview(JSONObject p) {
        state = State.PREVIEW;
        lastPreview = p;
        AppPrefs.markSynced(this);
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        title.setText("Проверьте задачу");
        subtitle.setText("Создадим задачу только после подтверждения");
        subtitle.setTextColor(Ui.MUTED);

        View topSpace = new View(this);
        content.addView(topSpace, new LinearLayout.LayoutParams(1, 0, 1f));

        LinearLayout sheet = Ui.glassCard(this, 18);
        LinearLayout handleRow = Ui.row(this);
        handleRow.setGravity(Gravity.CENTER);
        TextView handle = new TextView(this);
        handle.setMinHeight(Ui.dp(this, 5));
        handle.setBackground(Ui.round(this, 0xFFD6DEEF, Ui.dp(this, 99), 0, 0));
        handleRow.addView(handle, Ui.lp(Ui.dp(this, 74), Ui.dp(this, 5)));
        sheet.addView(handleRow, Ui.matchWrap());
        Ui.margin(handleRow, 0, 0, 0, 16);
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
        Ui.slideUp(sheet);
    }

    private void showSuccess() {
        state = State.SUCCESS;
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        title.setText("Готово");
        subtitle.setText("Задача создана");
        subtitle.setTextColor(Ui.MUTED);

        OrbView check = new OrbView(this);
        currentOrb = check;
        check.setSuccess(true);
        content.addView(check, Ui.lp(Ui.dp(this, 220), Ui.dp(this, 220)));
        TextView label = Ui.text(this, "Задача создана", 28, Ui.TEXT, Typeface.BOLD);
        label.setGravity(Gravity.CENTER);
        content.addView(label);
        Ui.margin(label, 0, 20, 0, 0);
        if (lastPreview != null) {
            TextView task = Ui.subtitle(this, lastPreview.optString("title", ""));
            task.setGravity(Gravity.CENTER);
            content.addView(task);
            Ui.margin(task, 0, 8, 0, 0);
        }
        successSignal();
        handler.postDelayed(this::finish, 1700);
    }

    private void showOfflineSaved() {
        state = State.OFFLINE;
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
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
        detachActionButtons();
        content.removeAllViews();
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        title.setText("Не получилось");
        subtitle.setText(humanError(message));
        subtitle.setTextColor(Ui.MUTED);

        LinearLayout card = Ui.card(this, 20);
        card.setBackground(Ui.round(this, Ui.isDark(this) ? 0xFF311827 : 0xFFFFF1F2, Ui.dp(this, 22), Ui.isDark(this) ? 0xFF7F1D1D : 0xFFFECACA, 1));
        card.addView(Ui.text(this, "Попробуйте записать ещё раз", 22, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Говорите одной фразой: что сделать, когда и насколько срочно."));
        TextView raw = Ui.subtitle(this, shortError(message));
        raw.setTextColor(Ui.DANGER);
        card.addView(raw);
        Ui.margin(raw, 0, 10, 0, 0);
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
        boolean stopped = releaseRecorder(true);
        long duration = System.currentTimeMillis() - startedAt;
        if (!stopped || audioFile == null || !audioFile.exists() || audioFile.length() < 1024) {
            showError("Запись не сохранилась. Проверьте доступ к микрофону и попробуйте ещё раз.");
            return;
        }
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
                draftId = extractDraftId(response);
                JSONObject p = extractPreview(response);
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
        if (state == State.UPLOADING || state == State.CONFIRMING) {
            Toast.makeText(this, "Дождитесь завершения обработки", Toast.LENGTH_SHORT).show();
            return;
        }
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

    private boolean releaseRecorder(boolean stop) {
        if (recorder == null) return true;
        handler.removeCallbacks(timerTick);
        boolean stopped = true;
        if (stop) {
            try { recorder.stop(); } catch (Exception ignored) { stopped = false; }
        }
        try { recorder.release(); } catch (Exception ignored) {}
        recorder = null;
        recording = false;
        return stopped;
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

    private void addProcessingSteps(LinearLayout parent, String currentStep) {
        parent.addView(Ui.spacer(this, 18));
        String[] steps = new String[]{"Сохраняем запись", "Отправляем", "Распознаём голос", "Формируем задачу"};
        int active = 2;
        if (currentStep != null && currentStep.contains("Созда")) active = 3;
        if (currentStep != null && currentStep.contains("Провер")) active = 2;
        for (int i = 0; i < steps.length; i++) {
            LinearLayout row = Ui.row(this);
            row.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 8));
            String marker = i < active ? "✓" : (i == active ? "●" : "○");
            int color = i < active ? Ui.SUCCESS : (i == active ? Ui.PRIMARY : 0xFFCBD5E1);
            TextView dot = Ui.smallIconButton(this, marker, color, i <= active ? 0xFFEFF6FF : 0xFFF8FAFC);
            row.addView(dot, Ui.lp(Ui.dp(this, 40), Ui.dp(this, 40)));
            TextView text = Ui.text(this, steps[i], 16, i <= active ? Ui.TEXT : Ui.MUTED, i == active ? Typeface.BOLD : Typeface.NORMAL);
            row.addView(text, Ui.matchWeight(1));
            Ui.margin(text, 12, 0, 0, 0);
            parent.addView(row, Ui.matchWrap());
        }
    }

    private float readRecorderLevel() {
        try {
            if (recorder == null) return 0.12f;
            int amp = recorder.getMaxAmplitude();
            if (amp <= 0) return 0.10f;
            return Math.min(1f, amp / 18000f);
        } catch (Exception ignored) {
            return 0.12f;
        }
    }

    private String valueOr(String value, String fallback) {
        return value == null || value.trim().isEmpty() || "null".equalsIgnoreCase(value) ? fallback : value;
    }

    private String connectionLabel() {
        if (AppPrefs.deviceToken(this).isEmpty()) {
            return "● Не подключено   |   Откройте настройки";
        }
        return "● Подключено   |   Устройство готово к записи";
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
        if (raw.contains("Запись слишком короткая")) return "Запись получилась слишком короткой";
        if (raw.contains("не сохранилась")) return "Android не сохранил аудиофайл";
        if (raw.contains("401") || raw.contains("Unauthorized")) return "Проверьте подключение устройства в настройках";
        if (raw.contains("timeout") || raw.contains("Unable to resolve")) return "Сервис временно недоступен";
        if (raw.contains("Нет доступа")) return raw;
        return "Не удалось распознать или создать задачу";
    }

    private String shortError(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "";
        String compact = raw.replace('\n', ' ').replace('\r', ' ').trim();
        if (compact.length() > 220) compact = compact.substring(0, 220) + "…";
        return compact;
    }

    private String extractDraftId(JSONObject response) {
        String id = response.optString("draftId", null);
        if (id != null && !id.trim().isEmpty() && !"null".equalsIgnoreCase(id)) return id;
        JSONObject data = response.optJSONObject("data");
        if (data != null) {
            id = data.optString("draftId", null);
            if (id != null && !id.trim().isEmpty() && !"null".equalsIgnoreCase(id)) return id;
        }
        return null;
    }

    private JSONObject extractPreview(JSONObject response) throws Exception {
        JSONObject preview = response.optJSONObject("preview");
        if (preview != null) return preview;
        JSONObject data = response.optJSONObject("data");
        if (data != null) {
            preview = data.optJSONObject("preview");
            if (preview != null) return preview;
        }
        return response;
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
