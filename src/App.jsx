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
import WelcomePage from './Pages/Welcome/WelcomePage';
import { initializeUserWallets } from './Pages/Wallet/Services/walletService';

const AUTH_FUNCTION_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/auth';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);
    const [showWelcome, setShowWelcome] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
            
            // Определяем, на главной ли мы странице
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

    // Initialize Telegram WebApp
    useEffect(() => {
        console.log("App.jsx: useEffect triggered");

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
                console.log("Telegram WebApp detected, initializing...");
                
                webApp.isVerticalSwipesEnabled = false;
                
                if (webApp.disableSwipeToClose) {
                    webApp.disableSwipeToClose();
                }

                if (webApp.expand) {
                    webApp.expand();
                    console.log("Telegram WebApp expanded to full screen");
                }
                
                if (webApp.enableClosingConfirmation) {
                    webApp.enableClosingConfirmation();
                }
                
                if (webApp.requestFullscreen) {
                    webApp.requestFullscreen();
                }
                
                console.log("Telegram WebApp initialized successfully");
                setIsActive(webApp.isActive);
                
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
            }
        } else {
            console.warn("Not in Telegram WebApp environment, running in standalone mode");
        }
    }, []);

    // Проверяем, видел ли пользователь Welcome страницу
    const checkWelcomeShown = (userId) => {
        try {
            const welcomeShown = localStorage.getItem(`welcomeShown_${userId}`);
            return welcomeShown === 'true';
        } catch (e) {
            return false;
        }
    };

    // Отмечаем, что пользователь увидел Welcome страницу
    const markWelcomeShown = (userId) => {
        try {
            localStorage.setItem(`welcomeShown_${userId}`, 'true');
        } catch (e) {
            console.error("Error saving welcome status:", e);
        }
    };

    // User authentication and wallet initialization
    useEffect(() => {
        console.log("App.jsx: Starting authentication check");
        setIsCheckingAuth(true);
        
        const getInitData = () => {
            try {
                return window.Telegram?.WebApp?.initData || '';
            } catch (e) {
                return '';
            }
        };

        const initData = getInitData();
        console.log("App.jsx: initData available:", !!initData);

        if (initData) {
            console.log("App.jsx: Sending authentication request");
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Authentication timeout")), 15000)
            );
            
            const authPromise = fetch(AUTH_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ initData }),
            });

            Promise.race([authPromise, timeoutPromise])
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(async (data) => {
                    console.log("App.jsx: Authentication response received");
                    if (data.isValid && data.userData) {
                        console.log("App.jsx: Authentication successful");
                        
                        // Проверяем, новый ли пользователь (по наличию pin_code и seed_phrases)
                        const hasPinCode = data.userData.pin_code;
                        const hasSeedPhrases = data.userData.seed_phrases;
                        const isNewUser = hasPinCode && hasSeedPhrases;
                        
                        if (isNewUser) {
                            // Проверяем, видел ли пользователь Welcome страницу
                            const hasSeenWelcome = checkWelcomeShown(data.userData.telegram_user_id);
                            
                            if (!hasSeenWelcome) {
                                // Показываем Welcome страницу для новых пользователей
                                setShowWelcome(true);
                                setUserData(data.userData);
                            } else {
                                // Инициализируем кошельки для существующих пользователей
                                await initializeUserWallets(data.userData);
                                setUserData(data.userData);
                            }
                        } else {
                            // Инициализируем кошельки для существующих пользователей
                            await initializeUserWallets(data.userData);
                            setUserData(data.userData);
                        }
                    } else {
                        console.error("App.jsx: Authentication failed");
                    }
                })
                .catch(error => {
                    console.error("App.jsx: Authentication error:", error);
                })
                .finally(() => {
                    setIsCheckingAuth(false);
                });
        } else {
            console.warn("App.jsx: No initData available");
            setIsCheckingAuth(false);
        }
    }, []);

    // Обработчик продолжения с Welcome страницы
    const handleWelcomeContinue = () => {
        if (userData?.telegram_user_id) {
            markWelcomeShown(userData.telegram_user_id);
        }
        setShowWelcome(false);
        // Инициализируем кошельки после показа Welcome страницы
        if (userData) {
            initializeUserWallets(userData);
        }
    };

    // Если нужно показать Welcome страницу
    if (showWelcome && userData) {
        return <WelcomePage userData={userData} onContinue={handleWelcomeContinue} />;
    }

    return (
        <Routes location={location}>
            {/* Главная страница */}
            <Route path="/" element={
                <Wallet isActive={isActive} userData={userData} />
            } />
            
            {/* Дублирующий маршрут для /wallet */}
            <Route path="/wallet" element={
                <Wallet isActive={isActive} userData={userData} />
            } />
            
            <Route path="/wallet/token/:symbol" element={
                <TokenDetail isActive={isActive} userData={userData} />
            } />
            
            {/* Новые маршруты для Send и Receive */}
            <Route path="/send" element={
                <SendToken isActive={isActive} userData={userData} />
            } />
            
            <Route path="/receive" element={
                <ReceiveToken isActive={isActive} userData={userData} />
            } />
            
            {/* Новый маршрут для Backup Seed Phrase */}
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
};

export default App;