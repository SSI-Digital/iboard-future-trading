// Minimal logic for V2 light interface
// fullscreen lightweight line chart simulation
(function(){
  const chartCanvas = document.getElementById('v2Chart');
  const floating = document.getElementById('v2Floating');
  if(!chartCanvas) return;
  let lastPrice = 1805.0;
  // mock entry price for P/L percent (could later be dynamic)
  let entryPrice = lastPrice - 10; // sample entry below current so P/L starts positive
  let dpr = window.devicePixelRatio || 1;
  const data = [];
  const MAX_POINTS = 400;
  // auto price toggle state (declare early so drawChart can read it)
  let autoPriceActive = true;

  function resizeChart(){
    const rect = chartCanvas.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
  positionLongShortBar();
    drawChart();
  }

  function pushPrice(p){
    data.push({t:Date.now(), p});
    if(data.length>MAX_POINTS) data.shift();
  }

  function simulate(){
    const vol = 0.7;
    const rnd = (Math.random()-0.5)*vol;
    const prevPrice = lastPrice;
    lastPrice = +(lastPrice + rnd).toFixed(2);
    pushPrice(lastPrice);
  // randomly drift long/short ratio (mock)
  updateLongShort();
    drawChart();
    // trigger floating price flash based on direction
    const floatingEl = document.getElementById('v2Floating');
    if(floatingEl && lastPrice !== prevPrice){
      floatingEl.classList.remove('flash-up','flash-down');
      // force reflow to restart animation
      void floatingEl.offsetWidth;
      if(lastPrice > prevPrice) floatingEl.classList.add('flash-up');
      else if(lastPrice < prevPrice) floatingEl.classList.add('flash-down');
    }
  }

  function drawChart(){
    const ctx = chartCanvas.getContext('2d');
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    ctx.clearRect(0,0,w,h);
  if(data.length<2) return;
  const lineColor = (getComputedStyle(document.documentElement).getPropertyValue('--chart-accent')||'#6F6ADE').trim();
    const prices = data.map(d=>d.p);
  // Sliding window logic: keep constant horizontal spacing; only render points that fit current width
  const rightMarginRatio = 0.05; // revert to 5% right margin
  const drawW = w * (1 - rightMarginRatio);
  const POINT_SPACING = 6 * dpr; // px between points
  const maxVisible = Math.max(2, Math.floor(drawW / POINT_SPACING) + 2);
  const visibleStartIndex = Math.max(0, data.length - maxVisible);
  const visible = data.slice(visibleStartIndex);
  const last = visible[visible.length - 1];
  const pricesVisible = visible.map(d=>d.p);
  let rawMin = Math.min(...pricesVisible);
  let rawMax = Math.max(...pricesVisible);
    // Base chart vertical margins for extremes
    const TOP_MARGIN = 0.10;   // 10% from top for highest
    const BOTTOM_MARGIN = 0.10; // 10% from bottom for lowest
    const spanFrac = 1 - TOP_MARGIN - BOTTOM_MARGIN; // usable drawing span (0.80)
    // Desired zone for current (last) price (fractions from top)
    const CURR_ZONE_TOP = 0.22;   // must not go above (closer than) 22% from top
  // Adjusted lower zone so last price can drift further down (was 0.60)
  const CURR_ZONE_BOTTOM = 0.75; // must not go below ~75% from top (~2% from bottom)
    // Start with raw min/max
    let minAdj = rawMin;
    let maxAdj = rawMax;
    let rangeAdj = maxAdj - minAdj || 1; // avoid zero
    // Helper to compute y fraction (0 at top, 1 at bottom) for a price with current min/max mapping
    function yFrac(p){
      const alpha = (p - minAdj)/rangeAdj; // 0..1
      // y from top = TOP_MARGIN + span*(1-alpha)
      return TOP_MARGIN + spanFrac * (1 - alpha);
    }
    // Adjust top (extend max) if last price too high (y above zone: smaller fraction)
    let lastYFrac = yFrac(last.p);
    if(lastYFrac < CURR_ZONE_TOP){
      // solve for new maxAdj keeping minAdj: alphaTarget = (TOP + span - yTarget)/span
      const alphaTarget = (TOP_MARGIN + spanFrac - CURR_ZONE_TOP)/spanFrac; // desired alpha of last price
      // alphaTarget = (last - minAdj)/(maxAdj' - minAdj) => maxAdj' = minAdj + (last - minAdj)/alphaTarget
      maxAdj = minAdj + (last.p - minAdj)/alphaTarget;
      rangeAdj = maxAdj - minAdj;
    } else if(lastYFrac > CURR_ZONE_BOTTOM){
      // last too low (near bottom) -> extend min downward keeping max
      const alphaTarget = (TOP_MARGIN + spanFrac - CURR_ZONE_BOTTOM)/spanFrac;
      // alphaTarget = (last - minAdj')/(maxAdj - minAdj') => minAdj' = (last - alphaTarget*maxAdj)/(1 - alphaTarget)
      minAdj = (last.p - alphaTarget*maxAdj)/(1 - alphaTarget);
      rangeAdj = maxAdj - minAdj;
    }
    // Mapping function after adjustments
    function mapY(p){
      if(rangeAdj === 0) return (TOP_MARGIN + spanFrac/2)*h;
      const alpha = (p - minAdj)/rangeAdj; // 0 at min, 1 at max
      const fracFromTop = TOP_MARGIN + spanFrac * (1 - alpha);
      return fracFromTop * h;
    }
  // grid removed
    ctx.lineWidth = 2*dpr;
  // line color same as symbol text ("Phái sinh")
  ctx.strokeStyle = lineColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Draw only visible window with constant spacing from right to left
    for(let i=0;i<visible.length;i++){
      const d = visible[visible.length - 1 - i]; // reverse iterate from last backwards
      const x = drawW - i * POINT_SPACING;
      if(x < 0) break; // safety
      const y = mapY(d.p);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
    // last point at 95% width (right edge of drawing area)
    const lx = drawW; const ly = mapY(last.p);
  ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(lx,ly,4*dpr,0,Math.PI*2);
    ctx.fill();
    // horizontal dotted line at current price
    ctx.save();
    ctx.setLineDash([4*dpr,4*dpr]);
    ctx.strokeStyle = '#d2d7dc'; // light gray
    ctx.lineWidth = 1*dpr;
    ctx.beginPath();
    ctx.moveTo(0,ly);
    ctx.lineTo(w,ly);
    ctx.stroke();
    ctx.restore();
  const formatted = last.p.toFixed(1);
  const valueSpan = floating.querySelector('.fp-value');
  if(valueSpan) valueSpan.textContent = formatted;
  floating.setAttribute('aria-label','Giá hiện tại ' + formatted);
    // update stats boxes
    const priceEl = document.getElementById('pricePoint');
  if(priceEl && autoPriceActive){ priceEl.textContent = formatted; }
    // instrument change mock (previous close = first visible price for simplicity)
    const instChangeEl = document.getElementById('instrumentChange');
    if(instChangeEl){
      const prev = prices[0];
      const abs = +(last.p - prev).toFixed(1);
      const pct = prev !== 0 ? ((last.p - prev)/prev*100) : 0;
      const sign = abs>0?'+':(abs<0?'-':'');
      instChangeEl.textContent = `${sign}${Math.abs(abs).toFixed(1)} (${sign}${Math.abs(pct).toFixed(2)}%)`;
      instChangeEl.classList.toggle('positive', abs>0);
      instChangeEl.classList.toggle('negative', abs<0);
    }
    // Update High/Low/Volume (mock volume increments per tick)
    const highEl = document.getElementById('instHigh');
    const lowEl = document.getElementById('instLow');
    const volEl = document.getElementById('instVol');
    if(highEl) highEl.textContent = Math.max(...prices).toFixed(1);
    if(lowEl) lowEl.textContent = Math.min(...prices).toFixed(1);
    if(volEl){
      // simple mock: volume = number of points * random tiny factor seeded once
      if(!window.__mockVolSeed){ window.__mockVolSeed = 7 + Math.random()*5; }
      const vol = Math.round(prices.length * window.__mockVolSeed);
      volEl.textContent = vol.toLocaleString('vi-VN');
    }
    // Update profit percent mock (based on entryPrice)
    const profitEl = document.getElementById('profitPercent');
    if(profitEl){
      const pct = ((lastPrice - entryPrice)/entryPrice)*100;
      const sign = pct>0?'+':(pct<0?'-':'');
      profitEl.textContent = `${sign}${Math.abs(pct).toFixed(2)}%`;
      profitEl.classList.toggle('positive', pct>0);
      profitEl.classList.toggle('negative', pct<0);
    }
    // move floating label vertically to follow price line (keep left side)
    // convert canvas Y (device pixels) to CSS px
  const cssY = ly / dpr;
    if(floating){
      const fh = floating.offsetHeight || 16;
      floating.style.top = (cssY - fh/2) + 'px';
    }
  }

  window.addEventListener('resize', resizeChart);

  // init sample data (random walk with mild drift & occasional burst) for realism
  (function seed(){
    const seedPoints = 200; // more history
    let drift = 0.015; // upward mild drift
    for(let i=0;i<seedPoints;i++){
      // occasional volatility spike
      const spike = (Math.random()<0.04) ? (Math.random()-0.5)*2.4 : 0;
      const baseVol = 0.35 + Math.random()*0.25; // varied volatility
      const step = (Math.random()-0.5)*baseVol + drift + spike;
      lastPrice = +(lastPrice + step).toFixed(2);
      // small drift mean reversion to keep bounded
      if(i%40===0) drift = (Math.random()-0.5)*0.03;
      pushPrice(lastPrice);
    }
  })();
  // quick action buttons (placeholder handlers)
  const btnBuy = document.getElementById('quickBuy');
  const btnSell = document.getElementById('quickSell');
  if(btnBuy){ btnBuy.addEventListener('click',()=>{ console.log('Quick BUY'); btnBuy.classList.add('flash'); setTimeout(()=>btnBuy.classList.remove('flash'),400); }); }
  if(btnSell){ btnSell.addEventListener('click',()=>{ console.log('Quick SELL'); btnSell.classList.add('flash'); setTimeout(()=>btnSell.classList.remove('flash'),400); }); }

  // Price auto / manual control
  const autoToggle = document.getElementById('autoPriceToggle');
  const pricePointEl = document.getElementById('pricePoint');
  const decBtn = document.getElementById('priceDec');
  const incBtn = document.getElementById('priceInc');
  // volume controls (currently disabled / static per spec, but hook prepared)
  const volDecBtn = document.getElementById('volDec');
  const volIncBtn = document.getElementById('volInc');
  const volValueEl = document.getElementById('volumeContracts');
  function adjustVolume(delta){
    if(!volValueEl) return;
    let v = parseFloat(volValueEl.textContent.replace(/[^0-9.\-]/g,''));
    if(isNaN(v)) v = 0.1;
    v = +(v + delta).toFixed(1);
    if(v < 0.1) v = 0.1;
    volValueEl.textContent = v.toFixed(1);
  }
  if(volDecBtn){ volDecBtn.addEventListener('click',()=>adjustVolume(-0.1)); }
  if(volIncBtn){ volIncBtn.addEventListener('click',()=>adjustVolume(0.1)); }
  function setAuto(active){
    autoPriceActive = active;
    if(autoToggle){
      autoToggle.classList.toggle('active',active);
      autoToggle.setAttribute('aria-pressed',active?'true':'false');
      autoToggle.textContent = 'Giá thị trường';
    }
    if(active && pricePointEl){ pricePointEl.textContent = lastPrice.toFixed(1); }
  }
  function adjustPrice(delta){
    if(autoPriceActive) setAuto(false); // switch to manual (limit)
    let val = parseFloat(pricePointEl.textContent.replace(/[^0-9.\-]/g,''));
    if(isNaN(val)) val = lastPrice;
    val = Math.max(0, +(val + delta).toFixed(1));
    pricePointEl.textContent = val.toFixed(1);
  }
  if(autoToggle){ autoToggle.addEventListener('click',()=> setAuto(!autoPriceActive)); }
  if(decBtn){ decBtn.addEventListener('click',()=>adjustPrice(-0.1)); }
  if(incBtn){ incBtn.addEventListener('click',()=>adjustPrice(0.1)); }
  // initialize displayed price
  if(pricePointEl) pricePointEl.textContent = lastPrice.toFixed(1);
  setAuto(true);

  resizeChart();
  drawChart();
  setInterval(simulate, 1000);
  // --- Long / Short vertical ratio mock logic ---
  let longRatio = 0.43; // initial 43%
  function updateLongShort(){
    // small random walk
    longRatio += (Math.random()-0.5)*0.04; // +/-2%
    if(longRatio < 0.05) longRatio = 0.05;
    if(longRatio > 0.95) longRatio = 0.95;
    const shortRatio = 1 - longRatio;
    const longEl = document.getElementById('lsLong');
    const shortEl = document.getElementById('lsShort');
    const sep = document.querySelector('.long-short-vertical .ls-vert-separator');
    if(longEl && shortEl){
      // use percentage heights (container is positioned absolutely)
      longEl.style.height = (longRatio*100).toFixed(2)+'%';
      shortEl.style.height = (shortRatio*100).toFixed(2)+'%';
      longEl.querySelector('.label').textContent = 'Long ' + Math.round(longRatio*100) + '%';
      shortEl.querySelector('.label').textContent = Math.round(shortRatio*100) + '% Short';
      if(sep){
        sep.style.top = (shortRatio*100).toFixed(2)+'%'; // separator sits between short (top) and long (bottom)
      }
    }
  }
  updateLongShort();
  function positionLongShortBar(){
    const bar = document.querySelector('.long-short-vertical');
    const overlayCenter = document.querySelector('.chart-overlay .overlay-center');
    const statsBar = document.querySelector('.trade-stats-bar');
    if(!bar || !overlayCenter || !statsBar) return;
    const parentRect = chartCanvas.parentElement.getBoundingClientRect();
    const centerRect = overlayCenter.getBoundingClientRect();
    const statsRect = statsBar.getBoundingClientRect();
    // compute relative positions (tighter gaps)
    let top = centerRect.bottom - parentRect.top + 2; // reduced gap
    const bottomLimit = statsRect.top - parentRect.top - 2; // reduced gap
  // original full available height between center box and stats bar
  const fullHeight = bottomLimit - top;
  // target scale (reduce to ~80% of previous height)
  const scale = 0.8;
  let height = fullHeight * scale;
  // center the shorter bar within the original gap
  top += (fullHeight - height)/2;
  const minHeight = 36; // slightly smaller
    if(height < minHeight){
      // if space too small, anchor above stats bar and extend upward
      height = minHeight;
      top = bottomLimit - height; // may overlap; acceptable in extreme small layouts
    }
    bar.style.top = top + 'px';
    bar.style.height = height + 'px';
  }
  // initial positioning after layout
  window.addEventListener('load',()=>{ setTimeout(positionLongShortBar,50); });
  window.addEventListener('resize',()=>{ setTimeout(positionLongShortBar,30); });
})();
