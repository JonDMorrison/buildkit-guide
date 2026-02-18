/**
 * Locale-aware formatting utilities for currency, numbers, and percentages.
 */

export const formatCurrency = (amount: number, currency = 'CAD'): string => {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  // Always append currency code for clarity: "$12,340.00 CAD"
  return `${formatted} ${currency}`;
};

export const formatNumber = (n: number): string => {
  return new Intl.NumberFormat('en-US').format(n);
};

export const formatPercent = (n: number, decimals = 1): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n / 100);
};

export const formatCompactNumber = (n: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
};
