package com.personaltasks.voice

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_SOURCE = "source"
        const val EXTRA_AUTO_START = "autoStart"
    }

    private var connected by mutableStateOf(false)
    private var pendingCount by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MainScreen() }
    }

    override fun onResume() {
        super.onResume()
        connected = AppPrefs.deviceToken(this).isNotBlank()
        Thread {
            val count = AppDatabase.get(this).voiceCommands().pendingCount()
            runOnUiThread { pendingCount = count }
        }.start()
    }

    private fun openVoiceCapture(source: String) {
        startActivity(Intent(this, VoiceCaptureActivity::class.java).apply {
            putExtra(EXTRA_SOURCE, source)
            putExtra(EXTRA_AUTO_START, true)
        })
    }

    @Composable
    private fun MainScreen() {
        VoicePage {
            Header(
                title = "Новая задача",
                subtitle = if (connected) "● Подключено   |   Устройство готово к записи" else "● Не подключено   |   Откройте настройки",
                action = { RoundIcon("⚙", onClick = { startActivity(Intent(this@MainActivity, SettingsActivity::class.java)) }, size = 48.dp) }
            )
            if (pendingCount > 0) {
                Spacer(Modifier.height(18.dp))
                GlassCard(radius = 20.dp) {
                    Text("В очереди $pendingCount голосовых команд. Отправим, когда появится интернет.", color = Vd.ink, fontWeight = FontWeight.Bold)
                }
            }
            Column(
                modifier = Modifier.weight(1f).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                OrbButton(onClick = { openVoiceCapture("ANDROID_APP") }, size = 230.dp)
                Spacer(Modifier.height(14.dp))
                Text("Запишите задачу", color = Vd.ink, fontSize = 30.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                Text(
                    "Нажмите и продиктуйте одну задачу.\nПеред созданием покажем, что распознали.",
                    color = Vd.muted,
                    fontSize = 16.sp,
                    lineHeight = 22.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            GlassCard(radius = 24.dp, padding = 16.dp) {
                SectionLabel("Пример")
                Spacer(Modifier.height(8.dp))
                Text("«Позвонить Роме завтра в 10 утра, обычный приоритет»", color = Vd.ink, fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(10.dp))
                Text("Завтра в 10:00   •   Обычный приоритет", color = Vd.blue, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}
