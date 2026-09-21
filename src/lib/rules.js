// Automated purchasing rules.

import { getStockStatus } from './stock';
import { STEEL_PLATE_RULE } from './materials';

// Steel plate is ordered as a group: when any monitored part drops to a few
// machines' worth of stock, every plate size goes on the same order.
//
// For each part matching the SKU prefix and made from plate, works out how
// many are consumed by one set of every machine that uses it, and compares
// stock against that many machine sets.
export function evaluateSteelPlateRule(products, machines, suppliers, rule = STEEL_PLATE_RULE) {
  const prefix = rule.skuPrefix.toUpperCase();

  const monitored = products.filter(p =>
    p.sku?.toUpperCase().startsWith(prefix) &&
    (p.rawMaterials || []).some(rm =>
      (rm.type     || '').toLowerCase().includes('plate') ||
      (rm.material || '').toLowerCase().includes('plate')
    )
  );

  const parts = monitored.map(p => {
    const qtyPerMachineSet = machines.reduce((total, m) => {
      const comp = m.components.find(c => c.productId === p.id);
      return total + (comp ? comp.qty : 0);
    }, 0);
    const threshold = qtyPerMachineSet * rule.machinesWorth;
    return {
      ...p,
      qtyPerMachineSet,
      threshold,
      triggered: threshold > 0 && p.stock <= threshold,
      status: getStockStatus(p.stock, p.minStock),
    };
  });

  const supplier = suppliers.find(s =>
    s.name?.toLowerCase().includes(rule.supplierMatch)
  ) || null;

  return { triggered: parts.some(p => p.triggered), parts, supplier, rule };
}
