export type PostPatientVitalsRequest = {
  vitals: IVital[]
}

export type IVital = {
  temp: number | 0 | null
  isTempNormal: boolean
  hr: number | 0 | null
  isHrNormal: boolean
  spo2: number | 0 | null
  isSpo2Normal: boolean
  rr: number | 0 | null
  isRrNormal: boolean
  dbp: number | 0 | null
  isDbpNormal: boolean
  sbp: number | 0 | null
  isSbpNormal: boolean
  fall: boolean | null | number
  fallType: string | null | undefined
  timestamp: number | 0
  thresholdsId: string
  vitalId?: string
  deviceSerial?: string | null
  relayType?: string | null
  relayId?: string | null
}
