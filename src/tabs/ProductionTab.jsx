import { useState, useMemo } from 'react'
import { useApp } from '../AppContext'
import { SectionLabel, EmptyState, Pill } from '../components/common'
import { explodeMachine } from '../lib/builds'
import {
  routeFor, wipFor, movementFor, describeMovement, availableAt, stageTotals, stageLabel,
} from '../lib/production'

const ANY_MACHINE = ''

function StageSummary({ production }) {
  const { t, products } = useApp()
  const totals = stageTotals(production, products)
  const anything = totals.some(s => s.pieces > 0)

  return (
    <div style={{ marginBottom:28 }}>
      <SectionLabel>On the floor right now</SectionLabel>
      {!anything ? (
        <EmptyState padding="20px">
          Nothing part-finished is being tracked yet. Record a batch below and it will show up here.
        </EmptyState>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${totals.length},1fr)`, gap:12 }}>
          {totals.map(stage => (
            <div key={stage.id} style={{ background:t.cardBg, border:`1px solid ${stage.pieces > 0 ? 'rgba(255,149,0,0.35)' : t.border}`, padding:'16px 18px' }}>
              <div style={{ fontSize:10, color:t.textDim, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>
                Waiting after {stage.label}
              </div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:30, fontWeight:700, color:stage.pieces > 0 ? '#FF9500' : t.textFaint, lineHeight:1 }}>
                {stage.pieces}
              </div>
              <div style={{ fontSize:9, color:t.textFaint, letterSpacing:'0.08em', marginTop:8 }}>
                {stage.parts} part{stage.parts === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductionTab({ production, onRecord }) {
  const { t, products, machines, saving } = useApp()

  const [stageId, setStageId]     = useState(production.stages[0]?.id || '')
  const [machineId, setMachineId] = useState(machines[0]?.id || ANY_MACHINE)
  const [sets, setSets]           = useState(1)
  const [amounts, setAmounts]     = useState({})   // productId -> typed quantity
  const [touched, setTouched]     = useState(false)

  // Everything this machine needs, subassemblies included, so plate parts
  // buried inside a weldment are still counted.
  const needed = useMemo(() => {
    const machine = machines.find(m => m.id === machineId)
    if (!machine) return null
    return explodeMachine(machine, products, Math.max(1, parseInt(sets) || 1))
  }, [machineId, machines, products, sets])

  // Parts whose drawing calls for the chosen process.
  const rows = useMemo(() => {
    if (!stageId) return []
    return products
      .filter(p => routeFor(production, p.id).includes(stageId))
      .filter(p => !needed || needed.has(p.id))
      .map(p => {
        const route = routeFor(production, p.id)
        const move  = movementFor(route, stageId)
        const have  = availableAt(production, p.id, move.fromStage)
        const suggested = needed ? (needed.get(p.id) || 0) : 0
        // Never suggest more than are actually waiting at the previous step.
        const capped = move.fromStage === null ? suggested : Math.min(suggested, have)
        return { product: p, route, move, have, suggested: capped }
      })
      .sort((a, b) => a.product.sku.localeCompare(b.product.sku, undefined, { numeric: true }))
  }, [products, production, stageId, needed])

  // Typed values win; otherwise the suggestion stands.
  const quantityFor = row => {
    const typed = amounts[row.product.id]
    if (typed === undefined) return touched ? 0 : row.suggested
    return parseInt(typed) || 0
  }

  const moves = rows
    .map(row => ({ row, qty: quantityFor(row) }))
    .filter(({ qty }) => qty > 0)

  const overCapacity = moves.filter(({ row, qty }) => row.move.fromStage !== null && qty > row.have)
  const totalPieces  = moves.reduce((sum, { qty }) => sum + qty, 0)
  const canRecord    = moves.length > 0 && overCapacity.length === 0 && !saving

  function setAmount(productId, value) {
    if (!touched) {
      // First edit: freeze the current suggestions so the others do not vanish.
      const frozen = {}
      rows.forEach(r => { frozen[r.product.id] = String(r.suggested) })
      frozen[productId] = value
      setAmounts(frozen)
      setTouched(true)
      return
    }
    setAmounts(a => ({ ...a, [productId]: value }))
  }

  function resetAmounts() {
    setAmounts({})
    setTouched(false)
  }

  function record() {
    onRecord(moves.map(({ row, qty }) => ({
      product_id: row.product.id,
      from_stage: row.move.fromStage,
      to_stage:   row.move.toStage,
      qty,
    })), resetAmounts)
  }

  if (!production.fromDatabase) {
    return (
      <div style={{ padding:'28px 40px', maxWidth:1100, margin:'0 auto' }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:t.text, marginBottom:6 }}>Production</div>
        <div style={{ marginTop:14, background:'rgba(255,149,0,0.08)', border:'1px solid rgba(255,149,0,0.3)', padding:'14px 18px', fontSize:11, color:'#FF9500', lineHeight:1.7 }}>
          ⚠ Process tracking is not set up yet — run migration 005_process_stages.sql in Supabase.
          It reads the PROCESSES REQUIRED block off your drawings, so every part arrives knowing
          whether it needs cutting, bending, turning, milling or paint.
        </div>
      </div>
    )
  }

  const selectedStage = production.stages.find(s => s.id === stageId)

  return (
    <div style={{ padding:'28px 40px', maxWidth:1200, margin:'0 auto' }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:t.text, marginBottom:6 }}>Production</div>
        <div style={{ fontSize:11, color:t.textDim, letterSpacing:'0.06em' }}>
          Record a run of work in one go. Parts only count as buildable once every process on their drawing is done.
        </div>
      </div>

      <StageSummary production={production} />

      {/* ── What was done ── */}
      <div style={{ background:t.cardBg, border:`1px solid ${t.border}`, padding:'22px 26px', marginBottom:20 }}>
        <SectionLabel>What did you just finish?</SectionLabel>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 140px', gap:12, marginBottom:6 }}>
          <div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.08em', marginBottom:4, textTransform:'uppercase' }}>Process</div>
            <select className="field-input" value={stageId} onChange={e => { setStageId(e.target.value); resetAmounts() }}>
              {production.stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.08em', marginBottom:4, textTransform:'uppercase' }}>For which machine</div>
            <select className="field-input" value={machineId} onChange={e => { setMachineId(e.target.value); resetAmounts() }}>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              <option value={ANY_MACHINE}>— Every part with this process —</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:9, color:t.textDim, letterSpacing:'0.08em', marginBottom:4, textTransform:'uppercase' }}>Machines' worth</div>
            <input
              className="field-input" type="number" min="1" value={sets}
              disabled={machineId === ANY_MACHINE}
              onChange={e => { setSets(e.target.value); resetAmounts() }}
              style={{ opacity: machineId === ANY_MACHINE ? 0.4 : 1 }}
            />
          </div>
        </div>

        <div style={{ fontSize:10, color:t.textFaint, letterSpacing:'0.04em' }}>
          {machineId === ANY_MACHINE
            ? 'Every part whose drawing calls for this process. Quantities start blank.'
            : 'Quantities are filled in from the machine’s parts list, subassemblies included. Change anything that differs.'}
        </div>
      </div>

      {/* ── The parts ── */}
      {rows.length === 0 ? (
        <EmptyState padding="40px">
          No parts need {selectedStage?.label?.toLowerCase() || 'this process'}
          {machineId !== ANY_MACHINE ? ' for this machine' : ''}.
        </EmptyState>
      ) : (
        <>
          <div style={{ border:`1px solid ${t.border}`, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:t.cardBg, borderBottom:`1px solid ${t.border}` }}>
                  {['SKU','Part','Route','Waiting','Finished stock','Quantity done'].map(h => (
                    <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, color:t.textDim, letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const qty = quantityFor(row)
                  const over = row.move.fromStage !== null && qty > row.have
                  return (
                    <tr key={row.product.id} style={{ borderBottom:`1px solid ${t.border}`, background: over ? 'rgba(255,59,59,0.06)' : i % 2 === 0 ? 'transparent' : t.rowAlt }}>
                      <td style={{ padding:'8px 14px', color:t.textMid }}>{row.product.sku}</td>
                      <td style={{ padding:'8px 14px', color:t.text }}>{row.product.name}</td>
                      <td style={{ padding:'8px 14px' }}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {row.route.map(s => (
                            <Pill
                              key={s}
                              color={s === stageId ? t.accent : t.textFaint}
                              border={s === stageId ? t.accent : t.border}
                            >
                              {stageLabel(production, s)}
                            </Pill>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding:'8px 14px', color: over ? '#FF3B3B' : t.textDim }}>
                        {row.move.fromStage === null ? '—' : `${row.have} at ${stageLabel(production, row.move.fromStage)}`}
                      </td>
                      <td style={{ padding:'8px 14px', color:t.textDim }}>{row.product.stock}</td>
                      <td style={{ padding:'8px 14px' }}>
                        <input
                          className="field-input" type="number" min="0" value={qty}
                          onChange={e => setAmount(row.product.id, e.target.value)}
                          style={{ width:90, borderColor: over ? '#FF3B3B' : undefined }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <button
              className="btn-primary"
              onClick={record}
              disabled={!canRecord}
              style={{ opacity: canRecord ? 1 : 0.4, cursor: canRecord ? 'pointer' : 'not-allowed', padding:'11px 24px' }}
            >
              {saving ? 'Recording…' : `✓ Record ${totalPieces} piece${totalPieces === 1 ? '' : 's'}`}
            </button>

            <button className="btn-ghost" onClick={resetAmounts}>Reset quantities</button>

            {moves.length > 0 && overCapacity.length === 0 && (
              <div style={{ fontSize:11, color:t.textDim }}>
                {moves.length} part{moves.length === 1 ? '' : 's'} moving{' '}
                {describeMovement(production, rows[0].route, stageId)?.replace(/^from |^into /, m => m)}
              </div>
            )}

            {overCapacity.length > 0 && (
              <div style={{ fontSize:11, color:'#FF3B3B' }}>
                {overCapacity.length} part{overCapacity.length === 1 ? ' has' : 's have'} more entered than are waiting at the previous step.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
