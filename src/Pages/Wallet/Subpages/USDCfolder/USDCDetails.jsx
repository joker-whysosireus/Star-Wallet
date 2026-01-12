import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getUSDCTokensForDetail, 
    getTotalUSDCBalance,
    getTokenPrices,
    getBalances,
    TOKENS 
} from '../../Services/storageService';
import './USDCDetail.css';

const USDCDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdcTokens, setUsdcTokens] = useState([]);
    const [totalUSDCBalance, setTotalUSDCBalance] = useState('0.00');
    const [totalUSDCValue, setTotalUSDCValue] = useState('0.00');
    const [isLoading, setIsLoading] = useState(true);
    const [usdcPrice, setUsdcPrice] = useState(1.00);
    
    const usdcLogo = TOKENS.USDC_ETH?.logo || 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg';
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        
        const loadData = async () => {
            try {
                setIsLoading(true);
                
                // Получаем реальную цену USDC из priceService
                const prices = await getTokenPrices();
                const currentUsdcPrice = prices['USDC'] || 1.00;
                setUsdcPrice(currentUsdcPrice);
                
                const tokens = await getUSDCTokensForDetail(userData, network);
                const updatedTokens = await getBalances(tokens);
                setUsdcTokens(updatedTokens);
                
                const total = await getTotalUSDCBalance(userData, network);
                setTotalUSDCBalance(total);
                
                const totalValue = parseFloat(total) * currentUsdcPrice;
                setTotalUSDCValue(totalValue.toFixed(2));
                
            } catch (error) {
                console.error('Error loading USDC tokens:', error);
                setUsdcTokens([]);
                setTotalUSDCBalance('0.00');
                setTotalUSDCValue('0.00');
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
        navigate(`/wallet/token/USDC`, { 
            state: { 
                ...token,
                symbol: 'USDC',
                name: token.displayName || token.name,
                userData: userData,
                network: network,
                blockchain: token.blockchain,
                price: usdcPrice
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
                title="USDC"
            />
            
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src={usdcLogo} 
                            alt="USDC"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                const fallback = document.createElement('div');
                                fallback.className = 'token-logo-fallback-usdc';
                                fallback.textContent = 'USDC';
                                fallback.style.cssText = `
                                    width: 80px;
                                    height: 80px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    background: rgba(39, 117, 202, 0.2);
                                    border-radius: 50%;
                                    color: #2775CA;
                                    font-size: 24px;
                                    font-weight: bold;
                                `;
                                e.target.parentNode.appendChild(fallback);
                            }}
                        />
                    </div>
                </div>
                
                <div className="total-usdc-balance-display">
                    <div className="total-usdc-amount-container">
                        <div className="total-usdc-amount">
                            {totalUSDCBalance} USDC
                        </div>
                        <div className="total-usdc-badge">
                            USDC
                        </div>
                    </div>
                    <div className="total-usdc-value">
                        ${totalUSDCValue}
                    </div>
                </div>
                
                <div className="usdc-tokens-grid">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="usdc-token-block skeleton-token"
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
                    ) : usdcTokens.length > 0 ? (
                        usdcTokens.map(token => {
                            // Определяем бейдж для каждого блокчейна USDC
                            let badgeColor = '';
                            let badgeText = '';
                            
                            switch(token.blockchain) {
                                case 'Ethereum':
                                    badgeColor = '#8c8cff';
                                    badgeText = 'ETH';
                                    break;
                                case 'Solana':
                                    badgeColor = '#00ff88';
                                    badgeText = 'SOL';
                                    break;
                                case 'BSC':
                                    badgeColor = '#bfcd43';
                                    badgeText = 'BNB';
                                    break;
                                default:
                                    badgeColor = '#2775CA';
                                    badgeText = 'USDC';
                            }
                            
                            const tokenBalance = parseFloat(token.balance || 0);
                            const tokenValue = tokenBalance * usdcPrice;
                            
                            return (
                                <div 
                                    key={token.id} 
                                    className="usdc-token-block"
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
                                                <div className="token-symbol">USDC</div>
                                                <div className="token-price">${usdcPrice.toFixed(4)}</div>
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
                            <p>No USDC tokens found</p>
                        </div>
                    )}
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default USDCDetail;