import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import History from './Pages/History/History';
import Swap from './Pages/Swap/Swap';
import Wallet from './Pages/Wallet/Wallet';
import TokenDetail from './Pages/Wallet/Subpages/Details/TokenDetail';
import Stake from './Pages/Stake/Stake';
import SendToken from './Pages/Wallet/Subpages/Send/SendToken';
import ReceiveToken from './Pages/Wallet/Subpages/Receive/ReceiveToken';
import BackupSeedPhrase from './Pages/Wallet/Subpages/BackupSeedPhrase/BackupSeedPhrase';
import PinCodeScreen from './assets/PIN/PinCodeScreen.jsx';
import Loader from './assets/Loader/Loader.jsx';
import { initializeUserWallets } from './Pages/Wallet/Services/walletService';

const AUTH_FUNCTION_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/auth';
const VERIFY_PIN_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/verify-pin';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);
    const [showPinScreen, setShowPinScreen] = useState(false);
    const [pinMode, setPinMode] = useState('verify');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true); // Добавляем состояние загрузки

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
            
            const isRootPage = location.pathname === '/' || 
                             location.pathname === '/wallet';
            
            if (isRootPage) {
                webApp.BackButton.hide();
            } else {
                webApp.BackButton.show();
                webApp.BackButton.onClick(() => {
                    navigate(-1);
                });
            }
            
            return () => {
                webApp.BackButton.offClick();
            };
        }
    }, [location, navigate]);

    useEffect(() => {
        const isTelegramWebApp = () => {
            try {
                return window.Telegram && window.Telegram.WebApp;
            } catch (e) {
                return false;
            }
        };

        if (isTelegramWebApp()) {
            try {
                const webApp = window.Telegram.WebApp;
                
                webApp.isVerticalSwipesEnabled = false;
                
                if (webApp.disableSwipeToClose) {
                    webApp.disableSwipeToClose();
                }

                if (webApp.expand) {
                    webApp.expand();
                }
                
                if (webApp.enableClosingConfirmation) {
                    webApp.enableClosingConfirmation();
                }
                
                if (webApp.requestFullscreen) {
                    webApp.requestFullscreen();
                }
                
                setIsActive(webApp.isActive);
                
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
            }
        }
    }, []);

    useEffect(() => {
        const getInitData = () => {
            try {
                return window.Telegram?.WebApp?.initData || '';
            } catch (e) {
                return '';
            }
        };

        const initData = getInitData();

        if (initData) {
            const authPromise = fetch(AUTH_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ initData }),
            });

            authPromise
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(async (data) => {
                    if (data.isValid && data.userData) {
                        setUserData(data.userData);
                        await checkPinStatus(data.userData);
                    } else {
                        setIsLoading(false);
                    }
                })
                .catch(error => {
                    console.error("App.jsx: Authentication error:", error);
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    const checkPinStatus = async (userData) => {
        try {
            const response = await fetch(VERIFY_PIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    pin_code: '0000'
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.pinNotSet) {
                setPinMode('create');
                setShowPinScreen(true);
            } else {
                setPinMode('verify');
                setShowPinScreen(true);
            }
            
        } catch (error) {
            setShowPinScreen(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePinVerified = async (pin) => {
        setIsAuthenticated(true);
        setShowPinScreen(false);
        
        if (userData) {
            try {
                const initializedUserData = await initializeUserWallets(userData);
                if (initializedUserData) {
                    setUserData(initializedUserData);
                }
            } catch (error) {
                console.error("App.jsx: Error initializing wallets:", error);
            }
        }
    };

    const handlePinCreated = async (pin) => {
        setIsAuthenticated(true);
        setShowPinScreen(false);
        
        if (userData) {
            try {
                const initializedUserData = await initializeUserWallets(userData);
                if (initializedUserData) {
                    setUserData(initializedUserData);
                }
            } catch (error) {
                console.error("App.jsx: Error initializing wallets:", error);
            }
        }
    };

    // Показываем Loader во время загрузки
    if (isLoading) {
        return <Loader />;
    }

    if (showPinScreen && userData) {
        return (
            <PinCodeScreen
                userData={userData}
                onPinVerified={handlePinVerified}
                onPinCreated={handlePinCreated}
                mode={pinMode}
            />
        );
    }

    if (isAuthenticated && userData) {
        return (
            <Routes location={location}>
                <Route path="/" element={
                    <Wallet isActive={isActive} userData={userData} />
                } />
                
                <Route path="/wallet" element={
                    <Wallet isActive={isActive} userData={userData} />
                } />
                
                <Route path="/wallet/token/:symbol" element={
                    <TokenDetail isActive={isActive} userData={userData} />
                } />
                
                <Route path="/send" element={
                    <SendToken isActive={isActive} userData={userData} />
                } />
                
                <Route path="/receive" element={
                    <ReceiveToken isActive={isActive} userData={userData} />
                } />
                
                <Route path="/backup-seed-phrase" element={
                    <BackupSeedPhrase isActive={isActive} userData={userData} />
                } />
                
                <Route path="/history" element={
                    <History isActive={isActive} userData={userData} />
                } />
                
                <Route path="/swap" element={
                    <Swap isActive={isActive} userData={userData} />
                } />
                
                <Route path="/stake" element={
                    <Stake isActive={isActive} userData={userData} />
                } />
            </Routes>
        );
    }

    return null;
};

export default App;