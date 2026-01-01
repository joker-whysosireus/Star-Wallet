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
    XAxis,
    YAxis,
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
                case '1W':
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
        if (symbol === 'USDT') {
            return { color: '#26A17B', text: 'USDT' };
        }
        
        const badges = {
            'TON': { color: '#0088cc', text: 'TON' },
            'Solana': { color: '#00ff88', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', text: 'ETH' },
            'Tron': { color: '#ff0000', text: 'TRX' },
            'Bitcoin': { color: '#E49E00', text: 'BTC' },
            'NEAR': { color: '#0b4731ff', text: 'NEAR' },
            'BSC': { color: '#bfcd43ff', text: 'BNB' }
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
                                fallback.style.cssText = `
                                    width: 80px;
                                    height: 80px;
                                    display: flex;
                                    align-items: center;
                                    justifyContent: center;
                                    background: rgba(255, 215, 0, 0.2);
                                    border-radius: 50%;
                                    color: #FFD700;
                                    font-size: 24px;
                                    font-weight: bold;
                                `;
                                e.target.parentNode.appendChild(fallback);
                            }}
                        />
                    </div>
                </div>
                
                <div className="token-balance-display">
                    <div className="token-amount-container">
                        <p className="token-amount">{wallet.balance || '0.00'} {wallet.symbol}</p>
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
                
                <div className="chart-container" style={{
                    width: '100%',
                    maxWidth: '380px',
                    marginTop: '25px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '15px',
                    padding: '15px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '15px'
                    }}>
                        <h3 style={{
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: '600',
                            margin: 0
                        }}>
                            Price Chart ({wallet.symbol})
                        </h3>
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            padding: '4px'
                        }}>
                            {['1D', '1W', '1M', '1Y'].map((time) => (
                                <button
                                    key={time}
                                    onClick={() => handleTimeframeChange(time)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: timeframe === time ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                                        color: timeframe === time ? '#FFD700' : 'rgba(255, 255, 255, 0.6)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {isLoadingChart ? (
                        <div style={{
                            height: '170px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255, 255, 255, 0.5)'
                        }}>
                            Loading chart...
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart
                                data={chartData}
                                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                <XAxis 
                                    dataKey="time" 
                                    stroke="rgba(255, 255, 255, 0.5)"
                                    fontSize={10}
                                />
                                <YAxis 
                                    stroke="rgba(255, 255, 255, 0.5)"
                                    fontSize={10}
                                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                                />
                                <Tooltip
                                    formatter={(value) => [`$${parseFloat(value).toFixed(4)}`, 'Price']}
                                    labelFormatter={(label) => `Time: ${label}`}
                                    contentStyle={{
                                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                        border: '1px solid rgba(255, 215, 0, 0.3)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#FFD700"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#FFD700' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                    
                    <div style={{
                        marginTop: '15px',
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        textAlign: 'center'
                    }}>
                        {chartData.length > 0 && (
                            <p>
                                Current: ${chartData[chartData.length - 1]?.price?.toFixed(4) || '0.00'} • 
                                Change: {chartData.length > 1 ? 
                                    (((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price * 100).toFixed(2)) : '0.00'}%
                            </p>
                        )}
                    </div>
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default TokenDetail;