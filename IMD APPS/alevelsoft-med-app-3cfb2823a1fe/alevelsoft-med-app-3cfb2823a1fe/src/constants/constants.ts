import { MaterialTopTabNavigationOptions } from '@react-navigation/material-top-tabs'
import dayjs, { ManipulateType } from 'dayjs'
import { Dimensions, Platform } from 'react-native'
import { Config } from 'react-native-config'
import { UnitsType } from 'src/helpers/units-helper'

import { FilterTypeEnum } from '../enums/filter-type.enum'
import { TimesPerDayType } from '../enums/profile.enum'
import { OrganizationType, Relationship } from '../enums/relationship.enum'
import { CaregiverRoleType, NurseSpecialityType, RolesType } from '../enums/roles.enum'
import { TimeType } from '../enums/time-type.enum'
import { BpVitalsChartType, VitalsChartType } from '../enums/vitals-type.enum'
import { FilterParamsType } from '../stores/slices/vitals.slice'
import { BaseUser } from '../stores/types/profile.types'
import { Colors } from '../styles'

export const BASE_URL = __DEV__ ? 'http://10.0.2.2:43001/api' : Config.API_URL

export const isIOS = Platform.OS === 'ios'
export const WIDTH = Dimensions.get('screen').width
export const HEIGHT = Dimensions.get('screen').height

export const CONNECT_BLE = 'ConnectBle'
export const LOGIN = 'Login'
export const CONFIRM_SIGN_UP = 'ConfirmSignUp'
export const CREATE_PATIENT_INFO = 'CreatePatientInfo'
export const CREATE_PATIENT_DATA = 'CreatePatientData'
export const CREATE_USER_AUTH = 'CreateUserAuth'
export const CHOOSE_ROLE = 'ChooseRole'
export const CREATE_HEALTH_WORKER = 'CreateHealthWorker'
export const NORMAL = 'Normal'
export const PROFILE = 'Profile'
export const EDIT_BASIC_INFO = 'EditBasicInfo'
export const NEW_TREATMENT_INFO = 'NewTreatmentInfo'
export const OUTGOING = 'OUTGOING'
export const WAITING_ROOM = 'WAITING ROOM'
export const EDIT_EMAIL = 'EditEmail'
export const NEW_EMAIL_VERIFICATION = 'NewEmailVerification'
export const EDIT_PASSWORD = 'EditPassword'

export const IOS_BLE = 'App-Prefs:Bluetooth'
export const ANDROID_BLE = 'android.settings.BLUETOOTH_SETTINGS'

export const BLE_NAME = 'ZENZERS'

export const errorMessages = {
  required: 'This field is required',
  email: 'Invalid email address',
  firstName: 'Max characters for First Name 30',
  lastName: 'Max characters for Last Name 30',
  name: 'Max characters for Name 100',
  phoneMin: 'Min numbers for Phone 11',
  phoneMax: 'Max numbers for Phone 11',
  phone: 'Phone number is not valid',
  password: 'Min numbers for password 8',
  height: 'Height must be from 50 cm to 250 cm',
  weight: 'Weight must be from 10 kg to 200 kg',
  integer: 'Value must be a integer',
  number: 'Value must be a number',
  institution: 'Max characters for Institution 100',
  doseMin: 'Value must be not less than 0.001',
  doseMax: 'Value must be not more than 10000',
  timesPerDay: 'This field is required',
  inviteMessage: 'The maximum message length is 500 characters',
  regex: '',
} as const

export const VITALS_TAB = [
  {
    key: VitalsChartType.hr,
    label: 'HR',
    title: 'Heart Rate',
  },
  {
    key: VitalsChartType.temp,
    label: 'TEMP',
    title: 'Temperature',
  },
  {
    key: VitalsChartType.spo2,
    label: 'SPO2',
    title: '02 Saturation',
  },
  {
    key: VitalsChartType.rr,
    label: 'RR',
    title: 'Respiration Rate',
  },
  {
    key: VitalsChartType.bp,
    label: 'BP',
    title: 'Blood Pressure',
  },
]

export type TimeTypePeriod = keyof typeof TimeType

type ITimePeriod = {
  [key in TimeTypePeriod]: {
    label: string
    value: number
    unit: ManipulateType
  }
}

export const TimePeriod: ITimePeriod = {
  oneHour: {
    label: '1H',
    value: 1,
    unit: 'hour',
  },
  twelveHours: {
    label: '12H',
    value: 12,
    unit: 'hours',
  },
  day: {
    label: '24H',
    value: 1,
    unit: 'day',
  },
  week: {
    label: '7D',
    value: 7,
    unit: 'days',
  },
  month: {
    label: '30D',
    value: 1,
    unit: 'month',
  },
  range: {
    label: 'RANGE',
    value: 1,
    unit: 'month',
  },
}

export type VitalsNavType = (typeof VITALS_TAB)[number]

export const convertIndexToLbs = 2.204623
export const convertIndexToKg = 0.45359237
export const convertIndexToInches = 0.393700784
export const convertIndexToCm = 2.54

export const VITALS_INTERVAL = 5000
export const DEFAULT_EMERGENCY_TIMEOUT = 60000
export const HISTORY_START_TIME_OFFSET = 30
export const RelationshipList = [
  { label: Relationship.friend, value: Relationship.friend },
  { label: 'Caregiver Professional', value: Relationship.caregiver },
  { label: Relationship.doctor, value: Relationship.doctor },
]

export const OrganizationTypeList = [
  { label: OrganizationType.pharmacy, value: OrganizationType.pharmacy },
  { label: OrganizationType.nursingHome, value: OrganizationType.nursingHome },
  { label: OrganizationType.other, value: OrganizationType.other },
]

