package com.personaltasks.voice;

import android.content.Context;
import android.content.SharedPreferences;

final class AppPrefs {
    private static final String NAME = "pta_voice_prefs";
    private static final String KEY_BASE_URL = "base_url";
    private static final String KEY_DEVICE_TOKEN = "device_token";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static String baseUrl(Context context) {
        return prefs(context).getString(KEY_BASE_URL, "https://personal-task-assistant-ruby.vercel.app");
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
}
