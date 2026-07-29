package com.personaltasks.voice;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.Query;
import androidx.room.Update;

import java.util.List;

@Dao
public interface VoiceCommandDao {
    @Insert
    long insert(VoiceCommandEntity item);

    @Update
    void update(VoiceCommandEntity item);

    @Query("SELECT * FROM voice_commands WHERE status IN ('RECORDED','WAITING_FOR_NETWORK','FAILED') ORDER BY createdAt ASC")
    List<VoiceCommandEntity> pendingPreview();

    @Query("SELECT COUNT(*) FROM voice_commands WHERE status IN ('RECORDED','WAITING_FOR_NETWORK','FAILED','UPLOADING')")
    int pendingCount();
}
