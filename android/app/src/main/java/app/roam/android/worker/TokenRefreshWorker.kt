package app.roam.android.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.roam.android.data.supabase
import io.github.jan.supabase.auth.auth
import java.util.concurrent.TimeUnit

/**
 * Silently refreshes the Supabase access token every 12 hours.
 * Ensures the user stays logged in even if the app is backgrounded for a day.
 */
class TokenRefreshWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result =
        runCatching { supabase.auth.refreshCurrentSession() }
            .fold(
                onSuccess = { Result.success() },
                onFailure = { Result.retry() },
            )

    companion object {
        private const val WORK_NAME = "roam_token_refresh"

        /** Schedules a periodic refresh; no-op if already scheduled (KEEP policy). */
        fun schedule(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<TokenRefreshWorker>(12, TimeUnit.HOURS).build(),
            )
        }
    }
}
