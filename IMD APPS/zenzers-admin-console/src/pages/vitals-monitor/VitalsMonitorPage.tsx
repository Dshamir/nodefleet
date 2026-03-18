import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'

interface VitalReading { id: string; patientId: string; patientName: string; heartRate: number; bloodPressureSystolic: number; bloodPressureDiastolic: number; temperature: number; spO2: number; timestamp: string; status: 'normal' | 'warning' | 'critical' }
interface VitalsResponse { vitals: VitalReading[]; total: number }

const STATUS_CFG = {
  normal:   { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  text: 'text-green-700',  label: 'Normal' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'Warning' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-700',    label: 'Critical' },
}

function vitalColor(val: number, lo: number, hi: number) {
  return (val < lo || val > hi) ? 'text-red-600 font-bold' : 'text-slate-800'
}

export function VitalsMonitorPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selected, setSelected] = useState<VitalReading | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'vitals', 'active'], queryFn: () => api.get<VitalsResponse>('/admin/vitals/active'), refetchInterval: 30_000 })

  const filtered = useMemo(() => {
    if (!data?.vitals) return []
    if (!globalFilter) return data.vitals
    const q = globalFilter.toLowerCase()
    return data.vitals.filter(v => v.patientName.toLowerCase().includes(q))
  }, [data?.vitals, globalFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load vitals.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Vitals Monitor</h1><p className="text-slate-500 mt-1">Real-time patient vital signs</p></div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" /></span>
          <span className="text-xs font-medium text-green-600">Live — 30s</span>
        </div>
      </div>
      <div className="mb-4"><span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search patient..." className="w-full" /></span></div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200"><i className="pi pi-heart text-4xl mb-3 block" /><p>No active vitals</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(v => {
            const cfg = STATUS_CFG[v.status] || STATUS_CFG.normal
            return (
              <div key={v.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 hover:shadow-md transition-shadow`}>
                <div className="flex items-center justify-between mb-4">
                  <div><h3 className="font-semibold text-slate-800 text-sm">{v.patientName}</h3><p className="text-xs text-slate-400 mt-0.5">{new Date(v.timestamp).toLocaleTimeString()}</p></div>
                  <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${cfg.dot}`} /><span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/70 rounded-lg p-2.5"><div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Heart Rate</div><div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.heartRate, 60, 100)}`}>{v.heartRate}<span className="text-xs text-slate-400 ml-1">bpm</span></div></div>
                  <div className="bg-white/70 rounded-lg p-2.5"><div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Blood Pressure</div><div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.bloodPressureSystolic, 90, 140)}`}>{v.bloodPressureSystolic}/{v.bloodPressureDiastolic}<span className="text-xs text-slate-400 ml-1">mmHg</span></div></div>
                  <div className="bg-white/70 rounded-lg p-2.5"><div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Temperature</div><div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.temperature, 36.1, 37.5)}`}>{v.temperature}<span className="text-xs text-slate-400 ml-1">&deg;C</span></div></div>
                  <div className="bg-white/70 rounded-lg p-2.5"><div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">SpO2</div><div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.spO2, 95, 100)}`}>{v.spO2}<span className="text-xs text-slate-400 ml-1">%</span></div></div>
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-slate-200/50">
                  <Button icon="pi pi-eye" label="Details" text size="small" className="text-xs" onClick={() => { setSelected(v); setDetailOpen(true) }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog header="Vital Signs Detail" visible={detailOpen} onHide={() => setDetailOpen(false)} style={{ width: '520px' }} modal>
        {selected && (
          <div>
            <div className="mb-4 pb-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">{selected.patientName}</h3>
              <p className="text-sm text-slate-500">{new Date(selected.timestamp).toLocaleString()}</p>
            </div>
            <dl className="detail-grid">
              <dt>Heart Rate</dt><dd><span className={`font-mono font-bold ${vitalColor(selected.heartRate, 60, 100)}`}>{selected.heartRate} bpm</span></dd>
              <dt>Blood Pressure</dt><dd><span className={`font-mono font-bold ${vitalColor(selected.bloodPressureSystolic, 90, 140)}`}>{selected.bloodPressureSystolic}/{selected.bloodPressureDiastolic} mmHg</span></dd>
              <dt>Temperature</dt><dd><span className={`font-mono font-bold ${vitalColor(selected.temperature, 36.1, 37.5)}`}>{selected.temperature}&deg;C</span></dd>
              <dt>SpO2</dt><dd><span className={`font-mono font-bold ${vitalColor(selected.spO2, 95, 100)}`}>{selected.spO2}%</span></dd>
              <dt>Status</dt><dd><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CFG[selected.status]?.bg} ${STATUS_CFG[selected.status]?.text}`}><span className={`w-1.5 h-1.5 rounded-full ${STATUS_CFG[selected.status]?.dot}`} />{STATUS_CFG[selected.status]?.label}</span></dd>
            </dl>
          </div>
        )}
      </Dialog>
    </div>
  )
}
