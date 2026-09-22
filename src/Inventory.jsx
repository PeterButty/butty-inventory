import { useState, useMemo, useEffect } from 'react'
import { AppProvider } from './AppContext'
import { THEMES, DEFAULT_THEME, buildCss } from './lib/theme'
import { needsReorder, lowStockProducts } from './lib/stock'
import { calcMachineBuilds } from './lib/builds'
import { evaluateSteelPlateRule } from './lib/rules'
import { DEFAULT_PURCHASING } from './lib/materials'
import {
  generateEmailDraft, generateSteelPlateDraft, groupLowStockBySupplier,
  emailToClipboardText, mailtoUrl,
} from './lib/emails'
import * as db from './lib/db'

import { Toast } from './components/common'
import InventoryTab from './tabs/InventoryTab'
import MachinesTab from './tabs/MachinesTab'
import SuppliersTab from './tabs/SuppliersTab'
import ReorderTab from './tabs/ReorderTab'
import ProductionTab from './tabs/ProductionTab'
import ProductModal from './modals/ProductModal'
import MachineModal from './modals/MachineModal'
import MachineDetailModal from './modals/MachineDetailModal'
import SupplierModal from './modals/SupplierModal'
import EmailDraftModal from './modals/EmailDraftModal'
import { CommitBuildModal, BuildAssemblyModal, Lightbox } from './modals/BuildModals'
import { RuleModal, PlateOrderModal, MaterialsModal } from './modals/PurchasingModals'

const LOGO = '/butty-logo.jpg' // served from public/

const TABS = [
  ['inventory', '📦  Inventory'],
  ['machines',  '🔧  Machine Builder'],
  ['suppliers', '🏢  Suppliers'],
  ['production','🔨  Production'],
  ['reorder',   '🔁  Reorder Rules'],
]

const EMPTY_PRODUCT = {
  sku:'', name:'', category:'', stock:'', minStock:'', reorderQty:'', unit:'pcs',
  location:'', imageUrl:null, machineLinks:[], supplierId:null, partType:'purchased',
  rawMaterials:[], bomComponents:[], batchSize:'', leadTimeDays:'',
}

const EMPTY_PRODUCTION = { stages: [], routeByProduct: {}, wipByProduct: {}, fromDatabase: false }

const EMPTY_SUPPLIER = { name:'', email:'', phone:'', contact:'', products:[], notes:'' }
const EMPTY_MACHINE  = { name:'', description:'', imageUrl:null, components:[] }

