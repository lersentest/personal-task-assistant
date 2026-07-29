package com.personaltasks.voice;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private TextView queueBanner;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        draw();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateQueueBanner();
    }

    private void draw() {
        LinearLayout root = Ui.page(this);
        setContentView(root);

        LinearLayout header = Ui.row(this);
        header.setLayoutParams(Ui.matchWrap());
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        TextView title = Ui.text(this, "Новая задача", 25, Ui.TEXT, android.graphics.Typeface.BOLD);
        TextView subtitle = Ui.subtitle(this, AppPrefs.deviceToken(this).isEmpty() ? "Подключите устройство в настройках" : "Голосовое создание готово");
        titles.addView(title);
        titles.addView(subtitle);
        header.addView(titles, Ui.matchWeight(1));

        TextView settings = Ui.iconButton(this, "⚙");
        settings.setContentDescription("Открыть настройки");
        settings.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        header.addView(settings);
        root.addView(header);

        queueBanner = Ui.subtitle(this, "");
        queueBanner.setGravity(Gravity.CENTER);
        queueBanner.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        queueBanner.setBackground(Ui.round(this, Ui.PRIMARY_SOFT, Ui.dp(this, 16), 0, 0));
        root.addView(queueBanner, Ui.matchWrap());
        Ui.margin(queueBanner, 0, 20, 0, 8);

        LinearLayout center = new LinearLayout(this);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER);
        center.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        TextView mic = Ui.text(this, "🎙", 58, android.graphics.Color.WHITE, android.graphics.Typeface.NORMAL);
        mic.setGravity(Gravity.CENTER);
        mic.setContentDescription("Записать задачу голосом");
        mic.setMinWidth(Ui.dp(this, 156));
        mic.setMinHeight(Ui.dp(this, 156));
        mic.setBackground(Ui.round(this, Ui.PRIMARY, Ui.dp(this, 999), Ui.PRIMARY, 1));
        mic.setOnClickListener(v -> openVoiceCapture("ANDROID_APP"));
        center.addView(mic, new LinearLayout.LayoutParams(Ui.dp(this, 156), Ui.dp(this, 156)));

        TextView cta = Ui.text(this, "Записать задачу", 24, Ui.TEXT, android.graphics.Typeface.BOLD);
        cta.setGravity(Gravity.CENTER);
        center.addView(cta);
        Ui.margin(cta, 0, 22, 0, 0);

        TextView hint = Ui.subtitle(this, "Нажмите и продиктуйте одну задачу.\nПеред созданием покажем, что распознали.");
        hint.setGravity(Gravity.CENTER);
        center.addView(hint);
        Ui.margin(hint, 0, 8, 0, 0);

        root.addView(center);

        LinearLayout tip = Ui.card(this, 16);
        tip.addView(Ui.text(this, "Пример", 14, Ui.MUTED, android.graphics.Typeface.BOLD));
        tip.addView(Ui.text(this, "«Позвонить Роме завтра в 10 утра, обычный приоритет»", 16, Ui.TEXT, android.graphics.Typeface.NORMAL));
        root.addView(tip, Ui.matchWrap());
    }

    private void openVoiceCapture(String source) {
        Intent intent = new Intent(this, VoiceCaptureActivity.class);
        intent.putExtra("source", source);
        startActivity(intent);
    }

    private void updateQueueBanner() {
        new Thread(() -> {
            int count = AppDatabase.get(this).voiceCommands().pendingCount();
            runOnUiThread(() -> {
                if (count <= 0) {
                    queueBanner.setVisibility(android.view.View.GONE);
                } else {
                    queueBanner.setVisibility(android.view.View.VISIBLE);
                    queueBanner.setText(count + " команд" + suffix(count) + " ожида" + (count == 1 ? "ет" : "ют") + " отправки");
                }
            });
        }).start();
    }

    private String suffix(int count) {
        int mod10 = count % 10;
        int mod100 = count % 100;
        if (mod10 == 1 && mod100 != 11) return "а";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ы";
        return "";
    }
}
