# Add project specific ProGuard rules here.
-keep class app.roam.android.** { *; }
-keep class io.github.jan.supabase.** { *; }
-keepclassmembers class ** {
    @kotlinx.serialization.Serializable *;
}
