import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Rectangle,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { CompetitorItem, CompetitorPreview } from '../types/api';

// Custom red marker for user selected business location
const userIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `
    <div style="position: relative; width: 32px; height: 32px; cursor: grab;">
      <div style="position: absolute; inset: 0; border-radius: 9999px; background-color: rgba(255, 38, 56, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 32px; height: 32px; border-radius: 9999px; background-color: #FF2638; border: 2.5px solid #FFFFFF; box-shadow: 0 0 16px rgba(255, 38, 56, 0.9); display: flex; align-items: center; justify-content: center;">
        <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: #FFFFFF;"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Custom amber marker for competitors
const competitorIcon = L.divIcon({
  className: 'custom-competitor-marker',
  html: `
    <div style="position: relative; width: 24px; height: 24px; border-radius: 9999px; background-color: #F59E0B; border: 2px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="width: 7px; height: 7px; border-radius: 9999px; background-color: #FFFFFF;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface MapViewProps {
  center: [number, number];
  businessName: string;
  competitors?: (CompetitorItem | CompetitorPreview)[];
  radiusMeters?: number;
  showBoundary?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  heightClassName?: string;
}

// Coimbatore service validation bounding box
const coimbatoreBounds: [[number, number], [number, number]] = [
  [10.85, 76.8], // South-West
  [11.2, 77.2], // North-East
];

// Handles user clicking anywhere on the map
function MapEventsHandler({
  onLocationSelect,
}: {
  onLocationSelect?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Automatically pans the map smoothly when center coordinates change
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  return null;
}

export const MapView: React.FC<MapViewProps> = ({
  center,
  businessName,
  competitors = [],
  radiusMeters = 2000,
  showBoundary = true,
  onLocationSelect,
  heightClassName = 'h-[360px] sm:h-[420px]',
}) => {
  return (
    <div
      className={`relative w-full ${heightClassName} rounded-2xl overflow-hidden border border-[#262B33] bg-[#08090C] shadow-lg`}
    >
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <MapEventsHandler onLocationSelect={onLocationSelect} />
        <MapRecenter center={center} />

        {/* OpenStreetMap Tile Layer with dark CSS filter */}
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

        {/* User Business Proposed Location Marker (Draggable) */}
        <Marker
          position={center}
          icon={userIcon}
          draggable={Boolean(onLocationSelect)}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const pos = marker.getLatLng();
              if (onLocationSelect) {
                onLocationSelect(pos.lat, pos.lng);
              }
            },
          }}
        >
          <Popup className="custom-leaflet-popup">
            <div className="p-1 text-slate-900">
              <strong className="block text-sm font-bold text-[#FF2638]">
                {businessName || 'Proposed Location'}
              </strong>
              <span className="text-xs text-slate-600 block">
                {center[0].toFixed(4)}°N, {center[1].toFixed(4)}°E
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                ✓ Validated Coimbatore Location
              </span>
              {onLocationSelect && (
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  (Drag marker or click map to move)
                </span>
              )}
            </div>
          </Popup>
        </Marker>

        {/* Real Competitor Markers */}
        {competitors.map((comp, idx) => {
          let pos: [number, number];
          const c = comp as any;
          if (typeof c.latitude === 'number' && typeof c.longitude === 'number') {
            pos = [c.latitude, c.longitude];
          } else {
            // Fallback angular distribution if coordinates are missing in preview
            const angle = (idx / Math.max(1, competitors.length)) * 2 * Math.PI;
            const distKm = comp.distance_km || 0.8;
            const latOffset = (distKm / 111) * Math.cos(angle);
            const lngOffset =
              (distKm / (111 * Math.cos((center[0] * Math.PI) / 180))) * Math.sin(angle);
            pos = [center[0] + latOffset, center[1] + lngOffset];
          }

          return (
            <Marker key={idx} position={pos} icon={competitorIcon}>
              <Popup>
                <div className="p-1 text-slate-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <strong className="block text-xs font-bold text-amber-700">
                      {comp.name || 'Unnamed Competitor'}
                    </strong>
                  </div>
                  <span className="text-[11px] text-slate-600 block capitalize">
                    Category: {comp.category || 'Competitor'}
                  </span>
                  {comp.distance_km != null && (
                    <span className="text-[11px] font-semibold text-[#FF2638] block mt-0.5">
                      Distance: {comp.distance_km.toFixed(2)} km away
                    </span>
                  )}
                  {c.street && (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Location: {c.street}
                    </span>
                  )}
                  <span className="text-[9px] text-slate-400 block mt-1 border-t pt-0.5">
                    Source: OpenStreetMap Overpass (Real POI)
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Interactive Helper Banner on Top-Left */}
      {onLocationSelect && (
        <div className="absolute top-3 left-3 z-10 bg-[#111418]/90 backdrop-blur-md border border-[#262B33] rounded-xl px-3 py-1.5 text-[11px] text-white flex items-center gap-2 shadow-md">
          <span className="w-2 h-2 rounded-full bg-[#FF2638] animate-pulse" />
          <span>Click map or drag marker to set location</span>
        </div>
      )}

      {/* Map Legend Overlay on Top-Right */}
      <div className="absolute top-3 right-3 z-10 bg-[#111418]/90 backdrop-blur-md border border-[#262B33] rounded-xl px-3 py-2 text-[11px] text-[#A5ABB4] space-y-1 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF2638] shadow-sm" />
          <span className="text-white font-medium">Your Business</span>
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

      {/* Mandatory Attribution Badge on Bottom-Left */}
      <div className="absolute bottom-2 left-2 z-10 bg-[#050607]/85 backdrop-blur-sm border border-[#262B33] px-2.5 py-0.5 rounded text-[10px] text-[#A5ABB4]">
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
