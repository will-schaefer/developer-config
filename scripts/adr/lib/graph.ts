/**
 * ADR graph core — pure derivation of the relationship model (nodes + edges) and the
 * standalone HTML viewer. No file I/O (that's lib/load.ts) and no process exit (that's
 * the CLI): importable by the `adr` CLI and by nxtlvl:audit, and unit-tested with fixtures.
 *
 * Two outputs share one model:
 *   - toJsonModel(): lean, body-free graph → stdout for `adr graph --json` (in-session
 *     render; decision B — no repo artifact).
 *   - renderHtml(): the self-contained interactive viewer → opt-in `adr graph --html`.
 *
 * This is the single canonical home for the renderer — the runnable scripts/adr/graph.ts
 * imports it rather than carrying its own copy, so there is exactly one viewer to maintain.
 */
import type { AdrNode } from './load.ts';
import { extractCrossLinks } from './parse.ts';

export type EdgeType = 'supersedes' | 'amends' | 'references';
export interface Edge { from: string; to: string; type: EdgeType }

/** Lean node — the full model minus the heavy body, for the --json (in-session) render. */
export type GraphNode = Omit<AdrNode, 'body'>;
export interface GraphModel { nodes: GraphNode[]; edges: Edge[] }

/**
 * Derive edges from the typed nodes. Structural edges (supersedes/amends, declared in
 * frontmatter) win; a body cross-link that merely duplicates a structural relation — in
 * either direction — is dropped, self-references are ignored, and an edge is only kept
 * when both endpoints are known ADRs.
 */
