"""Recent token activity derived only from wallet responses already fetched."""
import math
import time

from core.wallets import _f, _ts

WINDOW_NOTE = "Last 24h within up to 200 fetched trades per wallet; full-day coverage is not guaranteed."


def recent_rotation(chain: str, trades: list[dict], pnl: dict, balances: dict, now: float | None = None) -> list[dict]:
    now = time.time() if now is None else now
    def identity(address):
        return address.lower() if address.startswith("0x") else address

    symbols = {}
    for token in (pnl.get("token_stats") or []) + (balances.get("balances") or []):
        if token.get("network") == chain and token.get("address") and token.get("symbol"):
            symbols[identity(token["address"])] = token["symbol"]
    grouped = {}
    for trade in trades[:200]:
        ts = _ts(trade.get("block_timestamp"))
        if ts is None or not math.isfinite(ts) or not now - 86400 <= ts <= now:
            continue
        action = trade.get("kind")
        # Follow the existing wallet schema: buy targets to_token; sell targets from_token.
        sides = ["to"] if action == "buy" else ["from"] if action == "sell" else ["from", "to"]
        seen = set()
        for side in sides:
            address = trade.get(f"{side}_token_address")
            if not address or identity(address) in seen:
                continue
            key = identity(address)
            seen.add(key)
            symbol = trade.get(f"{side}_token_symbol") or symbols.get(key)
            direction = action if action in ("buy", "sell") else None
            value = _f(trade.get("volume_in_usd"))
            value = value if value is not None and math.isfinite(value) and value >= 0 else None
            row = grouped.setdefault(key, {"network": chain, "address": address, "symbol": symbol, "ts": ts, "action": direction, "usd": value, "trade_count": 0})
            row["trade_count"] += 1
            row["symbol"] = row["symbol"] or symbol
            if ts > row["ts"]:
                row.update(ts=ts, action=direction, usd=value)
            elif ts == row["ts"] and direction != row["action"]:
                # Timestamp ties cannot establish the latest direction reliably.
                row.update(action=None, usd=None)
    return sorted(grouped.values(), key=lambda row: (-row["ts"], row["address"]))
