import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Cpu,
  TrendingUp,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import { translations } from '../data/translations';
import type { Language } from '../data/translations';

interface HowItWorksProps {
  language: Language;
}

const stepIcons = [FileText, Cpu, TrendingUp, Rocket];

export const HowItWorks: React.FC<HowItWorksProps> = ({ language }) => {
  const t = translations[language].howItWorks;

  return (
    <section id="how-it-works" className="py-24 bg-[#08090C] border-t border-[#1B1F24] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B1F24] border border-[#262B33] text-[#FF2638] text-xs font-bold tracking-wider uppercase mb-4">
            <span>{t.tag}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4">
            {t.headingPart1}
            <span className="text-[#FF2638]">{t.headingHighlight}</span>
          </h2>
          <p className="text-base sm:text-lg text-[#A5ABB4]">
            {t.description}
          </p>
        </div>

        {/* 4 Steps Row with Connecting Line/Arrows */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {t.steps.map((step: { step: string; title: string; desc: string }, idx: number) => {
            const Icon = stepIcons[idx];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.12 }}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Step Icon in Glowing Circle */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#111418] border border-[#262B33] group-hover:border-[#FF2638] flex items-center justify-center text-[#FF2638] transition-all duration-300 group-hover:shadow-glowSm group-hover:-translate-y-1">
                    <Icon className="w-7 h-7" />
                  </div>
                  {/* Step Number Tag */}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#FF2638] text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {idx + 1}
                  </span>
                </div>

                {/* Arrow to next item (desktop only) */}
                {idx < 3 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+45px)] w-[calc(100%-90px)] text-[#262B33] group-hover:text-[#FF2638]/60 transition-colors">
                    <div className="flex items-center justify-center">
                      <div className="h-0.5 w-full bg-current opacity-40" />
                      <ArrowRight className="w-4 h-4 -ml-1 text-current opacity-70" />
                    </div>
                  </div>
                )}

                {/* Step Details */}
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#FF2638] transition-colors">
                  {step.title}
                </h3>
                <p className="text-sm text-[#A5ABB4] leading-relaxed max-w-xs">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
