import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import TokenCard from '../../Components/List/TokenCard';
import { 
    getUSDTTokensForDetail, 
    getTotalUSDTBalance,
    TOKENS 
} from '../../Services/storageService';
import './USDTDetail.css';

const USDTDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdtTokens, setUsdtTokens] = useState([]);
    const [totalUSDTBalance, setTotalUSDTBalance] = useState('0.00');
    const [isLoading, setIsLoading] = useState(true);
    
    // Получаем URL логотипа USDT из storageService
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
            } catch (error) {
                console.error('Error loading USDT tokens:', error);
                setUsdtTokens([]);
                setTotalUSDTBalance('0.00');
            } finally {
                setIsLoading(false);
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
                network: network
            }
        });
    };

    // Создаем макет для скелетонов (4 блока)
    const skeletonTokens = Array.from({ length: 4 }).map((_, index) => ({
        id: `skeleton-${index}`,
        symbol: 'USDT',
        name: 'Loading...',
        balance: '0.00',
        blockchain: 'TON',
        logo: '',
        showBlockchain: true,
        showUSDTBadge: true,
        isSkeleton: true
    }));

    const displayTokens = isLoading ? skeletonTokens : usdtTokens;

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
                            src={usdtLogo} 
                            alt="USDT"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                                console.error('Failed to load USDT logo:', e);
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'token-logo-fallback';
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
                    {isLoading ? (
                        <div className="total-usdt-skeleton">
                            <div className="skeleton-loader" style={{ 
                                width: '120px', 
                                height: '28px', 
                                margin: '0 auto',
                                borderRadius: '6px'
                            }}></div>
                        </div>
                    ) : (
                        <div className="total-usdt-amount-container">
                            <div className="total-usdt-amount">
                                {totalUSDTBalance} USDT
                            </div>
                            <div className="total-usdt-badge">
                                USDT
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="usdt-tokens-grid">
                    {displayTokens.map(token => (
                        <div 
                            key={token.id} 
                            className="usdt-token-block"
                            onClick={() => !isLoading && handleTokenClick(token)}
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
                                isLoading={isLoading && token.isSkeleton}
                            />
                        </div>
                    ))}
                </div>
                
                {!isLoading && usdtTokens.length === 0 && (
                    <div className="no-tokens-message">
                        <p>No USDT tokens available</p>
                    </div>
                )}
            </div>
            <Menu />
        </div>
    );
};

export default USDTDetail;