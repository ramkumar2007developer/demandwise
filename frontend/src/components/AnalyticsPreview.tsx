import React from 'react';
import {
  TrendingUp,
  BarChart3,
  Users,
  MapPin,
  ArrowRight,
  Star,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  LineChart,
  Line,
} from 'recharts';
import type { Language } from '../data/translations';

interface AnalyticsPreviewProps {
  language: Language;
  onGetStarted: () => void;
}

const miniLineData = [
  { v: 1200 },
  { v: 1400 },
  { v: 1800 },
  { v: 1600 },
  { v: 2100 },
  { v: 2450 },
];

const revenueBarData = [
  { month: 'Jan', revenue: 2.4 },
  { month: 'Feb', revenue: 3.1 },
  { month: 'Mar', revenue: 4.2 },
  { month: 'Apr', revenue: 4.8 },
  { month: 'May', revenue: 5.1 },
  { month: 'Jun', revenue: 5.2 },
];

const mockTopCompetitors = [
  { name: 'Cafe Coffee Day', dist: '0.8 km' },
  { name: 'Cross Cut Coffee', dist: '1.2 km' },
  { name: 'The Coffee House', dist: '1.8 km' },
  { name: 'Chai Shai Co.', dist: '2.4 km' },
  { name: 'Keventers CBE', dist: '3.1 km' },
];

export const AnalyticsPreview: React.FC<AnalyticsPreviewProps> = ({
  language,
  onGetStarted,
}) => {
  const isTamil = language === 'ta';

  return (
    <section id="about" className="py-24 bg-[#050607] relative overflow-hidden border-t border-[#1B1F24]">
      {/* Background red glow */}
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[400px] bg-[#FF2638]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Graphic Cards Mockup Array */}
          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Monthly Visitors */}
              <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#A5ABB4] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#FF2638]" />
                    {isTamil ? 'மாதாந்திர வருகை (மாதிரி)' : 'Monthly Visitors (Demo)'}
                  </span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded font-semibold border border-emerald-800/30">
                    +12.5%
                  </span>
                </div>
                <div className="text-2xl font-extrabold text-white mb-2">
                  2,450
                </div>
                <div className="h-14 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={miniLineData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke="#FF2638"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Card 2: Revenue Benchmark */}
              <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#A5ABB4] flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-[#FF2638]" />
                    {isTamil ? 'வருவாய் கணிப்பு (மாதிரி)' : 'Revenue Benchmark'}
                  </span>
                  <span className="text-[10px] font-bold text-[#FF2638] bg-[#FF2638]/10 px-2 py-0.5 rounded border border-[#FF2638]/30">
                    ₹ 5.2L
                  </span>
                </div>
                <div className="h-20 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueBarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" stroke="#505662" fontSize={9} tickLine={false} />
                      <Bar dataKey="revenue" fill="#FF2638" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Card 3: Top Competitors Preview */}
            <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1B1F24]">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF2638]" />
                  {isTamil ? 'முக்கிய போட்டியாளர்கள்' : 'Top Competitors (Live OSM)'}
                </span>
                <span className="text-[11px] text-[#A5ABB4]">
                  {isTamil ? 'அருகாமையில்' : 'Radial Distance'}
                </span>
              </div>
              <div className="space-y-2">
                {mockTopCompetitors.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-[#1B1F24] transition-colors"
                  >
                    <span className="text-[#F5F5F5] font-medium">{c.name}</span>
                    <span className="text-[#FF2638] font-mono text-[11px] font-semibold">
                      {c.dist}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 4: Live Map Radar Strip */}
            <div className="bg-[#111418] border border-[#262B33] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-xl bg-[#1B1F24] border border-[#FF2638]/40 flex items-center justify-center text-[#FF2638]">
                  <MapPin className="w-4 h-4" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF2638] animate-ping" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {isTamil ? 'நேரலை ஆய்வு மையம்' : 'Live Spatial Search'}
                  </div>
                  <div className="text-[11px] text-[#A5ABB4]">
                    Coimbatore (10.85°N – 11.20°N, 76.80°E – 77.20°E)
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-[#A5ABB4]">
                © OpenStreetMap
              </span>
            </div>
          </div>

          {/* Right: CTA & Headline */}
          <div className="lg:col-span-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1F24] border border-[#262B33] text-[#FF2638] text-xs font-bold tracking-wider uppercase mb-5">
              <span>{isTamil ? 'உங்கள் பயணத்தைத் தொடங்குங்கள்' : 'START YOUR JOURNEY'}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
              {isTamil ? (
                <>
                  உங்கள் யோசனையை <br />
                  ஒரு <span className="text-[#FF2638]">வெற்றிகரமான வணிகமாக</span> மாற்றுங்கள்
                </>
              ) : (
                <>
                  Turn Your Idea Into <br />A Profitable{' '}
                  <span className="text-[#FF2638]">Business</span>
                </>
              )}
            </h2>

            <p className="text-base sm:text-lg text-[#A5ABB4] leading-relaxed mb-8">
              {isTamil
                ? 'AI நுண்ணறிவுகளைப் பெறுங்கள், உங்கள் பட்ஜெட்டைத் திட்டமிடுங்கள், போட்டியாளர்களை ஆய்வு செய்து சிறந்த முடிவுகளை எடுங்கள் — அனைத்தும் ஒரே இடத்தில்.'
                : 'Get AI-powered insights, plan your budget, analyze competitors and make smarter decisions — all in one place.'}
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 bg-[#FF2638] hover:bg-[#ff3b4b] text-white text-base font-semibold px-7 py-3.5 rounded-full transition-all duration-200 shadow-glow hover:shadow-glowSm hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>{isTamil ? 'தொடங்குங்கள்' : 'Get Started'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <a
                href="#features"
                className="inline-flex items-center gap-2 bg-[#111418] hover:bg-[#1B1F24] border border-[#262B33] text-white text-base font-medium px-6 py-3.5 rounded-full transition-all duration-200"
              >
                <span>{isTamil ? 'மேலும் அறிக' : 'Learn More'}</span>
                <ArrowRight className="w-4 h-4 text-[#A5ABB4]" />
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4 pt-4 border-t border-[#1B1F24]">
              {/* Overlapping avatars */}
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-rose-600 border-2 border-[#050607] flex items-center justify-center text-xs font-bold text-white">
                  SK
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-red-600 border-2 border-[#050607] flex items-center justify-center text-xs font-bold text-white">
                  AR
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-[#050607] flex items-center justify-center text-xs font-bold text-white">
                  PV
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 border-2 border-[#050607] flex items-center justify-center text-xs font-bold text-white">
                  MK
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <div className="text-xs text-[#A5ABB4] font-medium">
                  {isTamil ? 'ஆரம்பநிலை தொழில்முனைவோருக்காக வடிவமைக்கப்பட்டது' : 'Designed for aspiring entrepreneurs'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
