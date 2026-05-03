# Roam Android

Native Android app — Kotlin + Jetpack Compose. Physics-based swipe gestures, offline-queued ratings, shimmer skeletons, Supabase backend.

## Tech Stack

- **Kotlin** — Modern Android language
- **Jetpack Compose** — Declarative UI framework (Material Design 3)
- **Jetpack Navigation** — Fragment-less navigation
- **Supabase Kotlin SDK** — Database and authentication
- **Sentry** — Error tracking and crash reporting
- **Google Safe Browsing** — Malicious URL detection
- **Chrome Custom Tabs** — In-app browser for reading articles
- **WorkManager** — Background task scheduling
- **DataStore** — Secure local storage for settings

## Architecture

### Model-View-ViewModel (MVVM)

The app uses MVVM architecture with coroutines for async operations:

```
┌─────────────┐
│ Composables │  (UI Layer)
│  (Screens)  │
└──────┬──────┘
       │ observes ViewModel.stateFlow
┌──────v──────────────┐
│   ViewModels        │  (Presentation Layer)
│  (DiscoveryVM, etc) │
└──────┬──────────────┘
       │ calls Repository methods
┌──────v──────────────┐
│   Repositories      │  (Data Layer)
│  (DiscoveryRepo)    │
└──────┬──────────────┘
       │ uses Supabase/Local Storage
┌──────v──────────────┐
│   Data Sources      │
│  (Remote/Local)     │
└─────────────────────┘
```

### Directory Structure

```
app/src/
├── main/
│   ├── AndroidManifest.xml          # App permissions and activities
│   ├── java/app/roam/android/
│   │   ├── RoamApplication.kt       # Application lifecycle (init Supabase/Sentry)
│   │   ├── MainActivity.kt          # Single activity for Compose
│   │   ├── ui/
│   │   │   ├── screens/             # Jetpack Compose screens
│   │   │   │   ├── DiscoveryScreen.kt
│   │   │   │   ├── ProfileScreen.kt
│   │   │   │   ├── CollectionsScreen.kt
│   │   │   │   ├── SettingsScreen.kt
│   │   │   │   └── LoginScreen.kt
│   │   │   ├── components/          # Reusable UI components
│   │   │   │   ├── RoamButton.kt
│   │   │   │   ├── RatingBar.kt
│   │   │   │   └── SwipeCard.kt
│   │   │   └── theme/               # Material Design 3 theming
│   │   │       ├── Color.kt
│   │   │       ├── Type.kt
│   │   │       └── Theme.kt
│   │   ├── viewmodel/
│   │   │   ├── DiscoveryViewModel.kt  # Discovery state management
│   │   │   ├── AuthViewModel.kt       # Authentication state
│   │   │   └── ProfileViewModel.kt    # User profile state
│   │   ├── repository/
│   │   │   ├── DiscoveryRepository.kt # Roam queries, ratings
│   │   │   ├── AuthRepository.kt      # Login/signup/logout
│   │   │   └── ProfileRepository.kt   # User profile operations
│   │   ├── network/
│   │   │   ├── SupabaseClient.kt      # Supabase initialization
│   │   │   └── SafeBrowsingClient.kt  # Safe Browsing API
│   │   ├── storage/
│   │   │   └── PreferencesStore.kt    # DataStore for local settings
│   │   ├── util/
│   │   │   ├── Env.kt                 # Environment variable validation
│   │   │   ├── Logger.kt              # Logging utility
│   │   │   └── Extensions.kt          # Kotlin extensions
│   │   └── worker/
│   │       └── SyncWorker.kt          # Background sync via WorkManager
│   └── res/
│       ├── drawable/                 # Vector drawables and images
│       ├── values/                   # Strings, colors, dimensions
│       ├── layout/                   # Legacy XML layouts (if any)
│       └── menu/                     # Bottom navigation menu
└── test/
    └── java/app/roam/android/        # Unit tests
└── androidTest/
    └── java/app/roam/android/        # Instrumented tests
```

## Build Configuration

