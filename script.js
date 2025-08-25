// Basic simulation + UI interactions for the mobile futures trading screen
const state = {
  symbol: 'VN30F2509',
  side: 'buy',
  reference: 1864.5,        // Giá tham chiếu để tính % thay đổi (ví dụ)
  price: 1805.0,            // Giá nhập hiện tại
  lastPrice: 1805.0,         // Giá khớp gần nhất
  high: 1859.9,
  low: 1781.3,
  volume: 549035,           // Tổng KL (hợp đồng)
  balance: 500_000_000,     // VNĐ khả dụng
  quantity: 0.1,            // Số HĐ nhập (mặc định 0.1)
  contractMultiplier: 100000, // 1 điểm * 100,000 VNĐ
  initialMarginRatio: 0.13,  // 13% giả định
  volatilityRange: 2.5,      // Biên dao động tối đa mỗi tick (điểm)
  tickMs: 650,               // Chu kỳ cập nhật (ms)
  longRatio: 50              // Tỷ lệ Long ban đầu (mặc định 50%)
};

// Elements
const highEl = document.getElementById('highPrice');
const lowEl = document.getElementById('lowPrice');
const volEl = document.getElementById('vol24h');
const priceInput = document.getElementById('price');
const qtyInput = document.getElementById('quantity');
const qtySlider = document.getElementById('quantitySlider');
const orderTypeSel = document.getElementById('orderType');
const priceGroup = document.getElementById('priceGroup');
const submitBtn = document.getElementById('submitBtn');
// leverage / margin mode đã bỏ trong UI
const estMarginEl = document.getElementById('estMargin');
const liqPriceEl = document.getElementById('liqPrice');
const askList = document.getElementById('asks');
const bidList = document.getElementById('bids');
const midPriceEl = document.getElementById('midPrice');
const levelTmpl = document.getElementById('levelTmpl');
// Long/Short bar elements
const longSeg = document.getElementById('longSeg');
const shortSeg = document.getElementById('shortSeg');
const longPctEl = document.getElementById('longPct');
const shortPctEl = document.getElementById('shortPct');
const lsBar = document.getElementById('lsBar');
let chartCtx;
let chartCanvas;

// Initialize
function init() {
  priceInput.value = state.price.toFixed(2);
  qtyInput.value = state.quantity.toFixed(1);
  updateTicker();
  renderBook();
  updateCalc();
  setupEvents();
  initChart();
  // initLongShort bỏ – tỷ lệ sẽ cập nhật sau mỗi lần renderBook
  // vòng lặp mô phỏng giá nhanh hơn
  setInterval(tick, state.tickMs);
}

function updateTicker() {
  // cập nhật số liệu và giá ở giữa order book (midPrice)
  highEl.textContent = state.high.toFixed(1);
  lowEl.textContent = state.low.toFixed(1);
  volEl.textContent = formatNumber(state.volume);
  const changePts = state.lastPrice - state.reference;
  const changePct = changePts / state.reference * 100;
  const badge = document.getElementById('symbolChange');
  badge.textContent = (changePts>=0?'+':'') + changePts.toFixed(1) + ' (' + (changePct>=0?'+':'') + changePct.toFixed(2) + '%)';
  badge.classList.toggle('up', changePts>0);
  badge.classList.toggle('down', changePts<0);
  midPriceEl.textContent = state.lastPrice.toFixed(1);
  // luôn màu xanh theo yêu cầu
  midPriceEl.style.color = 'var(--green)';
}

function randomFloat(base, variance) { return base + (Math.random() - 0.5) * variance; }

function tick() {
  // Mô phỏng biến động nhanh & rộng hơn
  // delta ngẫu nhiên trong [-volatilityRange, +volatilityRange]
  let delta = (Math.random()*2 - 1) * state.volatilityRange; // điểm
  // Thêm xác suất nhỏ cho cú "nhảy" mạnh hơn
  if (Math.random() < 0.08) {
    delta *= 1.5; // spike
  }
  // Lượng hóa về bội số 0.1
  delta = Math.round(delta * 10)/10;
  if (delta === 0) delta = 0.1 * (Math.random()>0.5?1:-1);
  state.lastPrice = +(state.lastPrice + delta).toFixed(1);
  state.high = Math.max(state.high, state.lastPrice);
  state.low = Math.min(state.low, state.lastPrice);
  state.price = state.lastPrice;
  midPriceEl.classList.add('flash');
  setTimeout(() => midPriceEl.classList.remove('flash'), 400);
  priceInput.value = state.price.toFixed(1);
  updateTicker();
  renderBook();
  updateCalc();
  updateChart();
  // Burst update ngẫu nhiên để cảm giác nhanh hơn
  if (Math.random()<0.15) {
    requestAnimationFrame(()=>{ tick(); });
  }
}

