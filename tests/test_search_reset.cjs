const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();const el=s=>{if(!elements.has(s))elements.set(s,{value:'',innerHTML:'',querySelectorAll:()=>[]});return elements.get(s);};
let reloads=0;const ctx=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[]},window:{location:{reload:()=>reloads++}},Intl,console});
vm.runInContext(fs.readFileSync('web/app.js','utf8').replace(/boot\(\);\s*$/,''),ctx);
vm.runInContext('bindActions();state.scan={tokens:[1,2]};state.wallets=[{address:"kept"}];state.selected.add("kept");state.tokenQueue.set("search-target",{});',ctx);
let resolve;ctx.api=()=>new Promise(r=>resolve=r);
(async()=>{
 el('#radar-search').value='AKE';const pending=vm.runInContext('searchRadar()',ctx);
 el('#radar-search').value='';el('#radar-search').oninput();
 assert.equal(el('#radar-search-results').innerHTML,'');assert.equal(el('#token-queue').innerHTML,'');
 resolve({pools:[]});await pending;assert.equal(el('#radar-search-results').innerHTML,'');
 el('#radar-search').value='   ';await vm.runInContext('searchRadar()',ctx);assert.equal(el('#radar-search-results').innerHTML,'');
 assert.equal(vm.runInContext('state.tokenQueue.size',ctx),0);assert.equal(vm.runInContext('state.scan.tokens.length',ctx),2);assert.equal(vm.runInContext('state.wallets.length',ctx),1);assert.equal(vm.runInContext('state.selected.size',ctx),1);
 el('#brand-reload').onclick();assert.equal(reloads,1);
 console.log('Specific search reset passed: immediate clear, whitespace, stale response isolation, preserved market/wallet state, real reload handler.');
})().catch(e=>{console.error(e);process.exitCode=1;});
