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
import CreatePin from './assets/PIN/CreatePin/CreatePin';
import EnterPin from './assets/PIN/EnterPin/EnterPin';
import { initializeUserWallets } from './Pages/Wallet/Services/walletService';

const AUTH_FUNCTION_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/auth';
const PIN_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);
    const [isPinSet, setIsPinSet] = useState(false);
    const [isPinVerified, setIsPinVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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

    // Check if user has PIN set
    const checkUserPin = async (telegramUserId) => {
        try {
            const response = await fetch(`${PIN_API_URL}/check-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ telegram_user_id: telegramUserId }),
            });

            if (response.ok) {
                const data = await response.json();
                return data.hasPin;
            }
            return false;
        } catch (error) {
            console.error("Error checking user PIN:", error);
            return false;
        }
    };

    // User authentication and PIN check
    useEffect(() => {
        console.log("App.jsx: Starting authentication check");
        
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
                        
                        // Initialize user wallets
                        console.log("App.jsx: Initializing user wallets...");
                        const initializedUserData = await initializeUserWallets(data.userData);
                        
                        if (initializedUserData) {
                            console.log("App.jsx: User wallets initialized successfully");
                            
                            // Check if user has PIN set
                            const hasPin = await checkUserPin(initializedUserData.telegram_user_id);
                            setIsPinSet(hasPin);
                            
                            setUserData(initializedUserData);
                        } else {
                            console.error("App.jsx: Failed to initialize user wallets");
                            setUserData(data.userData);
                            
                            // Check if user has PIN set
                            const hasPin = await checkUserPin(data.userData.telegram_user_id);
                            setIsPinSet(hasPin);
                        }
                    } else {
                        console.error("App.jsx: Authentication failed");
                    }
                })
                .catch(error => {
                    console.error("App.jsx: Authentication error:", error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            console.warn("App.jsx: No initData available");
            setIsLoading(false);
        }
    }, []);

    // Handle PIN creation
    const handlePinCreated = () => {
        setIsPinSet(true);
        setIsPinVerified(true);
    };

    // Handle PIN verification
    const handlePinVerified = () => {
        setIsPinVerified(true);
    };

    // Handle logout
    const handleLogout = () => {
        setIsPinVerified(false);
        localStorage.clear();
        window.location.reload();
    };

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loader"></div>
                <p>Loading...</p>
            </div>
        );
    }

    

    // If PIN is not set, show CreatePin page
    if (!isPinSet) {
        return <CreatePin userData={userData} onPinCreated={handlePinCreated} />;
    }

    // If PIN is set but not verified, show EnterPin page
    if (!isPinVerified) {
        return <EnterPin userData={userData} onPinVerified={handlePinVerified} />;
    }

    // If PIN is verified, show main app
    return (
        <Routes location={location}>
            {/* Главная страница */}
            <Route path="/" element={
                <Wallet isActive={isActive} userData={userData} onLogout={handleLogout} />
            } />
            
            {/* Дублирующий маршрут для /wallet */}
            <Route path="/wallet" element={
                <Wallet isActive={isActive} userData={userData} onLogout={handleLogout} />
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