# Android Voice Task MVP — implementation report

## Git

- Branch: `feature/android-voice-mvp`
- Production deploy: not performed.
- Production database migrations: not applied.
- Existing untracked docs/screenshots from earlier work were left untouched.

## Backend

Added persistent mobile voice flow:

- `POST /api/mobile-auth/sessions`
- `DELETE /api/mobile-auth/sessions/:id`
- `POST /api/voice-command/preview`
- `POST /api/voice-command/confirm`
- `POST /api/voice-command/cancel`

New files:

- `src/mobile-auth/mobile-auth.service.ts`
- `src/mobile-auth/mobile-auth.module.ts`
- `src/api/auth/mobile-device-auth.guard.ts`
- `src/api/mobile-auth.controller.ts`
- `src/api/voice-command.controller.ts`
- `src/voice/mobile-voice-command.service.ts`

Database:

- `mobile_device_sessions`
- `mobile_voice_drafts`
- `mobile_voice_requests`

Migration file:

- `prisma/migrations/20260728100000_android_voice_mvp/migration.sql`

Security:

- Device token is returned only once.
- Database stores only SHA-256 token hash.
- `service_role` remains server-side only.
- Mobile endpoints use a separate long-lived device token.
- Idempotency is enforced per device session.

## Android

Added project under `android/`.

Implemented:

- Minimal settings screen for backend URL and device token.
- Voice capture screen.
- Audio recording to local `.m4a`.
- Multipart preview request.
- Structured preview.
- Confirm/cancel.
- Offline Room queue.
- WorkManager retry after network returns.
- Home screen widget.
- Deep link / shortcut entry point for Samsung side button.
- Vibration and notification tone after successful creation.

Main files:

- `android/app/src/main/java/com/personaltasks/voice/MainActivity.java`
- `android/app/src/main/java/com/personaltasks/voice/VoiceCaptureActivity.java`
- `android/app/src/main/java/com/personaltasks/voice/ApiClient.java`
- `android/app/src/main/java/com/personaltasks/voice/AppDatabase.java`
- `android/app/src/main/java/com/personaltasks/voice/VoiceQueueWorker.java`
- `android/app/src/main/java/com/personaltasks/voice/VoiceWidgetProvider.java`

Docs:

- `docs/android-voice-mvp-local-setup.md`
- `docs/samsung-side-button-setup.md`

## Tests

Passed:

```text
npm test
11/11 backend tests passed
```

Added:

- `src/voice/mobile-voice-command.service.test.ts`

Covered:

- Confirm idempotency: repeated confirm does not create a duplicate task.

Not run locally:

- Android APK build.
- Android emulator/device tests.

Reason: this machine has no Android Studio, Android SDK, ADB, Gradle, or JDK 17+.

## Remaining manual checks

1. Install Android Studio + SDK + JDK 17.
2. Open `android/` in Android Studio.
3. Build `:app:assembleDebug`.
4. Create mobile device session from backend.
5. Enter backend URL + device token in Android app.
6. Test:
   - normal recording → preview → confirm;
   - cancel;
   - re-record;
   - airplane mode recording → network restore → preview notification;
   - widget launch;
   - Samsung side button shortcut;
   - repeated confirm/retry does not duplicate task.
