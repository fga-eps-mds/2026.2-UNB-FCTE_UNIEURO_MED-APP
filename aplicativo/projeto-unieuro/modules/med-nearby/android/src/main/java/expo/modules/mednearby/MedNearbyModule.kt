package expo.modules.mednearby

import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.content.Context
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Só aparelhos com este serviço se enxergam. */
private const val SERVICE_ID = "br.unb.med.sincronizacao"

/** Um para um, a estratégia mais rápida. */
private val STRATEGY = Strategy.P2P_POINT_TO_POINT

/**
 * Só repassa chamadas e eventos do Nearby para o JavaScript. A lógica fica em
 * src/features/sincronizacao.
 */
class MedNearbyModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val client: ConnectionsClient
    get() = Nearby.getConnectionsClient(context)

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      val bytes = payload.asBytes() ?: return
      sendEvent("onMessage", Bundle().apply {
        putString("endpointId", endpointId)
        putString("text", String(bytes, Charsets.UTF_8))
      })
    }

    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
  }

  private val connectionCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      sendEvent("onConnectionInitiated", Bundle().apply {
        putString("endpointId", endpointId)
        putString("name", info.endpointName)
        putString("digits", info.authenticationDigits)
        putBoolean("incoming", info.isIncomingConnection)
      })
    }

    override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
      val statusCode = result.status.statusCode
      sendEvent("onConnectionResult", Bundle().apply {
        putString("endpointId", endpointId)
        putBoolean("ok", statusCode == ConnectionsStatusCodes.STATUS_OK)
        putInt("statusCode", statusCode)
      })
    }

    override fun onDisconnected(endpointId: String) {
      sendEvent("onDisconnected", Bundle().apply { putString("endpointId", endpointId) })
    }
  }

  private val discoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      sendEvent("onEndpointFound", Bundle().apply {
        putString("endpointId", endpointId)
        putString("name", info.endpointName)
      })
    }

    override fun onEndpointLost(endpointId: String) {
      sendEvent("onEndpointLost", Bundle().apply { putString("endpointId", endpointId) })
    }
  }

  override fun definition() = ModuleDefinition {
    Name("MedNearby")

    Events(
      "onEndpointFound",
      "onEndpointLost",
      "onConnectionInitiated",
      "onConnectionResult",
      "onDisconnected",
      "onMessage"
    )

    Function("maxMessageBytes") {
      ConnectionsClient.MAX_BYTES_DATA_SIZE
    }

    /** `null` quando não dá para saber. */
    Function("getRadioState") {
      mapOf(
        "bluetooth" to bluetoothEnabled(),
        "wifi" to wifiEnabled(),
        "location" to locationEnabled(),
        "sdkVersion" to Build.VERSION.SDK_INT
      )
    }

    AsyncFunction("startAdvertising") { name: String, promise: Promise ->
      val options = AdvertisingOptions.Builder().setStrategy(STRATEGY).build()
      settle(client.startAdvertising(name, SERVICE_ID, connectionCallback, options), promise)
    }

    AsyncFunction("startDiscovery") { promise: Promise ->
      val options = DiscoveryOptions.Builder().setStrategy(STRATEGY).build()
      settle(client.startDiscovery(SERVICE_ID, discoveryCallback, options), promise)
    }

    AsyncFunction("requestConnection") { name: String, endpointId: String, promise: Promise ->
      settle(client.requestConnection(name, endpointId, connectionCallback), promise)
    }

    AsyncFunction("acceptConnection") { endpointId: String, promise: Promise ->
      settle(client.acceptConnection(endpointId, payloadCallback), promise)
    }

    AsyncFunction("rejectConnection") { endpointId: String, promise: Promise ->
      settle(client.rejectConnection(endpointId), promise)
    }

    AsyncFunction("sendMessage") { endpointId: String, text: String, promise: Promise ->
      val payload = Payload.fromBytes(text.toByteArray(Charsets.UTF_8))
      settle(client.sendPayload(endpointId, payload), promise)
    }

    Function("disconnect") { endpointId: String ->
      client.disconnectFromEndpoint(endpointId)
    }

    Function("stopAll") {
      stopEverything()
    }

    OnDestroy {
      stopEverything()
    }
  }

  private fun stopEverything() {
    val context = appContext.reactContext ?: return
    Nearby.getConnectionsClient(context).apply {
      stopAdvertising()
      stopDiscovery()
      stopAllEndpoints()
    }
  }

  private fun settle(task: Task<Void>, promise: Promise) {
    task
      .addOnSuccessListener { promise.resolve() }
      .addOnFailureListener { error ->
        val statusCode = (error as? ApiException)?.statusCode ?: -1
        promise.reject("ERR_NEARBY_$statusCode", error.message, error)
      }
  }

  // Até o Android 11 a permissão BLUETOOTH do manifesto cobre esta consulta.
  @SuppressLint("MissingPermission")
  private fun bluetoothEnabled(): Boolean? = runCatching {
    val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    manager?.adapter?.isEnabled
  }.getOrNull()

  private fun wifiEnabled(): Boolean? = runCatching {
    val manager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
    manager?.isWifiEnabled
  }.getOrNull()

  private fun locationEnabled(): Boolean? = runCatching {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (manager == null) {
      null
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      manager.isLocationEnabled
    } else {
      manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ||
        manager.isProviderEnabled(LocationManager.GPS_PROVIDER)
    }
  }.getOrNull()
}