export function buildEdges(nodes: AdrNode[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: Edge[] = [];
  const structural = new Set<string>(); // `${from}->${to}` already covered by supersedes/amends
  const add = (from: string, to: string, type: EdgeType) => {
    if (!byId.has(from) || !byId.has(to) || from === to) return;
    edges.push({ from, to, type });
    if (type !== 'references') structural.add(`${from}->${to}`);
  };
  // Structural edges first so reference dedup can skip them.
  for (const n of nodes) {
    if (n.supersededBy) add(n.supersededBy, n.id, 'supersedes'); // successor supersedes n
    for (const target of n.amends) add(n.id, target, 'amends');  // n amends target
  }
  // Reference edges: body cross-links minus self minus structural duplicates.
  for (const n of nodes) {
    for (const ref of extractCrossLinks(n.body)) {
      if (ref === n.id) continue;
      if (structural.has(`${n.id}->${ref}`) || structural.has(`${ref}->${n.id}`)) continue;
      add(n.id, ref, 'references');
    }
  }
  return edges;
}

/** The lean, body-free model for `adr graph --json` → in-session render (decision B). */
export function toJsonModel(nodes: AdrNode[], edges: Edge[]): GraphModel {
  return { nodes: nodes.map(({ body, ...meta }) => meta), edges };
}

/** Render the self-contained interactive HTML viewer (opt-in `--html` artifact). */
export function renderHtml(nodes: AdrNode[], edges: Edge[]): string {
  const json = JSON.stringify({ nodes, edges }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>nxtlvl ADR dependency map</title>
<style>
  :root {
    --bg: #0f1117; --panel: #161a23; --line: #2a2f3a; --ink: #d7dce5; --muted: #8b93a3;
    --accepted: #4ec9b0; --superseded: #6b7280; --unknown: #c084fc;
    --e-supersedes: #f97066; --e-amends: #fbbf24; --e-references: #3b4252;
    --accent: #5b9bff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  #app { display: grid; grid-template-columns: 1fr 420px; grid-template-rows: auto 1fr; height: 100vh; }
  header { grid-column: 1 / -1; display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
    padding: 10px 16px; border-bottom: 1px solid var(--line); background: var(--panel); }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; letter-spacing: .2px; }
  header .grow { flex: 1; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border: 1px solid var(--line);
    border-radius: 6px; background: #1c2230; color: var(--ink); cursor: pointer; user-select: none; font-size: 12.5px; }
  .chip input { accent-color: var(--accent); margin: 0; }
  .chip.off { opacity: .4; }
  #search { padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: #1c2230;
    color: var(--ink); width: 200px; outline: none; }
  #search:focus { border-color: var(--accent); }
  button.act { padding: 6px 11px; border: 1px solid var(--line); border-radius: 6px; background: #1c2230;
    color: var(--ink); cursor: pointer; font-size: 12.5px; }
  button.act:hover { border-color: var(--accent); }
  #graphwrap { position: relative; overflow: hidden; }
  svg { width: 100%; height: 100%; display: block; cursor: grab; }
  svg.panning { cursor: grabbing; }
  .edge { stroke-width: 1.2; fill: none; }
  .edge.supersedes { stroke: var(--e-supersedes); stroke-width: 2.2; }
  .edge.amends { stroke: var(--e-amends); stroke-width: 1.8; }
  .edge.references { stroke: var(--e-references); }
  .edge.dim { opacity: .07; }
  .node circle { stroke: #0b0d12; stroke-width: 1.5; cursor: pointer; }
  .node text { fill: #0b0d12; font-size: 11px; font-weight: 700; pointer-events: none; text-anchor: middle; }
  .node.dim { opacity: .12; }
  .node.sel circle { stroke: #fff; stroke-width: 3; }
  .node .ring { fill: none; stroke-dasharray: 3 3; }
  aside { grid-row: 2; grid-column: 2; border-left: 1px solid var(--line); background: var(--panel);
    overflow-y: auto; padding: 0; }
  .detail { padding: 16px 18px; }
  .detail .empty { color: var(--muted); padding: 30px 4px; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
    margin-right: 6px; vertical-align: middle; }
  .badge.accepted { background: rgba(78,201,176,.15); color: var(--accepted); }
  .badge.superseded { background: rgba(107,114,128,.2); color: #c3c9d4; }
  .badge.unknown { background: rgba(192,132,252,.15); color: var(--unknown); }
  .badge.build { background: rgba(91,155,255,.13); color: var(--accent); }
  .detail h2 { font-size: 15px; margin: 10px 0 4px; }
  .detail .meta { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
  .detail .rel { font-size: 12.5px; margin: 2px 0; }
  .detail .rel b { color: var(--muted); font-weight: 600; }
  .md { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 12px; font-size: 13px; }
  .md h1 { font-size: 16px; margin: 14px 0 6px; }
  .md h2 { font-size: 14px; margin: 14px 0 5px; color: var(--accent); }
  .md h3 { font-size: 13px; margin: 12px 0 4px; }
  .md p { margin: 7px 0; }
  .md ul { margin: 6px 0; padding-left: 20px; }
  .md li { margin: 3px 0; }
  .md code { background: #0b0d12; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .md pre { background: #0b0d12; padding: 10px; border-radius: 6px; overflow-x: auto; }
  .md a { color: var(--accent); cursor: pointer; }
  .adrlink { color: var(--accent); cursor: pointer; text-decoration: underline dotted; }
  .openraw { display: inline-block; margin-top: 6px; color: var(--accent); font-size: 12px; }
  .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); align-items: center; }
  .legend i { display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
  .legend .ln { display: inline-block; width: 16px; height: 0; border-top-width: 2px; border-top-style: solid; margin-right: 4px; vertical-align: 3px; }
</style>
</head>
<body>
<div id="app">
  <header>
    <h1>nxtlvl ADR map</h1>
    <span class="muted" id="count"></span>
    <input id="search" placeholder="search id or title…" autocomplete="off" />
    <span class="grow"></span>
    <label class="chip" data-status="Accepted"><input type="checkbox" checked /> Accepted</label>
    <label class="chip" data-status="Superseded"><input type="checkbox" checked /> Superseded</label>
    <span style="width:1px;height:18px;background:var(--line)"></span>
    <label class="chip" data-edge="supersedes"><input type="checkbox" checked /> supersedes</label>
    <label class="chip" data-edge="amends"><input type="checkbox" checked /> amends</label>
    <label class="chip" data-edge="references"><input type="checkbox" checked /> references</label>
    <button class="act" id="relayout">re-layout</button>
  </header>
  <div id="graphwrap"><svg id="svg"></svg></div>
  <aside><div class="detail" id="detail"><div class="empty">Click a node to read the ADR.<br/>Drag to pan · scroll to zoom · drag a node to reposition.</div></div></aside>
</div>
<div style="position:fixed;left:14px;bottom:12px" class="legend">
  <span><i style="background:var(--accepted)"></i>Accepted</span>
  <span><i style="background:var(--superseded)"></i>Superseded</span>
  <span><span class="ln" style="border-color:var(--e-supersedes)"></span>supersedes</span>
  <span><span class="ln" style="border-color:var(--e-amends)"></span>amends</span>
  <span><span class="ln" style="border-color:var(--e-references)"></span>references</span>
  <span style="border:1px dashed var(--muted);border-radius:50%;width:11px;height:11px;display:inline-block"></span><span style="margin-left:-8px">dashed ring = not yet shipped</span>
</div>
<script>
const DATA = ${json};
const SVGNS = "http://www.w3.org/2000/svg";
const W = () => document.getElementById('graphwrap').clientWidth;
const H = () => document.getElementById('graphwrap').clientHeight;
const svg = document.getElementById('svg');
const byId = new Map(DATA.nodes.map(n => [n.id, n]));
document.getElementById('count').textContent = DATA.nodes.length + ' ADRs · ' + DATA.edges.length + ' edges';

// ---- circular chord layout: ADRs evenly on a ring, ordered by number ----
// Deterministic (no jitter), always frames cleanly, labels stay legible — the
// right shape for N ordered, densely-linked items vs a force-directed hairball.
const N = DATA.nodes.length;
const CX = 0, CY = 0;
const RADIUS = Math.max(280, N * 9);
function layout() {
  DATA.nodes.forEach((n, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;   // ADR-001 at top, ascending clockwise
    n.x = CX + Math.cos(a) * RADIUS;
    n.y = CY + Math.sin(a) * RADIUS;
  });
}
layout();
// References appended first so the 5-edge structural spine renders on top of the 197 faint arcs.
const ORDER = { references: 0, amends: 1, supersedes: 2 };
const adj = DATA.edges.map(e => ({ a: byId.get(e.from), b: byId.get(e.to), type: e.type }))
  .filter(e => e.a && e.b)
  .sort((x, y) => ORDER[x.type] - ORDER[y.type]);

// ---- viewport (pan/zoom via viewBox) ----
let vb = { x: 0, y: 0, w: W(), h: H() };
function applyVB() { svg.setAttribute('viewBox', vb.x+' '+vb.y+' '+vb.w+' '+vb.h); }
function fit() {
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const n of DATA.nodes) { minX=Math.min(minX,n.x); minY=Math.min(minY,n.y); maxX=Math.max(maxX,n.x); maxY=Math.max(maxY,n.y); }
  if (!isFinite(minX)) { vb = { x: 0, y: 0, w: W(), h: H() }; applyVB(); return; }
  const pad = 70;
  let w = (maxX - minX) + pad*2, h = (maxY - minY) + pad*2;
  const ar = W() / H() || 1;                 // frame everything; keep viewport aspect ratio
  if (w / h < ar) w = h * ar; else h = w / ar;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  vb = { x: cx - w/2, y: cy - h/2, w, h };
  applyVB();
}
fit();

const STATUS_CLASS = s => s === 'Accepted' ? 'accepted' : s === 'Superseded' ? 'superseded' : 'unknown';
const STATUS_FILL = s => s === 'Accepted' ? 'var(--accepted)' : s === 'Superseded' ? 'var(--superseded)' : 'var(--unknown)';

// ---- render ----
let edgeEls = [], nodeEls = new Map(), selected = null;
function render() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  // arrowheads
  const defs = document.createElementNS(SVGNS, 'defs');
  for (const [id, color] of [['s','var(--e-supersedes)'],['a','var(--e-amends)'],['r','var(--e-references)']]) {
    const m = document.createElementNS(SVGNS, 'marker');
    m.setAttribute('id','arr-'+id); m.setAttribute('viewBox','0 0 10 10');
    m.setAttribute('refX','9'); m.setAttribute('refY','5'); m.setAttribute('markerWidth','6');
    m.setAttribute('markerHeight','6'); m.setAttribute('orient','auto-start-reverse');
    const path = document.createElementNS(SVGNS,'path');
    path.setAttribute('d','M0,0 L10,5 L0,10 z'); path.setAttribute('fill', color);
    m.appendChild(path); defs.appendChild(m);
  }
  svg.appendChild(defs);
  const gE = document.createElementNS(SVGNS, 'g');
  const gN = document.createElementNS(SVGNS, 'g');
  svg.appendChild(gE); svg.appendChild(gN);
  edgeEls = adj.map(e => {
    const pa = document.createElementNS(SVGNS, 'path');
    pa.setAttribute('class', 'edge ' + e.type);
    pa.setAttribute('marker-end', 'url(#arr-' + e.type[0] + ')');
    e.el = pa; gE.appendChild(pa); return pa;
  });
  nodeEls = new Map();
  for (const n of DATA.nodes) {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'node');
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('r', '13'); c.setAttribute('fill', STATUS_FILL(n.status));
    g.appendChild(c);
    if (n.build !== 'shipped') {
      const ring = document.createElementNS(SVGNS, 'circle');
      ring.setAttribute('class', 'ring'); ring.setAttribute('r', '17');
      ring.setAttribute('stroke', STATUS_FILL(n.status)); g.appendChild(ring);
    }
    const t = document.createElementNS(SVGNS, 'text');
    t.setAttribute('dy', '3.5'); t.textContent = String(n.num).padStart(3,'0');
    g.appendChild(t);
    g.addEventListener('mousedown', (ev) => startNodeDrag(ev, n));
    g.addEventListener('click', (ev) => { ev.stopPropagation(); select(n.id); });
    n.g = g; nodeEls.set(n.id, g); gN.appendChild(g);
  }
  position();
  applyFilters();
}
function position() {
  for (const e of adj) {
    const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
    const ctlx = CX + (mx - CX) * 0.4, ctly = CY + (my - CY) * 0.4; // bow chords toward center
    e.el.setAttribute('d', 'M'+e.a.x+' '+e.a.y+' Q'+ctlx+' '+ctly+' '+e.b.x+' '+e.b.y);
  }
  for (const n of DATA.nodes) n.g.setAttribute('transform', 'translate('+n.x+','+n.y+')');
}

// ---- filters / search / selection highlighting ----
const statusOn = { Accepted: true, Superseded: true, Unknown: true };
const edgeOn = { supersedes: true, amends: true, references: true };
let query = '';
function nodeVisible(n) {
  const s = statusOn[n.status] ?? true;
  const q = !query || n.id.toLowerCase().includes(query) || n.title.toLowerCase().includes(query);
  return s && q;
}
function applyFilters() {
  const neighborHi = new Set();
  if (selected) { neighborHi.add(selected);
    for (const e of adj) { if (e.a.id === selected) neighborHi.add(e.b.id); if (e.b.id === selected) neighborHi.add(e.a.id); }
  }
  for (const n of DATA.nodes) {
    const vis = nodeVisible(n);
    const dim = !vis || (selected && !neighborHi.has(n.id));
    n.g.classList.toggle('dim', !!dim);
    n.g.classList.toggle('sel', n.id === selected);
  }
  for (const e of adj) {
    const typeOn = edgeOn[e.type];
    const endsVis = nodeVisible(e.a) && nodeVisible(e.b);
    const onPath = !selected || e.a.id === selected || e.b.id === selected;
    e.el.classList.toggle('dim', !(typeOn && endsVis && onPath));
  }
}

// ---- detail panel + tiny markdown renderer ----
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){
  s = esc(s);
  s = s.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  // [text](ADR-NNN-...md) -> in-panel jump; other links open in new tab
  s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, (m, txt, url) => {
    const adr = /(ADR-\\d{3})/.exec(url);
    if (adr) return '<span class="adrlink" data-jump="'+adr[1]+'">'+txt+'</span>';
    return '<a href="'+url+'" target="_blank" rel="noopener">'+txt+'</a>';
  });
  // bare ADR-NNN -> jump
  s = s.replace(/\\b(ADR-\\d{3})\\b/g, (m,id) => byId.has(id) ? '<span class="adrlink" data-jump="'+id+'">'+id+'</span>' : id);
  return s;
}
function renderMd(src){
  const lines = src.split(/\\r?\\n/); let html=''; let inList=false; let inCode=false; let para=[];
  const flush = () => { if(para.length){ html += '<p>'+inline(para.join(' '))+'</p>'; para=[]; } };
  for (const raw of lines) {
    const line = raw;
    if (/^\`\`\`/.test(line)) { flush(); if(inList){html+='</ul>';inList=false;} inCode=!inCode; html += inCode?'<pre>':'</pre>'; continue; }
    if (inCode) { html += esc(line)+'\\n'; continue; }
    const h = /^(#{1,4})\\s+(.*)$/.exec(line);
    if (h) { flush(); if(inList){html+='</ul>';inList=false;} const lv=h[1].length; html += '<h'+lv+'>'+inline(h[2])+'</h'+lv+'>'; continue; }
    const li = /^\\s*[-*]\\s+(.*)$/.exec(line);
    if (li) { flush(); if(!inList){html+='<ul>';inList=true;} html += '<li>'+inline(li[1])+'</li>'; continue; }
    if (line.trim()==='') { flush(); if(inList){html+='</ul>';inList=false;} continue; }
    para.push(line.trim());
  }
  flush(); if(inList) html+='</ul>'; if(inCode) html+='</pre>';
  return html;
}
function select(id) {
  selected = id;
  const n = byId.get(id);
  const d = document.getElementById('detail');
  const rels = [];
  if (n.supersededBy) rels.push('<div class="rel"><b>superseded by</b> <span class="adrlink" data-jump="'+n.supersededBy+'">'+n.supersededBy+'</span></div>');
  const supersedes = DATA.nodes.filter(x => x.supersededBy === id).map(x=>x.id);
  if (supersedes.length) rels.push('<div class="rel"><b>supersedes</b> '+supersedes.map(x=>'<span class="adrlink" data-jump="'+x+'">'+x+'</span>').join(', ')+'</div>');
  if (n.amends.length) rels.push('<div class="rel"><b>amends</b> '+n.amends.map(x=>'<span class="adrlink" data-jump="'+x+'">'+x+'</span>').join(', ')+'</div>');
  const amendedBy = DATA.nodes.filter(x => x.amends.includes(id)).map(x=>x.id);
  if (amendedBy.length) rels.push('<div class="rel"><b>amended by</b> '+amendedBy.map(x=>'<span class="adrlink" data-jump="'+x+'">'+x+'</span>').join(', ')+'</div>');
  d.innerHTML =
    '<span class="badge '+STATUS_CLASS(n.status)+'">'+n.status+'</span>'+
    (n.build!=='shipped'?'<span class="badge build">'+n.build+'</span>':'')+
    '<h2>'+esc(n.id)+' — '+esc(n.title)+'</h2>'+
    '<div class="meta">'+esc(n.date)+'</div>'+
    rels.join('')+
    '<a class="openraw" href="'+encodeURIComponent(n.slug)+'" target="_blank" rel="noopener">open raw '+esc(n.slug)+' ↗</a>'+
    '<div class="md">'+renderMd(n.body)+'</div>';
  d.querySelectorAll('[data-jump]').forEach(el => el.addEventListener('click', () => select(el.getAttribute('data-jump'))));
  d.scrollTop = 0;
  applyFilters();
}

// ---- interactions ----
document.getElementById('search').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); applyFilters(); });
document.querySelectorAll('[data-status]').forEach(ch => ch.addEventListener('change', (e) => {
  statusOn[ch.dataset.status] = e.target.checked; ch.classList.toggle('off', !e.target.checked); applyFilters();
}));
document.querySelectorAll('[data-edge]').forEach(ch => ch.addEventListener('change', (e) => {
  edgeOn[ch.dataset.edge] = e.target.checked; ch.classList.toggle('off', !e.target.checked); applyFilters();
}));
document.getElementById('relayout').addEventListener('click', () => { layout(); position(); fit(); });
svg.addEventListener('click', () => { selected = null; applyFilters(); });

// background pan
let panning = false, panStart = null;
svg.addEventListener('mousedown', (e) => { if (e.target === svg || e.target.tagName==='path') { panning = true; panStart = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; svg.classList.add('panning'); } });
window.addEventListener('mousemove', (e) => {
  if (panning) { const sx = vb.w / W(); vb.x = panStart.vx - (e.clientX - panStart.x) * sx; vb.y = panStart.vy - (e.clientY - panStart.y) * sx; applyVB(); }
});
window.addEventListener('mouseup', () => { panning = false; svg.classList.remove('panning'); dragNode = null; });
// zoom
svg.addEventListener('wheel', (e) => {
  e.preventDefault();
  const scale = e.deltaY > 0 ? 1.1 : 0.9;
  const mx = vb.x + (e.offsetX / W()) * vb.w, my = vb.y + (e.offsetY / H()) * vb.h;
  vb.w *= scale; vb.h *= scale;
  vb.x = mx - (e.offsetX / W()) * vb.w; vb.y = my - (e.offsetY / H()) * vb.h;
  applyVB();
}, { passive: false });
// node drag
let dragNode = null, dragOff = null;
function startNodeDrag(e, n) {
  e.stopPropagation(); dragNode = n;
  const sx = vb.w / W(); dragOff = { x: vb.x + e.offsetX * sx - n.x, y: vb.y + e.offsetY * sx - n.y };
}
window.addEventListener('mousemove', (e) => {
  if (!dragNode) return;
  const sx = vb.w / W(); dragNode.x = vb.x + e.offsetX * sx - dragOff.x; dragNode.y = vb.y + e.offsetY * sx - dragOff.y;
  position();
});

render();
</script>
</body>
</html>
`;
}
