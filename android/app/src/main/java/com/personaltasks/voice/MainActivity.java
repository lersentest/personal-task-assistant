package com.personaltasks.voice;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(36, 48, 36, 36);
        setContentView(root);

        TextView title = new TextView(this);
        title.setText("Personal Voice Task");
        title.setTextSize(24);
        title.setTypeface(null, 1);
        root.addView(title);

        EditText baseUrl = new EditText(this);
        baseUrl.setHint("Backend URL");
        baseUrl.setText(AppPrefs.baseUrl(this));
        root.addView(baseUrl, matchWrap());

        EditText token = new EditText(this);
        token.setHint("Mobile device token");
        token.setText(AppPrefs.deviceToken(this));
        root.addView(token, matchWrap());

        Button save = new Button(this);
        save.setText("Сохранить настройки");
        root.addView(save, matchWrap());
        save.setOnClickListener(v -> AppPrefs.save(this, baseUrl.getText().toString(), token.getText().toString()));

        Button voice = new Button(this);
        voice.setText("Новая голосовая задача");
        root.addView(voice, matchWrap());
        voice.setOnClickListener(v -> {
            Intent intent = new Intent(this, VoiceCaptureActivity.class);
            intent.putExtra("source", "ANDROID_APP");
            startActivity(intent);
        });
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }
}
