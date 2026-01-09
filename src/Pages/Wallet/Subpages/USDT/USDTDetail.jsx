import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import TokenCard from '../../Components/List/TokenCard';
import { 
    getUSDTTokensForDetail, 
    getTotalUSDTBalance,
    getTokenPrices,
    TOKENS 
} from '../../Services/storageService';
import './USDTDetail.css';

const USDTDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdtTokens, setUsdtTokens] = useState([]);
    const [totalUSDTBalance, setTotalUSDTBalance] = useState('0.00');
    const [totalUSDTValue, setTotalUSDTValue] = useState('0.00');
    
    const usdtLogo = TOKENS.USDT_TON?.logo || 'https://cryptologos.cc/logos/tether-usdt-logo.svg';
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        
        const loadData = async () => {
            try {
                const tokens = await getUSDTTokensForDetail(userData, network);
                setUsdtTokens(tokens);
                
                const total = await getTotalUSDTBalance(userData, network);
                setTotalUSDTBalance(total);
                
                const prices = await getTokenPrices();
                const usdtPrice = prices['USDT'] || 1.00;
                const totalValue = parseFloat(total) * usdtPrice;
                setTotalUSDTValue(totalValue.toFixed(2));
            } catch (error) {
                console.error('Error loading USDT tokens:', error);
                setUsdtTokens([]);
                setTotalUSDTBalance('0.00');
                setTotalUSDTValue('0.00');
            }
        };
        
        loadData();
    }, [userData, navigate, network]);

    const handleTokenClick = (token) => {
        navigate(`/wallet/token/USDT`, { 
            state: { 
                ...token,
                symbol: 'USDT',
                name: token.displayName || token.name,
                userData: userData,
                network: network,
                // Явно передаем blockchain, чтобы TokenDetail знал, на каком блокчейне этот USDT
                blockchain: token.blockchain
            }
        });
    };

    return (
        <div className="page-container">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={false}
            />
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src={usdtLogo} 
                            alt="USDT"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'token-logo-fallback-usdt';
                                fallback.textContent = 'USDT';
                                fallback.style.cssText = `
                                    width: 80px;
                                    height: 80px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: rgba(255, 215, 0, 0.2);
                                    border-radius: 50%;
                                    color: #FFD700;
                                    font-size: 24px;
                                    font-weight: bold;
                                `;
                                e.target.parentNode.appendChild(fallback);
                            }}
                        />
                    </div>
                </div>
                
                <div className="total-usdt-balance-display">
                    <div className="total-usdt-amount-container">
                        <div className="total-usdt-amount">
                            {totalUSDTBalance} USDT
                        </div>
                        <div className="total-usdt-badge">
                            USDT
                        </div>
                    </div>
                    <div className="total-usdt-value">
                        ${totalUSDTValue}
                    </div>
                </div>
                
                <div className="usdt-tokens-grid">
                    {usdtTokens.map(token => (
                        <div 
                            key={token.id} 
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