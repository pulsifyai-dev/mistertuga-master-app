'use client';

import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { FlagPT, FlagDE, FlagES, FlagUK } from './CountryFlags';
import type { CountryCode } from '../types';

interface CountryTabsProps {
  activeFilter: CountryCode;
  pendingCounts: Record<CountryCode, number>;
  onFilterChange: (filter: CountryCode) => void;
}

const countries: { code: CountryCode; label: string; flag: React.ReactNode }[] = [
  { code: 'ALL', label: 'ALL', flag: <Globe className="h-3.5 w-3.5" /> },
  { code: 'PT', label: 'Portugal', flag: <FlagPT /> },
  { code: 'GB', label: 'UK', flag: <FlagUK /> },
  { code: 'DE', label: 'Germany', flag: <FlagDE /> },
  { code: 'ES', label: 'Spain', flag: <FlagES /> },
];

export function CountryTabs({ activeFilter, pendingCounts, onFilterChange }: CountryTabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {countries.map(({ code, label, flag }) => (
        <Button
          key={code}
          variant={activeFilter === code ? 'default' : 'outline'}
          onClick={() => onFilterChange(code)}
          className={`
            h-8 rounded-full text-xs px-3 border-white/10 flex items-center gap-1.5
            ${activeFilter === code
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
            }
          `}
        >
          {flag}
          <span>{label}</span>
          {pendingCounts[code] > 0 && activeFilter !== code && (
            <span className="ml-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {pendingCounts[code]}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
}
