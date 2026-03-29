"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface StopMarker {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
}

interface IonMapProps {
  stops: StopMarker[];
  selectedStopId: string;
  onStopSelect: (stopId: string) => void;
}

function cleanStopName(name: string): string {
  return name.replace(/ - (Northbound|Southbound|Eastbound|Westbound)$/i, "");
}

export default function IonMap({ stops, selectedStopId, onStopSelect }: IonMapProps) {
  const routeLine = stops.map((s) => [s.lat, s.lon] as [number, number]);

  return (
    <MapContainer
      center={[43.455, -80.49]}
      zoom={13}
      className="w-full h-full rounded-lg"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route line */}
      <Polyline positions={routeLine} color="#006bb7" weight={4} opacity={0.6} />

      {/* Stop markers */}
      {stops.map((stop) => {
        const isSelected = stop.stopId === selectedStopId;
        return (
          <CircleMarker
            key={stop.stopId}
            center={[stop.lat, stop.lon]}
            radius={isSelected ? 12 : 8}
            pathOptions={{
              color: isSelected ? "#f87171" : "#006bb7",
              fillColor: isSelected ? "#ef4444" : "#ffffff",
              fillOpacity: 1,
              weight: isSelected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onStopSelect(stop.stopId) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {cleanStopName(stop.stopName)}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
