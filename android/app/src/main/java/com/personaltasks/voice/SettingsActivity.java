package com.personaltasks.voice;

import android.app.Activity;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SettingsActivity extends Activity {
    private EditText baseUrl;
    private EditText token;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = Ui.page(this);
        setContentView(Ui.scrollPage(this, root));

        LinearLayout header = Ui.row(this);
        TextView title = Ui.title(this, "Настройки");
        header.addView(title, Ui.matchWeight(1));
        TextView close = Ui.iconButton(this, "×");
        close.setContentDescription("Закрыть настройки");
        close.setOnClickListener(v -> finish());
        header.addView(close);
        root.addView(header, Ui.matchWrap());
        root.addView(Ui.spacer(this, 22));

        root.addView(generalCard(), Ui.matchWrap());
        root.addView(Ui.spacer(this, 18));
        root.addView(appearanceCard(), Ui.matchWrap());
        root.addView(Ui.spacer(this, 18));
        root.addView(connectionCard(), Ui.matchWrap());
        root.addView(Ui.spacer(this, 18));
        root.addView(aboutCard(), Ui.matchWrap());
        root.addView(Ui.spacer(this, 18));
        root.addView(developerCard(), Ui.matchWrap());
    }

    private LinearLayout generalCard() {
        LinearLayout card = Ui.card(this, 18);
        card.addView(Ui.section(this, "Общие"));

        Switch sound = switchRow("Звук", "Включить звуковые эффекты", AppPrefs.soundEnabled(this));
        Switch vibration = switchRow("Вибрация", "Короткая вибрация при ответе", AppPrefs.vibrationEnabled(this));
        sound.setOnCheckedChangeListener((buttonView, isChecked) -> AppPrefs.saveGeneral(this, isChecked, vibration.isChecked()));
        vibration.setOnCheckedChangeListener((buttonView, isChecked) -> AppPrefs.saveGeneral(this, sound.isChecked(), isChecked));
        card.addView(sound, Ui.matchWrap());
        card.addView(vibration, Ui.matchWrap());
        return card;
    }

    private LinearLayout appearanceCard() {
        LinearLayout card = Ui.card(this, 18);
        card.addView(Ui.section(this, "Внешний вид"));
        LinearLayout row = Ui.row(this);
        String active = AppPrefs.themeMode(this);
        row.addView(themeButton("Системная", "system", active), Ui.matchWeight(1));
        row.addView(themeButton("Светлая", "light", active), Ui.matchWeight(1));
        row.addView(themeButton("Тёмная", "dark", active), Ui.matchWeight(1));
        card.addView(row, Ui.matchWrap());
        Ui.margin(row, 0, 14, 0, 10);
        card.addView(Ui.subtitle(this, "Тема сохраняется локально. Полный dark-mode можно довести отдельным этапом."));
        return card;
    }

    private TextView themeButton(String label, String mode, String active) {
        boolean selected = mode.equals(active);
        TextView tv = Ui.text(this, selected ? label + " ✓" : label, 15, selected ? Ui.PRIMARY : Ui.TEXT, Typeface.BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(Ui.dp(this, 8), Ui.dp(this, 18), Ui.dp(this, 8), Ui.dp(this, 18));
        tv.setBackground(Ui.round(this, selected ? Ui.PRIMARY_SOFT : Ui.SURFACE_SOFT, Ui.dp(this, 18), selected ? Ui.PRIMARY : Ui.BORDER, 1));
        tv.setOnClickListener(v -> {
            AppPrefs.saveThemeMode(this, mode);
            recreate();
        });
        return tv;
    }

    private LinearLayout connectionCard() {
        LinearLayout card = Ui.card(this, 18);
        card.addView(Ui.section(this, "Подключение"));
        LinearLayout row = Ui.row(this);
        OrbView mic = new OrbView(this);
        row.addView(mic, Ui.lp(Ui.dp(this, 88), Ui.dp(this, 88)));

        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        boolean connected = !AppPrefs.deviceToken(this).isEmpty();
        info.addView(Ui.text(this, connected ? "Устройство готово к записи" : "Устройство не подключено", 18, Ui.TEXT, Typeface.BOLD));
        info.addView(Ui.chip(this, connected ? "Подключено" : "Не подключено", connected ? Ui.SUCCESS : Ui.DANGER, connected ? 0xFFD1FAE5 : 0xFFFFE4E6));
        info.addView(Ui.subtitle(this, "Последняя синхронизация: " + lastSyncText()));
        row.addView(info, Ui.matchWeight(1));
        Ui.margin(info, 16, 0, 0, 0);
        card.addView(row, Ui.matchWrap());
        return card;
    }

    private LinearLayout aboutCard() {
        LinearLayout card = Ui.card(this, 18);
        card.addView(Ui.section(this, "О приложении"));
        card.addView(Ui.text(this, "Голосовые задачи", 18, Ui.TEXT, Typeface.BOLD));
        card.addView(Ui.subtitle(this, "Версия 0.1.0\nТокен: " + AppPrefs.maskedToken(this)));
        return card;
    }

    private LinearLayout developerCard() {
        LinearLayout card = Ui.card(this, 18);
        card.addView(Ui.section(this, "Для разработчиков"));
        card.addView(Ui.subtitle(this, "Здесь можно заменить backend URL и mobile device token."));
        card.addView(Ui.spacer(this, 12));

        baseUrl = input("Backend URL");
        baseUrl.setText(AppPrefs.baseUrl(this));
        card.addView(baseUrl, Ui.matchWrap());
        Ui.margin(baseUrl, 0, 0, 0, 10);

        token = input("Mobile device token");
        token.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        token.setText(AppPrefs.deviceToken(this));
        card.addView(token, Ui.matchWrap());

        Button save = Ui.button(this, "Сохранить подключение", true);
        save.setOnClickListener(v -> {
            AppPrefs.save(this, baseUrl.getText().toString(), token.getText().toString());
            AppPrefs.markSynced(this);
            Toast.makeText(this, "Настройки сохранены", Toast.LENGTH_SHORT).show();
            recreate();
        });
        card.addView(save, Ui.matchWrap());
        Ui.margin(save, 0, 14, 0, 0);
        return card;
    }

    private Switch switchRow(String title, String description, boolean checked) {
        Switch sw = new Switch(this);
        sw.setText(title + "\n" + description);
        sw.setTextSize(16);
        sw.setTextColor(Ui.TEXT);
        sw.setChecked(checked);
        sw.setPadding(0, Ui.dp(this, 14), 0, Ui.dp(this, 14));
        return sw;
    }

    private EditText input(String hint) {
        EditText edit = new EditText(this);
        edit.setHint(hint);
        edit.setTextSize(16);
        edit.setSingleLine(true);
        edit.setMinHeight(Ui.dp(this, 56));
        edit.setPadding(Ui.dp(this, 14), 0, Ui.dp(this, 14), 0);
        edit.setBackground(Ui.round(this, Ui.SURFACE, Ui.dp(this, 16), Ui.BORDER, 1));
        return edit;
    }

    private String lastSyncText() {
        long value = AppPrefs.lastSyncAt(this);
        if (value <= 0) return "ещё не было";
        return new SimpleDateFormat("сегодня, HH:mm", Locale.getDefault()).format(new Date(value));
    }
}
