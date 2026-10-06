class TokenCandleChart {
  constructor(root, context, request = api, library = window.LightweightCharts) {
    this.root=root; this.request=request; this.context=context; this.revision=0; this.disposed=false;
    this.header=root.querySelector('.ohlcv-header'); this.message=root.querySelector('.ohlcv-message');
    this.title=root.querySelector('.ohlcv-title');
    this.chart=library.createChart(root.querySelector('.ohlcv-canvas'), {
      autoSize:true, layout:{background:{type:'solid',color:'#10151a'},textColor:'#929aa8',attributionLogo:true},
      grid:{vertLines:{color:'#252d38'},horzLines:{color:'#252d38'}},
      rightPriceScale:{borderColor:'#303a47'}, timeScale:{borderColor:'#303a47',timeVisible:true,secondsVisible:false},
      crosshair:{mode:0}, localization:{priceFormatter:priceFmt}
    });
    this.candles=this.chart.addSeries(library.CandlestickSeries,{upColor:'#63c99b',downColor:'#eb8993',borderVisible:false,wickUpColor:'#63c99b',wickDownColor:'#eb8993'});
    this.candles.priceScale().applyOptions({scaleMargins:{top:.08,bottom:.26}});
    this.volume=this.chart.addSeries(library.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'',lastValueVisible:false,priceLineVisible:false});
    this.volume.priceScale().applyOptions({scaleMargins:{top:.8,bottom:0}});
    this.chart.subscribeCrosshairMove(event=>this.showCandle(event.seriesData?.get(this.candles)||this.latest));
    root.querySelectorAll('[data-interval]').forEach(b=>b.onclick=()=>this.load(b.dataset.interval));
    root.querySelector('.ohlcv-retry').onclick=()=>this.load(this.interval||'1h');
    this.load('1h');
  }
  showCandle(c) {
    if(!c){this.header.textContent='O —  H —  L —  C —  Change —';return;}
    const change=c.open ? (c.close/c.open-1)*100 : null;
    this.header.textContent=`O ${priceFmt(c.open)}  H ${priceFmt(c.high)}  L ${priceFmt(c.low)}  C ${priceFmt(c.close)}  Change ${change===null?'—':pct(change)}`;
  }
  setContext(context) { this.context=context; return this.load('1h'); }
  async load(interval) {
    const revision=++this.revision, context=this.context;
    this.interval=interval; this.latest=null;this.candles.setData([]);this.volume.setData([]);this.showCandle(null);
    this.title.textContent=`${context.symbol||short(context.address)}/USD · ${interval}`;
    this.root.querySelectorAll('[data-interval]').forEach(b=>{b.classList.toggle('active',b.dataset.interval===interval);b.setAttribute('aria-pressed',String(b.dataset.interval===interval));});
    this.message.textContent='Loading OHLCV…';this.root.setAttribute('aria-busy','true');
    try {
      if(!context.pool_address){this.message.textContent='No pool is available for this token.';return;}
      const query=new URLSearchParams({chain:context.chain,token:context.address,pool:context.pool_address,interval});
      const data=await this.request(`/api/xray/ohlcv?${query}`);
      if(this.disposed||revision!==this.revision)return;
      const rows=data.candles||[];
      this.message.textContent=data.message||`${rows.length} candles · UTC · ${rows.some(r=>r.volume!=null)?'Volume in USD':'Volume unavailable'} · scroll to zoom, drag to pan`;
      if(rows.length){const smallest=Math.min(...rows.map(r=>r.low));const precision=Math.min(12,Math.max(2,Math.ceil(-Math.log10(smallest))+3));this.candles.applyOptions({priceFormat:{type:'price',precision,minMove:10**(-precision)}});}
      this.candles.setData(rows.map(({time,open,high,low,close})=>({time,open,high,low,close})));
      this.volume.setData(rows.filter(r=>r.volume!=null).map(r=>({time:r.time,value:r.volume,color:r.close>=r.open?'#63c99b66':'#eb899366'})));
      this.latest=rows.at(-1);this.showCandle(this.latest);this.chart.timeScale().fitContent();
    } catch(error) {
      if(!this.disposed&&revision===this.revision)this.message.textContent=`OHLCV couldn't load: ${error.message}`;
    } finally { if(!this.disposed&&revision===this.revision)this.root.removeAttribute('aria-busy'); }
  }
  destroy(){this.disposed=true;++this.revision;this.chart.remove();}
}
let activeTokenChart=null;
function disposeTokenChart(){activeTokenChart?.destroy();activeTokenChart=null;}
function mountTokenChart(context){disposeTokenChart();const root=$('#token-ohlcv');try{activeTokenChart=new TokenCandleChart(root,context);}catch{root.querySelector('.ohlcv-message').textContent='Chart library unavailable. Reload to retry.';}}
function tokenChartMarkup(){return `<section id="token-ohlcv"><div class="chart-toolbar"><b class="ohlcv-title">PRICE / USD</b><div class="chart-intervals">${['1m','5m','15m','1h','4h','1D'].map(i=>`<button type="button" class="ghost" data-interval="${i}" aria-pressed="${i==='1h'}">${i}</button>`).join('')}</div><button type="button" class="ghost ohlcv-retry">Refresh chart</button></div><p class="ohlcv-header">O — H — L — C — Change —</p><p class="notice ohlcv-message" role="status"></p><div class="ohlcv-canvas" aria-label="Interactive USD candlestick and volume chart"></div><p class="notice">OHLCV via CoinGecko API · <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView Lightweight Charts™</a> · Copyright (с) 2025 TradingView, Inc.</p></section>`;}
