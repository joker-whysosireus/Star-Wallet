import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getBalances,
    getTokenPrices 
} from '../../Services/storageService';
import './TokenDetail.css';

const TokenDetail = ({ isActive, userData }) => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        const loadWalletData = async () => {
            try {
                const walletData = location.state?.wallet;
                
                if (walletData) {
                    // Если кошелек передан через state, используем его
                    console.log('TokenDetail.jsx: Using wallet from location state');
                    setWallet(walletData);
                    await loadBalances(walletData);
                } else if (symbol && userData) {
                    // Ищем кошелек в данных пользователя
                    console.log('TokenDetail.jsx: Searching for wallet in user data');
                    const foundWallet = findWalletInUserData(symbol, userData);
                    
                    if (foundWallet) {
                        setWallet(foundWallet);
                        await loadBalances(foundWallet);
                    } else {
                        console.log('TokenDetail.jsx: Wallet not found in user data');
                        setWallet(null);
                    }
                } else {
                    console.log('TokenDetail.jsx: No wallet data available');
                    setWallet(null);
                }
            } catch (error) {
                console.error('TokenDetail.jsx: Error loading wallet data:', error);
                setWallet(null);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadWalletData();
    }, [symbol, location.state, userData]);

    // Функция для поиска кошелька в данных пользователя
    const findWalletInUserData = (symbol, userData) => {
        if (!userData || !symbol) return null;
        
        // Сначала ищем в массиве wallets
        if (userData.wallets && Array.isArray(userData.wallets)) {
            const foundWallet = userData.wallets.find(w => 
                w.symbol === symbol
            );
            
            if (foundWallet) {
                console.log('TokenDetail.jsx: Found wallet in userData.wallets');
                return foundWallet;
            }
        }
        
        // Если не нашли в wallets, ищем по адресам
        if (userData.wallet_addresses) {
            console.log('TokenDetail.jsx: Creating wallet from userData.wallet_addresses');
            
            // Определяем блокчейн на основе символа
            let blockchain = '';
            if (symbol === 'TON') {
                blockchain = 'TON';
            } else if (symbol === 'SOL') {
                blockchain = 'Solana';
            } else if (symbol === 'ETH') {
                blockchain = 'Ethereum';
            } else if (symbol === 'USDT' || symbol === 'USDC') {
                // Для стейблкоинов нужно определить блокчейн
                if (userData.wallet_addresses.TON) {
                    blockchain = 'TON';
                } else if (userData.wallet_addresses.Solana) {
                    blockchain = 'Solana';
                } else if (userData.wallet_addresses.Ethereum) {
                    blockchain = 'Ethereum';
                }
            }
            
            if (blockchain && userData.wallet_addresses[blockchain]) {
                const address = userData.wallet_addresses[blockchain].address;
                
                // Создаем объект кошелька
                const wallet = {
                    id: `${symbol.toLowerCase()}_${blockchain.toLowerCase()}`,
                    name: getTokenName(symbol),
                    symbol: symbol,
                    address: address,
                    blockchain: blockchain,
                    decimals: getTokenDecimals(symbol, blockchain),
                    isNative: symbol === blockchain,
                    contractAddress: getContractAddress(symbol, blockchain),
                    showBlockchain: true,
                    balance: '0',
                    isActive: true,
                    logo: getTokenLogo(symbol)
                };
                
                return wallet;
            }
        }
        
        return null;
    };

    const getTokenName = (symbol) => {
        const names = {
            'TON': 'Toncoin',
            'SOL': 'Solana',
            'ETH': 'Ethereum',
            'USDT': 'Tether',
            'USDC': 'USD Coin'
        };
        return names[symbol] || symbol;
    };

    const getTokenDecimals = (symbol, blockchain) => {
        if (symbol === 'TON') return 9;
        if (symbol === 'SOL') return 9;
        if (symbol === 'ETH') return 18;
        if (symbol === 'USDT' || symbol === 'USDC') return 6;
        return 6;
    };

    const getContractAddress = (symbol, blockchain) => {
        if (symbol === 'USDT') {
            if (blockchain === 'TON') return 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
            if (blockchain === 'Solana') return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
            if (blockchain === 'Ethereum') return '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        }
        if (symbol === 'USDC') {
            if (blockchain === 'TON') return 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG';
            if (blockchain === 'Solana') return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
            if (blockchain === 'Ethereum') return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        }
        return '';
    };

    const getTokenLogo = (symbol) => {
        const logos = {
            'TON': 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
            'SOL': 'https://cryptologos.cc/logos/solana-sol-logo.png',
            'ETH': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
            'USDT': 'https://cryptologos.cc/logos/tether-usdt-logo.png',
            'USDC': 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
        };
        return logos[symbol] || '';
    };

    const loadBalances = async (walletData) => {
        if (!walletData) return;
        
        try {
            const updatedWallets = await getBalances([walletData]);
            if (updatedWallets && updatedWallets.length > 0) {
                setWallet(updatedWallets[0]);
                const prices = await getTokenPrices();
                const price = prices[walletData.symbol] || 1;
                const usd = parseFloat(updatedWallets[0].balance || 0) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('TokenDetail.jsx: Error loading balances:', error);
            // Устанавливаем fallback значение
            const prices = await getTokenPrices();
            const price = prices[walletData.symbol] || 1;
            const usd = parseFloat(walletData.balance || 0) * price;
            setUsdValue(usd.toFixed(2));
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
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };

    const badge = wallet ? getBlockchainBadge(wallet.blockchain) : null;

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
                        onClick={() => navigate('/receive', { state: { wallet, userData } })}
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
                        onClick={() => navigate('/send', { state: { wallet, userData } })}
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
                        onClick={() => navigate('/swap', { state: { userData } })}
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