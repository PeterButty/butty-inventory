// Everything that talks to Supabase. Screens call these rather than issuing
// queries themselves, so the database shape is described in exactly one place.

import { supabase } from '../supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ── Database row → app shape ─────────────────────────────────────────────────
export function dbProduct(r) {
  return {
    id: r.id, sku: r.sku, name: r.name, category: r.category,
    stock: r.stock, minStock: r.min_stock, reorderQty: r.reorder_qty || 0,
    unit: r.unit, location: r.location, imageUrl: r.image_url,
    supplierId: r.supplier_id || null, partType: r.part_type || 'purchased',
    rawMaterials: r.raw_materials || [], bomComponents: r.bom_components || [],
    batchSize: r.batch_size || 0, leadTimeDays: r.lead_time_days || 0,
  };
}

export function dbMachine(r) {
  return {
    id: r.id, name: r.name, description: r.description, imageUrl: r.image_url,
    runSize: r.run_size ?? 20,
    components: (r.machine_components || []).map(c => ({
      productId: c.product_id, qty: c.qty, note: c.note || '',
    })),
  };
}

export function dbSupplier(r) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone || '',
    contact: r.contact, notes: r.notes || '',
    products: (r.supplier_products || []).map(sp => sp.product_id),
  };
}

// ── App shape → database row ─────────────────────────────────────────────────
export function productPayload(form, id, imageUrl) {
  return {
    id,
    sku: form.sku, name: form.name, category: form.category,
    stock: parseInt(form.stock) || 0,
    min_stock: parseInt(form.minStock) || 0,
    reorder_qty: parseInt(form.reorderQty) || 0,
    unit: form.unit || 'pcs',
    location: form.location,
    image_url: imageUrl,
    supplier_id: form.supplierId || null,
    part_type: form.partType || 'purchased',
    raw_materials: form.partType === 'made' ? (form.rawMaterials || []) : [],
    bom_components: form.partType === 'subassembly' ? (form.bomComponents || []) : [],
    batch_size: parseInt(form.batchSize) || 0,
    lead_time_days: parseInt(form.leadTimeDays) || 0,
  };
}

// ── Loading ──────────────────────────────────────────────────────────────────
export async function loadEverything() {
  const [pRes, mRes, sRes] = await Promise.all([
    supabase.from('products').select('*').order('name'),
    supabase.from('machines').select('*, machine_components(*)').order('name'),
    supabase.from('suppliers').select('*, supplier_products(product_id)').order('name'),
  ]);

  return {
    products:  pRes.error ? [] : pRes.data.map(dbProduct),
    // Machines and suppliers may not exist yet on a database where the later
    // migrations have not been run; an empty list is the right answer there.
    machines:  mRes.error ? [] : mRes.data.map(dbMachine),
    suppliers: sRes.error ? [] : sRes.data.map(dbSupplier),
    error: pRes.error || null,
  };
}

// ── Stock movements ──────────────────────────────────────────────────────────
// Every stock change goes through the database's apply_stock_deltas function,
// which applies the whole list in one transaction. Either all the movements
// land or none do, so a build can never half-deduct; and because the database
// adds the delta to whatever the current count is, two people working at the
// same time add up instead of overwriting each other.
// Returns an error to report, or null on success.
export async function applyStockDeltas(deltas) {
  const { error } = await supabase.rpc('apply_stock_deltas', { p_deltas: deltas });
  if (!error) return null;
  if (error.code === 'PGRST202' || error.code === '42883') {
    return { message: 'the stock update function is missing from the database — run migration 001_apply_stock_deltas.sql' };
  }
  return error;
}

// ── Link tables ──────────────────────────────────────────────────────────────
// Postgres 42P01 = table does not exist, i.e. a migration has not been run.
function isMissingTable(error) {
  return error?.code === '42P01';
}

// Replaces the link rows for one owner record. Returns an error to report,
// or null. A missing table is treated as "nothing to do" rather than a fault.
export async function replaceLinks(table, ownerColumn, ownerId, rows) {
  const del = await supabase.from(table).delete().eq(ownerColumn, ownerId);
  if (del.error) return isMissingTable(del.error) ? null : del.error;
  if (rows.length === 0) return null;
  const ins = await supabase.from(table).insert(rows);
  return ins.error || null;
}

// ── Images ───────────────────────────────────────────────────────────────────
export async function uploadImage(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return { url: null, error };
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, error: null };
}

