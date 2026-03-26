import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Characteristic, Device } from 'react-native-ble-plx'
import { FallTypeObject } from 'src/helpers/fall-helper'
import { IBloodPressure } from 'src/stores/slices/vitals.slice'

import { useAppSelector } from '../hooks'
import { RootState } from '../store'

export type IPeripheralDevices = {
  other: Device[]
  connected: Device[]
}

type IConnectDevice = {
  isInternetConnected: boolean
  isEnabledScreens: boolean
  isBleScanning?: boolean
  isDeviceConnected?: boolean
  activeDeviceId?: string | null
  otherDevices: Device[]
  connectedDevices: Device[]
  battery: number | null
  temperature: number | null
  heartRate: number | null
  respirationRate: number | null
  spo: number | null
  fall: number | null
  fallType: FallTypeObject | null
  bloodPressure: IBloodPressure | null
  temperatureHex: string | null
  heartRateHex: string | null
  respirationRateHex: string | null
  spoHex: string | null
  publicKey: string | null
  char0003: Characteristic | null
  char0002: Characteristic | null
  userIdState: string
  isUserIdSet: boolean
  isStrangeErrorBle: boolean
  ppgData: number[]
  logFilePath: string
  deviceSerial: string | null
}

const initialState: IConnectDevice = {
  isInternetConnected: true,
  isEnabledScreens: false,
  isBleScanning: false,
  isDeviceConnected: false,
  activeDeviceId: null,
  otherDevices: [],
  connectedDevices: [],
  battery: null,
  temperature: null,
  heartRate: null,
  respirationRate: null,
  spo: null,
  fall: null,
  fallType: null,
  bloodPressure: null,
  temperatureHex: null,
  heartRateHex: null,
  respirationRateHex: null,
  spoHex: null,
  publicKey: null,
  char0003: null,
  char0002: null,
  userIdState: '',
  isUserIdSet: false,
  isStrangeErrorBle: false,
  ppgData: [],
  logFilePath: '',
  deviceSerial: null,
}

