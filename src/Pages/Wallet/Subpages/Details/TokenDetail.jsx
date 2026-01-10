import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { TOKENS } from '../../Services/storageService';
import { 
    getBalances,
    getTokenPrices,
    getHistoricalChartData
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
    
    const formatBalance = (balance) => {
        if (!balance || balance === '0' || balance === '0.0' || balance === '0.00') return '0';
        
        const num = parseFloat(balance);
        if (isNaN(num)) return '0';
        
        const [integer, decimal] = num.toString().split('.');
        
        if (!decimal) return integer;
        
        let limitedDecimal = decimal.slice(0, 6);
        
        while (limitedDecimal.length > 0 && limitedDecimal[limitedDecimal.length - 1] === '0') {
            limitedDecimal = limitedDecimal.slice(0, -1);
        }
        
        return limitedDecimal.length > 0 ? `${integer}.${limitedDecimal}` : integer;
    };
    
    const loadChartData = async (tokenSymbol, timeRange) => {
        setIsLoadingChart(true);
        try {
            const historicalData = await getHistoricalChartData(tokenSymbol, timeRange);
            
            if (historicalData && historicalData.data) {
                setChartData(historicalData.data);
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
            setChartData([]);
        } finally {
            setIsLoadingChart(false);
        }
    };
    
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
    }, [symbol, location.state]);
    
    useEffect(() => {
        if (wallet) {
            loadChartData(wallet.symbol, timeframe);
        }
    }, [timeframe, wallet]);
    
    useEffect(() => {
        if (!wallet) return;
        
        const updateData = () => {
            loadBalances(wallet);
            loadChartData(wallet.symbol, timeframe);
        };
        
        const updateInterval = setInterval(updateData, 180000);
        
        return () => {
            clearInterval(updateInterval);
        };
    }, [wallet, timeframe]);
    
    const handleTimeframeChange = (newTimeframe) => {
        setTimeframe(newTimeframe);
    };
    
    const getLogoUrl = () => {
        if (!wallet) return '';
        return wallet.logo;
    };
    
    const getBlockchainBadge = (blockchain, symbol) => {
        if (symbol === 'USDT') {
            const actualBlockchain = wallet?.blockchain || blockchain;
            
            const badges = {
                'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
                'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
                'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
                'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
                'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' }
            };
            
            return badges[actualBlockchain] || { color: '#26A17B', bg: 'rgba(38, 161, 123, 0.1)', text: actualBlockchain || 'USDT' };
        }
        
        const badges = {
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' }
        };
        
        return badges[blockchain] || { color: '#666', bg: 'rgba(102, 102, 102, 0.1)', text: blockchain };
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
                                    backgroundColor: badge.color,
                                    color: 'white',
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
                
                <div className="chart-container">
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