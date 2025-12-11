// Pages/Wallet/Subpages/Details/TokenDetail.jsx
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

const TokenDetail = ({ userData }) => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        const loadTokenData = async () => {
            try {
                const walletData = location.state?.wallet || location.state;
                
                if (walletData) {
                    setWallet(walletData);
                    loadBalances(walletData);
                } else if (symbol && userData) {
                    const token = await getTokenBySymbol(symbol, userData);
                    if (token) {
                        setWallet(token);
                        loadBalances(token);
                    } else {
                        console.error(`Token ${symbol} not found in user data`);
                        setIsLoading(false);
                    }
                } else {
                    console.error('No symbol or user data available');
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error loading token data:', error);
                setIsLoading(false);
            }
        };

        loadTokenData();
    }, [symbol, location.state, userData]);

    const loadBalances = async (walletToLoad) => {
        if (!walletToLoad) return;
        
        try {
            const updatedWallets = await getBalances([walletToLoad], userData);
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
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <Header userData={userData} />
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
                <div className="token-header">
                    <h1>{wallet.name}</h1>
                    <p className="token-blockchain">{wallet.blockchain} Network</p>
                </div>
                
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        {wallet.logo ? (
                            <img 
                                src={wallet.logo} 
                                alt={wallet.symbol}
                                className="token-logo-large"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    const fallback = e.target.nextElementSibling;
                                    if (fallback) fallback.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div 
                            className="token-icon-fallback"
                            style={{
                                display: wallet.logo ? 'none' : 'flex'
                            }}
                        >
                            {wallet.symbol.substring(0, 2)}
                        </div>
                    </div>
                </div>
                
                <div className="token-balance-display">
                    <p className="token-amount">{wallet.balance || '0.00'} {wallet.symbol}</p>
                    <p className="usd-amount">${usdValue}</p>
                </div>
                
                <div className="token-action-buttons">
                    <button 
                        className="token-action-btn"
                        onClick={() => navigate('/receive', { 
                            state: { 
                                wallet,
                                userData
                            } 
                        })}
                    >
                        <span className="token-action-btn-icon">↓</span>
                        <span className="token-action-btn-text">Receive</span>
                    </button>
                    
                    <button 
                        className="token-action-btn"
                        onClick={() => navigate('/send', { 
                            state: { 
                                wallet,
                                userData
                            } 
                        })}
                    >
                        <span className="token-action-btn-icon">↑</span>
                        <span className="token-action-btn-text">Send</span>
                    </button>
                    
                    <button 
                        className="token-action-btn"
                        onClick={() => navigate('/swap', { state: { userData } })}
                    >
                        <span className="token-action-btn-icon">↔</span>
                        <span className="token-action-btn-text">Swap</span>
                    </button>
                </div>
                
                <div className="token-info-section">
                    <div className="token-info-item">
                        <span className="token-info-label">Network:</span>
                        <span className="token-info-value">{wallet.blockchain}</span>
                    </div>
                    <div className="token-info-item">
                        <span className="token-info-label">Contract:</span>
                        <span className="token-info-value">
                            {wallet.contractAddress ? 
                                `${wallet.contractAddress.substring(0, 10)}...` : 
                                'Native Token'
                            }
                        </span>
                    </div>
                    <div className="token-info-item">
                        <span className="token-info-label">Address:</span>
                        <span className="token-info-value">
                            {wallet.address ? 
                                `${wallet.address.substring(0, 10)}...` : 
                                'Not available'
                            }
                        </span>
                    </div>
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default TokenDetail;