const connectDeviceSlice = createSlice({
  name: 'ConnectDevice',
  initialState,
  reducers: {
    setLogFilePath: (state, { payload }: PayloadAction<string>) => {
      state.logFilePath = payload
    },
    setPpgData: (state, { payload }: PayloadAction<number[]>) => {
      state.ppgData = payload
    },
    cleanPpgData: (state) => {
      state.ppgData = []
    },
    addElementToPpgData: (state, { payload }: PayloadAction<number>) => {
      state.ppgData.push(payload)
    },
    setIsStrangeErrorBle: (state, { payload }: PayloadAction<boolean>) => {
      state.isStrangeErrorBle = payload
    },
    setUserIdState: (state, { payload }: PayloadAction<string>) => {
      state.userIdState = payload
    },
    setIsUserIdSet: (state, { payload }: PayloadAction<boolean>) => {
      state.isUserIdSet = payload
    },
    setChar0003: (state, { payload }: PayloadAction<Characteristic>) => {
      state.char0003 = payload
    },
    setChar0002: (state, { payload }: PayloadAction<Characteristic>) => {
      state.char0002 = payload
    },
    setIsEnabledScreens: (state, { payload }: PayloadAction<boolean>) => {
      state.isEnabledScreens = payload
    },
    setIsInternetConnection: (state, { payload }: PayloadAction<boolean>) => {
      state.isInternetConnected = payload
    },
    setIsBleScanning: (state, { payload }: PayloadAction<boolean>) => {
      state.isBleScanning = payload
    },
    setOtherDevices: (state, { payload }: PayloadAction<Device[]>) => {
      state.otherDevices = payload
    },
    setConnectedDevices: (state, { payload }: PayloadAction<Device[]>) => {
      state.connectedDevices = payload
    },
    setIsDeviceConnected: (state, { payload }: PayloadAction<boolean>) => {
      state.isDeviceConnected = payload
    },
    setActiveDeviceId: (state, { payload }: PayloadAction<string | null>) => {
      state.activeDeviceId = payload
    },
    cleanDeviceData: (state: IConnectDevice) => {
      state.otherDevices = initialState.otherDevices
      state.connectedDevices = initialState.otherDevices

      state.userIdState = initialState.userIdState
      state.char0002 = initialState.char0002
      state.char0003 = initialState.char0003
      state.isUserIdSet = initialState.isUserIdSet
      state.publicKey = initialState.publicKey

      state.isDeviceConnected = initialState.isDeviceConnected
      state.activeDeviceId = initialState.activeDeviceId
      state.isBleScanning = initialState.isBleScanning

      state.heartRate = initialState.heartRate
      state.battery = initialState.battery
      state.bloodPressure = initialState.bloodPressure
      state.temperature = initialState.temperature
      state.spo = initialState.spo
      state.respirationRate = initialState.respirationRate

      state.heartRateHex = initialState.heartRateHex
      state.temperatureHex = initialState.temperatureHex
      state.spoHex = initialState.spoHex
      state.fall = initialState.fall
      state.respirationRateHex = initialState.respirationRateHex
      state.deviceSerial = initialState.deviceSerial
    },
    setBattery: (state, { payload }: PayloadAction<number | null>) => {
      state.battery = payload
    },
    setTemperature: (state, { payload }: PayloadAction<number | null>) => {
      state.temperature = payload
    },
    setHeartRate: (state, { payload }: PayloadAction<number | null>) => {
      state.heartRate = payload
    },
    setRespirationRate: (state, { payload }: PayloadAction<number | null>) => {
      state.respirationRate = payload
    },
    setSpo: (state, { payload }: PayloadAction<number | null>) => {
      state.spo = payload
    },
    setFall: (state, { payload }: PayloadAction<number | null>) => {
      state.fall = payload
    },
    setFallType: (state, { payload }: PayloadAction<FallTypeObject>) => {
      state.fallType = payload
    },
    setBloodPressure: (state, { payload }: PayloadAction<IBloodPressure | null>) => {
      state.bloodPressure = payload
    },
    setTempHex: (state, { payload }: PayloadAction<string | null>) => {
      state.temperatureHex = payload
    },
    setHrHex: (state, { payload }: PayloadAction<string | null>) => {
      state.heartRateHex = payload
    },
    setRrHex: (state, { payload }: PayloadAction<string | null>) => {
      state.respirationRateHex = payload
    },
    setSpoHex: (state, { payload }: PayloadAction<string | null>) => {
      state.spoHex = payload
    },
    setPublicKey: (state, { payload }: PayloadAction<string | null>) => {
      state.publicKey = payload
    },
    setDeviceSerial: (state, { payload }: PayloadAction<string | null>) => {
      state.deviceSerial = payload
    },
  },
})

export const selectIsEnabledScreens = (state: RootState) => state.connectDevice.isEnabledScreens
export const selectIsInternetConnection = (state: RootState) => state.connectDevice.isInternetConnected
export const selectIsBleScanning = (state: RootState) => state.connectDevice.isBleScanning
export const selectIsDeviceConnected = (state: RootState) => state.connectDevice.isDeviceConnected
export const selectActiveDeviceId = (state: RootState) => state.connectDevice.activeDeviceId
export const selectOtherDevices = (state: RootState) => state.connectDevice.otherDevices
export const selectConnectedDevices = (state: RootState) => state.connectDevice.connectedDevices
export const selectBattery = (state: RootState) => state.connectDevice.battery
export const selectTemperature = (state: RootState) => state.connectDevice.temperature
export const selectHeartRate = (state: RootState) => state.connectDevice.heartRate
export const selectRespirationRate = (state: RootState) => state.connectDevice.respirationRate
export const selectSpo = (state: RootState) => state.connectDevice.spo
export const selectFall = (state: RootState) => state.connectDevice.fall
export const selectFallType = (state: RootState) => state.connectDevice.fallType
export const selectBloodPressure = (state: RootState) => state.connectDevice.bloodPressure
export const selectTempHex = (state: RootState) => state.connectDevice.temperatureHex
export const selectHrHex = (state: RootState) => state.connectDevice.heartRateHex
export const selectRrHex = (state: RootState) => state.connectDevice.respirationRateHex
export const selectSpoHex = (state: RootState) => state.connectDevice.spoHex
export const selectPublicKey = (state: RootState) => state.connectDevice.publicKey
export const selectChar0003 = (state: RootState) => state.connectDevice.char0003
export const selectChar0002 = (state: RootState) => state.connectDevice.char0002
export const selectUserIdState = (state: RootState) => state.connectDevice.userIdState
export const selectIsUserIdSet = (state: RootState) => state.connectDevice.isUserIdSet
export const selectIsStrangeErrorBle = (state: RootState) => state.connectDevice.isStrangeErrorBle
export const selectPpgData = (state: RootState) => state.connectDevice.ppgData
export const selectDeviceSerial = (state: RootState) => state.connectDevice.deviceSerial
export const selectLogFilePath = (state: RootState) => state.connectDevice.logFilePath

