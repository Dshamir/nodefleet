import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'
import { useHipaaMask } from '@/utils/hipaa-mask'
import type { PatientVitalSingleResponse, TelemetryResponse, TelemetryLogEntry } from './types'

const STATUS_CFG = {
  normal:   { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  text: 'text-green-700',  label: 'Normal' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'Warning' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-700',    label: 'Critical' },
} as const

function vitalColor(val: number | null, lo: number, hi: number) {
  if (val === null) return 'text-slate-400'
  return (val < lo || val > hi) ? 'text-red-600 font-bold' : 'text-slate-800'
}

function flagBadge(val: boolean | null, label: string) {
  if (val === null) return <span className="text-slate-400 text-xs">{label}: N/A</span>
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {label}: {val ? 'Normal' : 'Abnormal'}
    </span>
  )
}

function relativeTime(dateStr: string | null) {
  if (!dateStr) return '\u2014'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const navigate = useNavigate()
  const { unmasked, toggle, mask } = useHipaaMask()
  const [telemetryPage, setTelemetryPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<any>(null)

  const { data: patientData, isLoading: patientLoading, error: patientError } = useQuery({
    queryKey: ['admin', 'vitals', 'patients', patientId],
    queryFn: () => api.get<PatientVitalSingleResponse>(`/admin/vitals/patients/${patientId}`),
    refetchInterval: 30_000,
    enabled: !!patientId,
  })

  const { data: telemetryData, isLoading: telemetryLoading } = useQuery({
    queryKey: ['admin', 'vitals', 'telemetry', patientId, telemetryPage],
    queryFn: () => api.get<TelemetryResponse>(`/admin/vitals/${patientId}/telemetry`, { page: String(telemetryPage), limit: '50' }),
    refetchInterval: 30_000,
    enabled: !!patientId,
  })

  const onPage = useCallback((e: any) => {
    setTelemetryPage(Math.floor(e.first / e.rows) + 1)
  }, [])

  if (patientLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (patientError || !patientData?.patient) {
    return (
      <div className="p-4">
        <Button icon="pi pi-arrow-left" label="Back to Vitals Monitor" text onClick={() => navigate('/admin/vitals-monitor')} className="mb-4" />
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Patient not found or failed to load.</div>
      </div>
    )
  }

  const p = patientData.patient
  const v = p.latestVitals
  const cfg = STATUS_CFG[v.status] || STATUS_CFG.normal

  const rowExpansionTemplate = (row: TelemetryLogEntry) => (
    <div className="p-3 bg-slate-50 flex flex-wrap gap-2">
      {flagBadge(row.isHrNormal, 'HR')}
      {flagBadge(row.isSbpNormal, 'SBP')}
      {flagBadge(row.isDbpNormal, 'DBP')}
      {flagBadge(row.isSpo2Normal, 'SpO2')}
      {flagBadge(row.isTempNormal, 'Temp')}
      {flagBadge(row.isRrNormal, 'RR')}
      {row.fall && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">FALL DETECTED</span>}
    </div>
  )

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Button icon="pi pi-arrow-left" label="Back to Vitals Monitor" text onClick={() => navigate('/admin/vitals-monitor')} />
        <Button
          icon={unmasked ? 'pi pi-eye' : 'pi pi-eye-slash'}
          label={unmasked ? 'Unmask PHI' : 'Masked'}
          severity={unmasked ? 'warning' : 'secondary'}
          outlined
          size="small"
          onClick={toggle}
        />
      </div>

      {/* Patient Header */}
      <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-6 mb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">{mask(p.patientName, 'name')}</h2>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          {p.gateway ? (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${p.gateway.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${p.gateway.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
              {p.gateway.status === 'online' ? 'Online' : 'Offline'}
            </span>
          ) : (
            <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Unknown</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
          <div className="flex items-center gap-4">
            <span><i className="pi pi-phone mr-1" />{mask(p.phone, 'phone')}</span>
            <span><i className="pi pi-envelope mr-1" />{mask(p.email, 'email')}</span>
            {p.dateOfBirth && <span><i className="pi pi-calendar mr-1" />{mask(p.dateOfBirth, 'dob')}</span>}
          </div>
          <div className="flex items-center gap-4">
            <span>
              <i className="pi pi-user mr-1" />
              {p.doctor ? `Dr. ${mask(p.doctor.name, 'name')}${p.doctor.specialization ? ` (${p.doctor.specialization})` : ''}` : <span className="text-slate-400 italic">No doctor</span>}
            </span>
            <span>
              <i className="pi pi-heart mr-1" />
              {p.caregiver ? mask(p.caregiver.name, 'name') : <span className="text-slate-400 italic">No caregiver</span>}
            </span>
          </div>
        </div>

        {p.gateway && (
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <span><i className="pi pi-wifi mr-1" />Device: {p.gateway.deviceId}</span>
            <span>Battery: {p.gateway.batteryPercent}%</span>
            <span>Last seen: {relativeTime(p.gateway.lastSeen)}</span>
          </div>
        )}
      </div>

      {/* Latest Vitals Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Heart Rate</div>
          <div className={`text-2xl font-bold font-mono ${vitalColor(v.heartRate, 60, 100)}`}>{v.heartRate ?? '\u2014'}<span className="text-sm text-slate-400 ml-1">bpm</span></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Blood Pressure</div>
          <div className={`text-2xl font-bold font-mono ${vitalColor(v.bloodPressureSystolic, 90, 140)}`}>{v.bloodPressureSystolic ?? '\u2014'}/{v.bloodPressureDiastolic ?? '\u2014'}<span className="text-sm text-slate-400 ml-1">mmHg</span></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Temperature</div>
          <div className={`text-2xl font-bold font-mono ${vitalColor(v.temperature, 36.1, 37.5)}`}>{v.temperature ?? '\u2014'}<span className="text-sm text-slate-400 ml-1">&deg;C</span></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">SpO2</div>
          <div className={`text-2xl font-bold font-mono ${vitalColor(v.spO2, 95, 100)}`}>{v.spO2 ?? '\u2014'}<span className="text-sm text-slate-400 ml-1">%</span></div>
        </div>
      </div>

      {/* Telemetry Log */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Telemetry Log</h3>
          <p className="text-xs text-slate-400 mt-0.5">Click a row to expand raw flags</p>
        </div>
        {telemetryLoading ? (
          <div className="flex items-center justify-center py-12"><ProgressSpinner style={{ width: '40px', height: '40px' }} /></div>
        ) : (
          <DataTable
            value={telemetryData?.entries || []}
            paginator
            lazy
            rows={50}
            totalRecords={telemetryData?.total || 0}
            first={(telemetryPage - 1) * 50}
            onPage={onPage}
            expandedRows={expandedRows}
            onRowToggle={(e) => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            dataKey="id"
            size="small"
            stripedRows
            emptyMessage="No telemetry data available"
          >
            <Column expander style={{ width: '3rem' }} />
            <Column field="syncTimestamp" header="Timestamp" body={(row: TelemetryLogEntry) => row.syncTimestamp ? new Date(row.syncTimestamp).toLocaleString() : '\u2014'} />
            <Column field="heartRate" header="HR" body={(row: TelemetryLogEntry) => <span className={`font-mono ${vitalColor(row.heartRate, 60, 100)}`}>{row.heartRate ?? '\u2014'}</span>} />
            <Column header="BP" body={(row: TelemetryLogEntry) => <span className={`font-mono ${vitalColor(row.bloodPressureSystolic, 90, 140)}`}>{row.bloodPressureSystolic ?? '\u2014'}/{row.bloodPressureDiastolic ?? '\u2014'}</span>} />
            <Column field="temperature" header="Temp" body={(row: TelemetryLogEntry) => <span className={`font-mono ${vitalColor(row.temperature, 36.1, 37.5)}`}>{row.temperature ?? '\u2014'}</span>} />
            <Column field="spO2" header="SpO2" body={(row: TelemetryLogEntry) => <span className={`font-mono ${vitalColor(row.spO2, 95, 100)}`}>{row.spO2 ?? '\u2014'}</span>} />
            <Column field="respiratoryRate" header="RR" body={(row: TelemetryLogEntry) => <span className="font-mono">{row.respiratoryRate ?? '\u2014'}</span>} />
            <Column field="fall" header="Fall" body={(row: TelemetryLogEntry) => row.fall ? <span className="text-red-600 font-bold text-xs">YES</span> : <span className="text-slate-400 text-xs">No</span>} />
            <Column field="status" header="Status" body={(row: TelemetryLogEntry) => {
              const c = STATUS_CFG[row.status] || STATUS_CFG.normal
              return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}</span>
            }} />
          </DataTable>
        )}
      </div>
    </div>
  )
}
