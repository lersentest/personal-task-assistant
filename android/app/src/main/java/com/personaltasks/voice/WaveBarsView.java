package com.personaltasks.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;

final class WaveBarsView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private long tick;
    private float level = 0.16f;

    WaveBarsView(Context context) {
        super(context);
    }

    void setLevel(float value) {
        float target = Math.max(0.06f, Math.min(1f, value));
        level = level * 0.72f + target * 0.28f;
        tick++;
        invalidate();
    }

    void nextFrame() {
        setLevel(level);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int bars = 36;
        float gap = Ui.dp(getContext(), 4);
        float barW = Math.max(Ui.dp(getContext(), 3), (getWidth() - gap * (bars - 1)) / bars);
        float mid = getHeight() / 2f;
        paint.setShader(new LinearGradient(0, 0, getWidth(), 0, Ui.PRIMARY, Ui.CYAN, Shader.TileMode.CLAMP));
        for (int i = 0; i < bars; i++) {
            float wave = (float) Math.abs(Math.sin((tick * 0.25f) + i * 0.42f));
            float local = 0.22f + wave * 0.55f + level * 0.55f;
            float bh = Ui.dp(getContext(), 8) + Math.min(1f, local) * (getHeight() - Ui.dp(getContext(), 12));
            float x = i * (barW + gap);
            paint.setAlpha(80 + (int) (Math.min(1f, local) * 155));
            canvas.drawRoundRect(new RectF(x, mid - bh / 2, x + barW, mid + bh / 2), barW, barW, paint);
        }
        paint.setAlpha(255);
        paint.setShader(null);
    }
}
