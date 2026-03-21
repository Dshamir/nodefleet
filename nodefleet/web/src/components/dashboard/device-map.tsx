"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface DeviceLocation {
  id: number;
  name: string;
  status: "online" | "offline" | "pairing" | "disabled";
  latitude: number;
  longitude: number;
  lastUpdate: string;
}

interface TrailPoint {
  lat: number;
  lng: number;
}

interface DeviceMapProps {
  devices: DeviceLocation[];
  trail?: TrailPoint[];
  selectedDeviceId?: number | null;
}

const onlineIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#10b981;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(16,185,129,0.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const offlineIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#64748b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 4px rgba(100,116,139,0.4);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const pairingIcon = new L.DivIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(245,158,11,0.6);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function getIcon(status: string) {
  if (status === "online") return onlineIcon;
  if (status === "pairing") return pairingIcon;
  return offlineIcon;
}

export function DeviceMap({ devices, trail, selectedDeviceId }: DeviceMapProps) {
  const validDevices = devices.filter((d) => !isNaN(d.latitude) && !isNaN(d.longitude));

  const center: [number, number] = validDevices.length > 0
    ? [validDevices[0].latitude, validDevices[0].longitude]
    : [37.7749, -122.4194];

  return (
    <MapContainer
      center={center}
      zoom={4}
      className="w-full h-[500px] rounded-lg"
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {validDevices.map((device) => (
        <Marker
          key={device.id}
          position={[device.latitude, device.longitude]}
          icon={getIcon(device.status)}
        >
          <Popup>
            <div style={{ color: "#000", minWidth: 140 }}>
              <strong>{device.name}</strong>
              <br />
              <span style={{ textTransform: "capitalize" }}>{device.status}</span>
              <br />
              <small>{device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}</small>
              <br />
              <small>{device.lastUpdate}</small>
            </div>
          </Popup>
        </Marker>
      ))}
      {trail && trail.length > 1 && (
        <Polyline
          positions={trail.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#0ea5e9", weight: 3, opacity: 0.7, dashArray: "8 4" }}
        />
      )}
    </MapContainer>
  );
}
