package app.roam.android

import android.app.Application
import app.roam.android.data.supabase

class RoamApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialise the Supabase singleton eagerly so the client is ready
        // before any Activity or ViewModel touches it.
        supabase
    }
}
