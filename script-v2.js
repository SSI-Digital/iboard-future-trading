// Minimal logic for V2 light interface
// fullscreen lightweight line chart simulation
(function(){
  const chartCanvas = document.getElementById('v2Chart');
  const floating = document.getElementById('v2Floating');
  if(!chartCanvas) return;
  let lastPrice = 1805.0;
  let dpr = window.devicePixelRatio || 1;
  const data = [];
  const MAX_POINTS = 400;
  // auto price toggle state (declare early so drawChart can read it)
  let autoPriceActive = true;

  function resizeChart(){
    const rect = chartCanvas.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    drawChart();
  }

  function pushPrice(p){
    data.push({t:Date.now(), p});
    if(data.length>MAX_POINTS) data.shift();
  }

  function simulate(){
    const vol = 0.7;
    const rnd = (Math.random()-0.5)*vol;
    lastPrice = +(lastPrice + rnd).toFixed(2);
    pushPrice(lastPrice);
    drawChart();
  }

  function drawChart(){
    const ctx = chartCanvas.getContext('2d');
    const w = chartCanvas.width;
    const h = chartCanvas.height;
    ctx.clearRect(0,0,w,h);
  if(data.length<2) return;
  const lineColor = (getComputedStyle(document.documentElement).getPropertyValue('--chart-accent')||'#6F6ADE').trim();
    const prices = data.map(d=>d.p);
    const dataMin = Math.min(...prices);
    const dataMax = Math.max(...prices);
    const last = data[data.length-1];
    const range = (dataMax - dataMin);
    // Fixed vertical band (fractions of total height)
  const BAND_TOP = 0.15;      // 15% from top
  const BAND_BOTTOM = 0.85;   // 85% from top
    const bandTopPx = BAND_TOP * h;
    const bandBottomPx = BAND_BOTTOM * h;
    const bandHeightPx = bandBottomPx - bandTopPx; // positive
    // Mapping function: max price -> bandTopPx, min price -> bandBottomPx
    function mapY(p){
      if(range === 0) return bandTopPx + bandHeightPx/2;
      const norm = (p - dataMin)/range; // 0 at min, 1 at max
      return bandBottomPx - norm * bandHeightPx;
    }
    // horizontal: reserve 5% right margin
    const rightMarginRatio = 0.05;
    const drawW = w * (1 - rightMarginRatio);
  // grid removed
    ctx.lineWidth = 2*dpr;
  // line color same as symbol text ("Phái sinh")
  ctx.strokeStyle = lineColor;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    data.forEach((d,i)=>{
      const x = (i/(data.length-1))*drawW;
    const y = mapY(d.p);
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // last point at 95% width
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
  floating.textContent = formatted;
    // update stats boxes
    const priceEl = document.getElementById('pricePoint');
  if(priceEl && autoPriceActive){ priceEl.textContent = formatted; }
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
})();
