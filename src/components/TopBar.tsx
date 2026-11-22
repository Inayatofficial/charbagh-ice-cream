import React from 'react';
import { Language } from '../types';
import { UI_COPY } from '../data/initialData';

export type AppView = 'kiosk' | 'admin' | 'setup';

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  brandTitle?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  language,
  onToggleLanguage,
  brandTitle,
}) => {
  const copy = UI_COPY[language];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-[#dbc2b0]/70 bg-[#fff8f5]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('kiosk')}
          className="font-display shrink-0 cursor-pointer text-left text-lg font-extrabold tracking-tight text-[#211a15] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d97706] sm:text-xl"
        >
          {brandTitle || copy.brand}
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="flex items-center gap-4 overflow-x-auto sm:gap-7"
        >
          <button
            type="button"
            onClick={() => onSelectView('kiosk')}
            className={`min-h-[44px] shrink-0 cursor-pointer border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#d97706] ${
              activeView === 'kiosk'
                ? 'border-[#d97706] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#211a15]'
            }`}
          >
            {copy.kioskNav}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('admin')}
            className={`min-h-[44px] shrink-0 cursor-pointer border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#d97706] ${
              activeView === 'admin'
                ? 'border-[#d97706] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#211a15]'
            }`}
          >
            {copy.adminNav}
          </button>
          <button
            type="button"
            onClick={() => onSelectView('setup')}
            className={`min-h-[44px] shrink-0 cursor-pointer border-b-2 px-1 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#d97706] ${
              activeView === 'setup'
                ? 'border-[#d97706] text-[#8d4b00]'
                : 'border-transparent text-[#554336] hover:text-[#211a15]'
            }`}
          >
            {copy.setupNav}
          </button>
        </nav>

        {/* Zone 3: Single Primary Language Switcher Action */}
        <div
          role="group"
          aria-label="Language Switcher"
          className="flex shrink-0 items-center rounded-lg bg-[#f3e6dd] p-1"
        >
          <button
            type="button"
            onClick={() => onToggleLanguage('en')}
            className={`min-h-[38px] cursor-pointer rounded-md px-3 text-xs font-bold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#d97706] ${
              language === 'en'
                ? 'bg-[#ffffff] text-[#211a15] shadow-sm'
                : 'text-[#554336] hover:text-[#211a15]'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => onToggleLanguage('ur')}
            className={`min-h-[38px] cursor-pointer rounded-md px-3 text-xs font-bold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#d97706] ${
              language === 'ur'
                ? 'bg-[#ffffff] text-[#211a15] shadow-sm'
                : 'text-[#554336] hover:text-[#211a15]'
            }`}
          >
            اردو
          </button>
        </div>
      </div>
    </header>
  );
};
