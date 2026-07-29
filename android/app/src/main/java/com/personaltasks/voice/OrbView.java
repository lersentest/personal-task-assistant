package com.personaltasks.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;

final class OrbView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private boolean success;

    OrbView(Context context) {
        super(context);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    void setSuccess(boolean value) {
        success = value;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float w = getWidth();
        float h = getHeight();
        float cx = w / 2f;
        float cy = h / 2f;
        float r = Math.min(w, h) * 0.34f;

        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new RadialGradient(cx, cy, r * 1.7f,
                new int[]{0xB3FFFFFF, 0x66BFDBFE, 0x00FFFFFF},
                new float[]{0f, 0.55f, 1f}, Shader.TileMode.CLAMP));
        canvas.drawCircle(cx, cy, r * 1.7f, paint);

        paint.setShader(new LinearGradient(cx - r, cy - r, cx + r, cy + r,
                success ? 0xFF10B981 : 0xFF2563EB,
                success ? 0xFF67E8F9 : 0xFF22D3EE,
                Shader.TileMode.CLAMP));
        paint.setShadowLayer(Ui.dp(getContext(), 28), 0, Ui.dp(getContext(), 14), 0x663B82F6);
        canvas.drawCircle(cx, cy, r, paint);
        paint.clearShadowLayer();

        paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(Ui.dp(getContext(), 4));
        paint.setColor(0xCCFFFFFF);
        canvas.drawCircle(cx, cy, r - Ui.dp(getContext(), 8), paint);

        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setColor(Color.WHITE);
        paint.setStrokeWidth(Ui.dp(getContext(), 10));
        if (success) {
            canvas.drawLine(cx - r * 0.36f, cy, cx - r * 0.08f, cy + r * 0.26f, paint);
            canvas.drawLine(cx - r * 0.08f, cy + r * 0.26f, cx + r * 0.42f, cy - r * 0.32f, paint);
        } else {
            RectF mic = new RectF(cx - r * 0.20f, cy - r * 0.45f, cx + r * 0.20f, cy + r * 0.20f);
            paint.setStyle(Paint.Style.STROKE);
            canvas.drawRoundRect(mic, r * 0.20f, r * 0.20f, paint);
            canvas.drawArc(new RectF(cx - r * 0.42f, cy - r * 0.05f, cx + r * 0.42f, cy + r * 0.55f), 0, 180, false, paint);
            canvas.drawLine(cx, cy + r * 0.55f, cx, cy + r * 0.78f, paint);
            canvas.drawLine(cx - r * 0.24f, cy + r * 0.78f, cx + r * 0.24f, cy + r * 0.78f, paint);
        }
    }
}
