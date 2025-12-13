import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../assets/Header/Header";
import Menu from '../../assets/Menus/Menu/Menu';
import TokenCard from './Components/List/TokenCard';
import { 
    getBalances, 
    calculateTotalBalance,
    getTokenPrices
} from './Services/storageService';
import './Wallet.css';

function Wallet({ isActive, userData, onLogout }) {
    const [wallets, setWallets] = useState([]);
    const [totalBalance, setTotalBalance] = useState('$0.00');
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    
    const hasLoadedWallets = useRef(false);

    useEffect(() => {
        const isTelegramWebApp = () => {
            try {
                return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton;
            } catch (e) {
                return false;
            }
        };

        if (isTelegramWebApp()) {
            const webApp = window.Telegram.WebApp;
            webApp.BackButton.hide();
        }
    }, []);

    const initializeWallets = useCallback(async () => {
        try {
            if (!userData) {
                console.log('Wallet.jsx: No user data available');
                setIsLoading(false);
                return;
            }

            console.log('Wallet.jsx: Initializing wallets for user:', userData.telegram_user_id);
            
            let allTokens = [];
            
            // Если у пользователя уже есть кошельки в userData, используем их
            if (userData.wallets && Array.isArray(userData.wallets) && userData.wallets.length > 0) {
                console.log('Wallet.jsx: Using wallets from userData:', userData.wallets.length);
                allTokens = userData.wallets;
            } 
            // Если нет кошельков, но есть wallet_addresses, создаем кошельки из них
            else if (userData.wallet_addresses && Object.keys(userData.wallet_addresses).length > 0) {
                console.log('Wallet.jsx: Creating wallets from userData.wallet_addresses');
                allTokens = createWalletsFromAddresses(userData.wallet_addresses);
            } 
            // Если нет ни кошельков, ни адресов, показываем пустой список
            else {
                console.log('Wallet.jsx: No wallets or addresses found');
                allTokens = [];
            }
            
            if (!Array.isArray(allTokens) || allTokens.length === 0) {
                console.log('Wallet.jsx: No tokens found');
                setWallets([]);
                setIsLoading(false);
                return;
            }

            console.log('Wallet.jsx: Found tokens:', allTokens.length);
            
            // Устанавливаем начальные кошельки
            setWallets(allTokens);
            
            // Кэшируем в localStorage
            localStorage.setItem('cached_wallets', JSON.stringify(allTokens));
            
            try {
                // Получаем актуальные балансы
                const updatedWallets = await getBalances(allTokens);
                setWallets(updatedWallets);
                
                // Рассчитываем общий баланс
                const total = await calculateTotalBalance(updatedWallets);
                setTotalBalance(`$${total}`);
                
                console.log('Wallet.jsx: Balances updated successfully');
            } catch (balanceError) {
                console.error('Wallet.jsx: Error updating balances:', balanceError);
                
                // Используем fallback расчет
                const prices = await getTokenPrices();
                const total = allTokens.reduce((sum, wallet) => {
                    const price = prices[wallet.symbol] || 1.00;
                    return sum + (parseFloat(wallet.balance || 0) * price);
                }, 0);
                
                setTotalBalance(`$${total.toFixed(2)}`);
            }
            
            setIsLoading(false);
            
        } catch (error) {
            console.error('Wallet.jsx: Error initializing wallets:', error);
            setWallets([]);
            setIsLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        if (!hasLoadedWallets.current && userData) {
            initializeWallets();
            hasLoadedWallets.current = true;
        }
    }, [initializeWallets, userData]);

    // Функция для создания кошельков из адресов в userData
    const createWalletsFromAddresses = (walletAddresses) => {
        const wallets = [];
        
        // TON Blockchain
        if (walletAddresses.TON && walletAddresses.TON.address) {
            wallets.push({
                id: 'ton',
                name: 'Toncoin',
                symbol: 'TON',
                address: walletAddresses.TON.address,
                blockchain: 'TON',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
            });
            
            wallets.push({
                id: 'usdt_ton',
                name: 'Tether',
                symbol: 'USDT',
                address: walletAddresses.TON.address,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            });
            
            wallets.push({
                id: 'usdc_ton',
                name: 'USD Coin',
                symbol: 'USDC',
                address: walletAddresses.TON.address,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            });
        }

        // Solana Blockchain
        if (walletAddresses.Solana && walletAddresses.Solana.address) {
            wallets.push({
                id: 'sol',
                name: 'Solana',
                symbol: 'SOL',
                address: walletAddresses.Solana.address,
                blockchain: 'Solana',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
            });
            
            wallets.push({
                id: 'usdt_sol',
                name: 'Tether',
                symbol: 'USDT',
                address: walletAddresses.Solana.address,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            });
            
            wallets.push({
                id: 'usdc_sol',
                name: 'USD Coin',
                symbol: 'USDC',
                address: walletAddresses.Solana.address,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            });
        }

        // Ethereum Blockchain
        if (walletAddresses.Ethereum && walletAddresses.Ethereum.address) {
            wallets.push({
                id: 'eth',
                name: 'Ethereum',
                symbol: 'ETH',
                address: walletAddresses.Ethereum.address,
                blockchain: 'Ethereum',
                decimals: 18,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            });
            
            wallets.push({
                id: 'usdt_eth',
                name: 'Tether',
                symbol: 'USDT',
                address: walletAddresses.Ethereum.address,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            });
            
            wallets.push({
                id: 'usdc_eth',
                name: 'USD Coin',
                symbol: 'USDC',
                address: walletAddresses.Ethereum.address,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            });
        }

        return wallets;
    };

    const handleTokenClick = useCallback((wallet) => {
        if (wallet && wallet.symbol) {
            navigate(`/wallet/token/${wallet.symbol}`, { 
                state: { 
                    wallet: wallet,
                    userData: userData
                }
            });
        }
    }, [navigate, userData]);

    const handleActionClick = useCallback((action) => {
        if (!userData || !wallets.length) return;

        if (action === 'receive') {
            const firstWallet = wallets.find(w => w.address);
            if (firstWallet) {
                navigate('/receive', { 
                    state: { 
                        wallet: firstWallet,
                        userData: userData 
                    } 
                });
            } else if (wallets.length > 0) {
                navigate('/receive', { 
                    state: { 
                        wallet: wallets[0],
                        userData: userData 
                    } 
                });
            }
        } else if (action === 'send') {
            const firstWallet = wallets.find(w => w.address);
            if (firstWallet) {
                navigate('/send', { 
                    state: { 
                        wallet: firstWallet,
                        userData: userData 
                    } 
                });
            } else if (wallets.length > 0) {
                navigate('/send', { 
                    state: { 
                        wallet: wallets[0],
                        userData: userData 
                    } 
                });
            }
        } else if (action === 'earn') {
            navigate('/stake', { state: { userData } });
        } else if (action === 'swap') {
            navigate('/swap', { state: { userData } });
        }
    }, [wallets, navigate, userData]);

    const checkCachedWallets = () => {
        try {
            const cachedWallets = localStorage.getItem('cached_wallets');
            if (cachedWallets) {
                const wallets = JSON.parse(cachedWallets);
                if (wallets.length > 0) {
                    setWallets(wallets);
                    setIsLoading(false);
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking cached wallets:', error);
        }
        return false;
    };

    useEffect(() => {
        if (!hasLoadedWallets.current && !userData) {
            checkCachedWallets();
        }
    }, [userData]);

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        }
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <Header userData={userData} />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading wallets...</p>
                </div>
                <Menu />
            </div>
        );
    }

    return (
        <div className="page-container">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="total-balance-section">
                    <div className="balance-display">
                        <p className="total-balance-label">Total Balance</p>
                        <p className="total-balance-amount">{totalBalance}</p>
                    </div>
                    <button 
                        className="logout-btn"
                        onClick={handleLogout}
                        style={{
                            background: 'rgba(255, 0, 0, 0.1)',
                            color: '#ff5555',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '10px',
                            fontSize: '12px'
                        }}
                    >
                        Logout
                    </button>
                </div>

                <div className="wallet-action-buttons">
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('receive')}
                        disabled={!wallets.length}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↓</span>
                        <span className="wallet-action-btn-text">Receive</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('send')}
                        disabled={!wallets.length}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↑</span>
                        <span className="wallet-action-btn-text">Send</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('earn')}
                    >
                        <span className="wallet-action-btn-icon gold-icon">💰</span>
                        <span className="wallet-action-btn-text">Earn</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('swap')}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↔</span>
                        <span className="wallet-action-btn-text">Swap</span>
                    </button>
                </div>

                {/* Security Section */}
                <div className="security-block">
                    <div className="security-content">
                        <div className="security-icon">🔐</div>
                        <div className="security-text">
                            <h3>Back Up Your Wallet</h3>
                            <p>View your seed phrase to backup wallet</p>
                        </div>
                        <div className="security-arrow">›</div>
                    </div>
                </div>

                <div className="assets-container">
                    {wallets.length > 0 ? (
                        wallets.map((wallet) => (
                            <div 
                                key={`${wallet.id}-${wallet.blockchain}`} 
                                className="token-block"
                                onClick={() => handleTokenClick(wallet)}
                            >
                                <TokenCard wallet={wallet} />
                            </div>
                        ))
                    ) : (
                        <div className="no-wallets-message">
                            <p>No wallets found</p>
                            <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                                Please wait while we initialize your wallets...
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default Wallet;