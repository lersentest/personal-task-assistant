package com.personaltasks.voice

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.net.ConnectivityManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.ActivityCompat
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import org.json.JSONObject
import java.io.File
import java.util.Locale
import java.util.UUID

class VoiceCaptureActivity : ComponentActivity() {
    private enum class FlowState { IDLE, RECORDING, PROCESSING, PREVIEW, CONFIRMING, SUCCESS, ERROR, OFFLINE }

    private val handler = Handler(Looper.getMainLooper())
    private var state by mutableStateOf(FlowState.IDLE)
    private var headerTitle by mutableStateOf("Новая задача")
    private var headerSubtitle by mutableStateOf("")
    private var timerText by mutableStateOf("00:00")
    private var level by mutableFloatStateOf(.18f)
    private var processingStep by mutableStateOf("Проверяем запись")
    private var errorTitle by mutableStateOf("")
    private var errorDetails by mutableStateOf("")
    private var preview by mutableStateOf<JSONObject?>(null)
    private var recorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var startedAt = 0L
    private var recording = false
    private var source = "ANDROID_APP"
    private var clientCommandId = ""
    private var previewKey = ""
    private var confirmKey = ""
    private var draftId: String? = null

    private val timerTick = object : Runnable {
        override fun run() {
            if (!recording) return
            timerText = formatDuration(System.currentTimeMillis() - startedAt)
            level = readRecorderLevel()
            handler.postDelayed(this, 240)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        source = intent.getStringExtra(MainActivity.EXTRA_SOURCE)
            ?: if (intent.data != null) "ANDROID_SIDE_BUTTON" else "ANDROID_APP"
        setContent { CaptureScreen() }
        if (intent.getBooleanExtra(MainActivity.EXTRA_AUTO_START, true)) {
            handler.postDelayed({ startRecording() }, 260)
        } else {
            showIdle()
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(timerTick)
        releaseRecorder(false)
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (state == FlowState.PROCESSING || state == FlowState.CONFIRMING) {
            Toast.makeText(this, "Дождитесь завершения обработки", Toast.LENGTH_SHORT).show()
            return
        }
        cancelFlow()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 10 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startRecording()
        } else {
            showError("Нет доступа к микрофону", "")
        }
    }

    @Composable
    private fun CaptureScreen() {
        VoicePage(scroll = state == FlowState.PREVIEW || state == FlowState.ERROR) {
            Header(headerTitle, headerSubtitle, action = { RoundIcon("×", onClick = { cancelFlow() }, size = 48.dp) })
            when (state) {
                FlowState.IDLE -> IdleContent()
                FlowState.RECORDING -> RecordingContent()
                FlowState.PROCESSING, FlowState.CONFIRMING -> ProcessingContent()
                FlowState.PREVIEW -> PreviewContent()
                FlowState.SUCCESS -> SuccessContent()
                FlowState.ERROR -> ErrorContent()
                FlowState.OFFLINE -> OfflineContent()
            }
        }
    }

    @Composable
    private fun IdleContent() {
        Column(Modifier.fillMaxWidth().padding(top = 34.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            OrbButton(onClick = { startRecording() }, size = 230.dp)
            Spacer(Modifier.height(16.dp))
            Text("Запишите задачу", color = Vd.ink, fontSize = 30.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
            Text("Нажмите и продиктуйте одну задачу.\nПеред созданием покажем результат.", color = Vd.muted, fontSize = 16.sp, lineHeight = 22.sp, textAlign = TextAlign.Center)
        }
    }

    @Composable
    private fun RecordingContent() {
        Column(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            OrbButton(recording = true, level = level, size = 230.dp)
            Text(timerText, color = Vd.ink, fontSize = 44.sp, fontWeight = FontWeight.Light)
            TinyWave(Modifier.padding(horizontal = 42.dp), active = true)
            Spacer(Modifier.height(12.dp))
            Text("Когда закончите, нажмите «Завершить»", color = Vd.muted, fontSize = 15.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                GradientButton("■  Завершить", Modifier.weight(1f)) { stopAndPreview() }
                SoftButton("Отменить", Modifier.weight(1f)) { cancelFlow() }
            }
        }
    }

    @Composable
    private fun ProcessingContent() {
        Column(Modifier.fillMaxWidth().padding(top = 48.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            OrbButton(processing = true, size = 150.dp)
            Spacer(Modifier.height(18.dp))
            GlassCard(radius = 28.dp, padding = 18.dp) {
                Text(processingStep, color = Vd.ink, fontSize = 24.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(6.dp))
                Text("Распознаём голос, выделяем дату, проект и приоритет.", color = Vd.muted, fontSize = 16.sp, lineHeight = 22.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.height(20.dp))
            Text("Не закрывайте экран, пока идёт распознавание.", color = Vd.muted, fontSize = 15.sp, textAlign = TextAlign.Center)
        }
    }

    @Composable
    private fun PreviewContent() {
        val p = preview ?: JSONObject()
        Column(Modifier.fillMaxWidth().padding(top = 16.dp), verticalArrangement = Arrangement.Bottom) {
            GlassCard(radius = 28.dp, padding = 16.dp) {
                PreviewRow("T", "Название", p.optString("title", "Новая задача"))
                PreviewRow("□", "Дата и время", p.optJSONObject("display")?.optString("dueAt").orEmpty())
                PreviewRow("⚑", "Приоритет", readablePriority(p.optString("priority")), readablePriority(p.optString("priority")))
                PreviewRow("▣", "Проект", valueOr(p.optString("projectName"), "Без проекта"), valueOr(p.optString("projectName"), "Нет"))
                PreviewRow("○", "Тип", readableType(p.optString("type")))
                val description = p.optString("description")
                if (description.isNotBlank() && description != "null") PreviewRow("≡", "Описание", description)
            }
            Spacer(Modifier.height(16.dp))
            GradientButton("✓  Создать задачу", Modifier.fillMaxWidth()) { confirm() }
            Spacer(Modifier.height(10.dp))
            SoftButton("↻  Записать заново", Modifier.fillMaxWidth()) { reRecord() }
            Spacer(Modifier.height(8.dp))
            SoftButton("Отменить", Modifier.fillMaxWidth()) { cancelFlow() }
        }
    }

    @Composable
    private fun SuccessContent() {
        Column(Modifier.fillMaxWidth().padding(top = 70.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            OrbButton(level = .75f, size = 210.dp)
            Spacer(Modifier.height(20.dp))
            Text("Задача создана", color = Vd.ink, fontSize = 30.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
            Text(preview?.optString("title").orEmpty(), color = Vd.muted, fontSize = 18.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            GradientButton("Новая задача", Modifier.fillMaxWidth()) { startRecording() }
            Spacer(Modifier.height(10.dp))
            SoftButton("Закрыть", Modifier.fillMaxWidth()) { finish() }
        }
    }

    @Composable
    private fun ErrorContent() {
        Column(Modifier.fillMaxWidth().padding(top = 70.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            GlassCard(radius = 28.dp) {
                Text("Попробуйте записать ещё раз", color = Vd.ink, fontSize = 24.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(8.dp))
                Text(errorTitle, color = Vd.muted, fontSize = 18.sp, lineHeight = 25.sp)
                if (errorDetails.isNotBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(errorDetails, color = Vd.red, fontSize = 13.sp, lineHeight = 18.sp)
                }
            }
            Spacer(Modifier.height(22.dp))
            GradientButton("Записать заново", Modifier.fillMaxWidth()) { startRecording() }
            Spacer(Modifier.height(10.dp))
            SoftButton("Закрыть", Modifier.fillMaxWidth()) { finish() }
        }
    }

    @Composable
    private fun OfflineContent() {
        Column(Modifier.fillMaxWidth().padding(top = 76.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            GlassCard(radius = 28.dp) {
                Text("Команда в очереди", color = Vd.ink, fontSize = 26.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(8.dp))
                Text("Интернета нет. Приложение отправит запись автоматически после восстановления связи.", color = Vd.muted, fontSize = 18.sp, lineHeight = 25.sp)
            }
            Spacer(Modifier.height(22.dp))
            GradientButton("Закрыть", Modifier.fillMaxWidth()) { finish() }
        }
    }

    private fun showIdle() {
        state = FlowState.IDLE
        headerTitle = "Новая задача"
        headerSubtitle = connectionLabel()
    }

    private fun startRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 10)
            return
        }
        try {
            clientCommandId = UUID.randomUUID().toString()
            previewKey = UUID.randomUUID().toString()
            confirmKey = UUID.randomUUID().toString()
            draftId = null
            preview = null
            audioFile = File(cacheDir, "voice-$clientCommandId.m4a")
            recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(96000)
                setOutputFile(audioFile!!.absolutePath)
                prepare()
                start()
            }
            startedAt = System.currentTimeMillis()
            recording = true
            headerTitle = "Говорите…"
            headerSubtitle = "● Запись   |   Задача записывается"
            timerText = "00:00"
            state = FlowState.RECORDING
            handler.post(timerTick)
        } catch (e: Exception) {
            showError(e.message ?: "Не удалось начать запись", "")
        }
    }

    private fun stopAndPreview() {
        handler.removeCallbacks(timerTick)
        val stopped = releaseRecorder(true)
        val duration = System.currentTimeMillis() - startedAt
        val file = audioFile
        if (!stopped || file == null || !file.exists() || file.length() < 1024) {
            showError("Android не сохранил аудиофайл", "Проверьте доступ к микрофону и попробуйте ещё раз.")
            return
        }
        if (duration < 900) {
            showError("Запись получилась слишком короткой", "")
            return
        }
        val previewDuration = duration.coerceAtLeast(900)
        showProcessing("Проверяем запись")
        if (!isOnline()) {
            saveOffline(previewDuration)
            return
        }
        Thread {
            try {
                val response = ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).preview(file, clientCommandId, previewKey, source, previewDuration)
                draftId = extractDraftId(response)
                val p = extractPreview(response)
                runOnUiThread {
                    preview = p
                    AppPrefs.markSynced(this)
                    headerTitle = "Проверьте задачу"
                    headerSubtitle = "Создадим задачу только после подтверждения"
                    state = FlowState.PREVIEW
                }
            } catch (e: Exception) {
                runOnUiThread { showError(humanError(e.message), shortError(e.message)) }
            }
        }.start()
    }

    private fun confirm() {
        val id = draftId ?: return
        showProcessing("Создаём задачу")
        state = FlowState.CONFIRMING
        Thread {
            try {
                ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).confirm(id, confirmKey)
                runOnUiThread {
                    successSignal()
                    headerTitle = "Готово"
                    headerSubtitle = "Задача создана"
                    state = FlowState.SUCCESS
                }
            } catch (e: Exception) {
                runOnUiThread { showError(humanError(e.message), shortError(e.message)) }
            }
        }.start()
    }

    private fun cancelFlow() {
        if (state == FlowState.PROCESSING || state == FlowState.CONFIRMING) {
            Toast.makeText(this, "Дождитесь завершения обработки", Toast.LENGTH_SHORT).show()
            return
        }
        releaseRecorder(true)
        val id = draftId
        if (id == null) {
            finish()
            return
        }
        Thread {
            try {
                ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).cancel(id, UUID.randomUUID().toString())
            } catch (_: Exception) {
            }
            runOnUiThread { finish() }
        }.start()
    }

    private fun reRecord() {
        val id = draftId
        if (id == null) {
            startRecording()
            return
        }
        Thread {
            try {
                ApiClient(AppPrefs.baseUrl(this), AppPrefs.deviceToken(this)).cancel(id, UUID.randomUUID().toString())
            } catch (_: Exception) {
            }
            draftId = null
            runOnUiThread { startRecording() }
        }.start()
    }

    private fun showProcessing(step: String) {
        processingStep = step
        headerTitle = "Обрабатываю"
        headerSubtitle = "Секунду: превращаем голос в задачу"
        state = FlowState.PROCESSING
    }

    private fun showError(message: String?, details: String?) {
        headerTitle = "Не получилось"
        headerSubtitle = "Не удалось распознать или создать задачу"
        errorTitle = message ?: "Попробуйте ещё раз"
        errorDetails = details.orEmpty()
        state = FlowState.ERROR
    }

    private fun showOfflineSaved() {
        headerTitle = "Запись сохранена"
        headerSubtitle = "Отправим, когда появится интернет"
        state = FlowState.OFFLINE
    }

    private fun releaseRecorder(stop: Boolean): Boolean {
        val r = recorder ?: return true
        handler.removeCallbacks(timerTick)
        var stopped = true
        if (stop) {
            try {
                r.stop()
            } catch (_: Exception) {
                stopped = false
            }
        }
        try {
            r.release()
        } catch (_: Exception) {
        }
        recorder = null
        recording = false
        return stopped
    }

    private fun saveOffline(durationMs: Long) {
        Thread {
            val item = VoiceCommandEntity().apply {
                clientCommandId = this@VoiceCaptureActivity.clientCommandId
                idempotencyKey = previewKey
                audioFilePath = audioFile?.absolutePath
                mimeType = "audio/mp4"
                this.durationMs = durationMs
                source = this@VoiceCaptureActivity.source
                status = "WAITING_FOR_NETWORK"
                createdAt = System.currentTimeMillis()
            }
            AppDatabase.get(this).voiceCommands().insert(item)
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            val work = OneTimeWorkRequest.Builder(VoiceQueueWorker::class.java).setConstraints(constraints).build()
            WorkManager.getInstance(this).enqueue(work)
            runOnUiThread { showOfflineSaved() }
        }.start()
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        @Suppress("DEPRECATION")
        return cm.activeNetworkInfo?.isConnected == true
    }

    private fun successSignal() {
        if (AppPrefs.soundEnabled(this)) ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70).startTone(ToneGenerator.TONE_PROP_ACK, 180)
        if (!AppPrefs.vibrationEnabled(this)) return
        val v = getSystemService(VIBRATOR_SERVICE) as? Vibrator ?: return
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(180, VibrationEffect.DEFAULT_AMPLITUDE)) else @Suppress("DEPRECATION") v.vibrate(180)
    }

    private fun readRecorderLevel(): Float {
        return try {
            val amp = recorder?.maxAmplitude ?: return .12f
            if (amp <= 0) .10f else (amp / 18000f).coerceIn(.10f, 1f)
        } catch (_: Exception) {
            .12f
        }
    }

    private fun valueOr(value: String?, fallback: String): String = if (value.isNullOrBlank() || value == "null") fallback else value

    private fun connectionLabel(): String = if (AppPrefs.deviceToken(this).isEmpty()) "● Не подключено   |   Откройте настройки" else "● Подключено   |   Устройство готово к записи"

    private fun readablePriority(raw: String?): String = when (raw?.uppercase(Locale.ROOT)) {
        "URGENT" -> "Срочный"
        "HIGH" -> "Высокий"
        "LOW" -> "Низкий"
        else -> "Обычный"
    }

    private fun readableType(raw: String?): String = when (raw?.uppercase(Locale.ROOT)) {
        "CALL" -> "Звонок"
        "MEETING" -> "Встреча"
        "IDEA" -> "Идея"
        "NOTE" -> "Заметка"
        else -> "Задача"
    }

    private fun humanError(raw: String?): String {
        if (raw == null) return "Попробуйте ещё раз"
        return when {
            raw.contains("must describe one new task") -> "Команда должна описывать одну конкретную задачу"
            raw.contains("401") || raw.contains("Unauthorized") -> "Проверьте mobile device token в настройках"
            raw.contains("timeout", true) || raw.contains("Unable to resolve", true) -> "Сервис временно недоступен"
            raw.contains("Нет доступа") -> raw
            else -> "Не удалось распознать или создать задачу"
        }
    }

    private fun shortError(raw: String?): String {
        val compact = raw?.replace('\n', ' ')?.replace('\r', ' ')?.trim().orEmpty()
        return if (compact.length > 220) compact.take(220) + "…" else compact
    }

    private fun extractDraftId(response: JSONObject): String? {
        val id = response.optString("draftId")
        if (id.isNotBlank() && id != "null") return id
        val data = response.optJSONObject("data")
        val nested = data?.optString("draftId").orEmpty()
        return nested.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun extractPreview(response: JSONObject): JSONObject {
        response.optJSONObject("preview")?.let { return it }
        response.optJSONObject("data")?.optJSONObject("preview")?.let { return it }
        return response
    }

    private fun formatDuration(ms: Long): String {
        val sec = ms / 1000
        return String.format(Locale.US, "%02d:%02d", sec / 60, sec % 60)
    }
}