// Order Book
function renderBook() {
  const levels = 10; // nhiều mức hơn để giảm khoảng trắng
  askList.replaceChildren();
  bidList.replaceChildren();
  const mid = state.lastPrice;
  // midPrice được cập nhật trong updateTicker()
  const sizes = [];
  let totalAsk = 0, totalBid = 0;
  for (let i=levels; i>0; i--) {
    const price = (mid + i * 0.1).toFixed(1);
    const size = Math.floor(Math.random()*150)+10; // 10 - 160
    sizes.push(size);
    totalAsk += size;
    const li = levelTmpl.content.firstElementChild.cloneNode(true);
    li.querySelector('.price').textContent = price;
    li.querySelector('.size').textContent = formatNumber(size);
    askList.appendChild(li);
  }
  for (let i=1; i<=levels; i++) {
    const price = (mid - i * 0.1).toFixed(1);
    const size = Math.floor(Math.random()*150)+10;
    sizes.push(size);
    totalBid += size;
    const li = levelTmpl.content.firstElementChild.cloneNode(true);
    li.querySelector('.price').textContent = price;
    li.querySelector('.size').textContent = formatNumber(size);
    bidList.appendChild(li);
  }
  // scale bars
  const maxSize = Math.max(...sizes);
  [...askList.children, ...bidList.children].forEach((li,i)=>{
    const size = parseInt(li.querySelector('.size').textContent.replace(/,/g,''),10);
    const pct = (size / maxSize)*100;
    li.querySelector('.bar').style.width = pct + '%';
  });
  applyLongShort(totalBid, totalAsk);
}

// Long / Short sentiment dựa theo tổng khối lượng bid / ask hiện tại
function applyLongShort(totalBid, totalAsk){
  if(!longSeg||!shortSeg) return;
  const sum = totalBid + totalAsk;
  if (sum === 0) return;
  const rawLong = totalBid / sum * 100; // giả định bid thể hiện nhu cầu Long
  // làm mượt (EMA đơn giản)
  state.longRatio = state.longRatio * 0.6 + rawLong * 0.4;
  const longRatio = Math.max(1, Math.min(99, state.longRatio));
  const shortRatio = 100 - longRatio;
  // đặt flex basis để không chồng lớp gradient trắng
  longSeg.style.width = longRatio + '%';
  shortSeg.style.width = shortRatio + '%';
  if (lsBar) lsBar.style.setProperty('--longRatio', longRatio.toFixed(2));
  longPctEl.textContent = 'Long ' + longRatio.toFixed(0) + '%';
  shortPctEl.textContent = shortRatio.toFixed(0) + '% Short';
}

function setupEvents() {
  document.getElementById('buyToggle').addEventListener('click', () => setSide('buy'));
  document.getElementById('sellToggle').addEventListener('click', () => setSide('sell'));
  // no leverage selector
  orderTypeSel.addEventListener('change', handleOrderTypeChange);
  // timeframe buttons (Line, 1m, 5m, ...)
  document.querySelectorAll('.timeframes .tf').forEach(btn => {
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.timeframes .tf').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      setTimeframe(btn.textContent.trim());
    });
  });
  priceGroup.addEventListener('click', handleStepper);
  qtyInput.addEventListener('input', handleQtyChange);
  document.getElementById('quantity').addEventListener('blur', normalizeQty);
  document.getElementById('price').addEventListener('blur', normalizePrice);
  document.querySelectorAll('.pct').forEach(btn=>btn.addEventListener('click', handlePercentClick));
  qtySlider.addEventListener('input', sliderChanged);
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
  document.querySelectorAll('.number-input').forEach(group=>group.addEventListener('click', handleStepper));
}

function setSide(side) {
  state.side = side;
  document.getElementById('buyToggle').classList.toggle('active', side==='buy');
  document.getElementById('sellToggle').classList.toggle('active', side==='sell');
  submitBtn.textContent = side==='buy' ? 'Mua/Long' : 'Bán/Short';
  submitBtn.classList.toggle('sell', side==='sell');
}

