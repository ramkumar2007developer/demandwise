import React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  Users,
  Wallet,
  MapPin,
  Cpu,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { translations } from '../data/translations';
import type { Language } from '../data/translations';

interface FeaturesProps {
  language: Language;
  onExploreClick: () => void;
}

const icons = [TrendingUp, Users, Wallet, MapPin, Cpu, FileText];

export const Features: React.FC<FeaturesProps> = ({ language, onExploreClick }) => {
  const t = translations[language].features;

  return (
    <section id="features" className="py-24 bg-[#050607] relative">
      {/* Background subtle light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#FF2638]/5 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
          {/* Header left */}
          <div className="lg:col-span-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1F24] border border-[#262B33] text-[#FF2638] text-xs font-bold tracking-wider uppercase mb-4">
              <span>{t.tag}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-4">
              {t.headingPart1}
              <span className="text-[#FF2638]">{t.headingHighlight}</span>
            </h2>
            <p className="text-base sm:text-lg text-[#A5ABB4] max-w-2xl">
              {t.description}
            </p>
          </div>

          {/* Action right */}
          <div className="lg:col-span-4 flex lg:justify-end items-end h-full">
            <button
              onClick={onExploreClick}
              className="inline-flex items-center gap-2 bg-[#111418] hover:bg-[#1B1F24] border border-[#262B33] hover:border-[#FF2638]/50 text-white font-medium text-sm px-6 py-3 rounded-full transition-all duration-200 group"
            >
              <span>{t.exploreBtn}</span>
              <ArrowRight className="w-4 h-4 text-[#FF2638] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* 6 Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.cards.map((card: { title: string; desc: string }, idx: number) => {
            const Icon = icons[idx];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
                className="bg-[#111418] border border-[#262B33] hover:border-[#FF2638]/50 rounded-2xl p-6 sm:p-7 transition-all duration-300 hover:shadow-glowSm hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 rounded-xl bg-[#1B1F24] border border-[#262B33] flex items-center justify-center text-[#FF2638] mb-5 group-hover:scale-110 group-hover:bg-[#FF2638] group-hover:text-white transition-all duration-300">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#FF2638] transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-[#A5ABB4] leading-relaxed">
                  {card.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
