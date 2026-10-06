from app.rotation import recent_rotation


def trade(token, ts, kind="buy", usd=10):
    return {"kind": kind, "block_timestamp": ts, "to_token_address": token,
            "from_token_address": token, "volume_in_usd": usd}


def test_rotation_orders_groups_and_keeps_latest_action():
    rows = [trade("0xA", 990), trade("0xB", 995), trade("0xa", 998, "sell", 20)]
    result = recent_rotation("bsc", rows, {}, {}, now=1000)
    assert [r["address"] for r in result] == ["0xA", "0xB"]
    assert result[0]["action"] == "sell"
    assert result[0]["trade_count"] == 2
    assert result[0]["usd"] == 20
    assert result[0]["symbol"] is None


def test_rotation_empty_and_outside_window():
    assert recent_rotation("bsc", [], {}, {}, now=100000) == []
    assert recent_rotation("bsc", [trade("A", 1), trade("B", 100001), trade("C", "bad")], {}, {}, now=100000) == []


def test_rotation_missing_direction_and_conflicting_timestamp():
    result = recent_rotation("bsc", [trade("A", 990), trade("A", 990, "sell"), trade("B", 999, "swap", None)], {}, {}, now=1000)
    assert all(r["action"] is None for r in result)
    assert result[0]["usd"] is None


def test_rotation_symbols_are_from_same_network_existing_response():
    pnl = {"token_stats": [{"network":"bsc", "address":"0xa", "symbol":"AAA"}, {"network":"eth", "address":"0xb", "symbol":"WRONG"}]}
    result = recent_rotation("bsc", [trade("0xA", 990), trade("0xB", 980)], pnl, {}, now=1000)
    assert [r["symbol"] for r in result] == ["AAA", None]
