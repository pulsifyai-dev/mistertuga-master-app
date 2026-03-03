'use client';

const statusColors: Record<string, string> = {
  'Pending Production': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Shipped': 'bg-green-500/20 text-green-400 border-green-500/30',
};

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const colorClass = statusColors[status] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}>
      {status}
    </span>
  );
}
