import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import DateTimePickerModal from 'react-native-modal-datetime-picker'
import { ChartLegend } from 'src/components/chart/components/chart-legend'
import CheckBox from 'src/components/check-box/CheckBox'
import { VITALS_TAB, VitalsChartTabKeys } from 'src/constants/constants'
import { LegendItemType } from 'src/enums/legend-item-type.enum'
import { TimeType } from 'src/enums/time-type.enum'
import { VitalsChartType } from 'src/enums/vitals-type.enum'
import { showByFormat } from 'src/helpers/date-helper'
import { getChartThresholds } from 'src/helpers/get-chart-thresholds'
import { getVitalsChartData, mapVitalsChartData } from 'src/helpers/get-charts-data'
import { setHistoryVitalsToStore } from 'src/screens/main/vitals/helpers/set-history-vitals-to-store'
import { isUserRoleGrantable } from 'src/stores/helpers/user-role'
import { useAppDispatch } from 'src/stores/hooks'
import { useRealtimeChartData } from 'src/stores/hooks/use-realtime-chart-data'
import { useLazyGetPatientVitalsByDoctorQuery, useLazyGetPatientVitalsQuery } from 'src/stores/services/vitals.api'
import { useRegisteredUserRole } from 'src/stores/slices/auth.slice'
import { defaultStartDate, useHistoryVitals, useVitalHistoryRequestTime } from 'src/stores/slices/vitals.slice'
import { IVitalTypes } from 'src/stores/types/vitals-response.types'

import { ChartComponent } from './components/chart-component'
import { ChartSwitchers } from './components/chart-switchers'
import { DateTimePicker } from './components/date-time-picker'
import { SelectedTimeComponent, SelectedTimeTab } from './components/selected-time-component'
import { SelectedVitalsComponent } from './components/selected-vitals-component'
import styles from './styles'

interface ChartProps {
  startTimestamp: number
  endTimestamp: number
  timestamp?: number
  patientUserId?: string
  vitalsType: IVitalTypes
  bottomSheetModalRef: React.Ref<BottomSheetModalMethods> | undefined
}

const getDefaultRangeTime = (timeTo: number, timeFrom: number) => timeTo - timeFrom

