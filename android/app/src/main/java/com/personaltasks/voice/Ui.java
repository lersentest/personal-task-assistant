package com.personaltasks.voice;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Ui {
    static final int BG = Color.rgb(248, 250, 252);
    static final int SURFACE = Color.WHITE;
    static final int PRIMARY = Color.rgb(37, 99, 235);
    static final int PRIMARY_SOFT = Color.rgb(219, 234, 254);
    static final int TEXT = Color.rgb(15, 23, 42);
    static final int MUTED = Color.rgb(100, 116, 139);
    static final int BORDER = Color.rgb(226, 232, 240);
    static final int DANGER = Color.rgb(220, 38, 38);
    static final int SUCCESS = Color.rgb(5, 150, 105);

    private Ui() {}

    static int dp(Context c, int value) {
        return Math.round(value * c.getResources().getDisplayMetrics().density);
    }

    static LinearLayout page(Context c) {
        LinearLayout root = new LinearLayout(c);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(c, 20), dp(c, 20), dp(c, 20), dp(c, 20));
        root.setBackgroundColor(BG);
        return root;
    }

    static ScrollView scrollPage(Context c, LinearLayout content) {
        ScrollView scroll = new ScrollView(c);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(BG);
        scroll.addView(content, new ScrollView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return scroll;
    }

    static LinearLayout row(Context c) {
        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        return row;
    }

    static TextView text(Context c, String value, int sp, int color, int style) {
        TextView tv = new TextView(c);
        tv.setText(value);
        tv.setTextSize(sp);
        tv.setTextColor(color);
        tv.setTypeface(Typeface.DEFAULT, style);
        tv.setIncludeFontPadding(true);
        return tv;
    }

    static TextView title(Context c, String value) {
        return text(c, value, 28, TEXT, Typeface.BOLD);
    }

    static TextView subtitle(Context c, String value) {
        TextView tv = text(c, value, 15, MUTED, Typeface.NORMAL);
        tv.setLineSpacing(dp(c, 2), 1f);
        return tv;
    }

    static TextView chip(Context c, String value, int fg, int bg) {
        TextView chip = text(c, value, 13, fg, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(c, 10), dp(c, 5), dp(c, 10), dp(c, 5));
        chip.setBackground(round(c, bg, dp(c, 999), 0, 0));
        return chip;
    }

    static LinearLayout card(Context c, int paddingDp) {
        LinearLayout card = new LinearLayout(c);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(c, paddingDp), dp(c, paddingDp), dp(c, paddingDp), dp(c, paddingDp));
        card.setBackground(round(c, SURFACE, dp(c, 24), BORDER, 1));
        if (Build.VERSION.SDK_INT >= 21) card.setElevation(dp(c, 2));
        return card;
    }

    static Button button(Context c, String label, boolean primary) {
        Button b = new Button(c);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setMinHeight(dp(c, 52));
        b.setTextColor(primary ? Color.WHITE : TEXT);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackground(round(c, primary ? PRIMARY : SURFACE, dp(c, 16), primary ? PRIMARY : BORDER, 1));
        b.setPadding(dp(c, 14), 0, dp(c, 14), 0);
        return b;
    }

    static TextView iconButton(Context c, String value) {
        TextView tv = text(c, value, 22, TEXT, Typeface.NORMAL);
        tv.setGravity(Gravity.CENTER);
        tv.setMinWidth(dp(c, 48));
        tv.setMinHeight(dp(c, 48));
        tv.setBackground(round(c, SURFACE, dp(c, 16), BORDER, 1));
        return tv;
    }

    static View spacer(Context c, int heightDp) {
        View v = new View(c);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(c, heightDp)));
        return v;
    }

    static LinearLayout.LayoutParams lp(int w, int h) {
        return new LinearLayout.LayoutParams(w, h);
    }

    static LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    }

    static LinearLayout.LayoutParams matchWeight(float weight) {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, weight);
    }

    static void margin(View view, int l, int t, int r, int b) {
        ViewGroup.LayoutParams raw = view.getLayoutParams();
        LinearLayout.LayoutParams lp = raw instanceof LinearLayout.LayoutParams
                ? (LinearLayout.LayoutParams) raw
                : matchWrap();
        Context c = view.getContext();
        lp.setMargins(dp(c, l), dp(c, t), dp(c, r), dp(c, b));
        view.setLayoutParams(lp);
    }

    static GradientDrawable round(Context c, int color, int radiusPx, int strokeColor, int strokeDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radiusPx);
        if (strokeDp > 0) d.setStroke(dp(c, strokeDp), strokeColor);
        return d;
    }

    static boolean animationsEnabled(Context c) {
        try {
            return Settings.Global.getFloat(c.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f;
        } catch (Exception ignored) {
            return true;
        }
    }

    static void pulse(View view) {
        if (!animationsEnabled(view.getContext())) return;
        ScaleAnimation scale = new ScaleAnimation(
                1f, 1.08f, 1f, 1.08f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f
        );
        scale.setDuration(820);
        scale.setRepeatMode(Animation.REVERSE);
        scale.setRepeatCount(Animation.INFINITE);
        view.startAnimation(scale);
    }

    static void fadeIn(View view) {
        if (!animationsEnabled(view.getContext())) return;
        AlphaAnimation anim = new AlphaAnimation(0f, 1f);
        anim.setDuration(220);
        view.startAnimation(anim);
    }
}
