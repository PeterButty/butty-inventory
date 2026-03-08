import { useState, useMemo, useRef, useEffect } from 'react'
import { supabase } from './supabase'

const SUPABASE_URL = 'https://doajjmtxvwqounqpqzxv.supabase.co'

function getStockStatus(stock, minStock) {
  if (stock === 0) return 'out'
  if (stock < minStock) return 'low'
  if (stock < minStock * 1.5) return 'warning'
  return 'ok'
}

const STATUS_META = {
  out:     { label: 'Out of Stock', color: '#FF3B3B', bg: 'rgba(255,59,59,0.12)',  dot: '#FF3B3B' },
  low:     { label: 'Low Stock',    color: '#FF9500', bg: 'rgba(255,149,0,0.12)',  dot: '#FF9500' },
  warning: { label: 'Watch',        color: '#FFD60A', bg: 'rgba(255,214,10,0.12)', dot: '#FFD60A' },
  ok:      { label: 'In Stock',     color: '#30D158', bg: 'rgba(48,209,88,0.12)',  dot: '#30D158' },
}

function ImageThumb({ src, size = 44 }) {
  if (!src) return (
    <div style={{ width: size, height: size, background: '#1A1A26', border: '1px solid #2A2A35', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: size * 0.35, opacity: 0.3 }}>📷</span>
    </div>
  )
  return <img src={src} alt="" style={{ width: size, height: size, objectFit: 'cover', display: 'block', flexShrink: 0 }} />
}

