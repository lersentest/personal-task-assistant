package com.personaltasks.voice;

import android.content.Context;
import android.content.SharedPreferences;

final class AppPrefs {
    private static final String NAME = "pta_voice_prefs";
    private static final String KEY_BASE_URL = "base_url";
    private static final String KEY_DEVICE_TOKEN = "device_token";
    private static final String KEY_SOUND = "sound_enabled";
    private static final String KEY_VIBRATION = "vibration_enabled";
    private static final String DEFAULT_BASE_URL = "https://telegram-bot-production-056f.up.railway.app";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static String baseUrl(Context context) {
        return prefs(context).getString(KEY_BASE_URL, DEFAULT_BASE_URL);
    }

    static String deviceToken(Context context) {
        return prefs(context).getString(KEY_DEVICE_TOKEN, "");
    }

    static void save(Context context, String baseUrl, String token) {
        prefs(context).edit()
                .putString(KEY_BASE_URL, baseUrl.trim())
                .putString(KEY_DEVICE_TOKEN, token.trim())
                .apply();
    }

    static boolean soundEnabled(Context context) {
        return prefs(context).getBoolean(KEY_SOUND, true);
    }

    static boolean vibrationEnabled(Context context) {
        return prefs(context).getBoolean(KEY_VIBRATION, true);
    }

    static void saveGeneral(Context context, boolean sound, boolean vibration) {
        prefs(context).edit()
                .putBoolean(KEY_SOUND, sound)
                .putBoolean(KEY_VIBRATION, vibration)
                .apply();
    }

    static String maskedToken(Context context) {
        String token = deviceToken(context);
        if (token.length() < 14) return token.isEmpty() ? "Не подключено" : "••••";
        return token.substring(0, 8) + "…" + token.substring(token.length() - 6);
    }
}
