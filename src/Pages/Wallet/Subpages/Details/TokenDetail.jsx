import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getBalances,
    getTokenPrices,
    getTokenBySymbol 
} from '../../Services/storageService';
import './TokenDetail.css';

const TokenDetail = () => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        const walletData = location.state?.wallet || location.state;
        
        if (walletData) {
            setWallet(walletData);
            loadBalances(walletData);
        } else if (symbol) {
            const token = getTokenBySymbol(symbol);
            if (token) {
                const mockWallet = {
                    ...token,
                    address: 'TQCc68Mp5dZ2Lm9XrJARoqo2D4Xtye5gFkR',
                    balance: '25.43',
                    isActive: true
                };
                setWallet(mockWallet);
                setUsdValue((25.43 * 6.24).toFixed(2));
            }
        }
        
        setIsLoading(false);
    }, [symbol, location.state]);

    const loadBalances = async (walletToLoad) => {
        if (!walletToLoad) return;
        
        try {
            const updatedWallets = await getBalances([walletToLoad]);
            if (updatedWallets && updatedWallets.length > 0) {
                setWallet(updatedWallets[0]);
                const prices = await getTokenPrices();
                const price = prices[walletToLoad.symbol] || 1;
                const usd = parseFloat(updatedWallets[0].balance) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };

    if (isLoading && !wallet) {
        return (
            <div className="page-container">
                <Header />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading token details...</p>
                </div>
                <Menu />
            </div>
        );
    }

    if (!wallet) {
        return (
            <div className="page-container">
                <Header />
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
            <Header />
            
            <div className="page-content">
                <div className="token-header">
                    <h1>{wallet.name}</h1>
                </div>
                
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        {wallet.symbol.substring(0, 2)}
                    </div>
                </div>
                
                <div className="token-balance-display">
                    <p className="token-amount">{wallet.balance || '0.00'} {wallet.symbol}</p>
                    <p className="usd-amount">${usdValue}</p>
                </div>
                
                {/* ГОРИЗОНТАЛЬНЫЕ КНОПКИ - 3 штуки рядом друг с другом */}
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
                        onClick={() => navigate('/receive', { state: { wallet } })}
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
                        onClick={() => navigate('/send', { state: { wallet } })}
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
                        onClick={() => navigate('/swap')}
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