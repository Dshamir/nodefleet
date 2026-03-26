import AsyncStorage from '@react-native-async-storage/async-storage'
import { Dispatch } from '@reduxjs/toolkit'
import { MutableRefObject } from 'react'
import { Characteristic, Device, Subscription } from 'react-native-ble-plx'
import { Config } from 'react-native-config'
import { transformToHex } from 'src/helpers/buffer-helper'
import { calculateCH3 } from 'src/screens/connect-ble/helpers/calculateCH3'
import { decryptAnswer, encryptMessage, keyToBytes } from 'src/screens/connect-ble/helpers/helper-functions'
import { stopScan } from 'src/screens/connect-ble/helpers/start-scan-ble'
import {
  activateStreamingData,
  activateUserIdMode,
  setUserIdToDevice,
  startStreaming,
  UserIdAction,
  UserIdState,
} from 'src/screens/connect-ble/helpers/user-id-mode'
import {
  setActiveDeviceId,
  setChar0002,
  setChar0003,
  setConnectedDevices,
  setDeviceSerial,
  setIsDeviceConnected,
  setIsUserIdSet,
  setPublicKey,
  setUserIdState,
} from 'src/stores/slices/connect-device.slice'

import { bleManager } from '../ConnectBle'
import { setNotifyCharacteristics } from './set-notify-characteristics'

type FilteredCharacteristic = { notify: Characteristic[]; write: Characteristic[] }
const defaultFilteredCharacteristic: FilteredCharacteristic = {
  notify: [],
  write: [],
}

let pubKey: string | null = null
let streamingKey: string | null = null
let isUserIdSetup: boolean | null = false
let isActivatedStreamingData: boolean | null = false
let userIdState: string | null = null
let isStreaming: boolean = false

let temporaryPpgData: number[] = []

export const setupTemporaryPpgData = (ppgElement: number) => {
  temporaryPpgData.push(ppgElement)
}

export const cleanTemporaryPpgData = () => {
  temporaryPpgData = []
}

export const getTemporaryPpgData = () => {
  return temporaryPpgData
}

