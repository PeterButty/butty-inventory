// Automated purchasing rules.

import { getStockStatus } from './stock';

// Steel plate is ordered as a group: when any monitored part drops to a few
// machines' worth of stock, every plate size goes on the same order.
//
// For each part matching the SKU prefix and made from plate, works out how
// many are consumed by one set of every machine that uses it, and compares
// stock against that many machine sets.
//
// The rule comes from the database, so the prefix, the trigger level and the
// supplier are all editable without touching code. The supplier is held by id
// rather than matched on the spelling of its name.
// `machine` is the machine this rule belongs to. Usage is counted against
// that machine alone — a rule for the SW150 should not have its threshold
// moved by what a different machine happens to use.
export function evaluateSteelPlateRule(products, machine, suppliers, rule) {
  const prefix = (rule.skuPrefix || '').toUpperCase();

  const monitored = prefix ? products.filter(p =>
    p.sku?.toUpperCase().startsWith(prefix) &&
    (p.rawMaterials || []).some(rm =>
      (rm.type     || '').toLowerCase().includes('plate') ||
      (rm.material || '').toLowerCase().includes('plate')
    )
  ) : [];

  const parts = monitored.map(p => {
    const comp = (machine?.components || []).find(c => c.productId === p.id);
    const qtyPerMachineSet = comp ? comp.qty : 0;
    const threshold = qtyPerMachineSet * rule.machinesWorth;
    return {
      ...p,
      qtyPerMachineSet,
      threshold,
      triggered: threshold > 0 && p.stock <= threshold,
      status: getStockStatus(p.stock, p.minStock),
    };
  });

  // Matched by id. Before migration 002 there is no id to match on, so the old
  // name match stands in, which keeps the rule working until it has been run.
  const supplier =
    suppliers.find(s => s.id === rule.supplierId) ||
    (rule.supplierId == null && rule.supplierMatch
      ? suppliers.find(s => s.name?.toLowerCase().includes(rule.supplierMatch)) || null
      : null);
  const triggered = rule.enabled !== false && parts.some(p => p.triggered);

  return { triggered, parts, supplier, rule };
}
