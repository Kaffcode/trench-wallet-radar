"""Chart normalization; no synthetic candles or market-cap estimates."""
import math

from core.client import CoinGeckoError

INTERVALS = {"1m": ("minute", 1), "5m": ("minute", 5), "15m": ("minute", 15),
             "1h": ("hour", 1), "4h": ("hour", 4), "1D": ("day", 1)}


def normalize(rows):
    by_time = {}
    for row in rows or []:
        try:
            if len(row) < 5 or any(v is None or isinstance(v, bool) for v in row[:5]):
                continue
            ts, op, hi, lo, cl = map(float, row[:5])
            if not all(math.isfinite(v) for v in (ts, op, hi, lo, cl)):
                continue
            if ts <= 0 or ts != int(ts) or min(op, hi, lo, cl) <= 0 or lo > min(op, cl) or hi < max(op, cl):
                continue
            candle = {"time": int(ts), "open": op, "high": hi, "low": lo, "close": cl}
            try:
                volume = float(row[5])
                if math.isfinite(volume) and volume >= 0:
                    candle["volume"] = volume
            except (IndexError, ValueError, TypeError):
                pass
            by_time.setdefault(int(ts), candle)
        except (ValueError, TypeError):
            continue
    return [by_time[t] for t in sorted(by_time)]


async def chart_data(client, chain, token, pool, interval):
    result = {"chain": chain, "token": token, "pool": pool, "interval": interval, "candles": []}
    if interval not in INTERVALS:
        return {**result, "message": "Unsupported timeframe."}
    if not pool:
        return {**result, "message": "No pool is available for this token."}
    timeframe, aggregate = INTERVALS[interval]
    try:
        rows = await client.pool_ohlcv(chain, pool, timeframe, aggregate=aggregate, limit=200, token=token)
    except CoinGeckoError as error:
        return {**result, "api_status": error.status, "message": f"OHLCV data isn't available for this pool/timeframe (API status {error.status}). Try again."}
    candles = normalize(rows)
    return {**result, "candles": candles, "message": "" if len(candles) >= 2 else "Insufficient candle history." if candles else "OHLCV data isn't available for this pool/timeframe."}
