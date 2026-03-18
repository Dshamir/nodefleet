import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { InputText } from 'primereact/inputtext'
import { Tag } from 'primereact/tag'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { ProgressSpinner } from 'primereact/progressspinner'
import { api } from '@/api/client'

interface GatewayDevice { id: string; deviceId: string; patientName: string; deviceType: string; status: 'online' | 'offline'; lastSeen: string; batteryPercent: number }
interface GatewayDevicesResponse { gateways: GatewayDevice[]; total: number }

function batColor(p: number) { return p <= 20 ? 'text-red-600' : p <= 50 ? 'text-amber-500' : 'text-green-600' }
function batIcon(p: number) { return p <= 20 ? 'pi-exclamation-circle' : p <= 50 ? 'pi-minus-circle' : 'pi-check-circle' }

export function GatewayDevicesPage() {
  const [globalFilter, setGlobalFilter] = useState('')
  const [selected, setSelected] = useState<GatewayDevice | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  const { data, isLoading, error } = useQuery({ queryKey: ['admin', 'gateways'], queryFn: () => api.get<GatewayDevicesResponse>('/admin/gateways'), refetchInterval: 30_000 })

  const filtered = useMemo(() => {
    if (!data?.gateways) return []
    if (!globalFilter) return data.gateways
    const q = globalFilter.toLowerCase()
    return data.gateways.filter(d => d.deviceId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q) || d.deviceType.toLowerCase().includes(q))
  }, [data?.gateways, globalFilter])

  if (isLoading) return <div className="flex items-center justify-center h-64"><ProgressSpinner style={{ width: '50px', height: '50px' }} /></div>
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">Failed to load gateway devices.</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-slate-800">Gateway Devices</h1><p className="text-slate-500 mt-1">Monitor IoT gateway devices</p></div>
        <div className="flex items-center gap-2"><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" /></span><span className="text-xs font-medium text-green-600">Live</span></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-4"><span className="p-input-icon-left w-full md:w-80"><i className="pi pi-search" /><InputText value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search..." className="w-full" /></span></div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><i className="pi pi-wifi text-4xl mb-3 block" /><p>No gateway devices found</p></div>
        ) : (
          <DataTable value={filtered} paginator rows={10} rowsPerPageOptions={[10, 25, 50]} dataKey="id" emptyMessage="No devices found." className="p-datatable-sm" sortMode="multiple" removableSort>
            <Column field="deviceId" header="Device ID" body={(r: GatewayDevice) => <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{r.deviceId}</span>} sortable style={{ minWidth: '12rem' }} />
            <Column field="patientName" header="Patient" sortable style={{ minWidth: '12rem' }} />
            <Column field="deviceType" header="Type" sortable style={{ minWidth: '10rem' }} />
            <Column field="status" header="Status" body={(r: GatewayDevice) => <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${r.status === 'online' ? 'bg-green-500' : 'bg-red-400'}`} /><Tag value={r.status === 'online' ? 'Online' : 'Offline'} severity={r.status === 'online' ? 'success' : 'danger'} /></div>} sortable style={{ minWidth: '10rem' }} />
            <Column field="lastSeen" header="Last Seen" body={(r: GatewayDevice) => { const d = new Date(r.lastSeen); const m = Math.floor((Date.now() - d.getTime()) / 60000); return <div><span className="text-sm">{m < 1 ? 'Now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`}</span><div className="text-xs text-slate-400">{d.toLocaleString()}</div></div> }} sortable style={{ minWidth: '12rem' }} />
            <Column field="batteryPercent" header="Battery" body={(r: GatewayDevice) => <div className={`flex items-center gap-1.5 ${batColor(r.batteryPercent)}`}><i className={`pi ${batIcon(r.batteryPercent)} text-sm`} /><span className="font-mono text-sm font-medium">{r.batteryPercent}%</span></div>} sortable style={{ minWidth: '8rem' }} />
            <Column header="Actions" body={(r: GatewayDevice) => <Button icon="pi pi-eye" rounded text severity="info" size="small" onClick={() => { setSelected(r); setViewOpen(true) }} />} style={{ minWidth: '5rem' }} />
          </DataTable>
        )}
      </div>
      <Dialog header="Device Details" visible={viewOpen} onHide={() => setViewOpen(false)} style={{ width: '480px' }} modal>
        {selected && <dl className="detail-grid"><dt>Device ID</dt><dd><span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{selected.deviceId}</span></dd><dt>Patient</dt><dd>{selected.patientName}</dd><dt>Type</dt><dd>{selected.deviceType}</dd><dt>Status</dt><dd><Tag value={selected.status === 'online' ? 'Online' : 'Offline'} severity={selected.status === 'online' ? 'success' : 'danger'} /></dd><dt>Last Seen</dt><dd>{new Date(selected.lastSeen).toLocaleString()}</dd><dt>Battery</dt><dd><span className={`font-mono font-medium ${batColor(selected.batteryPercent)}`}>{selected.batteryPercent}%</span></dd></dl>}
      </Dialog>
    </div>
  )
}
