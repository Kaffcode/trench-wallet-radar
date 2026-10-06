const fs=require('node:fs'), vm=require('node:vm'), assert=require('node:assert/strict');
const attrs=new Map(), loading={hidden:true}, checkbox={};
const buttons=['0xTokenA','0xTokenB'].map(token=>({dataset:{token,chain:'bsc'}}));
const card={dataset:{address:'0xWallet'},getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),querySelector:s=>s==='.cand-check'?checkbox:loading,querySelectorAll:()=>buttons};
const nodes=new Map();
const node=s=>{if(!nodes.has(s))nodes.set(s,{value:s==='#scan-chain'?'bsc':'1000',innerHTML:'',textContent:''});return nodes.get(s);};
const ctx=vm.createContext({document:{querySelector:node,querySelectorAll:s=>s==='.candidate'?[card]:[]},console,AbortController,TextDecoder,Intl});
vm.runInContext(fs.readFileSync('web/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext(fs.readFileSync('web/candidates.js','utf8'),ctx);
vm.runInContext(`const actualProfile=profileSelectedSafe; let calls=[],opened=[]; let release;
profileSelectedSafe=async ids=>{calls.push(ids);await new Promise(r=>release=r)};
openToken=(token,chain)=>opened.push([token,chain]); bindCandidateActions();`,ctx);
const body={target:{closest:()=>null}};
(async()=>{
 card.onclick(body); card.onclick(body);
 assert.equal(vm.runInContext('calls.length',ctx),1); assert.equal(loading.hidden,false);
 vm.runInContext('release()',ctx); await new Promise(r=>setImmediate(r)); assert.equal(loading.hidden,true);
 let stopped=0;checkbox.onclick({stopPropagation:()=>stopped++});
 card.onclick({target:{closest:()=>checkbox}});
 buttons.forEach(b=>b.onclick({stopPropagation:()=>stopped++}));
 assert.equal(stopped,3);assert.equal(vm.runInContext('calls.length',ctx),1);
 assert.equal(vm.runInContext('JSON.stringify(opened)',ctx),'[["0xTokenA","bsc"],["0xTokenB","bsc"]]');
 for(const key of ['Enter',' ']){
   let prevented=false;card.onkeydown({target:card,key,preventDefault:()=>prevented=true});
   assert.ok(prevented);vm.runInContext('release()',ctx);await new Promise(r=>setImmediate(r));
 }
 card.onkeydown({target:checkbox,key:' ',preventDefault:()=>assert.fail('child key intercepted')});
 assert.equal(vm.runInContext('calls.length',ctx),3);
 // Exercise the actual shared error handler, including retry target and busy cleanup.
 vm.runInContext(`profileSelectedSafe=actualProfile; state.config={defaults:{wallets_profiled:20}};
 tab=()=>{};renderWallets=()=>{};fetch=async()=>({ok:false,status:503});`,ctx);
 await vm.runInContext('profileCandidate',ctx)(card);
 assert.ok(node('#wallets-table-body').innerHTML.includes('Profiling failed (503)'));
 assert.equal(attrs.has('aria-busy'),false);assert.equal(loading.hidden,true);
 assert.equal(vm.runInContext('state.profileAbort',ctx),null);
 ctx.fetch=async()=>({ok:true,body:{getReader:()=>({read:async()=>({done:false,value:new TextEncoder().encode('event: wallet\ndata: {"error":"upstream"}\n\n')})})}});
 await vm.runInContext('profileCandidate',ctx)(card);
 assert.ok(node('#wallets-table-body').innerHTML.includes('Wallet profiling failed'));
 assert.equal(loading.hidden,true);
 console.log('Candidate interaction checks passed: body, isolated checkbox/tokens, both keyboard keys, duplicate guard, API error cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