export const RolesList = [
  { label: CaregiverRoleType.doctor, value: CaregiverRoleType.doctor },
  { label: CaregiverRoleType.nurse, value: CaregiverRoleType.nurse },
  { label: 'Caregiver Professional', value: CaregiverRoleType.caregiver },
  { label: CaregiverRoleType.friend, value: CaregiverRoleType.friend },
  { label: CaregiverRoleType.family, value: CaregiverRoleType.family },
]

export const NurseSpecialtiesList = [
  { label: NurseSpecialityType.nurse, value: NurseSpecialityType.nurse },
  { label: NurseSpecialityType.nursePractitioner, value: NurseSpecialityType.nursePractitioner },
]

export const DoctorRolesList = [
  { label: CaregiverRoleType.doctor, value: CaregiverRoleType.doctor },
  { label: CaregiverRoleType.nurse, value: CaregiverRoleType.nurse },
]

export const CaregiverRolesList = [
  { label: 'Caregiver Professional', value: CaregiverRoleType.caregiver },
  { label: CaregiverRoleType.friend, value: CaregiverRoleType.friend },
  { label: CaregiverRoleType.family, value: CaregiverRoleType.family },
]

export const InviteRolesList = [
  { label: CaregiverRoleType.doctor, value: CaregiverRoleType.doctor },
  { label: 'Caregiver', value: CaregiverRoleType.caregiver },
]

export const FilterList = [
  { label: FilterTypeEnum.recent, value: FilterTypeEnum.recent },
  { label: FilterTypeEnum.oldest, value: FilterTypeEnum.oldest },
]

export const FilterListByType = [
  { label: FilterParamsType.all, value: FilterParamsType.all },
  { label: FilterParamsType.hr, value: FilterParamsType.hr },
  { label: FilterParamsType.rr, value: FilterParamsType.rr },
  { label: FilterParamsType.temp, value: FilterParamsType.temp },
  { label: FilterParamsType.spo2, value: FilterParamsType.spo2 },
  { label: FilterParamsType.bp_sys, value: FilterParamsType.bp_sys },
  { label: FilterParamsType.bp_dia, value: FilterParamsType.bp_dia },
  { label: FilterParamsType.fall, value: FilterParamsType.fall },
]

export const TimesPerDayList = [
  { label: TimesPerDayType.QD, value: TimesPerDayType.QD },
  { label: TimesPerDayType.BID, value: TimesPerDayType.BID },
  { label: TimesPerDayType.TID, value: TimesPerDayType.TID },
  { label: TimesPerDayType.QID, value: TimesPerDayType.QID },
]

export const heartRateIcon = require('../assets/images/hr_icon.webp')
export const temperatureIcon = require('../assets/images/temp_icon.webp')
export const spoIcon = require('../assets/images/spo2_icon.webp')
export const rrIcon = require('../assets/images/rr_icon.webp')
export const fallIcon = require('../assets/images/fall_icon_green.webp')
export const fallRedIcon = require('../assets/images/fall_icon_red.webp')
export const bloodIcon = require('../assets/images/bp_icon_gray.webp')
export const bloodRedIcon = require('../assets/images/bp_icon.webp')
export const test = require('../assets/images/fall-icons/fall-trip-red-bg.png')

export const startDate = dayjs().subtract(TimePeriod.month.value, TimePeriod.month.unit).toISOString()

export type VitalsChartTabKeys = keyof typeof VitalsChartType
export type BpVitalsChartTabKeys = keyof typeof BpVitalsChartType

export interface IThresholdsChart {
  minHr: number
  maxHr: number
  minTemp: number
  maxTemp: number
  minSpo2: number
  minRr: number
  maxRr: number
  minDbp: number
  maxDbp: number
  minSbp: number
  maxSbp: number
}

export type IThresholdsChartKeys = keyof IThresholdsChart

type VitalThresholdType = {
  [key in VitalsChartTabKeys]: {
    max?: IThresholdsChartKeys
    min?: IThresholdsChartKeys
    minDbp?: IThresholdsChartKeys
    maxDbp?: IThresholdsChartKeys
    minSbp?: IThresholdsChartKeys
    maxSbp?: IThresholdsChartKeys
  }
}

export const VITAL_THRESHOLDS_TYPE: VitalThresholdType = {
  hr: {
    max: 'maxHr',
    min: 'minHr',
  },
  spo2: {
    min: 'minSpo2',
  },
  rr: {
    max: 'maxRr',
    min: 'minRr',
  },
  temp: {
    max: 'maxTemp',
    min: 'minTemp',
  },
  bp: {
    minDbp: 'minDbp',
    maxDbp: 'maxDbp',
    minSbp: 'minSbp',
    maxSbp: 'maxSbp',
  },
}

export const defaultBaseUser: BaseUser = {
  measurementSystem: UnitsType.Metric,
  passwordUpdatedAt: 0,
  roleLabel: '',
  avatar: '',
  deletedAt: null,
  userId: '',
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: RolesType.patient,
  fullName: '',
}

export const TAB_OPTIONS = {
  tabBarActiveTintColor: Colors.primaryBlue,
  tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
  tabBarStyle: { backgroundColor: Colors.primaryWhite },
  tabBarIndicatorStyle: {
    backgroundColor: Colors.primaryBlue,
  },
  tabBarInactiveTintColor: Colors.primaryGray,
} as MaterialTopTabNavigationOptions

export const sideSize = Dimensions.get('screen').width / 3 - 5
export const bpWidth = sideSize * 2 + 5

export const PickerPlaceholder = { label: 'Select', value: null }