export const connectDevice = async (
  dispatch: Dispatch,
  device: Device | null,
  deviceConnectionListener: MutableRefObject<Subscription | undefined>,
  userId: string,
) => {
  if (device === null) {
    return
  }

  const deviceObject = await bleManager.connectToDevice(device.id, { autoConnect: true })

  deviceObject.onDisconnected(() => {
    dispatch(setIsDeviceConnected(false))
    deviceConnectionListener.current && deviceConnectionListener.current?.remove()
    deviceConnectionListener.current = undefined
  })

  const isDeviceConnected = await deviceObject.isConnected()

  if (isDeviceConnected) {
    stopScan(dispatch)
    dispatch(setIsDeviceConnected(true))
    dispatch(setActiveDeviceId(device.id))
    dispatch(setConnectedDevices([]))
    dispatch(setConnectedDevices([device]))

    await AsyncStorage.setItem('deviceId', device.id)

    await deviceObject.discoverAllServicesAndCharacteristics()
    const services = await deviceObject.services()
    const characteristics: Characteristic[][] = []

    services.forEach((service, index) => {
      service.characteristics().then(async (c) => {
        characteristics.push(c)

        if (index === services.length - 1) {
          const temp = characteristics.reduce((acc, current) => {
            return [...acc, ...current]
          }, [])

          const filteredCharacteristics: FilteredCharacteristic = temp.reduce(
            (acc: FilteredCharacteristic, item: Characteristic) => {
              if (item.isNotifiable) {
                item.isNotifying = true
                acc.notify.push(item)
              } else if (item.isReadable) {
                acc.write.push(item)
              }

              return acc
            },
            defaultFilteredCharacteristic,
          )

          const characteristic00002 = temp.find((char) => char.uuid === Config.CHAR_USER_ID_UUID)
          const characteristic00003 = filteredCharacteristics.notify.find((char) => char.uuid === Config.RAW_DATA_UUID)

          // Activate userId mode
          if (characteristic00002 && characteristic00003 && pubKey === null) {
            activateUserIdMode(characteristic00002)
          }

          if (characteristic00002 && characteristic00003) {
            characteristic00003.isNotifying = true

            dispatch(setChar0003(characteristic00003))
            dispatch(setChar0002(characteristic00002))

            if (!isStreaming) {
              characteristic00003.monitor((error, result) => {
                if (error) {
                  return
                }

                if (
                  characteristic00002 &&
                  isActivatedStreamingData &&
                  characteristic00003?.uuid === result?.uuid &&
                  device.name &&
                  !streamingKey
                ) {
                  streamingKey = transformToHex(result?.value).substring(2, 34)
                  enableStreaming(characteristic00002, userId, device.name)
                }

                if (result && pubKey === null) {
                  pubKey = transformToHex(result?.value).substring(2, 34)
                  dispatch(setPublicKey(transformToHex(result?.value).substring(2, 34)))
                }

                if (pubKey && device.name && isUserIdSetup && !isActivatedStreamingData) {
                  const pubKeyBytes = keyToBytes(pubKey)
                  const answerBytes = keyToBytes(transformToHex(result?.value).substring(2, 34))

                  userIdState = decryptAnswer(answerBytes, pubKeyBytes, device.name)
                  dispatch(setUserIdState(decryptAnswer(answerBytes, pubKeyBytes, device.name)))
                }

                if (userIdState === UserIdState.userIdSet && !isActivatedStreamingData) {
                  isActivatedStreamingData = true
                  activateStreamingData(characteristic00002)
                }

                // send command with userId and action `set_user_id` to device
                if (device.name && !isUserIdSetup) {
                  setUserId(characteristic00002, userId, device.name, () => {
                    isUserIdSetup = true
                    dispatch(setIsUserIdSet(true))
                  })
                }
              })
            }
          }

          // setCharsWrite(filteredCharacteristics.write)

          filteredCharacteristics.notify.map((characteristic) => {
            characteristic.isNotifying = true

            if (userIdState !== UserIdState.userIdAlready) {
              characteristic.monitor((errorBle, resultBle) => {
                if (errorBle) {
                  return
                }

                if (resultBle?.uuid === characteristic00003?.uuid && resultBle?.value?.startsWith('+', 0)) {
                  // saveStringToFile(getRawDataBy21Bytes(resultBle?.value), 'FA_zenzers_logs_AF', dispatch)

                  const ppgElement = calculateCH3(resultBle?.value) ?? 0

                  if (ppgElement !== 0) {
                    setupTemporaryPpgData(ppgElement)
                  }
                }

                setNotifyCharacteristics(dispatch, resultBle?.value, characteristic.uuid)
              })
            }
          })

          const getWithForOf = async () => {
            const data = []

            for (const characteristic of filteredCharacteristics.write) {
              const result = await characteristic.read()

              data.push(result)
            }
          }

          await getWithForOf()
        }
      })
    })
  } else {
    console.log(deviceObject)
  }
}

const setUserId = (characteristic00002: Characteristic, userId: string, deviceName: string, callback: () => void) => {
  if (pubKey) {
    const pubKeyBytes = keyToBytes(pubKey)
    const encrypted = encryptMessage(UserIdAction.setUserId, pubKeyBytes, deviceName)

    callback()
    setUserIdToDevice(characteristic00002, userId, encrypted)
  } else {
    throw new Error('ERROR set UserId To Device')
  }
}

const enableStreaming = (characteristic00002: Characteristic, userId: string, deviceName: string) => {
  if (streamingKey) {
    const streamingKeyBytes = keyToBytes(streamingKey)

    const encrypted = encryptMessage('streaming_id', streamingKeyBytes, deviceName)

    startStreaming(characteristic00002, userId, encrypted)
    isStreaming = true
  } else {
    throw new Error('ERROR enable Streaming')
  }
}
