import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'

interface EmergencyContact { id: string; patientName: string; contactName: string; relationship: string; phone: string; email: string }
interface EmergencyContactsResponse { contacts: EmergencyContact[]; total: number }

export function EmergencyContactsPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selected, setSelected] = useState<EmergencyContact | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'emergency-contacts'], queryFn: () => api.get<EmergencyContactsResponse>('/admin/emergency-contacts') })

  const filtered = useMemo(() => {
    if (!data?.contacts) return []
    if (!globalFilter) return data.contacts
    const q = globalFilter.toLowerCase()
    return data.contacts.filter(c => c.patientName.toLowerCase().includes(q) || c.contactName.toLowerCase().includes(q))
  }, [data?.contacts, globalFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load emergency contacts.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Emergency Contacts</h1><p className="text-slate-500 mt-1">Patient emergency contact information</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-4"><span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search..." className="w-full" /></span></div>
        <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50]} dataKey="id" emptyMessage="No emergency contacts found." className="p-datatable-sm" sortMode="multiple" removableSort>
          <Column field="patientName" header="Patient" sortable style={{ minWidth: '12rem' }} />
          <Column field="contactName" header="Contact Name" sortable style={{ minWidth: '12rem' }} />
          <Column field="relationship" header="Relationship" sortable style={{ minWidth: '10rem' }} />
          <Column field="phone" header="Phone" style={{ minWidth: '10rem' }} />
          <Column field="email" header="Email" style={{ minWidth: '14rem' }} />
          <Column header="Actions" body={(r: EmergencyContact) => <Button icon="pi pi-eye" rounded text severity="info" size="small" onClick={() => { setSelected(r); setViewOpen(true) }} />} style={{ minWidth: '5rem' }} />
        </DataTable>
      </div>
      <Dialog header="Emergency Contact" visible={viewOpen} onHide={() => setViewOpen(false)} style={{ width: '480px' }} modal>
        {selected && <dl className="detail-grid"><dt>Patient</dt><dd>{selected.patientName}</dd><dt>Contact</dt><dd>{selected.contactName}</dd><dt>Relationship</dt><dd>{selected.relationship}</dd><dt>Phone</dt><dd>{selected.phone}</dd><dt>Email</dt><dd>{selected.email || '—'}</dd></dl>}
      </Dialog>
    </div>
  )
}
