import React, { useState } from 'react';
import { IceCreamCone, Plus } from 'lucide-react';
import { Language, MenuItem } from '../types';
import { UI_COPY } from '../data/initialData';

interface MenuCardProps {
  item: MenuItem;
  language: Language;
  inCartCount: number;
  onSelect: (item: MenuItem) => void;
}

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  language,
  inCartCount,
  onSelect,
}) => {
  const [imgError, setImgError] = useState(false);
  const isSoldOut = item.status === 'Sold Out';
  const copy = UI_COPY[language];

  return (
    <article
      onClick={() => {
        if (!isSoldOut) onSelect(item);
      }}
      role="button"
      tabIndex={isSoldOut ? -1 : 0}
      aria-disabled={isSoldOut}
      onKeyDown={(e) => {
        if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d97706] ${
        isSoldOut
          ? 'cursor-not-allowed border-[#dbc2b0]/50 bg-[#f9ebe3]/60 opacity-75'
          : inCartCount > 0
            ? 'cursor-pointer border-2 border-[#d97706] bg-[#fffbeb] shadow-[0_12px_28px_-6px_rgba(217,119,6,0.18)]'
            : 'cursor-pointer border-[#211a15]/10 bg-white shadow-[0_4px_16px_-2px_rgba(41,34,29,0.06)] hover:-translate-y-0.5 hover:border-[#d97706]/50 hover:shadow-[0_10px_24px_-4px_rgba(41,34,29,0.12)] active:scale-[0.99]'
      }`}
    >
      {/* 1:1 Studio Product Photography Slot */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#f3e6dd]">
        {!imgError && item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`h-full w-full object-cover transition-transform duration-300 ${
              isSoldOut ? 'grayscale' : 'group-hover:scale-[1.03]'
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#f9ebe3] via-[#f3e6dd] to-[#e5d7cf] p-4 text-center">
            <IceCreamCone className="mb-2 h-12 w-12 text-[#8d4b00]/70" />
            <span className="font-display text-sm font-bold text-[#554336]">{item.name}</span>
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#211a15]/55 backdrop-blur-[2px]">
            <span className="font-display rounded-lg bg-[#fff8f5] px-4 py-2 text-sm font-bold tracking-wide text-[#ba1a1a] shadow-sm">
              {copy.soldOut}
            </span>
          </div>
        )}

        {!isSoldOut && inCartCount > 0 && (
          <div
            aria-label={`${inCartCount} in cart`}
            className="tabular-nums absolute top-3 right-3 flex h-9 min-w-[36px] items-center justify-center rounded-full bg-[#d97706] px-2.5 text-sm font-bold text-white shadow-md"
          >
            {inCartCount}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
        <div>
          {/* Unboxed clean metadata line (zero pill boxes) */}
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#554336]">
            <span>{item.category}</span>
            {item.tag && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#2d6a4f]">{item.tag}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className={isSoldOut ? 'text-[#ba1a1a]' : 'text-[#2d6a4f]'}>
              {isSoldOut ? copy.soldOut : copy.inStock}
            </span>
          </div>

          {/* Bilingual Title Stack */}
          <h3 className="font-display text-lg font-bold leading-snug text-[#211a15] sm:text-xl">
            {language === 'ur' && item.nameUrdu ? item.nameUrdu : item.name}
          </h3>
          <p
            dir={language === 'ur' ? 'ltr' : 'rtl'}
            className={`mt-0.5 text-sm font-medium text-[#8d4b00] ${
              language === 'ur' ? '' : 'font-urdu text-right text-base'
            }`}
          >
            {language === 'ur' ? item.name : item.nameUrdu}
          </p>

          <p
            dir={language === 'ur' ? 'rtl' : 'ltr'}
            className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#554336]"
          >
            {language === 'ur' && item.descriptionUrdu ? item.descriptionUrdu : item.description}
          </p>
        </div>

        {/* Fixed Bottom Pricing & Selection Row */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#211a15]/8 pt-3.5">
          <div className="tabular-nums">
            <span className="text-xs font-semibold text-[#554336]">PKR </span>
            <span className="font-display text-xl font-extrabold text-[#211a15]">
              {item.price.toLocaleString()}
            </span>
          </div>

          <span
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap shrink-0 transition-colors ${
              isSoldOut
                ? 'bg-[#e5d7cf] text-[#554336]'
                : 'bg-[#d97706] text-white group-hover:bg-[#b15f00]'
            }`}
          >
            {!isSoldOut && <Plus className="h-4 w-4" />}
            {isSoldOut ? copy.soldOut : copy.customize}
          </span>
        </div>
      </div>
    </article>
  );
};
