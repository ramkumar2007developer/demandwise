import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  MapPin,
  Plus,
  Trash2,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Users,
  Sparkles,
  Navigation,
  Loader2,
  Info,
  BarChart3,
  Layers,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import type {
  BusinessAnalysisRequest,
  BusinessAnalysisResponse,
  BusinessType,
  Language,
} from '../types/api';
import { MapView } from './MapView';

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const COIMBATORE_PRESETS = [
  { name: 'RS Puram', lat: 11.0168, lng: 76.9558 },
  { name: 'Gandhipuram', lat: 11.0183, lng: 76.9644 },
  { name: 'Peelamedu', lat: 11.0287, lng: 77.0044 },
  { name: 'Saravanampatti', lat: 11.0805, lng: 76.9961 },
  { name: 'Saibaba Colony', lat: 11.0315, lng: 76.9427 },
  { name: 'Singanallur', lat: 11.0004, lng: 76.9843 },
  { name: 'Race Course', lat: 11.0063, lng: 76.9612 },
  { name: 'Ukkadam', lat: 10.9948, lng: 76.9605 },
];

const LOCATION_COLORS = ['#FF2638', '#3B82F6', '#10B981'];
const LOCATION_LABELS = ['Location A', 'Location B', 'Location C'];

const MAX_LOCATIONS = 3;
const MIN_LOCATIONS = 2;

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface LocationSlot {
  id: string;
  label: string;
  areaName: string;
  lat: number;
  lng: number;
  color: string;
}

interface ComparisonResult {
  locationId: string;
  label: string;
  areaName: string;
  color: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  data: BusinessAnalysisResponse | null;
  error: string | null;
}

interface LocationComparisonProps {
  language: Language;
  businessName: string;
  businessType: BusinessType;
  budgetInr: number;
  floorArea: number;
  nearCollege: number;
  notes: string;
  /** Optional callback fired after each comparison run with the current results array */
  onComparisonResults?: (results: ComparisonResult[]) => void;
}

// ─────────────────────────────────────────────────────────
// Helper: Check Coimbatore bounds
// ─────────────────────────────────────────────────────────

function isInCoimbatore(lat: number, lng: number): boolean {
  return lat >= 10.85 && lat <= 11.2 && lng >= 76.8 && lng <= 77.2;
}

