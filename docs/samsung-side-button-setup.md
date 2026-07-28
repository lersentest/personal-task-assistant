# Samsung side button setup for Android Voice Task MVP

The app cannot programmatically take over the Samsung side button. Configure it manually:

1. Install the Android app on the phone.
2. Open Samsung Settings.
3. Go to **Advanced features → Side button**.
4. Set **Double press** to open an app or shortcut.
5. Choose **Personal Voice Task** or the shortcut **Голосовая задача**.

Expected behavior:

- Double press opens the compact voice capture screen.
- The source sent to backend is `ANDROID_SIDE_BUTTON`.
- If the phone requires unlock, Android may show the unlock screen first. The app must continue after unlock; it does not bypass device security.

If your Samsung firmware does not show app shortcuts in the side-button picker, use a widget on the home screen as the fallback entry point.
