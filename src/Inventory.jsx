import { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

// ── Logo ──────────────────────────────────────────────────────────────────────
const LOGO = "/butty-logo.jpg" // served from public/

// ── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark:     { name:"Dark",     bg:"#0A0A0F", headerBg:"#0D0D18", cardBg:"#0F0F18", modalBg:"#111118", border:"#1E1E28", borderStrong:"#2A2A35", text:"#E8E8F0", textMid:"#888", textDim:"#555", textFaint:"#444", accent:"#2B3FE0", accentRgb:"43,63,224",  inputBg:"#111118", rowAlt:"rgba(255,255,255,0.01)", rowHover:"rgba(255,255,255,0.04)" },
  light:    { name:"Light",    bg:"#F4F4F8", headerBg:"#FFFFFF", cardBg:"#FFFFFF", modalBg:"#FFFFFF", border:"#E0E0EA", borderStrong:"#CACAD8", text:"#111118", textMid:"#555", textDim:"#888", textFaint:"#AAA", accent:"#2B3FE0", accentRgb:"43,63,224",  inputBg:"#F9F9FC", rowAlt:"rgba(0,0,0,0.015)", rowHover:"rgba(0,0,0,0.04)" },
  midnight: { name:"Midnight", bg:"#060612", headerBg:"#09091A", cardBg:"#0C0C1E", modalBg:"#0F0F22", border:"#16163A", borderStrong:"#20204A", text:"#D0D0FF", textMid:"#7070AA", textDim:"#404070", textFaint:"#303055", accent:"#6B5CE7", accentRgb:"107,92,231", inputBg:"#0C0C1E", rowAlt:"rgba(100,100,255,0.02)", rowHover:"rgba(100,100,255,0.06)" },
  forest:   { name:"Forest",   bg:"#080F0A", headerBg:"#0B140D", cardBg:"#0E1810", modalBg:"#111C13", border:"#162019", borderStrong:"#1E2E22", text:"#D0EDD8", textMid:"#6A9A76", textDim:"#3A5E44", textFaint:"#2A4233", accent:"#2ECC71", accentRgb:"46,204,113", inputBg:"#0E1810", rowAlt:"rgba(46,204,113,0.02)", rowHover:"rgba(46,204,113,0.05)" },
  slate:    { name:"Slate",    bg:"#1A1F2E", headerBg:"#1E2438", cardBg:"#222840", modalBg:"#262D45", border:"#2E3650", borderStrong:"#3A4460", text:"#C8D0E8", textMid:"#7888AA", textDim:"#4A5570", textFaint:"#3A4260", accent:"#4A90D9", accentRgb:"74,144,217", inputBg:"#222840", rowAlt:"rgba(74,144,217,0.02)", rowHover:"rgba(74,144,217,0.06)" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStockStatus(stock, minStock) {
  if (stock === 0) return 'out';
  if (stock < minStock) return 'low';
  if (stock < minStock * 1.5) return 'warning';
  return 'ok';
}

const STATUS_META = {
  out:     { label:'Out of Stock', color:'#FF3B3B', bg:'rgba(255,59,59,0.12)',  dot:'#FF3B3B' },
  low:     { label:'Low Stock',    color:'#FF9500', bg:'rgba(255,149,0,0.12)',  dot:'#FF9500' },
  warning: { label:'Watch',        color:'#FFD60A', bg:'rgba(255,214,10,0.12)', dot:'#FFD60A' },
  ok:      { label:'In Stock',     color:'#30D158', bg:'rgba(48,209,88,0.12)',  dot:'#30D158' },
};

// ── Steel Plate Reorder Rule ───────────────────────────────────────────────
const STEEL_PLATE_ORDER = [
  { qty:2,  desc:"14ga. (0.0747\") Mild Steel, 4' x 8'"  },
  { qty:11, desc:"1/8\" Mild Steel, 5' x 10'"            },
  { qty:1,  desc:"3/16\" Mild Steel, 4' x 8'"            },
  { qty:9,  desc:"1/4\" Mild Steel, 4' x 8'"             },
  { qty:4,  desc:"3/8\" Mild Steel, 4' x 8'"             },
  { qty:1,  desc:"1/2\" Mild Steel, 4' x 8'"             },
];

function calcMachineBuilds(machine, products) {
  if (!machine.components || machine.components.length === 0) return { max:0, bottlenecks:[], componentDetails:[] };
  let max = Infinity;
  const componentDetails = machine.components.map(comp => {
    const prod = products.find(p => p.id === comp.productId);
    const stock = prod ? prod.stock : 0;
    const canBuild = prod ? Math.floor(stock / comp.qty) : 0;
    if (canBuild < max) max = canBuild;
    return { ...comp, prod, stock, canBuild };
  });
  if (max === Infinity) max = 0;
  const minBuilds = Math.min(...componentDetails.map(c => c.canBuild));
  const bottlenecks = componentDetails.filter(c => c.canBuild === minBuilds && minBuilds < Infinity);
  return { max, bottlenecks, componentDetails };
}

function ImageThumb({ src, size = 44 }) {
  if (!src) return (
    <div style={{ width:size, height:size, background:'#1A1A26', border:'1px solid #2A2A35', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ fontSize:size*0.35, opacity:0.3 }}>📷</span>
    </div>
  );
  return <img src={src} alt="" style={{ width:size, height:size, objectFit:'cover', display:'block', flexShrink:0 }} />;
}

// ── Bar & Tube Reorder Rules (SW150 — per 20 machines) ───────────────────────
// stdLength = standard purchased length in ft. null = round up to nearest foot.
const BAR_TUBE_CATEGORIES = {
  HSS:        { label:'HSS Structural',        stdLength:24,   color:'#2B3FE0' },
  CRS_ROUND:  { label:'CRS Round Bar',         stdLength:20,   color:'#FF9500' },
  SS_ROUND:   { label:'304 SS Round Bar',      stdLength:12,   color:'#30D158' },
  SQUARE_BAR: { label:'Square Bar',            stdLength:12,   color:'#FF9500' },
  FLAT_BAR:   { label:'Flat Bar',              stdLength:12,   color:'#FF9500' },
  TUBE_HR:    { label:'Hot-Rolled Tube',       stdLength:24,   color:'#FF6B6B' },
  DOM:        { label:'DOM Tube',              stdLength:null, color:'#AF85E0' },
  KEYSTOCK:   { label:'Keystock',              stdLength:3,    color:'#FFD60A' },
  ALUMINUM:   { label:'Aluminum',              stdLength:null, color:'#A0C4FF' },
  NYLATRON:   { label:'Nylatron / Nylon Rod',  stdLength:10,   color:'#80FFDB' },
};

// Total footage required for 20 SW150 machines (from material requirements doc)
const BAR_TUBE_MATERIALS = [
  { name:'HSS 2" x 2" x 1/8"',              totalFt:83.33, category:'HSS'        },
  { name:'HSS 2" x 3" x 3/16"',             totalFt:80.00, category:'HSS'        },
  { name:'Round Bar Ø1/2" CRS',             totalFt:63.33, category:'CRS_ROUND'  },
  { name:'Round Bar Ø3/4" CRS',             totalFt:26.67, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" CRS',            totalFt:24.33, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" 1018 CRS',       totalFt:45.90, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" CRS',            totalFt:2.50,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.75" CRS',            totalFt:18.75, category:'CRS_ROUND'  },
  { name:'Round Bar Ø2.00" CRS',            totalFt:9.19,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø7/8" CRS',             totalFt:0.92,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" 304 SS',         totalFt:22.92, category:'SS_ROUND'   },
  { name:'Bar Square 1.50" 1018 CRS',       totalFt:18.75, category:'SQUARE_BAR' },
  { name:'Bar Flat 1/8" x 1/2" Steel',      totalFt:19.42, category:'FLAT_BAR'   },
  { name:'DOM Tube Ø1.50" x 0.120" CRS',    totalFt:15.00, category:'DOM'        },
  { name:'DOM Tube Ø2.375" x 0.310" Wall',  totalFt:22.08, category:'DOM'        },
  { name:'DOM Tube Ø3.50"/2.75" CRS',       totalFt:5.10,  category:'DOM'        },
  { name:'DOM Tube 2.00" x 0.25" CRS',      totalFt:22.08, category:'DOM'        },
  { name:'Tube 2.50" OD Hot-Rolled',        totalFt:63.33, category:'TUBE_HR'    },
  { name:'Tube 2.00" OD x 0.120"',          totalFt:3.33,  category:'TUBE_HR'    },
  { name:'Keystock 1/2" x 7/16"',           totalFt:5.52,  category:'KEYSTOCK'   },
  { name:'Keystock 3/8" x 3/8"',            totalFt:2.50,  category:'KEYSTOCK'   },
  { name:'Alu 1" x 2"',                     totalFt:2.50,  category:'ALUMINUM'   },
  { name:'SM Nylon Ø1.50" x 1.00"',         totalFt:41.25, category:'NYLATRON'   },
  { name:'Nylatron Ø1.75" x 2.125"',        totalFt:14.16, category:'NYLATRON'   },
  { name:'Nylatron Ø2.25" x 2.00"',         totalFt:6.66,  category:'NYLATRON'   },
  { name:'Nylatron Ø2.00" x 2.00"',         totalFt:6.66,  category:'NYLATRON'   },
];

// Rule: if totalFt < half a standard length → round up to nearest foot.
//       if totalFt ≥ half a standard length → round up to nearest full length multiple.
//       if no standard length (DOM / Aluminum) → always round up to nearest foot.
function calcReorderQty(totalFt, stdLength) {
  if (!stdLength) return Math.ceil(totalFt);
  if (totalFt < stdLength / 2) return Math.ceil(totalFt);
  return Math.ceil(totalFt / stdLength) * stdLength;
}

function calcLengths(orderQty, stdLength) {
  if (!stdLength) return null;
  return Math.ceil(orderQty / stdLength);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Inventory({ user, onSignOut }) {
  // ── Core data (Supabase-backed) ──────────────────────────────────────────
  const [products,  setProducts]  = useState([]);
  const [machines,  setMachines]  = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState('inventory');
  const [themeName,     setThemeName]     = useState('dark');
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [toast,         setToast]         = useState(null);
  const [lightbox,      setLightbox]      = useState(null);

  // Inventory
  const [search,        setSearch]        = useState('');
  const [category,      setCategory]      = useState('All');
  const [filterStatus,  setFilterStatus]  = useState('All');
  const [sortBy,        setSortBy]        = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [modal,         setModal]         = useState(null);
  const [form,          setForm]          = useState({});
  const [adjustQty,     setAdjustQty]     = useState('');
  const [adjustType,    setAdjustType]    = useState('add');

  // Machines
  const [machineModal,   setMachineModal]   = useState(null);
  const [machineForm,    setMachineForm]    = useState({ name:'', description:'', components:[] });
  const [commitQty,      setCommitQty]      = useState(1);
  const [confirmCommit,  setConfirmCommit]  = useState(null);

  // Suppliers / email
  const [supplierModal,       setSupplierModal]       = useState(null);
  const [supplierForm,        setSupplierForm]        = useState({});
  const [supplierProductSearch, setSupplierProductSearch] = useState('');
  const [emailDraft,          setEmailDraft]          = useState(null);
  const [emailDrafts,         setEmailDrafts]         = useState([]);
  const [buildAssemblyModal, setBuildAssemblyModal] = useState(null);
  const [buildAssemblyQty,   setBuildAssemblyQty]   = useState(1);

  const t = THEMES[themeName];
  const fileInputRef = useRef(null);

  // ── Supabase: initial load ────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    // Products (always exists)
    const pRes = await supabase.from('products').select('*').order('name');
    if (pRes.error) showToast('Error loading products: ' + pRes.error.message, 'error');
    else setProducts(pRes.data.map(dbProduct));

    // Machines (may not exist if migration hasn't run)
    const mRes = await supabase.from('machines').select('*, machine_components(*)').order('name');
    if (!mRes.error) setMachines(mRes.data.map(dbMachine));

    // Suppliers (may not exist if migration hasn't run)
    const sRes = await supabase.from('suppliers').select('*, supplier_products(product_id)').order('name');
    if (!sRes.error) setSuppliers(sRes.data.map(dbSupplier));

    setLoading(false);
  }

  // DB → app shape mappers
  function dbProduct(r) {
    return {
      id: r.id, sku: r.sku, name: r.name, category: r.category,
      stock: r.stock, minStock: r.min_stock, reorderQty: r.reorder_qty || 0,
      unit: r.unit, location: r.location, imageUrl: r.image_url,
      supplierId: r.supplier_id || null, partType: r.part_type || 'purchased',
      rawMaterials: r.raw_materials || [], bomComponents: r.bom_components || [], batchSize: r.batch_size || 0,
      leadTimeDays: r.lead_time_days || 0,
    };
  }
  function dbMachine(r) {
    return {
      id: r.id, name: r.name, description: r.description, imageUrl: r.image_url,
      components: (r.machine_components || []).map(c => ({
        productId: c.product_id, qty: c.qty, note: c.note || '',
      })),
    };
  }
  function dbSupplier(r) {
    return {
      id: r.id, name: r.name, email: r.email, phone: r.phone || '',
      contact: r.contact, notes: r.notes || '',
      products: (r.supplier_products || []).map(sp => sp.product_id),
    };
  }

  // ── Supabase: image upload ────────────────────────────────────────────────
  async function uploadImage(bucket, path, file) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { showToast('Image upload failed: ' + error.message, 'error'); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  // ── Supplier / email helpers ──────────────────────────────────────────────
  function getSupplierForProduct(productId) {
    return suppliers.find(s => s.products && s.products.includes(productId)) || null;
  }

  function generateEmailDraft(supplier, lowProducts) {
    const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const purchased   = lowProducts.filter(p => p.partType === 'purchased');
    const madeInHouse = lowProducts.filter(p => p.partType === 'made');

    const rawMap = new Map();
    madeInHouse.forEach(p => {
      const reorderQty = p.reorderQty || p.minStock || 1;
      const batchSize  = p.batchSize || 1;
      const batches    = Math.ceil(reorderQty / batchSize);
      (p.rawMaterials||[]).forEach(rm => {
        const key = `${rm.material}|${rm.type}|${rm.size}|${rm.unit}`;
        const qty = (parseFloat(rm.qtyPerBatch)||0) * batches;
        if (rawMap.has(key)) { rawMap.get(key).qty += qty; rawMap.get(key).skus.add(p.sku); }
        else rawMap.set(key, { material:rm.material, type:rm.type, size:rm.size, unit:rm.unit, qty, skus: new Set([p.sku]) });
      });
    });

    const purchasedLines = purchased.map(p =>
      `  ${p.name} — ${p.reorderQty||p.minStock} ${p.unit||'pcs'} (PO: ${p.sku})`
    );
    const rawLines = Array.from(rawMap.values()).map(rm => {
      const desc = [rm.material, rm.type, rm.size].filter(Boolean).join(', ');
      const qty  = rm.qty % 1 === 0 ? rm.qty : rm.qty.toFixed(2);
      const pos  = Array.from(rm.skus).join(', ');
      return `  ${desc} — ${qty} ${rm.unit} (PO: ${pos})`;
    });

    const orderSection = [...purchasedLines, ...rawLines].join('\n');

    const subject = `Purchase Order Request — ${today}`;
    const body = `Hello,

I would like to order the following

${orderSection}

Please confirm receipt and advise the expected delivery date at your earliest convenience. If you have any questions please do not hesitate to get in touch.

Thanks,
Butty Manufacturing
Purchasing Department`;

    const items = [
      ...purchased.map(p => ({ label:`${p.name} (${p.sku})`, detail:`${p.reorderQty||p.minStock} ${p.unit||'pcs'}`, isRaw:false })),
      ...Array.from(rawMap.values()).map(rm => ({
        label: [rm.material, rm.type, rm.size].filter(Boolean).join(', '),
        detail: `${rm.qty % 1 === 0 ? rm.qty : rm.qty.toFixed(2)} ${rm.unit}`,
        isRaw: true,
      })),
    ];
    return { supplier, items, subject, body };
  }

  function generateAllLowStockEmails() {
    const lowProducts = products.filter(p => ['out','low'].includes(getStockStatus(p.stock, p.minStock)));
    if (lowProducts.length === 0) { showToast('No products below minimum stock.', 'error'); return; }
    const bySupplier = new Map();
    lowProducts.forEach(p => {
      const sup = getSupplierForProduct(p.id);
      if (sup) {
        if (!bySupplier.has(sup.id)) bySupplier.set(sup.id, { supplier:sup, products:[] });
        bySupplier.get(sup.id).products.push(p);
      }
    });
    const noSupplier = lowProducts.filter(p => !getSupplierForProduct(p.id));
    const drafts = Array.from(bySupplier.values()).map(({ supplier, products:prods }) => generateEmailDraft(supplier, prods));
    if (drafts.length === 0) { showToast('No suppliers linked to low-stock items.', 'error'); return; }
    setEmailDrafts(drafts); setEmailDraft(drafts[0]);
    if (noSupplier.length > 0) showToast(`${noSupplier.length} item(s) have no supplier assigned.`, 'error');
  }

  function openSupplierEmail(supplier) {
    const supplierProducts = products.filter(p =>
      supplier.products?.includes(p.id) && ['out','low'].includes(getStockStatus(p.stock, p.minStock))
    );
    if (supplierProducts.length === 0) { showToast('No low-stock items for this supplier.', 'error'); return; }
    const draft = generateEmailDraft(supplier, supplierProducts);
    setEmailDrafts([draft]); setEmailDraft(draft);
  }

  function copyEmailToClipboard(draft) {
    const full = `To: ${draft.supplier.email}\nSubject: ${draft.subject}\n\n${draft.body}`;
    navigator.clipboard.writeText(full).then(() => showToast('Email copied to clipboard!'));
  }

  function openMailto(draft) {
    const url = `mailto:${draft.supplier.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
    window.open(url, '_blank');
    showToast('Opening your email client…');
  }

  function dismissDraft() {
    const remaining = emailDrafts.filter(d => d !== emailDraft);
    if (remaining.length > 0) { setEmailDraft(remaining[0]); setEmailDrafts(remaining); }
    else { setEmailDraft(null); setEmailDrafts([]); }
  }

  // ── Supplier CRUD ─────────────────────────────────────────────────────────
  async function saveSupplier() {
    if (!supplierForm.name) return;
    setSaving(true);
    const payload = {
      name: supplierForm.name, email: supplierForm.email || '',
      phone: supplierForm.phone || '', contact: supplierForm.contact || '',
      notes: supplierForm.notes || '',
    };
    let supplierId;
    if (supplierModal.mode === 'add') {
      const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      supplierId = data.id;
    } else {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', supplierForm.id);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      supplierId = supplierForm.id;
    }
    // Sync supplier_products
    try {
      await supabase.from('supplier_products').delete().eq('supplier_id', supplierId);
      const linked = supplierForm.products || [];
      if (linked.length > 0) {
        await supabase.from('supplier_products').insert(linked.map(pid => ({ supplier_id: supplierId, product_id: pid })));
      }
    } catch(e) { /* migration not yet run */ }

    showToast(supplierModal.mode === 'add' ? 'Supplier added!' : 'Supplier updated!');
    await loadAll();
    setSaving(false);
    setSupplierProductSearch('');
    setSupplierModal(null);
  }

  async function deleteSupplier(id) {
    if (!confirm('Delete this supplier?')) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Supplier deleted.'); await loadAll(); }
  }

  // ── Inventory helpers ─────────────────────────────────────────────────────
  const categories = useMemo(() =>
    ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))],
    [products]
  );

  const stats = useMemo(() => ({
    total: products.length,
    out:   products.filter(p => getStockStatus(p.stock, p.minStock) === 'out').length,
    low:   products.filter(p => getStockStatus(p.stock, p.minStock) === 'low').length,
    ok:    products.filter(p => getStockStatus(p.stock, p.minStock) === 'ok').length,
  }), [products]);

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
      const matchCat    = category === 'All' || p.category === category;
      const status      = getStockStatus(p.stock, p.minStock);
      const matchStatus = filterStatus === 'All' || status === filterStatus;
      return matchSearch && matchCat && matchStatus;
    });
    return [...list].sort((a,b) => {
      let av=a[sortBy], bv=b[sortBy];
      if (typeof av === 'string') av=av.toLowerCase(), bv=bv.toLowerCase();
      return sortDir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1);
    });
  }, [products, search, category, filterStatus, sortBy, sortDir]);

  function openAdd()    { setForm({ sku:'', name:'', category:'', stock:'', minStock:'', reorderQty:'', unit:'pcs', location:'', imageUrl:null, machineLinks:[], supplierId:null, partType:'purchased', rawMaterials:[], bomComponents:[], batchSize:'', leadTimeDays:'' }); setModal({ mode:'add' }); }
  function openEdit(p)  {
    const links = machines
      .filter(m => m.components.some(c => c.productId === p.id))
      .map(m => { const comp = m.components.find(c => c.productId === p.id); return { machineId:m.id, qty:comp.qty, note:comp.note||'' }; });
    setForm({ ...p, machineLinks:links, supplierId:p.supplierId||null, partType:p.partType||'purchased', rawMaterials:p.rawMaterials||[], bomComponents:p.bomComponents||[], batchSize:p.batchSize||'', leadTimeDays:p.leadTimeDays||'' });
    setModal({ mode:'edit', product:p });
  }
  function openAdjust(p) { setAdjustQty(''); setAdjustType('add'); setModal({ mode:'adjust', product:p }); }
  function closeModal()  { setModal(null); }

  async function saveProduct() {
    if (!form.name || !form.sku) return;
    setSaving(true);
    const id = modal.mode === 'add' ? crypto.randomUUID() : form.id;
    let imageUrl = form.imageUrl || null;
    if (form._imageFile) {
      const ext = form._imageFile.name.split('.').pop();
      imageUrl = await uploadImage('product-images', `${id}.${ext}`, form._imageFile);
    }

    const payload = {
      id, sku:form.sku, name:form.name, category:form.category,
      stock:parseInt(form.stock)||0, min_stock:parseInt(form.minStock)||0,
      reorder_qty:parseInt(form.reorderQty)||0, unit:form.unit||'pcs',
      location:form.location, image_url:imageUrl,
      supplier_id:form.supplierId||null, part_type:form.partType||'purchased',
      raw_materials:form.partType==='made'?(form.rawMaterials||[]):[],
      bom_components:form.partType==='subassembly'?(form.bomComponents||[]):[],
      batch_size:parseInt(form.batchSize)||0, lead_time_days:parseInt(form.leadTimeDays)||0,
    };
    const { error: pErr } = await supabase.from('products').upsert(payload);
    if (pErr) { showToast('Save failed: ' + pErr.message, 'error'); setSaving(false); return; }

    // Sync supplier_products (silently skip if table doesn't exist yet)
    try {
      await supabase.from('supplier_products').delete().eq('product_id', id);
      if (form.supplierId) {
        await supabase.from('supplier_products').insert({ supplier_id:form.supplierId, product_id:id });
      }
    } catch(e) { /* migration not yet run */ }

    // Sync machine_components from machineLinks (silently skip if table doesn't exist yet)
    try {
      await supabase.from('machine_components').delete().eq('product_id', id);
      const links = form.machineLinks || [];
      if (links.length > 0) {
        await supabase.from('machine_components').insert(
          links.map(l => ({ machine_id:l.machineId, product_id:id, qty:l.qty, note:l.note||'' }))
        );
      }
    } catch(e) { /* migration not yet run */ }

    showToast(modal.mode === 'add' ? 'Product added!' : 'Product updated!');
    await loadAll();
    setSaving(false);
    closeModal();
  }

  async function applyAdjust() {
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty < 0) return;
    setSaving(true);
    const p = modal.product;
    const newStock = adjustType === 'add' ? p.stock + qty : Math.max(0, p.stock - qty);
    const { error } = await supabase.from('products').update({ stock:newStock }).eq('id', p.id);
    if (error) showToast('Update failed: ' + error.message, 'error');
    else { showToast('Stock updated!'); await loadAll(); }
    setSaving(false);
    closeModal();
  }

  async function buildAssembly() {
    const product = buildAssemblyModal;
    const qty = parseInt(buildAssemblyQty);
    if (!product || isNaN(qty) || qty < 1) return;
    const bom = product.bomComponents || [];
    // Validate all components have enough stock
    for (const comp of bom) {
      const compProd = products.find(p => p.id === comp.productId);
      if (!compProd) { showToast(`Component not found in inventory.`, 'error'); return; }
      if (compProd.stock < comp.qty * qty) {
        showToast(`Not enough ${compProd.name} — need ${comp.qty * qty}, have ${compProd.stock}.`, 'error');
        return;
      }
    }
    setSaving(true);
    // Deduct each component — bail on first failure to avoid partial deduction
    for (const comp of bom) {
      const compProd = products.find(p => p.id === comp.productId);
      const { error } = await supabase
        .from('products')
        .update({ stock: compProd.stock - (comp.qty * qty) })
        .eq('id', compProd.id);
      if (error) {
        showToast(`Failed to deduct ${compProd.name} — no stock was changed. Please try again.`, 'error');
        setSaving(false);
        await loadAll(); // re-sync to known-good state
        return;
      }
    }
    // All components deducted successfully — increment assembly stock
    const { error: assemblyError } = await supabase
      .from('products')
      .update({ stock: product.stock + qty })
      .eq('id', product.id);
    if (assemblyError) {
      showToast(`Components deducted but failed to increment ${product.name} stock. Please adjust manually.`, 'error');
    } else {
      showToast(`Built ${qty}× ${product.name} — components deducted.`);
    }
    await loadAll();
    setSaving(false);
    setBuildAssemblyModal(null);
    setBuildAssemblyQty(1);
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Product deleted.'); await loadAll(); }
  }

  async function handleRowImageFile(productId, file) {
    if (!file || !file.type.startsWith('image/')) return;
    setSaving(true);
    const ext = file.name.split('.').pop();
    const imageUrl = await uploadImage('product-images', `${productId}.${ext}`, file);
    if (imageUrl) {
      const { error } = await supabase.from('products').update({ image_url:imageUrl }).eq('id', productId);
      if (error) showToast('Failed to save image', 'error');
      else { showToast('Photo saved!'); await loadAll(); }
    }
    setSaving(false);
  }

  function handleFormImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setForm(f => ({ ...f, imageUrl:e.target.result, _imageFile:file }));
    reader.readAsDataURL(file);
  }

  function toggleSort(field) {
    if (sortBy===field) setSortDir(d => d==='asc'?'desc':'asc');
    else { setSortBy(field); setSortDir('asc'); }
  }

  // ── Machine helpers ───────────────────────────────────────────────────────
  function openAddMachine()  { setMachineForm({ name:'', description:'', imageUrl:null, components:[] }); setMachineModal({ mode:'add' }); }
  function openEditMachine(m){ setMachineForm({ ...m, components:[...m.components.map(c=>({...c}))] }); setMachineModal({ mode:'edit', machine:m }); }
  function openViewMachine(m){ setMachineModal({ mode:'view', machine:m }); }

  function handleMachineImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setMachineForm(f => ({ ...f, imageUrl:e.target.result, _imageFile:file }));
    reader.readAsDataURL(file);
  }

  async function saveMachine() {
    if (!machineForm.name) return;
    setSaving(true);
    let imageUrl = machineForm.imageUrl || null;
    let machineId;
    if (machineForm._imageFile) {
      const ext = machineForm._imageFile.name.split('.').pop();
      const tmpId = machineModal.mode === 'add' ? crypto.randomUUID() : machineModal.machine.id;
      imageUrl = await uploadImage('machine-images', `${tmpId}.${ext}`, machineForm._imageFile);
      machineId = tmpId;
    }
    const payload = { name:machineForm.name, description:machineForm.description||'', image_url:imageUrl };
    if (machineModal.mode === 'add') {
      const { data, error } = await supabase.from('machines').insert(payload).select().single();
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      machineId = data.id;
    } else {
      machineId = machineModal.machine.id;
      const { error } = await supabase.from('machines').update(payload).eq('id', machineId);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
    }
    // Sync components
    await supabase.from('machine_components').delete().eq('machine_id', machineId);
    const comps = machineForm.components.filter(c => c.productId);
    if (comps.length > 0) {
      await supabase.from('machine_components').insert(
        comps.map(c => ({ machine_id:machineId, product_id:c.productId, qty:c.qty, note:c.note||'' }))
      );
    }
    showToast(machineModal.mode === 'add' ? 'Machine added!' : 'Machine updated!');
    await loadAll();
    setSaving(false);
    setMachineModal(null);
  }

  async function deleteMachine(id) {
    if (!confirm('Delete this machine?')) return;
    const { error } = await supabase.from('machines').delete().eq('id', id);
    if (error) showToast('Delete failed: ' + error.message, 'error');
    else { showToast('Machine deleted.'); await loadAll(); }
  }

  function addComponent()    { setMachineForm(f => ({ ...f, components:[...f.components, { productId:'', qty:1, note:'' }] })); }
  function updateComponent(idx, field, val) {
    setMachineForm(f => { const comps=[...f.components]; comps[idx]={...comps[idx],[field]:field==='qty'||field==='productId'?(parseInt(val)||''):val}; return {...f,components:comps}; });
  }
  function removeComponent(idx) { setMachineForm(f => ({ ...f, components:f.components.filter((_,i)=>i!==idx) })); }

  async function commitBuild(machine, qty) {
    const { max, componentDetails } = calcMachineBuilds(machine, products);
    if (qty > max) { showToast(`Cannot build ${qty} — only ${max} possible.`, 'error'); return; }
    setSaving(true);
    // Deduct each component — bail on first failure to avoid partial deduction
    for (const c of componentDetails) {
      const newStock = c.prod.stock - (c.qty * qty);
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', c.productId);
      if (error) {
        showToast(`Failed to deduct ${c.prod.name} — no stock was changed. Please try again.`, 'error');
        setSaving(false);
        await loadAll(); // re-sync to known-good state
        return;
      }
    }
    showToast(`✓ ${qty}× ${machine.name} committed — stock deducted.`);
    await loadAll();
    setSaving(false);
    setConfirmCommit(null);
    setMachineModal(null);
  }

  const alerts = products.filter(p => ['out','low'].includes(getStockStatus(p.stock, p.minStock)));

  // ── Steel plate reorder rule ─────────────────────────────────────────────
  const steelPlateRule = useMemo(() => {
    // Only S15 parts whose raw materials include a steel plate entry
    const s15Parts = products.filter(p =>
      p.sku?.toUpperCase().startsWith('S15') &&
      (p.rawMaterials || []).some(rm =>
        (rm.type     || '').toLowerCase().includes('plate') ||
        (rm.material || '').toLowerCase().includes('plate')
      )
    );
    const russellMetals = suppliers.find(s => s.name?.toLowerCase().includes('russel'));

    const parts = s15Parts.map(p => {
      // Sum how many of this part are needed across every machine that uses it
      let qtyPerMachineSet = 0;
      machines.forEach(m => {
        const comp = m.components.find(c => c.productId === p.id);
        if (comp) qtyPerMachineSet += comp.qty;
      });
      const threshold = qtyPerMachineSet * 5;
      const triggered = threshold > 0 && p.stock <= threshold;
      const status = getStockStatus(p.stock, p.minStock);
      return { ...p, qtyPerMachineSet, threshold, triggered, status };
    });

    const triggered = parts.some(p => p.triggered);
    return { triggered, parts, supplier: russellMetals || null };
  }, [products, machines, suppliers]);

  function generateSteelPlateEmail() {
    const sup = steelPlateRule.supplier;
    if (!sup) { showToast('Russell Metals not found in suppliers — please add them first.', 'error'); return; }
    const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
    const orderLines = STEEL_PLATE_ORDER.map(i => `  (${i.qty}x)  ${i.desc}`).join('\n');
    const subject = `Steel Plate Purchase Order — ${today}`;
    const body = `Hello,\n\nPlease find below our steel plate order requirements:\n\n${orderLines}\n\nPlease confirm receipt and advise the expected delivery date at your earliest convenience. If you have any questions please do not hesitate to get in touch.\n\nThanks,\nButty Manufacturing\nPurchasing Department`;
    const draft = {
      supplier: sup,
      subject,
      body,
      items: STEEL_PLATE_ORDER.map(i => ({ label: i.desc, detail: `${i.qty}x`, isRaw: true })),
    };
    setEmailDrafts([draft]);
    setEmailDraft(draft);
  }

  const STAT_CARDS = [
    { label:'Total SKUs',   value:stats.total, color:'#FFE033', filter:'All' },
    { label:'In Stock',     value:stats.ok,    color:'#30D158', filter:'ok'  },
    { label:'Low Stock',    value:stats.low,   color:'#FF9500', filter:'low' },
    { label:'Out of Stock', value:stats.out,   color:'#FF3B3B', filter:'out' },
  ];


  // ── Styles ───────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#444;border-radius:3px}
    input,select{outline:none}
    .row-hover:hover{background:${t.rowHover}!important}
    .btn-primary{background:${t.accent};color:#fff;border:none;padding:9px 20px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;cursor:pointer;letter-spacing:0.08em;text-transform:uppercase;transition:opacity 0.15s}
    .btn-primary:hover{opacity:0.85}
    .btn-ghost{background:transparent;color:${t.textMid};border:1px solid ${t.borderStrong};padding:7px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:0.06em;transition:all 0.15s}
    .btn-ghost:hover{border-color:${t.textDim};color:${t.text}}
    .btn-danger{background:transparent;color:#FF3B3B;border:1px solid rgba(255,59,59,0.3);padding:5px 10px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all 0.15s}
    .btn-danger:hover{background:rgba(255,59,59,0.1)}
    .btn-success{background:rgba(48,209,88,0.15);color:#30D158;border:1px solid rgba(48,209,88,0.4);padding:7px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;letter-spacing:0.06em;transition:all 0.15s}
    .btn-success:hover{background:rgba(48,209,88,0.25)}
    .chip{display:inline-flex;align-items:center;padding:3px 10px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;border:1px solid transparent;transition:all 0.15s}
    .chip.active{border-color:${t.text};color:${t.text}}
    .chip:not(.active){color:${t.textDim};border-color:${t.border}}
    .chip:not(.active):hover{border-color:${t.textMid};color:${t.textMid}}
    .field-input{background:${t.inputBg};border:1px solid ${t.borderStrong};color:${t.text};padding:9px 12px;font-family:'DM Mono',monospace;font-size:12px;width:100%;transition:border-color 0.15s}
    .field-input:focus{border-color:${t.accent}}
    .field-input::placeholder{color:${t.textDim}}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
    .modal-box{background:${t.modalBg};border:1px solid ${t.borderStrong};padding:32px;width:560px;max-width:96vw;max-height:92vh;overflow-y:auto}
    .sort-btn{background:none;border:none;color:inherit;cursor:pointer;font-family:inherit;font-size:inherit;display:flex;align-items:center;gap:4px;padding:0}
    .sort-btn:hover{color:${t.text}}
    .lightbox{position:fixed;inset:0;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(8px);cursor:zoom-out}
    .toast{position:fixed;bottom:28px;right:28px;padding:12px 20px;font-size:12px;letter-spacing:0.06em;z-index:300;border:1px solid;animation:fadeIn 0.2s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    .stat-card{padding:20px 24px;cursor:pointer;transition:all 0.2s}
    .stat-card:hover{transform:translateY(-1px)}
    .machine-card{border:1px solid ${t.border};background:${t.cardBg};padding:24px;transition:border-color 0.2s}
    .machine-card:hover{border-color:${t.borderStrong}}
    .tab-btn{padding:10px 24px;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border:none;transition:all 0.2s}
    .tab-btn.active{background:${t.accent};color:#fff}
    .tab-btn:not(.active){background:transparent;color:${t.textDim};border-bottom:2px solid transparent}
    .tab-btn:not(.active):hover{color:${t.text}}
    .settings-panel{position:absolute;top:72px;right:40px;background:${t.modalBg};border:1px solid ${t.borderStrong};padding:24px;width:280px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:fadeIn 0.15s ease}
    .theme-swatch{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;border:1px solid transparent;transition:all 0.15s;margin-bottom:6px}
    .theme-swatch:hover{border-color:${t.borderStrong}}
    .theme-swatch.selected{border-color:${t.accent};background:rgba(100,100,255,0.05)}
    .bom-row{display:grid;grid-template-columns:1fr auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid ${t.border};margin-bottom:6px;background:${t.inputBg}}
    .build-bar{height:6px;border-radius:3px;overflow:hidden;background:${t.border};margin-top:4px}
    .build-bar-inner{height:100%;border-radius:3px;transition:width 0.4s ease}
    .bottleneck-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);padding:2px 8px;letter-spacing:0.06em}
  `;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#0A0A0F', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Mono',monospace", color:'#555', fontSize:13, letterSpacing:'0.1em' }}>
      Loading…
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.text, fontFamily:"'DM Mono','Fira Mono',monospace", transition:"background 0.3s,color 0.3s" }}>
      <style>{css}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom:`1px solid ${t.border}`, padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", background:t.headerBg, minHeight:72, position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:18 }}>
          <img src={LOGO} alt="Butty" style={{ height:48, width:48, objectFit:"contain" }} />
          <div style={{ width:1, height:36, background:t.borderStrong }} />
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, letterSpacing:"0.12em", color:t.text, textTransform:"uppercase" }}>Butty Manufacturing</div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.16em", marginTop:1 }}>FINISHED GOODS INVENTORY SYSTEM</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {user && <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.06em", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.email}</div>}
          <button onClick={onSignOut} style={{ background:"transparent", color:t.textDim, border:`1px solid ${t.borderStrong}`, padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.15s" }}>
            Sign Out
          </button>
          <button onClick={()=>setSettingsOpen(o=>!o)} style={{ background:settingsOpen?t.accent:"transparent", color:settingsOpen?"#fff":t.textMid, border:`1px solid ${settingsOpen?t.accent:t.borderStrong}`, padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.15s" }}>
            ⚙ Settings
          </button>
          {activeTab==="inventory" && <button className="btn-primary" onClick={openAdd}>+ Add Product</button>}
          {activeTab==="machines"  && <button className="btn-primary" onClick={openAddMachine}>+ Add Machine</button>}
          {activeTab==="suppliers" && <button className="btn-primary" onClick={()=>{ setSupplierForm({name:"",email:"",phone:"",contact:"",products:[],notes:""}); setSupplierModal({mode:"add"}); }}>+ Add Supplier</button>}
          {(activeTab==="inventory"||activeTab==="suppliers") && (() => {
            const lowCount = products.filter(p => ["out","low"].includes(getStockStatus(p.stock, p.minStock))).length;
            return lowCount > 0 ? (
              <button onClick={generateAllLowStockEmails} style={{ background:"rgba(255,149,0,0.15)", color:"#FF9500", border:"1px solid rgba(255,149,0,0.4)", padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", letterSpacing:"0.06em", display:"flex", alignItems:"center", gap:6 }}>
                ✉ Reorder ({lowCount})
              </button>
            ) : null;
          })()}
          {steelPlateRule.triggered && (
            <button onClick={()=>setActiveTab('reorder')} style={{ background:"rgba(255,59,59,0.15)", color:"#FF3B3B", border:"1px solid rgba(255,59,59,0.4)", padding:"7px 14px", fontFamily:"'DM Mono',monospace", fontSize:11, cursor:"pointer", letterSpacing:"0.06em", display:"flex", alignItems:"center", gap:6, animation:"pulse 2s infinite" }}>
              🔴 Steel Plate Reorder
            </button>
          )}
        </div>

        {/* Settings Panel */}
        {settingsOpen && (
          <div className="settings-panel" onClick={e=>e.stopPropagation()}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:t.text, marginBottom:4 }}>Settings</div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.12em", marginBottom:20, textTransform:"uppercase" }}>Appearance</div>
            <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Colour Theme</div>
            {Object.entries(THEMES).map(([key,theme]) => (
              <div key={key} className={`theme-swatch ${themeName===key?"selected":""}`} onClick={()=>{ setThemeName(key); setSettingsOpen(false); }}>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <div style={{ width:14, height:14, borderRadius:"50%", background:theme.bg, border:`2px solid ${theme.borderStrong}` }} />
                  <div style={{ width:14, height:14, borderRadius:"50%", background:theme.accent }} />
                  <div style={{ width:14, height:14, borderRadius:"50%", background:theme.cardBg, border:`2px solid ${theme.borderStrong}` }} />
                </div>
                <div style={{ fontSize:12, color:t.text, letterSpacing:"0.04em" }}>{theme.name}</div>
                {themeName===key && <div style={{ marginLeft:"auto", fontSize:10, color:t.accent }}>✓ Active</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      {settingsOpen && <div style={{ position:"fixed", inset:0, zIndex:40 }} onClick={()=>setSettingsOpen(false)} />}

      {/* ── Tabs ── */}
      <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:"0 40px", display:"flex", gap:0 }}>
        {[["inventory","📦  Inventory"],["machines","🔧  Machine Builder"],["suppliers","🏢  Suppliers"],["reorder","🔁  Reorder Rules"]].map(([tab,label]) => (
          <button key={tab} className={`tab-btn ${activeTab===tab?"active":""}`} onClick={()=>setActiveTab(tab)} style={tab==="reorder"&&steelPlateRule.triggered?{color:"#FF3B3B"}:{}}>
            {label}{tab==="reorder"&&steelPlateRule.triggered?" ●":""}
          </button>
        ))}
      </div>

      {/* ══════════════════════ INVENTORY TAB ══════════════════════ */}
      {activeTab==="inventory" && (
        <div style={{ padding:"28px 40px", maxWidth:1400, margin:"0 auto" }}>

          {/* Stat cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
            {STAT_CARDS.map(s => {
              const isActive = filterStatus===s.filter;
              return (
                <div key={s.label} className="stat-card" onClick={()=>setFilterStatus(isActive?"All":s.filter)}
                  style={{ background:isActive?`rgba(${s.color==="#FFE033"?"255,224,51":s.color==="#30D158"?"48,209,88":s.color==="#FF9500"?"255,149,0":"255,59,59"},0.08)`:t.cardBg, border:`1px solid ${isActive?s.color:t.border}` }}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.borderColor=s.color; }}
                  onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.borderColor=t.border; }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ fontSize:10, color:isActive?s.color:t.textDim, letterSpacing:"0.12em", textTransform:"uppercase" }}>{s.label}</div>
                    {isActive && <div style={{ fontSize:9, color:s.color, border:`1px solid ${s.color}`, padding:"2px 6px" }}>ACTIVE</div>}
                  </div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:700, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:9, color:isActive?s.color:t.textFaint, letterSpacing:"0.08em", marginTop:8 }}>{isActive?"click to clear ✕":"click to filter →"}</div>
                </div>
              );
            })}
          </div>

          {/* Alerts */}
          {alerts.length>0 && (
            <div style={{ background:"rgba(255,59,59,0.08)", border:"1px solid rgba(255,59,59,0.2)", padding:"10px 18px", display:"flex", alignItems:"center", gap:12, fontSize:11, letterSpacing:"0.06em", marginBottom:22 }}>
              <span style={{ color:"#FF3B3B", fontSize:14 }}>⚠</span>
              <span style={{ color:"#FF9090" }}>{alerts.length} product{alerts.length>1?"s":""} need attention:</span>
              <span style={{ color:t.textDim }}>{alerts.map(a=>a.name).join(" · ")}</span>
            </div>
          )}

          {/* Filters */}
          <div style={{ display:"flex", gap:12, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
            <input className="field-input" style={{ width:240 }} placeholder="Search SKU or name..." value={search} onChange={e=>setSearch(e.target.value)} />
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {categories.map(c => <span key={c} className={`chip ${category===c?"active":""}`} onClick={()=>setCategory(c)}>{c}</span>)}
            </div>
            <div style={{ display:"flex", gap:6, marginLeft:"auto" }}>
              {["All","ok","warning","low","out"].map(s => (
                <span key={s} className={`chip ${filterStatus===s?"active":""}`} onClick={()=>setFilterStatus(s)}>
                  {s==="All"?"All Status":STATUS_META[s].label}
                </span>
              ))}
            </div>
          </div>

          {filterStatus!=="All" && (
            <div style={{ marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ fontSize:11, color:STATUS_META[filterStatus]?.color||t.text, letterSpacing:"0.08em" }}>
                Showing: {filterStatus==="ok"?"In Stock":filterStatus==="low"?"Low Stock":filterStatus==="out"?"Out of Stock":filterStatus} ({filtered.length} products)
              </div>
              <button onClick={()=>setFilterStatus("All")} style={{ background:"none", border:`1px solid ${t.borderStrong}`, color:t.textDim, fontSize:10, padding:"2px 8px", cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.06em" }}>clear ✕</button>
            </div>
          )}

          {/* Table */}
          <div style={{ border:`1px solid ${t.border}`, overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${t.border}`, background:t.cardBg }}>
                  {[{label:"Photo",field:null},{label:"SKU",field:"sku"},{label:"Product Name",field:"name"},{label:"Category",field:"category"},{label:"Location",field:"location"},{label:"Stock",field:"stock"},{label:"Min Level",field:"minStock"},{label:"Status",field:null},{label:"Actions",field:null}].map(col=>(
                    <th key={col.label} style={{ padding:"12px 16px", textAlign:"left", color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", fontSize:10, fontWeight:500, whiteSpace:"nowrap" }}>
                      {col.field ? (
                        <button className="sort-btn" style={{ color:sortBy===col.field?t.text:t.textDim }} onClick={()=>toggleSort(col.field)}>
                          {col.label} {sortBy===col.field?(sortDir==="asc"?"↑":"↓"):""}
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={9} style={{ padding:"40px", textAlign:"center", color:t.textFaint }}>No products found.</td></tr>}
                {filtered.map((p,i) => {
                  const status=getStockStatus(p.stock,p.minStock), sm=STATUS_META[status];
                  const pct=Math.min(100,Math.round((p.stock/(p.minStock*2))*100));
                  return (
                    <tr key={p.id} className="row-hover" style={{ borderBottom:`1px solid ${t.border}`, background:i%2===0?"transparent":t.rowAlt }}>
                      <td style={{ padding:"10px 16px" }}>
                        {p.imageUrl ? (
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                            <button onClick={()=>setLightbox(p)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}><ImageThumb src={p.imageUrl} size={44} /></button>
                            <label style={{ fontSize:9, color:t.textDim, cursor:"pointer", fontFamily:"inherit", textDecoration:"underline" }}>replace<input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ handleRowImageFile(p.id,e.target.files[0]); e.target.value=""; }} /></label>
                          </div>
                        ) : (
                          <label style={{ background:t.cardBg, border:`1px dashed ${t.borderStrong}`, width:44, height:44, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", gap:2 }}
                            onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent}
                            onMouseLeave={e=>e.currentTarget.style.borderColor=t.borderStrong}>
                            <span style={{ fontSize:16 }}>📷</span>
                            <span style={{ fontSize:8, color:t.textDim, fontFamily:"inherit" }}>ADD</span>
                            <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ handleRowImageFile(p.id,e.target.files[0]); e.target.value=""; }} />
                          </label>
                        )}
                      </td>
                      <td style={{ padding:"10px 16px", color:t.textMid, fontWeight:500 }}>{p.sku}</td>
                      <td style={{ padding:"10px 16px", color:t.text }}>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <span>{p.name}</span>
                          {p.partType==="made" && (
                            <span style={{ fontSize:9, color:"#FF9500", border:"1px solid rgba(255,149,0,0.4)", padding:"1px 5px", letterSpacing:"0.06em", flexShrink:0 }}>MADE</span>
                          )}
                          {p.partType==="subassembly" && (
                            <span style={{ fontSize:9, color:"#64D2FF", border:"1px solid rgba(100,210,255,0.4)", padding:"1px 5px", letterSpacing:"0.06em", flexShrink:0 }}>🔩 ASSEMBLY</span>
                          )}
                        </div>
                        {(() => {
                          const sup = getSupplierForProduct(p.id);
                          const usedIn = machines.filter(m => m.components.some(c => c.productId===p.id));
                          return (
                            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:4 }}>
                              {sup && (
                                <span style={{ fontSize:9, color:"#30D158", border:"1px solid rgba(48,209,88,0.35)", padding:"1px 6px", letterSpacing:"0.06em", opacity:0.9 }}>
                                  🏢 {sup.name}
                                </span>
                              )}
                              {usedIn.map(m => {
                                const comp = m.components.find(c => c.productId===p.id);
                                return (
                                  <span key={m.id} style={{ fontSize:9, color:t.accent, border:`1px solid ${t.accent}`, padding:"1px 6px", letterSpacing:"0.06em", opacity:0.8 }}>
                                    {m.name} ×{comp.qty}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding:"10px 16px", color:t.textDim }}>{p.category}</td>
                      <td style={{ padding:"10px 16px", color:t.textDim }}>{p.location}</td>
                      <td style={{ padding:"10px 16px" }}>
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <span style={{ color:sm.color, fontWeight:500 }}>{p.stock.toLocaleString()} {p.unit}</span>
                          <div style={{ height:3, background:t.borderStrong, width:80, borderRadius:2, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:sm.color, borderRadius:2 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"10px 16px", color:t.textDim }}>{p.minStock.toLocaleString()} {p.unit}</td>
                      <td style={{ padding:"10px 16px" }}>
                        <span style={{ background:sm.bg, color:sm.color, padding:"3px 10px", fontSize:10, letterSpacing:"0.08em", textTransform:"uppercase", display:"inline-flex", alignItems:"center", gap:5 }}>
                          <span style={{ width:5, height:5, borderRadius:"50%", background:sm.dot, display:"inline-block" }} />{sm.label}
                        </span>
                      </td>
                      <td style={{ padding:"10px 16px" }}>
                        <div style={{ display:"flex", gap:6 }}>
                          {p.partType==="subassembly" && (
                            <button className="btn-ghost" style={{ color:"#64D2FF", borderColor:"rgba(100,210,255,0.4)" }} onClick={()=>{ setBuildAssemblyQty(1); setBuildAssemblyModal(p); }}>Build</button>
                          )}
                          <button className="btn-ghost" onClick={()=>openAdjust(p)}>Adjust</button>
                          <button className="btn-ghost" onClick={()=>openEdit(p)}>Edit</button>
                          <button className="btn-danger" onClick={()=>deleteProduct(p.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:12, fontSize:10, color:t.textFaint, letterSpacing:"0.08em" }}>SHOWING {filtered.length} OF {products.length} PRODUCTS</div>
        </div>
      )}

      {/* ══════════════════════ MACHINE BUILDER TAB ══════════════════════ */}
      {activeTab==="machines" && (
        <div style={{ padding:"28px 40px", maxWidth:1400, margin:"0 auto" }}>

          {/* Summary banner */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>
            {machines.map(m => {
              const { max, bottlenecks } = calcMachineBuilds(m, products);
              const color = max===0?"#FF3B3B":max<3?"#FF9500":"#30D158";
              return (
                <div key={m.id} style={{ background:t.cardBg, border:`1px solid ${max===0?"rgba(255,59,59,0.4)":max<3?"rgba(255,149,0,0.3)":t.border}`, padding:"20px 24px", cursor:"pointer", transition:"all 0.2s", overflow:"hidden", position:"relative" }}
                  onClick={()=>openViewMachine(m)}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=color}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=max===0?"rgba(255,59,59,0.4)":max<3?"rgba(255,149,0,0.3)":t.border}>
                  {m.imageUrl && (
                    <div style={{ position:"absolute", inset:0, backgroundImage:`url(${m.imageUrl})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.12 }} />
                  )}
                  <div style={{ position:"relative" }}>
                  <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8, textDecoration:"underline", textUnderlineOffset:3 }}>{m.name}</div>
                  <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:6 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:700, color, lineHeight:1 }}>{max}</div>
                    <div style={{ fontSize:11, color:t.textDim }}>buildable</div>
                  </div>
                  {bottlenecks.length>0 && max<Infinity && (
                    <div style={{ fontSize:10, color:"#FF9500", display:"flex", alignItems:"center", gap:5, marginTop:4 }}>
                      <span>⚠</span> Bottleneck: {bottlenecks.map(b=>b.prod?.name||"Unknown").join(", ")}
                    </div>
                  )}
                  <div style={{ fontSize:9, color:t.textFaint, marginTop:8, letterSpacing:"0.06em" }}>{m.components.length} components · click to view</div>
                  </div>
                </div>
              );
            })}
            {machines.length===0 && (
              <div style={{ gridColumn:"1/-1", padding:"48px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:12 }}>
                No machines defined yet. Click "+ Add Machine" to create your first Bill of Materials.
              </div>
            )}
          </div>

          {/* Machine cards detail */}
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {machines.map(m => {
              const { max, bottlenecks, componentDetails } = calcMachineBuilds(m, products);
              const maxCap = Math.max(1, ...componentDetails.map(c=>c.canBuild));
              const statusColor = max===0?"#FF3B3B":max<3?"#FF9500":"#30D158";
              return (
                <div key={m.id} className="machine-card">
                  {/* Machine header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                    <div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text, marginBottom:4, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:3 }} onClick={()=>openViewMachine(m)}>{m.name}</div>
                      {m.description && <div style={{ fontSize:11, color:t.textDim }}>{m.description}</div>}
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ textAlign:"right", marginRight:8 }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:700, color:statusColor, lineHeight:1 }}>{max}</div>
                        <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em" }}>MAX BUILDS</div>
                      </div>
                      <button className="btn-success" onClick={()=>{ setCommitQty(Math.min(1,max)); setConfirmCommit(m); }} disabled={max===0} style={{ opacity:max===0?0.4:1, cursor:max===0?"not-allowed":"pointer" }}>
                        ✓ Commit Build
                      </button>
                      <button className="btn-ghost" onClick={()=>openEditMachine(m)}>Edit BOM</button>
                      <button className="btn-danger" onClick={()=>deleteMachine(m.id)}>✕</button>
                    </div>
                  </div>

                  {/* Component breakdown */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
                    {componentDetails.map((c,idx) => {
                      const isBottleneck = bottlenecks.some(b=>b.productId===c.productId);
                      const barPct = maxCap>0 ? Math.round((c.canBuild/maxCap)*100) : 0;
                      const compColor = c.canBuild===0?"#FF3B3B":isBottleneck?"#FF9500":c.canBuild<3?"#FFD60A":"#30D158";
                      return (
                        <div key={idx} style={{ background:t.inputBg, border:`1px solid ${isBottleneck?"rgba(255,149,0,0.4)":t.border}`, padding:"12px 14px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                            <div style={{ fontSize:11, color:t.text, fontWeight:500 }}>{c.prod?.name || <span style={{ color:"#FF3B3B" }}>Part not found</span>}</div>
                            {isBottleneck && <span className="bottleneck-badge">⚠ BOTTLENECK</span>}
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:t.textDim, marginBottom:6 }}>
                            <span>Needs: <b style={{ color:t.textMid }}>{c.qty} {c.prod?.unit||"pcs"}</b></span>
                            <span>Stock: <b style={{ color:compColor }}>{c.stock.toLocaleString()}</b></span>
                            <span>→ <b style={{ color:compColor }}>{c.canBuild} builds</b></span>
                          </div>
                          {c.note && <div style={{ fontSize:9, color:t.textFaint, marginBottom:6, fontStyle:"italic" }}>{c.note}</div>}
                          <div className="build-bar">
                            <div className="build-bar-inner" style={{ width:`${barPct}%`, background:compColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════ SUPPLIERS TAB ══════════════════════ */}
      {activeTab==="suppliers" && (
        <div style={{ padding:"28px 40px", maxWidth:1200, margin:"0 auto" }}>

          {/* Low stock alert for ordering */}
          {(() => {
            const low = products.filter(p => ["out","low"].includes(getStockStatus(p.stock, p.minStock)));
            if (low.length === 0) return null;
            return (
              <div style={{ background:"rgba(255,149,0,0.08)", border:"1px solid rgba(255,149,0,0.3)", padding:"14px 20px", marginBottom:24, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:12 }}>
                  <span style={{ fontSize:18 }}>⚠</span>
                  <div>
                    <div style={{ color:"#FF9500", fontWeight:500, marginBottom:2 }}>{low.length} product{low.length>1?"s":""} below minimum stock</div>
                    <div style={{ fontSize:11, color:t.textDim }}>{low.map(p=>p.name).join(" · ")}</div>
                  </div>
                </div>
                <button onClick={generateAllLowStockEmails} style={{ background:"#FF9500", color:"#000", border:"none", padding:"9px 18px", fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600, cursor:"pointer", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                  ✉ Generate Reorder Emails
                </button>
              </div>
            );
          })()}

          {/* Supplier cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px,1fr))", gap:16 }}>
            {suppliers.map(sup => {
              const supProducts = products.filter(p => sup.products?.includes(p.id));
              const lowItems = supProducts.filter(p => ["out","low"].includes(getStockStatus(p.stock, p.minStock)));
              return (
                <div key={sup.id} style={{ background:t.cardBg, border:`1px solid ${lowItems.length>0?"rgba(255,149,0,0.4)":t.border}`, padding:"22px" }}>
                  {/* Header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
                    <div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:t.text, marginBottom:3 }}>{sup.name}</div>
                      <div style={{ fontSize:11, color:t.textDim }}>{sup.contact}</div>
                    </div>
                    {lowItems.length > 0 && (
                      <span style={{ fontSize:10, background:"rgba(255,149,0,0.15)", color:"#FF9500", border:"1px solid rgba(255,149,0,0.4)", padding:"3px 8px", letterSpacing:"0.06em" }}>
                        {lowItems.length} LOW
                      </span>
                    )}
                  </div>

                  {/* Contact info */}
                  <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:16, fontSize:11 }}>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ color:t.textFaint, width:48 }}>Email</span>
                      <span style={{ color:t.accent }}>{sup.email}</span>
                    </div>
                    {sup.phone && <div style={{ display:"flex", gap:8 }}>
                      <span style={{ color:t.textFaint, width:48 }}>Phone</span>
                      <span style={{ color:t.textMid }}>{sup.phone}</span>
                    </div>}
                    {sup.notes && <div style={{ display:"flex", gap:8 }}>
                      <span style={{ color:t.textFaint, width:48 }}>Notes</span>
                      <span style={{ color:t.textDim }}>{sup.notes}</span>
                    </div>}
                  </div>

                  {/* Products supplied */}
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:9, color:t.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Supplied Parts</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {supProducts.length === 0 && <div style={{ fontSize:11, color:t.textFaint }}>No products assigned</div>}
                      {supProducts.map(p => {
                        const st = getStockStatus(p.stock, p.minStock);
                        const sm = STATUS_META[st];
                        return (
                          <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", background:t.inputBg, border:`1px solid ${["out","low"].includes(st)?"rgba(255,149,0,0.2)":t.border}` }}>
                            <div>
                              <span style={{ fontSize:11, color:t.text }}>{p.name}</span>
                              <span style={{ fontSize:10, color:t.textDim, marginLeft:8 }}>{p.sku}</span>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:10, color:sm.color }}>{p.stock.toLocaleString()} {p.unit}</span>
                              {p.reorderQty && ["out","low"].includes(st) && (
                                <span style={{ fontSize:9, color:"#FF9500", border:"1px solid rgba(255,149,0,0.3)", padding:"1px 5px" }}>reorder: {p.reorderQty}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:8 }}>
                    {lowItems.length > 0 && (
                      <button className="btn-success" style={{ flex:1, fontSize:10 }} onClick={()=>openSupplierEmail(sup)}>
                        ✉ Email Reorder
                      </button>
                    )}
                    <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>{ setSupplierForm({...sup, products:[...(sup.products||[])]}); setSupplierModal({mode:"edit",supplier:sup}); }}>Edit</button>
                    <button className="btn-danger" onClick={()=>deleteSupplier(sup.id)}>✕</button>
                  </div>
                </div>
              );
            })}
            {suppliers.length === 0 && (
              <div style={{ gridColumn:"1/-1", padding:"48px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:12 }}>
                No suppliers yet. Click "+ Add Supplier" to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ REORDER RULES TAB ══════════════════════ */}
      {activeTab==="reorder" && (
        <div style={{ padding:"28px 40px", maxWidth:1100, margin:"0 auto" }}>

          {/* Page header */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:t.text, marginBottom:6 }}>Reorder Rules</div>
            <div style={{ fontSize:11, color:t.textDim, letterSpacing:"0.06em" }}>Automated purchasing rules. Steel plate orders are grouped and sent together to Russell Metals.</div>
          </div>

          {/* ── Steel Plate Rule Card ── */}
          <div style={{ background:t.cardBg, border:`2px solid ${steelPlateRule.triggered?"rgba(255,59,59,0.5)":"rgba(255,149,0,0.3)"}`, padding:"24px 28px", marginBottom:24 }}>

            {/* Rule header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>🪨</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>Steel Plate — Grouped Reorder Rule</span>
                  {steelPlateRule.triggered
                    ? <span style={{ fontSize:10, background:"rgba(255,59,59,0.15)", color:"#FF3B3B", border:"1px solid rgba(255,59,59,0.4)", padding:"2px 8px", letterSpacing:"0.08em" }}>⚠ TRIGGERED</span>
                    : <span style={{ fontSize:10, background:"rgba(48,209,88,0.1)", color:"#30D158", border:"1px solid rgba(48,209,88,0.35)", padding:"2px 8px", letterSpacing:"0.08em" }}>✓ OK</span>
                  }
                </div>
                <div style={{ fontSize:11, color:t.textDim, letterSpacing:"0.05em" }}>
                  Triggers when any <strong style={{ color:t.textMid }}>S15-prefix</strong> part drops to ≤ 5 machines' worth of stock.
                  All steel plate sizes are ordered together in fixed quantities.
                </div>
                {steelPlateRule.supplier && (
                  <div style={{ marginTop:6, fontSize:11, color:"#30D158" }}>
                    🏢 Supplier: <strong>{steelPlateRule.supplier.name}</strong>
                    {steelPlateRule.supplier.email && <span style={{ color:t.textDim }}> — {steelPlateRule.supplier.email}</span>}
                  </div>
                )}
                {!steelPlateRule.supplier && (
                  <div style={{ marginTop:6, fontSize:11, color:"#FF9500" }}>⚠ No supplier named "Russell Metals" found — add them in the Suppliers tab.</div>
                )}
              </div>
              <button
                onClick={generateSteelPlateEmail}
                disabled={!steelPlateRule.supplier}
                style={{ background: steelPlateRule.triggered?"#FF3B3B":"rgba(255,149,0,0.15)", color: steelPlateRule.triggered?"#fff":"#FF9500", border:`1px solid ${steelPlateRule.triggered?"#FF3B3B":"rgba(255,149,0,0.4)"}`, padding:"9px 18px", fontFamily:"'DM Mono',monospace", fontSize:11, fontWeight:600, cursor:steelPlateRule.supplier?"pointer":"not-allowed", letterSpacing:"0.08em", textTransform:"uppercase", opacity:steelPlateRule.supplier?1:0.5, whiteSpace:"nowrap" }}
              >
                ✉ Generate Order Email
              </button>
            </div>

            {/* Fixed order quantities */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Fixed Order Quantities</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:8 }}>
                {STEEL_PLATE_ORDER.map((item, i) => (
                  <div key={i} style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:t.text }}>{item.desc}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#FF9500", fontFamily:"'Syne',sans-serif", marginLeft:12, flexShrink:0 }}>{item.qty}×</span>
                  </div>
                ))}
              </div>
            </div>

            {/* S15 parts table */}
            <div>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>
                S15 Parts Monitoring {steelPlateRule.parts.length === 0 && <span style={{ color:"#FF9500", marginLeft:8 }}>— no S15-prefix products found in inventory</span>}
              </div>
              {steelPlateRule.parts.length > 0 && (
                <div style={{ border:`1px solid ${t.border}`, overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                    <thead>
                      <tr style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}` }}>
                        {["SKU","Part Name","On Hand","Qty / Machine Set","5-Machine Threshold","Status"].map(h => (
                          <th key={h} style={{ padding:"9px 14px", textAlign:"left", fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {steelPlateRule.parts.map((p, i) => {
                        const sm = STATUS_META[p.status];
                        return (
                          <tr key={p.id} style={{ borderBottom:`1px solid ${t.border}`, background: p.triggered?"rgba(255,59,59,0.05)": i%2===0?"transparent":t.rowAlt }}>
                            <td style={{ padding:"10px 14px", color:t.textMid, fontWeight:500 }}>{p.sku}</td>
                            <td style={{ padding:"10px 14px", color:t.text }}>{p.name}</td>
                            <td style={{ padding:"10px 14px" }}>
                              <span style={{ color: p.triggered?"#FF3B3B":sm.color, fontWeight:500 }}>{p.stock.toLocaleString()} {p.unit}</span>
                            </td>
                            <td style={{ padding:"10px 14px", color:t.textDim }}>
                              {p.qtyPerMachineSet > 0 ? `${p.qtyPerMachineSet} ${p.unit}` : <span style={{ color:t.textFaint }}>not in any machine</span>}
                            </td>
                            <td style={{ padding:"10px 14px" }}>
                              {p.qtyPerMachineSet > 0
                                ? <span style={{ color: p.triggered?"#FF3B3B":"#FF9500", fontWeight: p.triggered?700:400 }}>≤ {p.threshold.toLocaleString()} {p.unit}</span>
                                : <span style={{ color:t.textFaint }}>—</span>
                              }
                            </td>
                            <td style={{ padding:"10px 14px" }}>
                              {p.triggered
                                ? <span style={{ background:"rgba(255,59,59,0.12)", color:"#FF3B3B", padding:"3px 10px", fontSize:10, letterSpacing:"0.08em" }}>⚠ REORDER</span>
                                : <span style={{ background:sm.bg, color:sm.color, padding:"3px 10px", fontSize:10, letterSpacing:"0.08em" }}>{sm.label}</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Info box */}
          <div style={{ background:`rgba(${t.accentRgb},0.05)`, border:`1px solid rgba(${t.accentRgb},0.2)`, padding:"14px 18px", fontSize:11, color:t.textDim, lineHeight:1.7 }}>
            <strong style={{ color:t.textMid }}>How this rule works:</strong> Every product with an SKU starting with <strong style={{ color:t.text }}>S15</strong> is checked against the machines it's used in.
            If the on-hand quantity for any S15 part falls to or below <strong style={{ color:"#FF9500" }}>5 × (qty needed per machine set)</strong>,
            the rule triggers and a steel plate order email is generated for <strong style={{ color:"#30D158" }}>Russell Metals</strong> covering all plate sizes in the fixed quantities above.
          </div>

          {/* ── Bar & Tube Stock Card ── */}
          <div style={{ background:t.cardBg, border:`2px solid rgba(43,63,224,0.35)`, padding:"24px 28px", marginTop:24 }}>

            {/* Card header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>📐</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>Bar & Tube Stock — SW150 Build Run (20 Machines)</span>
                </div>
                <div style={{ fontSize:11, color:t.textDim, letterSpacing:"0.05em" }}>
                  Order quantities calculated from the SW150 material requirements document.
                  Quantities shown are for a full run of <strong style={{ color:t.textMid }}>20 machines</strong>.
                </div>
              </div>
            </div>

            {/* Category legend */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {Object.entries(BAR_TUBE_CATEGORIES).map(([key, cat]) => (
                <div key={key} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:t.textDim, background:t.inputBg, border:`1px solid ${t.border}`, padding:"4px 10px", letterSpacing:"0.06em" }}>
                  <span style={{ width:8, height:8, background:cat.color, borderRadius:"50%", flexShrink:0 }} />
                  {cat.label}
                  <span style={{ color:t.textFaint }}>— {cat.stdLength ? `${cat.stdLength} ft std` : 'round up to ft'}</span>
                </div>
              ))}
            </div>

            {/* Materials table grouped by category */}
            {Object.entries(BAR_TUBE_CATEGORIES).map(([catKey, cat]) => {
              const items = BAR_TUBE_MATERIALS.filter(m => m.category === catKey);
              if (items.length === 0) return null;
              return (
                <div key={catKey} style={{ marginBottom:16 }}>
                  {/* Category header */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ width:3, height:16, background:cat.color, flexShrink:0 }} />
                    <span style={{ fontSize:10, color:cat.color, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:600 }}>{cat.label}</span>
                    <span style={{ fontSize:10, color:t.textFaint }}>
                      {cat.stdLength ? `— ${cat.stdLength} ft standard length` : '— round to nearest foot'}
                    </span>
                  </div>
                  {/* Items */}
                  <div style={{ border:`1px solid ${t.border}`, overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ background:t.inputBg, borderBottom:`1px solid ${t.border}` }}>
                          {["Material","Total Needed (20 machines)","Order Qty","No. of Lengths"].map(h => (
                            <th key={h} style={{ padding:"7px 14px", textAlign:"left", fontSize:10, color:t.textDim, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => {
                          const orderQty  = calcReorderQty(item.totalFt, cat.stdLength);
                          const lengths   = calcLengths(orderQty, cat.stdLength);
                          const roundedUp = orderQty > Math.ceil(item.totalFt);
                          return (
                            <tr key={item.name} style={{ borderBottom:`1px solid ${t.border}`, background: i%2===0?"transparent":t.rowAlt }}>
                              <td style={{ padding:"10px 14px", color:t.text }}>{item.name}</td>
                              <td style={{ padding:"10px 14px", color:t.textDim }}>{item.totalFt.toFixed(2)} ft</td>
                              <td style={{ padding:"10px 14px" }}>
                                <span style={{ color:cat.color, fontWeight:600, fontFamily:"'Syne',sans-serif", fontSize:13 }}>{orderQty} ft</span>
                                {roundedUp && (
                                  <span style={{ marginLeft:8, fontSize:9, color:t.textFaint, letterSpacing:"0.06em" }}>↑ rounded</span>
                                )}
                              </td>
                              <td style={{ padding:"10px 14px" }}>
                                {lengths
                                  ? <span style={{ fontSize:12, color:t.textMid, fontWeight:600 }}>{lengths} {lengths === 1 ? 'length' : 'lengths'} @ {cat.stdLength} ft</span>
                                  : <span style={{ fontSize:11, color:t.textFaint }}>—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Rule explanation */}
            <div style={{ marginTop:16, background:`rgba(43,63,224,0.05)`, border:`1px solid rgba(43,63,224,0.2)`, padding:"12px 16px", fontSize:11, color:t.textDim, lineHeight:1.7 }}>
              <strong style={{ color:t.textMid }}>Rounding rule:</strong> If total needed is{' '}
              <strong style={{ color:t.text }}>less than half a standard length</strong> → round up to the nearest foot (avoids ordering a full length for a small offcut).
              If total needed is <strong style={{ color:t.text }}>half a length or more</strong> → round up to the nearest full length multiple.
              DOM tube and aluminum have no fixed standard length and always round up to the nearest foot.
            </div>
          </div>

        </div>
      )}

      {/* ── Email Draft Modal ── */}
      {emailDraft && (
        <div className="modal-overlay" onClick={()=>{ setEmailDraft(null); setEmailDrafts([]); }}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:640, padding:0, overflow:"hidden" }}>

            {/* Header */}
            <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:"22px 28px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:4 }}>
                  Purchase Order Email — Review Before Sending
                  {emailDrafts.length > 1 && <span style={{ marginLeft:10, color:t.accent }}>{emailDrafts.indexOf(emailDraft)+1} of {emailDrafts.length}</span>}
                </div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>{emailDraft.supplier.name}</div>
              </div>
              <button onClick={()=>{ setEmailDraft(null); setEmailDrafts([]); }} style={{ background:"none", border:"none", color:t.textDim, fontSize:20, cursor:"pointer" }}>✕</button>
            </div>

            {/* Items summary */}
            <div style={{ padding:"14px 28px", borderBottom:`1px solid ${t.border}`, display:"flex", flexWrap:"wrap", gap:6 }}>
              {(emailDraft.items||[]).map((item, i) => (
                <div key={i} style={{ fontSize:11, color:t.text, background:t.cardBg, border:`1px solid ${item.isRaw?"rgba(255,149,0,0.4)":t.border}`, padding:"4px 10px", display:"flex", gap:8, alignItems:"center" }}>
                  {item.isRaw && <span style={{ fontSize:10 }}>⚙</span>}
                  <span>{item.label}</span>
                  <span style={{ color:item.isRaw?"#FF9500":t.textDim }}>— {item.detail}</span>
                </div>
              ))}
            </div>

            {/* Email fields — editable */}
            <div style={{ padding:"18px 28px" }}>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>To</div>
                <input className="field-input" value={emailDraft.supplier.email} readOnly style={{ background:t.inputBg, opacity:0.7 }} />
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>Subject</div>
                <input className="field-input" value={emailDraft.subject} onChange={e=>setEmailDraft(d=>({...d, subject:e.target.value}))} />
              </div>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>Body — Edit Before Sending</div>
                <textarea
                  value={emailDraft.body}
                  onChange={e=>setEmailDraft(d=>({...d, body:e.target.value}))}
                  style={{ background:t.inputBg, border:`1px solid ${t.borderStrong}`, color:t.text, padding:"12px", fontFamily:"'DM Mono',monospace", fontSize:11, width:"100%", height:180, resize:"vertical", outline:"none", lineHeight:1.6 }}
                />
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn-success" style={{ flex:1 }} onClick={()=>{ openMailto(emailDraft); dismissDraft(); }}>
                  ✉ Open in Email Client
                </button>
                <button className="btn-ghost" onClick={()=>{ copyEmailToClipboard(emailDraft); dismissDraft(); }}>
                  Copy to Clipboard
                </button>
                <button className="btn-ghost" onClick={dismissDraft}>Dismiss</button>
              </div>
              {emailDrafts.length > 1 && (
                <div style={{ marginTop:12, fontSize:10, color:t.textDim, textAlign:"center" }}>
                  {emailDrafts.length - emailDrafts.indexOf(emailDraft) - 1} more email{emailDrafts.length - emailDrafts.indexOf(emailDraft) - 1 !== 1?"s":""} to review after this one
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Supplier Add/Edit Modal ── */}
      {supplierModal && (
        <div className="modal-overlay" onClick={()=>{ setSupplierProductSearch(''); setSupplierModal(null); }}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:540 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24, color:t.text }}>
              {supplierModal.mode==="add" ? "Add Supplier" : "Edit Supplier"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              {[{label:"Company Name",key:"name"},{label:"Contact Person",key:"contact"},{label:"Email Address",key:"email"},{label:"Phone",key:"phone"}].map(f => (
                <div key={f.key} style={{ gridColumn: f.key==="name"||f.key==="email"?"1/-1":"auto" }}>
                  <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:5, textTransform:"uppercase" }}>{f.label}</div>
                  <input className="field-input" value={supplierForm[f.key]||""} onChange={e=>setSupplierForm(s=>({...s,[f.key]:e.target.value}))} />
                </div>
              ))}
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:5, textTransform:"uppercase" }}>Notes (lead times, MOQ, etc.)</div>
                <input className="field-input" value={supplierForm.notes||""} onChange={e=>setSupplierForm(s=>({...s,notes:e.target.value}))} placeholder="e.g. 5–7 day lead time, minimum order 50 units" />
              </div>
            </div>

            {/* Product assignment */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Products Supplied</div>

              {/* Search bar */}
              <input
                className="field-input"
                placeholder="Search parts by name or SKU…"
                value={supplierProductSearch}
                onChange={e => setSupplierProductSearch(e.target.value)}
                style={{ marginBottom:8 }}
              />

              {/* Search results — only show when query is non-empty */}
              {supplierProductSearch.trim() !== '' && (() => {
                const q = supplierProductSearch.toLowerCase();
                const matches = products.filter(p =>
                  p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
                ).slice(0, 20);
                return (
                  <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:3, marginBottom:12, border:`1px solid ${t.border}`, borderRadius:4, padding:4 }}>
                    {matches.length === 0 && (
                      <div style={{ padding:"10px", fontSize:11, color:t.textFaint, textAlign:"center" }}>No parts found</div>
                    )}
                    {matches.map(p => {
                      const checked = (supplierForm.products||[]).includes(p.id);
                      return (
                        <label key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:checked?`rgba(${t.accentRgb},0.1)`:t.inputBg, border:`1px solid ${checked?t.accent:t.border}`, borderRadius:3, cursor:"pointer", transition:"all 0.15s" }}>
                          <input type="checkbox" checked={checked} onChange={()=>{ setSupplierForm(s=>({ ...s, products: checked ? s.products.filter(id=>id!==p.id) : [...(s.products||[]),p.id] })); }} style={{ accentColor:t.accent, width:14, height:14 }} />
                          <span style={{ fontSize:11, color:t.text }}>{p.name}</span>
                          <span style={{ fontSize:10, color:t.textDim, marginLeft:"auto" }}>{p.sku}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Currently linked parts */}
              {(supplierForm.products||[]).length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  <div style={{ fontSize:9, color:t.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>
                    Linked ({(supplierForm.products||[]).length})
                  </div>
                  {(supplierForm.products||[]).map(pid => {
                    const p = products.find(x => x.id === pid);
                    if (!p) return null;
                    return (
                      <div key={pid} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:`rgba(${t.accentRgb},0.07)`, border:`1px solid ${t.accent}`, borderRadius:3 }}>
                        <span style={{ fontSize:11, color:t.text, flex:1 }}>{p.name}</span>
                        <span style={{ fontSize:10, color:t.textDim }}>{p.sku}</span>
                        <button onClick={()=>setSupplierForm(s=>({ ...s, products: s.products.filter(id=>id!==pid) }))} style={{ background:"none", border:"none", color:t.textDim, cursor:"pointer", fontSize:14, lineHeight:1, padding:"0 2px" }} title="Remove">×</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize:11, color:t.textFaint, padding:"10px", border:`1px dashed ${t.border}`, borderRadius:4, textAlign:"center" }}>
                  No parts linked yet — search above to add
                </div>
              )}
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={saveSupplier} disabled={saving}>
                {saving ? 'Saving...' : supplierModal.mode==="add"?"Add Supplier":"Save Changes"}</button>
              <button className="btn-ghost" onClick={()=>{ setSupplierProductSearch(''); setSupplierModal(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox" onClick={()=>setLightbox(null)}>
          <div style={{ marginBottom:16, fontSize:11, color:"#666", letterSpacing:"0.1em" }}>{lightbox.sku} · {lightbox.name} — click to close</div>
          <img src={lightbox.imageUrl} alt={lightbox.name} style={{ maxWidth:"85vw", maxHeight:"78vh", objectFit:"contain", border:"1px solid #2A2A35" }} onClick={e=>e.stopPropagation()} />
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="toast" style={{ background:toast.type==="error"?"rgba(255,59,59,0.15)":"rgba(48,209,88,0.12)", color:toast.type==="error"?"#FF3B3B":"#30D158", borderColor:toast.type==="error"?"rgba(255,59,59,0.3)":"rgba(48,209,88,0.3)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Commit Build Confirmation Modal ── */}
      {confirmCommit && (() => {
        const { max } = calcMachineBuilds(confirmCommit, products);
        return (
          <div className="modal-overlay" onClick={()=>setConfirmCommit(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:400 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text, marginBottom:6 }}>Commit Build</div>
              <div style={{ fontSize:11, color:t.textDim, marginBottom:24 }}>{confirmCommit.name} · Max possible: <span style={{ color:"#30D158", fontWeight:600 }}>{max}</span></div>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Quantity to Build</div>
              <input className="field-input" type="number" min={1} max={max} value={commitQty} onChange={e=>setCommitQty(Math.max(1,Math.min(max,parseInt(e.target.value)||1)))} style={{ marginBottom:6 }} />
              <div style={{ fontSize:10, color:t.textDim, marginBottom:20 }}>This will deduct all required components from stock.</div>
              <div style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:"12px 14px", marginBottom:20, fontSize:11 }}>
                {calcMachineBuilds(confirmCommit,products).componentDetails.map((c,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", color:t.textMid, marginBottom:4 }}>
                    <span>{c.prod?.name}</span>
                    <span style={{ color:"#FF9500" }}>−{c.qty*commitQty} {c.prod?.unit||"pcs"}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn-success" style={{ flex:1, padding:"11px" }} onClick={()=>commitBuild(confirmCommit,commitQty)}>✓ Confirm Build ×{commitQty}</button>
                <button className="btn-ghost" onClick={()=>setConfirmCommit(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Inventory Modals ── */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            {modal.mode==="adjust" ? (
              <>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:6, color:t.text }}>Adjust Stock</div>
                <div style={{ fontSize:11, color:t.textDim, marginBottom:24 }}>{modal.product.sku} · {modal.product.name} · Current: <span style={{ color:t.text }}>{modal.product.stock}</span></div>
                <div style={{ display:"flex", gap:10, marginBottom:18 }}>
                  {["add","remove"].map(type => (
                    <button key={type} onClick={()=>setAdjustType(type)} style={{ flex:1, padding:"10px", background:adjustType===type?t.accent:t.cardBg, color:adjustType===type?"#fff":t.textMid, border:"none", fontFamily:"DM Mono,monospace", fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", cursor:"pointer" }}>
                      {type==="add"?"+ Add":"– Remove"}
                    </button>
                  ))}
                </div>
                <input className="field-input" type="number" min="0" placeholder="Quantity" value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} style={{ marginBottom:20 }} />
                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn-primary" style={{ flex:1 }} onClick={applyAdjust}>Apply</button>
                  <button className="btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24, color:t.text }}>{modal.mode==="add"?"Add Product":"Edit Product"}</div>
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:8, textTransform:"uppercase" }}>Product Photo</div>
                  {form.imageUrl ? (
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <img src={form.imageUrl} alt="" style={{ width:100, height:100, objectFit:"cover", border:`1px solid ${t.borderStrong}` }} />
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <label className="btn-ghost" style={{ cursor:"pointer", textAlign:"center" }}>Replace Photo<input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleFormImageFile(e.target.files[0])} /></label>
                        <button className="btn-danger" onClick={()=>setForm(f=>({ ...f, imageUrl:null }))}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label style={{ border:`1px dashed ${t.borderStrong}`, background:t.bg, padding:"18px", textAlign:"center", cursor:"pointer", display:"block" }}>
                      <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
                      <div style={{ fontSize:11, color:t.textDim }}>Click to upload a photo</div>
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleFormImageFile(e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                  {[{label:"SKU",key:"sku"},{label:"Name",key:"name"},{label:"Category",key:"category"},{label:"Location",key:"location"},{label:"Stock Qty",key:"stock",type:"number"},{label:"Min Stock Level",key:"minStock",type:"number"},{label:"Reorder Qty",key:"reorderQty",type:"number"},{label:"Unit",key:"unit"}].map(f => (
                    <div key={f.key} style={f.key==="name"?{ gridColumn:"1/-1" }:{}}>
                      <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:5, textTransform:"uppercase" }}>{f.label}</div>
                      <input className="field-input" type={f.type||"text"} value={form[f.key]||""} onChange={e=>{
                        const val = e.target.value;
                        setForm(p=>({ ...p, [f.key]:val, ...(f.key==='sku' && val.toUpperCase().startsWith('S15') ? { category:'SW150' } : {}) }));
                      }} />
                    </div>
                  ))}
                </div>

                {/* ── Sourcing & Reordering ── */}
                <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:18, marginBottom:20 }}>
                  <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14 }}>Sourcing &amp; Reordering</div>

                  {/* Purchased / Made In-House toggle */}
                  <div style={{ display:"flex", marginBottom:18, border:`1px solid ${t.borderStrong}`, overflow:"hidden", width:"100%" }}>
                    {[["purchased","🛒  Purchased"],["made","⚙  Made In-House"],["subassembly","🔩  Subassembly"]].map(([val,label],i,arr)=>(
                      <button key={val} onClick={()=>setForm(f=>({...f, partType:val}))} style={{
                        flex:1, padding:"10px 0", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"0.07em",
                        border:"none", cursor:"pointer", transition:"all 0.2s",
                        background: form.partType===val ? t.accent : t.inputBg,
                        color: form.partType===val ? "#fff" : t.textDim,
                        borderRight: i < arr.length-1 ? `1px solid ${t.borderStrong}` : "none",
                      }}>{label}</button>
                    ))}
                  </div>

                  {/* ── PURCHASED: supplier selector ── */}
                  {form.partType==="purchased" && (
                    <div>
                      <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.08em", marginBottom:8 }}>SUPPLIER</div>
                      {suppliers.length === 0 ? (
                        <div style={{ fontSize:11, color:t.textFaint, padding:"12px", border:`1px dashed ${t.border}`, textAlign:"center" }}>
                          No suppliers yet — add them in the Suppliers tab first.
                        </div>
                      ) : (
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <button onClick={()=>setForm(f=>({...f,supplierId:null}))} style={{
                            padding:"7px 12px", fontFamily:"'DM Mono',monospace", fontSize:10, textAlign:"left",
                            border:`1px solid ${form.supplierId===null ? t.accent : t.border}`,
                            background: form.supplierId===null ? `rgba(${t.accentRgb},0.12)` : t.inputBg,
                            color: form.supplierId===null ? t.text : t.textDim, cursor:"pointer",
                          }}>— None</button>
                          {suppliers.map(sup=>{
                            const selected = form.supplierId===sup.id;
                            const suppliesThis = sup.products?.includes(form.id);
                            return (
                              <div key={sup.id} onClick={()=>setForm(f=>({...f,supplierId:selected?null:sup.id}))} style={{
                                display:"flex", alignItems:"center", justifyContent:"space-between",
                                padding:"10px 14px", cursor:"pointer", transition:"all 0.15s",
                                border:`1px solid ${selected ? t.accent : t.border}`,
                                background: selected ? `rgba(${t.accentRgb},0.1)` : t.inputBg,
                              }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                  <div style={{ width:14, height:14, border:`2px solid ${selected?t.accent:t.borderStrong}`, borderRadius:"50%", background:selected?t.accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    {selected && <div style={{ width:5, height:5, borderRadius:"50%", background:"#fff" }} />}
                                  </div>
                                  <div>
                                    <div style={{ fontSize:11, color:t.text, fontWeight:selected?500:400 }}>{sup.name}</div>
                                    <div style={{ fontSize:10, color:t.textDim }}>{sup.contact} · {sup.email}</div>
                                  </div>
                                </div>
                                <div style={{ textAlign:"right" }}>
                                  {sup.notes && <div style={{ fontSize:9, color:t.textFaint }}>{sup.notes}</div>}
                                  {suppliesThis && !selected && <div style={{ fontSize:9, color:"#30D158", marginTop:2 }}>● currently assigned</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── SUBASSEMBLY: BOM component picker ── */}
                  {form.partType==="subassembly" && (
                    <div>
                      <div style={{ background:`rgba(100,210,255,0.06)`, border:`1px solid rgba(100,210,255,0.25)`, padding:"10px 14px", marginBottom:16, fontSize:10, color:"#64D2FF", display:"flex", gap:8 }}>
                        <span style={{ fontSize:14, flexShrink:0 }}>🔩</span>
                        <span>Define the inventory parts that go into this subassembly. When you build units, component stock will be deducted and assembly stock increased.</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Component Parts</div>
                        <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>setForm(f=>({
                          ...f, bomComponents:[...(f.bomComponents||[]), { productId:"", qty:1, note:"" }]
                        }))}>+ Add Component</button>
                      </div>
                      {(!form.bomComponents || form.bomComponents.length===0) && (
                        <div style={{ padding:"18px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:11, marginBottom:8 }}>
                          No components defined yet. Click "+ Add Component" above.
                        </div>
                      )}
                      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
                        {(form.bomComponents||[]).map((bc, idx) => {
                          const updateBom = (key, val) => setForm(f=>{ const bs=[...f.bomComponents]; bs[idx]={...bs[idx],[key]:val}; return {...f,bomComponents:bs}; });
                          const compProd = products.find(p => p.id === bc.productId);
                          return (
                            <div key={idx} style={{ display:"grid", gridTemplateColumns:"2fr 80px 1fr auto", gap:8, alignItems:"end" }}>
                              <div>
                                {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>COMPONENT PART</div>}
                                <select className="field-input" value={bc.productId} onChange={e=>updateBom("productId",e.target.value)}>
                                  <option value="">— Select part —</option>
                                  {products.filter(p=>p.id!==form.id && p.partType!=="subassembly").map(p=>(
                                    <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.stock} in stock</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>QTY EACH</div>}
                                <input className="field-input" type="number" min="1" value={bc.qty} onChange={e=>updateBom("qty",parseInt(e.target.value)||1)} />
                              </div>
                              <div>
                                {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>NOTE</div>}
                                <input className="field-input" value={bc.note||""} onChange={e=>updateBom("note",e.target.value)} placeholder="Optional note..." />
                              </div>
                              <button className="btn-danger" style={idx===0?{ marginTop:18 }:{}} onClick={()=>setForm(f=>({...f,bomComponents:f.bomComponents.filter((_,i)=>i!==idx)}))}>✕</button>
                            </div>
                          );
                        })}
                      </div>
                      {(form.bomComponents||[]).length > 0 && (
                        <div style={{ fontSize:10, color:t.textFaint, marginTop:4 }}>
                          Total: {form.bomComponents.length} component type{form.bomComponents.length!==1?"s":""} per assembly unit
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── MADE IN-HOUSE: raw material recipe ── */}
                  {form.partType==="made" && (
                    <div>
                      <div style={{ background:`rgba(255,149,0,0.06)`, border:`1px solid rgba(255,149,0,0.25)`, padding:"10px 14px", marginBottom:16, fontSize:10, color:"#FF9500", display:"flex", gap:8 }}>
                        <span style={{ fontSize:14, flexShrink:0 }}>⚙</span>
                        <span>Define the raw materials needed to produce one finished unit. When stock falls below minimum, the system will calculate and order the correct raw material quantities.</span>
                      </div>

                      {/* Raw material lines */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Raw Materials Required</div>
                        <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>setForm(f=>({
                          ...f, rawMaterials:[...(f.rawMaterials||[]), { material:"", type:"", size:"", qtyPerBatch:1, unit:"kg" }]
                        }))}>+ Add Material</button>
                      </div>

                      {(!form.rawMaterials || form.rawMaterials.length===0) && (
                        <div style={{ padding:"18px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:11, marginBottom:8 }}>
                          No raw materials defined yet. Click "+ Add Material" above.
                        </div>
                      )}

                      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
                        {(form.rawMaterials||[]).map((rm, idx)=>{
                          const update = (key, val) => setForm(f=>{ const rs=[...f.rawMaterials]; rs[idx]={...rs[idx],[key]:val}; return {...f,rawMaterials:rs}; });
                          return (
                            <div key={idx} style={{ background:t.inputBg, border:`1px solid ${t.border}`, padding:"12px" }}>
                              <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:8, marginBottom:8 }}>
                                <div>
                                  <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>MATERIAL NAME</div>
                                  <input className="field-input" placeholder="e.g. Mild Steel Sheet" value={rm.material}
                                    onChange={e=>update("material",e.target.value)} />
                                </div>
                                <div>
                                  <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>TYPE / GRADE</div>
                                  <input className="field-input" placeholder="e.g. S275, 304SS" value={rm.type}
                                    onChange={e=>update("type",e.target.value)} />
                                </div>
                                <div>
                                  <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>SIZE / SPEC</div>
                                  <input className="field-input" placeholder="e.g. 3mm, 25×50mm" value={rm.size}
                                    onChange={e=>update("size",e.target.value)} />
                                </div>
                              </div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:8, alignItems:"end" }}>
                                <div>
                                  <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>QTY PER BATCH</div>
                                  <input className="field-input" type="number" min="0" step="0.01" placeholder="0"
                                    value={rm.qtyPerBatch} onChange={e=>update("qtyPerBatch",e.target.value)} />
                                </div>
                                <div>
                                  <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>UNIT</div>
                                  <select className="field-input" value={rm.unit} onChange={e=>update("unit",e.target.value)}>
                                    {["kg","g","m","mm","m²","m³","L","sheets","bars","lengths","pcs"].map(u=>(
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </div>
                                <button className="btn-danger" onClick={()=>setForm(f=>({...f,rawMaterials:f.rawMaterials.filter((_,i)=>i!==idx)}))}>✕</button>
                              </div>
                              {/* Live calculation preview */}
                              {rm.qtyPerBatch && (
                                <div style={{ marginTop:10, paddingTop:8, borderTop:`1px solid ${t.border}`, fontSize:10, color:t.textDim, display:"flex", gap:16 }}>
                                  <span>Per finished part: <b style={{ color:t.textMid }}>{parseFloat(rm.qtyPerBatch).toFixed(4)} {rm.unit}</b></span>
                                  {form.reorderQty && <span>To make {form.reorderQty} parts: <b style={{ color:"#FF9500" }}>{(parseFloat(rm.qtyPerBatch)*parseFloat(form.reorderQty)).toFixed(2)} {rm.unit}</b></span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Supplier for raw material delivery */}
                      {(form.rawMaterials||[]).length > 0 && (
                        <div style={{ marginTop:12 }}>
                          <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>RAW MATERIAL SUPPLIER</div>
                          <div style={{ fontSize:10, color:t.textFaint, marginBottom:8 }}>Who supplies the raw material for this part?</div>
                          {suppliers.length===0 ? (
                            <div style={{ fontSize:11, color:t.textFaint, padding:"10px", border:`1px dashed ${t.border}` }}>No suppliers yet.</div>
                          ) : (
                            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                              <button onClick={()=>setForm(f=>({...f,supplierId:null}))} style={{
                                padding:"7px 12px", fontFamily:"'DM Mono',monospace", fontSize:10, textAlign:"left",
                                border:`1px solid ${form.supplierId===null ? t.accent : t.border}`,
                                background: form.supplierId===null ? `rgba(${t.accentRgb},0.12)` : t.inputBg,
                                color: form.supplierId===null ? t.text : t.textDim, cursor:"pointer",
                              }}>— None</button>
                              {suppliers.map(sup=>{
                                const selected = form.supplierId===sup.id;
                                return (
                                  <div key={sup.id} onClick={()=>setForm(f=>({...f,supplierId:selected?null:sup.id}))} style={{
                                    display:"flex", alignItems:"center", gap:10,
                                    padding:"10px 14px", cursor:"pointer", transition:"all 0.15s",
                                    border:`1px solid ${selected ? t.accent : t.border}`,
                                    background: selected ? `rgba(${t.accentRgb},0.1)` : t.inputBg,
                                  }}>
                                    <div style={{ width:14, height:14, border:`2px solid ${selected?t.accent:t.borderStrong}`, borderRadius:"50%", background:selected?t.accent:"transparent", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                      {selected && <div style={{ width:5, height:5, borderRadius:"50%", background:"#fff" }} />}
                                    </div>
                                    <div>
                                      <div style={{ fontSize:11, color:t.text, fontWeight:selected?500:400 }}>{sup.name}</div>
                                      <div style={{ fontSize:10, color:t.textDim }}>{sup.contact} · {sup.email}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Machine Usage */}
                <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:18, marginBottom:20 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:2 }}>Machine Usage</div>
                      <div style={{ fontSize:10, color:t.textFaint }}>Which machines use this part, and how many per build?</div>
                    </div>
                    <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>setForm(f=>({ ...f, machineLinks:[...(f.machineLinks||[]), { machineId:"", qty:1, note:"" }] }))}>
                      + Link Machine
                    </button>
                  </div>
                  {(form.machineLinks||[]).length===0 && (
                    <div style={{ padding:"14px", border:`1px dashed ${t.border}`, textAlign:"center", fontSize:11, color:t.textFaint }}>
                      Not linked to any machine yet
                    </div>
                  )}
                  {(form.machineLinks||[]).map((link, idx) => (
                    <div key={idx} style={{ display:"grid", gridTemplateColumns:"2fr 80px 1fr auto", gap:8, marginBottom:8, alignItems:"end" }}>
                      <div>
                        {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>MACHINE</div>}
                        <select className="field-input" value={link.machineId} onChange={e=>setForm(f=>{ const ls=[...f.machineLinks]; ls[idx]={...ls[idx],machineId:e.target.value}; return {...f,machineLinks:ls}; })}>
                          <option value="">— Select machine —</option>
                          {machines.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>QTY / BUILD</div>}
                        <input className="field-input" type="number" min="1" value={link.qty} onChange={e=>setForm(f=>{ const ls=[...f.machineLinks]; ls[idx]={...ls[idx],qty:parseInt(e.target.value)||1}; return {...f,machineLinks:ls}; })} />
                      </div>
                      <div>
                        {idx===0 && <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>NOTE</div>}
                        <input className="field-input" value={link.note||""} placeholder="e.g. Frame brackets" onChange={e=>setForm(f=>{ const ls=[...f.machineLinks]; ls[idx]={...ls[idx],note:e.target.value}; return {...f,machineLinks:ls}; })} />
                      </div>
                      <button className="btn-danger" onClick={()=>setForm(f=>({ ...f, machineLinks:f.machineLinks.filter((_,i)=>i!==idx) }))}>✕</button>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn-primary" style={{ flex:1 }} onClick={saveProduct}>{modal.mode==="add"?"Add Product":"Save Changes"}</button>
                  <button className="btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Machine Detail View Modal ── */}
      {machineModal && machineModal.mode==="view" && (() => {
        const m = machineModal.machine;
        const { max, bottlenecks, componentDetails } = calcMachineBuilds(m, products);
        const maxCap = Math.max(1, ...componentDetails.map(c => c.canBuild));
        const statusColor = max===0?"#FF3B3B":max<3?"#FF9500":"#30D158";
        return (
          <div className="modal-overlay" onClick={()=>setMachineModal(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:680, padding:0, overflow:"hidden" }}>

              {/* Hero header */}
              <div style={{ background:t.headerBg, borderBottom:`1px solid ${t.border}`, padding:"28px 32px", position:"relative", overflow:"hidden" }}>
                {m.imageUrl && (
                  <div style={{ position:"absolute", inset:0, backgroundImage:`url(${m.imageUrl})`, backgroundSize:"cover", backgroundPosition:"center", opacity:0.08 }} />
                )}
                <div style={{ position:"relative", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", gap:18, alignItems:"flex-start" }}>
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt={m.name} style={{ width:72, height:72, objectFit:"cover", border:`1px solid ${t.borderStrong}`, flexShrink:0 }} />
                    )}
                    <div>
                      <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:6 }}>Machine / Assembly</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:t.text, marginBottom:4 }}>{m.name}</div>
                      {m.description && <div style={{ fontSize:12, color:t.textMid }}>{m.description}</div>}
                    </div>
                  </div>
                  <button onClick={()=>setMachineModal(null)} style={{ background:"none", border:"none", color:t.textDim, fontSize:20, cursor:"pointer", lineHeight:1, padding:"4px 8px" }}>✕</button>
                </div>

                {/* Build status bar */}
                <div style={{ display:"flex", gap:24, marginTop:24 }}>
                  <div>
                    <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>Max Buildable</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontSize:44, fontWeight:800, color:statusColor, lineHeight:1 }}>{max}</div>
                  </div>
                  <div style={{ width:1, background:t.border }} />
                  <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:8 }}>
                    <div>
                      <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:2 }}>Components</div>
                      <div style={{ fontSize:16, fontWeight:600, color:t.text }}>{m.components.length} parts</div>
                    </div>
                  </div>
                  <div style={{ width:1, background:t.border }} />
                  <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:6 }}>
                    {max===0 ? (
                      <div style={{ fontSize:11, color:"#FF3B3B", display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:16 }}>⛔</span> Cannot build — stock too low
                      </div>
                    ) : bottlenecks.length>0 ? (
                      <div style={{ fontSize:11, color:"#FF9500", display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:14 }}>⚠</span>
                        <div>
                          <div style={{ marginBottom:2 }}>Bottleneck{bottlenecks.length>1?"s":""}:</div>
                          {bottlenecks.map(b=>(
                            <div key={b.productId} style={{ color:"#FF9500", fontWeight:500 }}>{b.prod?.name}</div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize:11, color:"#30D158", display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:14 }}>✓</span> All parts in stock
                      </div>
                    )}
                  </div>
                  <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
                    <button className="btn-success" style={{ padding:"10px 20px", fontSize:12, opacity:max===0?0.4:1, cursor:max===0?"not-allowed":"pointer" }} onClick={()=>{ setMachineModal(null); setTimeout(()=>{ setCommitQty(1); setConfirmCommit(m); }, 50); }} disabled={max===0}>
                      ✓ Commit Build
                    </button>
                  </div>
                </div>
              </div>

              {/* Parts table */}
              <div style={{ padding:"24px 32px", maxHeight:420, overflowY:"auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.12em", textTransform:"uppercase" }}>Bill of Materials</div>
                  <button className="btn-ghost" style={{ fontSize:10 }} onClick={()=>{ setMachineModal(null); setTimeout(()=>openEditMachine(m),50); }}>✎ Edit BOM</button>
                </div>

                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${t.border}` }}>
                      {["Part","SKU","Location","Stock","Qty / Build","Builds Possible","Status"].map(h=>(
                        <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {componentDetails.map((c, idx) => {
                      const isBottleneck = bottlenecks.some(b=>b.productId===c.productId);
                      const barPct = maxCap>0 ? Math.round((c.canBuild/maxCap)*100) : 0;
                      const compColor = c.canBuild===0?"#FF3B3B":isBottleneck?"#FF9500":c.canBuild<3?"#FFD60A":"#30D158";
                      const stockStatus = c.prod ? getStockStatus(c.prod.stock, c.prod.minStock) : "out";
                      const sm = STATUS_META[stockStatus];
                      return (
                        <tr key={idx} style={{ borderBottom:`1px solid ${t.border}`, background:isBottleneck?"rgba(255,149,0,0.04)":"transparent" }}>
                          <td style={{ padding:"12px 10px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {c.prod?.imageUrl && <img src={c.prod.imageUrl} style={{ width:28, height:28, objectFit:"cover", borderRadius:2 }} />}
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ color:t.text, fontWeight:500 }}>{c.prod?.name || <span style={{ color:"#FF3B3B" }}>Unknown part</span>}</span>
                                  {c.prod?.partType==="subassembly" && <span style={{ fontSize:9, color:"#64D2FF", border:"1px solid rgba(100,210,255,0.4)", padding:"1px 5px", letterSpacing:"0.06em", flexShrink:0 }}>🔩 ASSEMBLY</span>}
                                </div>
                                {c.note && <div style={{ fontSize:9, color:t.textFaint, marginTop:1 }}>{c.note}</div>}
                                {c.prod?.partType==="subassembly" && (c.prod?.bomComponents||[]).length>0 && (
                                  <div style={{ marginTop:6, paddingLeft:8, borderLeft:`2px solid rgba(100,210,255,0.3)` }}>
                                    <div style={{ fontSize:9, color:"#64D2FF", letterSpacing:"0.08em", marginBottom:3 }}>CONTAINS:</div>
                                    {(c.prod.bomComponents||[]).map((bc,bi)=>{
                                      const cp = products.find(p=>p.id===bc.productId);
                                      return (
                                        <div key={bi} style={{ fontSize:9, color:t.textDim, display:"flex", gap:8, marginBottom:2 }}>
                                          <span>×{bc.qty}</span>
                                          <span>{cp?.name||"Unknown"}</span>
                                          {cp && <span style={{ color:cp.stock>0?"#30D158":"#FF3B3B" }}>({cp.stock} in stock)</span>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:"12px 10px", color:t.textMid, fontSize:11 }}>{c.prod?.sku||"—"}</td>
                          <td style={{ padding:"12px 10px", color:t.textDim, fontSize:11 }}>{c.prod?.location||"—"}</td>
                          <td style={{ padding:"12px 10px" }}>
                            <div style={{ color:sm?.color||t.textDim, fontWeight:500 }}>{c.stock.toLocaleString()}</div>
                            <div style={{ height:3, background:t.border, width:60, borderRadius:2, marginTop:3, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${barPct}%`, background:compColor, borderRadius:2 }} />
                            </div>
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:t.text }}>×{c.qty}</span>
                            <span style={{ fontSize:10, color:t.textDim, marginLeft:4 }}>{c.prod?.unit||"pcs"}</span>
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:compColor }}>{c.canBuild}</span>
                            {isBottleneck && <div style={{ fontSize:9, color:"#FF9500", letterSpacing:"0.06em", marginTop:2 }}>⚠ BOTTLENECK</div>}
                          </td>
                          <td style={{ padding:"12px 10px" }}>
                            <span style={{ background:sm?.bg, color:sm?.color, padding:"3px 8px", fontSize:9, letterSpacing:"0.08em", textTransform:"uppercase", display:"inline-flex", alignItems:"center", gap:4 }}>
                              <span style={{ width:4, height:4, borderRadius:"50%", background:sm?.dot, display:"inline-block" }} />
                              {sm?.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div style={{ padding:"16px 32px", borderTop:`1px solid ${t.border}`, background:t.headerBg, display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button className="btn-ghost" onClick={()=>setMachineModal(null)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Machine Add/Edit Modal ── */}
      {/* ── Build Assembly Modal ── */}
      {buildAssemblyModal && (() => {
        const p = buildAssemblyModal;
        const bom = p.bomComponents || [];
        const qty = parseInt(buildAssemblyQty) || 0;
        const componentRows = bom.map(bc => {
          const compProd = products.find(pr => pr.id === bc.productId);
          const need = bc.qty * qty;
          const canBuild = compProd ? Math.floor(compProd.stock / bc.qty) : 0;
          return { ...bc, compProd, need, canBuild, enough: compProd ? compProd.stock >= need : false };
        });
        const maxBuildable = bom.length===0 ? 0 : Math.min(...componentRows.map(r => r.canBuild));
        const canSubmit = qty > 0 && componentRows.every(r => r.enough);
        return (
          <div className="modal-overlay" onClick={()=>setBuildAssemblyModal(null)}>
            <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:560 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:6, color:t.text }}>
                Build: {p.name}
              </div>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.08em", marginBottom:24 }}>
                SKU: {p.sku} · Current stock: {p.stock} {p.unit}
              </div>

              {bom.length===0 ? (
                <div style={{ padding:"20px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:11, marginBottom:20 }}>
                  No BOM defined for this subassembly. Edit the part to add components.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>Components Required</div>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${t.border}` }}>
                          {["Part","Per Unit","Need","In Stock","Status"].map(h=>(
                            <th key={h} style={{ padding:"6px 8px", textAlign:"left", fontSize:9, color:t.textDim, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {componentRows.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom:`1px solid ${t.border}`, background:!row.enough?"rgba(255,59,59,0.04)":"transparent" }}>
                            <td style={{ padding:"8px", color:t.text }}>{row.compProd?.name || <span style={{ color:"#FF3B3B" }}>Unknown</span>}</td>
                            <td style={{ padding:"8px", color:t.textMid }}>×{row.qty}</td>
                            <td style={{ padding:"8px", color:qty>0?(row.enough?"#30D158":"#FF3B3B"):t.textDim, fontWeight:500 }}>{qty>0?row.need:"—"}</td>
                            <td style={{ padding:"8px", color:t.textMid }}>{row.compProd?.stock ?? "?"} {row.compProd?.unit||""}</td>
                            <td style={{ padding:"8px" }}>
                              {qty>0 ? (
                                row.enough
                                  ? <span style={{ color:"#30D158", fontSize:9 }}>✓ OK</span>
                                  : <span style={{ color:"#FF3B3B", fontSize:9 }}>✗ SHORT {row.compProd?.stock - row.need}</span>
                              ) : <span style={{ color:t.textFaint, fontSize:9 }}>—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ background:`rgba(100,210,255,0.06)`, border:`1px solid rgba(100,210,255,0.2)`, padding:"10px 14px", marginBottom:20, fontSize:10, color:"#64D2FF" }}>
                    Max buildable with current stock: <strong>{maxBuildable}</strong>
                  </div>

                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Units to Build</div>
                    <input className="field-input" type="number" min="1" max={maxBuildable} value={buildAssemblyQty}
                      onChange={e=>setBuildAssemblyQty(e.target.value)} style={{ width:120 }} />
                  </div>
                </>
              )}

              <div style={{ display:"flex", gap:10 }}>
                <button className="btn-primary" style={{ flex:1, opacity:canSubmit?1:0.4, cursor:canSubmit?"pointer":"not-allowed" }}
                  onClick={canSubmit?buildAssembly:undefined} disabled={saving||!canSubmit}>
                  {saving?"Building…":`✓ Build ${qty>0?qty:""} Unit${qty!==1?"s":""}`}
                </button>
                <button className="btn-ghost" onClick={()=>setBuildAssemblyModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {machineModal && (machineModal.mode==="add"||machineModal.mode==="edit") && (
        <div className="modal-overlay" onClick={()=>setMachineModal(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ width:620 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, marginBottom:24, color:t.text }}>
              {machineModal.mode==="add"?"New Machine / Bill of Materials":"Edit Bill of Materials"}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:5, textTransform:"uppercase" }}>Machine Name</div>
                <input className="field-input" value={machineForm.name} onChange={e=>setMachineForm(f=>({ ...f, name:e.target.value }))} placeholder="e.g. Assembly Unit Alpha" />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:5, textTransform:"uppercase" }}>Description (optional)</div>
                <input className="field-input" value={machineForm.description} onChange={e=>setMachineForm(f=>({ ...f, description:e.target.value }))} placeholder="Brief description..." />
              </div>
            </div>

            {/* Machine photo */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", marginBottom:8, textTransform:"uppercase" }}>Machine Photo (optional)</div>
              {machineForm.imageUrl ? (
                <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                  <img src={machineForm.imageUrl} alt="" style={{ width:120, height:80, objectFit:"cover", border:`1px solid ${t.borderStrong}` }} />
                  <div style={{ display:"flex", flexDirection:"column", gap:8, paddingTop:4 }}>
                    <label className="btn-ghost" style={{ cursor:"pointer", textAlign:"center", display:"block" }}>
                      Replace Photo
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ handleMachineImageFile(e.target.files[0]); e.target.value=""; }} />
                    </label>
                    <button className="btn-danger" onClick={()=>setMachineForm(f=>({ ...f, imageUrl:null }))}>Remove</button>
                  </div>
                </div>
              ) : (
                <label style={{ border:`1px dashed ${t.borderStrong}`, background:t.bg, padding:"20px", textAlign:"center", cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"border-color 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=t.borderStrong}>
                  <div style={{ fontSize:32, opacity:0.4 }}>🏭</div>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:11, color:t.textDim, marginBottom:2 }}>Click to upload a machine photo</div>
                    <div style={{ fontSize:10, color:t.textFaint }}>JPG, PNG, WEBP</div>
                  </div>
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ handleMachineImageFile(e.target.files[0]); e.target.value=""; }} />
                </label>
              )}
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Components / Bill of Materials</div>
              <button className="btn-ghost" onClick={addComponent} style={{ fontSize:10 }}>+ Add Component</button>
            </div>

            <div style={{ maxHeight:320, overflowY:"auto", marginBottom:20 }}>
              {machineForm.components.length===0 && (
                <div style={{ padding:"24px", textAlign:"center", border:`1px dashed ${t.border}`, color:t.textFaint, fontSize:11 }}>No components yet. Add inventory items or custom parts.</div>
              )}
              {machineForm.components.map((comp,idx) => (
                <div key={idx} style={{ display:"grid", gridTemplateColumns:"2fr 80px 1fr auto", gap:8, marginBottom:8, alignItems:"start" }}>
                  <div>
                    <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>INVENTORY PART</div>
                    <select className="field-input" value={comp.productId} onChange={e=>updateComponent(idx,"productId",e.target.value)}>
                      <option value="">— Select part —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>QTY EACH</div>
                    <input className="field-input" type="number" min="1" value={comp.qty} onChange={e=>updateComponent(idx,"qty",e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:t.textDim, letterSpacing:"0.08em", marginBottom:4 }}>NOTE</div>
                    <input className="field-input" value={comp.note} onChange={e=>updateComponent(idx,"note",e.target.value)} placeholder="Optional note..." />
                  </div>
                  <button className="btn-danger" style={{ marginTop:18 }} onClick={()=>removeComponent(idx)}>✕</button>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={saveMachine}>{machineModal.mode==="add"?"Create Machine":"Save Changes"}</button>
              <button className="btn-ghost" onClick={()=>setMachineModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
