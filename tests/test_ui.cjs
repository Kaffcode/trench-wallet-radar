// Offline rendering test. These fixtures never enter the running app or API.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
const element = selector => {
  if (!elements.has(selector)) elements.set(selector, {value: '', checked: false, innerHTML: '', textContent: ''});
  return elements.get(selector);
};
element('#wallet-filter-label').value = 'all';
element('#research-budget').value = '1000';
const context = vm.createContext({document: {querySelector: element, querySelectorAll: () => []}, Intl, console});
const source = fs.readFileSync('web/app.js', 'utf8').replace(/boot\(\);\s*$/, '');
vm.runInContext(fs.readFileSync('web/rotation.js', 'utf8'), context);
vm.runInContext(source, context);
vm.runInContext(`
state.scan={tokens:[{}, {}, {}, {}, {}]};
state.wallets=Array.from({length:7},(_,i)=>({
  address:'fixture-wallet-'+i, chain:'bsc', label:'flipper', trench_score:80,
  tokens_seen_in:i, sample_size:10, sample_kind:'tokens sold',
  realized_pnl_usd:1234, total_pnl_usd:999999, copyability:20, copyable:false,
  win_rate:0.6, match_metrics:{median_trade_usd:2000}, status:{trades:'ok'}, recent_trades_per_day:4
}));
state.wallets.push({address:'excluded-bot',label:'bot_like',trench_score:100,sample_size:20});
renderWallets();
`, context);
const shortlist = element('#shortlist-body').innerHTML;
assert.equal((shortlist.match(/<tr /g)||[]).length, 5);
assert.ok(shortlist.indexOf('fixture-wallet-6') < shortlist.indexOf('fixture-wallet-5'));
assert.ok(!shortlist.includes('excluded-bot'));
assert.ok(shortlist.includes('1,234') && !shortlist.includes('999,999'));
assert.ok(shortlist.includes('tokens sold') && shortlist.includes('2,000'));
element('#wallet-filter-copyable').checked = true;
vm.runInContext('renderWallets()', context);
assert.ok(element('#shortlist-body').innerHTML.includes('No eligible profiles'));
console.log('Offline UI checks passed: top five, overlap tie-break, exclusions, realized PnL, sample, trade size, copyability filter.');

assert.ok(vm.runInContext("renderRotation({status:{trades:'ok'},rotation:[]})",context).includes("No recent wallet rotation found."));
assert.ok(element("#consensus-body").innerHTML.includes("No tokens shared by 2+ shortlisted wallets"));

assert.equal((shortlist.match(/class="rank-number"/g)||[]).length,5);
assert.ok(shortlist.includes('#1</span>') && shortlist.includes('#5</span>'));
assert.ok(!element('#wallets-table-body').innerHTML.includes('rank-number'));
