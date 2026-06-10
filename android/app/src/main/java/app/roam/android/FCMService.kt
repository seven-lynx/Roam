package app.roam.android

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import app.roam.android.data.repository.RoamRepository
import app.roam.android.data.supabase
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.sentry.Sentry
import io.sentry.Breadcrumb
import io.sentry.SentryLevel
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

class FCMService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "roam_notifications"
        private const val PREFS_NAME = "roam_fcm"
        private const val PENDING_TOKEN_KEY = "pending_fcm_token"
        private const val NOTIFY_ID_BASE = 1000
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        // Deferred registration: if a token was stored before auth was ready, register it now
        registerPendingTokenIfReady()
    }

    /**
     * Called when a new FCM token is generated.
     * If the user is authenticated, register immediately. Otherwise store the
     * token in SharedPreferences and register once auth is available.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PENDING_TOKEN_KEY, token).apply()
        Sentry.addBreadcrumb(Breadcrumb().apply {
            this.message = "FCM token received"
            this.level = SentryLevel.INFO
            this.setData("token_prefix", token.take(10))
        })
        registerPendingTokenIfReady()
    }

    /**
     * Attempts to register a pending FCM token if one is stored and the user
     * session is authenticated. Called from both onCreate (cold-start catch-up)
     * and onNewToken (fresh token).
     */
    private fun registerPendingTokenIfReady() {
        CoroutineScope(Dispatchers.IO).launch {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val pendingToken = prefs.getString(PENDING_TOKEN_KEY, null) ?: return@launch

            // If notifications are disabled by the user, don't register the token
            val notifyPrefs = getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
            if (!notifyPrefs.getBoolean("notifications_enabled", true)) {
                return@launch
            }

            // Wait up to 10 seconds for the session to become authenticated.
            // On cold starts, Supabase session restoration can take a few seconds.
            try {
                withTimeout(10_000) {
                    supabase.auth.sessionStatus
                        .map { status -> status is SessionStatus.Authenticated }
                        .first { it }
                }
            } catch (_: Exception) {
                // Session never became authenticated — leave the pending token for next launch
                return@launch
            }

            val repo = RoamRepository()
            val success = runCatching { repo.registerPushToken(pendingToken) }.isSuccess
            if (success) {
                prefs.edit().remove(PENDING_TOKEN_KEY).apply()
                Sentry.addBreadcrumb(Breadcrumb().apply {
                    this.message = "FCM token registered with server"
                    this.level = SentryLevel.INFO
                })
            } else {
                Sentry.addBreadcrumb(Breadcrumb().apply {
                    this.message = "FCM token registration failed"
                    this.level = SentryLevel.WARNING
                })
            }
            // On failure, keep the pending token for next attempt
        }
    }

    /**
     * Called when a push message is received.
     *
     * Background: the OS automatically displays the notification from the
     *   notification payload (tray + lock screen).
     *
     * Foreground: we must manually post a system notification. Otherwise the
     *   message is silently dropped and the user only sees it when opening the
     *   in-app NotificationsScreen.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        // Check if the user has disabled notifications in settings
        val notifyPrefs = getSharedPreferences("roam_saved", Context.MODE_PRIVATE)
        if (!notifyPrefs.getBoolean("notifications_enabled", true)) return

        // Extract notification content. FCM notification messages have the
        // title/body in remoteMessage.notification; data-only messages carry
        // them in remoteMessage.data.
        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Roam"
        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: return // nothing to show

        Sentry.addBreadcrumb(Breadcrumb().apply {
            this.message = "FCM push message received"
            this.level = SentryLevel.INFO
            this.setData("title", title)
        })
        showNotification(title, body, remoteMessage.data)
    }

    /**
     * Posts a system notification so the user sees it even when the app is
     * in the foreground.
     */
    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>,
    ) {
        // Open MainActivity when the notification is tapped. Include any URL
        // from the notification data so the app can deep-link to the right page.
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("from_notification", true)
            data["url"]?.let { putExtra("notification_url", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            NOTIFY_ID_BASE + System.currentTimeMillis().toInt().and(0xFFFF),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(
            (NOTIFY_ID_BASE + System.currentTimeMillis().toInt()).and(0xFFFF),
            notification,
        )
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Notifications",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications about your submissions, followers, and activity"
                // Keep sound null for a silent channel — the FCM payload
                // specifies sound: 'default' on the android config which will
                // override this for system-managed (background) notifications.
                setSound(null, null)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