### build.gradle.kts (Module-level)

Key build configurations:

```kotlin
android {
    compileSdk = 35
    
    defaultConfig {
        applicationId = "app.roam.android"
        minSdk = 26  // Android 8.0+
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        
        // Inject environment variables at build time
        buildConfigField("String", "SUPABASE_URL", "\"https://...\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"sb_...\"")
        buildConfigField("String", "SENTRY_DSN_ANDROID", "\"https://...\"")
    }
    
    // Enable view binding for type-safe view access
    buildFeatures {
        viewBinding = true
        compose = true
    }
    
    // ProGuard/R8 code obfuscation for production
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

// Dependencies
dependencies {
    // Jetpack Compose
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")
    
    // Jetpack Navigation
    implementation("androidx.navigation:navigation-compose:2.8.0")
    
    // Supabase
    implementation("io.github.supabase:supabase-kt:3.0.2")
    
    // Sentry
    implementation("io.sentry:sentry-android:7.0.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    
    // WorkManager
    implementation("androidx.work:work-runtime-ktx:2.9.1")
    
    // DataStore
    implementation("androidx.datastore:datastore-preferences:1.1.1")
}
```

## Development Setup

### Prerequisites
- Android Studio Jellyfish or newer
- JDK 17+
- Android SDK 26+ (API 26 = Android 8.0)
- Gradle 8.5+

### Environment Setup

1. **Clone and open project:**
   ```bash
   git clone https://github.com/yourusername/roam.git
   cd roam
   open -a "Android Studio" android/
   ```

2. **Configure local.properties:**
   Create `android/local.properties`:
   ```
   sdk.dir=/Users/yourname/Library/Android/sdk
   ```

3. **Add Supabase credentials:**
   Update `android/app/build.gradle.kts`:
   ```kotlin
   buildConfigField("String", "SUPABASE_URL", "\"https://yrhckctwtdjowulfuaqc.supabase.co\"")
   buildConfigField("String", "SUPABASE_ANON_KEY", "\"sb_publishable_...\"")
   buildConfigField("String", "SENTRY_DSN_ANDROID", "\"https://...@...ingest.us.sentry.io/...\"")
   ```

4. **Sync Gradle:**
   Android Studio → File → Sync Now

### Build & Run

```bash
cd android

# Build debug APK
./gradlew assembleDebug

# Build release APK (requires keystore)
./gradlew assembleRelease

# Run on connected device/emulator
./gradlew installDebug

# Run unit tests
./gradlew test

# Run instrumented tests (on device)
./gradlew connectedAndroidTest
```

### Debug APK Installation

```bash
# Direct installation to device
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Install and run immediately
adb install -r app/build/outputs/apk/debug/app-debug.apk && adb shell am start -n app.roam.android/.MainActivity
```

## Key Features

### Discovery Screen
- **Roam button** — Fetch random URL matching user interests
- **Swipe gestures:**
  - Right swipe → Thumbs up (like)
  - Left swipe → Thumbs down (skip)
  - Down swipe → Show details
- **Queue prefetching** — Next 3 URLs fetched in background
- **Offline support** — Cached URLs available without network

### Rating System
```kotlin
// User swipes to rate
DiscoveryViewModel.rateUrl(urlId = "uuid", rating = 1)
// ViewModel updates local state + sends to Supabase
// LiveData observers update UI optimistically
```

### Collections
- **Create** — Save interesting URLs to collections
- **View** — Browse saved pages in app or on web
- **Share** — Mark collections public to share with followers
- **Offline** — Saved collections available without network

### Settings
- **Dark mode** — System or manual toggle
- **Interest categories** — Select topics for personalization
- **Language** — Filter results by language
- **Adult content** — Toggle NSFW content
- **Notifications** — Enable/disable push notifications

### Push Notifications
Triggered by WorkManager background job:
- New follower
- Collection shared with you
- URL you submitted was approved
- Following activity (someone rated your submission)

## Error Handling