export default function Inventory({ user, onSignOut }) {
  // ── Records ────────────────────────────────────────────────────────────────
  const [products,  setProducts]  = useState([])
  const [machines,  setMachines]  = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)

  // ── Chrome ─────────────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('inventory')
  const [themeName,    setThemeName]    = useState(DEFAULT_THEME)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast,        setToast]        = useState(null)
  const [lightbox,     setLightbox]     = useState(null)

  // ── Inventory tab ──────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [category,     setCategory]     = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [sortBy,       setSortBy]       = useState('name')
  const [sortDir,      setSortDir]      = useState('asc')

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [modal,       setModal]       = useState(null)
  const [form,        setForm]        = useState({})
  const [adjustQty,   setAdjustQty]   = useState('')
  const [adjustType,  setAdjustType]  = useState('add')

  const [machineModal, setMachineModal] = useState(null)
  const [machineForm,  setMachineForm]  = useState(EMPTY_MACHINE)
  const [commitTarget, setCommitTarget] = useState(null)
  const [commitQty,    setCommitQty]    = useState(1)

  const [supplierModal,  setSupplierModal]  = useState(null)
  const [supplierForm,   setSupplierForm]   = useState(EMPTY_SUPPLIER)
  const [supplierSearch, setSupplierSearch] = useState('')

  const [emailDraft,  setEmailDraft]  = useState(null)
  const [emailDrafts, setEmailDrafts] = useState([])

  const [assemblyTarget, setAssemblyTarget] = useState(null)
  const [assemblyQty,    setAssemblyQty]    = useState(1)

  // Purchasing rules: the plate quantities, trigger level, material list and
  // run size. Loaded from the database, falling back to the built-in defaults
  // when migration 002 has not been run.
  const [purchasing,      setPurchasing]      = useState(DEFAULT_PURCHASING)
  const [purchasingModal, setPurchasingModal] = useState(null)

  // Process routes and the pieces sitting part-finished on the shop floor.
  const [production, setProduction] = useState(EMPTY_PRODUCTION)

  const t = THEMES[themeName]

  useEffect(() => { reload({ initial: true }) }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  // Refreshing after a save used to blank the screen to "Loading…" each time.
  // Only the first load does that now; later refreshes swap the data in place.
  async function reload({ initial = false } = {}) {
    if (initial) setLoading(true)
    const [records, rules, floor] = await Promise.all([
      db.loadEverything(),
      db.loadPurchasing(DEFAULT_PURCHASING),
      db.loadProduction(EMPTY_PRODUCTION),
    ])
    if (records.error) showToast('Error loading products: ' + records.error.message, 'error')
    setProducts(records.products)
    setMachines(records.machines)
    setSuppliers(records.suppliers)
    setPurchasing(rules)
    setProduction(floor)
    if (initial) setLoading(false)
  }

  function supplierForProduct(productId) {
    return suppliers.find(s => s.products?.includes(productId)) || null
  }

  const steelPlateRule = useMemo(
    () => evaluateSteelPlateRule(products, machines, suppliers, purchasing.rule),
    [products, machines, suppliers, purchasing.rule]
  )

  const lowCount = useMemo(() => lowStockProducts(products).length, [products])

  // ── Products ───────────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_PRODUCT })
    setModal({ mode:'add' })
  }

  function openEdit(p) {
    // Machine usage lives on the machines, so gather it back up for the form.
    const machineLinks = machines
      .filter(m => m.components.some(c => c.productId === p.id))
      .map(m => {
        const comp = m.components.find(c => c.productId === p.id)
        return { machineId:m.id, qty:comp.qty, note:comp.note || '' }
      })
    setForm({ ...EMPTY_PRODUCT, ...p, machineLinks })
    setModal({ mode:'edit', product:p })
  }

  function openAdjust(p) {
    setAdjustQty('')
    setAdjustType('add')
    setModal({ mode:'adjust', product:p })
  }

  async function saveProduct() {
    if (!form.name || !form.sku) return
    setSaving(true)

    const id = modal.mode === 'add' ? crypto.randomUUID() : form.id
    let imageUrl = form.imageUrl || null
    if (form._imageFile) {
      const ext = form._imageFile.name.split('.').pop()
      const res = await db.uploadImage('product-images', `${id}.${ext}`, form._imageFile)
      if (res.error) { showToast('Image upload failed: ' + res.error.message, 'error'); setSaving(false); return }
      imageUrl = res.url
    }

    const err = await db.upsertProduct(db.productPayload(form, id, imageUrl))
    if (err) { showToast('Save failed: ' + err.message, 'error'); setSaving(false); return }

    // Supplier link and machine usage live in their own tables. If either fails
    // to save, say so rather than reporting a clean save.
    const warnings = []

    const supErr = await db.replaceLinks('supplier_products', 'product_id', id,
      form.supplierId ? [{ supplier_id:form.supplierId, product_id:id }] : [])
    if (supErr) warnings.push(`supplier link (${supErr.message})`)

    // Rows with no machine chosen would be rejected by the database, so drop them.
    const machErr = await db.replaceLinks('machine_components', 'product_id', id,
      (form.machineLinks || [])
        .filter(l => l.machineId)
        .map(l => ({ machine_id:l.machineId, product_id:id, qty:l.qty, note:l.note || '' })))
    if (machErr) warnings.push(`machine usage (${machErr.message})`)

    if (warnings.length) showToast(`Part saved, but ${warnings.join(' and ')} did not save.`, 'error')
    else showToast(modal.mode === 'add' ? 'Product added!' : 'Product updated!')

    await reload()
    setSaving(false)
    setModal(null)
  }

  async function applyAdjust() {
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty < 0) return
    setSaving(true)
    const err = await db.applyStockDeltas([
      { product_id: modal.product.id, delta: adjustType === 'add' ? qty : -qty },
    ])
    if (err) showToast('Update failed — ' + err.message, 'error')
    else showToast('Stock updated!')
    await reload()
    setSaving(false)
    if (!err) setModal(null)
  }

  async function removeProduct(id) {
    if (!confirm('Delete this product?')) return
    const err = await db.deleteProduct(id)
    if (err) showToast('Delete failed: ' + err.message, 'error')
    else { showToast('Product deleted.'); await reload() }
  }

  async function handleRowImageFile(productId, file) {
    if (!file || !file.type.startsWith('image/')) return
    setSaving(true)
    const ext = file.name.split('.').pop()
    const { url, error } = await db.uploadImage('product-images', `${productId}.${ext}`, file)
    if (error) showToast('Image upload failed: ' + error.message, 'error')
    else {
      const err = await db.setProductImage(productId, url)
      if (err) showToast('Failed to save image', 'error')
      else { showToast('Photo saved!'); await reload() }
    }
    setSaving(false)
  }

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(field); setSortDir('asc') }
  }

  // ── Machines ───────────────────────────────────────────────────────────────
  function openAddMachine()   { setMachineForm({ ...EMPTY_MACHINE }); setMachineModal({ mode:'add' }) }
  function openEditMachine(m) {
    setMachineForm({ ...m, components: m.components.map(c => ({ ...c })) })
    setMachineModal({ mode:'edit', machine:m })
  }
  function openViewMachine(m) { setMachineModal({ mode:'view', machine:m }) }

  async function saveMachine() {
    if (!machineForm.name) return
    setSaving(true)

    const fields = { name:machineForm.name, description:machineForm.description || '' }

    // Create the machine first, so a new machine's photo is stored under its
    // real id rather than a throwaway one.
    let machineId
    if (machineModal.mode === 'add') {
      const { id, error } = await db.insertMachine(fields)
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return }
      machineId = id
    } else {
      machineId = machineModal.machine.id
    }

    let imageUrl = machineForm.imageUrl || null
    if (machineForm._imageFile) {
      const ext = machineForm._imageFile.name.split('.').pop()
      const res = await db.uploadImage('machine-images', `${machineId}.${ext}`, machineForm._imageFile)
      if (res.error) showToast('Photo upload failed: ' + res.error.message, 'error')
      imageUrl = res.url
    }

    const upErr = await db.updateMachine(machineId, { ...fields, image_url:imageUrl })
    if (upErr) { showToast('Save failed: ' + upErr.message, 'error'); setSaving(false); return }

    const compErr = await db.replaceLinks('machine_components', 'machine_id', machineId,
      machineForm.components
        .filter(c => c.productId)
        .map(c => ({ machine_id:machineId, product_id:c.productId, qty:c.qty, note:c.note || '' })))

    if (compErr) showToast(`Machine saved, but the parts list did not save (${compErr.message}).`, 'error')
    else showToast(machineModal.mode === 'add' ? 'Machine added!' : 'Machine updated!')

    await reload()
    setSaving(false)
    setMachineModal(null)
  }

  async function removeMachine(id) {
    if (!confirm('Delete this machine?')) return
    const err = await db.deleteMachine(id)
    if (err) showToast('Delete failed: ' + err.message, 'error')
    else { showToast('Machine deleted.'); await reload() }
  }

  function openCommit(machine) {
    setCommitQty(1)
    setMachineModal(null)
    setCommitTarget(machine)
  }

  async function commitBuild(machine, qty) {
    const { max, required } = calcMachineBuilds(machine, products)
    if (qty > max) { showToast(`Cannot build ${qty} — only ${max} possible.`, 'error'); return }
    setSaving(true)
    // Only what the machine consumes on the bench. Parts that went into a
    // weldment were deducted when the weldment was built; taking them again
    // here would double-deduct them.
    const err = await db.applyStockDeltas(
      required.map(c => ({ product_id:c.productId, delta: -(c.qty * qty) }))
    )
    if (err) showToast(`Nothing was changed — ${err.message}`, 'error')
    else showToast(`✓ ${qty}× ${machine.name} committed — stock deducted.`)
    await reload()
    setSaving(false)
    if (!err) setCommitTarget(null)
  }

  // ── Subassemblies ──────────────────────────────────────────────────────────
  function openBuildAssembly(product) {
    setAssemblyQty(1)
    setAssemblyTarget(product)
  }

  async function buildAssembly() {
    const product = assemblyTarget
    const qty = parseInt(assemblyQty)
    if (!product || isNaN(qty) || qty < 1) return
    const bom = product.bomComponents || []
    if (bom.length === 0) return

    setSaving(true)
    // Components out and finished assemblies in, in one transaction — a
    // shortfall on any component leaves every count untouched.
    const err = await db.applyStockDeltas([
      ...bom.map(c => ({ product_id:c.productId, delta: -(c.qty * qty) })),
      { product_id:product.id, delta:qty },
    ])
    if (err) showToast(`Nothing was changed — ${err.message}`, 'error')
    else showToast(`Built ${qty}× ${product.name} — components deducted.`)
    await reload()
    setSaving(false)
    if (!err) { setAssemblyTarget(null); setAssemblyQty(1) }
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────
  function openAddSupplier()   { setSupplierForm({ ...EMPTY_SUPPLIER }); setSupplierModal({ mode:'add' }) }
  function openEditSupplier(s) {
    setSupplierForm({ ...s, products:[...(s.products || [])] })
    setSupplierModal({ mode:'edit', supplier:s })
  }
  function closeSupplierModal() { setSupplierSearch(''); setSupplierModal(null) }

  async function saveSupplier() {
    if (!supplierForm.name) return
    setSaving(true)

    const fields = {
      name: supplierForm.name,
      email: supplierForm.email || '',
      phone: supplierForm.phone || '',
      contact: supplierForm.contact || '',
      notes: supplierForm.notes || '',
    }

    let supplierId
    if (supplierModal.mode === 'add') {
      const { id, error } = await db.insertSupplier(fields)
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return }
      supplierId = id
    } else {
      supplierId = supplierForm.id
      const error = await db.updateSupplier(supplierId, fields)
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return }
    }

    const linkErr = await db.replaceLinks('supplier_products', 'supplier_id', supplierId,
      (supplierForm.products || []).map(pid => ({ supplier_id:supplierId, product_id:pid })))

    if (linkErr) showToast(`Supplier saved, but the supplied parts did not save (${linkErr.message}).`, 'error')
    else showToast(supplierModal.mode === 'add' ? 'Supplier added!' : 'Supplier updated!')

    await reload()
    setSaving(false)
    closeSupplierModal()
  }

  async function removeSupplier(id) {
    if (!confirm('Delete this supplier?')) return
    const err = await db.deleteSupplier(id)
    if (err) showToast('Delete failed: ' + err.message, 'error')
    else { showToast('Supplier deleted.'); await reload() }
  }

  // ── Order emails ───────────────────────────────────────────────────────────
  function generateAllLowStockEmails() {
    const { low, orphans, drafts } = groupLowStockBySupplier(products, supplierForProduct)
    if (low.length === 0)    { showToast('No products below minimum stock.', 'error'); return }
    if (drafts.length === 0) { showToast('No suppliers linked to low-stock items.', 'error'); return }
    setEmailDrafts(drafts)
    setEmailDraft(drafts[0])
    if (orphans.length > 0) showToast(`${orphans.length} item(s) have no supplier assigned.`, 'error')
  }

  function openSupplierEmail(supplier) {
    const items = products.filter(p =>
      supplier.products?.includes(p.id) && needsReorder(p)
    )
    if (items.length === 0) { showToast('No low-stock items for this supplier.', 'error'); return }
    const draft = generateEmailDraft(supplier, items)
    setEmailDrafts([draft])
    setEmailDraft(draft)
  }

  function generateSteelPlateEmail() {
    if (!steelPlateRule.supplier) {
      showToast(`${steelPlateRule.rule.supplierLabel} not found in suppliers — please add them first.`, 'error')
      return
    }
    const draft = generateSteelPlateDraft(steelPlateRule.supplier, purchasing.plateOrder)
    setEmailDrafts([draft])
    setEmailDraft(draft)
  }

  // ── Purchasing rules ───────────────────────────────────────────────────────
  // Every save reloads, so what is on screen is always what the database holds.
  async function withPurchasingSave(work, successMessage) {
    setSaving(true)
    const err = await work()
    if (err) showToast('Save failed: ' + err.message, 'error')
    else showToast(successMessage)
    await reload()
    setSaving(false)
    if (!err) setPurchasingModal(null)
  }

  const saveRule = rule =>
    withPurchasingSave(() => db.saveRule(rule), 'Reorder rule updated!')

  const savePlateOrder = lines =>
    withPurchasingSave(() => db.savePlateOrder(purchasing.rule.id, lines), 'Plate quantities updated!')

  const saveMaterials = ({ materials, categories, runSize }) =>
    withPurchasingSave(async () => {
      for (const category of categories) {
        const err = await db.saveCategory(category)
        if (err) return err
      }
      return (await db.saveMaterials(materials)) || (await db.saveRunSize(runSize))
    }, 'Material requirements updated!')

  // ── Production ─────────────────────────────────────────────────────────────
  // A whole batch of work in one transaction: either every part moves along or
  // none does, so a run can never be half-recorded.
  async function recordProduction(moves, onDone) {
    if (moves.length === 0) return
    setSaving(true)
    const err = await db.moveStageQty(moves)
    if (err) showToast(`Nothing was recorded — ${err.message}`, 'error')
    else {
      const pieces = moves.reduce((sum, m) => sum + m.qty, 0)
      showToast(`Recorded ${pieces} piece${pieces === 1 ? '' : 's'} across ${moves.length} part${moves.length === 1 ? '' : 's'}.`)
    }
    await reload()
    setSaving(false)
    if (!err) onDone?.()
  }

  function closeEmailDrafts() { setEmailDraft(null); setEmailDrafts([]) }

  function dismissDraft() {
    const remaining = emailDrafts.filter(d => d !== emailDraft)
    setEmailDrafts(remaining)
    setEmailDraft(remaining[0] || null)
  }

  function updateDraft(next) {
    setEmailDrafts(list => list.map(d => (d === emailDraft ? next : d)))
    setEmailDraft(next)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0F', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", color:'#555', fontSize:13, letterSpacing:'0.1em' }}>
      Loading…
    </div>
  )

  const context = { t, themeName, products, machines, suppliers, saving, supplierForProduct, showToast, production }

  return (
    <AppProvider value={context}>
      <div style={{ minHeight:'100vh', background:t.bg, color:t.text, fontFamily:"'DM Mono','Fira Mono',monospace", transition:'background 0.3s,color 0.3s' }}>
        <style>{buildCss(t)}</style>

        {/* ── Header ── */}
        <div style={{ borderBottom:`1px solid ${t.border}`, padding:'0 40px', display:'flex', alignItems:'center', justifyContent:'space-between', background:t.headerBg, minHeight:72, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:18 }}>
            <img src={LOGO} alt="Butty" style={{ height:48, width:48, objectFit:'contain' }} />
            <div style={{ width:1, height:36, background:t.borderStrong }} />
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:'0.12em', color:t.text, textTransform:'uppercase' }}>Butty Manufacturing</div>
              <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.16em', marginTop:1 }}>FINISHED GOODS INVENTORY SYSTEM</div>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {user && (
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.06em', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
            )}
            <button className="btn-ghost" onClick={onSignOut}>Sign Out</button>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              style={{ background:settingsOpen ? t.accent : 'transparent', color:settingsOpen ? '#fff' : t.textMid, border:`1px solid ${settingsOpen ? t.accent : t.borderStrong}`, padding:'7px 14px', fontFamily:"'DM Mono',monospace", fontSize:11, cursor:'pointer', letterSpacing:'0.06em', transition:'all 0.15s' }}
            >
              ⚙ Settings
            </button>

            {activeTab === 'inventory' && <button className="btn-primary" onClick={openAdd}>+ Add Product</button>}
            {activeTab === 'machines'  && <button className="btn-primary" onClick={openAddMachine}>+ Add Machine</button>}
            {activeTab === 'suppliers' && <button className="btn-primary" onClick={openAddSupplier}>+ Add Supplier</button>}

            {(activeTab === 'inventory' || activeTab === 'suppliers') && lowCount > 0 && (
              <button
                onClick={generateAllLowStockEmails}
                style={{ background:'rgba(255,149,0,0.15)', color:'#FF9500', border:'1px solid rgba(255,149,0,0.4)', padding:'7px 14px', fontFamily:"'DM Mono',monospace", fontSize:11, cursor:'pointer', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6 }}
              >
                ✉ Reorder ({lowCount})
              </button>
            )}

            {steelPlateRule.triggered && (
              <button
                onClick={() => setActiveTab('reorder')}
                style={{ background:'rgba(255,59,59,0.15)', color:'#FF3B3B', border:'1px solid rgba(255,59,59,0.4)', padding:'7px 14px', fontFamily:"'DM Mono',monospace", fontSize:11, cursor:'pointer', letterSpacing:'0.06em', display:'flex', alignItems:'center', gap:6, animation:'pulse 2s infinite' }}
              >
                🔴 Steel Plate Reorder
              </button>
            )}
          </div>

          {settingsOpen && (
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:t.text, marginBottom:4 }}>Settings</div>
              <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.12em', marginBottom:20, textTransform:'uppercase' }}>Appearance</div>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:10 }}>Colour Theme</div>
              {Object.entries(THEMES).map(([key, theme]) => (
                <div
                  key={key}
                  className={`theme-swatch ${themeName === key ? 'selected' : ''}`}
                  onClick={() => { setThemeName(key); setSettingsOpen(false) }}
                >
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <div style={{ width:14, height:14, borderRadius:'50%', background:theme.bg, border:`2px solid ${theme.borderStrong}` }} />
                    <div style={{ width:14, height:14, borderRadius:'50%', background:theme.accent }} />
                    <div style={{ width:14, height:14, borderRadius:'50%', background:theme.cardBg, border:`2px solid ${theme.borderStrong}` }} />
                  </div>
                  <div style={{ fontSize:12, color:t.text, letterSpacing:'0.04em' }}>{theme.name}</div>
                  {themeName === key && <div style={{ marginLeft:'auto', fontSize:10, color:t.accent }}>✓ Active</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        {settingsOpen && <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={() => setSettingsOpen(false)} />}

        {/* ── Tabs ── */}
        <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:'0 40px', display:'flex', gap:0 }}>
          {TABS.map(([tab, label]) => {
            const flagged = tab === 'reorder' && steelPlateRule.triggered
            return (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={flagged ? { color:'#FF3B3B' } : {}}
              >
                {label}{flagged ? ' ●' : ''}
              </button>
            )
          })}
        </div>

        {/* ── Tab contents ── */}
        {activeTab === 'inventory' && (
          <InventoryTab
            search={search} setSearch={setSearch}
            category={category} setCategory={setCategory}
            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
            sortBy={sortBy} sortDir={sortDir} onToggleSort={toggleSort}
            onLightbox={setLightbox}
            onRowImageFile={handleRowImageFile}
            onAdjust={openAdjust}
            onEdit={openEdit}
            onDelete={removeProduct}
            onBuildAssembly={openBuildAssembly}
          />
        )}

        {activeTab === 'machines' && (
          <MachinesTab
            onView={openViewMachine}
            onEdit={openEditMachine}
            onDelete={removeMachine}
            onCommit={openCommit}
          />
        )}

        {activeTab === 'suppliers' && (
          <SuppliersTab
            onGenerateAllEmails={generateAllLowStockEmails}
            onSupplierEmail={openSupplierEmail}
            onEdit={openEditSupplier}
            onDelete={removeSupplier}
          />
        )}

        {activeTab === 'production' && (
          <ProductionTab production={production} onRecord={recordProduction} />
        )}

        {activeTab === 'reorder' && (
          <ReorderTab
            steelPlateRule={steelPlateRule}
            purchasing={purchasing}
            onGenerateSteelPlateEmail={generateSteelPlateEmail}
            onEditRule={() => setPurchasingModal('rule')}
            onEditQuantities={() => setPurchasingModal('plate')}
            onEditMaterials={() => setPurchasingModal('materials')}
          />
        )}

        {/* ── Pop-ups ── */}
        <ProductModal
          modal={modal}
          form={form}
          setForm={setForm}
          adjust={{ adjustType, setAdjustType, adjustQty, setAdjustQty }}
          onSave={saveProduct}
          onApplyAdjust={applyAdjust}
          onClose={() => setModal(null)}
        />

        {machineModal && machineModal.mode !== 'view' && (
          <MachineModal
            mode={machineModal.mode}
            form={machineForm}
            setForm={setMachineForm}
            onSave={saveMachine}
            onClose={() => setMachineModal(null)}
          />
        )}

        {machineModal && machineModal.mode === 'view' && (
          <MachineDetailModal
            machine={machineModal.machine}
            onClose={() => setMachineModal(null)}
            onEditBom={openEditMachine}
            onCommit={openCommit}
          />
        )}

        <CommitBuildModal
          machine={commitTarget}
          qty={commitQty}
          setQty={setCommitQty}
          onConfirm={commitBuild}
          onClose={() => setCommitTarget(null)}
        />

        <BuildAssemblyModal
          product={assemblyTarget}
          qty={assemblyQty}
          setQty={setAssemblyQty}
          onConfirm={buildAssembly}
          onClose={() => setAssemblyTarget(null)}
        />

        {supplierModal && (
          <SupplierModal
            mode={supplierModal.mode}
            form={supplierForm}
            setForm={setSupplierForm}
            search={supplierSearch}
            setSearch={setSupplierSearch}
            onSave={saveSupplier}
            onClose={closeSupplierModal}
          />
        )}

        <EmailDraftModal
          draft={emailDraft}
          drafts={emailDrafts}
          onChange={updateDraft}
          onClose={closeEmailDrafts}
          onSend={() => { window.open(mailtoUrl(emailDraft), '_blank'); showToast('Opening your email client…'); dismissDraft() }}
          onCopy={() => { navigator.clipboard.writeText(emailToClipboardText(emailDraft)).then(() => showToast('Email copied to clipboard!')); dismissDraft() }}
          onDismiss={dismissDraft}
        />

        {purchasingModal === 'rule' && (
          <RuleModal
            rule={purchasing.rule}
            onSave={saveRule}
            onClose={() => setPurchasingModal(null)}
          />
        )}

        {purchasingModal === 'plate' && (
          <PlateOrderModal
            lines={purchasing.plateOrder}
            onSave={savePlateOrder}
            onClose={() => setPurchasingModal(null)}
          />
        )}

        {purchasingModal === 'materials' && (
          <MaterialsModal
            materials={purchasing.materials}
            categories={purchasing.categories}
            runSize={purchasing.runSize}
            onSave={saveMaterials}
            onClose={() => setPurchasingModal(null)}
          />
        )}

        <Lightbox product={lightbox} onClose={() => setLightbox(null)} />

        <Toast toast={toast} />
      </div>
    </AppProvider>
  )
}
