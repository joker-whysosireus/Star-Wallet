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
    const [authChecked, setAuthChecked] = useState(false);

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
                return data.success ? data.hasPin : false;
            }
            return false;
        } catch (error) {
            console.error("App.jsx: Error checking user PIN:", error);
            return false;
        }
    };

    // User authentication and PIN check
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
                    if (data.isValid && data.userData) {
                        setUserData(data.userData);
                        
                        // Then check PIN status
                        const hasPin = await checkUserPin(data.userData.telegram_user_id);
                        
                        setIsPinSet(hasPin);
                        
                        // Initialize wallets regardless of PIN status
                        try {
                            const initializedUserData = await initializeUserWallets(data.userData);
                            
                            if (initializedUserData) {
                                setUserData(prev => ({ ...prev, ...initializedUserData }));
                            }
                        } catch (walletError) {
                            console.error("App.jsx: Error initializing wallets:", walletError);
                        }
                        
                        // If user has PIN, check if already verified
                        if (hasPin) {
                            const isVerified = localStorage.getItem('pin_verified') === 'true';
                            if (isVerified) {
                                setIsPinVerified(true);
                            }
                        }
                        
                        setAuthChecked(true);
                    } else {
                        setAuthChecked(true);
                    }
                })
                .catch(error => {
                    console.error("App.jsx: Authentication error:", error);
                    setAuthChecked(true);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setAuthChecked(true);
            setIsLoading(false);
        }
    }, []);

    // Handle PIN creation
    const handlePinCreated = () => {
        setIsPinSet(true);
        setIsPinVerified(true);
        localStorage.setItem('pin_verified', 'true');
    };

    // Handle PIN verification
    const handlePinVerified = () => {
        setIsPinVerified(true);
        localStorage.setItem('pin_verified', 'true');
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

    // Wait for auth to complete
    if (!authChecked) {
        return (
            <div className="loading-screen">
                <div className="loader"></div>
                <p>Checking authentication...</p>
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
            <Route path="/" element={
                <Wallet isActive={isActive} userData={userData} onLogout={handleLogout} />
            } />
            
            <Route path="/wallet" element={
                <Wallet isActive={isActive} userData={userData} onLogout={handleLogout} />
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