const Chart = ({ startTimestamp, endTimestamp, vitalsType, patientUserId, timestamp }: ChartProps) => {
  const dispatch = useAppDispatch()
  const role = useRegisteredUserRole()
  const defaultTimeTo = useMemo(() => dayjs(endTimestamp).unix(), [endTimestamp])
  const defaultTimeFrom = useMemo(() => dayjs(startTimestamp).unix(), [startTimestamp])

  const [selectedTab, setSelectedTab] = useState<IVitalTypes>(vitalsType)
  const [isFromDatePickerVisible, setFromDatePickerVisibility] = useState(false)
  const [isToDatePickerVisible, setToDatePickerVisibility] = useState(false)
  const [selectedTimeTab, setSelectedTimeTab] = useState<SelectedTimeTab>(
    timestamp
      ? {
          key: TimeType.oneHour,
          value: getDefaultRangeTime(dayjs(timestamp).unix(), dayjs(timestamp).subtract(1, 'hour').unix()),
        }
      : {
          key: TimeType.range,
          value: getDefaultRangeTime(defaultTimeTo, defaultTimeFrom),
        },
  )
  const [isCustomRange, setIsCustomRange] = useState(selectedTimeTab.key === TimeType.range)
  const [dateRange, setDateRange] = useState({
    from: defaultTimeFrom,
    to: defaultTimeTo,
    range: getDefaultRangeTime(defaultTimeTo, defaultTimeFrom),
  })
  const [isShowAbnormal, setIsShowAbnormal] = useState(false)
  const toggleSwitchShowAbnormal = () => setIsShowAbnormal((previousState) => !previousState)
  const [isShowVariance, setIsShowVariance] = useState(false)
  const toggleSwitchShowVariance = () => setIsShowVariance((previousState) => !previousState)
  const end = useMemo(() => (isCustomRange ? dateRange.to : dayjs().unix()), [dateRange.to, isCustomRange])
  const start = useMemo(
    () => (isCustomRange ? dateRange.from : end - selectedTimeTab.value),
    [dateRange.from, end, isCustomRange, selectedTimeTab.value],
  )
  const [isSysVariance, setIsSysVariance] = useState(true)
  const [isDiaVariance, setIsDiaVariance] = useState(false)

  const [isShowSysChart, setIsShowSysChart] = useState(true)
  const [isShowDiaChart, setIsShowDiaChart] = useState(true)

  const historyData = useHistoryVitals()
  const vitalHistoryRequestTime = useVitalHistoryRequestTime()
  const realtimePoints = useRealtimeChartData(patientUserId)

  const [lazyPatientVitalsResponse] = useLazyGetPatientVitalsQuery()
  const [lazyVitalsResponse] = useLazyGetPatientVitalsByDoctorQuery()

  const handleLazyRequest = useCallback(async () => {
    const startUpdate = dayjs(vitalHistoryRequestTime).subtract(5, 'minutes').toISOString()
    const endUpdate = dayjs().toISOString()

    if (isUserRoleGrantable(role) && patientUserId) {
      const res = await lazyVitalsResponse({
        patientUserId,
        startDate: startUpdate,
        endDate: endUpdate,
      }).unwrap()

      setHistoryVitalsToStore(dispatch, historyData, res, endUpdate)

      return
    }

    const res = await lazyPatientVitalsResponse({
      startDate: startUpdate,
      endDate: endUpdate,
    }).unwrap()

    setHistoryVitalsToStore(dispatch, historyData, res, endUpdate)
  }, [
    dispatch,
    historyData,
    lazyPatientVitalsResponse,
    lazyVitalsResponse,
    patientUserId,
    role,
    vitalHistoryRequestTime,
  ])

  const updateVitalsResponse = useCallback(async () => {
    const diff = isCustomRange
      ? dayjs(dateRange.to * 1000).diff(vitalHistoryRequestTime, 'seconds')
      : dayjs().diff(vitalHistoryRequestTime, 'seconds')

    if (diff > 10) {
      await handleLazyRequest()
    }
  }, [dateRange.to, handleLazyRequest, isCustomRange, vitalHistoryRequestTime])

  const preparedThresholds = useMemo(() => {
    return getChartThresholds(historyData?.thresholds, start, end)
  }, [historyData, start, end])

  const filtered = useMemo(() => {
    if (vitalHistoryRequestTime) {
      updateVitalsResponse().then()
    }

    const vitals = getVitalsChartData(historyData?.vitals, start, end)

    return mapVitalsChartData(vitals)
  }, [vitalHistoryRequestTime, historyData?.vitals, start, end, updateVitalsResponse])

  useEffect(() => {
    setIsCustomRange(selectedTimeTab.key === TimeType.range)
  }, [selectedTimeTab])

  useEffect(() => {
    if (isShowVariance && !isShowSysChart) {
      setIsSysVariance(false)
      setIsDiaVariance(true)
    }

    if (isShowVariance && !isShowDiaChart) {
      setIsDiaVariance(false)
      setIsSysVariance(true)
    }
  }, [isShowDiaChart, isShowSysChart, isShowVariance])

  const showFromDatePicker = () => setFromDatePickerVisibility(true)
  const showToDatePicker = () => setToDatePickerVisibility(true)

  const hideDatePicker = () => {
    setFromDatePickerVisibility(false)
    setToDatePickerVisibility(false)
  }

  const handleConfirm = useCallback(
    (date: Date) => {
      if (dayjs(date).unix() < dateRange.to) {
        setDateRange({ from: dayjs(date).unix(), to: dateRange.to, range: dateRange.to - dayjs(date).unix() })
        hideDatePicker()
      } else {
        Alert.alert('Your time FROM can not be bigger than TO')
      }
    },
    [dateRange.to],
  )

  const handleConfirmTo = useCallback(
    (date: Date) => {
      if (dayjs(date).unix() > dateRange.from) {
        setDateRange({ from: dateRange.from, to: dayjs(date).unix(), range: dayjs(date).unix() - dateRange.from })
        hideDatePicker()
      } else {
        Alert.alert('Your time FROM can not be less than TO')
      }
    },
    [dateRange.from],
  )

  const minimumDate = useMemo(
    () =>
      isFromDatePickerVisible
        ? dayjs(defaultStartDate).toDate()
        : dayjs(start * 1000)
            .add(1, 'minute')
            .toDate(),
    [isFromDatePickerVisible, start],
  )

  const maximumDate = useMemo(
    () =>
      isFromDatePickerVisible
        ? dayjs(end * 1000)
            .subtract(1, 'minute')
            .toDate()
        : dayjs().toDate(),
    [end, isFromDatePickerVisible],
  )

  const vitalTitle = useMemo(() => VITALS_TAB.find((item) => item.key === selectedTab)?.title, [selectedTab])

  const onPressSys = () => {
    if (!isShowDiaChart) {
      setIsShowDiaChart(true)
    }

    setIsShowSysChart(!isShowSysChart)
  }
  const onPressDia = () => {
    if (!isShowSysChart) {
      setIsShowSysChart(true)
    }

    setIsShowDiaChart(!isShowDiaChart)
  }

  return (
    <ScrollView contentContainerStyle={styles.contentStyle} style={styles.containerStyle}>
      <SelectedVitalsComponent onPress={setSelectedTab} selectedTab={selectedTab} />
      <Text style={styles.title}>{vitalTitle}</Text>
      <View style={styles.chartWrapper}>
        <ChartComponent
          customDate={dateRange}
          data={[
            ...(filtered[selectedTab.toLowerCase() as VitalsChartTabKeys] || []),
            ...(realtimePoints[selectedTab.toLowerCase()] || []),
          ]}
          endDate={end}
          isShowAbnormal={isShowAbnormal}
          isShowDiaChart={isShowDiaChart}
          isShowDiaVariance={isDiaVariance}
          isShowSysChart={isShowSysChart}
          isShowSysVariance={isSysVariance}
          isShowVariance={isShowVariance}
          selectedTab={selectedTab}
          selectedTimeTab={selectedTimeTab}
          startDate={start}
          thresholds={preparedThresholds}
        />
      </View>

      {selectedTab === VitalsChartType.bp && (
        <View style={styles.legendWrapper}>
          <ChartLegend color="#FB7800" isActive={isShowSysChart} onPress={onPressSys} title={LegendItemType.sys} />
          <ChartLegend color="#2663FF" isActive={isShowDiaChart} onPress={onPressDia} title={LegendItemType.dia} />
        </View>
      )}

      <ChartSwitchers
        isShowAbnormal={isShowAbnormal}
        isShowVariance={isShowVariance}
        toggleSwitchShowAbnormal={toggleSwitchShowAbnormal}
        toggleSwitchVariance={toggleSwitchShowVariance}
      />

      {selectedTab === VitalsChartType.bp && isShowVariance && isShowDiaChart && isShowSysChart && (
        <View style={styles.legendWrapper}>
          <CheckBox
            checked={isSysVariance}
            title={LegendItemType.sys}
            toggleCheckbox={() => setIsSysVariance(!isSysVariance)}
          />
          <CheckBox
            checked={isDiaVariance}
            title={LegendItemType.dia}
            toggleCheckbox={() => setIsDiaVariance(!isDiaVariance)}
          />
        </View>
      )}

      <SelectedTimeComponent customRange={dateRange.range} onPress={setSelectedTimeTab} tabKey={selectedTimeTab.key} />
      {isCustomRange && (
        <>
          <DateTimePicker
            onPress={showFromDatePicker}
            title="From"
            value={showByFormat(dateRange.from * 1000, 'YYYY/MM/DD, hh:mm A')}
          />
          <DateTimePicker
            onPress={showToDatePicker}
            title="To"
            value={showByFormat(dateRange.to * 1000, 'YYYY/MM/DD, hh:mm A')}
          />
        </>
      )}

      <DateTimePickerModal
        date={isFromDatePickerVisible ? dayjs(start * 1000).toDate() : dayjs(end * 1000).toDate()}
        display="inline"
        isVisible={isToDatePickerVisible || isFromDatePickerVisible}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        minuteInterval={1}
        modalStyleIOS={{
          margin: 40,
        }}
        mode="datetime"
        onCancel={hideDatePicker}
        onConfirm={isFromDatePickerVisible ? handleConfirm : handleConfirmTo}
        timePickerModeAndroid="clock"
      />
    </ScrollView>
  )
}

export { Chart }
