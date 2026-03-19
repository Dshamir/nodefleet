import { Button } from 'primereact/button'
import type { PatientVitalNode } from './types'

const STATUS_CFG = {
  normal:   { bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500',  text: 'text-green-700',  label: 'Normal' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700', label: 'Warning' },
  critical: { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-700',    label: 'Critical' },
} as const

function vitalColor(val: number | null, lo: number, hi: number) {
  if (val === null) return 'text-slate-400'
  return (val < lo || val > hi) ? 'text-red-600 font-bold' : 'text-slate-800'
}

function gatewayBadge(gateway: PatientVitalNode['gateway']) {
  if (!gateway) return <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Unknown</span>
  const online = gateway.status === 'online'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${online ? 'bg-green-500' : 'bg-red-500'}`} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

interface Props {
  patient: PatientVitalNode
  mask: (value: string | null | undefined, fieldType: 'name' | 'email' | 'phone' | 'dob') => string
  onDetails: (id: string) => void
}

export function PatientVitalCard({ patient, mask, onDetails }: Props) {
  const { latestVitals: v } = patient
  const cfg = STATUS_CFG[v.status] || STATUS_CFG.normal

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 hover:shadow-md transition-shadow`}>
      {/* Header: name + gateway badge */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-slate-800 text-sm truncate mr-2">{mask(patient.patientName, 'name')}</h3>
        {gatewayBadge(patient.gateway)}
      </div>

      {/* Contact info */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        <span title="Phone"><i className="pi pi-phone mr-1" />{mask(patient.phone, 'phone')}</span>
        <span title="Email" className="truncate"><i className="pi pi-envelope mr-1" />{mask(patient.email, 'email')}</span>
      </div>

      {/* Vitals grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/70 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Heart Rate</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.heartRate, 60, 100)}`}>
            {v.heartRate ?? '\u2014'}<span className="text-xs text-slate-400 ml-1">bpm</span>
          </div>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Blood Pressure</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.bloodPressureSystolic, 90, 140)}`}>
            {v.bloodPressureSystolic ?? '\u2014'}/{v.bloodPressureDiastolic ?? '\u2014'}<span className="text-xs text-slate-400 ml-1">mmHg</span>
          </div>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Temperature</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.temperature, 36.1, 37.5)}`}>
            {v.temperature ?? '\u2014'}<span className="text-xs text-slate-400 ml-1">&deg;C</span>
          </div>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">SpO2</div>
          <div className={`text-lg font-bold font-mono mt-0.5 ${vitalColor(v.spO2, 95, 100)}`}>
            {v.spO2 ?? '\u2014'}<span className="text-xs text-slate-400 ml-1">%</span>
          </div>
        </div>
      </div>

      {/* Doctor / Caregiver */}
      <div className="text-xs text-slate-500 mb-3 space-y-1">
        <div>
          <i className="pi pi-user mr-1" />
          {patient.doctor
            ? <>{mask(patient.doctor.name, 'name')}{patient.doctor.specialization ? ` (${patient.doctor.specialization})` : ''}</>
            : <span className="text-slate-400 italic">No doctor assigned</span>}
        </div>
        <div>
          <i className="pi pi-heart mr-1" />
          {patient.caregiver
            ? mask(patient.caregiver.name, 'name')
            : <span className="text-slate-400 italic">No caregiver assigned</span>}
        </div>
      </div>

      {/* Footer: status + details button */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
        <Button icon="pi pi-arrow-right" label="Details" text size="small" className="text-xs" onClick={() => onDetails(patient.patientId)} />
      </div>
    </div>
  )
}
