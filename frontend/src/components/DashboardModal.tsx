import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  TrendingUp,
  DollarSign,
  Users,
  MapPin,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building,
  Navigation,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import type {
  BusinessAnalysisRequest,
  BusinessAnalysisResponse,
  BusinessType,
  CompetitorItem,
  Language,
} from '../types/api';
import { translations } from '../data/translations';
import { MapView } from './MapView';
import { LocationComparison } from './LocationComparison';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

// Preset verified Coimbatore location clusters
const COIMBATORE_PRESETS = [
  { name: 'RS Puram', lat: 11.0168, lng: 76.9558 },
  { name: 'Gandhipuram', lat: 11.0183, lng: 76.9644 },
  { name: 'Peelamedu', lat: 11.0287, lng: 77.0044 },
  { name: 'Saravanampatti', lat: 11.0805, lng: 76.9961 },
  { name: 'Saibaba Colony', lat: 11.0315, lng: 76.9427 },
];

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  onClose,
  language,
  onLanguageChange,
}) => {
  const t = translations[language].dashboard;

  // Form states
  const [businessName, setBusinessName] = useState('Kovai Special Cafe');
  const [businessType, setBusinessType] = useState<BusinessType>('cafe');
  const [budgetInr, setBudgetInr] = useState<number>(1000000);
  const [selectedArea, setSelectedArea] = useState('RS Puram');
  const [latitude, setLatitude] = useState<number>(11.0168);
  const [longitude, setLongitude] = useState<number>(76.9558);
  const [floorArea, setFloorArea] = useState<number>(850);
  const [nearCollege, setNearCollege] = useState<number>(1);
  const [notes, setNotes] = useState('Specialty south Indian filter coffee and quick bites.');

  // Phase 1: Real-time competitor preview & interactive map location state
  const [top5Competitors, setTop5Competitors] = useState<CompetitorItem[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);
  const [isCompetitorsCached, setIsCompetitorsCached] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Execution states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessAnalysisResponse | null>(null);

  // Phase 3: Comparison results captured from LocationComparison for PDF export
  const [capturedComparisonResults, setCapturedComparisonResults] = useState<
    Array<{ label: string; areaName: string; data: BusinessAnalysisResponse | null; status: string; color: string }>
  >([]);
  const [reportGenerating, setReportGenerating] = useState(false);

  // Phase 3: Handle PDF report generation
  const handleDownloadReport = useCallback(async () => {
    if (!result) return;
    setReportGenerating(true);
    try {
      const { generateDemandWiseReport } = await import('../services/reportGenerator');
      await generateDemandWiseReport({
        result,
        language,
        businessName,
        businessType,
        budgetInr,
        latitude,
        longitude,
        selectedArea,
        floorArea,
        nearCollege,
        notes,
        comparisonResults: capturedComparisonResults,
      });
    } catch (err) {
      console.error('[DemandWise] PDF generation error:', err);
    } finally {
      setReportGenerating(false);
    }
  }, [result, language, businessName, businessType, budgetInr, latitude, longitude, selectedArea, floorArea, nearCollege, notes, capturedComparisonResults]);

  // Phase 1 & Optimization: Debounced live retrieval with request cancellation and caching
  useEffect(() => {
    if (!isOpen) return;

    // Strictly enforce Coimbatore bounding box: 10.85°N–11.20°N, 76.80°E–77.20°E
    if (latitude < 10.85 || latitude > 11.2 || longitude < 76.8 || longitude > 77.2) {
      setTop5Competitors([]);
      return;
    }

    // Cancel previous obsolete in-flight request when user drags or updates location
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let isCurrent = true;
    setCompetitorsLoading(true);
    setCompetitorsError(null);

    const timer = setTimeout(async () => {
      try {
        const resp = await api.searchCompetitors(
          {
            business_type: businessType,
            latitude: Number(latitude),
            longitude: Number(longitude),
            radius_meters: 2000,
          },
          controller.signal
        );

        if (isCurrent && !controller.signal.aborted) {
          setIsCompetitorsCached(Boolean(resp.is_cached));
          if (resp.status === 'degraded' || resp.status === 'error') {
            setCompetitorsError(
              resp.note ||
                'OpenStreetMap Overpass place search service is currently busy. Zero fabricated data guaranteed.'
            );
            setTop5Competitors([]);
          } else {
            // Sort strictly by ascending distance from selected location
            const sorted = [...(resp.competitors || [])].sort(
              (a, b) => a.distance_km - b.distance_km
            );
            // Retain at most the top five nearest real competitors
            setTop5Competitors(sorted.slice(0, 5));
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // Request was obsolete and cancelled due to newer user movement, silently ignore
          return;
        }
        if (isCurrent && !controller.signal.aborted) {
          setIsCompetitorsCached(false);
          setCompetitorsError(
            err?.message ||
              'OpenStreetMap Overpass place search service is currently busy. Zero fabricated data guaranteed.'
          );
          setTop5Competitors([]);
        }
      } finally {
        if (isCurrent && !controller.signal.aborted) {
          setCompetitorsLoading(false);
        }
      }
    }, 400); // 400ms debounce to prevent Overpass API flooding

    return () => {
      isCurrent = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, latitude, longitude, businessType]);

  if (!isOpen) return null;

  // Preset location selector
  const handleSelectPreset = (preset: (typeof COIMBATORE_PRESETS)[0]) => {
    setSelectedArea(preset.name);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
    setLocationWarning(null);
  };

  // Phase 1: Interactive map click/drag location handler with strict Coimbatore bounds
  const handleLocationSelect = (newLat: number, newLng: number) => {
    const lat = Number(newLat.toFixed(4));
    const lng = Number(newLng.toFixed(4));

    if (lat < 10.85 || lat > 11.2 || lng < 76.8 || lng > 77.2) {
      setLocationWarning(
        `Selected point (${lat}°N, ${lng}°E) is outside Coimbatore (10.85°N–11.20°N, 76.80°E–77.20°E). Please select within the dashed red border.`
      );
      return;
    }

    setLocationWarning(null);
    setLatitude(lat);
    setLongitude(lng);
    setSelectedArea(`Custom Pin (${lat}, ${lng})`);
  };

  // Phase 1: Browser geolocation handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationWarning('Browser geolocation is not supported on this device.');
      return;
    }

    setLocatingUser(true);
    setLocationWarning(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));

        if (lat < 10.85 || lat > 11.2 || lng < 76.8 || lng > 77.2) {
          setLocationWarning(
            `Your current device location (${lat}°N, ${lng}°E) is outside Coimbatore (10.85°N–11.20°N, 76.80°E–77.20°E). DemandWise 2.0 strictly serves Coimbatore commercial hubs.`
          );
        } else {
          setLatitude(lat);
          setLongitude(lng);
          setSelectedArea('Current Device Location (Coimbatore)');
        }
      },
      (err) => {
        setLocatingUser(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationWarning(
            'Location permission was denied. Please allow location access in your browser or select on the map.'
          );
        } else {
          setLocationWarning(
            'Unable to determine device location. Please choose a Coimbatore preset or pick on the map.'
          );
        }
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  // Run full business analysis
  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: BusinessAnalysisRequest = {
      business_name: businessName.trim(),
      business_type: businessType,
      language: language,
      budget_inr: Number(budgetInr),
      location: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        area_name: selectedArea,
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
      floor_area_sqft: Number(floorArea) || 800,
      near_college: nearCollege,
      notes: notes.trim(),
    };

    try {
      const response = await api.runAnalysis(payload);
      setResult(response);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while running the analysis.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-8 animate-fadeIn">
      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0B0D10] border border-[#262B33] rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1B1F24] bg-[#0E1014]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF2638] to-[#A10F20] flex items-center justify-center shadow-glowSm">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Demand<span className="text-[#FF2638]">Wise</span>
                <span className="text-xs font-normal text-[#A5ABB4] hidden sm:inline">
                  — {t.title}
                </span>
              </h2>
              <p className="text-xs text-[#A5ABB4]">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Toggle in Modal */}
            <div className="bg-[#111418] border border-[#262B33] rounded-full p-1 flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2.5 py-1 rounded-full transition-all ${
                  language === 'en' ? 'bg-[#FF2638] text-white' : 'text-[#A5ABB4]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('ta')}
                className={`px-2.5 py-1 rounded-full transition-all ${
                  language === 'ta' ? 'bg-[#FF2638] text-white' : 'text-[#A5ABB4]'
                }`}
              >
                தமிழ்
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1B1F24] border border-[#262B33] text-[#A5ABB4] hover:text-white hover:border-[#FF2638] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8">
          {/* Top Form Section */}
          <form onSubmit={handleRunAnalysis} className="space-y-6">
            <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-5 sm:p-6 shadow-md">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#1B1F24]">
                <Building className="w-4 h-4 text-[#FF2638]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Step 1: Business Parameters &amp; Location Selection
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Business Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1.5">
                    {t.businessName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Aroma Cafe"
                    className="w-full bg-[#1B1F24] border border-[#262B33] focus:border-[#FF2638] focus:ring-1 focus:ring-[#FF2638] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#505662] outline-none transition-all"
                  />
                </div>

                {/* Business Category */}
                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1.5">
                    {t.category} *
                  </label>
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    className="w-full bg-[#1B1F24] border border-[#262B33] focus:border-[#FF2638] focus:ring-1 focus:ring-[#FF2638] rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition-all"
                  >
                    <option value="cafe">Cafe / Coffee Shop</option>
                    <option value="hotel">Hotel / Small Restaurant</option>
                    <option value="retail">Retail Shop / Grocery</option>
                  </select>
                </div>

                {/* Investment Budget */}
                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1.5">
                    {t.budget} *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-[#FF2638] font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min={10000}
                      max={50000000}
                      step={25000}
                      value={budgetInr}
                      onChange={(e) => setBudgetInr(Number(e.target.value))}
                      className="w-full bg-[#1B1F24] border border-[#262B33] focus:border-[#FF2638] focus:ring-1 focus:ring-[#FF2638] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-white font-mono outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Location Presets & "Use My Current Location" */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-[#A5ABB4]">
                    {t.quickLocations}
                  </label>
                  <span className="text-[11px] text-[#A5ABB4]">
                    Coimbatore Zone: 10.85°–11.20°N, 76.80°–77.20°E
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {COIMBATORE_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                        selectedArea === p.name
                          ? 'bg-[#FF2638] text-white border-[#FF2638] font-medium shadow-glowSm'
                          : 'bg-[#1B1F24] text-[#A5ABB4] border-[#262B33] hover:text-white'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}

                  {/* "Use My Current Location" Button */}
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locatingUser}
                    className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg border border-[#FF2638]/40 bg-[#FF2638]/10 hover:bg-[#FF2638]/20 text-[#FF2638] font-medium transition-all shadow-sm"
                  >
                    {locatingUser ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#FF2638] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5" />
                    )}
                    <span>{locatingUser ? 'Detecting Location...' : 'Use My Current Location'}</span>
                  </button>
                </div>
              </div>

              {/* Location Warning / Boundary Alert */}
              {locationWarning && (
                <div className="mb-4 p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{locationWarning}</span>
                </div>
              )}

              {/* Coordinates & Store Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1">
                    {t.latitude}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="10.85"
                    max="11.20"
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    className="w-full bg-[#1B1F24] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1">
                    {t.longitude}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="76.80"
                    max="77.20"
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    className="w-full bg-[#1B1F24] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1">
                    {t.floorArea}
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    value={floorArea}
                    onChange={(e) => setFloorArea(Number(e.target.value))}
                    className="w-full bg-[#1B1F24] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A5ABB4] mb-1">
                    Near College / Campus
                  </label>
                  <select
                    value={nearCollege}
                    onChange={(e) => setNearCollege(Number(e.target.value))}
                    className="w-full bg-[#1B1F24] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value={1}>Yes (Proximity &lt; 1km)</option>
                    <option value={0}>No (Standard zone)</option>
                  </select>
                </div>
              </div>

              {/* Phase 1 Feature: Interactive Map & Top 5 Real Competitors Section */}
              <div className="mt-4 pt-4 border-t border-[#1B1F24]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#FF2638]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Interactive Map &amp; Top 5 Real Competitors
                    </h4>
                  </div>
                  <span className="text-[11px] text-[#A5ABB4]">
                    Selected: {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E ({selectedArea})
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Interactive Selection Map (7 cols) */}
                  <div className="lg:col-span-7">
                    <MapView
                      center={[latitude, longitude]}
                      businessName={businessName}
                      competitors={top5Competitors}
                      radiusMeters={2000}
                      onLocationSelect={handleLocationSelect}
                      heightClassName="h-[300px] sm:h-[350px]"
                    />
                  </div>

                  {/* Top 5 Competitors List (5 cols) */}
                  <div className="lg:col-span-5 bg-[#1B1F24] border border-[#262B33] rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#262B33]">
                        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#FF2638]" />
                          Top 5 Nearest Competitors
                        </span>
                        <div className="flex items-center gap-2">
                          {isCompetitorsCached && !competitorsLoading && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-mono">
                              ⚡ Cached
                            </span>
                          )}
                          {competitorsLoading && (
                            <div className="flex items-center gap-1.5 text-[10px] text-[#FF2638]">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Updating...</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Loading state */}
                      {competitorsLoading && top5Competitors.length === 0 && (
                        <div className="py-10 text-center space-y-2">
                          <div className="w-5 h-5 border-2 border-[#FF2638] border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs text-[#A5ABB4]">
                            Searching OpenStreetMap Overpass places...
                          </p>
                        </div>
                      )}

                      {/* Error state */}
                      {competitorsError && (
                        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs">
                          <span className="font-semibold block mb-1">Overpass Service Notice:</span>
                          <p className="text-[11px] text-amber-300/80 leading-relaxed">
                            {competitorsError}
                          </p>
                        </div>
                      )}

                      {/* Empty state */}
                      {!competitorsLoading && !competitorsError && top5Competitors.length === 0 && (
                        <div className="py-10 text-center space-y-2 text-[#A5ABB4]">
                          <Users className="w-8 h-8 text-[#505662] mx-auto mb-1" />
                          <p className="text-xs font-medium text-white">
                            No direct {businessType} competitors found in this exact 2 km radius.
                          </p>
                          <span className="text-[11px] text-emerald-400 block">
                            High local market entry opportunity!
                          </span>
                        </div>
                      )}

                      {/* Top 5 Competitors List */}
                      {top5Competitors.length > 0 && (
                        <div className="space-y-2 overflow-y-auto max-h-[240px] pr-1">
                          {top5Competitors.map((comp, idx) => (
                            <div
                              key={comp.osm_id || idx}
                              className="bg-[#111418] border border-[#262B33] rounded-xl p-2.5 flex items-center justify-between hover:border-[#FF2638]/40 transition-colors"
                            >
                              <div className="flex items-start gap-2.5 overflow-hidden">
                                <span className="w-5 h-5 rounded-full bg-[#FF2638]/10 text-[#FF2638] font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="truncate">
                                  <span className="text-xs font-semibold text-white block truncate">
                                    {comp.name || 'Unnamed Venue'}
                                  </span>
                                  <span className="text-[10px] text-[#A5ABB4] capitalize block">
                                    {comp.category}
                                    {comp.street ? ` • ${comp.street}` : ''}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-[#FF2638] bg-[#FF2638]/10 px-2 py-0.5 rounded shrink-0 ml-2">
                                {comp.distance_km != null
                                  ? `${comp.distance_km.toFixed(2)} km`
                                  : 'Near'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Attribution & Haversine Disclaimer */}
                    <div className="mt-3 pt-2.5 border-t border-[#262B33] text-[10px] text-[#A5ABB4] leading-tight">
                      Data &copy;{' '}
                      <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#FF2638] hover:underline"
                      >
                        OpenStreetMap contributors
                      </a>
                      . Haversine distance. Never fabricated.
                    </div>
                  </div>
                </div>
              </div>

              {/* Strategy Notes */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#A5ABB4] mb-1">
                  Business Concept &amp; Strategy Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Specialty filter coffee and artisanal south Indian quick bites"
                  className="w-full bg-[#1B1F24] border border-[#262B33] focus:border-[#FF2638] rounded-xl px-3 py-2 text-xs text-white outline-none transition-colors"
                />
              </div>

              {/* Submit CTA */}
              <div className="mt-6 pt-4 border-t border-[#1B1F24] flex items-center justify-between flex-wrap gap-4">
                <div className="text-xs text-[#A5ABB4] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Real OpenStreetMap retrieval &amp; synthetic ML demo index</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`inline-flex items-center gap-2.5 bg-[#FF2638] hover:bg-[#ff3b4b] disabled:bg-gray-700 text-white font-semibold text-sm px-8 py-3 rounded-full transition-all duration-200 shadow-glow hover:shadow-glowSm ${
                    loading ? 'cursor-not-allowed opacity-80' : 'hover:-translate-y-0.5'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t.analyzingBtn}</span>
                    </>
                  ) : (
                    <>
                      <span>{t.analyzeBtn}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Phase 2: Location Comparison Section */}
          <LocationComparison
            language={language}
            businessName={businessName}
            businessType={businessType}
            budgetInr={budgetInr}
            floorArea={floorArea}
            nearCollege={nearCollege}
            notes={notes}
            onComparisonResults={setCapturedComparisonResults}
          />

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-950/50 border border-red-800/80 rounded-2xl p-4 flex items-start gap-3 text-red-200 text-sm"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Analysis Request Failed</strong>
                <p className="text-xs text-red-300 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Results Presentation (Populates when backend returns) */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-2"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1B1F24]">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    {result.business_name} ({result.business_type.toUpperCase()})
                  </h3>
                  <p className="text-xs text-[#A5ABB4]">
                    Analysis ID: {result.request_id} • Duration: {result.total_duration_ms.toFixed(0)} ms
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                      result.budget_feasibility?.feasibility_category === 'SURPLUS'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800/50'
                        : result.budget_feasibility?.feasibility_category === 'FEASIBLE'
                        ? 'bg-amber-950 text-amber-400 border-amber-800/50'
                        : 'bg-rose-950 text-rose-400 border-rose-800/50'
                    }`}
                  >
                    Budget: {result.budget_feasibility?.feasibility_category || 'N/A'}
                  </span>

                  {/* Phase 3: Download Report Button */}
                  <button
                    id="download-report-btn"
                    type="button"
                    onClick={handleDownloadReport}
                    disabled={reportGenerating}
                    title="Download PDF Analysis Report"
                    className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
                      reportGenerating
                        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                        : 'bg-[#FF2638]/10 text-[#FF2638] border-[#FF2638]/50 hover:bg-[#FF2638] hover:text-white hover:border-[#FF2638] hover:shadow-[0_0_12px_rgba(255,38,56,0.4)] active:scale-95'
                    }`}
                  >
                    {reportGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Download Report</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Demand Prediction Card with MANDATORY DISCLAIMER */}
                <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#A5ABB4] mb-1">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-[#FF2638]" />
                        Demand Prediction
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {result.ml_prediction?.predicted_synthetic_monthly_visits != null
                        ? Math.round(
                            result.ml_prediction.predicted_synthetic_monthly_visits
                          ).toLocaleString()
                        : 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#A5ABB4] mt-0.5">
                      estimated monthly visits (volume index)
                    </div>
                  </div>
                </div>

                {/* 2. Startup Budget Feasibility */}
                <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#A5ABB4] mb-1">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-[#FF2638]" />
                        Estimated Startup Cost
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      ₹{' '}
                      {result.budget_feasibility?.total_estimated_startup_cost_inr != null
                        ? Math.round(
                            result.budget_feasibility.total_estimated_startup_cost_inr
                          ).toLocaleString()
                        : 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#A5ABB4] mt-0.5">
                      Planned budget: ₹ {Math.round(result.budget_inr).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#1B1F24] text-xs">
                    <div className="flex justify-between items-center text-[#A5ABB4]">
                      <span>Variance:</span>
                      <span
                        className={`font-semibold font-mono ${
                          (result.budget_feasibility?.budget_difference_inr || 0) >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {(result.budget_feasibility?.budget_difference_inr || 0) >= 0 ? '+' : ''}
                        ₹{' '}
                        {Math.round(
                          result.budget_feasibility?.budget_difference_inr || 0
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Nearby OSM Competitors */}
                {(() => {
                  const isDegraded =
                    result.competitor_status === 'degraded' ||
                    result.competitor_status === 'error' ||
                    result.stages.some(
                      (s) => s.stage === 'competitor_search' && s.status !== 'success'
                    );

                  return (
                    <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-[#A5ABB4] mb-1">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#FF2638]" />
                            Verified Competitors
                          </span>
                        </div>
                        {isDegraded ? (
                          <div>
                            <div className="text-xl font-extrabold text-amber-400 mt-1 flex items-center gap-1.5">
                              <AlertTriangle className="w-5 h-5 text-amber-400" />
                              Unavailable
                            </div>
                            <div className="text-[11px] text-amber-300/80 mt-0.5">
                              Overpass service busy / timed out. Zero fabricated data.
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-2xl font-extrabold text-white mt-1">
                              {result.competitor_count}
                            </div>
                            <div className="text-[11px] text-[#A5ABB4] mt-0.5">
                              found within 2.0 km radius in Coimbatore
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-2 border-t border-[#1B1F24] text-[10px] text-[#A5ABB4]">
                        Source: OpenStreetMap Overpass (Zero Fabrication Guarantee)
                      </div>
                    </div>
                  );
                })()}

                {/* 4. Executive Summary / Recommendation */}
                <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#A5ABB4] mb-1">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF2638]" />
                        Opportunity Verdict
                      </span>
                    </div>
                    <div className="text-base font-bold text-white mt-1 line-clamp-2">
                      {result.summary}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#1B1F24] text-[10px] text-[#A5ABB4]">
                    Synthesized in {result.language.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Map View & Competitor List Grid in Results */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Interactive Map (7 cols) */}
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#FF2638]" />
                      Spatial Competitive Map (Coimbatore)
                    </span>
                    <span className="text-[11px] text-[#A5ABB4]">
                      {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
                    </span>
                  </div>
                  <MapView
                    center={[latitude, longitude]}
                    businessName={result.business_name}
                    competitors={result.competitors}
                    radiusMeters={2000}
                    onLocationSelect={handleLocationSelect}
                  />
                </div>

                {/* Competitors List Preview (5 cols) */}
                <div className="lg:col-span-5 bg-[#111418] border border-[#262B33] rounded-2xl p-5 flex flex-col">
                  {(() => {
                    const isDegraded =
                      result.competitor_status === 'degraded' ||
                      result.competitor_status === 'error' ||
                      result.stages.some(
                        (s) => s.stage === 'competitor_search' && s.status !== 'success'
                      );

                    return (
                      <>
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1B1F24]">
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            Nearby Competitors {isDegraded ? '(Notice)' : `(${result.competitors.length})`}
                          </span>
                          <span className="text-[10px] text-[#A5ABB4]">
                            {isDegraded ? 'Service Notice' : 'OSM Verified'}
                          </span>
                        </div>

                        {isDegraded ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-amber-200 bg-amber-950/20 border border-amber-800/30 rounded-xl">
                            <AlertTriangle className="w-7 h-7 text-amber-400 mb-2" />
                            <span className="font-bold text-amber-300 block mb-1">
                              Overpass Service Notice
                            </span>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed max-w-[280px]">
                              {result.competitor_error ||
                                'The public OpenStreetMap Overpass service is currently busy or timed out. Real competitor data could not be retrieved at this moment. Zero competitors were fabricated.'}
                            </p>
                          </div>
                        ) : result.competitors.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-sm text-[#A5ABB4]">
                            <Users className="w-8 h-8 text-[#505662] mb-2" />
                            <p>No direct competitors found in this exact 2km radius.</p>
                            <span className="text-xs text-emerald-400 mt-1">
                              High market entry opportunity.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
                            {result.competitors.map((comp, idx) => (
                              <div
                                key={comp.osm_id || idx}
                                className="bg-[#1B1F24] border border-[#262B33] rounded-xl p-3 flex items-center justify-between hover:border-[#FF2638]/40 transition-colors"
                              >
                                <div>
                                  <span className="text-xs font-semibold text-white block">
                                    {comp.name}
                                  </span>
                                  <span className="text-[10px] text-[#A5ABB4] capitalize">
                                    {comp.category}
                                    {comp.street ? ` • ${comp.street}` : ''}
                                  </span>
                                </div>
                                <span className="text-xs font-mono font-bold text-[#FF2638] bg-[#FF2638]/10 px-2 py-0.5 rounded">
                                  {comp.distance_km != null ? `${comp.distance_km.toFixed(2)} km` : 'Near'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  <div className="mt-3 pt-3 border-t border-[#1B1F24] text-[10px] text-[#A5ABB4]">
                    &copy;{' '}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FF2638] hover:underline"
                    >
                      OpenStreetMap contributors
                    </a>
                    . Distances calculated via Haversine formula.
                  </div>
                </div>
              </div>

              {/* AI Narrative & Recommendations */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Full Explanation */}
                <div className="lg:col-span-7 bg-[#111418] border border-[#262B33] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1B1F24]">
                    <Sparkles className="w-4 h-4 text-[#FF2638]" />
                    <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                      AI Comprehensive Assessment
                    </h4>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-[#F5F5F5] text-xs leading-relaxed whitespace-pre-line space-y-2">
                    {result.explanation || result.summary}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="lg:col-span-5 bg-[#111418] border border-[#262B33] rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1B1F24]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                      Strategic Next Steps
                    </h4>
                  </div>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#A5ABB4]">
                        <span className="w-5 h-5 rounded-full bg-[#FF2638]/10 text-[#FF2638] font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed text-[#F5F5F5]">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Stage Observability & Timing Diagnostics */}
              <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1B1F24]">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF2638]" />
                    {t.stageProgress}
                  </span>
                  <span className="text-xs text-[#A5ABB4] font-mono">
                    Total Time: {result.total_duration_ms.toFixed(1)} ms
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {result.stages.map((st, i) => (
                    <div
                      key={i}
                      className="bg-[#1B1F24] border border-[#262B33] rounded-xl p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white capitalize text-[11px]">
                          {st.stage.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            st.status === 'success'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-amber-950 text-amber-400'
                          }`}
                        >
                          {st.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#A5ABB4] font-mono block">
                        {st.duration_ms.toFixed(1)} ms
                      </span>
                    </div>
                  ))}
                </div>

                {/* Non-fatal warnings if any */}
                {result.warnings.length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs">
                    <strong className="block mb-1">Non-Fatal Diagnostics:</strong>
                    <ul className="list-disc list-inside space-y-0.5">
                      {result.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
