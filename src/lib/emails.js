// Purchase order emails.

import { needsReorder } from './stock';
import { STEEL_PLATE_ORDER } from './materials';

function today() {
  return new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

// The one copy of the letter. Both the low-stock reorder and the steel plate
// order are the same letter with a different list in the middle.
function composeLetter(intro, orderLines) {
  return `Hello,

${intro}

${orderLines.join('\n')}

Please confirm receipt and advise the expected delivery date at your earliest convenience. If you have any questions please do not hesitate to get in touch.

Thanks,
Butty Manufacturing
Purchasing Department`;
}

function formatQty(qty) {
  return qty % 1 === 0 ? qty : qty.toFixed(2);
}

// Rolls the raw materials for every made-in-house part up into one line per
// material, so a supplier gets "20 kg mild steel sheet" rather than the same
// material repeated once per part.
function rollUpRawMaterials(madeInHouse) {
  const rawMap = new Map();
  madeInHouse.forEach(p => {
    const reorderQty = p.reorderQty || p.minStock || 1;
    const batchSize  = p.batchSize || 1;
    const batches    = Math.ceil(reorderQty / batchSize);
    (p.rawMaterials || []).forEach(rm => {
      const key = `${rm.material}|${rm.type}|${rm.size}|${rm.unit}`;
      const qty = (parseFloat(rm.qtyPerBatch) || 0) * batches;
      if (rawMap.has(key)) {
        rawMap.get(key).qty += qty;
        rawMap.get(key).skus.add(p.sku);
      } else {
        rawMap.set(key, { material:rm.material, type:rm.type, size:rm.size, unit:rm.unit, qty, skus:new Set([p.sku]) });
      }
    });
  });
  return Array.from(rawMap.values());
}

function describeMaterial(rm) {
  return [rm.material, rm.type, rm.size].filter(Boolean).join(', ');
}

export function generateEmailDraft(supplier, lowProducts) {
  const purchased = lowProducts.filter(p => p.partType === 'purchased');
  const rawTotals = rollUpRawMaterials(lowProducts.filter(p => p.partType === 'made'));

  const orderLines = [
    ...purchased.map(p => `  ${p.name} — ${p.reorderQty || p.minStock} ${p.unit || 'pcs'} (PO: ${p.sku})`),
    ...rawTotals.map(rm => `  ${describeMaterial(rm)} — ${formatQty(rm.qty)} ${rm.unit} (PO: ${Array.from(rm.skus).join(', ')})`),
  ];

  const items = [
    ...purchased.map(p => ({ label:`${p.name} (${p.sku})`, detail:`${p.reorderQty || p.minStock} ${p.unit || 'pcs'}`, isRaw:false })),
    ...rawTotals.map(rm => ({ label:describeMaterial(rm), detail:`${formatQty(rm.qty)} ${rm.unit}`, isRaw:true })),
  ];

  return {
    supplier,
    items,
    subject: `Purchase Order Request — ${today()}`,
    body: composeLetter('I would like to order the following', orderLines),
  };
}

export function generateSteelPlateDraft(supplier, order = STEEL_PLATE_ORDER) {
  return {
    supplier,
    items: order.map(i => ({ label:i.desc, detail:`${i.qty}x`, isRaw:true })),
    subject: `Steel Plate Purchase Order — ${today()}`,
    body: composeLetter(
      'Please find below our steel plate order requirements:',
      order.map(i => `  (${i.qty}x)  ${i.desc}`)
    ),
  };
}

// Groups everything that needs ordering by supplier, one draft each.
// Returns the drafts plus anything that has no supplier to send it to.
export function groupLowStockBySupplier(products, supplierForProduct) {
  const low = products.filter(needsReorder);
  const bySupplier = new Map();
  const orphans = [];

  low.forEach(p => {
    const sup = supplierForProduct(p.id);
    if (!sup) { orphans.push(p); return; }
    if (!bySupplier.has(sup.id)) bySupplier.set(sup.id, { supplier:sup, products:[] });
    bySupplier.get(sup.id).products.push(p);
  });

  return {
    low,
    orphans,
    drafts: Array.from(bySupplier.values()).map(({ supplier, products:prods }) => generateEmailDraft(supplier, prods)),
  };
}

export function emailToClipboardText(draft) {
  return `To: ${draft.supplier.email}\nSubject: ${draft.subject}\n\n${draft.body}`;
}

export function mailtoUrl(draft) {
  return `mailto:${draft.supplier.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
