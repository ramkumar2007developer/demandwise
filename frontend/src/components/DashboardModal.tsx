import React, { useState } from 'react';
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
  Info,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import type {
  BusinessAnalysisRequest,
  BusinessAnalysisResponse,
  BusinessType,
  Language,
} from '../types/api';
import { translations } from '../data/translations';
import { MapView } from './MapView';

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

  // Execution states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessAnalysisResponse | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: (typeof COIMBATORE_PRESETS)[0]) => {
    setSelectedArea(preset.name);
    setLatitude(preset.lat);
    setLongitude(preset.lng);
  };

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
                  Step 1: Business Parameters & Investment
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

              {/* Location Controls */}
              <div className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-[#A5ABB4]">
                    {t.quickLocations}
                  </label>
                  <span className="text-[11px] text-[#A5ABB4]">
                    Bounding Box: 10.85°–11.20°N, 76.80°–77.20°E
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
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
                </div>
              </div>

              {/* Coordinates & ML features row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

              {/* Concept notes */}
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
                <div className="flex items-center gap-2">
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
                  <span className="text-xs bg-[#1B1F24] text-[#A5ABB4] border border-[#262B33] px-2.5 py-1 rounded-full">
                    {result.explanation_mode === 'llm_generated' ? '⚡ Groq AI' : '📋 Template'}
                  </span>
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
                        ? Math.round(result.ml_prediction.predicted_synthetic_monthly_visits).toLocaleString()
                        : 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#A5ABB4] mt-0.5">
                      estimated monthly visits (volume index)
                    </div>
                  </div>

                  {/* MANDATORY PROMINENT DISCLAIMER */}
                  <div className="mt-3 pt-2.5 border-t border-[#1B1F24] bg-[#171A20] rounded-lg p-2 text-[10px] text-amber-300 leading-tight border border-amber-800/30">
                    <span className="font-semibold block mb-0.5 flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-400 inline" /> Demo Prediction:
                    </span>
                    This demand estimate is generated using synthetic training data. It is for
                    demonstration purposes only and is not a verified real-world business forecast.
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
                        ? Math.round(result.budget_feasibility.total_estimated_startup_cost_inr).toLocaleString()
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
                <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-[#A5ABB4] mb-1">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#FF2638]" />
                        Verified Competitors
                      </span>
                    </div>
                    <div className="text-2xl font-extrabold text-white mt-1">
                      {result.competitor_count}
                    </div>
                    <div className="text-[11px] text-[#A5ABB4] mt-0.5">
                      found within 2.0 km radius in Coimbatore
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#1B1F24] text-[10px] text-[#A5ABB4]">
                    Source: OpenStreetMap Overpass (Zero Fabrication Guarantee)
                  </div>
                </div>

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

              {/* Map View & Competitor List Grid */}
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
                  />
                </div>

                {/* Competitors List Preview (5 cols) */}
                <div className="lg:col-span-5 bg-[#111418] border border-[#262B33] rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1B1F24]">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Nearby Competitors ({result.competitors.length})
                    </span>
                    <span className="text-[10px] text-[#A5ABB4]">OSM Verified</span>
                  </div>

                  {result.competitors.length === 0 ? (
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
                          key={idx}
                          className="bg-[#1B1F24] border border-[#262B33] rounded-xl p-3 flex items-center justify-between hover:border-[#FF2638]/40 transition-colors"
                        >
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              {comp.name}
                            </span>
                            <span className="text-[10px] text-[#A5ABB4] capitalize">
                              {comp.category}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#FF2638] bg-[#FF2638]/10 px-2 py-0.5 rounded">
                            {comp.distance_km != null ? `${comp.distance_km.toFixed(2)} km` : 'Near'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[#1B1F24] text-[10px] text-[#A5ABB4]">
                    &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-[#FF2638] hover:underline">OpenStreetMap contributors</a>. Distances calculated via Haversine formula.
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