### Graceful Degradation
```kotlin
// Network error → show cached data
// API error → show fallback UI
// Crash → Sentry captures, app continues

try {
    val url = discoveryRepository.getRandomUrl(category)
    // Success: show URL
} catch (e: NetworkException) {
    // Network error: use cached URL if available
    val cachedUrl = localStorage.getLastUrl()
    if (cachedUrl != null) {
        // Show cached version
    } else {
        // Show "offline" message
    }
} catch (e: Exception) {
    // Log to Sentry
    Sentry.captureException(e)
    // Show generic error
}
```

### Crash Reporting
Sentry automatically captures:
- Uncaught exceptions
- ANRs (Application Not Responding)
- Native crashes
- Network errors

Crashes are uploaded with:
- Device info (model, OS version)
- App version
- User ID (if logged in)
- Breadcrumbs (recent actions before crash)

## Testing

### Unit Tests
```bash
./gradlew test
```

Test file structure: `app/src/test/java/app/roam/android/`

Example:
```kotlin
class DiscoveryViewModelTest {
    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()
    
    private lateinit var viewModel: DiscoveryViewModel
    private lateinit var mockRepository: DiscoveryRepository
    
    @Before
    fun setUp() {
        mockRepository = mockk()
        viewModel = DiscoveryViewModel(mockRepository)
    }
    
    @Test
    fun loadingNewUrl_updatesState() {
        // Arrange
        val testUrl = TestData.testUrl
        coEvery { mockRepository.getRandomUrl() } returns testUrl
        
        // Act
        viewModel.loadNextUrl()
        
        // Assert
        assertEquals(viewModel.state.value.currentUrl, testUrl)
    }
}
```

### Instrumented Tests
```bash
./gradlew connectedAndroidTest
```

Test file structure: `app/src/androidTest/java/app/roam/android/`

These run on a real device or emulator and test:
- UI interactions
- Navigation
- Database operations
- API calls

## Permissions

Declared in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

- **INTERNET** — API calls to Supabase
- **ACCESS_NETWORK_STATE** — Detect offline/online status
- **POST_NOTIFICATIONS** — Push notifications (Android 13+)

## Troubleshooting

### Gradle sync fails
```bash
# Clean and rebuild
./gradlew clean
./gradlew sync --refresh-dependencies
```

### APK won't install
```bash
# Check if app already installed
adb uninstall app.roam.android

# Clear cache and retry
./gradlew clean assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Compose preview not rendering
- Android Studio → File → Invalidate Caches → Restart
- Update Compose Compiler version in `build.gradle.kts`

### Crashes on startup
- Check Logcat: Android Studio → Logcat (bottom panel)
- Look for: `AndroidRuntime`, `FATAL EXCEPTION`
- Common issues: Missing Supabase config, invalid JSON parsing

### App won't connect to Supabase
- Verify `buildConfigField` values in `build.gradle.kts`
- Test network: `adb shell ping 8.8.8.8`
- Check Supabase project status at supabase.com/dashboard

## Performance Optimization

### ProGuard Rules
The `proguard-rules.pro` file prevents important classes from being obfuscated:

```proguard
# Keep Supabase classes
-keep class io.supabase.** { *; }

# Keep Kotlin data classes
-keepclassmembers class * {
    *** get*();
    void set*(***);
}

# Keep Sentry classes
-keep class io.sentry.** { *; }
```

### Memory Management
- Use `ViewModel` to survive configuration changes
- Clear large objects in `onCleared()`
- Avoid memory leaks with proper scope binding

### Battery Optimization
- Use WorkManager for background tasks (respects Doze Mode)
- Batch network requests
- Use `CONNECTIVITY_MANAGER` for intelligent sync

## Further Reading

- [Android Development Guide](https://developer.android.com/docs)
- [Jetpack Compose Documentation](https://developer.android.com/jetpack/compose)
- [Supabase Kotlin SDK](https://github.com/supabase-community/supabase-kt)
- [Sentry Android SDK](https://docs.sentry.io/platforms/android/)
- [Material Design 3](https://m3.material.io/)
