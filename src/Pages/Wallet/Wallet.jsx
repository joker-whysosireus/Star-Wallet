import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from "../../assets/Header/Header";
import Menu from '../../assets/Menus/Menu/Menu';
import TokenCard from './Components/List/TokenCard';
import ExpandableTokenCard from './Components/ExpandableTokenCard/ExpandableTokenCard';
import PinCodeScreen from '../../assets/PIN/PinCodeScreen';
import { 
    getAllTokens,
    getBalances, 
    calculateTotalBalance,
    getTokenPrices
} from './Services/storageService';
import './Wallet.css';

function Wallet({ isActive, userData }) {
    const [currentNetwork, setCurrentNetwork] = useState(() => {
        const savedNetwork = localStorage.getItem('selected_network');
        return savedNetwork || 'mainnet';
    });
    
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

    // Функция для фильтрации токенов - USDT/USDC не показываются как отдельные
    const filterDisplayTokens = useCallback((allTokens) => {
        // Фильтруем токены: не показываем USDT/USDC как отдельные, если они входят в expandable блок
        const filtered = allTokens.filter(token => {
            // Для Solana, Ethereum, Tron, TON не показываем USDT/USDC как отдельные
            if (['Solana', 'Ethereum', 'Tron', 'TON'].includes(token.blockchain)) {
                // Показываем только нативные токены и USDT/USDC только внутри expandable
                return token.isNative || !['USDT', 'USDC'].includes(token.symbol);
            }
            // Для остальных блокчейнов показываем все
            return true;
        });
        
        return filtered;
    }, []);

    // Функция для получения связанных токенов (USDT/USDC) для главного токена
    const getRelatedTokens = useCallback((mainToken, allTokens) => {
        if (!['Solana', 'Ethereum', 'Tron', 'TON'].includes(mainToken.blockchain)) {
            return [];
        }
        
        // Ищем USDT и USDC для этого блокчейна
        return allTokens.filter(token => 
            token.blockchain === mainToken.blockchain && 
            ['USDT', 'USDC'].includes(token.symbol)
        );
    }, []);

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

    const updateBalances = useCallback(async (forceUpdate = false, showSkeletonLoading = false, network = currentNetwork) => {
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
            
            console.log(`Updating ${network} wallet balances with real data...`);
            
            let allTokens = [];
            if (wallets.length === 0 || forceUpdate || wallets[0]?.network !== network) {
                allTokens = await getAllTokens(userData, network);
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

            const updatedWallets = await getBalances(allTokens);
            
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
            
            console.log(`${network} balances updated successfully with real data`);
            
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
    }, [userData, wallets, isInitialLoad, isRefreshing, currentNetwork]);

    useEffect(() => {
        if (userData && !hasInitialized.current) {
            hasInitialized.current = true;
            updateBalances(true, true, currentNetwork);
        }
    }, [userData, updateBalances, currentNetwork]);

    useEffect(() => {
        if (!userData) return;
        
        const interval = setInterval(() => {
            updateBalances(false, false, currentNetwork);
        }, 30000);
        
        return () => clearInterval(interval);
    }, [userData, currentNetwork, updateBalances]);

    // Добавьте этот useEffect для обновления цен каждую минуту
    useEffect(() => {
        if (!userData) return;
        
        const priceUpdateInterval = setInterval(async () => {
            // Обновляем цены и пересчитываем балансы
            const prices = await getTokenPrices();
            console.log('Token prices updated:', prices);
            
            // Обновляем отображение балансов
            updateBalances(false, false, currentNetwork);
        }, 60000); // Каждую минуту
        
        return () => clearInterval(priceUpdateInterval);
    }, [userData, currentNetwork, updateBalances]);

    const handleTokenClick = useCallback((wallet) => {
        if (wallet && wallet.symbol) {
            navigate(`/wallet/token/${wallet.symbol}`, { 
                state: { 
                    ...wallet,
                    blockchain: wallet.blockchain,
                    userData: userData,
                    network: currentNetwork
                }
            });
        }
    }, [navigate, userData, currentNetwork]);

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
            navigate('/stake', { state: { userData, network: currentNetwork } });
        } else if (action === 'swap') {
            navigate('/swap', { state: { userData, network: currentNetwork } });
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
        updateBalances(true, true, currentNetwork);
    };

    const handleNetworkChange = (newNetwork) => {
        localStorage.setItem('selected_network', newNetwork);
        setCurrentNetwork(newNetwork);
        setWallets([]);
        localStorage.removeItem('cached_wallets');
        localStorage.removeItem('cached_total_balance');
        updateBalances(true, true, newNetwork);
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

    // Фильтруем токены для отображения
    const displayTokens = filterDisplayTokens(wallets);

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
                        <div className="circular-spinner">
                            <div className="spinner"></div>
                        </div>
                    )}
                    <div className="balance-display">
                        <p className="total-balance-label">Total Balance</p>
                        <div className="balance-amount-container">
                            {showSkeleton ? (
                                <div className="skeleton-loader skeleton-total-balance"></div>
                            ) : (
                                <p className="total-balance-amount">{totalBalance}</p>
                            )}
                        </div>
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
                                            <div className="skeleton-loader" style={{ height: '12px', width: '50px', marginTop: '2px' }}></div>
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
                    ) : displayTokens.length > 0 ? (
                        displayTokens.map((wallet) => {
                            // Определяем связанные токены USDT/USDC только для нативных токенов
                            let relatedTokens = [];
                            
                            if (['Solana', 'Ethereum', 'Tron', 'TON'].includes(wallet.blockchain) && 
                                ['SOL', 'ETH', 'TRX', 'TON'].includes(wallet.symbol)) {
                                
                                relatedTokens = getRelatedTokens(wallet, wallets);
                            }
                            
                            return (
                                <div 
                                    key={wallet.id} 
                                    className="token-block"
                                >
                                    {relatedTokens.length > 0 ? (
                                        <ExpandableTokenCard 
                                            wallet={wallet}
                                            network={currentNetwork}
                                            relatedTokens={relatedTokens}
                                            onTokenClick={handleTokenClick}
                                        />
                                    ) : (
                                        <div onClick={() => handleTokenClick(wallet)}>
                                            <TokenCard wallet={wallet} network={currentNetwork} />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-wallets-message">
                            <p>{currentNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'} wallets loading...</p>
                        </div>
                    )}
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default Wallet;