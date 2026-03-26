// Local replacement for @abnk/medical-support package
import type { VitalsItem } from './domain/vitals-item'
import { IVital } from '~/models/vital.model'

export type { VitalsItem }

// History item metadata interface
interface HistoryVitalMetadata {
  getAbnormalMaxValue(): number | null
  getAbnormalMinValue(): number | null
  isNormal(): boolean
  getTotalMean(): number | null
  getName(): string
}

// History item interface
export interface HistoryItem {
  getThresholdsId(): string
  getEndTimestamp(): number
  getStartTimestamp(): number
  getHistoryVitalsMetadata(): HistoryVitalMetadata[]
}

// Vitals mapper class
export class VitalsItemMapper {
  map(vital: IVital): VitalsItem {
    return vital as any as VitalsItem
  }
}

// Base use case for creating history
class HistoryUseCase {
  protected createHistoryVitalMetadata(
    vitals: VitalsItem[],
    vitalName: string
  ): HistoryVitalMetadata {
    const values = vitals
      .map(v => this.extractVitalValue(v, vitalName))
      .filter(v => v !== null) as number[]

    const mean = values.length > 0
      ? values.reduce((sum, val) => sum + val, 0) / values.length
      : null

    const abnormalMax = values.length > 0 ? Math.max(...values) : null
    const abnormalMin = values.length > 0 ? Math.min(...values) : null

    const normalFlags = vitals.map(v => {
      const entry = (v as any).vitals?.[vitalName]
      return entry?.isNormal ?? true
    })
    const allNormal = normalFlags.every(f => f)

    return {
      getAbnormalMaxValue: () => abnormalMax,
      getAbnormalMinValue: () => abnormalMin,
      isNormal: () => allNormal,
      getTotalMean: () => mean,
      getName: () => vitalName,
    }
  }

  protected extractVitalValue(vital: VitalsItem, vitalName: string): number | null {
    const v = (vital as any).vitals
    if (!v) return null
    const entry = v[vitalName]
    return entry?.value ?? null
  }

  protected groupVitalsByPeriod(vitals: VitalsItem[]): VitalsItem[][] {
    if (!vitals.length) return []
    const PERIOD = 300 // 5 minutes in seconds
    const groups: VitalsItem[][] = []
    let currentGroup: VitalsItem[] = []
    let groupStart = vitals[0].endTimestamp || 0

    for (const v of vitals) {
      const ts = v.endTimestamp || 0
      if (Math.abs(ts - groupStart) > PERIOD && currentGroup.length) {
        groups.push(currentGroup)
        currentGroup = []
        groupStart = ts
      }
      currentGroup.push(v)
    }
    if (currentGroup.length) groups.push(currentGroup)
    return groups
  }

  protected getThresholdsIdFromVitals(vitals: VitalsItem[]): string {
    return vitals[0]?.thresholdsId || ''
  }

  protected getTimestampRange(vitals: VitalsItem[]): { start: number; end: number } {
    const timestamps = vitals.map(v => v.endTimestamp || 0).filter(Boolean)
    if (!timestamps.length) return { start: 0, end: 0 }
    return { start: Math.min(...timestamps), end: Math.max(...timestamps) }
  }
}

// Selected vital history use case
class SelectedVitalHistoryUseCase extends HistoryUseCase {
  createHistory(vitals: VitalsItem[], vitalType: string): HistoryItem[] {
    const groupedVitals = this.groupVitalsByPeriod(vitals)

    return groupedVitals.map(group => {
      const timestamps = this.getTimestampRange(group)
      const metadata = this.createHistoryVitalMetadata(group, vitalType)

      return {
        getThresholdsId: () => this.getThresholdsIdFromVitals(group),
        getEndTimestamp: () => timestamps.end,
        getStartTimestamp: () => timestamps.start,
        getHistoryVitalsMetadata: () => [metadata],
      }
    })
  }
}

// All vitals history use case
class AllVitalsHistoryUseCase extends HistoryUseCase {
  createHistory(vitals: VitalsItem[]): HistoryItem[] {
    const groupedVitals = this.groupVitalsByPeriod(vitals)
    const vitalTypes = ['hr', 'temp', 'spo2', 'rr', 'sbp', 'dbp']

    return groupedVitals.map(group => {
      const timestamps = this.getTimestampRange(group)
      const metadata = vitalTypes.map(vitalType =>
        this.createHistoryVitalMetadata(group, vitalType)
      )

      return {
        getThresholdsId: () => this.getThresholdsIdFromVitals(group),
        getEndTimestamp: () => timestamps.end,
        getStartTimestamp: () => timestamps.start,
        getHistoryVitalsMetadata: () => metadata,
      }
    })
  }
}

// Factory for selected vital history
export class SelectedVitalHistoryUseCaseFactory {
  static createWithDefaultOptions(): SelectedVitalHistoryUseCase {
    return new SelectedVitalHistoryUseCase()
  }
}

// Factory for all vitals history
export class AllVitalsHistoryUseCaseFactory {
  static createWithDefaultOptions(): AllVitalsHistoryUseCase {
    return new AllVitalsHistoryUseCase()
  }
}
