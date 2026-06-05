import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
    id("io.sentry.android.gradle") version "6.9.0"
}

android {
    namespace = "app.roam.android"
    compileSdk = 35

    // Load local.properties once — used in both defaultConfig and buildTypes
    val localProperties = Properties()
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { localProperties.load(it) }
    }

    defaultConfig {
        applicationId = "app.roam.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 7
        versionName = "1.0.6"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Supabase credentials from local.properties (never committed)
        buildConfigField(
            "String", "SUPABASE_URL",
            "\"${localProperties["SUPABASE_URL"] ?: ""}\""
        )
        buildConfigField(
            "String", "SUPABASE_ANON_KEY",
            "\"${localProperties["SUPABASE_ANON_KEY"] ?: ""}\""
        )
        buildConfigField(
            "String", "SENTRY_DSN",
            "\"${localProperties["SENTRY_DSN"] ?: ""}\""
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Signing credentials are read from Gradle user-home properties
            // (~/.gradle/gradle.properties) so they are never stored inside the repo.
            // For CI, set the four ROAM_* properties as environment variables or
            // inject them via a secrets manager.
            val storeFile     = providers.gradleProperty("ROAM_RELEASE_STORE_FILE").orNull
            val storePassword = providers.gradleProperty("ROAM_RELEASE_STORE_PASSWORD").orNull
            val keyAlias      = providers.gradleProperty("ROAM_RELEASE_KEY_ALIAS").orNull
            val keyPassword   = providers.gradleProperty("ROAM_RELEASE_KEY_PASSWORD").orNull
            if (storeFile != null && storePassword != null && keyAlias != null && keyPassword != null) {
                signingConfig = signingConfigs.create("release").also { cfg ->
                    cfg.storeFile     = file(storeFile)
                    cfg.storePassword = storePassword
                    cfg.keyAlias      = keyAlias
                    cfg.keyPassword   = keyPassword
                }
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

val supabaseBom = "3.0.2"
val composeBom = "2024.12.01"

dependencies {
    // Compose BOM
    implementation(platform("androidx.compose:compose-bom:$composeBom"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Core Android
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // Supabase
    implementation(platform("io.github.jan-tennert.supabase:bom:$supabaseBom"))
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:functions-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.ktor:ktor-client-okhttp:3.0.3")

    // Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Image loading (Coil 3 — Compose-native, supports async + crossfade)
    implementation("io.coil-kt.coil3:coil-compose:3.1.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.1.0")

    // Error tracking
    implementation("io.sentry:sentry-android:7.22.1")

    // Baseline profiles — install AOT-compiled profile on first launch
    implementation("androidx.profileinstaller:profileinstaller:1.3.1")

    // Test
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("io.mockk:mockk:1.13.12")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:$composeBom"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

sentry {
    // Upload source maps to Sentry for readable stack traces.
    // Requires SENTRY_AUTH_TOKEN env var at release build time (CI only).
    // Set to false locally to skip the upload step.
    autoUploadProguardMapping.set(System.getenv("SENTRY_AUTH_TOKEN") != null)
    uploadNativeSymbols.set(false)
}
