package com.personaltasks.voice;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.os.Build;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.AnimationSet;
import android.view.animation.OvershootInterpolator;
import android.view.animation.ScaleAnimation;
import android.view.animation.TranslateAnimation;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Ui {
    static final int BG = Color.rgb(246, 248, 252);
    static final int SURFACE = Color.WHITE;
    static final int SURFACE_SOFT = Color.rgb(248, 251, 255);
    static final int PRIMARY = Color.rgb(37, 99, 235);
    static final int PRIMARY_2 = Color.rgb(59, 130, 246);
    static final int CYAN = Color.rgb(34, 211, 238);
    static final int PRIMARY_SOFT = Color.rgb(219, 234, 254);
    static final int TEXT = Color.rgb(11, 23, 57);
    static final int MUTED = Color.rgb(100, 116, 139);
    static final int BORDER = Color.rgb(230, 236, 245);
    static final int DANGER = Color.rgb(239, 68, 68);
    static final int SUCCESS = Color.rgb(16, 185, 129);
    static final int WARNING = Color.rgb(245, 158, 11);

    private Ui() {}

    static int dp(Context c, int value) {
        return Math.round(value * c.getResources().getDisplayMetrics().density);
    }

    static LinearLayout page(Context c) {
        LinearLayout root = new LinearLayout(c);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setClipToPadding(false);
        root.setPadding(dp(c, 24), dp(c, 50), dp(c, 24), dp(c, 28));
        root.setBackground(pageBackground(c));
        return root;
    }

    static ScrollView scrollPage(Context c, LinearLayout content) {
        ScrollView scroll = new ScrollView(c);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        scroll.setBackground(pageBackground(c));
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
        TextView tv = text(c, value, 34, TEXT, Typeface.BOLD);
        tv.setLetterSpacing(-0.02f);
        return tv;
    }

    static TextView subtitle(Context c, String value) {
        TextView tv = text(c, value, 16, MUTED, Typeface.NORMAL);
        tv.setLineSpacing(dp(c, 3), 1f);
        return tv;
    }

    static TextView section(Context c, String value) {
        TextView tv = text(c, value.toUpperCase(), 13, PRIMARY, Typeface.BOLD);
        tv.setLetterSpacing(0.08f);
        return tv;
    }

    static TextView chip(Context c, String value, int fg, int bg) {
        TextView chip = text(c, value, 14, fg, Typeface.BOLD);
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(c, 12), dp(c, 6), dp(c, 12), dp(c, 6));
        chip.setBackground(round(c, bg, dp(c, 999), 0, 0));
        return chip;
    }

    static TextView statusDot(Context c, String value, boolean ok) {
        return chip(c, (ok ? "● " : "● ") + value, ok ? SUCCESS : DANGER, ok ? 0xFFE7F9F0 : 0xFFFFE4E6);
    }

    static LinearLayout card(Context c, int paddingDp) {
        LinearLayout card = new LinearLayout(c);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(c, paddingDp), dp(c, paddingDp), dp(c, paddingDp), dp(c, paddingDp));
        card.setBackground(cardBackground(c, dp(c, 28)));
        if (Build.VERSION.SDK_INT >= 21) {
            card.setElevation(dp(c, 7));
            card.setTranslationZ(dp(c, 1));
        }
        return card;
    }

    static LinearLayout glassCard(Context c, int paddingDp) {
        LinearLayout card = card(c, paddingDp);
        card.setBackground(round(c, 0xF4FFFFFF, dp(c, 30), BORDER, 1));
        return card;
    }

    static Button button(Context c, String label, boolean primary) {
        Button b = new Button(c);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(17);
        b.setMinHeight(dp(c, 58));
        b.setTextColor(primary ? Color.WHITE : PRIMARY);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackground(primary ? gradient(c, PRIMARY, CYAN, dp(c, 20)) : round(c, 0xF4F8FBFF, dp(c, 20), BORDER, 1));
        b.setPadding(dp(c, 16), 0, dp(c, 16), 0);
        if (Build.VERSION.SDK_INT >= 21) b.setElevation(primary ? dp(c, 7) : dp(c, 3));
        addPressScale(b);
        return b;
    }

    static TextView iconButton(Context c, String value) {
        TextView tv = text(c, value, 28, TEXT, Typeface.NORMAL);
        tv.setGravity(Gravity.CENTER);
        tv.setMinWidth(dp(c, 58));
        tv.setMinHeight(dp(c, 58));
        tv.setBackground(round(c, 0xF8FFFFFF, dp(c, 999), BORDER, 1));
        if (Build.VERSION.SDK_INT >= 21) tv.setElevation(dp(c, 6));
        addPressScale(tv);
        return tv;
    }

    static TextView smallIconButton(Context c, String value, int color, int bg) {
        TextView tv = text(c, value, 20, color, Typeface.BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setMinWidth(dp(c, 44));
        tv.setMinHeight(dp(c, 44));
        tv.setBackground(round(c, bg, dp(c, 16), BORDER, 1));
        if (Build.VERSION.SDK_INT >= 21) tv.setElevation(dp(c, 3));
        addPressScale(tv);
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

    static GradientDrawable gradient(Context c, int start, int end, int radiusPx) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[]{start, PRIMARY_2, end});
        d.setCornerRadius(radiusPx);
        return d;
    }

    static GradientDrawable verticalGradient(Context c, int start, int end, int radiusPx) {
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{start, end});
        d.setCornerRadius(radiusPx);
        return d;
    }

    static GradientDrawable pageBackground(Context c) {
        return new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{0xFFFFFFFF, BG, 0xFFEFF5FF});
    }

    static LayerDrawable cardBackground(Context c, int radiusPx) {
        GradientDrawable shadow = round(c, 0x180B1739, radiusPx, 0, 0);
        GradientDrawable surface = round(c, 0xF8FFFFFF, radiusPx, BORDER, 1);
        LayerDrawable layer = new LayerDrawable(new android.graphics.drawable.Drawable[]{shadow, surface});
        layer.setLayerInset(0, 0, dp(c, 3), 0, 0);
        layer.setLayerInset(1, 0, 0, 0, dp(c, 3));
        return layer;
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
                1f, 1.045f, 1f, 1.045f,
                Animation.RELATIVE_TO_SELF, 0.5f,
                Animation.RELATIVE_TO_SELF, 0.5f
        );
        scale.setDuration(1400);
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

    static void slideUp(View view) {
        if (!animationsEnabled(view.getContext())) return;
        AlphaAnimation alpha = new AlphaAnimation(0f, 1f);
        alpha.setDuration(220);
        TranslateAnimation move = new TranslateAnimation(0, 0, dp(view.getContext(), 24), 0);
        move.setDuration(260);
        move.setInterpolator(new OvershootInterpolator(0.7f));
        AnimationSet set = new AnimationSet(true);
        set.addAnimation(alpha);
        set.addAnimation(move);
        view.startAnimation(set);
    }

    static void addPressScale(View view) {
        view.setOnTouchListener((v, event) -> {
            if (!animationsEnabled(v.getContext())) return false;
            switch (event.getActionMasked()) {
                case android.view.MotionEvent.ACTION_DOWN:
                    v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(80).start();
                    break;
                case android.view.MotionEvent.ACTION_UP:
                case android.view.MotionEvent.ACTION_CANCEL:
                    v.animate().scaleX(1f).scaleY(1f).setDuration(120).start();
                    break;
            }
            return false;
        });
    }
}
