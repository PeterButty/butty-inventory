// How many of a machine can be built from what's on the shelf.

// Red below one build, amber below three, green above. Used by the summary
// cards, the machine list and the machine detail view, which previously each
// carried their own copy of this rule.
export function buildStatusColor(maxBuilds) {
  if (maxBuilds === 0) return '#FF3B3B';
  if (maxBuilds < 3)   return '#FF9500';
  return '#30D158';
}

export function componentColor(canBuild, isBottleneck) {
  if (canBuild === 0)  return '#FF3B3B';
  if (isBottleneck)    return '#FF9500';
  if (canBuild < 3)    return '#FFD60A';
  return '#30D158';
}

export function calcMachineBuilds(machine, products) {
  const components = machine.components || [];
  if (components.length === 0) return { max:0, bottlenecks:[], componentDetails:[] };

  const componentDetails = components.map(comp => {
    const prod = products.find(p => p.id === comp.productId);
    const stock = prod ? prod.stock : 0;
    // A part that is no longer in inventory blocks the build entirely.
    const canBuild = prod ? Math.floor(stock / comp.qty) : 0;
    return { ...comp, prod, stock, canBuild };
  });

  const max = Math.min(...componentDetails.map(c => c.canBuild));
  const bottlenecks = componentDetails.filter(c => c.canBuild === max);
  return { max, bottlenecks, componentDetails };
}

// The widest bar in the component breakdown, so the bars are relative to the
// best-stocked part rather than to nothing.
export function buildBarScale(componentDetails) {
  return Math.max(1, ...componentDetails.map(c => c.canBuild));
}

// Every part a machine needs, as a Map of product id → pieces for `quantity`
// machines.
//
// The SW150's list is flat: all 137 parts are named directly, including ones
// that are also components of a weldment on the same list. So where the
// machine names a part, that number is the answer — adding what is inside the
// weldments as well would count the same plate two and three times over.
// Anything reachable only inside a subassembly is still picked up, so this
// keeps working if a machine is ever entered as a proper hierarchy instead.
export function partsForMachine(machine, products, quantity = 1) {
  const byId = new Map(products.map(p => [p.id, p]));
  const totals = new Map();

  for (const comp of machine.components || []) {
    totals.set(comp.productId, (totals.get(comp.productId) || 0) + comp.qty * quantity);
  }

  const nested = new Map();
  function walk(componentList, multiplier, seen) {
    for (const comp of componentList || []) {
      const part = byId.get(comp.productId);
      if (!part) continue;
      const pieces = comp.qty * multiplier;
      nested.set(part.id, (nested.get(part.id) || 0) + pieces);
      // Guard against an assembly that somehow contains itself.
      if (part.partType === 'subassembly' && !seen.has(part.id)) {
        walk(part.bomComponents, pieces, new Set(seen).add(part.id));
      }
    }
  }
  for (const comp of machine.components || []) {
    const part = byId.get(comp.productId);
    if (part?.partType === 'subassembly') {
      walk(part.bomComponents, comp.qty * quantity, new Set([part.id]));
    }
  }

  for (const [id, qty] of nested) {
    if (!totals.has(id)) totals.set(id, qty);
  }

  return totals;
}

// Which parts must not be offered as components of `productId`, because using
// them would create a loop: the part itself, plus anything that already
// contains it at any depth.
//
// The component picker used to exclude every subassembly outright, which did
// stop loops but also meant a subassembly built from other subassemblies
// showed blank rows and could not be edited. This excludes only what actually
// would loop.
export function partsCausingLoop(productId, products) {
  const blocked = new Set([productId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of products) {
      if (blocked.has(p.id)) continue;
      if ((p.bomComponents || []).some(c => blocked.has(c.productId))) {
        blocked.add(p.id);
        grew = true;
      }
    }
  }
  return blocked;
}
