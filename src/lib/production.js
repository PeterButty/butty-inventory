// Process routes and work in progress.
//
// A part's route is the list of processes its drawing calls for, in order.
// A quantity sitting at a stage means "finished that step, waiting for the
// next one". Once the last step is done the pieces become finished stock,
// which is what the Machine Builder counts — so buildable never includes
// anything still on the shop floor.

export const NO_ROUTE = [];

export function routeFor(production, productId) {
  return production.routeByProduct[productId] || NO_ROUTE;
}

export function wipFor(production, productId) {
  return production.wipByProduct[productId] || {};
}

export function totalWip(production, productId) {
  return Object.values(wipFor(production, productId)).reduce((sum, n) => sum + n, 0);
}

export function stageLabel(production, stageId) {
  return production.stages.find(s => s.id === stageId)?.label || stageId;
}

// Recording work done at one stage moves pieces off the step before it and on
// to this one — or into finished stock when this is the last step on the route.
// Work at the first step has nothing to come off: those pieces are being made.
export function movementFor(route, stageId) {
  const index = route.indexOf(stageId);
  if (index === -1) return null;
  return {
    fromStage: index === 0 ? null : route[index - 1],
    toStage:   index === route.length - 1 ? null : stageId,
  };
}

// Plain words for what a batch will do, so the screen can say it before the
// button is pressed rather than after.
export function describeMovement(production, route, stageId) {
  const move = movementFor(route, stageId);
  if (!move) return null;
  const to = move.toStage ? `waiting at ${stageLabel(production, move.toStage)}` : 'finished stock';
  if (!move.fromStage) return `into ${to}`;
  return `from ${stageLabel(production, move.fromStage)} into ${to}`;
}

// How many of a part are already available to move at this step.
export function availableAt(production, productId, fromStage) {
  if (fromStage === null) return Infinity; // starting work, nothing to draw from
  return wipFor(production, productId)[fromStage] || 0;
}

// Everything sitting at a given stage, for the overview.
export function partsAtStage(production, products, stageId) {
  return products
    .map(p => ({ product: p, qty: wipFor(production, p.id)[stageId] || 0 }))
    .filter(row => row.qty > 0)
    .sort((a, b) => b.qty - a.qty);
}

export function stageTotals(production, products) {
  return production.stages.map(stage => ({
    ...stage,
    pieces: products.reduce((sum, p) => sum + (wipFor(production, p.id)[stage.id] || 0), 0),
    parts:  products.filter(p => (wipFor(production, p.id)[stage.id] || 0) > 0).length,
  }));
}
