// Pages/Wallet/Wallet.jsx
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
import './Wallet.css';

function Wallet({ isActive, userData }) {
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
                console.log('No user data available');
                setIsLoading(false);
                return;
            }

            console.log('Initializing wallets with user data:', userData);
            
            // Получаем все токены для пользователя
            const allTokens = await getAllTokens(userData);
            
            if (!Array.isArray(allTokens)) {
                setWallets([]);
                setIsLoading(false);
                return;
            }
            
            // Получаем балансы токенов
            const walletsWithBalances = await getBalances(allTokens, userData);
            setWallets(walletsWithBalances);
            
            // Рассчитываем общий баланс
            const total = await calculateTotalBalance(walletsWithBalances);
            setTotalBalance(`$${total}`);
            
            console.log(`Loaded ${walletsWithBalances.length} wallets for user`);
            
        } catch (error) {
            console.error('Error initializing wallets:', error);
            setWallets([]);
        } finally {
            setIsLoading(false);
        }
    }, [userData]);

    useEffect(() => {
        if (userData && !hasLoadedWallets.current) {
            initializeWallets();
            hasLoadedWallets.current = true;
        }
    }, [userData, initializeWallets]);

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
        if (wallets.length === 0) return;

        const firstWallet = wallets.find(w => w.address);
        
        if (!firstWallet) {
            console.log('No wallet with address found');
            return;
        }

        switch (action) {
            case 'receive':
                navigate('/receive', { 
                    state: { 
                        wallet: firstWallet,
                        userData: userData
                    } 
                });
                break;
            case 'send':
                navigate('/send', { 
                    state: { 
                        wallet: firstWallet,
                        userData: userData
                    } 
                });
                break;
            case 'earn':
                navigate('/stake');
                break;
            case 'swap':
                navigate('/swap', { state: { userData } });
                break;
            default:
                break;
        }
    }, [wallets, navigate, userData]);

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
                            <button 
                                onClick={initializeWallets}
                                className="retry-button"
                            >
                                Retry Loading
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default Wallet;