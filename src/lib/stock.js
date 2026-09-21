// Stock levels, the colours that go with them, and table sorting.

export function getStockStatus(stock, minStock) {
  if (stock === 0) return 'out';
  if (stock < minStock) return 'low';
  if (stock < minStock * 1.5) return 'warning';
  return 'ok';
}

export const STATUS_META = {
  out:     { label:'Out of Stock', color:'#FF3B3B', bg:'rgba(255,59,59,0.12)',  dot:'#FF3B3B' },
  low:     { label:'Low Stock',    color:'#FF9500', bg:'rgba(255,149,0,0.12)',  dot:'#FF9500' },
  warning: { label:'Watch',        color:'#FFD60A', bg:'rgba(255,214,10,0.12)', dot:'#FFD60A' },
  ok:      { label:'In Stock',     color:'#30D158', bg:'rgba(48,209,88,0.12)',  dot:'#30D158' },
};

export const STATUS_ORDER = ['ok', 'warning', 'low', 'out'];

// "Needs ordering" — out of stock or below minimum. The single definition of
// this, used by the alert banner, the reorder button, the supplier cards and
// the order-email builders alike.
export function needsReorder(product) {
  return ['out', 'low'].includes(getStockStatus(product.stock, product.minStock));
}

export function lowStockProducts(products) {
  return products.filter(needsReorder);
}

// How full a bin is relative to twice its minimum, for the little bar in the
// stock column. Guards against a minimum of zero, which would otherwise
// produce a nonsense width.
export function stockBarPercent(stock, minStock) {
  if (!minStock) return stock > 0 ? 100 : 0;
  return Math.min(100, Math.round((stock / (minStock * 2)) * 100));
}

// ── Sorting ──────────────────────────────────────────────────────────────────
// Cells are routinely blank — imported parts have no location yet — so nothing
// here assumes a value is present.

export function isBlankCell(v) {
  return v === null || v === undefined || v === '';
}

// Numbers compare numerically; everything else compares as text with natural
// number ordering, so S15-03-2 sorts before S15-03-10.
export function compareCells(av, bv) {
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows(rows, sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    // Blanks always sink to the bottom, whichever way the column is sorted.
    const aBlank = isBlankCell(av), bBlank = isBlankCell(bv);
    if (aBlank || bBlank) return aBlank && bBlank ? 0 : aBlank ? 1 : -1;
    return dir * compareCells(av, bv);
  });
}
