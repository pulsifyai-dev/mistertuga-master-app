'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar as CalendarIcon, X } from 'lucide-react';
import type { Order, DateFilterState } from '../types';
import { MONTHS, DAYS, YEARS, pad } from '../types';

interface OrderFiltersProps {
  // Tab state
  orderTab: 'pending' | 'shipped';
  pendingCount: number;
  shippedCount: number;
  onTabChange: (tab: 'pending' | 'shipped') => void;

  // Search
  searchQuery: string;
  searchMatches: Order[];
  onSearchChange: (query: string) => void;
  onSelectSearchResult: (orderId: string) => void;
  selectedOrderIdForSearch: string | null;
  onClearSearchFilter: () => void;

  // Date filter
  startDate: DateFilterState;
  endDate: DateFilterState;
  isDateFilterOpen: boolean;
  isFilterActive: boolean;
  onStartDateChange: (date: DateFilterState) => void;
  onEndDateChange: (date: DateFilterState) => void;
  onDateFilterOpenChange: (open: boolean) => void;
  onResetDateFilter: () => void;
}

export function OrderFilters({
  orderTab,
  pendingCount,
  shippedCount,
  onTabChange,
  searchQuery,
  searchMatches,
  onSearchChange,
  onSelectSearchResult,
  selectedOrderIdForSearch,
  onClearSearchFilter,
  startDate,
  endDate,
  isDateFilterOpen,
  isFilterActive,
  onStartDateChange,
  onEndDateChange,
  onDateFilterOpenChange,
  onResetDateFilter,
}: OrderFiltersProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0 md:ml-auto">
      {/* Tabs */}
      <div className="inline-flex items-center rounded-full bg-black/40 p-1 border border-white/5">
        <Button
          size="sm"
          onClick={() => onTabChange('pending')}
          className={`h-8 rounded-full px-4 text-xs transition-colors ${
            orderTab === 'pending'
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white'
          }`}
        >
          Pending ({pendingCount})
        </Button>
        <Button
          size="sm"
          onClick={() => onTabChange('shipped')}
          className={`h-8 rounded-full px-4 text-xs transition-colors ${
            orderTab === 'shipped'
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white'
          }`}
        >
          Shipped ({shippedCount})
        </Button>
      </div>

      {/* Active search filter badge */}
      {selectedOrderIdForSearch && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-4 text-xs bg-purple-600 text-white border-purple-600 hover:bg-purple-500 hover:text-white active:bg-purple-700 active:scale-[0.98] transition-none"
          onClick={onClearSearchFilter}
        >
          <X className="h-3.5 w-3.5 mr-2" />
          Showing: {selectedOrderIdForSearch}
        </Button>
      )}

      <div className="flex items-center gap-2">
        {/* Date filter popover */}
        <Popover open={isDateFilterOpen} onOpenChange={onDateFilterOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 rounded-full border-white/10 ${
                isDateFilterOpen || isFilterActive
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30'
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Date Filter</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-4 bg-black/80 backdrop-blur-md border-white/10 text-white" align="end">
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold">Date Filter</h3>
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Start Date</h4>
                <div className="flex gap-2">
                  <Select value={startDate.day} onValueChange={(v) => onStartDateChange({ ...startDate, day: v })}>
                    <SelectTrigger className="w-[80px]"><SelectValue placeholder="Day" /></SelectTrigger>
                    <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d.toString()}>{pad(d)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={startDate.month} onValueChange={(v) => onStartDateChange({ ...startDate, month: v })}>
                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={startDate.year} onValueChange={(v) => onStartDateChange({ ...startDate, year: v })}>
                    <SelectTrigger className="w-[80px]"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium leading-none">End Date</h4>
                <div className="flex gap-2">
                  <Select value={endDate.day} onValueChange={(v) => onEndDateChange({ ...endDate, day: v })}>
                    <SelectTrigger className="w-[80px]"><SelectValue placeholder="Day" /></SelectTrigger>
                    <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d.toString()}>{pad(d)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={endDate.month} onValueChange={(v) => onEndDateChange({ ...endDate, month: v })}>
                    <SelectTrigger className="w-[100px]"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={endDate.year} onValueChange={(v) => onEndDateChange({ ...endDate, year: v })}>
                    <SelectTrigger className="w-[80px]"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <Button onClick={onResetDateFilter} variant="ghost" size="sm" className="text-xs text-white/70 hover:bg-white/10">
                  <X className="h-3 w-3 mr-1" /> Reset Filter
                </Button>
                <Button onClick={() => onDateFilterOpenChange(false)} size="sm" className="text-xs">
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search (inline, top-right area) */}
      <div className={`relative transition-all duration-200 ${isSearchExpanded ? 'w-60' : 'w-8'}`}>
        <div
          className={`flex items-center overflow-hidden rounded-full px-2 py-1 transition-all duration-200 ${
            isSearchExpanded ? 'bg-black/40 border border-white/15 justify-start' : 'bg-transparent border-transparent justify-end'
          }`}
        >
          {isSearchExpanded && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search orders…"
              className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder:text-muted-foreground pr-1"
            />
          )}
          <button
            type="button"
            onClick={() => {
              if (isSearchExpanded) {
                onSearchChange('');
                onClearSearchFilter();
              }
              setIsSearchExpanded((prev) => !prev);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30"
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Search orders</span>
          </button>
        </div>

        {/* Search dropdown */}
        {isSearchExpanded && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 top-full mt-1 w-full rounded-xl bg-black/95 border border-white/10 shadow-lg max-h-64 overflow-y-auto z-30">
            {searchMatches.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2 text-center">No orders found.</p>
            ) : (
              <div className="flex flex-col">
                {searchMatches.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs bg-transparent text-muted-foreground hover:bg-purple-500/20 hover:text-white active:bg-purple-500/30 flex items-center justify-between gap-2"
                    onClick={() => {
                      onSelectSearchResult(order.id);
                      setIsSearchExpanded(false);
                      onSearchChange('');
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-[11px]">{order.id}</span>
                      <span className="text-[11px] text-muted-foreground">{order.customer.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase">{order.countryCode}</span>
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
