package app.roam.android.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Emits `true` when the device has a validated internet connection, `false` otherwise.
 * Uses [ConnectivityManager.NetworkCallback] so it reacts instantly to changes.
 */
fun connectivityFlow(context: Context): Flow<Boolean> = callbackFlow {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { trySend(true) }
        override fun onLost(network: Network) { trySend(cm.isCurrentlyOnline()) }
        override fun onCapabilitiesChanged(
            network: Network,
            caps: NetworkCapabilities,
        ) {
            trySend(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))
        }
    }

    val request = NetworkRequest.Builder()
        .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        .build()

    // Emit current state immediately
    trySend(cm.isCurrentlyOnline())

    cm.registerNetworkCallback(request, callback)
    awaitClose { cm.unregisterNetworkCallback(callback) }
}.distinctUntilChanged()

private fun ConnectivityManager.isCurrentlyOnline(): Boolean {
    val caps = getNetworkCapabilities(activeNetwork) ?: return false
    return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}
