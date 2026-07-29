package com.personaltasks.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

final class WaveBarsView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private long tick;

    WaveBarsView(Context context) {
        super(context);
    }

    void nextFrame() {
        tick++;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int bars = 28;
        float gap = Ui.dp(getContext(), 5);
        float barW = Math.max(3, (getWidth() - gap * (bars - 1)) / bars);
        float mid = getHeight() / 2f;
        paint.setColor(Ui.PRIMARY);
        for (int i = 0; i < bars; i++) {
            float phase = (tick + i * 1.7f) % 12;
            float amp = (float) (0.35f + 0.65f * Math.abs(Math.sin(phase)));
            float bh = Ui.dp(getContext(), 12) + amp * (getHeight() - Ui.dp(getContext(), 18));
            float x = i * (barW + gap);
            paint.setAlpha(90 + (int) (amp * 140));
            canvas.drawRoundRect(new RectF(x, mid - bh / 2, x + barW, mid + bh / 2), barW, barW, paint);
        }
        paint.setAlpha(255);
    }
}
