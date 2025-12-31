import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import TokenCard from '../../Components/List/TokenCard';
import { getUSDTTokensForDetail, getTotalUSDTBalance } from '../../Services/storageService';
import './USDTDetail.css';

const USDTDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdtTokens, setUsdtTokens] = useState([]);
    const [totalUSDTBalance, setTotalUSDTBalance] = useState('0.00');
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        loadUSDTTokens();
    }, [userData, navigate]);

    const loadUSDTTokens = async () => {
        try {
            const tokens = await getUSDTTokensForDetail(userData, network);
            setUsdtTokens(tokens);
            
            const total = await getTotalUSDTBalance(userData, network);
            setTotalUSDTBalance(total);
        } catch (error) {
            console.error('Error loading USDT tokens:', error);
        }
    };

    const handleTokenClick = (token) => {
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
                
                <div className="total-usdt-balance-display">
                    <div className="total-usdt-amount">
                        {totalUSDTBalance} USDT
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
                                    showBlockchain: true,
                                    showUSDTBadge: true
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