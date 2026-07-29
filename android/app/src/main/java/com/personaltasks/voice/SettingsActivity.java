package com.personaltasks.voice;

import android.app.Activity;
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

public class SettingsActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout root = Ui.page(this);
        setContentView(Ui.scrollPage(this, root));

        LinearLayout header = Ui.row(this);
        header.setLayoutParams(Ui.matchWrap());
        TextView title = Ui.title(this, "Настройки");
        header.addView(title, Ui.matchWeight(1));
        TextView close = Ui.iconButton(this, "×");
        close.setContentDescription("Закрыть настройки");
        close.setOnClickListener(v -> finish());
        header.addView(close);
        root.addView(header);

        TextView subtitle = Ui.subtitle(this, "Подключение устройства, звук, вибрация и технические параметры.");
        root.addView(subtitle);
        root.addView(Ui.spacer(this, 20));

        LinearLayout general = Ui.card(this, 18);
        general.addView(Ui.text(this, "Общие", 18, Ui.TEXT, android.graphics.Typeface.BOLD));
        general.addView(Ui.spacer(this, 10));

        Switch sound = new Switch(this);
        sound.setText("Звук после создания");
        sound.setTextSize(16);
        sound.setChecked(AppPrefs.soundEnabled(this));
        general.addView(sound, Ui.matchWrap());

        Switch vibration = new Switch(this);
        vibration.setText("Вибрация после создания");
        vibration.setTextSize(16);
        vibration.setChecked(AppPrefs.vibrationEnabled(this));
        general.addView(vibration, Ui.matchWrap());

        root.addView(general, Ui.matchWrap());
        Ui.margin(general, 0, 0, 0, 14);

        LinearLayout connection = Ui.card(this, 18);
        connection.addView(Ui.text(this, "Подключение", 18, Ui.TEXT, android.graphics.Typeface.BOLD));
        connection.addView(Ui.subtitle(this, "Токен хранится на устройстве. Полностью он показывается только в этом поле."));
        connection.addView(Ui.spacer(this, 12));

        TextView state = Ui.chip(this,
                AppPrefs.deviceToken(this).isEmpty() ? "Не подключено" : "Подключено",
                AppPrefs.deviceToken(this).isEmpty() ? Ui.DANGER : Ui.SUCCESS,
                AppPrefs.deviceToken(this).isEmpty() ? 0xFFFFE4E6 : 0xFFD1FAE5
        );
        state.setGravity(Gravity.CENTER);
        connection.addView(state, Ui.lp(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        connection.addView(Ui.spacer(this, 12));

        EditText baseUrl = input("Backend URL");
        baseUrl.setText(AppPrefs.baseUrl(this));
        connection.addView(baseUrl, Ui.matchWrap());
        Ui.margin(baseUrl, 0, 0, 0, 10);

        EditText token = input("Mobile device token");
        token.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        token.setText(AppPrefs.deviceToken(this));
        connection.addView(token, Ui.matchWrap());

        root.addView(connection, Ui.matchWrap());
        Ui.margin(connection, 0, 0, 0, 14);

        LinearLayout about = Ui.card(this, 18);
        about.addView(Ui.text(this, "О приложении", 18, Ui.TEXT, android.graphics.Typeface.BOLD));
        about.addView(Ui.subtitle(this, "Personal Voice Task · 0.1.0\nAPI: " + AppPrefs.baseUrl(this) + "\nToken: " + AppPrefs.maskedToken(this)));
        root.addView(about, Ui.matchWrap());
        Ui.margin(about, 0, 0, 0, 20);

        Button save = Ui.button(this, "Сохранить настройки", true);
        save.setOnClickListener(v -> {
            AppPrefs.save(this, baseUrl.getText().toString(), token.getText().toString());
            AppPrefs.saveGeneral(this, sound.isChecked(), vibration.isChecked());
            Toast.makeText(this, "Настройки сохранены", Toast.LENGTH_SHORT).show();
            finish();
        });
        root.addView(save, Ui.matchWrap());
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
}
