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
    const [usdValue, setUsdValue] = useState('0.00');
    const userData = location.state?.userData;
    const network = location.state?.network || 'mainnet';
    
    useEffect(() => {
        const walletData = location.state?.wallet || location.state;
        
        if (walletData) {
            setWallet(walletData);
            loadBalances(walletData);
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
                    address: 'TQCc68Mp5dZ2Lm9XrJARoqo2D4Xtye5gFkR',
                    balance: '0.00',
                    isActive: true,
                    network: network,
                    logo: token.logo
                };
                setWallet(mockWallet);
                loadBalances(mockWallet);
            }
        }
    }, [symbol, location.state]);

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
                disableNetworkSwitch={true}
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
                                    justify-content: center;
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
            </div>
            
            <Menu />
        </div>
    );
};

export default TokenDetail;