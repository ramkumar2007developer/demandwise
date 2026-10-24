import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Rectangle } from 'react-leaflet';
import L from 'leaflet';
import type { CompetitorPreview } from '../types/api';

// Custom red marker for user selected business location
const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="position: relative; width: 28px; height: 28px;">
      <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: rgba(255, 38, 56, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 28px; height: 28px; border-radius: 9999px; background-color: #FF2638; border: 2.5px solid #FFFFFF; box-shadow: 0 0 15px rgba(255, 38, 56, 0.8); display: flex; align-items: center; justify-content: center;">
        <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: #FFFFFF;"></div>
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Custom amber marker for competitors
const competitorIcon = L.divIcon({
  className: 'custom-competitor-marker',
  html: `
    <div style="position: relative; width: 22px; height: 22px; border-radius: 9999px; background-color: #F59E0B; border: 2px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;">
      <div style="width: 6px; height: 6px; border-radius: 9999px; background-color: #FFFFFF;"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface MapViewProps {
  center: [number, number];
  businessName: string;
  competitors?: CompetitorPreview[];
  radiusMeters?: number;
  showBoundary?: boolean;
}

// Coimbatore service validation bounding box (approximate)
const coimbatoreBounds: [[number, number], [number, number]] = [
  [10.85, 76.80], // South-West
  [11.20, 77.20], // North-East
];

export const MapView: React.FC<MapViewProps> = ({
  center,
  businessName,
  competitors = [],
  radiusMeters = 2000,
  showBoundary = true,
}) => {
  return (
    <div className="relative w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-[#262B33] bg-[#08090C] shadow-lg">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        {/* OpenStreetMap Tile Layer with standard dark CSS filter */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Coimbatore approximate bounding box boundary */}
        {showBoundary && (
          <Rectangle
            bounds={coimbatoreBounds}
            pathOptions={{
              color: '#FF2638',
              weight: 1.5,
              dashArray: '5, 8',
              fillColor: '#FF2638',
              fillOpacity: 0.02,
            }}
          />
        )}

        {/* Search radius circle around proposed business location */}
        <Circle
          center={center}
          radius={radiusMeters}
          pathOptions={{
            color: '#FF2638',
            weight: 1.5,
            fillColor: '#FF2638',
            fillOpacity: 0.08,
          }}
        />

        {/* User Business Proposed Location Marker */}
        <Marker position={center} icon={userIcon}>
          <Popup className="custom-leaflet-popup">
            <div className="p-1 text-slate-900">
              <strong className="block text-sm font-bold text-[#FF2638]">
                {businessName || 'Proposed Location'}
              </strong>
              <span className="text-xs text-slate-600 block">
                {center[0].toFixed(4)}°N, {center[1].toFixed(4)}°E
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">
                Analysis Center (Coimbatore)
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Competitor Markers if present */}
        {competitors.map((comp, idx) => {
          // If competitor doesn't have exact lat/lng in preview, disperse around center based on distance
          const angle = (idx / Math.max(1, competitors.length)) * 2 * Math.PI;
          const distKm = comp.distance_km || 0.8;
          // Approximate degree offset: 1 deg lat ~ 111 km
          const latOffset = (distKm / 111) * Math.cos(angle);
          const lngOffset = (distKm / (111 * Math.cos((center[0] * Math.PI) / 180))) * Math.sin(angle);
          const pos: [number, number] = [center[0] + latOffset, center[1] + lngOffset];

          return (
            <Marker key={idx} position={pos} icon={competitorIcon}>
              <Popup>
                <div className="p-1 text-slate-900">
                  <strong className="block text-xs font-bold text-amber-700">
                    {comp.name}
                  </strong>
                  <span className="text-[11px] text-slate-600 block capitalize">
                    Category: {comp.category}
                  </span>
                  {comp.distance_km != null && (
                    <span className="text-[10px] text-slate-500 block">
                      Distance: {comp.distance_km.toFixed(2)} km away
                    </span>
                  )}
                  <span className="text-[9px] text-slate-400 block mt-1">
                    Source: OpenStreetMap Place Search
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute top-3 right-3 z-10 bg-[#111418]/90 backdrop-blur-md border border-[#262B33] rounded-xl px-3 py-2 text-[11px] text-[#A5ABB4] space-y-1 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF2638] shadow-sm" />
          <span className="text-white font-medium">Proposed Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-sm" />
          <span>OSM Competitors ({competitors.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-0.5 border-t border-dashed border-[#FF2638]" />
          <span>Coimbatore Bounds</span>
        </div>
      </div>

      {/* Mandatory Attribution Badge */}
      <div className="absolute bottom-2 left-2 z-10 bg-[#050607]/80 backdrop-blur-sm border border-[#262B33] px-2.5 py-0.5 rounded text-[10px] text-[#A5ABB4]">
        Map Data &copy;{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#FF2638] hover:underline"
        >
          OpenStreetMap contributors
        </a>
      </div>
    </div>
  );
};
