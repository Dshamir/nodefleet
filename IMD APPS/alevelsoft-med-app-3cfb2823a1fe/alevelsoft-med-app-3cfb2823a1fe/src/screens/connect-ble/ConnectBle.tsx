import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Alert, Linking, SectionList, Text, TouchableOpacity, View } from 'react-native'
import { BleManager, Device, Subscription } from 'react-native-ble-plx'
import FastImage from 'react-native-fast-image'
import RNFS from 'react-native-fs'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Alert as CustomAlert } from 'src/components/alert'
import { ConnectionLostLabel } from 'src/components/connection-lost-label'
import { Header } from 'src/components/header'
import { constants } from 'src/constants'
import { HomeStackParamList } from 'src/navigation/home.stack'
import { encryptMessage, splitIntoChunks } from 'src/screens/connect-ble/helpers/helper-functions'
import { setUserIdToDevice, UserIdAction, UserIdState } from 'src/screens/connect-ble/helpers/user-id-mode'
import { useAppDispatch } from 'src/stores/hooks'
import { useRegisteredUserId } from 'src/stores/slices/auth.slice'
import {
  cleanDeviceData,
  setConnectedDevices,
  setIsEnabledScreens,
  setOtherDevices,
  setUserIdState,
  useActiveDeviceId,
  useChar0002,
  useChar0003,
  useConnectedDevices,
  useIsBleScanning,
  useIsDeviceConnected,
  useIsInternetConnected,
  useIsUserIdSet,
  useLogFilePath,
  useOtherDevices,
  usePublicKey,
  useUserIdState,
} from 'src/stores/slices/connect-device.slice'
import { Colors } from 'src/styles'

import { connectDevice } from './helpers/connect-device'
import { disconnectDevice } from './helpers/disconnect-device'
import { startScanBle, stopScan } from './helpers/start-scan-ble'
import { isSimulationMode } from './helpers/ws-device-simulator'
import styles from './styles'

export const bleManager = new BleManager()
const ItemSeparatorComponent = () => <View style={styles.separator} />
const ListEmptyComponent = () => <Text style={styles.boldTextStyle}>No Devices</Text>

const bleImage = require('src/assets/images/bluetooth.webp')
const getOtherDevices = (otherDevices: Device[], connectedDevices: Device[]) =>
  [...otherDevices].filter((item) => item?.id !== connectedDevices[0]?.id)

