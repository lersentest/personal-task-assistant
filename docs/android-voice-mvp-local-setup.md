# Android Voice Task MVP — local setup

## Local environment report

Checked on this Codex machine:

| Tool | Status | Notes |
| --- | --- | --- |
| Git | Installed | `C:\Program Files\Git\cmd\git.exe` |
| Node.js / npm / npx | Installed | Project backend can typecheck/build. |
| Prisma CLI | Installed through project npm deps | `npm run typecheck` runs `prisma generate`. |
| Docker / Docker Compose | Missing | Needed only if you want a local PostgreSQL. |
| Java JDK 17+ | Missing | Only Java 8 runtime path was found; Android Gradle Plugin needs JDK 17+. |
| Android Studio | Missing | Install to build/run Android app locally. |
| Android SDK / Platform Tools / ADB | Missing | Needed for emulator/physical Samsung testing. |
| Gradle | Missing | Android Studio can use bundled Gradle; no standalone Gradle was found. |
| Android Emulator | Missing | Install from Android Studio SDK Manager. |

## Install what is missing

1. Install Android Studio: https://developer.android.com/studio
2. In Android Studio install:
   - Android SDK Platform 35
   - Android SDK Build-Tools
   - Android SDK Platform-Tools
   - Android Emulator
   - at least one emulator system image
3. Install JDK 17 or use Android Studio bundled JDK.
4. Add to user environment variables if needed:

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx ANDROID_SDK_ROOT "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

Restart terminal after `setx`.

## Backend endpoints added

### Create mobile device session

`POST /api/mobile-auth/sessions`

Authorization: normal web Supabase bearer token.

Request:

```json
{
  "deviceName": "David Samsung",
  "platform": "ANDROID"
}
```

Response contains `token`. It is shown once. Store it in Android app settings.

### Preview voice command

`POST /api/voice-command/preview`

Authorization: `Bearer <mobile-device-token>`

Multipart fields:

- `audio`: audio file, max 20 MB, max 5 minutes
- `clientCommandId`: UUID generated on phone
- `idempotencyKey`: random key, at least 16 chars
- `source`: `ANDROID_APP`, `ANDROID_WIDGET`, or `ANDROID_SIDE_BUTTON`
- `durationMs`: recording duration

Response:

```json
{
  "draftId": "...",
  "clientCommandId": "...",
  "transcript": "...",
  "preview": {
    "title": "...",
    "projectName": "Без проекта",
    "priority": "NORMAL",
    "dueAt": null,
    "dueDateType": null
  },
  "expiresAt": "..."
}
```

### Confirm draft

`POST /api/voice-command/confirm`

Authorization: `Bearer <mobile-device-token>`

```json
{
  "draftId": "...",
  "idempotencyKey": "new-random-confirm-key"
}
```

Creates exactly one task. Repeating the same confirm idempotency key returns the same result.

### Cancel draft

`POST /api/voice-command/cancel`

Authorization: `Bearer <mobile-device-token>`

```json
{
  "draftId": "...",
  "idempotencyKey": "new-random-cancel-key"
}
```

No task is created.

## Build Android app

Open `android/` in Android Studio, then:

1. Sync Gradle.
2. Run `:app:assembleDebug`.
3. Install on phone/emulator.
4. Open app and enter:
   - Backend URL: `https://personal-task-assistant-ruby.vercel.app`
   - Mobile device token from `/api/mobile-auth/sessions`

CLI after Android Studio/SDK install:

```powershell
cd "C:\Users\David\Documents\Codex\2026-07-14\files-mentioned-by-the-user-telegram\outputs\personal-task-assistant\android"
.\gradlew.bat :app:assembleDebug
```

This repository currently does not include a Gradle wrapper, so Android Studio may need to generate/use its bundled Gradle first.

## Offline behavior

- Recording is saved locally in Room if there is no network.
- WorkManager retries preview when the network returns.
- The app never auto-confirms restored commands.
- The user still has to confirm before the task is created.

## What is intentionally not in MVP

- Wear OS app.
- Editing existing tasks.
- Delegated tasks.
- Multi-task command parsing.
- Manual field editing in Android preview.
- Bypassing Android lock-screen restrictions.
