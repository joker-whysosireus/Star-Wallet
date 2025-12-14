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
    const [authStatus, setAuthStatus] = useState('checking'); // 'checking', 'auth_failed', 'pin_required', 'ready'
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
        const initData = window.Telegram?.WebApp?.initData || '';

        if (!initData) {
            setAuthStatus('auth_failed');
            return;
        }

        fetch(AUTH_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ initData }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(async (data) => {
            if (data.isValid && data.userData) {
                await checkPinStatus(data.userData);
            } else {
                setAuthStatus('auth_failed');
            }
        })
        .catch(error => {
            console.error("App.jsx: Authentication error:", error);
            setAuthStatus('auth_failed');
        });
    }, []);

    const checkPinStatus = async (userDataFromAuth) => {
        try {
            const response = await fetch(CHECK_PIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    userId: userDataFromAuth.telegram_user_id 
                }),
            });

            const data = await response.json();
            
            if (data.success) {
                setPinStatus({
                    needsPin: data.needsPin,
                    hasPin: data.hasPin
                });
                
                setUserData(userDataFromAuth);
                
                if (!data.needsPin) {
                    // У пользователя уже есть PIN и он не нуждается в создании/вводе
                    const initializedUserData = await initializeUserWallets(userDataFromAuth);
                    setUserData(initializedUserData || userDataFromAuth);
                    setIsPinVerified(true);
                    setAuthStatus('ready');
                } else {
                    // Нужно создать или ввести PIN
                    setAuthStatus('pin_required');
                }
            } else {
                setAuthStatus('auth_failed');
            }
        } catch (error) {
            console.error("App.jsx: Error checking PIN status:", error);
            setAuthStatus('auth_failed');
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
                    const initializedUserData = await initializeUserWallets(userData);
                    setUserData(initializedUserData || userData);
                    setIsPinVerified(true);
                    setAuthStatus('ready');
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
                    const initializedUserData = await initializeUserWallets(userData);
                    setUserData(initializedUserData || userData);
                    setIsPinVerified(true);
                    setAuthStatus('ready');
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

    // Если проверка аутентификации еще идет
    if (authStatus === 'checking') {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#000000',
                fontFamily: "'Rubik', sans-serif"
            }}>
                <div style={{
                    color: '#FFD700',
                    fontSize: '18px',
                    textAlign: 'center'
                }}>
                    Loading...
                </div>
            </div>
        );
    }

    // Если аутентификация не удалась
    if (authStatus === 'auth_failed') {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#000000',
                padding: '20px',
                textAlign: 'center',
                fontFamily: "'Rubik', sans-serif"
            }}>
                <div style={{
                    color: '#FFD700',
                    fontSize: '16px',
                    maxWidth: '300px'
                }}>
                    <h2 style={{ marginBottom: '20px', color: '#FFD700' }}>Authentication Error</h2>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Please try again or contact support.</p>
                </div>
            </div>
        );
    }

    // Показываем экран PIN-кода если требуется
    if (authStatus === 'pin_required' && userData && !isPinVerified) {
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

    // Если userData отсутствует, не показываем приложение
    if (!userData || authStatus !== 'ready') {
        return null;
    }

    // Основное приложение после успешной аутентификации и верификации PIN
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