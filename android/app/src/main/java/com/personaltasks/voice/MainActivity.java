package com.personaltasks.voice;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    static final String EXTRA_SOURCE = "source";
    static final String EXTRA_AUTO_START = "autoStart";

    private TextView queueBanner;
    private TextView connectionChip;
    private TextView connectionText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        draw();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateConnection();
        updateQueueBanner();
    }

    private void draw() {
        LinearLayout root = Ui.page(this);
        setContentView(root);

        LinearLayout header = Ui.row(this);
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.addView(Ui.title(this, "Новая задача"));
        LinearLayout status = Ui.row(this);
        connectionChip = Ui.chip(this, "", Ui.SUCCESS, 0xFFE7F9F0);
        connectionText = Ui.subtitle(this, "");
        status.addView(connectionChip);
        status.addView(connectionText);
        Ui.margin(connectionText, 12, 0, 0, 0);
        titles.addView(status);
        Ui.margin(status, 0, 6, 0, 0);
        header.addView(titles, Ui.matchWeight(1));

        TextView settings = Ui.iconButton(this, "⚙");
        settings.setContentDescription("Открыть настройки");
        settings.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        header.addView(settings);
        root.addView(header, Ui.matchWrap());

        queueBanner = Ui.subtitle(this, "");
        queueBanner.setGravity(Gravity.CENTER);
        queueBanner.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        queueBanner.setBackground(Ui.round(this, 0xFFFFFBEB, Ui.dp(this, 16), 0xFFFCD34D, 1));
        root.addView(queueBanner, Ui.matchWrap());
        Ui.margin(queueBanner, 0, 18, 0, 0);

        LinearLayout center = new LinearLayout(this);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER);
        root.addView(center, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f
        ));

        OrbView mic = new OrbView(this);
        mic.setMode(OrbView.Mode.IDLE);
        mic.setContentDescription("Записать задачу голосом");
        mic.setOnClickListener(v -> openVoiceCapture("ANDROID_APP"));
        center.addView(mic, Ui.lp(Ui.dp(this, 238), Ui.dp(this, 238)));
        Ui.pulse(mic);

        TextView cta = Ui.text(this, "Запишите задачу", 32, Ui.TEXT, Typeface.BOLD);
        cta.setGravity(Gravity.CENTER);
        center.addView(cta);
        Ui.margin(cta, 0, 22, 0, 0);

        TextView hint = Ui.subtitle(this, "Нажмите и продиктуйте одну задачу.\nПеред созданием покажем, что распознали.");
        hint.setGravity(Gravity.CENTER);
        center.addView(hint);
        Ui.margin(hint, 0, 6, 0, 0);

        LinearLayout tip = Ui.glassCard(this, 20);
        tip.addView(Ui.section(this, "Пример"));
        TextView example = Ui.text(this, "«Позвонить Роме завтра в 10 утра, обычный приоритет»", 20, Ui.TEXT, Typeface.BOLD);
        tip.addView(example);
        Ui.margin(example, 0, 10, 0, 0);
        LinearLayout chips = Ui.row(this);
        chips.addView(Ui.chip(this, "Завтра в 10:00", Ui.PRIMARY, Ui.PRIMARY_SOFT));
        TextView priority = Ui.chip(this, "Обычный приоритет", Ui.PRIMARY, Ui.PRIMARY_SOFT);
        chips.addView(priority);
        Ui.margin(priority, 10, 0, 0, 0);
        tip.addView(chips);
        Ui.margin(chips, 0, 14, 0, 0);
        root.addView(tip, Ui.matchWrap());
        Ui.margin(tip, 0, 0, 0, 14);
    }

    private void openVoiceCapture(String source) {
        Intent intent = new Intent(this, VoiceCaptureActivity.class);
        intent.putExtra(EXTRA_SOURCE, source);
        intent.putExtra(EXTRA_AUTO_START, true);
        startActivity(intent);
    }

    private void updateConnection() {
        boolean connected = !AppPrefs.deviceToken(this).isEmpty();
        connectionChip.setText(connected ? "● Подключено" : "● Не подключено");
        connectionChip.setTextColor(connected ? Ui.SUCCESS : Ui.DANGER);
        connectionChip.setBackground(Ui.round(this, connected ? 0xFFE7F9F0 : 0xFFFFE4E6, Ui.dp(this, 999), 0, 0));
        connectionText.setText(connected ? "Устройство готово к записи" : "Откройте настройки");
    }

    private void updateQueueBanner() {
        new Thread(() -> {
            int count = AppDatabase.get(this).voiceCommands().pendingCount();
            runOnUiThread(() -> {
                if (count <= 0) {
                    queueBanner.setVisibility(android.view.View.GONE);
                } else {
                    queueBanner.setVisibility(android.view.View.VISIBLE);
                    queueBanner.setText("В очереди " + count + " голосов" + suffix(count) + ". Отправим, когда появится интернет.");
                }
            });
        }).start();
    }

    private String suffix(int count) {
        int mod10 = count % 10;
        int mod100 = count % 100;
        if (mod10 == 1 && mod100 != 11) return "ая команда";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ые команды";
        return "ых команд";
    }
}