export default function Inventory({ user, onSignOut }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustType, setAdjustType] = useState('add')
  const [lightbox, setLightbox] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  // Load products from Supabase
  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (error) showToast('Error loading products: ' + error.message, 'error')
    else setProducts(data.map(p => ({
      ...p,
      minStock: p.min_stock,
      imageUrl: p.image_url,
    })))
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))]
  }, [products])

  const stats = useMemo(() => {
    const total = products.length
    const out = products.filter(p => getStockStatus(p.stock, p.minStock) === 'out').length
    const low = products.filter(p => getStockStatus(p.stock, p.minStock) === 'low').length
    const ok = products.filter(p => getStockStatus(p.stock, p.minStock) === 'ok').length
    return { total, out, low, ok }
  }, [products])

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === 'All' || p.category === category
      const status = getStockStatus(p.stock, p.minStock)
      const matchStatus = filterStatus === 'All' || status === filterStatus.toLowerCase()
      return matchSearch && matchCat && matchStatus
    })
    list = [...list].sort((a, b) => {
      const field = sortBy === 'minStock' ? 'min_stock' : sortBy
      let av = a[field], bv = b[field]
      if (typeof av === 'string') av = av?.toLowerCase(), bv = bv?.toLowerCase()
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [products, search, category, filterStatus, sortBy, sortDir])

  function openAdd() {
    setForm({ sku: '', name: '', category: '', stock: '', minStock: '', unit: 'pcs', location: '', imageUrl: null })
    setModal({ mode: 'add' })
  }

  function openEdit(p) {
    setForm({ ...p })
    setModal({ mode: 'edit', product: p })
  }

  function openAdjust(p) {
    setAdjustQty('')
    setAdjustType('add')
    setModal({ mode: 'adjust', product: p })
  }

  function closeModal() { setModal(null) }

  async function handleImageUpload(productId, file) {
    if (!file || !file.type.startsWith('image/')) return null
    const ext = file.name.split('.').pop()
    const path = `${productId}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (error) { showToast('Image upload failed: ' + error.message, 'error'); return null }
    return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
  }

  async function handleFormImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    // Preview locally while saving
    const reader = new FileReader()
    reader.onload = e => setForm(f => ({ ...f, _localImage: e.target.result, _imageFile: file }))
    reader.readAsDataURL(file)
  }

  async function saveProduct() {
    if (!form.name || !form.sku) return
    setSaving(true)
    const id = modal.mode === 'add' ? crypto.randomUUID() : form.id
    let imageUrl = form.imageUrl || null

    if (form._imageFile) {
      imageUrl = await handleImageUpload(id, form._imageFile)
    }

    const payload = {
      id,
      sku: form.sku,
      name: form.name,
      category: form.category,
      stock: parseInt(form.stock) || 0,
      min_stock: parseInt(form.minStock) || 0,
      unit: form.unit || 'pcs',
      location: form.location,
      image_url: imageUrl,
    }

    const { error } = await supabase.from('products').upsert(payload)
    if (error) showToast('Save failed: ' + error.message, 'error')
    else { showToast(modal.mode === 'add' ? 'Product added!' : 'Product updated!'); await fetchProducts() }
    setSaving(false)
    closeModal()
  }

  async function applyAdjust() {
    const qty = parseInt(adjustQty)
    if (isNaN(qty) || qty < 0) return
    setSaving(true)
    const p = modal.product
    const newStock = adjustType === 'add' ? p.stock + qty : Math.max(0, p.stock - qty)
    const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', p.id)
    if (error) showToast('Update failed: ' + error.message, 'error')
    else { showToast('Stock updated!'); await fetchProducts() }
    setSaving(false)
    closeModal()
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) showToast('Delete failed: ' + error.message, 'error')
    else { showToast('Product deleted.'); await fetchProducts() }
  }

  async function handleRowImageFile(productId, file) {
    if (!file || !file.type.startsWith('image/')) return
    setSaving(true)
    const imageUrl = await handleImageUpload(productId, file)
    if (imageUrl) {
      const { error } = await supabase.from('products').update({ image_url: imageUrl }).eq('id', productId)
      if (error) showToast('Failed to save image', 'error')
      else { showToast('Photo saved!'); await fetchProducts() }
    }
    setSaving(false)
  }

  function toggleSort(field) {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(field); setSortDir('asc') }
  }

  const alerts = products.filter(p => ['out', 'low'].includes(getStockStatus(p.stock, p.minStock)))

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0F', color: '#E8E8F0', fontFamily: "'DM Mono', 'Fira Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input, select { outline: none; }
        .row-hover:hover { background: rgba(255,255,255,0.04) !important; }
        .btn-primary { background: #2B3FE0; color: #fff; border: none; padding: 9px 20px; font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.85; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #888; border: 1px solid #2A2A35; padding: 7px 14px; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; letter-spacing: 0.06em; transition: all 0.15s; }
        .btn-ghost:hover { border-color: #555; color: #E8E8F0; }
        .btn-danger { background: transparent; color: #FF3B3B; border: 1px solid rgba(255,59,59,0.3); padding: 5px 10px; font-family: 'DM Mono', monospace; font-size: 11px; cursor: pointer; transition: all 0.15s; }
        .btn-danger:hover { background: rgba(255,59,59,0.1); }
        .chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
        .chip.active { border-color: #E8E8F0; color: #E8E8F0; }
        .chip:not(.active) { color: #666; border-color: #1E1E28; }
        .chip:not(.active):hover { border-color: #444; color: #aaa; }
        .field-input { background: #111118; border: 1px solid #2A2A35; color: #E8E8F0; padding: 9px 12px; font-family: 'DM Mono', monospace; font-size: 12px; width: 100%; transition: border-color 0.15s; }
        .field-input:focus { border-color: #2B3FE0; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
        .modal-box { background: #111118; border: 1px solid #2A2A35; padding: 32px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
        .sort-btn { background: none; border: none; color: inherit; cursor: pointer; font-family: inherit; font-size: inherit; display: flex; align-items: center; gap: 4px; padding: 0; }
        .sort-btn:hover { color: #E8E8F0; }
        .alert-bar { background: rgba(255,59,59,0.08); border: 1px solid rgba(255,59,59,0.2); padding: 10px 18px; display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: 0.06em; }
        .img-upload-zone { border: 1px dashed #2A2A35; background: #0D0D18; padding: 18px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
        .img-upload-zone:hover { border-color: #2B3FE0; }
        .lightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 200; backdrop-filter: blur(8px); cursor: zoom-out; }
        .toast { position: fixed; bottom: 28px; right: 28px; padding: 12px 20px; font-size: 12px; letter-spacing: 0.06em; z-index: 300; border: 1px solid; animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .spinner { width: 16px; height: 16px; border: 2px solid #2A2A35; border-top-color: #2B3FE0; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1E1E28', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0D0D18', minHeight: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#2B3FE0', letterSpacing: '-0.02em' }}>butty</div>
          <div style={{ width: 1, height: 36, background: '#2A2A35' }} />
          <div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: '#E8E8F0', textTransform: 'uppercase' }}>Butty Manufacturing</div>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.16em', marginTop: 1 }}>FINISHED GOODS INVENTORY SYSTEM</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {saving && <div className="spinner" />}
          <span style={{ fontSize: 10, color: '#444', letterSpacing: '0.08em' }}>{user.email}</span>
          <button className="btn-ghost" onClick={onSignOut}>Sign Out</button>
          <button className="btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      <div style={{ padding: '28px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total SKUs', value: stats.total, color: '#FFE033' },
            { label: 'In Stock', value: stats.ok, color: '#30D158' },
            { label: 'Low Stock', value: stats.low, color: '#FF9500' },
            { label: 'Out of Stock', value: stats.out, color: '#FF3B3B' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0F0F18', border: '1px solid #1E1E28', padding: '20px 24px' }}>
              <div style={{ fontSize: 10, color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{s.label}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="alert-bar" style={{ marginBottom: 22 }}>
            <span style={{ color: '#FF3B3B', fontSize: 14 }}>⚠</span>
            <span style={{ color: '#FF9090' }}>{alerts.length} product{alerts.length > 1 ? 's' : ''} need attention:</span>
            <span style={{ color: '#666' }}>{alerts.map(a => a.name).join(' · ')}</span>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field-input" style={{ width: 240 }} placeholder="Search SKU or name..." value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categories.map(c => (
              <span key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {['All', 'ok', 'warning', 'low', 'out'].map(s => (
              <span key={s} className={`chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                {s === 'All' ? 'All Status' : STATUS_META[s].label}
              </span>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ border: '1px solid #1E1E28', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#444' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 11, letterSpacing: '0.08em' }}>Loading inventory...</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E28', background: '#0F0F18' }}>
                  {[
                    { label: 'Photo', field: null },
                    { label: 'SKU', field: 'sku' },
                    { label: 'Product Name', field: 'name' },
                    { label: 'Category', field: 'category' },
                    { label: 'Location', field: 'location' },
                    { label: 'Stock', field: 'stock' },
                    { label: 'Min Level', field: 'minStock' },
                    { label: 'Status', field: null },
                    { label: 'Actions', field: null },
                  ].map(col => (
                    <th key={col.label} style={{ padding: '12px 16px', textAlign: 'left', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {col.field ? (
                        <button className="sort-btn" style={{ color: sortBy === col.field ? '#E8E8F0' : '#555' }} onClick={() => toggleSort(col.field)}>
                          {col.label} {sortBy === col.field ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#444' }}>No products found.</td></tr>
                )}
                {filtered.map((p, i) => {
                  const status = getStockStatus(p.stock, p.minStock)
                  const sm = STATUS_META[status]
                  const pct = Math.min(100, Math.round((p.stock / (p.minStock * 2)) * 100))
                  return (
                    <tr key={p.id} className="row-hover" style={{ borderBottom: '1px solid #1A1A22', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        {p.imageUrl ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <button onClick={() => setLightbox(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              <ImageThumb src={p.imageUrl} size={44} />
                            </button>
                            <label style={{ fontSize: 9, color: '#555', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', letterSpacing: '0.04em' }}>
                              replace
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { handleRowImageFile(p.id, e.target.files[0]); e.target.value = ''; }} />
                            </label>
                          </div>
                        ) : (
                          <label
                            style={{ background: '#0F0F18', border: '1px dashed #2A2A35', width: 44, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 2 }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#2B3FE0'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#2A2A35'}
                          >
                            <span style={{ fontSize: 16 }}>📷</span>
                            <span style={{ fontSize: 8, color: '#555', fontFamily: 'inherit', letterSpacing: '0.04em' }}>ADD</span>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { handleRowImageFile(p.id, e.target.files[0]); e.target.value = ''; }} />
                          </label>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#888', fontWeight: 500 }}>{p.sku}</td>
                      <td style={{ padding: '10px 16px', color: '#E8E8F0' }}>{p.name}</td>
                      <td style={{ padding: '10px 16px', color: '#666' }}>{p.category}</td>
                      <td style={{ padding: '10px 16px', color: '#666' }}>{p.location}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ color: sm.color, fontWeight: 500 }}>{p.stock?.toLocaleString()} {p.unit}</span>
                          <div style={{ height: 3, background: '#1E1E28', width: 80, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: sm.color, borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#555' }}>{p.minStock?.toLocaleString()} {p.unit}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ background: sm.bg, color: sm.color, padding: '3px 10px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.dot, display: 'inline-block' }} />
                          {sm.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-ghost" onClick={() => openAdjust(p)}>Adjust</button>
                          <button className="btn-ghost" onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn-danger" onClick={() => deleteProduct(p.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: '#444', letterSpacing: '0.08em' }}>
          SHOWING {filtered.length} OF {products.length} PRODUCTS
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div style={{ marginBottom: 16, fontSize: 11, color: '#666', letterSpacing: '0.1em' }}>
            {lightbox.sku} · {lightbox.name} — click anywhere to close
          </div>
          <img src={lightbox.imageUrl} alt={lightbox.name} style={{ maxWidth: '85vw', maxHeight: '78vh', objectFit: 'contain', border: '1px solid #2A2A35' }} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" style={{ background: toast.type === 'error' ? 'rgba(255,59,59,0.15)' : 'rgba(48,209,88,0.12)', color: toast.type === 'error' ? '#FF3B3B' : '#30D158', borderColor: toast.type === 'error' ? 'rgba(255,59,59,0.3)' : 'rgba(48,209,88,0.3)' }}>
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            {modal.mode === 'adjust' ? (
              <>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Adjust Stock</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 24 }}>{modal.product.sku} · {modal.product.name} · Current: <span style={{ color: '#E8E8F0' }}>{modal.product.stock}</span></div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                  {['add', 'remove'].map(t => (
                    <button key={t} onClick={() => setAdjustType(t)} style={{ flex: 1, padding: '10px', background: adjustType === t ? '#2B3FE0' : '#1A1A22', color: adjustType === t ? '#fff' : '#888', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                      {t === 'add' ? '+ Add' : '– Remove'}
                    </button>
                  ))}
                </div>
                <input className="field-input" type="number" min="0" placeholder="Quantity" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} style={{ marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={applyAdjust} disabled={saving}>Apply</button>
                  <button className="btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 24 }}>{modal.mode === 'add' ? 'Add Product' : 'Edit Product'}</div>

                {/* Image upload */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Product Photo</div>
                  {(form._localImage || form.imageUrl) ? (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <img src={form._localImage || form.imageUrl} alt="" style={{ width: 100, height: 100, objectFit: 'cover', border: '1px solid #2A2A35' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label className="btn-ghost" style={{ cursor: 'pointer', textAlign: 'center' }}>
                          Replace Photo
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFormImageFile(e.target.files[0])} />
                        </label>
                        <button className="btn-danger" onClick={() => setForm(f => ({ ...f, imageUrl: null, _localImage: null, _imageFile: null }))}>Remove Photo</button>
                      </div>
                    </div>
                  ) : (
                    <label className="img-upload-zone" style={{ display: 'block' }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                      <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.06em' }}>Click to upload a photo</div>
                      <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>JPG, PNG, WEBP</div>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFormImageFile(e.target.files[0])} />
                    </label>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  {[
                    { label: 'SKU', key: 'sku' },
                    { label: 'Name', key: 'name' },
                    { label: 'Category', key: 'category' },
                    { label: 'Location', key: 'location' },
                    { label: 'Stock Qty', key: 'stock', type: 'number' },
                    { label: 'Min Stock Level', key: 'minStock', type: 'number' },
                    { label: 'Unit', key: 'unit' },
                  ].map(f => (
                    <div key={f.key} style={f.key === 'name' ? { gridColumn: '1 / -1' } : {}}>
                      <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 5, textTransform: 'uppercase' }}>{f.label}</div>
                      <input className="field-input" type={f.type || 'text'} value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveProduct} disabled={saving}>
                    {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Product' : 'Save Changes'}
                  </button>
                  <button className="btn-ghost" onClick={closeModal}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
