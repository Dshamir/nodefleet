import { useEffect, useState } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Tag } from 'primereact/tag'
import { api } from '../../api/client'
import type { DeviceBindingEntry } from '../vitals-monitor/types'

export function DeviceBindingsPage() {
  const [bindings, setBindings] = useState<DeviceBindingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBindings = async () => {
    setLoading(true)
    try {
      const data = await api.get<{ bindings: DeviceBindingEntry[] }>('/admin/device-bindings')
      setBindings(data.bindings || [])
    } catch (err) {
      console.error('Failed to fetch device bindings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBindings()
  }, [])

  const handleUnbind = async (serial: string) => {
    try {
      await api.delete(`/admin/device-bindings/${serial}`)
      fetchBindings()
    } catch (err) {
      console.error('Failed to unbind device:', err)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Device Bindings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Active device-to-patient bindings with chain of custody tracking
          </p>
        </div>
        <Button icon="pi pi-refresh" label="Refresh" outlined size="small" onClick={fetchBindings} />
      </div>

      <DataTable
        value={bindings}
        loading={loading}
        stripedRows
        paginator
        rows={20}
        emptyMessage="No active device bindings"
        className="rounded-xl overflow-hidden"
      >
        <Column
          field="deviceSerial"
          header="Device Serial"
          body={(row: DeviceBindingEntry) => (
            <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {row.deviceSerial}
            </span>
          )}
        />
        <Column field="userId" header="Patient ID" body={(row: DeviceBindingEntry) => (
          <span className="font-mono text-xs text-slate-600">{row.userId.slice(0, 8)}...</span>
        )} />
        <Column
          field="relayType"
          header="Relay"
          body={(row: DeviceBindingEntry) => (
            <Tag
              value={row.relayType}
              icon={`pi ${row.relayType === 'gateway' ? 'pi-server' : 'pi-mobile'}`}
              severity={row.relayType === 'gateway' ? 'info' : 'success'}
            />
          )}
        />
        <Column field="relayId" header="Relay ID" body={(row: DeviceBindingEntry) => (
          <span className="text-xs text-slate-500 truncate max-w-[200px] block">{row.relayId}</span>
        )} />
        <Column
          field="boundAt"
          header="Bound At"
          body={(row: DeviceBindingEntry) => (
            <span className="text-xs text-slate-600">{new Date(row.boundAt).toLocaleString()}</span>
          )}
        />
        <Column
          header="Actions"
          body={(row: DeviceBindingEntry) => (
            <Button
              icon="pi pi-times"
              label="Unbind"
              severity="danger"
              text
              size="small"
              onClick={() => handleUnbind(row.deviceSerial)}
            />
          )}
        />
      </DataTable>
    </div>
  )
}
