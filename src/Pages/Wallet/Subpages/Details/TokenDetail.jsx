import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { TOKENS } from '../../Services/storageService';
import { 
    getBalances,
    getTokenPrices 
} from '../../Services/storageService';
import {
    LineChart,
    Line,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import './TokenDetail.css';

const TokenDetail = () => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [usdValue, setUsdValue] = useState('0.00');
    const [chartData, setChartData] = useState([]);
    const [timeframe, setTimeframe] = useState('1D');
    const [isLoadingChart, setIsLoadingChart] = useState(false);
    const userData = location.state?.userData;
    const network = location.state?.network || 'mainnet';
    
    // Функция для форматирования числа с ограничением до 6 знаков после запятой
    const formatBalance = (balance) => {
        if (!balance || balance === '0' || balance === '0.0' || balance === '0.00') return '0';
        
        const num = parseFloat(balance);
        if (isNaN(num)) return '0';
        
        // Разделяем на целую и дробную часть
        const [integer, decimal] = num.toString().split('.');
        
        if (!decimal) return integer;
        
        // Ограничиваем до 6 знаков после запятой
        let limitedDecimal = decimal.slice(0, 6);
        
        // Убираем лишние нули в конце
        while (limitedDecimal.length > 0 && limitedDecimal[limitedDecimal.length - 1] === '0') {
            limitedDecimal = limitedDecimal.slice(0, -1);
        }
        
        return limitedDecimal.length > 0 ? `${integer}.${limitedDecimal}` : integer;
    };
    
    useEffect(() => {
        const walletData = location.state?.wallet || location.state;
        
        if (walletData) {
            setWallet(walletData);
            loadBalances(walletData);
            loadChartData(walletData.symbol, timeframe);
        } else if (symbol) {
            let token = null;
            for (const key in TOKENS) {
                if (TOKENS[key].symbol === symbol) {
                    token = TOKENS[key];
                    break;
                }
            }
            
            if (token) {
                const mockWallet = {
                    ...token,
                    address: '',
                    balance: '0.00',
                    isActive: true,
                    network: network,
                    logo: token.logo
                };
                setWallet(mockWallet);
                loadBalances(mockWallet);
                loadChartData(symbol, timeframe);
            }
        }
    }, [symbol, location.state, timeframe]);

    const loadBalances = async (walletToUpdate) => {
        if (!walletToUpdate || !userData) return;
        
        try {
            const updatedWallets = await getBalances([walletToUpdate], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                const updatedWallet = updatedWallets[0];
                setWallet(updatedWallet);
                const prices = await getTokenPrices();
                const price = prices[updatedWallet.symbol] || 1;
                const usd = parseFloat(updatedWallet.balance || 0) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };

    const loadChartData = async (tokenSymbol, timeRange) => {
        setIsLoadingChart(true);
        try {
            let mockData = [];
            const basePrice = await getMockPrice(tokenSymbol);
            
            switch(timeRange) {
                case '1D':
                    for (let i = 23; i >= 0; i--) {
                        const time = new Date(Date.now() - i * 60 * 60 * 1000);
                        mockData.push({
                            time: time.getHours() + ':00',
                            price: basePrice * (0.95 + Math.random() * 0.1)
                        });
                    }
                    break;
                case '7D':
                    for (let i = 6; i >= 0; i--) {
                        const time = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                        mockData.push({
                            time: time.toLocaleDateString('en-US', { weekday: 'short' }),
                            price: basePrice * (0.9 + Math.random() * 0.2)
                        });
                    }
                    break;
                case '1M':
                    for (let i = 9; i >= 0; i--) {
                        const time = new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000);
                        mockData.push({
                            time: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            price: basePrice * (0.8 + Math.random() * 0.4)
                        });
                    }
                    break;
                case '1Y':
                    for (let i = 11; i >= 0; i--) {
                        const time = new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000);
                        mockData.push({
                            time: time.toLocaleDateString('en-US', { month: 'short' }),
                            price: basePrice * (0.7 + Math.random() * 0.6)
                        });
                    }
                    break;
                case 'MAX':
                    for (let i = 14; i >= 0; i--) {
                        const time = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
                        mockData.push({
                            time: time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            price: basePrice * (0.5 + Math.random() * 1)
                        });
                    }
                    break;
                default:
                    mockData = [
                        { time: '09:00', price: basePrice },
                        { time: '12:00', price: basePrice * 1.05 },
                        { time: '15:00', price: basePrice * 0.98 },
                        { time: '18:00', price: basePrice * 1.02 },
                        { time: '21:00', price: basePrice * 1.01 }
                    ];
            }
            
            setChartData(mockData);
        } catch (error) {
            console.error('Error loading chart data:', error);
        } finally {
            setIsLoadingChart(false);
        }
    };

    const getMockPrice = async (symbol) => {
        try {
            const prices = await getTokenPrices();
            return prices[symbol] || 1;
        } catch {
            const defaultPrices = {
                'TON': 6.24,
                'ETH': 3500.00,
                'SOL': 172.34,
                'BNB': 600.00,
                'TRX': 0.12,
                'BTC': 68000.00,
                'NEAR': 8.50,
                'USDT': 1.00
            };
            return defaultPrices[symbol] || 1;
        }
    };

    const getLogoUrl = () => {
        if (!wallet) return '';
        return wallet.logo;
    };

    const getBlockchainBadge = (blockchain, symbol) => {
        // Для USDT показываем блокчейн, а не "USDT"
        if (symbol === 'USDT') {
            // Используем blockchain из wallet, который передается из USDTDetail
            const actualBlockchain = wallet?.blockchain || blockchain;
            
            const badges = {
                'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
                'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
                'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
                'Tron': { color: '#ff0000', bg: 'rgba(255, 0, 0, 0.1)', text: 'TRX' },
                'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
                'Litecoin': { color: '#bfbbbf', bg: 'rgba(191, 187, 191, 0.1)', text: 'LTC' },
                'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' }
            };
            
            return badges[actualBlockchain] || { color: '#26A17B', text: actualBlockchain || 'USDT' };
        }
        
        // Для остальных токенов показываем соответствующий блокчейн
        const badges = {
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
            'Tron': { color: '#ff0000', bg: 'rgba(255, 0, 0, 0.1)', text: 'TRX' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
            'Litecoin': { color: '#bfbbbf', bg: 'rgba(191, 187, 191, 0.1)', text: 'LTC' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' }
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };

    const handleTimeframeChange = (newTimeframe) => {
        setTimeframe(newTimeframe);
        if (wallet) {
            loadChartData(wallet.symbol, newTimeframe);
        }
    };

    const badge = wallet ? getBlockchainBadge(wallet.blockchain, wallet.symbol) : null;

    const calculateChange = () => {
        if (chartData.length < 2) return 0;
        const firstPrice = chartData[0].price;
        const lastPrice = chartData[chartData.length - 1].price;
        return ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
    };

    const change = calculateChange();
    const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1]?.price : 0;
    const changeColor = parseFloat(change) >= 0 ? '#4CAF50' : '#F44336';

    if (!wallet) {
        return (
            <div className="page-container">
                <Header userData={userData} />
                <div className="page-content">
                    <h1 style={{ color: 'white' }}>Token not found</h1>
                    <button 
                        onClick={() => navigate('/wallet')}
                        className="action-button"
                    >
                        Back to Wallet
                    </button>
                </div>
                <Menu />
            </div>
        );
    }

    return (
        <div className="page-container">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={false}
            />
            
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src={getLogoUrl()} 
                            alt={wallet.symbol}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'token-logo-fallback';
                                fallback.textContent = wallet.symbol.substring(0, 2);
                                e.target.parentNode.appendChild(fallback);
                            }}
                        />
                    </div>
                </div>
                
                <div className="token-balance-display">
                    <div className="token-amount-container">
                        <p className="token-amount">{formatBalance(wallet.balance)} {wallet.symbol}</p>
                        {badge && (
                            <div 
                                className="blockchain-badge" 
                                style={{ 
                                    borderColor: badge.color,
                                    color: badge.color,
                                }}
                                title={wallet.blockchain}
                            >
                                {badge.text}
                            </div>
                        )}
                    </div>
                    
                    <p className="usd-amount">${usdValue}</p>
                </div>
                
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '15px',
                    width: '100%',
                    maxWidth: '400px',
                    marginTop: '10px'
                }}>
                    <button 
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            padding: '12px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: '55px',
                            height: '55px',
                            transition: 'all 0.2s ease',
                            maxWidth: '100px'
                        }}
                        onClick={() => navigate('/receive', { 
                            state: { 
                                wallet,
                                userData: userData,
                                network: network
                            } 
                        })}
                    >
                        <span style={{
                            fontSize: '18px',
                            marginBottom: '4px',
                            display: 'block',
                            color: '#FFD700'
                        }}>↓</span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '500'
                        }}>Receive</span>
                    </button>
                    
                    <button 
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            padding: '12px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: '55px',
                            height: '55px',
                            transition: 'all 0.2s ease',
                            maxWidth: '100px'
                        }}
                        onClick={() => navigate('/send', { 
                            state: { 
                                wallet,
                                userData: userData,
                                network: network
                            } 
                        })}
                    >
                        <span style={{
                            fontSize: '18px',
                            marginBottom: '4px',
                            display: 'block',
                            color: '#FFD700'
                        }}>↑</span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '500'
                        }}>Send</span>
                    </button>
                    
                    <button 
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            borderRadius: '10px',
                            color: 'white',
                            padding: '12px 6px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            flex: 1,
                            minWidth: '55px',
                            height: '55px',
                            transition: 'all 0.2s ease',
                            maxWidth: '100px'
                        }}
                        onClick={() => navigate('/swap', { 
                            state: { 
                                fromToken: wallet,
                                userData: userData,
                                network: network
                            } 
                        })}
                    >
                        <span style={{
                            fontSize: '18px',
                            marginBottom: '4px',
                            display: 'block',
                            color: '#FFD700'
                        }}>↔</span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '500'
                        }}>Swap</span>
                    </button>
                </div>
                
                {/* Блок с графиком - новый дизайн */}
                <div className="chart-container">
                    {/* Верхняя часть с ценой и изменением */}
                    <div className="chart-price-section">
                        <div className="chart-price-left">
                            <div className="chart-price-value">
                                ${currentPrice.toFixed(4)}
                            </div>
                            <div className="chart-price-label">
                                Price for 1 {wallet.symbol}
                            </div>
                        </div>
                        
                        <div className="chart-change-right">
                            <div className="chart-change-value" style={{ color: changeColor }}>
                                {parseFloat(change) >= 0 ? '+' : ''}{change}%
                            </div>
                            <div className="chart-change-label">
                                Change
                            </div>
                        </div>
                    </div>
                    
                    {/* Основная область графика */}
                    {isLoadingChart ? (
                        <div className="chart-loading">
                            Loading chart...
                        </div>
                    ) : (
                        <div className="chart-graph-area">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid 
                                        strokeDasharray="0" 
                                        stroke="rgba(255, 255, 255, 0.03)"
                                        horizontal={true}
                                        vertical={false}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`$${parseFloat(value).toFixed(4)}`, 'Price']}
                                        labelFormatter={(label) => `Time: ${label}`}
                                        contentStyle={{
                                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                            border: '1px solid rgba(255, 215, 0, 0.3)',
                                            borderRadius: '8px',
                                            padding: '8px'
                                        }}
                                        labelStyle={{
                                            color: '#FFD700',
                                            fontSize: '12px'
                                        }}
                                        itemStyle={{
                                            color: 'white',
                                            fontSize: '12px'
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="price"
                                        stroke={changeColor}
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6, fill: '#FFD700', stroke: 'white', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                    
                    {/* Кнопки временных интервалов */}
                    <div className="chart-timeframe-buttons">
                        {['1D', '7D', '1M', '1Y', 'MAX'].map((time) => (
                            <button
                                key={time}
                                onClick={() => handleTimeframeChange(time)}
                                className={`timeframe-button ${timeframe === time ? 'active' : ''}`}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default TokenDetail;