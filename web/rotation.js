/* Pure aggregation: receives only the displayed shortlist, never all candidates. */
function walletConsensus(wallets) {
  const tokens = new Map();
  const identity = a => a.startsWith('0x') ? a.toLowerCase() : a;
  for (const wallet of wallets) {
    for (const row of wallet.rotation || []) {
      const key = `${row.network}:${identity(row.address)}`;
      if (!tokens.has(key)) tokens.set(key, {...row, wallets:new Map()});
      const token = tokens.get(key), walletKey = identity(wallet.address);
      token.symbol ||= row.symbol;
      const old = token.wallets.get(walletKey);
      if (!old || row.ts > old.ts) token.wallets.set(walletKey, {address:wallet.address, action:row.action, ts:row.ts});
      else if (row.ts === old.ts && row.action !== old.action) old.action = null;
    }
  }
  return [...tokens.values()].filter(t=>t.wallets.size>=2).map(t=>{
    const wallets = [...t.wallets.values()];
    const buyers = wallets.filter(w=>w.action==='buy').length;
    const sellers = wallets.filter(w=>w.action==='sell').length;
    return {...t, wallets, active_wallets:wallets.length, buyers, sellers,
      buy_consensus:buyers+sellers===wallets.length ? buyers/wallets.length*100 : null};
  }).sort((a,b)=>b.active_wallets-a.active_wallets || b.ts-a.ts || a.address.localeCompare(b.address));
}

function rotationTokenTarget(row) {
  const address=typeof row.address==='string'?row.address.trim():'';
  const network=typeof row.network==='string'?row.network.trim().toLowerCase():'';
  const chain=state.chains.find(c=>c.id.toLowerCase()===network||c.name.toLowerCase()===network);
  return chain && /^[A-Za-z0-9]{20,90}$/.test(address) ? {address,chain:chain.id} : null;
}
function rotationTokenMarkup(row) {
  const label=esc(row.symbol||short(row.address)), target=rotationTokenTarget(row);
  return target ? `<button type="button" class="rotation-token" data-token="${esc(target.address)}" data-chain="${esc(target.chain)}" title="Open ${esc(row.symbol||short(row.address))} on ${esc(target.chain)} in Token X-Ray (new tab)">${label}</button>` : `<b>${label}</b>`;
}
function bindRotationTokens(root) {
  root.querySelectorAll('.rotation-token').forEach(button=>button.onclick=event=>{
    event.stopPropagation();
    openToken(button.dataset.token,button.dataset.chain);
  });
}

function renderRotation(p) {
  const rows = p.rotation || [];
  return `<section class="rotation-section"><div class="eyebrow">ACTIVITY / FETCHED SAMPLE</div><h3>Recent Rotation</h3><p class="notice">CoinGecko wallet trade data · ${esc(p.rotation_window||'Last 24h within up to 200 fetched trades; full-day coverage is not guaranteed.')}</p>${p.status?.trades!=='ok'?'<p class="notice">Wallet trade data is unavailable for this profile.</p>':''}<div class="rotation-list">${rows.map(t=>`<div class="rotation-item"><time title="${esc(new Date(t.ts*1000).toLocaleString())}">${esc(new Date(t.ts*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}<small>${esc(new Date(t.ts*1000).toLocaleDateString())}</small></time><b class="tape-direction ${t.action==='buy'?'up':t.action==='sell'?'down':''}">${t.action?esc(t.action.toUpperCase()):'UNKNOWN'}</b><span title="${esc(t.address)}">${rotationTokenMarkup(t)}<small>${esc(t.network)} · ${t.trade_count} fetched trades</small></span><strong title="${usd(t.usd)}">${usd(t.usd)}</strong></div>`).join('')||'<p class="empty-note">No recent wallet rotation found.</p>'}</div></section>`;
}

function renderConsensus(shortlist) {
  const rows = walletConsensus(shortlist);
  const available = shortlist.filter(w=>w.status?.trades==='ok').length;
  $('#consensus-status').textContent = `${shortlist.length} shortlisted wallets · trade data available for ${available}. Last 24h within up to 200 fetched trades per wallet; full-day coverage is not guaranteed.`;
  $('#consensus-body').innerHTML = rows.length ? `<div class="consensus-grid" role="table" aria-label="Wallet Consensus"><div class="consensus-line consensus-heading" role="row"><span role="columnheader">Token</span><span role="columnheader">Wallets</span><span role="columnheader">Buy</span><span role="columnheader">Sell</span><span role="columnheader">Buy consensus</span><span role="columnheader">Window</span></div>${rows.map(t=>`<div class="consensus-line" role="row"><span role="cell" title="${esc(t.address)}"><b>${esc(t.symbol||short(t.address))}</b><small>${esc(short(t.address))} · ${esc(t.network)}</small></span><span role="cell" title="${esc(t.wallets.map(w=>short(w.address)).join(' · '))}">${t.active_wallets}</span><span role="cell" class="up">${t.buyers}</span><span role="cell" class="down">${t.sellers}</span><span role="cell" class="consensus-value" title="${t.buy_consensus===null?'Latest direction missing or tied':'Share of active shortlisted wallets whose latest observed direction is buy'}">${t.buy_consensus===null?'—':Math.round(t.buy_consensus)+'%'}<i class="consensus-meter"><u style="width:${t.buy_consensus??0}%"></u></i></span><span role="cell">24h<small>Fetched sample</small></span></div>`).join('')}</div>` : '<p class="empty-note">No tokens shared by 2+ shortlisted wallets in this fetched 24h sample.</p>';
}
