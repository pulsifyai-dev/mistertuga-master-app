'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Search, X, ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXCHANGE_STATUSES, EXCHANGE_STATUS_LABELS } from '../types';
import type { Exchange, ExchangeStatus } from '../types';

type SortField = 'created_at' | 'order_number' | 'customer_name' | 'status';

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: 'created_at', label: 'Date' },
  { value: 'order_number', label: 'Order #' },
  { value: 'customer_name', label: 'Customer' },
  { value: 'status', label: 'Status' },
];

interface ExchangeFiltersProps {
  statusFilter: 'all' | ExchangeStatus;
  statusCounts: Record<string, number>;
  searchQuery: string;
  searchMatches: Exchange[];
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  onStatusChange: (status: 'all' | ExchangeStatus) => void;
  onSearchChange: (query: string) => void;
  onSelectSearchResult: (exchange: Exchange) => void;
  onSort: (field: SortField) => void;
}

export function ExchangeFilters({
  statusFilter,
  statusCounts,
  searchQuery,
  searchMatches,
  sortField,
  sortDirection,
  onStatusChange,
  onSearchChange,
  onSelectSearchResult,
  onSort,
}: ExchangeFiltersProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const allStatuses: Array<'all' | ExchangeStatus> = ['all', ...EXCHANGE_STATUSES];

  return (
    <div className="sticky top-12 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-black/40 border border-white/5 px-3 py-3 backdrop-blur-md">
      {/* Status filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {allStatuses.map((s) => {
          const label = s === 'all' ? 'All' : EXCHANGE_STATUS_LABELS[s];
          const count = statusCounts[s] ?? 0;
          const isActive = statusFilter === s;

          return (
            <Button
              key={s}
              size="sm"
              onClick={() => onStatusChange(s)}
              className={`h-8 rounded-full px-3 text-xs transition-colors ${
                isActive
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white'
              }`}
            >
              {label} ({count})
            </Button>
          );
        })}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1 ml-auto">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={sortField}
          onValueChange={(v) => onSort(v as SortField)}
        >
          <SelectTrigger className="h-8 w-28 text-xs bg-transparent border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-xs text-muted-foreground hover:text-white"
          onClick={() => onSort(sortField)}
          aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
        >
          {sortDirection === 'asc' ? '\u2191' : '\u2193'}
        </Button>
      </div>

      {/* Search */}
      <div className={`relative transition-all duration-200 ${isSearchExpanded ? 'w-60' : 'w-8'}`}>
        <div
          className={`flex items-center overflow-hidden rounded-full px-2 py-1 transition-all duration-200 ${
            isSearchExpanded
              ? 'bg-black/40 border border-white/15 justify-start'
              : 'bg-transparent border-transparent justify-end'
          }`}
        >
          {isSearchExpanded && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search exchanges..."
              className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder:text-muted-foreground pr-1"
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (isSearchExpanded) {
                onSearchChange('');
              }
              setIsSearchExpanded((prev) => !prev);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
          >
            {isSearchExpanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            <span className="sr-only">Search exchanges</span>
          </button>
        </div>

        {/* Search dropdown */}
        {isSearchExpanded && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 top-full mt-1 w-full rounded-xl bg-black/95 border border-white/10 shadow-lg max-h-64 overflow-y-auto z-30">
            {searchMatches.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">No exchanges found.</p>
            ) : (
              <div className="flex flex-col">
                {searchMatches.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30 flex items-center justify-between gap-2"
                    onClick={() => {
                      onSelectSearchResult(ex);
                      setIsSearchExpanded(false);
                      onSearchChange('');
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-[11px]">{ex.order_number || 'No Order #'}</span>
                      <span className="text-[11px] text-muted-foreground">{ex.customer_name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase">{ex.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
