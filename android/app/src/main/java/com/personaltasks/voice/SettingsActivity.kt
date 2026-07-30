package com.personaltasks.voice

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SettingsActivity : ComponentActivity() {
    private var sound by mutableStateOf(true)
    private var vibration by mutableStateOf(true)
    private var theme by mutableStateOf("system")
    private var baseUrl by mutableStateOf("")
    private var token by mutableStateOf("")
    private var developerOpen by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        load()
        setContent { SettingsScreen() }
    }

    private fun load() {
        sound = AppPrefs.soundEnabled(this)
        vibration = AppPrefs.vibrationEnabled(this)
        theme = AppPrefs.themeMode(this)
        baseUrl = AppPrefs.baseUrl(this)
        token = AppPrefs.deviceToken(this)
    }

    @Composable
    private fun SettingsScreen() {
        VoicePage(scroll = true) {
            Header("Настройки", "Голосовые задачи, подключение и внешний вид.", action = { RoundIcon("×", onClick = { finish() }) })
            Spacer(Modifier.height(24.dp))

            GlassCard {
                SectionLabel("Общие")
                SettingSwitch("Звук", "Включить звуковые эффекты", sound) {
                    sound = it
                    AppPrefs.saveGeneral(this@SettingsActivity, sound, vibration)
                }
                SettingSwitch("Вибрация", "Короткая вибрация при ответе", vibration) {
                    vibration = it
                    AppPrefs.saveGeneral(this@SettingsActivity, sound, vibration)
                }
            }
            Spacer(Modifier.height(18.dp))

            GlassCard {
                SectionLabel("Внешний вид")
                Spacer(Modifier.height(14.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ThemeChip("Системная", "system", Modifier.weight(1f))
                    ThemeChip("Светлая", "light", Modifier.weight(1f))
                    ThemeChip("Тёмная", "dark", Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(18.dp))

            GlassCard {
                SectionLabel("Подключение")
                Spacer(Modifier.height(14.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OrbButton(level = .18f, size = 88.dp)
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        StatusPill(if (token.isBlank()) "Не подключено" else "Подключено", token.isNotBlank())
                        Spacer(Modifier.height(8.dp))
                        Text(if (token.isBlank()) "Добавьте mobile device token" else "Устройство готово к записи", color = Vd.ink, fontWeight = FontWeight.Bold)
                        Text("Последняя синхронизация: ${lastSyncText()}", color = Vd.muted, fontSize = 13.sp)
                    }
                }
            }
            Spacer(Modifier.height(18.dp))

            GlassCard {
                SectionLabel("О приложении")
                Spacer(Modifier.height(8.dp))
                Text("Personal Voice Task", color = Vd.ink, fontSize = 21.sp, fontWeight = FontWeight.Black)
                Text("Версия 0.1.0\nТокен: ${AppPrefs.maskedToken(this@SettingsActivity)}", color = Vd.muted, lineHeight = 21.sp)
            }
            Spacer(Modifier.height(18.dp))

            GlassCard {
                Text(
                    if (developerOpen) "Скрыть подключение" else "Для разработчиков",
                    color = Vd.ink,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable { developerOpen = !developerOpen }
                        .padding(vertical = 6.dp)
                )
                if (developerOpen) {
                    Spacer(Modifier.height(12.dp))
                    CompactField("Backend URL", baseUrl, { baseUrl = it })
                    Spacer(Modifier.height(10.dp))
                    CompactField("Mobile device token", token, { token = it })
                    Spacer(Modifier.height(14.dp))
                    GradientButton("Сохранить подключение", modifier = Modifier.fillMaxWidth()) {
                        AppPrefs.save(this@SettingsActivity, baseUrl, token)
                        AppPrefs.markSynced(this@SettingsActivity)
                        Toast.makeText(this@SettingsActivity, "Настройки сохранены", Toast.LENGTH_SHORT).show()
                        load()
                    }
                }
            }
        }
    }

    @Composable
    private fun SettingSwitch(title: String, description: String, checked: Boolean, onChange: (Boolean) -> Unit) {
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Vd.ink, fontSize = 19.sp, fontWeight = FontWeight.Black)
                Text(description, color = Vd.muted, fontSize = 14.sp)
            }
            Switch(checked = checked, onCheckedChange = onChange)
        }
    }

    @Composable
    private fun ThemeChip(label: String, mode: String, modifier: Modifier) {
        val selected = theme == mode
        GlassCard(modifier.clickable {
            theme = mode
            AppPrefs.saveThemeMode(this@SettingsActivity, mode)
        }, radius = 18.dp) {
            Text(if (selected) "✓" else "○", color = if (selected) Vd.blue else Vd.muted, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(label, color = if (selected) Vd.blue else Vd.ink, fontWeight = FontWeight.Bold)
        }
    }

    private fun lastSyncText(): String {
        val value = AppPrefs.lastSyncAt(this)
        if (value <= 0) return "ещё не было"
        return SimpleDateFormat("сегодня, HH:mm", Locale.getDefault()).format(Date(value))
    }
}
