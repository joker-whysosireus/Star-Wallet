// priceService.js
const CACHE_DURATION = 60000; // 1 минута
const priceCache = {};

export const fetchTokenPrices = async () => {
    const now = Date.now();
    const cacheKey = 'tokenPrices';
    
    // Проверяем кэш
    if (priceCache[cacheKey] && (now - priceCache[cacheKey].timestamp) < CACHE_DURATION) {
        return priceCache[cacheKey].prices;
    }
    
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin,tether,usd-coin&vs_currencies=usd', {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const prices = {
                'TON': data['the-open-network']?.usd || 6.24,
                'ETH': data.ethereum?.usd || 3500.00,
                'SOL': data.solana?.usd || 172.34,
                'BNB': data.binancecoin?.usd || 600.00,
                'TRX': data.tron?.usd || 0.12,
                'BTC': data.bitcoin?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50,
                'XRP': data.ripple?.usd || 0.52,
                'LTC': data.litecoin?.usd || 74.30,
                'DOGE': data.dogecoin?.usd || 0.15,
                'USDT': data.tether?.usd || 1.00,
                'USDC': data['usd-coin']?.usd || 1.00
            };
            
            // Сохраняем в кэш
            priceCache[cacheKey] = {
                prices,
                timestamp: now
            };
            
            return prices;
        }
        
        throw new Error('Failed to fetch prices');
    } catch (error) {
        console.error('Error fetching token prices:', error);
        
        // Возвращаем кэшированные цены или значения по умолчанию
        if (priceCache[cacheKey]) {
            return priceCache[cacheKey].prices;
        }
        
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'USDT': 1.00,
            'USDC': 1.00
        };
    }
};

// Функция для запуска автоматического обновления цен
export const startPriceUpdates = (callback, interval = 60000) => {
    const update = async () => {
        const prices = await fetchTokenPrices();
        if (callback && typeof callback === 'function') {
            callback(prices);
        }
    };
    
    // Обновляем сразу
    update();
    
    // Устанавливаем интервал
    const intervalId = setInterval(update, interval);
    
    return () => clearInterval(intervalId);
};