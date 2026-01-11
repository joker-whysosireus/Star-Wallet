import { createHash } from 'crypto';

class PriceService {
    constructor() {
        this.currentPrices = {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'BTC': 68000.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'BCH': 500.00,
            'LTC': 85.00,
            'ADA': 0.50,
            'ETC': 30.00,
            'NEAR': 5.00,
            'XRP': 0.60,
            'TRX': 0.10,
            lastUpdated: Date.now()
        };
        
        this.historicalCache = new Map();
        this.updateInterval = null;
        this.subscribers = new Set();
        this.isUpdating = false;
    }

    generateDataHash(data) {
        const jsonString = JSON.stringify(data);
        return createHash('md5').update(jsonString).digest('hex');
    }

    async fetchHistoricalData(symbol, period) {
        const daysMap = {
            '1D': '1',
            '7D': '7',
            '1M': '30',
            '1Y': '365',
            'MAX': '1825'
        };

        const coinIdMap = {
            'TON': 'the-open-network',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'BNB': 'binancecoin',
            'BTC': 'bitcoin',
            'USDT': 'tether',
            'USDC': 'usd-coin',
            'BCH': 'bitcoin-cash',
            'LTC': 'litecoin',
            'ADA': 'cardano',
            'ETC': 'ethereum-classic',
            'NEAR': 'near',
            'XRP': 'ripple',
            'TRX': 'tron'
        };

        const days = daysMap[period] || '7';
        const coinId = coinIdMap[symbol];
        
        if (!coinId) {
            return this.generateMockHistoricalData(symbol, period);
        }

        const cacheKey = `${symbol}_${period}`;
        const now = Date.now();
        
        const cached = this.historicalCache.get(cacheKey);
        if (cached && (now - cached.timestamp < 180000)) {
            return cached.data;
        }

        try {
            let url;
            if (period === '1D') {
                url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1&interval=hourly`;
            } else {
                url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }

            const data = await response.json();
            
            const chartData = data.prices.map(point => ({
                timestamp: point[0],
                time: this.formatTime(point[0], period),
                price: point[1],
                formattedPrice: `$${point[1].toFixed(4)}`
            }));

            const dataHash = this.generateDataHash(chartData);
            
            const result = {
                data: chartData,
                hash: dataHash,
                lastUpdate: now,
                period: period
            };

            this.historicalCache.set(cacheKey, {
                data: result,
                timestamp: now
            });

            return result;

        } catch (error) {
            console.error(`Error fetching historical data for ${symbol}:`, error);
            return this.generateMockHistoricalData(symbol, period);
        }
    }

    formatTime(timestamp, period) {
        const date = new Date(timestamp);
        
        switch(period) {
            case '1D':
                return date.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                });
            case '7D':
                return date.toLocaleDateString('en-US', { 
                    weekday: 'short' 
                });
            case '1M':
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                });
            case '1Y':
                return date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: '2-digit' 
                });
            case 'MAX':
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short' 
                });
            default:
                return date.toLocaleTimeString();
        }
    }

    generateMockHistoricalData(symbol, period) {
        const basePrice = this.currentPrices[symbol] || 1;
        const dataPoints = period === '1D' ? 24 : 
                          period === '7D' ? 7 : 
                          period === '1M' ? 30 : 
                          period === '1Y' ? 12 : 60;
        
        const data = [];
        const now = Date.now();
        const interval = period === '1D' ? 3600000 :
                        period === '7D' ? 86400000 :
                        period === '1M' ? 86400000 :
                        period === '1Y' ? 2592000000 :
                        7884000000;

        for (let i = dataPoints - 1; i >= 0; i--) {
            const time = now - (i * interval);
            const variation = 0.8 + Math.random() * 0.4;
            const price = basePrice * variation;
            
            data.push({
                timestamp: time,
                time: this.formatTime(time, period),
                price: price,
                formattedPrice: `$${price.toFixed(4)}`
            });
        }

        const dataHash = this.generateDataHash(data);
        
        return {
            data: data,
            hash: dataHash,
            lastUpdate: now,
            period: period,
            isMock: true
        };
    }

    async fetchCurrentPrices() {
        if (this.isUpdating) {
            return this.currentPrices;
        }

        this.isUpdating = true;

        try {
            const coinIds = [
                'the-open-network', 
                'ethereum', 
                'solana', 
                'binancecoin', 
                'bitcoin',
                'tether',
                'usd-coin',
                'bitcoin-cash',
                'litecoin',
                'cardano',
                'ethereum-classic',
                'near',
                'ripple',
                'tron'
            ];
            
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`
            );

            if (response.ok) {
                const data = await response.json();
                
                this.currentPrices = {
                    'TON': data['the-open-network']?.usd || this.currentPrices.TON,
                    'ETH': data.ethereum?.usd || this.currentPrices.ETH,
                    'SOL': data.solana?.usd || this.currentPrices.SOL,
                    'BNB': data.binancecoin?.usd || this.currentPrices.BNB,
                    'BTC': data.bitcoin?.usd || this.currentPrices.BTC,
                    'USDT': data.tether?.usd || 1.00,
                    'USDC': data['usd-coin']?.usd || 1.00,
                    'BCH': data['bitcoin-cash']?.usd || this.currentPrices.BCH,
                    'LTC': data.litecoin?.usd || this.currentPrices.LTC,
                    'ADA': data.cardano?.usd || this.currentPrices.ADA,
                    'ETC': data['ethereum-classic']?.usd || this.currentPrices.ETC,
                    'NEAR': data.near?.usd || this.currentPrices.NEAR,
                    'XRP': data.ripple?.usd || this.currentPrices.XRP,
                    'TRX': data.tron?.usd || this.currentPrices.TRX,
                    lastUpdated: Date.now()
                };
            }
        } catch (error) {
            console.error('Error fetching current prices:', error);
        } finally {
            this.isUpdating = false;
        }

        return this.currentPrices;
    }

    startPeriodicUpdates(callback) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.fetchCurrentPrices().then(() => {
            if (callback) callback(this.currentPrices);
            this.notifySubscribers();
        });

        this.updateInterval = setInterval(async () => {
            console.log('Performing scheduled price update...');
            await this.fetchCurrentPrices();
            if (callback) callback(this.currentPrices);
            this.notifySubscribers();
            
            this.historicalCache.clear();
            
        }, 180000);

        return this.updateInterval;
    }

    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    notifySubscribers() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.currentPrices);
            } catch (error) {
                console.error('Error in price update callback:', error);
            }
        });
    }

    getCurrentPrices() {
        return { ...this.currentPrices };
    }

    getTokenPrice(symbol) {
        return this.currentPrices[symbol] || 0;
    }
}

const priceService = new PriceService();
export default priceService;