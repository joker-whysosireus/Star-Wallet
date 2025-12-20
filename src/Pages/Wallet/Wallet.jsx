import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    const [wallets, setWallets] = useState(() => {
        const cached = localStorage.getItem('cached_wallets');
        return cached ? JSON.parse(cached) : [];
    });
    
    const [totalBalance, setTotalBalance] = useState(() => {
        const cachedBalance = localStorage.getItem('cached_total_balance');
        return cachedBalance || '$0.00';
    });
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [showBackupPage, setShowBackupPage] = useState(false);
    const navigate = useNavigate();
    
    const hasInitialized = useRef(false);
    const balanceCache = useRef({});
    const touchStartY = useRef(0);
    const pageContentRef = useRef(null);
    const lastRefreshTime = useRef(0);
    const MIN_REFRESH_INTERVAL = 10000; // 10 секунд

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

        // Добавляем обработчики для pull-to-refresh
        setupPullToRefresh();
        
        return () => {
            // Очищаем обработчики
            const pageContent = pageContentRef.current;
            if (pageContent) {
                pageContent.removeEventListener('touchstart', handleTouchStart);
                pageContent.removeEventListener('touchmove', handleTouchMove);
                pageContent.removeEventListener('touchend', handleTouchEnd);
            }
        };
    }, []);

    const setupPullToRefresh = () => {
        const pageContent = pageContentRef.current;
        if (pageContent) {
            pageContent.addEventListener('touchstart', handleTouchStart);
            pageContent.addEventListener('touchmove', handleTouchMove);
            pageContent.addEventListener('touchend', handleTouchEnd);
        }
    };

    const handleTouchStart = (e) => {
        if (pageContentRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
        }
    };

    const handleTouchMove = (e) => {
        if (touchStartY.current === 0) return;
        
        const touchY = e.touches[0].clientY;
        const diff = touchY - touchStartY.current;
        
        if (diff > 0 && pageContentRef.current.scrollTop === 0) {
            e.preventDefault();
            // Показываем индикатор обновления при достаточном свайпе
            if (diff > 50) {
                const indicator = document.querySelector('.refresh-indicator');
                if (indicator) {
                    indicator.style.opacity = '1';
                    indicator.style.transform = 'translateY(0)';
                }
            }
        }
    };

    const handleTouchEnd = (e) => {
        const touchY = e.changedTouches[0].clientY;
        const diff = touchY - touchStartY.current;
        
        if (diff > 100 && pageContentRef.current.scrollTop === 0) {
            // Запускаем обновление при достаточном свайпе
            handleRefresh();
        }
        
        // Скрываем индикатор
        const indicator = document.querySelector('.refresh-indicator');
        if (indicator) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(-50px)';
        }
        touchStartY.current = 0;
    };

    // Функция для обновления балансов
    const updateBalances = useCallback(async (forceUpdate = false, showLoading = true) => {
        if (!userData) return;

        try {
            const now = Date.now();
            if (!forceUpdate && now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
                return; // Слишком рано для обновления
            }

            if (showLoading) {
                setIsRefreshing(true);
                setShowSkeleton(true);
            }
            
            lastRefreshTime.current = now;
            
            console.log('Updating wallet balances...');
            
            let allTokens = [];
            if (wallets.length === 0 || forceUpdate) {
                allTokens = await getAllTokens(userData);
                if (!Array.isArray(allTokens) || allTokens.length === 0) {
                    setWallets([]);
                    localStorage.setItem('cached_wallets', JSON.stringify([]));
                    if (showLoading) {
                        setIsRefreshing(false);
                        setShowSkeleton(false);
                    }
                    return;
                }
            } else {
                allTokens = wallets;
            }

            const updatedWallets = await getBalances(allTokens, userData);
            
            // Обновляем кэш
            updatedWallets.forEach(wallet => {
                balanceCache.current[wallet.id] = {
                    balance: wallet.balance,
                    timestamp: Date.now()
                };
            });
            
            setWallets(updatedWallets);
            localStorage.setItem('cached_wallets', JSON.stringify(updatedWallets));
            
            // Рассчитываем общий баланс
            const total = await calculateTotalBalance(updatedWallets);
            setTotalBalance(`$${total}`);
            localStorage.setItem('cached_total_balance', `$${total}`);
            
            console.log('Balances updated successfully');
            
        } catch (error) {
            console.error('Error updating balances:', error);
            
            // Используем кэшированные данные при ошибке
            if (Object.keys(balanceCache.current).length > 0) {
                const cachedWallets = wallets.map(wallet => {
                    const cachedBalance = balanceCache.current[wallet.id];
                    return cachedBalance ? { ...wallet, balance: cachedBalance.balance } : wallet;
                });
                setWallets(cachedWallets);
            }
        } finally {
            if (showLoading) {
                setTimeout(() => {
                    setIsRefreshing(false);
                    setShowSkeleton(false);
                }, 500); // Небольшая задержка для плавности
            }
        }
    }, [userData, wallets]);

    // Инициализация при монтировании
    useEffect(() => {
        if (userData && !hasInitialized.current) {
            hasInitialized.current = true;
            updateBalances(true, true); // Принудительное обновление при первой загрузке
        }
    }, [userData, updateBalances]);

    // Периодическое обновление балансов (в фоне)
    useEffect(() => {
        if (!userData) return;
        
        const interval = setInterval(() => {
            updateBalances(false, false); // Фоновое обновление без скелетонов
        }, 30000); // Обновляем каждые 30 секунд
        
        return () => clearInterval(interval);
    }, [userData, updateBalances]);

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

        const firstWallet = wallets.find(w => w.address) || wallets[0];
        
        if (action === 'receive') {
            navigate('/receive', { 
                state: { 
                    wallet: firstWallet,
                    userData: userData 
                } 
            });
        } else if (action === 'send') {
            navigate('/send', { 
                state: { 
                    wallet: firstWallet,
                    userData: userData 
                } 
            });
        } else if (action === 'earn') {
            navigate('/stake', { state: { userData } });
        } else if (action === 'swap') {
            navigate('/swap', { state: { userData } });
        }
    }, [wallets, navigate, userData]);

    const handleBackupClick = () => {
        setShowBackupPage(true);
    };

    const handleBackToWallet = () => {
        setShowBackupPage(false);
    };

    // Функция для обновления по pull-to-refresh
    const handleRefresh = () => {
        updateBalances(true, true);
    };

    if (showBackupPage) {
        return (
            <BackupSeedPhrase 
                userData={userData} 
                onBack={handleBackToWallet}
            />
        );
    }

    return (
        <div className="page-container-sw">
            <Header userData={userData} />

            <div className="refresh-indicator">
                <div className="refresh-spinner">
                    <div className="spinner"></div>
                </div>
            </div>

            <div className="page-content" ref={pageContentRef}>
                <div className="total-balance-section">
                    <div className="balance-display">
                        <p className="total-balance-label">Total Balance</p>
                        {showSkeleton ? (
                            <div className="skeleton-loader skeleton-total-balance"></div>
                        ) : (
                            <p className="total-balance-amount">{totalBalance}</p>
                        )}
                    </div>
                </div>

                <div className="wallet-action-buttons">
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('receive')}
                        disabled={!wallets.length || isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↓</span>
                        <span className="wallet-action-btn-text">Receive</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('send')}
                        disabled={!wallets.length || isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">↑</span>
                        <span className="wallet-action-btn-text">Send</span>
                    </button>
                    <button 
                        className="wallet-action-btn"
                        onClick={() => handleActionClick('earn')}
                        disabled={isRefreshing}
                    >
                        <span className="wallet-action-btn-icon gold-icon">💰</span>
                        <span className="wallet-action-btn-text">Earn</span>
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
                    {showSkeleton ? (
                        // Показываем скелетоны во время загрузки
                        Array.from({ length: Math.max(wallets.length, 10) }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="token-block"
                                style={{ height: '68px', background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <div className="token-card">
                                    <div className="token-left">
                                        <div className="token-icon skeleton-loader" style={{ background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                        <div className="token-names">
                                            <div className="skeleton-loader" style={{ height: '14px', width: '80px', marginBottom: '6px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                            <div className="skeleton-loader" style={{ height: '18px', width: '60px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                        </div>
                                    </div>
                                    <div className="token-right">
                                        <div className="skeleton-loader skeleton-token-balance"></div>
                                        <div className="skeleton-loader skeleton-usd-balance"></div>
                                        <div className="skeleton-loader" style={{ height: '12px', width: '40px', marginTop: '4px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : wallets.length > 0 ? (
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