// ── Records ──────────────────────────────────────────────────────────────────
export async function upsertProduct(payload) {
  const { error } = await supabase.from('products').upsert(payload);
  return error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return error;
}

export async function setProductImage(id, imageUrl) {
  const { error } = await supabase.from('products').update({ image_url: imageUrl }).eq('id', id);
  return error;
}

export async function insertMachine(fields) {
  const { data, error } = await supabase.from('machines').insert(fields).select().single();
  return { id: data?.id, error };
}

export async function updateMachine(id, fields) {
  const { error } = await supabase.from('machines').update(fields).eq('id', id);
  return error;
}

export async function deleteMachine(id) {
  const { error } = await supabase.from('machines').delete().eq('id', id);
  return error;
}

export async function insertSupplier(fields) {
  const { data, error } = await supabase.from('suppliers').insert(fields).select().single();
  return { id: data?.id, error };
}

export async function updateSupplier(id, fields) {
  const { error } = await supabase.from('suppliers').update(fields).eq('id', id);
  return error;
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  return error;
}

// ── Purchasing rules ─────────────────────────────────────────────────────────
// The steel plate quantities, the trigger level, the material list and the run
// size. If the tables do not exist yet, the caller's defaults are used, so the
// app still works before migration 002 has been run.

// Purchasing is per machine now: each machine has at most one reorder rule,
// its own plate quantities and its own material footages. Standard lengths are
// shared, since a 24 ft stick is 24 ft whatever it is cut for.
export async function loadPurchasing(defaults) {
  const [rRes, oRes, cRes, mRes] = await Promise.all([
    supabase.from('reorder_rules').select('*'),
    supabase.from('steel_plate_order').select('*').order('sort_order'),
    supabase.from('material_categories').select('*').order('sort_order'),
    supabase.from('material_requirements').select('*').order('sort_order'),
  ]);

  // A missing table means the migration has not been run; fall back silently.
  if (rRes.error || oRes.error || cRes.error || mRes.error) return defaults;

  const plateByRule = {};
  for (const r of oRes.data) {
    (plateByRule[r.rule_id] ||= []).push({ id: r.id, description: r.description, qty: r.qty, sortOrder: r.sort_order });
  }

  const materialsByMachine = {};
  for (const r of mRes.data) {
    (materialsByMachine[r.machine_id] ||= []).push({
      id: r.id, name: r.name, totalFt: Number(r.total_ft),
      categoryId: r.category_id, sortOrder: r.sort_order,
    });
  }

  // A rule with no machine is one that migration 006 has not attached yet.
  const unattachedRules = rRes.data.filter(r => !r.machine_id).length;

  const byMachine = {};
  for (const r of rRes.data) {
    if (!r.machine_id) continue;
    byMachine[r.machine_id] = {
      rule: {
        id: r.id, machineId: r.machine_id, label: r.label,
        skuPrefix: r.sku_prefix, machinesWorth: r.machines_worth,
        supplierId: r.supplier_id, enabled: r.enabled,
      },
      plateOrder: plateByRule[r.id] || [],
    };
  }

  return {
    byMachine,
    materialsByMachine,
    categories: cRes.data.map(r => ({
      id: r.id, label: r.label,
      stdLength: r.std_length === null ? null : Number(r.std_length),
      color: r.color, sortOrder: r.sort_order,
    })),
    unattachedRules,
    fromDatabase: true,
  };
}

export async function createRule(machineId, skuPrefix) {
  const { data, error } = await supabase.rpc('create_reorder_rule', {
    p_machine_id: machineId,
    p_sku_prefix: skuPrefix,
  });
  return { id: data, error };
}

export async function saveRule(rule) {
  const { error } = await supabase.from('reorder_rules').update({
    sku_prefix: rule.skuPrefix,
    machines_worth: rule.machinesWorth,
    supplier_id: rule.supplierId,
    updated_at: new Date().toISOString(),
  }).eq('id', rule.id);
  return error;
}

export async function saveRunSize(machineId, runSize) {
  const { error } = await supabase.from('machines').update({ run_size: runSize }).eq('id', machineId);
  return error;
}

// Both lists are replaced inside a single database transaction, so a failed
// save leaves the previous list exactly as it was rather than wiping it.
export async function savePlateOrder(ruleId, lines) {
  const { error } = await supabase.rpc('replace_plate_order', {
    p_rule_id: ruleId,
    p_rows: lines.map(l => ({ description: l.description, qty: l.qty })),
  });
  return error || null;
}

