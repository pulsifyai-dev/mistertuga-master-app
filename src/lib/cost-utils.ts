/**
 * Shared cost utility functions — safe for both client and server use.
 * Extracted from cost-engine.ts to avoid pulling in server-only imports.
 */

export type RateTier = {
  min_qty: number;
  max_qty: number;
  rate: number;
};

/**
 * Find the applicable rate for a given quantity from rate tiers.
 * Falls back to base_rate if no tier matches.
 */
export function findTierRate(
  tiers: RateTier[] | null,
  baseRate: number | null,
  quantity: number
): number {
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    for (const tier of sorted) {
      if (quantity >= tier.min_qty && quantity <= tier.max_qty) {
        return tier.rate;
      }
    }
    // If quantity exceeds all tiers, use the last (highest) tier
    const lastTier = sorted[sorted.length - 1];
    if (quantity > lastTier.max_qty) {
      return lastTier.rate;
    }
  }
  return baseRate ?? 0;
}
