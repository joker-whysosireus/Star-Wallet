import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import TokenCard from '../../Components/List/TokenCard';
import { getUSDTTokensForDetail } from '../../Services/storageService';
import './USDTDetail.css';

const USDTDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdtTokens, setUsdtTokens] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        loadUSDTTokens();
    }, [userData, navigate]);

    const loadUSDTTokens = async () => {
        try {
            setIsLoading(true);
            const tokens = await getUSDTTokensForDetail(userData, network);
            setUsdtTokens(tokens);
        } catch (error) {
            console.error('Error loading USDT tokens:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTokenClick = (token) => {
        // Переход на страницу TokenDetail для выбранного USDT
        navigate(`/wallet/token/USDT`, { 
            state: { 
                ...token,
                symbol: 'USDT',
                name: token.displayName || token.name,
                userData: userData,
                network: network
            }
        });
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <Header 
                    userData={userData} 
                    currentNetwork={network}
                    disableNetworkSwitch={true}
                />
                <div className="page-content">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading USDT tokens...</p>
                    </div>
                </div>
                <Menu />
            </div>
        );
    }

    return (
        <div className="page-container">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={true}
            />
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src="https://cryptologos.cc/logos/tether-usdt-logo.svg" 
                            alt="USDT"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                    </div>
                </div>
                
                <div className="usdt-tokens-grid">
                    {usdtTokens.map(token => (
                        <div 
                            key={token.blockchain} 
                            className="usdt-token-block"
                            onClick={() => handleTokenClick(token)}
                        >
                            <TokenCard 
                                wallet={{
                                    ...token,
                                    symbol: 'USDT',
                                    name: token.displayName || token.name,
                                    showBlockchain: true
                                }} 
                                network={network}
                            />
                        </div>
                    ))}
                </div>
            </div>
            <Menu />
        </div>
    );
};

export default USDTDetail;