export async function saveMaterials(machineId, materials) {
  const { error } = await supabase.rpc('replace_material_requirements', {
    p_machine_id: machineId,
    p_rows: materials.map(m => ({ name: m.name, total_ft: m.totalFt, category_id: m.categoryId })),
  });
  return error || null;
}

export async function saveCategory(category) {
  const { error } = await supabase.from('material_categories').update({
    label: category.label,
    std_length: category.stdLength,
  }).eq('id', category.id);
  return error;
}

// ── Process stages and work in progress ──────────────────────────────────────
// Each part's route and the pieces sitting part-finished at each step. If the
// tables do not exist yet the caller's empty default is used, so the app works
// before migration 005 has been run.

export async function loadProduction(defaults) {
  const [sRes, rRes, qRes] = await Promise.all([
    supabase.from('process_stages').select('*').order('sort_order'),
    supabase.from('part_routes').select('*').order('sort_order'),
    supabase.from('part_stage_qty').select('*'),
  ]);

  if (sRes.error || rRes.error || qRes.error) return defaults;

  const routeByProduct = {};
  for (const row of rRes.data) {
    (routeByProduct[row.product_id] ||= []).push(row.stage_id);
  }

  const wipByProduct = {};
  for (const row of qRes.data) {
    if (row.qty > 0) (wipByProduct[row.product_id] ||= {})[row.stage_id] = row.qty;
  }

  return {
    stages: sRes.data.map(s => ({ id: s.id, label: s.label, sortOrder: s.sort_order })),
    routeByProduct,
    wipByProduct,
    fromDatabase: true,
  };
}

// Applies every movement in one transaction, so a batch of work either lands
// whole or not at all. Each move is { product_id, from_stage, to_stage, qty },
// where a null from_stage means the pieces are being made and a null to_stage
// means the route is finished and they become usable stock.
export async function moveStageQty(moves) {
  const { error } = await supabase.rpc('move_stage_qty', { p_moves: moves });
  if (!error) return null;
  if (error.code === 'PGRST202' || error.code === '42883') {
    return { message: 'the production tables are missing from the database — run migration 005_process_stages.sql' };
  }
  return error;
}

export async function saveRoute(productId, stageIds) {
  const del = await supabase.from('part_routes').delete().eq('product_id', productId);
  if (del.error) return del.error;
  if (stageIds.length === 0) return null;
  const ins = await supabase.from('part_routes').insert(
    stageIds.map((stage_id, i) => ({ product_id: productId, stage_id, sort_order: i + 1 }))
  );
  return ins.error || null;
}

// ── Build history ────────────────────────────────────────────────────────────
// Committed builds, newest first. Falls back to an empty log when the tables
// are missing, so the app works before migration 007 has been run.

export async function loadBuildHistory(defaults) {
  const [bRes, lRes] = await Promise.all([
    supabase.from('machine_builds').select('*').order('built_at', { ascending: false }).limit(500),
    supabase.from('machine_build_lines').select('*'),
  ]);

  if (bRes.error || lRes.error) return defaults;

  const linesByBuild = {};
  for (const l of lRes.data) {
    (linesByBuild[l.build_id] ||= []).push({ productId: l.product_id, qty: l.qty });
  }

  return {
    builds: bRes.data.map(b => ({
      id: b.id,
      machineId: b.machine_id,
      qty: b.qty,
      note: b.note || '',
      builtAt: b.built_at,
      builtByEmail: b.built_by_email || '',
      voidedAt: b.voided_at,
      voidedByEmail: b.voided_by_email || '',
      lines: linesByBuild[b.id] || [],
    })),
    fromDatabase: true,
  };
}

// The deduction and the log entry land together or not at all.
export async function commitMachineBuild(machineId, qty, deltas, note) {
  const { error } = await supabase.rpc('commit_machine_build', {
    p_machine_id: machineId,
    p_qty: qty,
    p_deltas: deltas,
    p_note: note || null,
  });
  if (!error) return null;
  if (error.code === 'PGRST202' || error.code === '42883') {
    return { message: 'the build log is missing from the database — run migration 007_build_history.sql' };
  }
  return error;
}

export async function voidMachineBuild(buildId) {
  const { error } = await supabase.rpc('void_machine_build', { p_build_id: buildId });
  return error || null;
}
