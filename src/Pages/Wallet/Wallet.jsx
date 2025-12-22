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
    const [showPinForBackup, setShowPinForBackup] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [contentMargin, setContentMargin] = useState(0);
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

    const updateBalances = useCallback(async (forceUpdate = false, showSkeletonLoading = false) => {
        if (!userData || isUpdatingRef.current) return;

        try {
            const now = Date.now();
            if (!forceUpdate && now - lastRefreshTime.current < MIN_REFRESH_INTERVAL) {
                setIsRefreshing(false);
                setContentMargin(0);
                return;
            }

            isUpdatingRef.current = true;
            
            if ((showSkeletonLoading && isRefreshing) || isInitialLoad) {
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
                    setShowSkeleton(false);
                    setIsRefreshing(false);
                    setContentMargin(0);
                    setIsInitialLoad(false);
                    isUpdatingRef.current = false;
                    return;
                }
            } else {
                allTokens = wallets;
            }

            const updatedWallets = await getBalances(allTokens, userData);
            
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
            
            if (Object.keys(balanceCache.current).length > 0) {
                const cachedWallets = wallets.map(wallet => {
                    const cachedBalance = balanceCache.current[wallet.id];
                    return cachedBalance ? { ...wallet, balance: cachedBalance.balance } : wallet;
                });
                setWallets(cachedWallets);
            }
        } finally {
            loadingTimerRef.current = setTimeout(() => {
                setIsRefreshing(false);
                setShowSkeleton(false);
                setContentMargin(0);
                setIsInitialLoad(false);
                isUpdatingRef.current = false;
                loadingTimerRef.current = null;
            }, 300);
        }
    }, [userData, wallets, isInitialLoad, isRefreshing]);

    useEffect(() => {
        if (userData && !hasInitialized.current) {
            hasInitialized.current = true;
            updateBalances(true, true);
        }
    }, [userData, updateBalances]);

    useEffect(() => {
        if (!userData) return;
        
        const interval = setInterval(() => {
            updateBalances(false, false);
        }, 30000);
        
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
        if (!userData) return;

        if (action === 'receive') {
            navigate('/select-token', { 
                state: { 
                    mode: 'receive',
                    userData: userData 
                } 
            });
        } else if (action === 'send') {
            navigate('/select-token', { 
                state: { 
                    mode: 'send',
                    userData: userData 
                } 
            });
        } else if (action === 'stake') {
            navigate('/stake', { state: { userData } });
        } else if (action === 'swap') {
            navigate('/swap', { state: { userData } });
        }
    }, [navigate, userData]);

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
        updateBalances(true, true);
    };

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
            <Header userData={userData} />

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
                    {showSkeleton && (isInitialLoad || isRefreshing) ? (
                        Array.from({ length: 10 }).map((_, index) => (
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