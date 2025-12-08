// src/App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import History from './Pages/History/History';
import Swap from './Pages/Swap/Swap';
import Wallet from './Pages/Wallet/Wallet';
import TokenDetail from './Pages/Wallet/Components/TokenDetail';
import Stake from './Pages/Stake/Stake';
import PinSetup from './Pages/Wallet/Components/PinSetup';
import PinEnter from './Pages/Wallet/Components/PinEnter';
import ShowSeed from './Pages/Wallet/Components/ShowSeed';

const AUTH_FUNCTION_URL = 'https://cryptopayappbackend.netlify.app/.netlify/functions/auth';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);
    const [telegramReady, setTelegramReady] = useState(false);

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
                             location.pathname === '/wallet' ||
                             location.pathname === '/history' ||
                             location.pathname === '/swap' ||
                             location.pathname === '/stake';
            
            if (isRootPage) {
                // На главных страницах скрываем кнопку Назад
                webApp.BackButton.hide();
            } else {
                // На вложенных страницах показываем кнопку Назад
                webApp.BackButton.show();
                webApp.BackButton.onClick(() => {
                    navigate(-1); // Возвращаемся на предыдущую страницу
                });
            }
            
            // Очищаем обработчики при размонтировании
            return () => {
                webApp.BackButton.offClick();
            };
        }
    }, [location, navigate]);

    // Инициализация Telegram WebApp
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
                setTelegramReady(true);
                setIsActive(webApp.isActive);
                
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
                setTelegramReady(true);
            }
        } else {
            console.warn("Not in Telegram WebApp environment, running in standalone mode");
            setTelegramReady(true);
        }
    }, []);

    // Аутентификация
    useEffect(() => {
        if (telegramReady) {
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
                    setTimeout(() => reject(new Error("Authentication timeout")), 10000)
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
                    .then(data => {
                        console.log("App.jsx: Authentication response received");
                        if (data.isValid) {
                            console.log("App.jsx: Authentication successful");
                            setUserData(data.userData);
                        } else {
                            console.error("App.jsx: Authentication failed, but allowing access");
                        }
                    })
                    .catch(error => {
                        console.error("App.jsx: Authentication error:", error);
                    });
            } else {
                console.warn("App.jsx: No initData available, but allowing access");
            }
        }
    }, [telegramReady]);

    const updateUserData = async () => {
        try {
            const initData = window.Telegram?.WebApp?.initData || '';
            const response = await axios.post(AUTH_FUNCTION_URL, { initData });
            if (response.data.isValid) {
                setUserData(response.data.userData);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    return (
        <Routes location={location}>
            <Route path="/" element={
                <Wallet isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/wallet" element={
                <Wallet isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/wallet/token/:symbol" element={
                <TokenDetail isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/history" element={
                <History isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/swap" element={
                <Swap isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/stake" element={
                <Stake isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/wallet/setup-pin" element={
                <PinSetup isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/wallet/enter-pin" element={
                <PinEnter isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="/wallet/show-seed" element={
                <ShowSeed isActive={isActive} userData={userData} updateUserData={updateUserData} />
            } />
            
            <Route path="*" element={
                <div style={{ 
                    color: 'white', 
                    textAlign: 'center', 
                    padding: '50px',
                    fontFamily: "'Rubik', sans-serif"
                }}>
                    404 - Page Not Found
                </div>
            } />
        </Routes>
    );
};

const Main = () => {
    return (
        <Router>
            <App />
        </Router>
    );
};

export default Main;