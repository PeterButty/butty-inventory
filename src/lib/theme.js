// Colour themes and the stylesheet built from whichever one is active.

export const THEMES = {
  dark:     { name:"Dark",     bg:"#0A0A0F", headerBg:"#0D0D18", cardBg:"#0F0F18", modalBg:"#111118", border:"#1E1E28", borderStrong:"#2A2A35", text:"#E8E8F0", textMid:"#888", textDim:"#555", textFaint:"#444", accent:"#2B3FE0", accentRgb:"43,63,224",  inputBg:"#111118", rowAlt:"rgba(255,255,255,0.01)", rowHover:"rgba(255,255,255,0.04)" },
  light:    { name:"Light",    bg:"#F4F4F8", headerBg:"#FFFFFF", cardBg:"#FFFFFF", modalBg:"#FFFFFF", border:"#E0E0EA", borderStrong:"#CACAD8", text:"#111118", textMid:"#555", textDim:"#888", textFaint:"#AAA", accent:"#2B3FE0", accentRgb:"43,63,224",  inputBg:"#F9F9FC", rowAlt:"rgba(0,0,0,0.015)", rowHover:"rgba(0,0,0,0.04)" },
  midnight: { name:"Midnight", bg:"#060612", headerBg:"#09091A", cardBg:"#0C0C1E", modalBg:"#0F0F22", border:"#16163A", borderStrong:"#20204A", text:"#D0D0FF", textMid:"#7070AA", textDim:"#404070", textFaint:"#303055", accent:"#6B5CE7", accentRgb:"107,92,231", inputBg:"#0C0C1E", rowAlt:"rgba(100,100,255,0.02)", rowHover:"rgba(100,100,255,0.06)" },
  forest:   { name:"Forest",   bg:"#080F0A", headerBg:"#0B140D", cardBg:"#0E1810", modalBg:"#111C13", border:"#162019", borderStrong:"#1E2E22", text:"#D0EDD8", textMid:"#6A9A76", textDim:"#3A5E44", textFaint:"#2A4233", accent:"#2ECC71", accentRgb:"46,204,113", inputBg:"#0E1810", rowAlt:"rgba(46,204,113,0.02)", rowHover:"rgba(46,204,113,0.05)" },
  slate:    { name:"Slate",    bg:"#1A1F2E", headerBg:"#1E2438", cardBg:"#222840", modalBg:"#262D45", border:"#2E3650", borderStrong:"#3A4460", text:"#C8D0E8", textMid:"#7888AA", textDim:"#4A5570", textFaint:"#3A4260", accent:"#4A90D9", accentRgb:"74,144,217", inputBg:"#222840", rowAlt:"rgba(74,144,217,0.02)", rowHover:"rgba(74,144,217,0.06)" },
};

export const DEFAULT_THEME = 'dark';

export function buildCss(t) {
  return `
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
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.55}}
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
}
