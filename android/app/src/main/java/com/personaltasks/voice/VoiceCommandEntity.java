package com.personaltasks.voice;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

@Entity(tableName = "voice_commands")
public class VoiceCommandEntity {
    @PrimaryKey(autoGenerate = true)
    public long localId;
    public String clientCommandId;
    public String idempotencyKey;
    public String audioFilePath;
    public String mimeType;
    public long durationMs;
    public String source;
    public String status;
    public String draftId;
    public long createdAt;
    public long lastAttemptAt;
    public int retryCount;
    public String lastErrorCode;
}
