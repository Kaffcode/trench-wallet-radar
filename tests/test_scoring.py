"""Deterministic wallet scoring: skill score bounds and label pass-through."""
from app import scoring


def _trade(ts, kind, qty, usd):
    if kind == "buy":
        return {"kind": "buy", "to_token_address": "TOKEN", "to_token_amount": qty, "volume_in_usd": usd, "block_timestamp": ts}
    return {"kind": "sell", "from_token_address": "TOKEN", "from_token_amount": qty, "volume_in_usd": usd, "block_timestamp": ts}


def test_skill_score_is_bounded_0_to_100():
    metrics = {"win_rate": 1.0, "trades": 100}
    pnl = {"lifetime_realized_pnl_usd": 10_000_000, "profit_concentration": 0}
    assert scoring.skill_score(metrics, pnl) == 100


def test_skill_score_zero_for_no_trades():
    assert scoring.skill_score({"win_rate": None, "trades": 0}, {"lifetime_realized_pnl_usd": 0}) == 0


def test_profile_wallet_picks_a_label_and_score():
    trades = [_trade(1000, "buy", 10, 100), _trade(2000, "sell", 10, 150), _trade(3000, "buy", 10, 100), _trade(4000, "sell", 10, 160)]
    result = scoring.profile_wallet(pnl_attrs={"total_realized_pnl_usd": 110, "token_stats": []}, trades_rows=trades, budget_usd=100, now=10_000)
    assert result["label"] in scoring.LABEL_DESCRIPTIONS
    assert 0 <= result["skill_score"] <= 100
    assert 0 <= result["copyability"] <= 100


def test_trench_weights_concentration_and_neutral_fallback():
    metrics = {"trades": 20, "win_rate": 1}
    pnl = {"lifetime_realized_pnl_usd": 50_000, "profit_concentration": 1}
    assert scoring.skill_score(metrics, pnl) == 85
    assert scoring.skill_score(metrics, {**pnl, "profit_concentration": 0.2}) == 97
    assert scoring.skill_score(metrics, {**pnl, "profit_concentration": None}) == 92
    assert scoring.skill_score(metrics, {**pnl, "lifetime_realized_pnl_usd": -10}) == 60


def test_sample_and_win_rate_use_same_source():
    from core.wallets import score_evidence
    evidence = score_evidence({"trades": 30, "win_rate": 1}, {"tokens_sold": 10, "win_rate_tokens": 0.6})
    assert evidence["sample_size"] == 10
    assert evidence["win_rate"] == 0.6


def test_proven_trader_rejects_lucky_trade_and_unknown_concentration():
    from core.wallets import label_wallet
    metrics = {"trades": 20, "win_rate": 1, "realized_pnl_usd": 1000}
    pnl = {"tokens_sold": 8, "win_rate_tokens": 0.55, "lifetime_realized_pnl_usd": 1000, "profit_concentration": 0.74}
    assert label_wallet(metrics, pnl, {}) == "proven_trader"
    for change in ({"tokens_sold": 1}, {"profit_concentration": 0.75}, {"profit_concentration": None}, {"lifetime_realized_pnl_usd": -1}):
        assert label_wallet(metrics, {**pnl, **change}, {}) != "proven_trader"


def test_summary_uses_realized_pnl_instead_of_zero_empty_fifo():
    from app.profile import _summary
    raw = {"status": {"pnl": "ok", "trades": "ok", "balances": "ok"}, "pnl": {"total_realized_pnl_usd": 500, "token_stats": []}, "trades": [], "balances": {}}
    result = _summary("0xWallet", "bsc", raw, 1000)
    assert result["realized_pnl_usd"] == 500
    assert result["sample_size"] == 0
