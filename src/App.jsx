import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

// Импорт компонентов
import History from './Pages/History/History';
import Swap from './Pages/Swap/Swap';
import Wallet from './Pages/Wallet/Wallet';
import TokenDetail from './Pages/Wallet/Subpages/Details/TokenDetail';
import Stake from './Pages/Stake/Stake';
import SendToken from './Pages/Wallet/Subpages/Send/SendToken';
import ReceiveToken from './Pages/Wallet/Subpages/Receive/ReceiveToken';
import BackupSeedPhrase from './Pages/Wallet/Subpages/BackupSeedPhrase/BackupSeedPhrase';
import PinCodeScreen from './assets/PIN/PinCodeScreen';
import { initializeUserWallets } from './Pages/Wallet/Services/walletService';

const AUTH_FUNCTION_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/auth';
const CHECK_PIN_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/check-pin';
const SET_PIN_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/set-pin';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);
    const [isPinVerified, setIsPinVerified] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [pinStatus, setPinStatus] = useState({
        needsPin: true,
        hasPin: false
    });

    // Управление кнопкой BackButton Telegram WebApp
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
            
            const isRootPage = location.pathname === '/' || location.pathname === '/wallet';
            
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

    // Initialize Telegram WebApp
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
                
                setIsActive(webApp.isActive);
                
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
            }
        }
    }, []);

    // User authentication
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
            fetch(AUTH_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ initData }),
            })
            .then(response => response.json())
            .then(async (data) => {
                if (data.isValid && data.userData) {
                    await checkPinStatus(data.userData);
                } else {
                    setIsCheckingAuth(false);
                }
            })
            .catch(error => {
                console.error("App.jsx: Authentication error:", error);
                setIsCheckingAuth(false);
            });
        } else {
            setIsCheckingAuth(false);
        }
    }, []);

    const checkPinStatus = async (userDataFromAuth) => {
        try {
            const response = await fetch(CHECK_PIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: userDataFromAuth.telegram_user_id }),
            });

            const data = await response.json();
            
            if (data.success) {
                setPinStatus({
                    needsPin: data.needsPin,
                    hasPin: data.hasPin
                });
                
                setUserData(userDataFromAuth);
                
                if (!data.needsPin) {
                    await initializeWallets(userDataFromAuth);
                    setIsPinVerified(true);
                }
            }
        } catch (error) {
            console.error("App.jsx: Error checking PIN status:", error);
            setPinStatus({
                needsPin: true,
                hasPin: false
            });
            setUserData(userDataFromAuth);
        } finally {
            setIsCheckingAuth(false);
        }
    };

    const initializeWallets = async (userData) => {
        const initializedUserData = await initializeUserWallets(userData);
        
        if (initializedUserData) {
            setUserData(initializedUserData);
        } else {
            setUserData(userData);
        }
    };

    const handlePinComplete = async (pinCode) => {
        try {
            if (!pinStatus.hasPin) {
                // Создание нового PIN-кода
                const response = await fetch(SET_PIN_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        userId: userData.telegram_user_id, 
                        pinCode 
                    }),
                });

                const data = await response.json();
                
                if (data.success) {
                    await initializeWallets(userData);
                    setIsPinVerified(true);
                    navigate('/wallet');
                } else {
                    throw new Error(data.error || "Failed to create PIN");
                }
            } else {
                // Проверка существующего PIN-кода
                const response = await fetch(CHECK_PIN_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        userId: userData.telegram_user_id, 
                        pinCode 
                    }),
                });

                const data = await response.json();
                
                if (data.success && data.pinVerified) {
                    await initializeWallets(userData);
                    setIsPinVerified(true);
                    navigate('/wallet');
                } else {
                    throw new Error(data.error || "Invalid PIN");
                }
            }
        } catch (error) {
            throw error;
        }
    };

    const handleCancelPin = () => {
        const webApp = window.Telegram?.WebApp;
        if (webApp && webApp.close) {
            webApp.close();
        }
    };

    if (isCheckingAuth) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            }}>
                <div style={{
                    color: 'white',
                    fontSize: '18px',
                    textAlign: 'center'
                }}>
                    Loading...
                </div>
            </div>
        );
    }

    if (userData && !isPinVerified && pinStatus.needsPin) {
        return (
            <PinCodeScreen
                mode={pinStatus.hasPin ? 'enter' : 'create'}
                title={pinStatus.hasPin ? 'Enter Passcode' : 'Create Passcode'}
                message={pinStatus.hasPin 
                    ? 'Enter your passcode to access your wallet' 
                    : 'Create a 4-digit passcode to secure your wallet'}
                onComplete={handlePinComplete}
                onCancel={handleCancelPin}
                showForgotButton={pinStatus.hasPin}
            />
        );
    }


    return (
        <Routes location={location}>
            <Route path="/" element={<Wallet isActive={isActive} userData={userData} />} />
            <Route path="/wallet" element={<Wallet isActive={isActive} userData={userData} />} />
            <Route path="/wallet/token/:symbol" element={<TokenDetail isActive={isActive} userData={userData} />} />
            <Route path="/send" element={<SendToken isActive={isActive} userData={userData} />} />
            <Route path="/receive" element={<ReceiveToken isActive={isActive} userData={userData} />} />
            <Route path="/backup-seed-phrase" element={<BackupSeedPhrase isActive={isActive} userData={userData} />} />
            <Route path="/history" element={<History isActive={isActive} userData={userData} />} />
            <Route path="/swap" element={<Swap isActive={isActive} userData={userData} />} />
            <Route path="/stake" element={<Stake isActive={isActive} userData={userData} />} />
        </Routes>
    );
};

export default App;