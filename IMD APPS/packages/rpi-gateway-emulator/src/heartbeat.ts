import { config } from './config';
import { authenticate } from './auth';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(): void {
  if (heartbeatInterval) return;

  const sendHeartbeat = async () => {
    try {
      const token = await authenticate();
      const res = await fetch(`${config.medicalApiUrl}/gateways/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          seniorHomeName: config.seniorHomeName,
          timestamp: Math.floor(Date.now() / 1000),
        }),
      });

      if (res.ok) {
        console.log('[Heartbeat] Sent successfully');
      } else {
        // Heartbeat endpoint may not exist — that's okay, just log
        console.log(`[Heartbeat] Response: ${res.status} (non-critical)`);
      }
    } catch (err: any) {
      console.log(`[Heartbeat] Failed (non-critical): ${err.message}`);
    }
  };

  // Send immediately, then on interval
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, config.heartbeatIntervalMs);
  console.log(`[Heartbeat] Started (every ${config.heartbeatIntervalMs / 1000}s)`);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
