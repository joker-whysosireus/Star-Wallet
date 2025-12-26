import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../assets/Header/Header";
import Menu from '../../assets/Menus/Menu/Menu';
import TokenCard from './Components/List/TokenCard';
import PinCodeScreen from '../../assets/PIN/PinCodeScreen';
import { 
    getAllTokens,
    getBalances, 
    calculateTotalBalance
} from './Services/storageService';
import './Wallet.css';

function Wallet({ isActive, userData }) {
    const [wallets, setWallets] = useState([]);
    const [testnetWallets, setTestnetWallets] = useState([]);
    const [totalBalance, setTotalBalance] = useState('$0.00');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(true); // Начинаем с true для скелетонов
    const [showPinForBackup, setShowPinForBackup] = useState(false);
    const [contentMargin, setContentMargin] = useState(0);
    const [currentNetwork, setCurrentNetwork] = useState(() => {
        return localStorage.getItem('current_network') || 'mainnet';
    });
    
    const navigate = useNavigate();
    
    const hasInitialized = useRef(false);
    const balanceCache = useRef({});
    const touchStartY = useRef(0);
    const pageContentRef = useRef(null);
    const totalBalanceRef = useRef(null);
    const lastRefreshTime = useRef(0);
    const MIN_REFRESH_INTERVAL = 10000;
    const loadingTimerRef = useRef(null);
    const isUpdatingRef = useRef(false);

    // Инициализация кошельков при монтировании
    const initializeWallets = useCallback(async () => {
        if (!userData) return;

        try {
            setShowSkeleton(true); // Показываем скелетоны при инициализации
            
            // Загружаем кошельки
            let walletsData = [];
            if (currentNetwork === 'mainnet') {
                walletsData = await getAllTokens(userData, false);
                setWallets(walletsData);
                localStorage.setItem('cached_wallets', JSON.stringify(walletsData));
                
                // Обновляем балансы для mainnet
                if (walletsData.length > 0) {
                    const updatedWallets = await getBalances(walletsData, userData);
                    const total = await calculateTotalBalance(updatedWallets);
                    setTotalBalance(`$${total}`);
                    localStorage.setItem('cached_total_balance', `$${total}`);
                }
            } else {
                // Для testnet пытаемся загрузить из API
                try {
                    const response = await fetch('https://star-wallet-backend.netlify.app/.netlify/functions/get-testnet-wallets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ telegram_user_id: userData.telegram_user_id })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.wallets) {
                            setTestnetWallets(data.wallets);
                            localStorage.setItem('cached_testnet_wallets', JSON.stringify(data.wallets));
                        }
                    }
                } catch (error) {
                    console.error('Error loading testnet wallets:', error);
                    // Если ошибка, показываем пустой список
                    setTestnetWallets([]);
                }
            }
            
        } catch (error) {
            console.error('Error initializing wallets:', error);
        } finally {
            // Задержка для отображения скелетонов
            setTimeout(() => {
                setShowSkeleton(false);
            }, 500);
        }
    }, [userData, currentNetwork]);

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

        setupPullToRefresh();
        
        return () => {
            const totalBalanceEl = totalBalanceRef.current;
            if (totalBalanceEl) {
                totalBalanceEl.removeEventListener('touchstart', handleTouchStart);
                totalBalanceEl.removeEventListener('touchmove', handleTouchMove);
                totalBalanceEl.removeEventListener('touchend', handleTouchEnd);
            }
            if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
            }
        };
    }, []);

    // Инициализируем при изменении userData или сети
    useEffect(() => {
        if (userData && !hasInitialized.current) {
            hasInitialized.current = true;
            initializeWallets();
        }
    }, [userData, currentNetwork, initializeWallets]);

    // Обновляем при фокусе страницы
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && userData && currentNetwork === 'mainnet') {
                updateBalances();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [userData, currentNetwork]);

    const setupPullToRefresh = () => {
        const totalBalanceEl = totalBalanceRef.current;
        if (totalBalanceEl) {
            totalBalanceEl.addEventListener('touchstart', handleTouchStart);
            totalBalanceEl.addEventListener('touchmove', handleTouchMove);
            totalBalanceEl.addEventListener('touchend', handleTouchEnd);
        }
    };

    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
        if (touchStartY.current === 0) return;
        
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartY.current;
        
        if (diff > 0) {
            e.preventDefault();
            if (diff > 30) {
                setIsRefreshing(true);
                setContentMargin(50);
            }
        }
    };

    const handleTouchEnd = (e) => {
        const touchY = e.changedTouches[0].clientY;
        const diff = touchY - touchStartY.current;
        
        if (diff > 50) {
            handleRefresh();
        } else {
            setIsRefreshing(false);
            setContentMargin(0);
        }
        touchStartY.current = 0;
    };

    const updateBalances = useCallback(async () => {
        if (!userData || isUpdatingRef.current || currentNetwork === 'testnet') return;

        try {
            const now = Date.now();
            if (now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
                return;
            }

            isUpdatingRef.current = true;
            lastRefreshTime.current = now;
            
            console.log('Updating wallet balances...');
            
            const updatedWallets = await getBalances(wallets, userData);
            
            updatedWallets.forEach(wallet => {
                balanceCache.current[wallet.id] = {
                    balance: wallet.balance,
                    timestamp: Date.now()
                };
            });
            
            setWallets(updatedWallets);
            localStorage.setItem('cached_wallets', JSON.stringify(updatedWallets));
            
            const total = await calculateTotalBalance(updatedWallets);
            setTotalBalance(`$${total}`);
            localStorage.setItem('cached_total_balance', `$${total}`);
            
            console.log('Balances updated successfully');
            
        } catch (error) {
            console.error('Error updating balances:', error);
        } finally {
            isUpdatingRef.current = false;
        }
    }, [userData, wallets, currentNetwork]);

    const handleTokenClick = useCallback((wallet) => {
        if (wallet && wallet.symbol) {
            navigate(`/wallet/token/${wallet.symbol}`, { 
                state: { 
                    ...wallet,
                    blockchain: wallet.blockchain,
                    userData: userData,
                    isTestnet: wallet.isTestnet || false
                }
            });
        }
    }, [navigate, userData]);

    const handleActionClick = useCallback((action) => {
        if (!userData) return;

        if (action === 'receive') {
            navigate('/select-token', { 
                state: { 
                    mode: 'receive',
                    userData: userData,
                    network: currentNetwork
                } 
            });
        } else if (action === 'send') {
            navigate('/select-token', { 
                state: { 
                    mode: 'send',
                    userData: userData,
                    network: currentNetwork
                } 
            });
        } else if (action === 'stake') {
            navigate('/stake', { state: { userData } });
        } else if (action === 'swap') {
            navigate('/swap', { state: { userData } });
        }
    }, [navigate, userData, currentNetwork]);

    const handleBackupClick = () => {
        setShowPinForBackup(true);
    };

    const handlePinVerified = (pin) => {
        setShowPinForBackup(false);
        navigate('/backup-seed-phrase', { state: { userData } });
    };

    const handlePinCreated = (pin) => {
        setShowPinForBackup(false);
        navigate('/backup-seed-phrase', { state: { userData } });
    };

    const handleRefresh = () => {
        setShowSkeleton(true);
        initializeWallets();
        setTimeout(() => {
            setIsRefreshing(false);
            setContentMargin(0);
        }, 1000);
    };

    const handleNetworkChange = (network) => {
        setCurrentNetwork(network);
        localStorage.setItem('current_network', network);
        setShowSkeleton(true);
        
        // Сбрасываем флаг инициализации для загрузки новых кошельков
        hasInitialized.current = false;
        
        // Даем время на анимацию смены сети
        setTimeout(() => {
            initializeWallets();
        }, 300);
    };

    const currentWallets = currentNetwork === 'mainnet' ? wallets : testnetWallets;
    const displayTotalBalance = currentNetwork === 'mainnet' ? totalBalance : '$0.00';

    if (showPinForBackup) {
        return (
            <PinCodeScreen
                userData={userData}
                onPinVerified={handlePinVerified}
                onPinCreated={handlePinCreated}
                mode="verify"
            />
        );
    }

    return (
        <div className="wallet-page-wallet">
            <Header 
                userData={userData} 
                onNetworkChange={handleNetworkChange}
                currentNetwork={currentNetwork}
            />

            <div 
                className="page-content" 
                ref={pageContentRef}
                style={{ marginTop: contentMargin }}
            >
                <div 
                    className="total-balance-section" 
                    ref={totalBalanceRef}
                >
                    {isRefreshing && (
                        <div className="bars-spinner">
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                            <div className="bars-spinner-bar"></div>
                        </div>
                    )}
                    <div className="balance-display">
                        <p className="total-balance-label">TOTAL BALANCE</p>
                        {showSkeleton ? (
                            <div className="skeleton-loader skeleton-total-balance"></div>
                        ) : (
                            <p className="total-balance-amount">{displayTotalBalance}</p>
                        )}
                    </div>
                </div>

                <div className="wallet-action-buttons">
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('receive')}
                        disabled={isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↓</span>
                        <span className="wallet-action-btn-text">Receive</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('send')}
                        disabled={isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↑</span>
                        <span className="wallet-action-btn-text">Send</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('stake')}
                        disabled={isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">💰</span>
                        <span className="wallet-action-btn-text">Stake</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('swap')}
                        disabled={isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↔</span>
                        <span className="wallet-action-btn-text">Swap</span>
                    </button>
                </div>

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
                    {showSkeleton || isRefreshing ? (
                        Array.from({ length: 13 }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="token-block"
                                style={{ height: '68px', background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <div className="token-card">
                                    <div className="token-left">
                                        <div className="token-icon skeleton-loader"></div>
                                        <div className="token-names">
                                            <div className="skeleton-loader" style={{ height: '14px', width: '80px', marginBottom: '6px' }}></div>
                                            <div className="skeleton-loader" style={{ height: '18px', width: '60px' }}></div>
                                        </div>
                                    </div>
                                    <div className="token-right">
                                        <div className="skeleton-loader skeleton-token-balance"></div>
                                        <div className="skeleton-loader skeleton-usd-balance"></div>
                                        <div className="skeleton-loader" style={{ height: '12px', width: '40px', marginTop: '4px' }}></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : currentWallets.length > 0 ? (
                        currentWallets.map((wallet) => (
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
                            <p className="refresh-hint">Pull down to refresh</p>
                        </div>
                    )}
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default Wallet;