export const useDeviceSerial = () => useAppSelector(selectDeviceSerial)
export const useLogFilePath = () => useAppSelector(selectLogFilePath)
export const usePpgData = () => useAppSelector(selectPpgData)
export const useIsStrangeErrorBle = () => useAppSelector(selectIsStrangeErrorBle)
export const useIsEnabledScreens = () => useAppSelector(selectIsEnabledScreens)
export const useIsInternetConnected = () => useAppSelector(selectIsInternetConnection)
export const useIsBleScanning = () => useAppSelector(selectIsBleScanning)
export const useIsDeviceConnected = () => useAppSelector(selectIsDeviceConnected)
export const useActiveDeviceId = () => useAppSelector(selectActiveDeviceId)
export const useOtherDevices = () => useAppSelector(selectOtherDevices)
export const useConnectedDevices = () => useAppSelector(selectConnectedDevices)
export const useBattery = () => useAppSelector(selectBattery)
export const useTemperature = () => useAppSelector(selectTemperature)
export const useHeartRate = () => useAppSelector(selectHeartRate)
export const useRespirationRate = () => useAppSelector(selectRespirationRate)
export const useSpo = () => useAppSelector(selectSpo)
export const useFall = () => useAppSelector(selectFall)
export const useFallType = () => useAppSelector(selectFallType)
export const useBloodPressure = () => useAppSelector(selectBloodPressure)
export const useTempHex = () => useAppSelector(selectTempHex)
export const useHrHex = () => useAppSelector(selectHrHex)
export const useRrHex = () => useAppSelector(selectRrHex)
export const useSpoHex = () => useAppSelector(selectSpoHex)
export const usePublicKey = () => useAppSelector(selectPublicKey)
export const useChar0003 = () => useAppSelector(selectChar0003)
export const useChar0002 = () => useAppSelector(selectChar0002)
export const useUserIdState = () => useAppSelector(selectUserIdState)
export const useIsUserIdSet = () => useAppSelector(selectIsUserIdSet)

export const {
  reducer: connectDeviceReducer,
  actions: {
    setIsBleScanning,
    setIsDeviceConnected,
    setActiveDeviceId,
    setOtherDevices,
    setBattery,
    setTemperature,
    setHeartRate,
    setRespirationRate,
    setSpo,
    setFall,
    setBloodPressure,
    setHrHex,
    setTempHex,
    setRrHex,
    setSpoHex,
    setConnectedDevices,
    setIsInternetConnection,
    setIsEnabledScreens,
    setPublicKey,
    setChar0003,
    setChar0002,
    setUserIdState,
    setIsUserIdSet,
    cleanDeviceData,
    setIsStrangeErrorBle,
    setPpgData,
    addElementToPpgData,
    cleanPpgData,
    setLogFilePath,
    setFallType,
    setDeviceSerial,
  },
} = connectDeviceSlice
