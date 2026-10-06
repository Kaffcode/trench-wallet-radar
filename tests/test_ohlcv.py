from app.ohlcv import normalize, chart_data, INTERVALS
from core.client import CoinGeckoError


def test_normalization_orders_deduplicates_and_preserves_volume():
    result = normalize([[200,2,4,1,3,10],[100,1,3,.5,2,None],[200,9,10,8,9,99]])
    assert [r['time'] for r in result] == [100,200]
    assert result[1] == dict(time=200,open=2,high=4,low=1,close=3,volume=10)
    assert 'volume' not in result[0]


def test_invalid_data_is_not_fabricated():
    assert normalize([[1,1,0,2,1], [2,None,1,1,1], [3,1,1,1,float('nan')], []]) == []


async def test_supported_intervals_use_selected_token_and_pool():
    class Client:
        async def pool_ohlcv(self, chain, pool, frame, **kw):
            self.call = chain,pool,frame,kw
            return [[100,1,2,.5,1,12],[200,1,2,.5,2,20]]
    c=Client()
    for interval,(frame,aggregate) in INTERVALS.items():
        result=await chart_data(c,'bsc','TOKEN','POOL',interval)
        assert len(result['candles']) == 2
        assert c.call == ('bsc','POOL',frame,dict(aggregate=aggregate,limit=200,token='TOKEN'))


async def test_no_pool_unsupported_empty_and_api_failure():
    assert 'No pool' in (await chart_data(None,'bsc','T',None,'1h'))['message']
    assert 'Unsupported' in (await chart_data(None,'bsc','T','P','2m'))['message']
    class Empty:
        async def pool_ohlcv(self,*a,**kw): return []
    assert not (await chart_data(Empty(),'bsc','T','P','1h'))['candles']
    class Failed:
        async def pool_ohlcv(self,*a,**kw): raise CoinGeckoError(429,'upstream body')
    result=await chart_data(Failed(),'bsc','T','P','1h')
    assert result['api_status']==429
    assert 'upstream body' not in str(result)
