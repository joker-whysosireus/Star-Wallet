// src/Pages/Wallet/Wallet.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../assets/Header/Header";
import Menu from "../../assets/Menus/Menu/Menu";
import TokenCard from './Components/TokenCard';
import { 
    generateWallets, 
    getBalances, 
    calculateTotalBalance,
    getAllTokens
} from './Services/storageService';
import './Wallet.css';

function Wallet({ isActive, userData, updateUserData }) {
    const [wallets, setWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalBalance, setTotalBalance] = useState('$0.00');
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
        console.log('initializeWallets called');
        setIsLoading(true);
        
        try {
            console.log('Generating or loading wallets...');
            const walletsData = await generateWallets();
            
            // ИСПРАВЛЕНИЕ: getAllTokens() возвращает массив напрямую, без await
            const allTokens = getAllTokens();
            
            console.log('allTokens loaded:', allTokens);
            
            // Проверяем, что allTokens - массив
            if (!Array.isArray(allTokens)) {
                console.error('allTokens is not an array:', allTokens);
                setWallets([]);
                setIsLoading(false);
                return;
            }
            
            const addressMap = {};
            if (walletsData && walletsData.wallets) {
                walletsData.wallets.forEach(wallet => {
                    addressMap[wallet.blockchain] = wallet.address;
                });
            }
            
            const allWallets = allTokens.map(token => {
                const address = addressMap[token.blockchain] || '';
                
                return {
                    id: token.id,
                    name: token.name,
                    symbol: token.symbol,
                    address: address,
                    blockchain: token.blockchain,
                    balance: '0',
                    isActive: true,
                    decimals: token.decimals,
                    logo: token.logo,
                    isNative: token.isNative,
                    contractAddress: token.contractAddress,
                    showBlockchain: true
                };
            });
            
            console.log('All wallets created:', allWallets.length);
            setWallets(allWallets);
            
            localStorage.setItem('cached_wallets', JSON.stringify(allWallets));
            
            // Обновляем балансы
            try {
                console.log('Fetching balances for all wallets...');
                const updatedWallets = await getBalances(allWallets);
                setWallets(updatedWallets);
                
                const total = await calculateTotalBalance(updatedWallets);
                setTotalBalance(`$${total}`);
            } catch (balanceError) {
                console.error('Error updating balances:', balanceError);
                const total = allWallets.reduce((sum, wallet) => {
                    const price = getTokenPrice(wallet.symbol);
                    return sum + (parseFloat(wallet.balance || 0) * price);
                }, 0);
                setTotalBalance(`$${total.toFixed(2)}`);
            }
            
        } catch (error) {
            console.error('Error initializing wallets:', error);
            setWallets([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getTokenPrice = (symbol) => {
        const prices = {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00
        };
        return prices[symbol] || 1.00;
    };

    useEffect(() => {
        if (!hasLoadedWallets.current) {
            initializeWallets();
            hasLoadedWallets.current = true;
        }
    }, [initializeWallets]);

    const handleShowSeedPhrase = useCallback(async () => {
        const hasPin = localStorage.getItem('wallet_pin_set');
        if (!hasPin) {
            navigate('/wallet/setup-pin');
        } else {
            navigate('/wallet/enter-pin');
        }
    }, [navigate]);

    const handleTokenClick = useCallback((wallet) => {
        if (wallet && wallet.symbol) {
            navigate(`/wallet/token/${wallet.symbol}`, { 
                state: { 
                    ...wallet,
                    blockchain: wallet.blockchain
                }
            });
        }
    }, [navigate]);

    const handleActionClick = useCallback((action) => {
        if (action === 'receive') {
            if (wallets.length > 0) {
                const firstWallet = wallets.find(w => w.address);
                if (firstWallet) {
                    alert(`Address to receive ${firstWallet.symbol}:\n\n${firstWallet.address}`);
                } else {
                    alert('No wallet address available');
                }
            } else {
                alert('Please wait for wallets to load');
            }
        } else if (action === 'send') {
            if (wallets.length > 0) {
                const firstWallet = wallets.find(w => w.address);
                if (firstWallet) {
                    navigate(`/wallet/token/${firstWallet.symbol}`, { 
                        state: firstWallet
                    });
                } else {
                    alert('No wallet available');
                }
            } else {
                alert('Please wait for wallets to load');
            }
        } else if (action === 'earn') {
            navigate('/stake');
        } else if (action === 'swap') {
            navigate('/swap');
        }
    }, [wallets, navigate]);

    useEffect(() => {
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
                console.error('Error parsing cached wallets:', error);
            }
            return false;
        };
        
        if (!hasLoadedWallets.current) {
            checkCachedWallets();
        }
    }, []);

    if (isLoading && wallets.length === 0) {
        return (
            <div className="wallet-page">
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
        <div className="wallet-page">
            <Header userData={userData} />

            <div className="page-content">
                <div className="total-balance-section">
                    <div className="balance-display">
                        <p className="total-balance-label">Total Balance</p>
                        <p className="total-balance-amount">{totalBalance}</p>
                    </div>
                </div>

                <div className="wallet-action-buttons">
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('receive')}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↓</span>
                        <span className="wallet-action-btn-text">Receive</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('send')}
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

                <div 
                    className="security-block"
                    onClick={handleShowSeedPhrase}
                >
                    <div className="security-content">
                        <div className="security-icon">🔐</div>
                        <div className="security-text">
                            <h3>Backup your wallet</h3>
                            <p>View your seed phrase and set up PIN code</p>
                        </div>
                        <div className="security-arrow">›</div>
                    </div>
                </div>

                <div className="assets-container">
                    {wallets.length > 0 ? (
                        wallets.map((wallet) => (
                            <div 
                                key={wallet.id} 
                                className="token-block"
                                onClick={() => handleTokenClick(wallet)}
                            >
                                <TokenCard wallet={wallet} />
                            </div>
                        ))
                    ) : (
                        <div className="no-wallets-message">
                            <p>No wallets found</p>
                        </div>
                    )}
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default Wallet;