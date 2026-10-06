const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx=vm.createContext({URLSearchParams,priceFmt:String,pct:String,short:String});
vm.runInContext(fs.readFileSync('web/token-chart.js','utf8'),ctx);
const Chart=vm.runInContext('TokenCandleChart',ctx);
const c=Object.create(Chart.prototype), pending=[];
Object.assign(c,{context:{chain:'bsc',address:'A',pool_address:'PA',symbol:'A'},revision:0,header:{},title:{},message:{},root:{querySelectorAll:()=>[],setAttribute(){},removeAttribute(){}},chart:{timeScale:()=>({fitContent(){}}),remove(){}},candles:{applyOptions(){},setData(rows){this.rows=rows}},volume:{setData(rows){this.rows=rows}},request:url=>new Promise(resolve=>pending.push({url,resolve}))});
(async()=>{
 const first=c.load('1h');
 const second=c.setContext({chain:'bsc',address:'B',pool_address:'PB',symbol:'B'});
 assert.equal(c.candles.rows.length,0);assert.ok(pending[1].url.includes('token=B'));
 pending[1].resolve({candles:[{time:2,open:2,high:3,low:1,close:3,volume:4}]});await second;
 pending[0].resolve({candles:[{time:1,open:99,high:99,low:99,close:99}]});await first;
 assert.equal(c.candles.rows[0].close,3);assert.equal(c.volume.rows[0].time,2);
 const third=c.load('5m');assert.equal(c.volume.rows.length,0);pending[2].resolve({candles:[],message:'No data'});await third;
 assert.equal(c.message.textContent,'No data');assert.equal(c.candles.rows.length,0);
 console.log('Chart checks passed: token switching, stale response rejection, aligned volume, timeframe clearing, empty data.');
})().catch(e=>{console.error(e);process.exitCode=1});
