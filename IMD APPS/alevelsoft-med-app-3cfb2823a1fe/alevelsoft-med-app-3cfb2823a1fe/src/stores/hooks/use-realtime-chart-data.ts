import { useEffect, useRef, useState } from 'react'

import { useSocket } from './use-socket'

type ChartPoint = { x: number; y: number }

export const useRealtimeChartData = (patientUserId?: string) => {
  const socket = useSocket()
  const [realtimePoints, setRealtimePoints] = useState<Record<string, ChartPoint[]>>({})
  const bufferRef = useRef<Record<string, ChartPoint[]>>({})

  useEffect(() => {
    if (!patientUserId) return

    socket.emit('joinRoom', { patientUserId })

    const handler = (response: any) => {
      const ts = Date.now() / 1000
      const data = response.data
      const entries: [string, number | null][] = [
        ['hr', data.hr],
        ['temp', data.temp],
        ['spo2', data.spo],
        ['rr', data.rr],
        ['sbp', data.sbp],
        ['dbp', data.dbp],
      ]

      for (const [key, value] of entries) {
        if (value != null) {
          bufferRef.current[key] = [...(bufferRef.current[key] || []), { x: ts, y: value }]
        }
      }
      setRealtimePoints({ ...bufferRef.current })
    }

    socket.on('messageToClient', handler)

    return () => {
      socket.off('messageToClient', handler)
      socket.emit('leaveRoom', { patientUserId })
    }
  }, [socket, patientUserId])

  return realtimePoints
}
