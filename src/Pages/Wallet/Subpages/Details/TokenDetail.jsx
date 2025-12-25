import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { TOKENS } from '../../Services/storageService';
import { 
    getBalances,
    getTokenPrices 
} from '../../Services/storageService';
import './TokenDetail.css';

const TokenDetail = () => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [usdValue, setUsdValue] = useState('0.00');
    const [showSkeleton, setShowSkeleton] = useState(false);
    const userData = location.state?.userData || location.state?.userData;
    
    useEffect(() => {
        const walletData = location.state?.wallet || location.state;
        
        if (walletData) {
            setWallet(walletData);
            loadBalances();
        } else if (symbol) {
            const token = Object.values(TOKENS).find(t => t.symbol === symbol);
            if (token) {
                const mockWallet = {
                    ...token,
                    address: 'TQCc68Mp5dZ2Lm9XrJARoqo2D4Xtye5gFkR',
                    balance: '25.43',
                    isActive: true
                };
                setWallet(mockWallet);
                setUsdValue((25.43 * 6.24).toFixed(2));
                setIsLoading(false);
            } else {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [symbol, location.state]);

    const loadBalances = async () => {
        if (!wallet || !userData) return;
        
        setShowSkeleton(true);
        
        try {
            const updatedWallets = await getBalances([wallet], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                setWallet(updatedWallets[0]);
                const prices = await getTokenPrices();
                const price = prices[wallet.symbol] || 1;
                const usd = parseFloat(updatedWallets[0].balance) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        } finally {
            setShowSkeleton(false);
            setIsLoading(false);
        }
    };

    const getLogoUrl = () => {
        if (!wallet) return '';
        if (wallet.symbol === 'TON') {
            return 'https://ton.org/download/ton_symbol.svg';
        }
        return wallet.logo;
    };

    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', text: 'TON' },
            'Solana': { color: '#00ff88', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', text: 'ETH' },
            'Tron': { color: '#ff0000', text: 'TRX' },
            'Bitcoin': { color: '#f7931a', text: 'BTC' },
            'NEAR': { color: '#0b4731ff', text: 'NEAR' },
            'BSC': { color: '#bfcd43ff', text: 'BNB' },
            'XRP': { color: '#23292f', text: 'XRP' },
            'LTC': { color: '#bfbbbb', text: 'LTC' },
            'DOGE': { color: '#c2a633', text: 'DOGE' },
            'Cardano': { color: '#0033AD', text: 'ADA' } 
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };

    const badge = wallet ? getBlockchainBadge(wallet.blockchain) : null;

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
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src={getLogoUrl()} 
                            alt={wallet.symbol}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                                console.error(`Failed to load logo for ${wallet.symbol}:`, e);
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
                        {showSkeleton ? (
                            <div className="skeleton-loader" style={{ 
                                width: '180px', 
                                height: '32px', 
                                marginBottom: '10px' 
                            }}></div>
                        ) : (
                            <p className="token-amount">{wallet.balance || '0.00'} {wallet.symbol}</p>
                        )}
                        {badge && !showSkeleton && (
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
                    
                    {showSkeleton ? (
                        <div className="skeleton-loader" style={{ 
                            width: '100px', 
                            height: '24px',
                            marginTop: '5px'
                        }}></div>
                    ) : (
                        <p className="usd-amount">${usdValue}</p>
                    )}
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
                                userData: userData 
                            } 
                        })}
                        disabled={showSkeleton}
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
                                userData: userData 
                            } 
                        })}
                        disabled={showSkeleton}
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
                                userData: userData 
                            } 
                        })}
                        disabled={showSkeleton}
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
            </div>
            
            <Menu />
        </div>
    );
};

export default TokenDetail;