import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import History from './Pages/History/History';
import Swap from './Pages/Swap/Swap';
import Wallet from './Pages/Wallet/Wallet';
import TokenDetail from './Pages/Wallet/Subpages/Details/TokenDetail';
import Stake from './Pages/Stake/Stake';
import SendToken from './Pages/Wallet/Subpages/Send/SendToken';
import ReceiveToken from './Pages/Wallet/Subpages/Receive/ReceiveToken';

const AUTH_FUNCTION_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions/auth';

const App = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isActive, setIsActive] = useState(false);
    const [userData, setUserData] = useState(null);

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
        console.log("App.jsx: Initializing Telegram WebApp");

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
                
                try {
                    if (webApp.requestFullscreen) {
                        webApp.requestFullscreen();
                    }
                } catch (error) {
                    console.warn("requestFullscreen not supported:", error);
                }
                
                console.log("Telegram WebApp initialized successfully");
                setIsActive(webApp.isActive);
                
            } catch (error) {
                console.error("Error initializing Telegram WebApp:", error);
            }
        } else {
            console.warn("Not in Telegram WebApp environment");
        }
    }, []);

    useEffect(() => {
        console.log("App.jsx: Starting authentication process");
        
        const authenticateUser = async () => {
            const getInitData = () => {
                try {
                    return window.Telegram?.WebApp?.initData || '';
                } catch (e) {
                    return '';
                }
            };

            const initData = getInitData();
            console.log("App.jsx: initData available:", !!initData);

            if (initData && initData.trim() !== '') {
                console.log("App.jsx: Sending authentication request");
                
                try {
                    const response = await fetch(AUTH_FUNCTION_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ initData }),
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log("App.jsx: Authentication response received:", data);
                    
                    if (data.isValid) {
                        console.log("App.jsx: Authentication successful");
                        setUserData(data.userData);
                    } else {
                        console.warn("App.jsx: Authentication failed");
                        setUserData(null);
                    }
                } catch (error) {
                    console.error("App.jsx: Authentication error:", error);
                    setUserData(null);
                }
            } else {
                console.warn("App.jsx: No initData available");
                setUserData(null);
            }
        };

        authenticateUser();
    }, []);

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