function generateLocationId(): string {
  return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────
// Custom Recharts Tooltip
// ─────────────────────────────────────────────────────────

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1B1F24] border border-[#262B33] rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[#A5ABB4]" style={{ color: entry.color }}>
          {entry.name}: <span className="font-mono font-bold">{Number(entry.value).toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export const LocationComparison: React.FC<LocationComparisonProps> = ({
  language,
  businessName,
  businessType,
  budgetInr,
  floorArea,
  nearCollege,
  notes,
  onComparisonResults,
}) => {
  // ── Location slots state ──
  const [locations, setLocations] = useState<LocationSlot[]>([
    {
      id: generateLocationId(),
      label: LOCATION_LABELS[0],
      areaName: 'RS Puram',
      lat: 11.0168,
      lng: 76.9558,
      color: LOCATION_COLORS[0],
    },
    {
      id: generateLocationId(),
      label: LOCATION_LABELS[1],
      areaName: 'Gandhipuram',
      lat: 11.0183,
      lng: 76.9644,
      color: LOCATION_COLORS[1],
    },
  ]);

  // ── Comparison results state ──
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── Active map selector state ──
  const [activeMapSlot, setActiveMapSlot] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  // ── Add a new location ──
  const handleAddLocation = useCallback(() => {
    if (locations.length >= MAX_LOCATIONS) return;
    const idx = locations.length;
    // Pick a preset that isn't already chosen
    const usedPresets = new Set(locations.map((l) => l.areaName));
    const nextPreset =
      COIMBATORE_PRESETS.find((p) => !usedPresets.has(p.name)) || COIMBATORE_PRESETS[2];
    setLocations((prev) => [
      ...prev,
      {
        id: generateLocationId(),
        label: LOCATION_LABELS[idx],
        areaName: nextPreset.name,
        lat: nextPreset.lat,
        lng: nextPreset.lng,
        color: LOCATION_COLORS[idx],
      },
    ]);
  }, [locations]);

  // ── Remove a location ──
  const handleRemoveLocation = useCallback(
    (id: string) => {
      if (locations.length <= MIN_LOCATIONS) return;
      setLocations((prev) => {
        const filtered = prev.filter((l) => l.id !== id);
        // Re-index labels and colors
        return filtered.map((l, i) => ({
          ...l,
          label: LOCATION_LABELS[i],
          color: LOCATION_COLORS[i],
        }));
      });
      if (activeMapSlot === id) setActiveMapSlot(null);
      // Remove result for this location
      setResults((prev) => prev.filter((r) => r.locationId !== id));
    },
    [locations, activeMapSlot]
  );

  // ── Select preset for a slot ──
  const handleSelectPreset = useCallback(
    (slotId: string, preset: (typeof COIMBATORE_PRESETS)[0]) => {
      setLocations((prev) =>
        prev.map((l) =>
          l.id === slotId ? { ...l, areaName: preset.name, lat: preset.lat, lng: preset.lng } : l
        )
      );
      setLocationWarning(null);
    },
    []
  );

  // ── Map click handler for active slot ──
  const handleMapLocationSelect = useCallback(
    (lat: number, lng: number) => {
      if (!activeMapSlot) return;
      const roundedLat = Number(lat.toFixed(4));
      const roundedLng = Number(lng.toFixed(4));

      if (!isInCoimbatore(roundedLat, roundedLng)) {
        setLocationWarning(
          `Selected point (${roundedLat}°N, ${roundedLng}°E) is outside Coimbatore bounds. Please select within 10.85°N–11.20°N, 76.80°E–77.20°E.`
        );
        return;
      }

      setLocationWarning(null);
      setLocations((prev) =>
        prev.map((l) =>
          l.id === activeMapSlot
            ? { ...l, lat: roundedLat, lng: roundedLng, areaName: `Custom (${roundedLat}, ${roundedLng})` }
            : l
        )
      );
    },
    [activeMapSlot]
  );

  // ── Use browser geolocation ──
  const handleUseGeolocation = useCallback(
    (slotId: string) => {
      if (!navigator.geolocation) {
        setLocationWarning('Geolocation is not supported by this browser.');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lng = Number(pos.coords.longitude.toFixed(4));
          if (!isInCoimbatore(lat, lng)) {
            setLocationWarning(
              `Your location (${lat}°N, ${lng}°E) is outside Coimbatore.`
            );
            return;
          }
          setLocationWarning(null);
          setLocations((prev) =>
            prev.map((l) =>
              l.id === slotId
                ? { ...l, lat, lng, areaName: 'Current Location' }
                : l
            )
          );
        },
        () => {
          setLocationWarning('Location access denied or unavailable.');
        },
        { timeout: 9000, enableHighAccuracy: true }
      );
    },
    []
  );

  // ── Run comparison ──
  const handleRunComparison = useCallback(async () => {
    if (!businessName.trim()) {
      setGlobalError('Business name is required.');
      return;
    }
    if (!budgetInr || budgetInr < 10000) {
      setGlobalError('Budget must be at least ₹10,000.');
      return;
    }

    setGlobalError(null);
    setIsComparing(true);

    // Initialize results with loading state
    const initialResults: ComparisonResult[] = locations.map((loc) => ({
      locationId: loc.id,
      label: loc.label,
      areaName: loc.areaName,
      color: loc.color,
      status: 'loading',
      data: null,
      error: null,
    }));
    setResults(initialResults);

    // Run all analyses in parallel — each location is independent
    const promises = locations.map(async (loc) => {
      const payload: BusinessAnalysisRequest = {
        business_name: businessName.trim(),
        business_type: businessType,
        language,
        budget_inr: Number(budgetInr),
        location: {
          latitude: loc.lat,
          longitude: loc.lng,
          area_name: loc.areaName,
          city: 'Coimbatore',
          state: 'Tamil Nadu',
        },
        floor_area_sqft: Number(floorArea) || 800,
        near_college: nearCollege,
        notes: notes.trim(),
      };

      try {
        const response = await api.runAnalysis(payload);
        setResults((prev) =>
          prev.map((r) =>
            r.locationId === loc.id
              ? { ...r, status: 'success' as const, data: response, error: null }
              : r
          )
        );
      } catch (err: any) {
        setResults((prev) =>
          prev.map((r) =>
            r.locationId === loc.id
              ? {
                  ...r,
                  status: 'error' as const,
                  data: null,
                  error: err?.message || 'Analysis failed for this location.',
                }
              : r
          )
        );
      }
    });

    await Promise.allSettled(promises);
    setIsComparing(false);
    // Notify parent with final results so they can be included in PDF reports
    if (onComparisonResults) {
      setResults((prev) => {
        onComparisonResults(prev);
        return prev;
      });
    }
  }, [locations, businessName, businessType, budgetInr, language, floorArea, nearCollege, notes, onComparisonResults]);

  // ── Build chart data ──
  const successResults = results.filter((r) => r.status === 'success' && r.data);

  const competitorChartData =
    successResults.length > 0
      ? [
          {
            metric: 'Competitors',
            ...Object.fromEntries(
              successResults.map((r) => [r.label, r.data!.competitor_count])
            ),
          },
        ]
      : [];

  const budgetChartData =
    successResults.length > 0
      ? [
          {
            metric: 'Startup Cost (₹)',
            ...Object.fromEntries(
              successResults.map((r) => [
                r.label,
                r.data!.budget_feasibility?.total_estimated_startup_cost_inr || 0,
              ])
            ),
          },
          {
            metric: 'Budget Surplus/Deficit (₹)',
            ...Object.fromEntries(
              successResults.map((r) => [
                r.label,
                r.data!.budget_feasibility?.budget_difference_inr || 0,
              ])
            ),
          },
        ]
      : [];

  const demandChartData =
    successResults.length > 0
      ? [
          {
            metric: 'Predicted Visits',
            ...Object.fromEntries(
              successResults.map((r) => [
                r.label,
                r.data!.ml_prediction?.predicted_synthetic_monthly_visits || 0,
              ])
            ),
          },
        ]
      : [];

  // ── Active slot for map ──
  const activeSlot = locations.find((l) => l.id === activeMapSlot);

  return (
    <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-5 sm:p-6 shadow-md">
      {/* ── Section Header ── */}
      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#1B1F24]">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-md">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Phase 2: Location Comparison
          </h3>
          <p className="text-[11px] text-[#A5ABB4]">
            Compare {MIN_LOCATIONS}–{MAX_LOCATIONS} Coimbatore locations side by side
          </p>
        </div>
      </div>

      {/* ── Location Slots ── */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#A5ABB4] uppercase tracking-wider">
            Comparison Locations ({locations.length}/{MAX_LOCATIONS})
          </span>
          {locations.length < MAX_LOCATIONS && (
            <button
              type="button"
              onClick={handleAddLocation}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#262B33] bg-[#1B1F24] hover:bg-[#262B33] text-white font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Location
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {locations.map((loc) => (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0B0D10] border rounded-xl p-3.5 relative"
                style={{ borderColor: loc.color + '40' }}
              >
                {/* Slot header */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: loc.color }}
                    />
                    <span className="text-xs font-bold text-white">{loc.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMapSlot(activeMapSlot === loc.id ? null : loc.id)
                      }
                      className={`text-[10px] px-2 py-1 rounded-md border transition-all ${
                        activeMapSlot === loc.id
                          ? 'border-[#FF2638] bg-[#FF2638]/20 text-[#FF2638]'
                          : 'border-[#262B33] bg-[#1B1F24] text-[#A5ABB4] hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3 h-3 inline mr-0.5" />
                      {activeMapSlot === loc.id ? 'Selecting...' : 'Map'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseGeolocation(loc.id)}
                      className="text-[10px] px-2 py-1 rounded-md border border-[#262B33] bg-[#1B1F24] text-[#A5ABB4] hover:text-white transition-all"
                      title="Use My Current Location"
                    >
                      <Navigation className="w-3 h-3" />
                    </button>
                    {locations.length > MIN_LOCATIONS && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc.id)}
                        className="text-[10px] px-1.5 py-1 rounded-md border border-rose-800/40 bg-rose-950/30 text-rose-400 hover:bg-rose-950/60 transition-all"
                        title="Remove location"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset area buttons */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {COIMBATORE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(loc.id, p)}
                      className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                        loc.areaName === p.name
                          ? 'text-white font-medium'
                          : 'bg-[#1B1F24] text-[#505662] border-[#262B33] hover:text-[#A5ABB4]'
                      }`}
                      style={
                        loc.areaName === p.name
                          ? { backgroundColor: loc.color + '30', borderColor: loc.color + '60', color: loc.color }
                          : undefined
                      }
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* Current coordinates display */}
                <div className="flex items-center gap-2 text-[10px] text-[#A5ABB4] bg-[#111418] rounded-lg px-2.5 py-1.5 border border-[#1B1F24]">
                  <MapPin className="w-3 h-3 shrink-0" style={{ color: loc.color }} />
                  <span className="font-mono">
                    {loc.lat.toFixed(4)}°N, {loc.lng.toFixed(4)}°E
                  </span>
                  <span className="text-[#505662]">•</span>
                  <span className="truncate">{loc.areaName}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Interactive Map for active slot ── */}
      <AnimatePresence>
        {activeMapSlot && activeSlot && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: activeSlot.color }}
                />
                Selecting location for: <strong>{activeSlot.label}</strong> ({activeSlot.areaName})
              </span>
              <button
                type="button"
                onClick={() => setActiveMapSlot(null)}
                className="text-[10px] px-2.5 py-1 rounded-lg border border-[#262B33] bg-[#1B1F24] text-[#A5ABB4] hover:text-white transition-all"
              >
                <X className="w-3 h-3 inline mr-0.5" /> Close Map
              </button>
            </div>
            {locationWarning && (
              <div className="mb-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{locationWarning}</span>
              </div>
            )}
            <MapView
              center={[activeSlot.lat, activeSlot.lng]}
              businessName={`${activeSlot.label}: ${businessName || 'Location'}`}
              competitors={[]}
              radiusMeters={2000}
              onLocationSelect={handleMapLocationSelect}
              heightClassName="h-[280px] sm:h-[320px]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Run Comparison Button ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5 pb-4 border-b border-[#1B1F24]">
        <div className="text-xs text-[#A5ABB4] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>
            Uses the same analysis pipeline for each location. Business params inherited from Step 1 above.
          </span>
        </div>
        <button
          type="button"
          onClick={handleRunComparison}
          disabled={isComparing}
          className={`inline-flex items-center gap-2.5 bg-gradient-to-r from-[#3B82F6] to-[#1D4ED8] hover:from-[#4B90F7] hover:to-[#2B5FE0] disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold text-sm px-7 py-2.5 rounded-full transition-all duration-200 shadow-lg ${
            isComparing ? 'cursor-not-allowed opacity-80' : 'hover:-translate-y-0.5 hover:shadow-xl'
          }`}
        >
          {isComparing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Comparing Locations...</span>
            </>
          ) : (
            <>
              <BarChart3 className="w-4 h-4" />
              <span>Compare {locations.length} Locations</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* ── Global Error ── */}
      {globalError && (
        <div className="mb-5 p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {/* ── Results: Loading skeletons ── */}
      {results.length > 0 && results.some((r) => r.status === 'loading') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
          {results.map((r) =>
            r.status === 'loading' ? (
              <div
                key={r.locationId}
                className="bg-[#0B0D10] border rounded-xl p-5 animate-pulse"
                style={{ borderColor: r.color + '40' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs font-bold text-white">{r.label}</span>
                  <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" style={{ color: r.color }} />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-[#1B1F24] rounded w-3/4" />
                  <div className="h-4 bg-[#1B1F24] rounded w-1/2" />
                  <div className="h-4 bg-[#1B1F24] rounded w-2/3" />
                </div>
                <p className="text-[10px] text-[#A5ABB4] mt-3">
                  Running analysis for {r.areaName}...
                </p>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── Results: Side-by-Side KPI Cards ── */}
      {successResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-6"
        >
          {/* ── KPI Comparison Cards ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Side-by-Side Comparison
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((r) => (
                <div
                  key={r.locationId}
                  className="bg-[#0B0D10] border rounded-2xl p-4 relative overflow-hidden"
                  style={{ borderColor: r.color + '30' }}
                >
                  {/* Top colored accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                    style={{ backgroundColor: r.color }}
                  />

                  {/* Location header */}
                  <div className="flex items-center justify-between mb-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-xs font-bold text-white">{r.label}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#1B1F24] text-[#A5ABB4] border border-[#262B33]">
                      {r.areaName}
                    </span>
                  </div>

                  {/* Error state */}
                  {r.status === 'error' && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 inline mr-1.5" />
                      {r.error || 'Analysis failed.'}
                    </div>
                  )}

                  {/* Loading state */}
                  {r.status === 'loading' && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: r.color }} />
                    </div>
                  )}

                  {/* Success state: KPI metrics */}
                  {r.status === 'success' && r.data && (
                    <div className="space-y-3">
                      {/* Demand Prediction */}
                      <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#A5ABB4] mb-1">
                          <TrendingUp className="w-3 h-3" style={{ color: r.color }} />
                          Predicted Monthly Visits
                        </div>
                        <div className="text-lg font-extrabold text-white">
                          {r.data.ml_prediction?.predicted_synthetic_monthly_visits != null
                            ? Math.round(r.data.ml_prediction.predicted_synthetic_monthly_visits).toLocaleString()
                            : 'N/A'}
                        </div>
                      </div>

                      {/* Competitors */}
                      {(() => {
                        const isDegraded =
                          r.data.competitor_status === 'degraded' ||
                          r.data.competitor_status === 'error' ||
                          r.data.stages.some(
                            (s) => s.stage === 'competitor_search' && s.status !== 'success'
                          );

                        return (
                          <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                            <div className="flex items-center gap-1.5 text-[10px] text-[#A5ABB4] mb-1">
                              <Users className="w-3 h-3" style={{ color: r.color }} />
                              Real Competitors (2km)
                            </div>
                            {isDegraded ? (
                              <>
                                <div className="text-base font-bold text-amber-400">
                                  Unavailable
                                </div>
                                <div className="text-[9px] text-amber-300/70">
                                  Overpass busy / timed out
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-lg font-extrabold text-white">
                                  {r.data.competitor_count}
                                </div>
                                <div className="text-[9px] text-[#A5ABB4]">
                                  {r.data.competitors.length > 0
                                    ? r.data.competitors
                                        .slice(0, 3)
                                        .map((c) => c.name)
                                        .join(', ')
                                    : 'No competitors in radius'}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Budget Feasibility */}
                      <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#A5ABB4] mb-1">
                          <DollarSign className="w-3 h-3" style={{ color: r.color }} />
                          Startup Cost
                        </div>
                        <div className="text-lg font-extrabold text-white">
                          ₹{' '}
                          {r.data.budget_feasibility?.total_estimated_startup_cost_inr != null
                            ? Math.round(r.data.budget_feasibility.total_estimated_startup_cost_inr).toLocaleString()
                            : 'N/A'}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              r.data.budget_feasibility?.feasibility_category === 'SURPLUS'
                                ? 'bg-emerald-950 text-emerald-400'
                                : r.data.budget_feasibility?.feasibility_category === 'FEASIBLE'
                                ? 'bg-amber-950 text-amber-400'
                                : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {r.data.budget_feasibility?.feasibility_category || 'N/A'}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold ${
                              (r.data.budget_feasibility?.budget_difference_inr || 0) >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {(r.data.budget_feasibility?.budget_difference_inr || 0) >= 0 ? '+' : ''}₹
                            {Math.round(r.data.budget_feasibility?.budget_difference_inr || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                        <div className="flex items-center gap-1.5 text-[10px] text-[#A5ABB4] mb-1">
                          <Sparkles className="w-3 h-3" style={{ color: r.color }} />
                          AI Verdict
                        </div>
                        <p className="text-[11px] text-[#F5F5F5] leading-relaxed line-clamp-3">
                          {r.data.summary}
                        </p>
                      </div>

                      {/* Duration */}
                      <div className="text-[9px] text-[#505662] text-right">
                        Analyzed in {r.data.total_duration_ms.toFixed(0)}ms
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Per-location error notices ── */}
          {results.some((r) => r.status === 'error') && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs">
              <strong className="block mb-1">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 text-amber-400" />
                Some locations could not be analyzed:
              </strong>
              <ul className="list-disc list-inside space-y-0.5 text-amber-300/80 text-[11px]">
                {results
                  .filter((r) => r.status === 'error')
                  .map((r) => (
                    <li key={r.locationId}>
                      <strong>{r.label}</strong> ({r.areaName}): {r.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* ── Charts Section ── */}
          {successResults.length >= 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-[#1B1F24]">
                <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Comparison Charts
                </h4>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Competitors Chart */}
                <div className="bg-[#0B0D10] border border-[#262B33] rounded-2xl p-4">
                  <h5 className="text-[11px] font-semibold text-[#A5ABB4] mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#3B82F6]" /> Real Competitors Count
                  </h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={competitorChartData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B1F24" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#A5ABB4' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#A5ABB4' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', color: '#A5ABB4' }}
                      />
                      {successResults.map((r) => (
                        <Bar
                          key={r.label}
                          dataKey={r.label}
                          fill={r.color}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Budget Chart */}
                <div className="bg-[#0B0D10] border border-[#262B33] rounded-2xl p-4">
                  <h5 className="text-[11px] font-semibold text-[#A5ABB4] mb-3 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-[#3B82F6]" /> Budget Analysis (₹)
                  </h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={budgetChartData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B1F24" />
                      <XAxis dataKey="metric" tick={{ fontSize: 9, fill: '#A5ABB4' }} />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#A5ABB4' }}
                        tickFormatter={(v: number) =>
                          v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v.toLocaleString()
                        }
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', color: '#A5ABB4' }} />
                      {successResults.map((r) => (
                        <Bar
                          key={r.label}
                          dataKey={r.label}
                          fill={r.color}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Demand Chart */}
                <div className="bg-[#0B0D10] border border-[#262B33] rounded-2xl p-4">
                  <h5 className="text-[11px] font-semibold text-[#A5ABB4] mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#3B82F6]" /> Demand Prediction
                  </h5>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={demandChartData} barGap={8}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1B1F24" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10, fill: '#A5ABB4' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#A5ABB4' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '10px', color: '#A5ABB4' }} />
                      {successResults.map((r) => (
                        <Bar
                          key={r.label}
                          dataKey={r.label}
                          fill={r.color}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={40}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── Recommendation Winner ── */}
          {successResults.length >= 2 && (
            <div className="bg-[#0B0D10] border border-[#262B33] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1B1F24]">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Quick Comparison Summary
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Lowest competition */}
                {(() => {
                  const sorted = [...successResults].sort(
                    (a, b) => (a.data?.competitor_count || 0) - (b.data?.competitor_count || 0)
                  );
                  const best = sorted[0];
                  return (
                    <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                      <span className="text-[10px] text-[#A5ABB4] block mb-1">
                        Lowest Competition
                      </span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: best.color }}
                        />
                        {best.label} — {best.areaName}
                      </span>
                      <span className="text-[10px] text-[#A5ABB4]">
                        {best.data?.competitor_count} competitors
                      </span>
                    </div>
                  );
                })()}

                {/* Best budget fit */}
                {(() => {
                  const withBudget = successResults.filter(
                    (r) => r.data?.budget_feasibility?.budget_difference_inr != null
                  );
                  if (withBudget.length === 0) return null;
                  const sorted = [...withBudget].sort(
                    (a, b) =>
                      (b.data?.budget_feasibility?.budget_difference_inr || 0) -
                      (a.data?.budget_feasibility?.budget_difference_inr || 0)
                  );
                  const best = sorted[0];
                  return (
                    <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                      <span className="text-[10px] text-[#A5ABB4] block mb-1">
                        Best Budget Fit
                      </span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: best.color }}
                        />
                        {best.label} — {best.areaName}
                      </span>
                      <span className="text-[10px] text-[#A5ABB4]">
                        {best.data?.budget_feasibility?.feasibility_category} (
                        {(best.data?.budget_feasibility?.budget_difference_inr || 0) >= 0 ? '+' : ''}₹
                        {Math.round(
                          best.data?.budget_feasibility?.budget_difference_inr || 0
                        ).toLocaleString()}
                        )
                      </span>
                    </div>
                  );
                })()}

                {/* Highest demand */}
                {(() => {
                  const withDemand = successResults.filter(
                    (r) =>
                      r.data?.ml_prediction?.predicted_synthetic_monthly_visits != null
                  );
                  if (withDemand.length === 0) return null;
                  const sorted = [...withDemand].sort(
                    (a, b) =>
                      (b.data?.ml_prediction?.predicted_synthetic_monthly_visits || 0) -
                      (a.data?.ml_prediction?.predicted_synthetic_monthly_visits || 0)
                  );
                  const best = sorted[0];
                  return (
                    <div className="bg-[#111418] rounded-xl p-3 border border-[#1B1F24]">
                      <span className="text-[10px] text-[#A5ABB4] block mb-1">
                        Highest Demand Index
                      </span>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: best.color }}
                        />
                        {best.label} — {best.areaName}
                      </span>
                      <span className="text-[10px] text-[#A5ABB4]">
                        {Math.round(
                          best.data?.ml_prediction?.predicted_synthetic_monthly_visits || 0
                        ).toLocaleString()}{' '}
                        predicted visits
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
