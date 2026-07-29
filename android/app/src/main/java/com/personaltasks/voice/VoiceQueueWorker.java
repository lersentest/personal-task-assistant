package com.personaltasks.voice;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.File;
import java.util.List;

public class VoiceQueueWorker extends Worker {
    public VoiceQueueWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        List<VoiceCommandEntity> items = AppDatabase.get(getApplicationContext()).voiceCommands().pendingPreview();
        ApiClient api = new ApiClient(AppPrefs.baseUrl(getApplicationContext()), AppPrefs.deviceToken(getApplicationContext()));
        for (VoiceCommandEntity item : items) {
            try {
                item.status = "UPLOADING";
                item.lastAttemptAt = System.currentTimeMillis();
                item.retryCount += 1;
                AppDatabase.get(getApplicationContext()).voiceCommands().update(item);
                JSONObject response = api.preview(new File(item.audioFilePath), item.clientCommandId, item.idempotencyKey, item.source, item.durationMs);
                item.draftId = response.optString("draftId", null);
                item.status = "READY_FOR_CONFIRMATION";
                item.lastErrorCode = null;
                AppDatabase.get(getApplicationContext()).voiceCommands().update(item);
                notifyPreviewReady();
            } catch (Exception e) {
                item.status = "WAITING_FOR_NETWORK";
                item.lastErrorCode = e.getClass().getSimpleName();
                AppDatabase.get(getApplicationContext()).voiceCommands().update(item);
                return Result.retry();
            }
        }
        return Result.success();
    }

    private void notifyPreviewReady() {
        NotificationManager manager = (NotificationManager) getApplicationContext().getSystemService(Context.NOTIFICATION_SERVICE);
        String channelId = "voice_preview";
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(channelId, "Голосовые задачи", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent intent = new Intent(getApplicationContext(), MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
                getApplicationContext(),
                1001,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        manager.notify(1001, new NotificationCompat.Builder(getApplicationContext(), channelId)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setContentTitle("Задача распознана")
                .setContentText("Откройте приложение и подтвердите создание.")
                .setContentIntent(pending)
                .setAutoCancel(true)
                .build());
    }
}
