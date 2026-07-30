package com.personaltasks.voice

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object Vd {
    var dark = false
    val ink get() = if (dark) Color(0xFFEAF1FF) else Color(0xFF07152F)
    val muted get() = if (dark) Color(0xFF9CA9BE) else Color(0xFF738198)
    val blue = Color(0xFF1F78FF)
    val cyan = Color(0xFF20D6F7)
    val green = Color(0xFF16C784)
    val red = Color(0xFFFF426B)
    val line get() = if (dark) Color(0xFF243149) else Color(0xFFE3E9F5)
    val panel get() = if (dark) Color(0xF51A2538) else Color(0xF5FFFFFF)
    val surface get() = if (dark) Color(0xFF10192A) else Color(0xFFF9FBFF)
    val surface2 get() = if (dark) Color(0xFF07101F) else Color(0xFFEFF6FF)
    val control get() = if (dark) Color(0xE6223046) else Color.White.copy(alpha = .84f)
    val border get() = if (dark) Color(0x334F6B95) else Color.White.copy(alpha = .88f)
}

@Composable
fun VoicePage(modifier: Modifier = Modifier, scroll: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val context = LocalContext.current
    val systemDark = isSystemInDarkTheme()
    Vd.dark = when (AppPrefs.themeMode(context)) {
        "dark" -> true
        "light" -> false
        else -> systemDark
    }
    val safe = WindowInsets.safeDrawing.asPaddingValues()
    Box(modifier.fillMaxSize()) {
        VoiceBackgroundCanvas()
        val base = Modifier
            .fillMaxSize()
            .padding(
                start = 24.dp,
                end = 24.dp,
                top = safe.calculateTopPadding() + 18.dp,
                bottom = safe.calculateBottomPadding() + 18.dp
            )
        if (scroll) Column(base.verticalScroll(rememberScrollState()), content = content) else Column(base, content = content)
    }
}

@Composable
fun VoiceBackgroundCanvas() {
    Canvas(Modifier.fillMaxSize()) {
        drawRect(Brush.verticalGradient(listOf(Vd.surface, Vd.surface2)))
        drawCircle(if (Vd.dark) Color(0x332D7DFF) else Color(0x442D7DFF), radius = size.width * .55f, center = Offset(size.width * .85f, size.height * .14f))
        drawCircle(if (Vd.dark) Color(0x1820D6F7) else Color(0x2220D6F7), radius = size.width * .45f, center = Offset(size.width * .10f, size.height * .58f))
        for (i in 0..7) {
            drawCircle(Color(0x6620D6F7), radius = 3.dp.toPx(), center = Offset(size.width * (.10f + i * .11f), size.height * (.22f + (i % 3) * .19f)))
        }
    }
}

@Composable
fun Header(title: String, subtitle: String, action: @Composable (() -> Unit)? = null, compact: Boolean = false) {
    Row(verticalAlignment = Alignment.Top, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Vd.ink, fontSize = if (compact) 30.sp else 34.sp, lineHeight = if (compact) 34.sp else 38.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(if (compact) 4.dp else 6.dp))
            Text(subtitle, color = Vd.muted, fontSize = if (compact) 14.sp else 16.sp, lineHeight = if (compact) 19.sp else 22.sp)
        }
        if (action != null) action()
    }
}

@Composable
fun RoundIcon(text: String, onClick: () -> Unit, size: Dp = 58.dp) {
    OutlinedButton(
        onClick = onClick,
        shape = CircleShape,
        contentPadding = PaddingValues(0.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Vd.control, contentColor = Vd.ink),
        border = BorderStroke(1.dp, Vd.line),
        modifier = Modifier.size(size).shadow(10.dp, CircleShape, ambientColor = Color(0x2207152F), spotColor = Color(0x2207152F))
    ) { Text(text, fontSize = (size.value * .48f).sp, fontWeight = FontWeight.Bold) }
}

@Composable
fun GlassCard(modifier: Modifier = Modifier, radius: Dp = 28.dp, padding: Dp = 20.dp, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.shadow(16.dp, RoundedCornerShape(radius), ambientColor = Color(0x1607152F), spotColor = Color(0x2007152F)),
        shape = RoundedCornerShape(radius),
        colors = CardDefaults.cardColors(containerColor = Vd.panel),
        border = BorderStroke(1.dp, Vd.border),
        content = { Column(Modifier.padding(padding), content = content) }
    )
}

@Composable
fun StatusPill(text: String, good: Boolean) {
    val fg = if (good) Vd.green else Vd.red
    Text(
        text = "● $text",
        color = fg,
        fontSize = 15.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.background(fg.copy(alpha = .10f), RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 7.dp)
    )
}

