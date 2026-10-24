import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, ArrowRight, Menu, X } from 'lucide-react';
import { translations } from '../data/translations';
import type { Language } from '../data/translations';

interface NavbarProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenDashboard: () => void;
}

const NAV_ITEMS = [
  { id: 'home', href: '#home' },
  { id: 'features', href: '#features' },
  { id: 'how-it-works', href: '#how-it-works' },
  { id: 'about', href: '#about' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({
  language,
  onLanguageChange,
  onOpenDashboard,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('home');
  const t = translations[language].nav;

  // Scroll shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Active section tracking via IntersectionObserver
  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id);
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Smooth scroll on click
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      setActiveSection(id);
      setMobileMenuOpen(false);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    []
  );

  const navLinkClass = (id: string) => {
    const isActive = activeSection === id;
    return `text-sm font-medium transition-colors relative py-1 ${
      isActive
        ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#FF2638] after:rounded-full after:opacity-100'
        : 'text-[#A5ABB4] hover:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#FF2638] after:rounded-full after:opacity-0 hover:after:opacity-30 after:transition-opacity'
    }`;
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#050607]/90 backdrop-blur-md border-b border-[#1B1F24] py-3.5 shadow-lg'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, 'home')}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF2638] to-[#A10F20] flex items-center justify-center shadow-glowSm group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Demand<span className="text-[#FF2638]">Wise</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#home"
              onClick={(e) => handleNavClick(e, 'home')}
              className={navLinkClass('home')}
            >
              {t.home}
            </a>
            <a
              href="#features"
              onClick={(e) => handleNavClick(e, 'features')}
              className={navLinkClass('features')}
            >
              {t.features}
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, 'how-it-works')}
              className={navLinkClass('how-it-works')}
            >
              {t.howItWorks}
            </a>
            <a
              href="#about"
              onClick={(e) => handleNavClick(e, 'about')}
              className={navLinkClass('about')}
            >
              {t.about}
            </a>
          </div>

          {/* Right actions: Language toggle + Get Started button */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language toggle */}
            <div className="bg-[#111418] border border-[#262B33] rounded-full p-1 flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => onLanguageChange('en')}
                className={`px-3 py-1 rounded-full transition-all ${
                  language === 'en'
                    ? 'bg-[#FF2638] text-white shadow-sm'
                    : 'text-[#A5ABB4] hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onLanguageChange('ta')}
                className={`px-3 py-1 rounded-full transition-all ${
                  language === 'ta'
                    ? 'bg-[#FF2638] text-white shadow-sm'
                    : 'text-[#A5ABB4] hover:text-white'
                }`}
              >
                தமிழ்
              </button>
            </div>

            {/* Get Started Button */}
            <button
              onClick={onOpenDashboard}
              className="inline-flex items-center gap-2 bg-[#FF2638] hover:bg-[#ff3b4b] text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200 shadow-glowSm hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>{t.getStarted}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <div className="bg-[#111418] border border-[#262B33] rounded-full p-1 flex items-center text-xs font-semibold mr-1">
              <button
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-0.5 rounded-full ${
                  language === 'en' ? 'bg-[#FF2638] text-white' : 'text-[#A5ABB4]'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => onLanguageChange('ta')}
                className={`px-2 py-0.5 rounded-full ${
                  language === 'ta' ? 'bg-[#FF2638] text-white' : 'text-[#A5ABB4]'
                }`}
              >
                தமிழ்
              </button>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#111418] border border-[#262B33] text-[#A5ABB4] hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0D0F12] border-b border-[#262B33] px-4 pt-3 pb-6 space-y-3">
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, 'home')}
            className={`block text-base font-medium ${
              activeSection === 'home' ? 'text-[#FF2638]' : 'text-[#A5ABB4] hover:text-white'
            }`}
          >
            {t.home}
          </a>
          <a
            href="#features"
            onClick={(e) => handleNavClick(e, 'features')}
            className={`block text-base font-medium ${
              activeSection === 'features' ? 'text-[#FF2638]' : 'text-[#A5ABB4] hover:text-white'
            }`}
          >
            {t.features}
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => handleNavClick(e, 'how-it-works')}
            className={`block text-base font-medium ${
              activeSection === 'how-it-works' ? 'text-[#FF2638]' : 'text-[#A5ABB4] hover:text-white'
            }`}
          >
            {t.howItWorks}
          </a>
          <a
            href="#about"
            onClick={(e) => handleNavClick(e, 'about')}
            className={`block text-base font-medium ${
              activeSection === 'about' ? 'text-[#FF2638]' : 'text-[#A5ABB4] hover:text-white'
            }`}
          >
            {t.about}
          </a>
          <div className="pt-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenDashboard();
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#FF2638] text-white font-semibold py-3 rounded-full shadow-glowSm"
            >
              <span>{t.getStarted}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
