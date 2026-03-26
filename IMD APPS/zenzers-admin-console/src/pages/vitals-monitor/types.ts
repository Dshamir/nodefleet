export interface PatientVitalNode {
  patientId: string
  patientName: string
  email: string
  phone: string
  dateOfBirth: string | null
  doctor: {
    id: string
    name: string
    email: string
    phone: string
    specialization: string
  } | null
  caregiver: {
    id: string
    name: string
    email: string
    phone: string
  } | null
  gateway: {
    deviceId: string
    status: 'online' | 'offline'
    lastSeen: string | null
    batteryPercent: number
  } | null
  latestVitals: {
    heartRate: number | null
    bloodPressureSystolic: number | null
    bloodPressureDiastolic: number | null
    temperature: number | null
    spO2: number | null
    timestamp: string | null
    status: 'normal' | 'warning' | 'critical'
    deviceSerial: string | null
    relayType: string | null
  }
}

export interface PatientVitalListResponse {
  patients: PatientVitalNode[]
  total: number
}

export interface PatientVitalSingleResponse {
  patient: PatientVitalNode
}

export interface TelemetryLogEntry {
  id: string
  syncTimestamp: string
  heartRate: number | null
  bloodPressureSystolic: number | null
  bloodPressureDiastolic: number | null
  temperature: number | null
  spO2: number | null
  respiratoryRate: number | null
  fall: boolean
  status: 'normal' | 'warning' | 'critical'
  isHrNormal: boolean | null
  isSbpNormal: boolean | null
  isDbpNormal: boolean | null
  isSpo2Normal: boolean | null
  isTempNormal: boolean | null
  isRrNormal: boolean | null
  deviceSerial: string | null
  relayType: string | null
  relayId: string | null
}

export interface DeviceBindingEntry {
  id: string
  deviceSerial: string
  userId: string
  relayType: string
  relayId: string
  boundAt: string
}

export interface DeviceBindingsResponse {
  bindings: DeviceBindingEntry[]
}

export interface TelemetryResponse {
  entries: TelemetryLogEntry[]
  total: number
  page: number
  limit: number
}
