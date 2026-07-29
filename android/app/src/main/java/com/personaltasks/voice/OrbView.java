package com.personaltasks.voice;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;

final class OrbView extends View {
    enum Mode { IDLE, RECORDING, PROCESSING, SUCCESS, ERROR, OFFLINE }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private Mode mode = Mode.IDLE;
    private float phase;
    private float level = 0.18f;
    private ValueAnimator animator;

    OrbView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        if (Ui.animationsEnabled(context)) {
            animator = ValueAnimator.ofFloat(0f, 1f);
            animator.setDuration(4200);
            animator.setInterpolator(new LinearInterpolator());
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.addUpdateListener(a -> {
                phase = (float) a.getAnimatedValue();
                invalidate();
            });
            animator.start();
        }
    }

    void setSuccess(boolean value) {
        setMode(value ? Mode.SUCCESS : Mode.IDLE);
    }

    void setMode(Mode value) {
        mode = value == null ? Mode.IDLE : value;
        invalidate();
    }

    void setLevel(float value) {
        level = Math.max(0.05f, Math.min(1f, value));
        invalidate();
    }

    @Override
    protected void onDetachedFromWindow() {
        if (animator != null) animator.cancel();
        super.onDetachedFromWindow();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        float cx = w / 2f;
        float cy = h / 2f;
        float min = Math.min(w, h);
        float base = min * 0.31f;
        float breath = (float) Math.sin(phase * Math.PI * 2f) * (mode == Mode.RECORDING ? 0.045f : 0.025f);
        float r = base * (1f + breath + (mode == Mode.RECORDING ? level * 0.08f : 0f));

        int start = Ui.PRIMARY;
        int end = Ui.CYAN;
        int glow = 0x663B82F6;
        if (mode == Mode.SUCCESS) { start = Ui.SUCCESS; end = 0xFF67E8F9; glow = 0x6610B981; }
        if (mode == Mode.ERROR) { start = Ui.DANGER; end = 0xFFF472B6; glow = 0x66EF4444; }
        if (mode == Mode.OFFLINE) { start = Ui.WARNING; end = 0xFF60A5FA; glow = 0x66F59E0B; }

        drawAmbient(canvas, cx, cy, r, glow);
        drawRings(canvas, cx, cy, r, start);

        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r, start, end, Shader.TileMode.CLAMP));
        paint.setShadowLayer(Ui.dp(getContext(), 30), 0, Ui.dp(getContext(), 12), glow);
        canvas.drawCircle(cx, cy, r, paint);
        paint.clearShadowLayer();
        paint.setShader(null);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(Ui.dp(getContext(), 4));
        paint.setColor(0xD9FFFFFF);
        canvas.drawCircle(cx, cy, r - Ui.dp(getContext(), 9), paint);

        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setColor(Color.WHITE);
        paint.setStrokeWidth(Ui.dp(getContext(), 10));
        if (mode == Mode.SUCCESS) drawCheck(canvas, cx, cy, r);
        else if (mode == Mode.ERROR) drawError(canvas, cx, cy, r);
        else drawMic(canvas, cx, cy, r);
    }

    private void drawAmbient(Canvas canvas, float cx, float cy, float r, int glow) {
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx, cy, r * 2.25f,
                new int[]{0xB3FFFFFF, glow, 0x2260A5FA, 0x00FFFFFF},
                new float[]{0f, 0.35f, 0.66f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawCircle(cx, cy, r * 2.25f, paint);
        paint.setShader(null);
    }

    private void drawRings(Canvas canvas, float cx, float cy, float r, int color) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        for (int i = 0; i < 3; i++) {
            float rr = r * (1.28f + i * 0.26f + (mode == Mode.RECORDING ? level * 0.08f : 0f));
            paint.setStrokeWidth(Ui.dp(getContext(), i == 0 ? 3 : 2));
            paint.setColor((color & 0x00FFFFFF) | ((54 - i * 13) << 24));
            canvas.drawCircle(cx, cy, rr, paint);
        }
        if (mode == Mode.RECORDING || mode == Mode.PROCESSING) {
            paint.setStrokeWidth(Ui.dp(getContext(), 4));
            paint.setColor((color & 0x00FFFFFF) | 0xAA000000);
            float rr = r * 1.58f;
            float sweep = mode == Mode.PROCESSING ? 92 : 42 + level * 80;
            canvas.drawArc(new RectF(cx - rr, cy - rr, cx + rr, cy + rr), phase * 360f, sweep, false, paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(0xFF22D3EE);
            float a = (float) (phase * Math.PI * 2f);
            canvas.drawCircle(cx + (float)Math.cos(a) * rr, cy + (float)Math.sin(a) * rr, Ui.dp(getContext(), 4), paint);
        }
    }

    private void drawMic(Canvas canvas, float cx, float cy, float r) {
        RectF mic = new RectF(cx - r * 0.20f, cy - r * 0.45f, cx + r * 0.20f, cy + r * 0.20f);
        paint.setStyle(Paint.Style.STROKE);
        canvas.drawRoundRect(mic, r * 0.20f, r * 0.20f, paint);
        canvas.drawArc(new RectF(cx - r * 0.42f, cy - r * 0.05f, cx + r * 0.42f, cy + r * 0.55f), 0, 180, false, paint);
        canvas.drawLine(cx, cy + r * 0.55f, cx, cy + r * 0.78f, paint);
        canvas.drawLine(cx - r * 0.24f, cy + r * 0.78f, cx + r * 0.24f, cy + r * 0.78f, paint);
    }

    private void drawCheck(Canvas canvas, float cx, float cy, float r) {
        canvas.drawLine(cx - r * 0.36f, cy, cx - r * 0.08f, cy + r * 0.26f, paint);
        canvas.drawLine(cx - r * 0.08f, cy + r * 0.26f, cx + r * 0.42f, cy - r * 0.32f, paint);
    }

    private void drawError(Canvas canvas, float cx, float cy, float r) {
        canvas.drawLine(cx - r * 0.28f, cy - r * 0.28f, cx + r * 0.28f, cy + r * 0.28f, paint);
        canvas.drawLine(cx + r * 0.28f, cy - r * 0.28f, cx - r * 0.28f, cy + r * 0.28f, paint);
    }
}
