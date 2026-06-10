package app.roam.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.lifecycle.viewModelScope
import app.roam.android.data.repository.RoamRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FCMService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "roam_notifications"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    /**
     * Called when a new FCM token is generated.
     * Register it with our backend so push notifications can be delivered.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                RoamRepository().registerPushToken(token)
            }
        }
    }

    /**
     * Called when a push message is received while the app is in the foreground.
     * Background messages are handled automatically by the OS (lock screen + tray).
     * The notification row is already in the DB — we just need to refresh local state.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Data messages carry the notification payload; notification messages
        // are handled by the OS automatically (tray + lock screen).
        if (remoteMessage.data.isNotEmpty()) {
            // The notification was created by the DB trigger. The push just
            // alerts the device. We don't need to insert anything locally.
            // If the app has an active MainViewModel, notify it to refresh.
            // For now, the next time the user opens the NotificationsScreen,
            // it will fetch fresh data from the server.
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Submissions",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications about your URL submissions"
                setSound(null, null)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}