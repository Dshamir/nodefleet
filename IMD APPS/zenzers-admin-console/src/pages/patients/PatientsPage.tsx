import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Tag } from 'primereact/tag'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { Toast } from 'primereact/toast'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'

interface Patient { id: string; name: string; email: string; phone: string; dateOfBirth: string; status: 'active' | 'inactive' }
interface PatientsResponse { patients: Patient[]; total: number }

export function PatientsPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const toast = useRef<Toast>(null)
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'patients'], queryFn: () => api.get<PatientsResponse>('/admin/patients') })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'patients'] }); toast.current?.show({ severity: 'success', summary: 'Deleted', detail: 'Patient removed', life: 3000 }) },
    onError: () => toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Delete failed', life: 3000 }),
  })

  const filtered = useMemo(() => {
    if (!data?.patients) return []
    if (!globalFilter) return data.patients
    const q = globalFilter.toLowerCase()
    return data.patients.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
  }, [data?.patients, globalFilter])

  const confirmDel = (p: Patient) => confirmDialog({ message: `Delete ${p.name}?`, header: 'Confirm', icon: 'pi pi-exclamation-triangle', acceptClassName: 'p-button-danger', accept: () => deleteMut.mutate(p.id) })

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load patients.</div>

  return (
    <div>
      <Toast ref={toast} /><ConfirmDialog />
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Patients</h1><p className="text-slate-500 mt-1">Manage patient records</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-4"><span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search..." className="w-full" /></span></div>
        <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50]} dataKey="id" emptyMessage="No patients found." className="p-datatable-sm" sortMode="multiple" removableSort>
          <Column field="name" header="Name" sortable style={{ minWidth: '12rem' }} />
          <Column field="email" header="Email" sortable style={{ minWidth: '14rem' }} />
          <Column field="phone" header="Phone" style={{ minWidth: '10rem' }} />
          <Column field="dateOfBirth" header="DOB" body={(r: Patient) => r.dateOfBirth ? new Date(r.dateOfBirth).toLocaleDateString() : '—'} sortable style={{ minWidth: '10rem' }} />
          <Column field="status" header="Status" body={(r: Patient) => <Tag value={r.status === 'active' ? 'Active' : 'Inactive'} severity={r.status === 'active' ? 'success' : 'danger'} />} sortable style={{ minWidth: '8rem' }} />
          <Column header="Actions" body={(r: Patient) => (<div className="flex gap-1"><Button icon="pi pi-eye" rounded text severity="info" size="small" onClick={() => { setSelected(r); setViewOpen(true) }} /><Button icon="pi pi-trash" rounded text severity="danger" size="small" onClick={() => confirmDel(r)} /></div>)} style={{ minWidth: '7rem' }} />
        </DataTable>
      </div>
      <Dialog header="Patient Details" visible={viewOpen} onHide={() => setViewOpen(false)} style={{ width: '480px' }} modal>
        {selected && <dl className="detail-grid"><dt>Name</dt><dd>{selected.name}</dd><dt>Email</dt><dd>{selected.email}</dd><dt>Phone</dt><dd>{selected.phone || '—'}</dd><dt>Date of Birth</dt><dd>{selected.dateOfBirth ? new Date(selected.dateOfBirth).toLocaleDateString() : '—'}</dd><dt>Status</dt><dd><Tag value={selected.status === 'active' ? 'Active' : 'Inactive'} severity={selected.status === 'active' ? 'success' : 'danger'} /></dd></dl>}
      </Dialog>
    </div>
  )
}
