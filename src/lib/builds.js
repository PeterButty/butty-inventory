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
