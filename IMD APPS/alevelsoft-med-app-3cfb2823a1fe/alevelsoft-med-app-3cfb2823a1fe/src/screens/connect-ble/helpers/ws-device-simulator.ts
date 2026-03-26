/**
 * WebSocket Device Simulator
 *
 * Connects to the Zenzer Device Emulator over WebSocket and dispatches
 * vitals to Redux — same actions as real BLE notifications.
 * Activated when SIMULATION_MODE=true in .env.
 *
 * Flow: startSimulationScan → user picks device → connectToDevice → pair
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
  setSimulatedDevices,
  setSimulationPairStatus,
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

export interface SimulatedDevice {
  id: number
  name: string
  serialNumber: string
  macAddress: string
  modelNumber: string
  rssi: number
}

export function isSimulationMode(): boolean {
  return Boolean(Config.SIMULATION_MODE && +Config.SIMULATION_MODE)
}

function getEmulatorUrl(): string {
  return Config.DEVICE_EMULATOR_URL || DEFAULT_EMULATOR_URL
}

/**
 * Start scanning for emulated devices (does NOT auto-connect).
 * Discovered devices are dispatched to Redux for the UI to display.
 */
export function startSimulationScan(dispatch: Dispatch): void {
  const baseUrl = getEmulatorUrl()
  console.log(`[Simulator] Scanning for devices at ${baseUrl}/scan`)

  dispatch(setIsDeviceConnected(false))
  dispatch(setSimulatedDevices([]))

  scanSocket = new WebSocket(`${baseUrl}/scan`)

  scanSocket.onopen = () => {
    console.log('[Simulator] Scan connection established')
  }

  scanSocket.onmessage = (event) => {
    try {
      const devices: SimulatedDevice[] = JSON.parse(event.data as string)
      dispatch(setSimulatedDevices(devices))
    } catch (err) {
      console.error('[Simulator] Scan parse error:', err)
    }
  }

  scanSocket.onerror = (err) => {
    console.error('[Simulator] Scan error:', err)
  }

  scanSocket.onclose = () => {
    console.log('[Simulator] Scan connection closed')
  }
}

/**
 * Connect to a specific emulated device chosen by the user.
 */
export function connectToDevice(dispatch: Dispatch, deviceId: number): void {
  const baseUrl = getEmulatorUrl()
  closeScan()
  dispatch(setSimulationPairStatus('connecting'))

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
      } else if (msg.type === 'pair-ack') {
        console.log(`[Simulator] Pair acknowledged: ${msg.status}`)
        dispatch(setSimulationPairStatus(msg.status === 'paired' ? 'paired' : 'idle'))
      }
    } catch {
      // Ignore non-JSON (BLE notification messages)
    }
  }

  deviceSocket.onerror = (err) => {
    console.error(`[Simulator] Device ${deviceId} error:`, err)
    dispatch(setSimulationPairStatus('idle'))
  }

  deviceSocket.onclose = () => {
    console.log(`[Simulator] Device ${deviceId} disconnected`)
    dispatch(setIsDeviceConnected(false))
    dispatch(setSimulationPairStatus('idle'))
  }
}

/**
 * Send pair command to the currently connected emulated device.
 */
export function pairDevice(userId: string): void {
  if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
    deviceSocket.send(JSON.stringify({ action: 'pair', userId }))
    console.log(`[Simulator] Sent pair command for user ${userId}`)
  }
}

/**
 * Disconnect from the current emulated device.
 */
export function disconnectSimulatedDevice(dispatch: Dispatch): void {
  if (deviceSocket) {
    deviceSocket.onclose = null
    deviceSocket.close()
    deviceSocket = null
  }
  dispatch(setIsDeviceConnected(false))
  dispatch(setActiveDeviceId(null))
  dispatch(setSimulationPairStatus('idle'))
  dispatch(setDeviceSerial(null))
  console.log('[Simulator] Device disconnected')
}

// --- Legacy API (kept for backward compatibility with drawer.stack.tsx) ---

/** @deprecated Use startSimulationScan instead */
export function startSimulation(dispatch: Dispatch): void {
  startSimulationScan(dispatch)
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
  dispatch(setSimulatedDevices([]))
  dispatch(setSimulationPairStatus('idle'))
  console.log('[Simulator] Stopped')
}
