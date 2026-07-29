package com.personaltasks.voice;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class VoiceWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            Intent intent = new Intent(context, VoiceCaptureActivity.class);
            intent.putExtra(MainActivity.EXTRA_SOURCE, "ANDROID_WIDGET");
            intent.putExtra(MainActivity.EXTRA_AUTO_START, true);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                    context,
                    id,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.voice_widget);
            views.setOnClickPendingIntent(R.id.widget_root, pending);
            views.setOnClickPendingIntent(R.id.widget_mic, pending);
            manager.updateAppWidget(id, views);
        }
    }
}
