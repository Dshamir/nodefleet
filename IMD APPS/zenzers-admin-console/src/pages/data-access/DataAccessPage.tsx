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

interface DataAccessEntry { id: string; patientName: string; grantedTo: string; grantedToRole: 'doctor' | 'caregiver'; accessLevel: 'full' | 'read-only' | 'restricted'; grantedDate: string; status: 'active' | 'revoked' | 'expired' }
interface DataAccessResponse { entries: DataAccessEntry[]; total: number }

const ACCESS_OPTIONS = [{ label: 'All Levels', value: '' }, { label: 'Full', value: 'full' }, { label: 'Read-Only', value: 'read-only' }, { label: 'Restricted', value: 'restricted' }]
const ACCESS_SEV: Record<string, 'success' | 'info' | 'warning'> = { full: 'success', 'read-only': 'info', restricted: 'warning' }
const STATUS_SEV: Record<string, 'success' | 'danger' | 'warning'> = { active: 'success', revoked: 'danger', expired: 'warning' }

export function DataAccessPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [accessFilter, setAccessFilter] = useState('')
  const [selected, setSelected] = useState<DataAccessEntry | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'data-access'], queryFn: () => api.get<DataAccessResponse>('/admin/data-access') })

  const filtered = useMemo(() => {
    if (!data?.entries) return []
    let result = data.entries
    if (accessFilter) result = result.filter(e => e.accessLevel === accessFilter)
    if (globalFilter) { const q = globalFilter.toLowerCase(); result = result.filter(e => e.patientName.toLowerCase().includes(q) || e.grantedTo.toLowerCase().includes(q)) }
    return result
  }, [data?.entries, globalFilter, accessFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load data access records.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Data Access Management</h1><p className="text-slate-500 mt-1">Control patient data access permissions</p></div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium"><i className="pi pi-shield text-xs" />HIPAA Compliant</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search..." className="w-full" /></span>
          <Dropdown value={accessFilter} options={ACCESS_OPTIONS} onChange={e => setAccessFilter(e.value)} placeholder="Access level" className="w-full md:w-48" />
        </div>
        <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50]} dataKey="id" emptyMessage="No records found." className="p-datatable-sm" sortMode="multiple" removableSort>
          <Column field="patientName" header="Patient" sortable style={{ minWidth: '12rem' }} />
          <Column field="grantedTo" header="Granted To" body={(r: DataAccessEntry) => <div className="flex items-center gap-2"><span>{r.grantedTo}</span><span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 capitalize">{r.grantedToRole}</span></div>} sortable style={{ minWidth: '14rem' }} />
          <Column field="accessLevel" header="Access" body={(r: DataAccessEntry) => <Tag value={r.accessLevel.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} severity={ACCESS_SEV[r.accessLevel] || 'info'} />} sortable style={{ minWidth: '10rem' }} />
          <Column field="grantedDate" header="Date" body={(r: DataAccessEntry) => r.grantedDate ? new Date(r.grantedDate).toLocaleDateString() : '—'} sortable style={{ minWidth: '10rem' }} />
          <Column field="status" header="Status" body={(r: DataAccessEntry) => <Tag value={r.status.charAt(0).toUpperCase() + r.status.slice(1)} severity={STATUS_SEV[r.status] || 'info'} />} sortable style={{ minWidth: '8rem' }} />
          <Column header="Actions" body={(r: DataAccessEntry) => <Button icon="pi pi-eye" rounded text severity="info" size="small" onClick={() => { setSelected(r); setViewOpen(true) }} />} style={{ minWidth: '5rem' }} />
        </DataTable>
      </div>
      <Dialog header="Data Access Details" visible={viewOpen} onHide={() => setViewOpen(false)} style={{ width: '500px' }} modal>
        {selected && <dl className="detail-grid"><dt>Patient</dt><dd>{selected.patientName}</dd><dt>Granted To</dt><dd>{selected.grantedTo} <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 capitalize ml-1">{selected.grantedToRole}</span></dd><dt>Access Level</dt><dd><Tag value={selected.accessLevel.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} severity={ACCESS_SEV[selected.accessLevel] || 'info'} /></dd><dt>Granted Date</dt><dd>{selected.grantedDate ? new Date(selected.grantedDate).toLocaleDateString() : '—'}</dd><dt>Status</dt><dd><Tag value={selected.status.charAt(0).toUpperCase() + selected.status.slice(1)} severity={STATUS_SEV[selected.status] || 'info'} /></dd></dl>}
      </Dialog>
    </div>
  )
}
