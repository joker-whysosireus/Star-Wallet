import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getUSDTTokensForDetail, 
    getTotalUSDTBalance,
    getTokenPrices,
    getBalances,
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
    const [isLoading, setIsLoading] = useState(true);
    const [usdtPrice, setUsdtPrice] = useState(1.00);
    
    const usdtLogo = TOKENS.USDT_TON?.logo || 'https://cryptologos.cc/logos/tether-usdt-logo.svg';
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        
        const loadData = async () => {
            try {
                setIsLoading(true);
                
                // Получаем реальную цену USDT из priceService
                const prices = await getTokenPrices();
                const currentUsdtPrice = prices['USDT'] || 1.00;
                setUsdtPrice(currentUsdtPrice);
                
                const tokens = await getUSDTTokensForDetail(userData, network);
                const updatedTokens = await getBalances(tokens);
                setUsdtTokens(updatedTokens);
                
                const total = await getTotalUSDTBalance(userData, network);
                setTotalUSDTBalance(total);
                
                const totalValue = parseFloat(total) * currentUsdtPrice;
                setTotalUSDTValue(totalValue.toFixed(2));
                
            } catch (error) {
                console.error('Error loading USDT tokens:', error);
                setUsdtTokens([]);
                setTotalUSDTBalance('0.00');
                setTotalUSDTValue('0.00');
            } finally {
                setIsLoading(false);
            }
        };
        
        loadData();
        
        // Обновляем данные каждые 60 секунд
        const intervalId = setInterval(() => {
            loadData();
        }, 60000);
        
        return () => clearInterval(intervalId);
    }, [userData, navigate, network]);

    const handleTokenClick = (token) => {
        navigate(`/wallet/token/USDT`, { 
            state: { 
                ...token,
                symbol: 'USDT',
                name: token.displayName || token.name,
                userData: userData,
                network: network,
                blockchain: token.blockchain,
                price: usdtPrice
            }
        });
    };

    const handleBackClick = () => {
        navigate('/wallet');
    };

    return (
        <div className="page-container">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={false}
                onBack={handleBackClick}
                title="USDT"
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
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="usdt-token-block skeleton-token"
                            >
                                <div className="token-card">
                                    <div className="token-left">
                                        <div className="token-icon skeleton-icon"></div>
                                        <div className="token-names">
                                            <div className="skeleton-line skeleton-name"></div>
                                            <div className="skeleton-line skeleton-symbol"></div>
                                            <div className="skeleton-line skeleton-price"></div>
                                        </div>
                                    </div>
                                    <div className="token-right">
                                        <div className="skeleton-line skeleton-balance"></div>
                                        <div className="skeleton-line skeleton-usd"></div>
                                        <div className="skeleton-line skeleton-badge"></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : usdtTokens.length > 0 ? (
                        usdtTokens.map(token => {
                            // Определяем бейдж для каждого блокчейна USDT
                            let badgeColor = '';
                            let badgeText = '';
                            
                            switch(token.blockchain) {
                                case 'TON':
                                    badgeColor = '#0088cc';
                                    badgeText = 'TON';
                                    break;
                                case 'Ethereum':
                                    badgeColor = '#8c8cff';
                                    badgeText = 'ETH';
                                    break;
                                case 'Solana':
                                    badgeColor = '#00ff88';
                                    badgeText = 'SOL';
                                    break;
                                case 'TRON':
                                    badgeColor = '#ff060a';
                                    badgeText = 'TRX';
                                    break;
                                case 'BSC':
                                    badgeColor = '#bfcd43';
                                    badgeText = 'BNB';
                                    break;
                                default:
                                    badgeColor = '#26A17B';
                                    badgeText = 'USDT';
                            }
                            
                            const tokenBalance = parseFloat(token.balance || 0);
                            const tokenValue = tokenBalance * usdtPrice;
                            
                            return (
                                <div 
                                    key={token.id} 
                                    className="usdt-token-block"
                                    onClick={() => handleTokenClick(token)}
                                >
                                    <div className="token-card">
                                        <div className="token-left">
                                            <div className="token-icon">
                                                <img 
                                                    src={token.logo} 
                                                    alt={token.symbol}
                                                    className="token-logo"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                        const fallback = document.createElement('div');
                                                        fallback.className = 'token-logo-fallback';
                                                        fallback.textContent = token.symbol.substring(0, 2);
                                                        e.target.parentNode.appendChild(fallback);
                                                    }}
                                                />
                                            </div>
                                            <div className="token-names">
                                                <div className="token-name">{token.displayName || token.name}</div>
                                                <div className="token-symbol">USDT</div>
                                                <div className="token-price">${usdtPrice.toFixed(4)}</div>
                                            </div>
                                        </div>
                                        <div className="token-right">
                                            <div className="token-balance">{token.balance || '0'}</div>
                                            <div className="token-usd-balance">${tokenValue.toFixed(2)}</div>
                                            <div 
                                                className="blockchain-badge-tokencard" 
                                                style={{ backgroundColor: badgeColor }}
                                                title={badgeText}
                                            >
                                                {badgeText}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-tokens-message">
                            <p>No USDT tokens found</p>
                        </div>
                    )}
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default USDTDetail;