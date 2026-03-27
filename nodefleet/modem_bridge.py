#!/usr/bin/env python3
"""
NodeFleet Modem Bridge
Reads GPS and signal data from SIM7670G via USB serial,
pushes it to the NodeFleet ws-server via WebSocket.
"""
import serial
import json
import time
import websocket
import threading
import sys
import signal

MODEM_PORT = '/dev/ttyACM0'
MODEM_BAUD = 115200
WS_URL = 'ws://localhost:50081/device'
GPS_INTERVAL = 30  # seconds
SIGNAL_INTERVAL = 60  # seconds

class ModemBridge:
    def __init__(self, device_token):
        self.token = device_token
        self.modem = None
        self.ws = None
        self.running = True
        
    def connect_modem(self):
        try:
            self.modem = serial.Serial(MODEM_PORT, MODEM_BAUD, timeout=3)
            print(f"[MODEM] Connected to {MODEM_PORT}")
            return True
        except Exception as e:
            print(f"[MODEM] Error: {e}")
            return False
    
    def send_at(self, cmd, timeout=3):
        if not self.modem:
            return None
        self.modem.reset_input_buffer()
        self.modem.write(f'{cmd}\r\n'.encode())
        time.sleep(timeout)
        resp = self.modem.read(self.modem.in_waiting or 1).decode('utf-8', errors='replace')
        return resp.strip()
    
    def get_gps(self):
        resp = self.send_at('AT+CGPSINFO', 2)
        if not resp or '+CGPSINFO:' not in resp:
            return None
        
        line = resp.split('+CGPSINFO:')[1].strip().split('\n')[0].strip()
        if line.startswith(',') or len(line) < 10:
            return None
        
        parts = line.split(',')
        if len(parts) < 9:
            return None
        
        # Parse NMEA format to decimal degrees
        lat_raw = float(parts[0])
        lat_deg = int(lat_raw / 100)
        lat_min = lat_raw - (lat_deg * 100)
        lat = lat_deg + (lat_min / 60.0)
        if parts[1] == 'S':
            lat = -lat
        
        lon_raw = float(parts[2])
        lon_deg = int(lon_raw / 100)
        lon_min = lon_raw - (lon_deg * 100)
        lon = lon_deg + (lon_min / 60.0)
        if parts[3] == 'W':
            lon = -lon
        
        return {
            'type': 'gps',
            'lat': round(lat, 6),
            'lng': round(lon, 6),
            'alt': float(parts[6]) if parts[6] else 0,
            'speed': float(parts[7]) if parts[7] else 0,
            'heading': float(parts[8]) if parts[8] else 0,
            'accuracy': 10.0,
            'satellites': 0,
        }
    
    def get_signal(self):
        resp = self.send_at('AT+CSQ', 1)
        if not resp or '+CSQ:' not in resp:
            return None
        
        line = resp.split('+CSQ:')[1].strip().split('\n')[0].strip()
        parts = line.split(',')
        rssi = int(parts[0])
        # Convert CSQ to dBm: dBm = -113 + (2 * rssi)
        dbm = -113 + (2 * rssi) if rssi < 99 else 0
        return dbm
    
    def get_network_info(self):
        resp = self.send_at('AT+CPSI?', 2)
        if resp and '+CPSI:' in resp:
            return resp.split('+CPSI:')[1].strip().split('\n')[0].strip()
        return None
    
    def connect_ws(self):
        try:
            url = f"{WS_URL}?token={self.token}"
            self.ws = websocket.WebSocket()
            self.ws.connect(url)
            print(f"[WS] Connected to {WS_URL}")
            return True
        except Exception as e:
            print(f"[WS] Error: {e}")
            return False
    
    def send_ws(self, data):
        try:
            if self.ws:
                self.ws.send(json.dumps(data))
                return True
        except Exception as e:
            print(f"[WS] Send error: {e}")
            self.ws = None
        return False
    
    def run(self):
        if not self.connect_modem():
            print("[BRIDGE] Cannot connect to modem, exiting")
            return
        
        print("[BRIDGE] Starting modem bridge loop...")
        last_gps = 0
        last_signal = 0
        
        while self.running:
            # Ensure WebSocket connection
            if not self.ws:
                if not self.connect_ws():
                    time.sleep(5)
                    continue
            
            now = time.time()
            
            # GPS update
            if now - last_gps >= GPS_INTERVAL:
                gps = self.get_gps()
                if gps:
                    if self.send_ws(gps):
                        print(f"[GPS] {gps['lat']:.6f}, {gps['lng']:.6f} alt:{gps['alt']:.1f}m")
                    last_gps = now
                else:
                    print("[GPS] No fix")
                    last_gps = now
            
            # Signal update (send as part of telemetry)
            if now - last_signal >= SIGNAL_INTERVAL:
                dbm = self.get_signal()
                net = self.get_network_info()
                if dbm is not None:
                    telemetry = {
                        'type': 'telemetry',
                        'data': {
                            'signalDbm': dbm,
                            'network': net or 'unknown',
                        }
                    }
                    self.send_ws(telemetry)
                    print(f"[SIGNAL] {dbm} dBm | {net}")
                last_signal = now
            
            time.sleep(1)
    
    def stop(self):
        self.running = False
        if self.modem:
            self.modem.close()
        if self.ws:
            self.ws.close()

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 modem_bridge.py <device_token>")
        print("  Get the token from: docker exec nodefleet-postgres psql -U nodefleet -d nodefleet -c \"SELECT token FROM device_tokens LIMIT 1;\"")
        sys.exit(1)
    
    token = sys.argv[1]
    bridge = ModemBridge(token)
    
    def handler(sig, frame):
        print("\n[BRIDGE] Shutting down...")
        bridge.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    
    bridge.run()

if __name__ == '__main__':
    main()
