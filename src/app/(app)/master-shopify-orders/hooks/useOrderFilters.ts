'use client';

import { useState, useMemo } from 'react';
import type { Order, CountryCode, DateFilterState } from '../types';
import { MONTHS, pad, ITEMS_PER_PAGE } from '../types';

export function useOrderFilters(orders: Order[]) {
  const [activeFilter, setActiveFilter] = useState<CountryCode>('ALL');
  const [orderTab, setOrderTab] = useState<'pending' | 'shipped'>('pending');
  const [page, setPage] = useState(1);
  const [selectedOrderIdForSearch, setSelectedOrderIdForSearch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Date filter state
  const [startDate, setStartDate] = useState<DateFilterState>({ day: '', month: '', year: '' });
  const [endDate, setEndDate] = useState<DateFilterState>({ day: '', month: '', year: '' });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const isFilterActive =
    !!startDate.day && !!startDate.month && !!startDate.year &&
    !!endDate.day && !!endDate.month && !!endDate.year;

  const handleResetDateFilter = () => {
    setStartDate({ day: '', month: '', year: '' });
    setEndDate({ day: '', month: '', year: '' });
    setIsDateFilterOpen(false);
  };

  const filterOrdersByDate = (ordersToFilter: Order[]) => {
    if (!isFilterActive) return ordersToFilter;

    const startMonthIndex = MONTHS.indexOf(startDate.month) + 1;
    const endMonthIndex = MONTHS.indexOf(endDate.month) + 1;

    if (startMonthIndex <= 0 || endMonthIndex <= 0) return ordersToFilter;

    const startKey = `${startDate.year}-${pad(startMonthIndex)}-${pad(parseInt(startDate.day, 10))}`;
    const endKey = `${endDate.year}-${pad(endMonthIndex)}-${pad(parseInt(endDate.day, 10))}`;

    const normalizeOrderDate = (dateStr: string) => {
      const [datePart] = dateStr.split('|');
      const safe = datePart.trim();
      const parts = safe.split('-');
      if (parts.length !== 3) return null;
      const [y, m, d] = parts;
      return `${y}-${pad(parseInt(m, 10))}-${pad(parseInt(d, 10))}`;
    };

    return ordersToFilter.filter((o) => {
      const orderKey = normalizeOrderDate(o.date);
      if (!orderKey) return false;
      return orderKey >= startKey && orderKey <= endKey;
    });
  };

  const filteredOrders = useMemo(() => {
    const byCountry = activeFilter === 'ALL' ? orders : orders.filter((o) => o.countryCode === activeFilter);
    return filterOrdersByDate(byCountry);
  }, [orders, activeFilter, startDate, endDate]);

  const pendingCounts = useMemo(() => ({
    ALL: orders.filter((o) => o.status === 'Pending Production').length,
    PT: orders.filter((o) => o.countryCode === 'PT' && o.status === 'Pending Production').length,
    DE: orders.filter((o) => o.countryCode === 'DE' && o.status === 'Pending Production').length,
    ES: orders.filter((o) => o.countryCode === 'ES' && o.status === 'Pending Production').length,
    GB: orders.filter((o) => o.countryCode === 'GB' && o.status === 'Pending Production').length,
  }), [orders]);

  const pendingOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Pending Production' && (!o.trackingNumber || o.trackingNumber.trim() === '')),
    [filteredOrders]
  );

  const shippedOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Shipped' || (!!o.trackingNumber && o.trackingNumber.trim() !== '')),
    [filteredOrders]
  );

  const listToShow = useMemo(() => {
    let list = orderTab === 'pending' ? pendingOrders : shippedOrders;
    if (selectedOrderIdForSearch) {
      list = list.filter((o) => o.id === selectedOrderIdForSearch);
    }
    return list;
  }, [orderTab, pendingOrders, shippedOrders, selectedOrderIdForSearch]);

  const totalPages = Math.ceil(listToShow.length / ITEMS_PER_PAGE);
  const paginatedOrders = listToShow.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const searchMatches = useMemo(() => {
    if (searchQuery.trim().length === 0) return [];
    const q = searchQuery.toLowerCase();
    return filteredOrders
      .filter((o) => o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [searchQuery, filteredOrders]);

  return {
    // Filter state
    activeFilter,
    setActiveFilter,
    orderTab,
    setOrderTab,
    page,
    setPage,
    selectedOrderIdForSearch,
    setSelectedOrderIdForSearch,
    searchQuery,
    setSearchQuery,

    // Date filter
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isDateFilterOpen,
    setIsDateFilterOpen,
    isFilterActive,
    handleResetDateFilter,

    // Computed
    filteredOrders,
    pendingCounts,
    pendingOrders,
    shippedOrders,
    listToShow,
    totalPages,
    paginatedOrders,
    searchMatches,
  };
}
