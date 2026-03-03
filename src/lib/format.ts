/**
 * Shared formatting utilities.
 */

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