function handleOrderTypeChange() {
  const isMarket = orderTypeSel.value === 'market';
  priceGroup.style.display = isMarket ? 'none':'flex';
}

function handleStepper(e) {
  const btn = e.target.closest('.step-btn');
  if (!btn) return; 
  const step = parseFloat(btn.dataset.step);
  const input = btn.parentElement.querySelector('input');
  const val = (parseFloat(input.value||'0') + step);
  const fixed = Math.max(0, val);
  input.value = (Math.abs(step) < 1 ? fixed.toFixed(1) : fixed.toFixed(0));
  if (input===qtyInput) handleQtyChange();
  if (input===priceInput) updateCalc();
}

function handleQtyChange() {
  const q = parseFloat(qtyInput.value||'0');
  state.quantity = Math.max(0, parseFloat(q.toFixed(1))); // chuẩn hóa 1 chữ số thập phân
  const usedNotional = state.quantity * state.price * state.contractMultiplier;
  const estMargin = usedNotional * state.initialMarginRatio;
  const pct = Math.min(100, estMargin / state.balance * 100);
  qtySlider.value = isFinite(pct) ? pct : 0;
  updateCalc();
}

function normalizeQty() { qtyInput.value = (parseFloat(qtyInput.value)||0).toFixed(1); }
function normalizePrice() { priceInput.value = (parseFloat(priceInput.value)||0).toFixed(1); }

function handlePercentClick(e) {
  const pct = parseInt(e.currentTarget.dataset.pct,10);
  const targetMargin = state.balance * pct/100;
  let qty = targetMargin / (state.price * state.contractMultiplier * state.initialMarginRatio);
  qty = Math.max(0.1, Math.floor(qty*10)/10); // làm tròn xuống 0.1
  state.quantity = qty;
  qtyInput.value = qty.toFixed(1);
  qtySlider.value = pct;
  updateCalc();
}

function sliderChanged() {
  const pct = parseInt(qtySlider.value,10);
  const targetMargin = state.balance * pct/100;
  let qty = targetMargin / (state.price * state.contractMultiplier * state.initialMarginRatio);
  qty = Math.max(0.1, Math.floor(qty*10)/10);
  state.quantity = qty;
  qtyInput.value = qty.toFixed(1);
  updateCalc();
}

function updateCalc() {
  const price = parseFloat(priceInput.value)||state.price;
  const qty = parseFloat(qtyInput.value)||0;
  const notional = price * qty * state.contractMultiplier; // VND
  const initMargin = notional * state.initialMarginRatio;
  if (estMarginEl) estMarginEl.textContent = qty>0 ? formatNumber(initMargin) + ' VNĐ' : '-- VNĐ';
  if (qty>0) {
    // Liquidation giá giản lược: giả định mất 90% margin -> khoảng cách điểm = (initMargin*0.9)/(qty*contractMultiplier)
    const move = (initMargin*0.9)/(qty*state.contractMultiplier);
    const liq = state.side==='buy' ? price - move : price + move;
    liqPriceEl.textContent = liq.toFixed(1)+' điểm';
  } else liqPriceEl.textContent='--';
}

function submitOrder(e) {
  e.preventDefault();
  const qty = parseFloat(qtyInput.value)||0;
  if (qty<=0) { alert('Nhập khối lượng hợp lệ'); return; }
  const price = orderTypeSel.value==='market' ? state.lastPrice : parseFloat(priceInput.value)||0;
  const notional = price * qty * state.contractMultiplier;
  const margin = notional * state.initialMarginRatio;
  alert(`${state.side==='buy'?'Mua Long':'Bán Short'} ${qty.toFixed(1)} HĐ ${state.symbol} @ ${price.toFixed(1)}\nGiá trị: ${formatNumber(notional)} VNĐ\nKý quỹ: ${formatNumber(margin)} VNĐ`);
}

