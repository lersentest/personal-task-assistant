package com.personaltasks.voice;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
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
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private LinearLayout root;
    private TextView status;
    private TextView preview;
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
    private boolean recording;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        source = getIntent().getStringExtra("source");
        if (source == null && getIntent().getData() != null) source = "ANDROID_SIDE_BUTTON";
        if (source == null) source = "ANDROID_APP";
        draw();
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 10);
        }
    }

    private void draw() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 48, 36, 36);
        setContentView(root);
        TextView title = new TextView(this);
        title.setText("Голосовая задача");
        title.setTextSize(24);
        title.setTypeface(null, 1);
        root.addView(title);

        status = new TextView(this);
        status.setText("Нажми запись и продиктуй одну задачу.");
        root.addView(status, matchWrap());

        preview = new TextView(this);
        preview.setTextSize(16);
        root.addView(preview, matchWrap());

        primary = new Button(this);
        primary.setText("Записать");
        root.addView(primary, matchWrap());
        primary.setOnClickListener(v -> {
            if (recording) stopAndPreview();
            else startRecording();
        });

        secondary = new Button(this);
        secondary.setText("Передиктовать");
        secondary.setEnabled(false);
        root.addView(secondary, matchWrap());
        secondary.setOnClickListener(v -> reRecord());

        cancel = new Button(this);
        cancel.setText("Отмена");
        root.addView(cancel, matchWrap());
        cancel.setOnClickListener(v -> cancelFlow());
    }

    private void startRecording() {
        try {
            clientCommandId = UUID.randomUUID().toString();
            previewKey = UUID.randomUUID().toString();
            confirmKey = UUID.randomUUID().toString();
            draftId = null;
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
            status.setText("Идёт запись. Нажми ещё раз, чтобы остановить.");
            primary.setText("Остановить");
            secondary.setEnabled(false);
            preview.setText("");
        } catch (Exception e) {
            toast("Не удалось начать запись: " + e.getMessage());
        }
    }

    private void stopAndPreview() {
        try {
            recorder.stop();
        } catch (Exception ignored) {
        }
        recorder.release();
        recorder = null;
        recording = false;
        primary.setEnabled(false);
        primary.setText("Распознаю...");
        long duration = Math.max(500, System.currentTimeMillis() - startedAt);
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
                runOnUiThread(() -> fail("Preview error: " + e.getMessage()));
            }
        });
    }

    private void showPreview(JSONObject p) {
        status.setText("Проверь задачу перед созданием.");
        JSONObject display = p.optJSONObject("display");
        preview.setText("Название: " + p.optString("title") + "\n"
                + "Проект: " + p.optString("projectName") + "\n"
                + "Срок: " + (display == null ? "Без срока" : display.optString("dueAt")) + "\n"
                + "Приоритет: " + p.optString("priority"));
        primary.setText("Создать задачу");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> confirm());
        secondary.setEnabled(true);
    }

    private void confirm() {
        if (draftId == null) return;
        primary.setEnabled(false);
        primary.setText("Создаю...");
        io.execute(() -> {
            try {
                new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).confirm(draftId, confirmKey);
                runOnUiThread(() -> {
                    successSignal();
                    Toast.makeText(this, "Задача создана", Toast.LENGTH_LONG).show();
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> fail("Confirm error: " + e.getMessage()));
            }
        });
    }

    private void cancelFlow() {
        if (draftId == null) {
            finish();
            return;
        }
        io.execute(() -> {
            try {
                new ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).cancel(draftId, UUID.randomUUID().toString());
            } catch (Exception ignored) {
            }
            runOnUiThread(this::finish);
        });
    }

    private void reRecord() {
        cancelFlow();
        startActivity(getIntent());
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
            runOnUiThread(() -> {
                status.setText("Интернета нет. Запись сохранена и отправится позже.");
                primary.setText("Закрыть");
                primary.setEnabled(true);
                primary.setOnClickListener(v -> finish());
            });
        });
    }

    private boolean isOnline() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo info = cm == null ? null : cm.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void successSignal() {
        new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70).startTone(ToneGenerator.TONE_PROP_ACK, 180);
        Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (v != null) {
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(180, VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(180);
        }
    }

    private void fail(String text) {
        status.setText(text);
        primary.setText("Записать заново");
        primary.setEnabled(true);
        primary.setOnClickListener(v -> startRecording());
        secondary.setEnabled(false);
    }

    private void toast(String value) {
        Toast.makeText(this, value, Toast.LENGTH_LONG).show();
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
}
