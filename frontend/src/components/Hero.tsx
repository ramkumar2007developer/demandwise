import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Play,
  Zap,
  Clock,
  Shield,
  MapPin,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { translations } from '../data/translations';
import type { Language } from '../data/translations';
import businessmanBg from '../assets/businessman-bg.jpg';

interface HeroProps {
  language: Language;
  onOpenDashboard: () => void;
  onWatchDemo: () => void;
}

const mockTrendData = [
  { month: 'Jan', visits: 520 },
  { month: 'Feb', visits: 780 },
  { month: 'Mar', visits: 1100 },
  { month: 'Apr', visits: 1450 },
  { month: 'May', visits: 1820 },
  { month: 'Jun', visits: 2100 },
  { month: 'Jul', visits: 2350 },
  { month: 'Aug', visits: 2280 },
  { month: 'Sep', visits: 2450 },
  { month: 'Oct', visits: 2680 },
  { month: 'Nov', visits: 2900 },
  { month: 'Dec', visits: 3120 },
];

export const Hero: React.FC<HeroProps> = ({
  language,
  onOpenDashboard,
  onWatchDemo,
}) => {
  const t = translations[language].hero;
  const [activeTrendTab, setActiveTrendTab] = useState<'Monthly' | 'Quarterly' | 'Yearly'>('Monthly');

  return (
    <section id="home" className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-[#FF2638]/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-[#A10F20]/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="lg:col-span-5 text-left"
          >
            {/* Tag badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1F24] border border-[#262B33] text-[#FF2638] text-xs font-bold tracking-wider uppercase mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#FF2638]" />
              <span>{t.tag}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-white leading-[1.12] mb-6">
              {t.headlinePart1}
              <span className="text-[#FF2638] relative inline-block">
                {t.headlineHighlight}
                <svg
                  className="absolute -bottom-2 left-0 w-full h-2 text-[#FF2638]/40"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                >
                  <path d="M0,8 Q50,0 100,8" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-[#A5ABB4] leading-relaxed mb-8 max-w-xl">
              {t.subheadline}
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <button
                onClick={onOpenDashboard}
                className="inline-flex items-center gap-2.5 bg-[#FF2638] hover:bg-[#ff3b4b] text-white text-base font-semibold px-7 py-3.5 rounded-full transition-all duration-200 shadow-glow hover:shadow-glowSm hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>{t.ctaPrimary}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={onWatchDemo}
                className="inline-flex items-center gap-2.5 bg-[#111418] hover:bg-[#1B1F24] border border-[#262B33] hover:border-[#FF2638]/50 text-white text-base font-medium px-6 py-3.5 rounded-full transition-all duration-200"
              >
                <div className="w-6 h-6 rounded-full bg-[#FF2638]/20 flex items-center justify-center text-[#FF2638]">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
                <span>{t.ctaSecondary}</span>
              </button>

            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#1B1F24]/60 text-xs sm:text-sm text-[#A5ABB4]">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#FF2638]/10 flex items-center justify-center text-[#FF2638]">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>{t.badgeAi}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#FF2638]/10 flex items-center justify-center text-[#FF2638]">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span>{t.badgeRealtime}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#FF2638]/10 flex items-center justify-center text-[#FF2638]">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <span>{t.badgeEasy}</span>
              </div>
            </div>
          </motion.div>

          {/* Right Floating Dashboard Preview (Matches Reference Design) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="lg:col-span-7 relative"
          >
            {/* Glowing border card container */}
            <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-[#FF2638]/50 via-[#262B33] to-[#A10F20]/30 shadow-2xl">
              <div className="relative rounded-[15px] bg-[#0B0D10] p-4 sm:p-6 overflow-hidden">
                {/* Background Businessman Image with light visibility */}
                <div
                  className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-25"
                  style={{ backgroundImage: `url(${businessmanBg})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D10]/90 via-[#0B0D10]/40 to-[#0B0D10]/70 pointer-events-none" />

                {/* Main Dashboard Rows */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
                  {/* Demand Trend Line Chart (7 cols) */}
                  <div className="md:col-span-7 bg-[#111418]/85 backdrop-blur-md border border-[#262B33] rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#FF2638]" />
                        <span className="text-xs font-semibold text-white">Demand Trend</span>
                      </div>
                      <div className="flex items-center gap-1 bg-[#1B1F24] rounded-lg p-0.5 text-[10px]">
                        {(['Monthly', 'Quarterly', 'Yearly'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTrendTab(tab)}
                            className={`px-2 py-0.5 rounded-md transition-colors ${
                              activeTrendTab === tab
                                ? 'bg-[#FF2638] text-white font-medium'
                                : 'text-[#A5ABB4] hover:text-white'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={mockTrendData}
                          margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#FF2638" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#FF2638" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="month"
                            stroke="#505662"
                            fontSize={10}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#505662"
                            fontSize={10}
                            tickLine={false}
                            domain={[0, 4000]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#111418',
                              borderColor: '#262B33',
                              borderRadius: '8px',
                              fontSize: '11px',
                              color: '#F5F5F5',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="visits"
                            stroke="#FF2638"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#trendGradient)"
                            dot={{ fill: '#FF2638', stroke: '#fff', strokeWidth: 1.5, r: 2.5 }}
                            activeDot={{ r: 5, fill: '#FF2638', stroke: '#fff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Location Radar + Key Insights (5 cols) */}
                  <div className="md:col-span-5 flex flex-col gap-3">
                    {/* Simulated Map View */}
                    <div className="bg-[#111418]/85 backdrop-blur-md border border-[#262B33] rounded-xl p-3 relative overflow-hidden flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2 z-10">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#FF2638]" />
                          Business Location
                        </span>
                        <span className="text-[10px] text-[#A5ABB4]">RS Puram, CBE</span>
                      </div>

                      {/* Map graphics overlay */}
                      <div className="relative h-24 rounded-lg bg-[#08090C] border border-[#262B33]/60 overflow-hidden flex items-center justify-center">
                        {/* Grid lines */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1B1F24_1px,transparent_1px),linear-gradient(to_bottom,#1B1F24_1px,transparent_1px)] bg-[size:16px_16px]" />
                        {/* Radar pulse */}
                        <div className="absolute w-14 h-14 rounded-full bg-[#FF2638]/20 animate-ping pointer-events-none" />
                        <div className="relative w-8 h-8 rounded-full bg-[#FF2638]/30 border border-[#FF2638] flex items-center justify-center shadow-glowSm">
                          <div className="w-3 h-3 rounded-full bg-[#FF2638]" />
                        </div>
                        {/* Mock competitor pins */}
                        <div className="absolute top-3 left-4 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                        <div className="absolute top-5 right-6 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                        <div className="absolute bottom-4 left-8 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                        <div className="absolute bottom-3 right-8 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                        <span className="absolute bottom-1 right-1.5 text-[8px] text-[#A5ABB4]">
                          © OpenStreetMap
                        </span>
                      </div>

                      {/* Action trigger */}
                      <button
                        onClick={onOpenDashboard}
                        className="mt-2 text-[11px] font-medium text-[#FF2638] hover:text-white flex items-center justify-between py-1 px-2 rounded-lg bg-[#1B1F24]/50 border border-[#262B33] transition-colors"
                      >
                        <span>Analyze Your Location</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Key Insights mini list */}
                    <div className="bg-[#111418]/85 backdrop-blur-md border border-[#262B33] rounded-xl p-3">
                      <div className="text-xs font-semibold text-white mb-2">
                        Key Insights
                      </div>
                      <ul className="space-y-1.5 text-[11px] text-[#A5ABB4]">
                        <li className="flex items-start gap-1.5">
                          <span className="text-[#FF2638] font-bold">•</span>
                          <span>High demand potential in RS Puram commercial hub.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-[#FF2638] font-bold">•</span>
                          <span>4 verified nearby cafes within 1.5 km radial distance.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>Budget provides ₹1.8L surplus safety buffer.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
