/**
 * WebSocket Device Simulator
 *
 * Connects to the Zenzer Device Emulator over WebSocket and dispatches
 * vitals to Redux — same actions as real BLE notifications.
 * Activated when SIMULATION_MODE=true in .env.
 */
import { Dispatch } from '@reduxjs/toolkit'
import { Config } from 'react-native-config'

import {
  setBattery,
  setDeviceSerial,
  setHeartRate,
  setRespirationRate,
  setSpo,
  setTemperature,
  setFall,
  setIsDeviceConnected,
  setActiveDeviceId,
  setBloodPressure,
} from 'src/stores/slices/connect-device.slice'

// Default: Android emulator → host machine at mapped Docker port
const DEFAULT_EMULATOR_URL = 'ws://10.0.2.2:48765'

let scanSocket: WebSocket | null = null
let deviceSocket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

interface EmulatorVitals {
  type: 'vitals'
  hr: number
  spo2: number
  temp: number
  rr: number
  sbp: number
  dbp: number
  battery: number
  fall: boolean
  fallType: number | null
  timestamp: number
}

export function isSimulationMode(): boolean {
  return Boolean(Config.SIMULATION_MODE && +Config.SIMULATION_MODE)
}

function getEmulatorUrl(): string {
  return Config.DEVICE_EMULATOR_URL || DEFAULT_EMULATOR_URL
}

export function startSimulation(dispatch: Dispatch): void {
  const baseUrl = getEmulatorUrl()
  console.log(`[Simulator] Connecting to device emulator at ${baseUrl}/scan`)

  dispatch(setIsDeviceConnected(false))

  scanSocket = new WebSocket(`${baseUrl}/scan`)

  scanSocket.onopen = () => {
    console.log('[Simulator] Scan connection established')
  }

  scanSocket.onmessage = (event) => {
    try {
      const devices = JSON.parse(event.data as string)
      if (devices.length > 0) {
        // Connect to the first available device
        const device = devices[0]
        console.log(`[Simulator] Found device: ${device.name} (id=${device.id})`)
        closeScan()
        connectToEmulatedDevice(dispatch, device.id, baseUrl)
      }
    } catch (err) {
      console.error('[Simulator] Scan parse error:', err)
    }
  }

  scanSocket.onerror = (err) => {
    console.error('[Simulator] Scan error:', err)
    scheduleReconnect(dispatch)
  }

  scanSocket.onclose = () => {
    console.log('[Simulator] Scan connection closed')
  }
}

function connectToEmulatedDevice(dispatch: Dispatch, deviceId: number, baseUrl: string): void {
  console.log(`[Simulator] Connecting to device ${deviceId}`)

  deviceSocket = new WebSocket(`${baseUrl}/device/${deviceId}`)

  deviceSocket.onopen = () => {
    console.log(`[Simulator] Connected to emulated device ${deviceId}`)
    dispatch(setIsDeviceConnected(true))
    dispatch(setActiveDeviceId(`emulator-${deviceId}`))
  }

  deviceSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string)
      if (msg.type === 'device-info' && msg.serialNumber) {
        dispatch(setDeviceSerial(msg.serialNumber))
        console.log(`[Simulator] Device serial: ${msg.serialNumber}`)
      } else if (msg.type === 'vitals') {
        dispatchVitals(dispatch, msg as EmulatorVitals)
      }
    } catch {
      // Ignore non-JSON (BLE notification messages)
    }
  }

  deviceSocket.onerror = (err) => {
    console.error(`[Simulator] Device ${deviceId} error:`, err)
  }

  deviceSocket.onclose = () => {
    console.log(`[Simulator] Device ${deviceId} disconnected`)
    dispatch(setIsDeviceConnected(false))
    scheduleReconnect(dispatch)
  }
}

function dispatchVitals(dispatch: Dispatch, vitals: EmulatorVitals): void {
  dispatch(setHeartRate(Math.round(vitals.hr)))
  dispatch(setSpo(vitals.spo2))
  dispatch(setTemperature(vitals.temp))
  dispatch(setRespirationRate(vitals.rr))
  dispatch(setBattery(vitals.battery))
  dispatch(setFall(vitals.fall ? 1 : 0))
  dispatch(
    setBloodPressure({
      sbp: vitals.sbp,
      dbp: vitals.dbp,
    }),
  )
}

function closeScan(): void {
  if (scanSocket) {
    scanSocket.onclose = null // Prevent reconnect on intentional close
    scanSocket.close()
    scanSocket = null
  }
}

function scheduleReconnect(dispatch: Dispatch): void {
  if (reconnectTimer) return
  console.log('[Simulator] Reconnecting in 5s...')
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    startSimulation(dispatch)
  }, 5000)
}

export function stopSimulation(dispatch: Dispatch): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  closeScan()
  if (deviceSocket) {
    deviceSocket.onclose = null
    deviceSocket.close()
    deviceSocket = null
  }
  dispatch(setIsDeviceConnected(false))
  dispatch(setActiveDeviceId(null))
  console.log('[Simulator] Stopped')
}