@Composable
fun OrbButton(recording: Boolean = false, processing: Boolean = false, level: Float = .35f, size: Dp = 270.dp, onClick: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    val infinite = rememberInfiniteTransition(label = "orb")
    val pulse by infinite.animateFloat(.86f, 1.08f, infiniteRepeatable(tween(if (recording) 620 else 1500), RepeatMode.Reverse), label = "pulse")
    val sweep by infinite.animateFloat(0f, 360f, infiniteRepeatable(tween(if (processing) 1200 else 2800), RepeatMode.Restart), label = "sweep")
    val click = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    Box(modifier.then(click).size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val r = this.size.minDimension / 2
            drawCircle(Color(0x2020D6F7), radius = r * pulse)
            drawCircle(brush = Brush.radialGradient(listOf(Color.White, Color(0x6620D6F7), Color.Transparent)), radius = r * 1.05f)
            drawCircle(brush = Brush.linearGradient(listOf(Color(0xFF3366FF), Color(0xFF12D7F2))), radius = r * (.58f + level.coerceIn(0f, 1f) * .08f))
            drawCircle(Color.White.copy(alpha = .34f), radius = r * .64f, style = Stroke(5.dp.toPx()))
            drawArc(
                color = Color.White.copy(alpha = .76f),
                startAngle = sweep,
                sweepAngle = 72f,
                useCenter = false,
                topLeft = Offset(r * .18f, r * .18f),
                size = Size(r * 1.64f, r * 1.64f),
                style = Stroke(6.dp.toPx(), cap = StrokeCap.Round)
            )
        }
        Text("🎙", color = Color.White, fontSize = (size.value * .28f).sp)
    }
}

@Composable
fun GradientButton(text: String, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Button(
        enabled = enabled,
        onClick = onClick,
        shape = RoundedCornerShape(24.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent, disabledContainerColor = Color(0xFFD7DCE6)),
        contentPadding = PaddingValues(),
        modifier = modifier.height(64.dp).shadow(14.dp, RoundedCornerShape(24.dp), ambientColor = Color(0x333366FF), spotColor = Color(0x333366FF))
    ) {
        Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xFF2D67FF), Color(0xFF20D6F7))), RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) {
            Text(text, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
fun SoftButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(24.dp),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White.copy(alpha = .72f), contentColor = Vd.ink),
        border = BorderStroke(1.dp, Color(0xFFDCE5F4)),
        modifier = modifier.height(60.dp)
    ) { Text(text, fontSize = 17.sp, fontWeight = FontWeight.Bold) }
}

@Composable
fun PreviewRow(icon: String, label: String, value: String, badge: String? = null) {
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(46.dp).background(if (Vd.dark) Color(0x223366FF) else Color(0xFFEAF2FF), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Text(icon, fontSize = 24.sp, color = Vd.blue, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = Vd.muted, fontSize = 13.sp)
            Text(value.ifBlank { "—" }, color = Vd.ink, fontSize = 19.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (!badge.isNullOrBlank()) {
            Text(badge, color = Vd.blue, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.background(if (Vd.dark) Color(0x223366FF) else Color(0xFFEAF2FF), RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 7.dp))
        }
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(text.uppercase(), color = Vd.blue, fontSize = 14.sp, letterSpacing = 1.2.sp, fontWeight = FontWeight.Black)
}

@Composable
fun CompactField(label: String, value: String, onValueChange: (String) -> Unit, singleLine: Boolean = true) {
    OutlinedTextField(value = value, onValueChange = onValueChange, singleLine = singleLine, label = { Text(label) }, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth())
}

@Composable
fun TinyWave(modifier: Modifier = Modifier, active: Boolean = true) {
    val infinite = rememberInfiniteTransition(label = "wave")
    val phase by infinite.animateFloat(0f, 1f, infiniteRepeatable(tween(850), RepeatMode.Restart), label = "phase")
    Canvas(modifier.height(26.dp).fillMaxWidth()) {
        val bars = 28
        val gap = size.width / (bars * 1.35f)
        for (i in 0 until bars) {
            val t = if (active) kotlin.math.sin((phase * 6.28f + i * .55f).toDouble()).toFloat() else 0f
            val h = size.height * (.24f + kotlin.math.abs(t) * .55f)
            val x = i * gap * 1.35f
            drawLine(Brush.verticalGradient(listOf(Vd.blue, Vd.cyan)), Offset(x, size.height / 2 - h / 2), Offset(x, size.height / 2 + h / 2), gap * .42f, StrokeCap.Round)
        }
    }
}
