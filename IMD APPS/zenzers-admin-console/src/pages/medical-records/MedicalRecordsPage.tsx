import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'

interface MedicalRecord { id: string; patientName: string; recordType: 'diagnosis' | 'medication' | 'treatment'; description: string; date: string; doctorName: string }
interface MedicalRecordsResponse { records: MedicalRecord[]; total: number }

const TYPE_OPTIONS = [{ label: 'All Types', value: '' }, { label: 'Diagnosis', value: 'diagnosis' }, { label: 'Medication', value: 'medication' }, { label: 'Treatment', value: 'treatment' }]
const TYPE_SEVERITY: Record<string, 'info' | 'warning' | 'success'> = { diagnosis: 'info', medication: 'warning', treatment: 'success' }

export function MedicalRecordsPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<MedicalRecord | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'medical-records'], queryFn: () => api.get<MedicalRecordsResponse>('/admin/medical-records') })

  const filtered = useMemo(() => {
    if (!data?.records) return []
    let result = data.records
    if (typeFilter) result = result.filter(r => r.recordType === typeFilter)
    if (globalFilter) { const q = globalFilter.toLowerCase(); result = result.filter(r => r.patientName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.doctorName.toLowerCase().includes(q)) }
    return result
  }, [data?.records, globalFilter, typeFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load medical records.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Medical Records</h1><p className="text-slate-500 mt-1">View patient medical records</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search records..." className="w-full" /></span>
          <Dropdown value={typeFilter} options={TYPE_OPTIONS} onChange={e => setTypeFilter(e.value)} placeholder="Filter by type" className="w-full md:w-48" />
        </div>
        <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50]} dataKey="id" emptyMessage="No records found." className="p-datatable-sm" sortMode="multiple" removableSort>
          <Column field="patientName" header="Patient" sortable style={{ minWidth: '12rem' }} />
          <Column field="recordType" header="Type" body={(r: MedicalRecord) => <Tag value={r.recordType.charAt(0).toUpperCase() + r.recordType.slice(1)} severity={TYPE_SEVERITY[r.recordType] || 'info'} />} sortable style={{ minWidth: '10rem' }} />
          <Column field="description" header="Description" style={{ minWidth: '16rem' }} />
          <Column field="date" header="Date" body={(r: MedicalRecord) => r.date ? new Date(r.date).toLocaleDateString() : '—'} sortable style={{ minWidth: '10rem' }} />
          <Column field="doctorName" header="Doctor" sortable style={{ minWidth: '12rem' }} />
          <Column header="Actions" body={(r: MedicalRecord) => <Button icon="pi pi-eye" rounded text severity="info" size="small" onClick={() => { setSelected(r); setViewOpen(true) }} />} style={{ minWidth: '5rem' }} />
        </DataTable>
      </div>
      <Dialog header="Medical Record" visible={viewOpen} onHide={() => setViewOpen(false)} style={{ width: '520px' }} modal>
        {selected && <dl className="detail-grid"><dt>Patient</dt><dd>{selected.patientName}</dd><dt>Type</dt><dd><Tag value={selected.recordType.charAt(0).toUpperCase() + selected.recordType.slice(1)} severity={TYPE_SEVERITY[selected.recordType] || 'info'} /></dd><dt>Description</dt><dd>{selected.description}</dd><dt>Date</dt><dd>{selected.date ? new Date(selected.date).toLocaleDateString() : '—'}</dd><dt>Doctor</dt><dd>{selected.doctorName}</dd></dl>}
      </Dialog>
    </div>
  )
}
