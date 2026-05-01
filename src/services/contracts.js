// Helper functions for customer contracts and calculations
// All calculation logic, separated from UI

import { CUSTOMERS_DATA } from '../data/customers';

export const TARGET_THRESHOLD = 80;
export const DEFAULT_TOTAL_SHELF = 1;

export function contractLabel(source) {
  const value = String(source || '').toLowerCase();
  return value.includes('impulse') ? 'Impulse — نسبة المساحات' : 'DRY — نسبة المساحات';
}

export function actualKey(source, name) {
  return `${source || 'DRY'}__${name}`;
}

export function isSameCustomer(a, b) {
  if (!a || !b) return false;
  // If both have a real code, match strictly by code only.
  // The customer code is unique per branch in the Excel data, so
  // matching by code is the most reliable identifier.
  const aHasCode = a.code && a.code !== '-';
  const bHasCode = b.code && b.code !== '-';
  if (aHasCode && bHasCode) return a.code === b.code;
  // Fallback for entries without a code: name + address must match exactly
  if (!aHasCode && !bHasCode) {
    return a.name === b.name && a.address === b.address;
  }
  return false;
}

export function getContracts(customer) {
  if (!customer) return [];
  const matches = CUSTOMERS_DATA.filter((c) => isSameCustomer(customer, c));

  // Dedup at the contract level (keep one per source: DRY / Impulse).
  // Even if the data contains duplicate rows for the same customer+source,
  // we only render each contract type once.
  const seenSource = new Set();
  return matches.filter((c) => {
    const src = c.source || 'DRY';
    if (seenSource.has(src)) return false;
    seenSource.add(src);
    return true;
  });
}

export function isPercentCategory(cat) {
  return cat?.type !== 'check' && Number.isFinite(Number(cat?.target));
}

export function targetText(cat) {
  return isPercentCategory(cat)
    ? (Number(cat.target) * 100).toFixed(0) + '%'
    : (cat.targetText || 'مطلوب تطبيق');
}

export function rowsFromContracts(contracts, actuals) {
  const rows = [];
  contracts.forEach((contract) => {
    contract.categories.forEach((cat) => {
      const key = actualKey(contract.source, cat.name);
      const isPercent = isPercentCategory(cat);
      const entry = actuals[key] || (isPercent ? { actual: 0, total: DEFAULT_TOTAL_SHELF } : { applied: false });

      if (isPercent) {
        const actualSpace = Number(entry.actual) || 0;
        const totalShelf = Number(entry.total) || 0;
        const targetPct = Number(cat.target) * 100;
        const actualPct = totalShelf > 0 ? (actualSpace / totalShelf) * 100 : 0;
        const achievement = targetPct > 0 ? (actualPct / targetPct) * 100 : 0;
        rows.push({
          key, type: 'percent', source: contract.source || 'DRY',
          section: contractLabel(contract.source), name: cat.name,
          targetPct, targetLabel: targetText(cat),
          actualSpace, totalShelf, actualPct, achievement,
          achieved: achievement >= TARGET_THRESHOLD,
        });
      } else {
        const applied = !!entry.applied;
        rows.push({
          key, type: 'check', source: contract.source || 'Impulse',
          section: contractLabel(contract.source), name: cat.name,
          targetPct: 100, targetLabel: targetText(cat),
          applied, actualSpace: applied ? 1 : 0, totalShelf: 1,
          actualPct: applied ? 100 : 0, achievement: applied ? 100 : 0,
          achieved: applied,
        });
      }
    });
  });
  return rows;
}

export function summarize(rows) {
  let totalWeight = 0, weightedSum = 0;
  rows.forEach((r) => {
    totalWeight += r.targetPct || 100;
    weightedSum += Math.min(r.achievement, 100) * (r.targetPct || 100);
  });
  return {
    rows,
    weightedAvg: totalWeight ? weightedSum / totalWeight : 0,
    simpleAvg: rows.length ? rows.reduce((s, r) => s + Math.min(r.achievement, 100), 0) / rows.length : 0,
    achievedCount: rows.filter((r) => r.achievement >= TARGET_THRESHOLD).length,
  };
}

export function initialActuals(customer) {
  const init = {};
  getContracts(customer).forEach((contract) => {
    contract.categories.forEach((cat) => {
      init[actualKey(contract.source, cat.name)] = isPercentCategory(cat)
        ? { actual: 0, total: DEFAULT_TOTAL_SHELF }
        : { applied: false };
    });
  });
  return init;
}

export function colorFor(pct) {
  return pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'bad';
}
