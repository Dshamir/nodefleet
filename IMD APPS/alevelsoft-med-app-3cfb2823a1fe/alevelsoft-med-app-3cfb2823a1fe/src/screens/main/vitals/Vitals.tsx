import { VitalsItem } from '@alevelsoft/medical-support/src/history-vitals/domain/vitals-item'
import { faBars, faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { BottomSheetModal } from '@gorhom/bottom-sheet'
import { DrawerActions, useFocusEffect, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { Config } from 'react-native-config'
import { ConnectionLostLabel } from 'src/components/connection-lost-label'
import { Header } from 'src/components/header'
import { constants } from 'src/constants'
import { PatientCategory } from 'src/enums/patient-category.enum'
import { RolesType } from 'src/enums/roles.enum'
import { ThresholdsType } from 'src/enums/thresholds-type.enum'
import { VitalsChartType, VitalsUnit } from 'src/enums/vitals-type.enum'
import { HomeStackParamList } from 'src/navigation/home.stack'
import { useAppDispatch, useInterval } from 'src/stores/hooks'
import { useGetPatientStatusQuery, useUpdatePatientStatusToAbnormalMutation } from 'src/stores/services/profile.api'
import { useGetPatientVitalThresholdsQuery } from 'src/stores/services/threshold'
import {
  useGetAbsoluteVitalsQuery,
  useGetPatientVitalsQuery,
  useLazyGetPatientVitalsQuery,
  usePostPatientVitalsMutation,
} from 'src/stores/services/vitals.api'
import { useRegisteredUserId, useRegisteredUserRole } from 'src/stores/slices/auth.slice'
import {
  setIsDeviceConnected,
  setIsEnabledScreens,
  useBloodPressure,
  useDeviceSerial,
  useFall,
  useFallType,
  useHeartRate,
  useIsDeviceConnected,
  useIsInternetConnected,
  useRespirationRate,
  useSpo,
  useTemperature,
} from 'src/stores/slices/connect-device.slice'
import { addWarnNotification } from 'src/stores/slices/notifications.slice'
import {
  cleanTemporaryVitals,
  setIsFetchingVitalsResponse,
  setIsLoadingVitalsResponse,
  setThresholds,
  useAverageVitals,
  useHistoryVitals,
  useIsAbnormalFallActive,
  useTemporaryVitals,
  useThresholds,
  useVitalHistoryRequestTime,
} from 'src/stores/slices/vitals.slice'
import { IVitalsCard, IVitalTypes } from 'src/stores/types/vitals-response.types'

import { BottomParametersLogs } from './components/bottom-parameters-logs/BottomParametersLogs'
import { DeviceNotConnectedYet } from './components/device-not-connected-yet'
import { ListHeaderComponent } from './components/list-header-component'
import { IValue, VitalsCard } from './components/vitals-card'
import { checkNormalValue } from './helpers/check-normal-value'
import { deviceLabelStyle } from './helpers/device-label-style'
import { getAverage, setupAverageVitals } from './helpers/handle-average-params'
import { setHistoryVitalsToStore } from './helpers/set-history-vitals-to-store'
import { useSetTemporaryParams } from './hooks/use-set-temporary-params'
import styles from './styles'

const findLastItem = (vitals: VitalsItem[]) =>
  vitals?.reduce((prev, current) => (prev?.endTimestamp > current?.endTimestamp ? prev : current))

const Vitals = () => {
  const dispatch = useAppDispatch()
  const userId = useRegisteredUserId()
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>()
  const userRole = useRegisteredUserRole()
  const isDeviceConnected = useIsDeviceConnected()
  const heartRate = useHeartRate()
  const bloodPressure = useBloodPressure()
  const temperature = useTemperature()
  const respirationRate = useRespirationRate()
  const fall = useFall()
  const fallType = useFallType()
  const spo = useSpo()
  const deviceSerial = useDeviceSerial()
  const bottomSheetModalRef = useRef<BottomSheetModal>(null)
  const isInternetConnected = useIsInternetConnected()
  const thresholdsData = useThresholds()
  const isAbnormalFallActive = useIsAbnormalFallActive()
  const vitalHistoryRequestTime = useVitalHistoryRequestTime()
  const vitalsData = useHistoryVitals()
  const endDate = useMemo(() => dayjs().toISOString(), [])

  const {
    data: vitalsResponse,
    isLoading,
    isFetching,
  } = useGetPatientVitalsQuery(
    {
      startDate: dayjs(endDate).subtract(30, 'days').toISOString(),
      endDate,
    },
    { skip: !isInternetConnected },
  )
  const [lazyVitalsResponse] = useLazyGetPatientVitalsQuery()
  const { data: thresholds } = useGetPatientVitalThresholdsQuery(undefined, {
    pollingInterval: 60000 * 10,
    skip: !isInternetConnected,
  })
  const { data: userStatusData } = useGetPatientStatusQuery(
    { patientUserId: userId },
    {
      skip: !isInternetConnected,
    },
  )
  const { data: absoluteVitals } = useGetAbsoluteVitalsQuery(undefined, {
    skip: !isInternetConnected,
  })

  const [postVitals] = usePostPatientVitalsMutation()
  const [putToAbnormal] = useUpdatePatientStatusToAbnormalMutation()

  useEffect(() => {
    dispatch(setIsLoadingVitalsResponse(isLoading))
    dispatch(setIsFetchingVitalsResponse(isFetching))

    if (vitalsData && vitalsResponse && !vitalHistoryRequestTime) {
      setHistoryVitalsToStore(dispatch, vitalsData, vitalsResponse, endDate)

      return
    }
  }, [vitalHistoryRequestTime, dispatch, isFetching, isLoading, vitalsResponse, endDate])

  const updateVitalsResponse = useCallback(async () => {
    const diff = dayjs().diff(vitalHistoryRequestTime, 'seconds')

    if (diff > 60) {
      const start = dayjs(vitalHistoryRequestTime).subtract(5, 'minutes').toISOString()
      const end = dayjs().toISOString()
      const res = await lazyVitalsResponse({
        startDate: start,
        endDate: end,
      }).unwrap()

      setHistoryVitalsToStore(dispatch, vitalsData, res, end)
    }
  }, [dispatch, vitalsData, lazyVitalsResponse, vitalHistoryRequestTime])

  useFocusEffect(
    useCallback(() => {
      if (vitalHistoryRequestTime) {
        updateVitalsResponse().then()
      }

      if (!isInternetConnected) {
        dispatch(setIsEnabledScreens(true))
      }
    }, [vitalHistoryRequestTime, isInternetConnected, updateVitalsResponse, dispatch]),
  )

  useLayoutEffect(() => {
    // @ts-ignore
    if (__DEV__ && Boolean(+Config.ENABLE_DEV_MODE)) {
      dispatch(setIsDeviceConnected(true))
    }

    navigation.setOptions({
      // @ts-ignore
      header: () => (
        <Header
          leftIcon={faBars}
          onLeftPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          onRightPress={() => navigation.navigate('Settings')}
          rightIcon={faCog}
          title="Vital Signs"
        />
      ),
    })
  })

  useEffect(() => {
    thresholds && dispatch(setThresholds(thresholds))
  }, [dispatch, thresholds])

  const deviceState = useMemo(() => deviceLabelStyle(isDeviceConnected), [isDeviceConnected])

  const isDeviceNotConnectedYet = useMemo(() => {
    return !isFetching && !isDeviceConnected && !vitalsData?.vitals?.length
  }, [isFetching, isDeviceConnected, vitalsData])

  const handlePresentModalPress = useCallback(
    (vitalsType: IVitalTypes, timestamp: number, prevScreen: string, startTimestamp?: number) => {
      if (vitalsType !== 'FALL') {
        navigation.navigate('HistoryStack', {
          screen: 'PatientChart',
          params: { vitalsType, endTimestamp: timestamp, startTimestamp, prevScreen, timestamp },
        })

        return
      }

      navigation.navigate('HistoryStack', {
        screen: 'History',
        params: { vitalsType, isFall: true },
      })
    },
    [navigation],
  )

  const lastSavedVital = useMemo(
    () => (vitalsData?.vitals?.length ? findLastItem(vitalsData?.vitals) : undefined),
    [vitalsData?.vitals],
  )

  const startTimestamp = useMemo(
    () =>
      isDeviceConnected ? new Date().getTime() : lastSavedVital ? lastSavedVital?.startTimestamp * 1000 : undefined,
    [isDeviceConnected, lastSavedVital],
  )

  const timestamp = useMemo(
    () => (isDeviceConnected ? new Date().getTime() : lastSavedVital ? lastSavedVital?.endTimestamp * 1000 : null),
    [isDeviceConnected, lastSavedVital],
  )

  const getValue = useCallback(
    (value: IValue, lastVital: IValue) =>
      isDeviceConnected ? value : !isDeviceConnected && !isInternetConnected && value ? value : lastVital,
    [isDeviceConnected, isInternetConnected],
  )

  const vitalsCharacteristics: IVitalsCard[] = useMemo(() => {
    const v = lastSavedVital?.vitals
    return [
      {
        timestamp,
        title: ThresholdsType.heartRate,
        value: getValue(heartRate, v?.hr?.value),
        previousValue: v?.hr?.value,
        isNormal: isDeviceConnected ? null : v?.hr?.isNormal,
        iconName: constants.heartRateIcon,
        units: VitalsUnit.hr,
        vitalsType: VitalsChartType.hr,
        limits: {
          floor: absoluteVitals?.minHr || 40,
          ceiling: absoluteVitals?.maxHr || 220,
        },
      },
      {
        timestamp,
        title: ThresholdsType.temperature,
        value: getValue(temperature, v?.temp?.value),
        previousValue: v?.temp?.value,
        isNormal: isDeviceConnected ? null : v?.temp?.isNormal,
        iconName: constants.temperatureIcon,
        units: VitalsUnit.temp,
        vitalsType: VitalsChartType.temp,
        limits: {
          floor: absoluteVitals?.minTemp || 32,
          ceiling: absoluteVitals?.maxTemp || 42,
        },
      },
      {
        timestamp,
        title: ThresholdsType.spo,
        value: getValue(spo, v?.spo2?.value),
        previousValue: v?.spo2?.value,
        isNormal: isDeviceConnected ? null : v?.spo2?.isNormal,
        iconName: constants.spoIcon,
        units: VitalsUnit.spo2,
        vitalsType: VitalsChartType.spo2,
        limits: {
          floor: absoluteVitals?.minSpo2 || 40,
          ceiling: absoluteVitals?.maxSpo2 || 100,
        },
      },
      {
        timestamp,
        title: ThresholdsType.rr,
        value: getValue(respirationRate, v?.rr?.value),
        previousValue: v?.rr?.value,
        isNormal: isDeviceConnected ? null : v?.rr?.isNormal,
        iconName: constants.rrIcon,
        units: VitalsUnit.rr,
        vitalsType: VitalsChartType.rr,
        limits: {
          floor: absoluteVitals?.minRr || 4,
          ceiling: absoluteVitals?.maxRr || 60,
        },
      },
      {
        timestamp,
        title: ThresholdsType.blood,
        value: { dbp: bloodPressure?.dbp || 0, sbp: bloodPressure?.sbp || 0 },
        previousValue: { dbp: v?.dbp?.value, sbp: v?.sbp?.value },
        isNormal: isDeviceConnected ? null : v?.dbp?.isNormal && v?.sbp?.isNormal,
        iconName: constants.bloodRedIcon,
        units: VitalsUnit.bp,
        vitalsType: VitalsChartType.bp,
        limits: {
          floor: absoluteVitals?.minDbp || 40,
          ceiling: absoluteVitals?.maxSbp || 220,
        },
      },
      {
        timestamp,
        title: 'FALL',
        value: !isAbnormalFallActive && getValue(fall, false),
        previousValue: false,
        isNormal: isDeviceConnected ? !isAbnormalFallActive : false,
        iconName: constants.fallIcon,
        units: '',
        vitalsType: 'FALL',
        limits: {
          floor: 0,
          ceiling: 1,
        },
      },
    ]
  }, [
    absoluteVitals,
    timestamp,
    getValue,
    heartRate,
    lastSavedVital,
    isDeviceConnected,
    temperature,
    spo,
    respirationRate,
    bloodPressure,
    isAbnormalFallActive,
    fall,
  ])

  const isNull = useMemo(
    () => !temperature && !spo && !heartRate && !respirationRate && !bloodPressure?.dbp && !bloodPressure?.sbp,
    [heartRate, respirationRate, spo, temperature, bloodPressure],
  )

  const temporaryVitals = useTemporaryVitals()
  const averagesVitals = useAverageVitals()

  useSetTemporaryParams(dispatch, temporaryVitals, heartRate, temperature, spo, respirationRate, fall, bloodPressure)

  useInterval(() => {
    if (isDeviceConnected && isInternetConnected && !isNull) {
      const { temporaryHr, temporaryRr, temporarySpo, temporaryTemp, temporaryFall, temporaryDbp, temporarySbp } =
        temporaryVitals
      const averageHr = getAverage(temporaryHr)
      const averageRr = getAverage(temporaryRr)
      const averageTemp = getAverage(temporaryTemp, true)
      const averageSpo = getAverage(temporarySpo)
      const averageFall = getAverage(temporaryFall)
      const averageDbp = getAverage(temporaryDbp)
      const averageSbp = getAverage(temporarySbp)

      const isHrNormal = averageHr
        ? checkNormalValue(averageHr, thresholdsData?.heartRate?.min, thresholdsData?.heartRate.max)
        : true
      const isTempNormal = averageTemp
        ? checkNormalValue(averageTemp, thresholdsData?.temperature?.min, thresholdsData?.temperature.max)
        : true
      const isSpo2Normal = averageSpo
        ? checkNormalValue(averageSpo, thresholdsData?.saturation?.min, thresholdsData?.saturation.max)
        : true
      const isRrNormal = averageRr
        ? checkNormalValue(averageRr, thresholdsData?.respirationRate?.min, thresholdsData?.respirationRate.max)
        : true
      const isDbpNormal = averageDbp
        ? checkNormalValue(averageDbp, thresholdsData?.bloodPressure.dbp.min, thresholdsData?.bloodPressure.dbp.max)
        : true
      const isSbpNormal = averageSbp
        ? checkNormalValue(averageSbp, thresholdsData?.bloodPressure.sbp.min, thresholdsData?.bloodPressure.sbp.max)
        : true

      const isFallNormal = !averageFall

      const data = [
        {
          thresholdsId: thresholdsData?.thresholdsId || '',
          timestamp: Number((new Date().getTime() / 1000).toFixed(0)),
          temp: averageTemp || null,
          hr: averageHr || null,
          spo2: averageSpo || null,
          rr: averageRr || null,
          dbp: averageDbp || null,
          sbp: averageSbp || null,
          fall: Boolean(averageFall),
          fallType: averageFall ? fallType?.title : null,
          isDbpNormal,
          isSbpNormal,
          isHrNormal,
          isTempNormal,
          isSpo2Normal,
          isRrNormal,
          deviceSerial: deviceSerial || undefined,
          relayType: 'phone',
          relayId: undefined,
        },
      ]

      const isNormal = [isHrNormal, isTempNormal, isSpo2Normal, isRrNormal, isDbpNormal, isSbpNormal]
        .filter((el) => el != null)
        .every(Boolean)

      if (!isFallNormal && !isNormal && userStatusData?.status === PatientCategory.Normal) {
        putToAbnormal({ patientUserId: userId })
      }

      setupAverageVitals(dispatch, averagesVitals, temporaryVitals)
      postVitals({ vitals: data }).then()
      dispatch(cleanTemporaryVitals())
    }
  }, 30000)

  useEffect(() => {
    if (userRole === RolesType.patient && !isDeviceConnected) {
      dispatch(addWarnNotification('Device is disconnected.'))
    }
  }, [dispatch, isDeviceConnected, userRole])

  const handleVitalBoxPress = (item: IVitalsCard) => {
    if (item.title === 'FALL') {
      navigation.navigate('HistoryStack', { screen: 'History', params: { vitalsType: item.vitalsType, isFall: true } })

      return
    }

    if (timestamp) {
      handlePresentModalPress(item.vitalsType, timestamp, 'Vitals', startTimestamp)
    }
  }

  const keyExtractor = (item: IVitalsCard) => item.title
  const renderItem = ({ item }: { item: IVitalsCard }) => (
    <VitalsCard
      isDisable={isFetching}
      item={item}
      onPress={() => handleVitalBoxPress(item)}
      thresholds={thresholdsData}
    />
  )

  const moveToConnectBle = useCallback(() => navigation.navigate('ConnectBle'), [navigation])

  if (isDeviceNotConnectedYet && (!isLoading || !isFetching)) {
    return <DeviceNotConnectedYet />
  }

  return (
    <View style={styles.container}>
      <ConnectionLostLabel />
      <TouchableOpacity disabled={isDeviceConnected} onPress={moveToConnectBle} style={styles.deviceStateWrapper}>
        <FontAwesomeIcon color={deviceState.color} icon={deviceState.icon} size={20} style={styles.icon} />
        <Text style={styles.deviceState}>{deviceState.title}</Text>
      </TouchableOpacity>
      {isDeviceNotConnectedYet && (!isLoading || !isFetching) ? (
        <DeviceNotConnectedYet />
      ) : (
        <FlatList
          ListHeaderComponent={
            <ListHeaderComponent isFetching={isFetching} isLoading={isLoading} timestamp={timestamp} />
          }
          data={vitalsCharacteristics}
          keyExtractor={keyExtractor}
          numColumns={2}
          renderItem={renderItem}
          renderToHardwareTextureAndroid={true}
          scrollEnabled={true}
          shouldRasterizeIOS={true}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomParametersLogs ref={bottomSheetModalRef} />
    </View>
  )
}

export { Vitals }
