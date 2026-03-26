import { createDrawerNavigator } from '@react-navigation/drawer'
import { useNavigation, useNavigationState } from '@react-navigation/native'
import React, { useEffect, useMemo } from 'react'
import { Config } from 'react-native-config'
import { Header } from 'src/components/header'
import { constants } from 'src/constants'
import { RolesType } from 'src/enums/roles.enum'
import { checkIsAbnormalAverageValues } from 'src/helpers/check-abnormal-average-values'
import { handleFallType } from 'src/helpers/fall-helper'
import { getMlPredictions } from 'src/helpers/get-ml-predictions'
import { cleanTemporaryPpgData, getTemporaryPpgData } from 'src/screens/connect-ble/helpers/connect-device'
import { isSimulationMode, startSimulationScan, stopSimulation } from 'src/screens/connect-ble/helpers/ws-device-simulator'
import { EmergencyCall } from 'src/screens/emergency-call'
import {
  useAppDispatch,
  useAutoReconnect,
  useInterval,
  useProfilePrefetchImmediately,
  useSocket,
  useStartScanBle,
} from 'src/stores/hooks'
import { useRegisteredUserId, useRegisteredUserRole } from 'src/stores/slices/auth.slice'
import {
  cleanPpgData,
  setBloodPressure,
  setFall,
  setHeartRate,
  setPpgData,
  setRespirationRate,
  setSpo,
  setTemperature,
  useBloodPressure,
  useFall,
  useHeartRate,
  useIsDeviceConnected,
  useIsEnabledScreens,
  useIsInternetConnected,
  usePpgData,
  useRespirationRate,
  useSpo,
  useTemperature,
} from 'src/stores/slices/connect-device.slice'
import { useAverageVitals, useEmergencyTimeOut, useThresholds } from 'src/stores/slices/vitals.slice'
import { Colors } from 'src/styles'

import { CustomDrawer } from './components/custom-drawer'
import ConnectionLostStack from './connection-lost.stack'
import MainStack from './main.stack'

const Drawer = createDrawerNavigator()

//FixMe: for debug
const VitalValues = {
  hr: { min: 70, max: 80 },
  spo2: { min: 90, max: 99 },
  rr: { min: 30, max: 40 },
  temp: { min: 35, max: 37 },
  fall: { min: 0, max: 0 },
  dbp: { min: 70, max: 80 },
  sbp: { min: 110, max: 130 },
  fallType: { min: 4, max: 7 },
}

type VitalValuesType = keyof typeof VitalValues

const getRandomValueByParams = (param: VitalValuesType) =>
  Math.floor(Math.random() * (VitalValues[param].max - VitalValues[param].min + 1)) + VitalValues[param].min

const DrawerStack = () => {
  useProfilePrefetchImmediately('getDiagnoses')
  useProfilePrefetchImmediately('getMedications')

  const navigationState = useNavigationState((state) => state)
  const currentRoute = navigationState && navigationState.routes[navigationState.index].name

  const isConnected = useIsDeviceConnected()
  const navigation = useNavigation()
  const dispatch = useAppDispatch()
  const isInternetConnected = useIsInternetConnected()
  const emergencyTimeOut = useEmergencyTimeOut()
  const thresholdsData = useThresholds()
  const averageVitals = useAverageVitals()

  const role = useRegisteredUserRole()
  const isPatient = useMemo(() => role === RolesType.patient, [role])

  const heartRate = useHeartRate()
  const bloodPressure = useBloodPressure()
  const temperature = useTemperature()
  const respirationRate = useRespirationRate()
  const fall = useFall()
  const spo = useSpo()
  const patientUserId = useRegisteredUserId()
  const isEnabledScreens = useIsEnabledScreens()
  const socket = useSocket()

  const ppgData = usePpgData()

  useStartScanBle()
  useAutoReconnect()

  // Start scanning for emulated devices when SIMULATION_MODE=1
  useEffect(() => {
    if (isSimulationMode()) {
      startSimulationScan(dispatch)
      return () => stopSimulation(dispatch)
    }
  }, [dispatch])

  useInterval(() => {
    if (
      checkIsAbnormalAverageValues(thresholdsData, averageVitals) &&
      isConnected &&
      currentRoute !== 'EmergencyCall'
    ) {
      navigation.navigate('EmergencyCall' as never)
    }
  }, emergencyTimeOut)

  useInterval(async () => {
    if (isConnected) {
      dispatch(cleanPpgData())
      dispatch(setPpgData(getTemporaryPpgData()))
      cleanTemporaryPpgData()

      if (ppgData.length) {
        try {
          const { dbp, sbp } = await getMlPredictions(ppgData)

          if (sbp && dbp) {
            dispatch(
              setBloodPressure({
                sbp: Number(sbp.toFixed(0)),
                dbp: Number(dbp.toFixed(0)),
              }),
            )
          }
        } catch (error: any) {
          throw new Error(error.message)
        }
      }
    }
  }, 14999)

  //FixMe: for debug
  // @ts-ignore
  if (__DEV__ && Boolean(+Config.ENABLE_DEV_MODE)) {
    const randomFall = 1 //getRandomValueByParams('fall')

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInterval(() => {
      dispatch(setHeartRate(getRandomValueByParams('hr')))
      dispatch(setRespirationRate(getRandomValueByParams('rr')))
    }, 2000)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInterval(() => {
      dispatch(setTemperature(getRandomValueByParams('temp')))
    }, 10000)

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useInterval(() => {
      console.log(randomFall)
      dispatch(setSpo(getRandomValueByParams('spo2')))
      dispatch(setFall(randomFall))
    }, 5000)

    if (randomFall === 1) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useInterval(() => {
        handleFallType(dispatch, getRandomValueByParams('fallType'))
      }, 7000)
    }
  }

  useInterval(() => {
    if (isPatient && isConnected) {
      const data = {
        hr: heartRate,
        temp: temperature,
        spo,
        rr: respirationRate,
        fall: Boolean(fall),
        dbp: bloodPressure?.dbp,
        sbp: bloodPressure?.sbp,
      }

      const message = {
        patientUserId,
        data,
      }

      socket.emit('messageToServer', message)
    }
  }, constants.VITALS_INTERVAL)

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      initialRouteName="Home"
      screenOptions={{
        swipeEnabled: true,
        drawerActiveBackgroundColor: Colors.primaryBlue,
        drawerActiveTintColor: Colors.primaryWhite,
        drawerInactiveTintColor: '#333',
        drawerLabelStyle: {
          fontSize: 15,
        },
      }}>
      <Drawer.Screen
        component={!isInternetConnected && !isEnabledScreens ? ConnectionLostStack : MainStack}
        name="Home"
        options={{
          headerShown: false,
        }}
      />
      <Drawer.Screen
        component={ConnectionLostStack}
        name="ConnectionLost"
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        component={EmergencyCall}
        name="EmergencyCall"
        options={{
          header: () => <Header />,
          drawerItemStyle: { display: 'none' },
        }}
      />
    </Drawer.Navigator>
  )
}

export default DrawerStack