// Mini sparkline chart
let chartData = [];
function initChart() {
  chartCanvas = document.getElementById('miniChart');
  chartCtx = chartCanvas.getContext('2d');
  for (let i=0;i<40;i++) chartData.push(state.lastPrice + Math.sin(i/4)*5 + (Math.random()-0.5)*4);
  resizeChart();
  window.addEventListener('resize', debounce(resizeChart,150));
}
function resizeChart(){
  if (!chartCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = chartCanvas.getBoundingClientRect();
  chartCanvas.width = rect.width * dpr;
  chartCanvas.height = rect.height * dpr;
  chartCtx.scale(dpr,dpr);
  drawChart();
}
function updateChart() { chartData.push(state.lastPrice); if (chartData.length>80) chartData.shift(); drawChart(); }
function drawChart() {
  const ctx = chartCtx; if (!ctx) return; const fullW=chartCanvas.clientWidth, fullH=chartCanvas.clientHeight; // clear full pixel canvas
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,chartCanvas.width, chartCanvas.height); ctx.restore();
  if (!chartData.length) return;
  // Determine min/max & padding
  let min = Math.min(...chartData), max=Math.max(...chartData);
  if (min===max) { min -= 1; max += 1; }
  // Expand a little so line not touching top/bottom
  const rangePad = (max - min) * 0.05;
  min -= rangePad; max += rangePad;
  // Move Y-axis scale to the right side (reserve space on the right instead of left)
  const leftPad = 4; const rightPad = 44; const topPad=4; const bottomPad=4;
  const plotW = fullW - leftPad - rightPad; const plotH = fullH - topPad - bottomPad;

  // Grid & Y axis labels
  const ticks = 5;
  // Draw grid lines first, labels later (after line + fill) to avoid green tint overlay
  const tickValues = [];
  ctx.save();
  ctx.setLineDash([2,3]); // dotted effect
  ctx.lineWidth = 1;
  ctx.strokeStyle='rgba(0,0,0,0.04)'; // ultra light
  for (let i=0;i<ticks;i++) {
    const tVal = min + (i/(ticks-1))*(max-min);
    tickValues.push(tVal);
    const y = topPad + plotH - (tVal - min)/(max-min)*plotH;
    ctx.beginPath(); ctx.moveTo(leftPad,y); ctx.lineTo(fullW-rightPad,y); ctx.stroke();
  }
  ctx.restore(); // reset dash for price line
  // Price line
  ctx.lineWidth=1.6; ctx.strokeStyle='rgba(22,163,74,0.75)'; ctx.beginPath();
  chartData.forEach((p,i)=>{ const x = leftPad + i/(chartData.length-1)*plotW; const y = topPad + plotH - (p-min)/(max-min)*plotH; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.stroke();
  // Fill
  const grd = ctx.createLinearGradient(0,topPad,0,fullH-bottomPad); grd.addColorStop(0,'rgba(22,163,74,0.18)'); grd.addColorStop(1,'rgba(22,163,74,0)');
  ctx.lineTo(leftPad+plotW, fullH-bottomPad); ctx.lineTo(leftPad, fullH-bottomPad); ctx.closePath(); ctx.fillStyle=grd; ctx.fill();

  // Draw Y-axis labels last so they stay neutral (not tinted by gradient)
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign='left';
  ctx.textBaseline='middle';
  // Resolve CSS custom property to a real color because canvas doesn't parse var()
  const axisColor = getComputedStyle(document.body).getPropertyValue('--text-extra').trim() || '#9aa4b1';
  ctx.fillStyle = axisColor;
  tickValues.forEach(tVal=>{
    const y = topPad + plotH - (tVal - min)/(max-min)*plotH;
    ctx.fillText(tVal.toFixed(1), fullW - rightPad + 4, y);
  });
}

// Utility: debounce
function debounce(fn,delay){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),delay); }; }

document.addEventListener('DOMContentLoaded', init);

// Theme toggle
document.addEventListener('click', (e)=>{
  if (e.target.id==='themeToggle') {
    document.body.classList.toggle('theme-dark');
    e.target.textContent = document.body.classList.contains('theme-dark') ? '☀️' : '🌙';
  }
});

// Formatting helper
function formatNumber(n){
  return n.toLocaleString('en-US');
}

// Timeframe switching (demo only — regenerate synthetic series)
function setTimeframe(tf){
  // For 'Line' we keep existing; for others adjust point count
  const map = { 'Line': 60, '1m': 120, '5m': 80, '15m': 60, '30m':50, '60m':40, '2h':30, '4h':25, '8h':20 };
  const points = map[tf] || 60;
  chartData = [];
  for (let i=0;i<points;i++) chartData.push(state.lastPrice + Math.sin(i/6)*6 + (Math.random()-0.5)*5);
  drawChart();
}
