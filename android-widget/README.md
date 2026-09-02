# IRLog Android Companion & Home Screen Widget

A native Android companion app and home screen widget for **IRLog (Interventional Radiology Log Management System)**.

---

## Features

- **Home Screen Widget (Jetpack Glance)**:
  - Displays today's scheduled worklist cases directly on your phone's home screen.
  - Consistent **Modality Color Badges** matching the IRLog Analytics Daily Trends graph:
    - **USG** (Ultrasound) → Blue (`#3B82F6`)
    - **CT** (Computed Tomography) → Green (`#22C55E`)
    - **OT** (Operating Theater) → Yellow/Amber (`#EAB308`)
    - **XF** (Fluoroscopy) → Violet (`#A855F7`)
    - **DSA** (Angiography) → Red (`#EF4444`)
  - Status indicators: `Scheduled`, `Done`, `Not Done`, `Cancelled`.
  - Patient details: Name, Age/Sex, Patient ID, Procedure Name, Scheduled Time.
  - Interactive **Instant Refresh** (`↻`) button.
  - One-tap deep linking: Tapping any card opens the PWA directly to that specific procedure.
- **Passkey / WebAuthn Authentication**:
  - Leverages the existing WebAuthn / Passkey biometrics already registered in your browser/PWA.
  - Opens Chrome Custom Tab to `/widget-auth` and deep-links back with a secure, 1-year widget JWT token (`irlog://auth-callback`).
- **Encrypted Local Storage**:
  - Tokens and cached cases are encrypted on-device via `EncryptedSharedPreferences` (AES-256-GCM).
- **Background Synchronization**:
  - Automatically fetches the latest worklist using Android `WorkManager` (every 15–30 minutes) without draining battery.

---

## Project Structure

```
android-widget/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/irlog/widget/
│       │   ├── IRLogApplication.kt            # Initializes WorkManager
│       │   ├── data/
│       │   │   ├── api/IRLogApiService.kt     # Retrofit / OkHttp client
│       │   │   ├── model/WorkItemModels.kt    # Data classes
│       │   │   └── storage/SecureTokenStorage.kt # Encrypted SharedPreferences
│       │   ├── ui/
│       │   │   ├── MainActivity.kt            # Setup & status screen
│       │   │   ├── AuthCallbackActivity.kt    # Deep link receiver (irlog://auth-callback)
│       │   │   └── theme/Color.kt             # Analytics modality & brand colors
│       │   ├── widget/
│       │   │   ├── IRLogWidget.kt             # Jetpack Glance widget definition
│       │   │   ├── IRLogWidgetReceiver.kt     # AppWidgetProvider
│       │   │   ├── components/
│       │   │   │   ├── WidgetHeader.kt        # Date, cases count, refresh button
│       │   │   │   ├── WorkItemRow.kt         # Case card with modality tag & deep link
│       │   │   │   └── EmptyWorklistState.kt  # Empty state illustration & button
│       │   │   └── actions/
│       │   │       └── RefreshActionCallback.kt # Interactive refresh callback
│       │   └── worker/
│       │       └── WidgetSyncWorker.kt        # Periodic background sync
│       └── res/
│           ├── drawable/                      # Vector assets & icons
│           ├── layout/activity_main.xml       # Setup UI layout
│           ├── values/                        # colors.xml, strings.xml, themes.xml
│           └── xml/irlog_widget_info.xml      # Widget sizing & provider metadata
└── build.gradle.kts
```

---

## How to Build & Install

### Option A: Open in Android Studio
1. Open Android Studio.
2. Select **Open** and choose the `android-widget` folder.
3. Allow Gradle to sync dependencies.
4. Connect your Android device or start an Android Emulator.
5. Click **Run 'app'** (`Shift + F10`).

### Option B: Build APK via Command Line
Run the following command inside `android-widget/`:
```bash
./gradlew assembleDebug
```
The output APK will be located at:
`app/build/outputs/apk/debug/app-debug.apk`

Install on your connected phone:
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Setup & Usage Instructions

1. **Launch IRLog Companion**:
   - Enter your IRLog server URL (e.g. `https://irlog.hospital.com` or your local development IP).
2. **Sign In with Passkey**:
   - Tap **"Sign in with Passkey (Biometrics)"**.
   - Your phone's biometric prompt (Fingerprint / Face ID) will authenticate via Chrome.
   - It will automatically return to the IRLog Companion app with a confirmation message.
3. **Add Widget to Home Screen**:
   - Go to your Android Home Screen.
   - Long-press on an empty area and tap **Widgets**.
   - Find **IRLog Companion** and drag **Today's Worklist** onto your home screen.
   - Resize the widget to your preferred width and height (e.g., 4x2 or 4x3).
4. **Enjoy Real-Time Updates**:
   - Tap `↻` at any time to refresh.
   - Tap any case card to open the patient procedure directly in your PWA.
