import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../assets/Header/Header";
import Menu from '../../assets/Menus/Menu/Menu';
import TokenCard from './Components/List/TokenCard';
import { 
    getAllTokens,
    getBalances, 
    calculateTotalBalance
} from './Services/storageService';
import BackupSeedPhrase from './Subpages/BackupSeedPhrase/BackupSeedPhrase';
import './Wallet.css';

function Wallet({ isActive, userData }) {
    const [wallets, setWallets] = useState([]);
    const [totalBalance, setTotalBalance] = useState('$0.00');
    const [showBackupPage, setShowBackupPage] = useState(false);
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
                console.log('No user data available');
                return;
            }

            console.log('Initializing wallets for user:', userData.telegram_user_id);
            
            // Получаем все токены пользователя
            const allTokens = await getAllTokens(userData);
            
            if (!Array.isArray(allTokens) || allTokens.length === 0) {
                console.log('No tokens found for user');
                setWallets([]);
                return;
            }

            console.log('Found tokens:', allTokens.length);
            
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
                
                console.log('Balances updated successfully');
            } catch (balanceError) {
                console.error('Error updating balances:', balanceError);
                
                // Используем fallback расчет
                const prices = {
                    'TON': 6.24,
                    'SOL': 172.34,
                    'ETH': 3500.00,
                    'USDT': 1.00,
                    'USDC': 1.00,
                    'TRX': 0.12,
                    'BTC': 68000.00
                };
                
                const total = allTokens.reduce((sum, wallet) => {
                    const price = prices[wallet.symbol] || 1.00;
                    return sum + (parseFloat(wallet.balance || 0) * price);
                }, 0);
                
                setTotalBalance(`$${total.toFixed(2)}`);
            }
            
        } catch (error) {
            console.error('Error initializing wallets:', error);
            setWallets([]);
        }
    }, [userData]);

    useEffect(() => {
        if (!hasLoadedWallets.current && userData) {
            initializeWallets();
            hasLoadedWallets.current = true;
        }
    }, [initializeWallets, userData]);

    const handleTokenClick = useCallback((wallet) => {
        if (wallet && wallet.symbol) {
            navigate(`/wallet/token/${wallet.symbol}`, { 
                state: { 
                    ...wallet,
                    blockchain: wallet.blockchain,
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
            } else {
                navigate('/wallet/token/' + wallets[0].symbol, { 
                    state: { 
                        ...wallets[0],
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
            } else {
                navigate('/wallet/token/' + wallets[0].symbol, { 
                    state: { 
                        ...wallets[0],
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
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking cached wallets:', error);
        }
        return false;
    };

    useEffect(() => {
        if (!hasLoadedWallets.current) {
            checkCachedWallets();
        }
    }, []);

    const handleBackupClick = () => {
        setShowBackupPage(true);
    };

    const handleBackToWallet = () => {
        setShowBackupPage(false);
    };

    // Если показываем страницу BackupSeedPhrase
    if (showBackupPage) {
        return (
            <BackupSeedPhrase 
                userData={userData} 
                onBack={handleBackToWallet}
            />
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
                <div 
                    className="security-block"
                    onClick={handleBackupClick}
                    style={{ cursor: 'pointer' }}
                >
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