const ConnectBle = () => {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>()
  const dispatch = useAppDispatch()
  const otherDevices = useOtherDevices()
  const connectedDevices = useConnectedDevices()
  const isBleScanning = useIsBleScanning()
  const activeDeviceId = useActiveDeviceId()
  const isPeripheralConnected = useIsDeviceConnected()
  const deviceConnectionListener = useRef<Subscription>()
  const isInternetConnected = useIsInternetConnected()
  const userId = useRegisteredUserId()
  const publicKey = usePublicKey()
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null)
  const userIdState = useUserIdState()
  const [isShowForceAlert, setIsShowForceAlert] = useState(false)
  const char0002 = useChar0002()
  const char0003 = useChar0003()
  const isUserIdSet = useIsUserIdSet()
  const logFilePath = useLogFilePath()

  const handleSearch = async () => {
    if (isSimulationMode()) return // Skip BLE scan in simulation mode
    if (!isBleScanning) {
      dispatch(setOtherDevices([]))
      await startScanBle(dispatch, otherDevices, connectedDevices, isBleScanning)
    } else {
      stopScan(dispatch)
    }
  }

  useFocusEffect(
    useCallback(() => {
      dispatch(setOtherDevices([]))
      if (!isPeripheralConnected) {
        handleSearch().then()
      }

      if (!isInternetConnected) {
        dispatch(setIsEnabledScreens(true))
      }
    }, [dispatch, isInternetConnected, isPeripheralConnected]),
  )

  useEffect(() => {
    if (userIdState === UserIdState.userIdAlready) {
      setIsShowForceAlert(true)
    }
  }, [userIdState])

  useEffect(() => {
    if (isPeripheralConnected && userIdState && userIdState !== UserIdState.userIdAlready && isUserIdSet) {
      setTimeout(() => navigation.navigate('Vitals'), 2000)
    }
  }, [isPeripheralConnected, navigation, userIdState, isUserIdSet])

  useEffect(() => {
    if (connectedDevices.length && !isPeripheralConnected) {
      disconnectDevice(dispatch, connectedDevices[0])
      dispatch(setOtherDevices(getOtherDevices(otherDevices, connectedDevices)))
      setIsConnecting(false)
    }
  }, [connectedDevices, isPeripheralConnected])

  useLayoutEffect(() => {
    navigation.setOptions({
      // @ts-ignore
      header: () => (
        <Header
          leftIcon={faArrowLeft}
          onLeftPress={() => navigation.navigate('Vitals')}
          onRightPress={handleSearch}
          rightText={isBleScanning ? 'Searching' : 'Search'}
          title="Connect Device"
        />
      ),
    })
  })

  useEffect(() => {
    const subscription = bleManager.onStateChange(async (state) => {
      if (state === 'PoweredOn') {
        await startScanBle(dispatch, otherDevices, connectedDevices, isBleScanning)
        subscription.remove()
      }

      if (state === 'PoweredOff') {
        stopScan(dispatch)
        Alert.alert('Zenzers want use Bluetooth for new connection', 'You can turn on Bluetooth in parameters', [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Parameters',
            onPress: () => {
              constants.isIOS ? Linking.openURL(constants.IOS_BLE) : Linking.sendIntent(constants.ANDROID_BLE)
            },
          },
        ])
      }
    }, true)

    return () => subscription.remove()
  }, [otherDevices, connectedDevices, dispatch])

  const handleForceAlertOk = () => {
    if (publicKey && char0002 && connectedDevices[0].name) {
      const pubKeyArray = splitIntoChunks(publicKey, 2).map((chunk) => '0x' + chunk)

      const pubKeyBytes = pubKeyArray.map((char) => Number(char))
      const encrypted = encryptMessage(UserIdAction.forceUserId, pubKeyBytes, connectedDevices[0].name)

      setUserIdToDevice(char0002, userId, encrypted)
    }
  }

  const handleDisconnectByTap = async (item: Device) => {
    await AsyncStorage.removeItem('deviceId')
    dispatch(setOtherDevices([]))
    dispatch(setUserIdState(''))
    dispatch(cleanDeviceData())
    disconnectDevice(dispatch, item)
    await startScanBle(dispatch, otherDevices, connectedDevices, isBleScanning)
  }

  const handleForceAlertCancel = () => {
    if (char0003) {
      deviceConnectionListener.current?.remove()
    }

    disconnectDevice(dispatch, connectedDevices[0])
    dispatch(setOtherDevices([]))
    dispatch(cleanDeviceData())
    AsyncStorage.removeItem('deviceId').then()
    setIsShowForceAlert(false)
    navigation.navigate('Vitals')
  }

  const pairWithDevice = async (item: Device) => {
    stopScan(dispatch)
    try {
      const isDeviceConnected = await item.isConnected()

      if (isDeviceConnected) {
        Alert.alert('Disconnect', `Do you want to disconnect device ${item.name}`, [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Yes',
            onPress: () => handleDisconnectByTap(item),
          },
        ])
      } else {
        setConnectingDeviceId(item.id)
        setIsConnecting(true)
        await connectDevice(dispatch, item, deviceConnectionListener, userId)
        setConnectingDeviceId(null)
        stopScan(dispatch)

        const isExists = await RNFS.exists(logFilePath)

        if (isExists) {
          await RNFS.unlink(logFilePath)
        }
      }
    } catch (err) {
      if (err === `Device ${item.id} was disconnected`) {
        Alert.alert('Error', 'Unable to connect to the device. Please try again.', [
          {
            text: 'OK',
            style: 'default',
          },
        ])
      }

      dispatch(setConnectedDevices([]))
      disconnectDevice(dispatch, item)
      setIsConnecting(false)
      setConnectingDeviceId(null)
      handleSearch().then()
    } finally {
      setIsConnecting(false)
      setConnectingDeviceId(null)
    }
  }

  const sections = useMemo(
    () => [
      {
        title: 'Connected',
        data: connectedDevices,
      },
      {
        title: 'Other',
        data: getOtherDevices(otherDevices, connectedDevices),
      },
    ],
    [otherDevices, connectedDevices],
  )

  const keyExtractor = (item: Device) => item.id
  const renderItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      activeOpacity={0.6}
      disabled={isConnecting}
      onPress={() => pairWithDevice(item)}
      style={styles.itemWrapper}>
      <View style={styles.item}>
        <Text style={styles.itemText}>{item.name}</Text>
        {connectingDeviceId === item.id && isConnecting && <Text>Connecting</Text>}
        {activeDeviceId === item.id && !isConnecting && <Text>Connected</Text>}
      </View>
      <FastImage
        source={bleImage}
        style={[styles.icon, isPeripheralConnected && { overlayColor: Colors.primaryBlue }]}
      />
    </TouchableOpacity>
  )

  if (isSimulationMode() && isPeripheralConnected) {
    return (
      <SafeAreaView style={[styles.container, { marginTop: -insets.top, marginBottom: -insets.bottom }]}>
        <ConnectionLostLabel />
        <View style={{ padding: 20, alignItems: 'center' }}>
          <Text style={[styles.boldTextStyle, { color: '#4CAF50', marginBottom: 10 }]}>
            Simulation Mode Active
          </Text>
          <Text style={{ textAlign: 'center', color: '#666' }}>
            Connected to Zenzer Device Emulator via WebSocket.{'\n'}
            Receiving live vitals from virtual device.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { marginTop: -insets.top, marginBottom: -insets.bottom }]}>
      <ConnectionLostLabel />
      <SectionList
        ItemSeparatorComponent={ItemSeparatorComponent}
        ListEmptyComponent={ListEmptyComponent}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title, data } }) => (data.length ? <Text>{title}</Text> : null)}
        sections={sections}
      />
      {isShowForceAlert && (
        <CustomAlert
          children={
            <Text>
              This device is associated with another user. Connecting will erase all their data. Are you sure you want
              to proceed?
            </Text>
          }
          onCancel={handleForceAlertCancel}
          onOk={handleForceAlertOk}
          title="Important notice"
          visible={isShowForceAlert}
        />
      )}
    </SafeAreaView>
  )
}

export { ConnectBle }
