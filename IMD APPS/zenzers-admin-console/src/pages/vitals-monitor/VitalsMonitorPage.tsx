import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'
import { useHipaaMask } from '@/utils/hipaa-mask'
import { PatientVitalCard } from './PatientVitalCard'
import type { PatientVitalListResponse } from './types'

export function VitalsMonitorPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const navigate = useNavigate()
  const { unmasked, toggle, mask } = useHipaaMask()

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'vitals', 'patients'],
    queryFn: () => api.get<PatientVitalListResponse>('/admin/vitals/patients'),
    refetchInterval: 30_000,
  })

  const filtered = useMemo(() => {
    if (!data?.patients) return []
    if (!globalFilter) return data.patients
    const q = globalFilter.toLowerCase()
    return data.patients.filter(p => p.patientName.toLowerCase().includes(q))
  }, [data?.patients, globalFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load vitals data.</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Vitals Monitor</h1>
          <p className="text-slate-500 mt-1">Real-time patient vital signs &mdash; {data?.total ?? 0} patients</p>
        </div>
        <div className="flex items-center gap-4">
          {/* HIPAA Mask/Unmask — prominent toggle */}
          <Button
            icon={unmasked ? 'pi pi-eye' : 'pi pi-eye-slash'}
            label={unmasked ? 'PHI Visible' : 'PHI Masked'}
            severity={unmasked ? 'warning' : 'secondary'}
            className={unmasked ? 'p-button-raised' : ''}
            outlined={!unmasked}
            onClick={toggle}
            tooltip={unmasked ? 'PHI is visible — auto-relocks in 5 min' : 'Click to unmask Protected Health Information'}
            tooltipOptions={{ position: 'bottom' }}
          />
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-600">Live &mdash; 30s</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <span className="p-input-icon-left w-full md:w-96">
          <i className="pi pi-search" />
          <InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search patient..." className="w-full" />
        </span>
      </div>

      {/* Patient cards grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <i className="pi pi-heart text-4xl mb-3 block" />
          <p>No active patients</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <PatientVitalCard
              key={p.patientId}
              patient={p}
              mask={mask}
              onDetails={id => navigate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
