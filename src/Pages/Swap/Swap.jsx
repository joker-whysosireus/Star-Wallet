import { useState, useEffect } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import TokenSelectorModal from './Components/TokenSelectorModal/TokenSelectorModal';
import { 
  getAllTokens, 
  getTokenPrices, 
  startPriceUpdates,
  stopPriceUpdates,
  TOKENS,
  TESTNET_TOKENS,
  getBlockchainIcon,
  getRealBalances
} from '../Wallet/Services/storageService';
import './Swap.css';

function Swap({ userData }) {
    const [tokens, setTokens] = useState([]);
    const [userWallets, setUserWallets] = useState([]);
    const [fromToken, setFromToken] = useState(null);
    const [toToken, setToToken] = useState(null);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('0');
    const [exchangeRate, setExchangeRate] = useState(0);
    const [loading, setLoading] = useState(true);
    const [prices, setPrices] = useState({});
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [selectorType, setSelectorType] = useState('');
    const [currentNetwork, setCurrentNetwork] = useState(() => {
        const savedNetwork = localStorage.getItem('selected_network');
        return savedNetwork || 'mainnet';
    });
    
    useEffect(() => {
        loadTokens();
        loadPrices();
        
        // Подписываемся на обновления цен
        const stopUpdates = startPriceUpdates((updatedPrices) => {
            setPrices(updatedPrices);
            if (fromToken && toToken) {
                updateExchangeRate(fromToken, toToken, updatedPrices);
            }
        }, 30000);
        
        return () => {
            stopUpdates();
            stopPriceUpdates();
        };
    }, [currentNetwork]);
    
    const loadTokens = async () => {
        try {
            // Получаем токены пользователя для текущей сети
            const userTokens = await getAllTokens(userData, currentNetwork);
            
            // Получаем реальные балансы
            const walletsWithBalances = await getRealBalances(userTokens);
            setUserWallets(walletsWithBalances);
            
            // Создаем список токенов из TOKENS или TESTNET_TOKENS
            const tokenSource = currentNetwork === 'mainnet' ? TOKENS : TESTNET_TOKENS;
            const tokenList = Object.values(tokenSource)
                .filter(token => !token.symbol.includes('_')) // Фильтруем дубликаты USDT
                .map(token => ({
                    id: `token_${token.symbol}_${Date.now()}`,
                    name: token.name,
                    symbol: token.symbol,
                    blockchain: token.blockchain,
                    decimals: token.decimals,
                    isNative: token.isNative,
                    contractAddress: token.contractAddress || '',
                    logo: token.logo,
                    balance: '0',
                    isActive: true,
                    network: currentNetwork
                }));
            
            setTokens(tokenList);
            
            // Устанавливаем начальные токены: USDT и TON
            const usdtToken = tokenList.find(token => token.symbol === 'USDT');
            const tonToken = tokenList.find(token => token.symbol === 'TON');
            
            const from = usdtToken || tokenList[0];
            const to = tonToken || tokenList[1];
            
            setFromToken(from);
            setToToken(to);
            
            // Обновляем курс обмена
            if (prices[from?.symbol] && prices[to?.symbol]) {
                updateExchangeRate(from, to, prices);
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const loadPrices = async () => {
        try {
            const priceData = await getTokenPrices();
            setPrices(priceData);
            
            // Обновляем курс обмена при загрузке цен
            if (fromToken && toToken) {
                updateExchangeRate(fromToken, toToken, priceData);
            }
        } catch (error) {
            console.error('Error loading prices:', error);
        }
    };
    
    const handleFromAmountChange = (value) => {
        setFromAmount(value);
        if (value && exchangeRate) {
            const calculated = parseFloat(value) * exchangeRate;
            setToAmount(calculated.toFixed(6));
        } else {
            setToAmount('0');
        }
    };
    
    const handleTokenSelect = (token, type) => {
        if (type === 'from') {
            setFromToken(token);
            updateExchangeRate(token, toToken, prices);
        } else {
            setToToken(token);
            updateExchangeRate(fromToken, token, prices);
        }
        setShowTokenSelector(false);
    };
    
    const updateExchangeRate = (from, to, priceData = prices) => {
        if (!from || !to) return;
        
        // Получаем цены из priceData
        const fromPrice = priceData[from.symbol] || 1;
        const toPrice = priceData[to.symbol] || 1;
        
        if (fromPrice && toPrice) {
            // 1 fromToken = (fromPrice / toPrice) toToken
            const rate = fromPrice / toPrice;
            setExchangeRate(rate);
            
            // Пересчитываем сумму получения
            if (fromAmount && fromAmount !== '') {
                const calculated = parseFloat(fromAmount) * rate;
                setToAmount(calculated.toFixed(6));
            }
        }
    };
    
    const handleSwapTokens = () => {
        const tempToken = fromToken;
        const tempAmount = fromAmount;
        
        setFromToken(toToken);
        setToToken(tempToken);
        setFromAmount(toAmount);
        setToAmount(tempAmount);
        
        // Обновляем курс
        updateExchangeRate(toToken, tempToken, prices);
    };
    
    const handleCheckDeal = () => {
        if (!fromAmount || parseFloat(fromAmount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        
        const fromSymbol = fromToken?.symbol || '';
        const toSymbol = toToken?.symbol || '';
        
        alert(`You are about to swap ${fromAmount} ${fromSymbol} for ${toAmount} ${toSymbol}\nExchange rate: 1 ${fromSymbol} ≈ ${exchangeRate.toFixed(6)} ${toSymbol}`);
        // Здесь будет логика для проверки и выполнения сделки
    };
    
    const getTokenBalance = (token) => {
        if (!token || !userWallets || userWallets.length === 0) return '0.00';
        
        // Ищем токен в userWallets по символу и блокчейну
        const userToken = userWallets.find(wallet => 
            wallet.symbol === token.symbol && 
            wallet.blockchain === token.blockchain
        );
        
        if (userToken && userToken.balance) {
            const balance = parseFloat(userToken.balance);
            return balance.toFixed(2);
        }
        
        return '0.00';
    };
    
    const openTokenSelector = (type) => {
        setSelectorType(type);
        setShowTokenSelector(true);
    };
    
    const handleNetworkChange = (newNetwork) => {
        localStorage.setItem('selected_network', newNetwork);
        setCurrentNetwork(newNetwork);
        setLoading(true);
        setUserWallets([]);
        setTokens([]);
        setFromToken(null);
        setToToken(null);
        setFromAmount('');
        setToAmount('0');
        // Перезагружаем токены для новой сети
        loadTokens();
    };
    
    // Скелетоны для загрузки
    if (loading) {
        return (
            <div className="wallet-page-wallet">
                <Header 
                    userData={userData} 
                    onNetworkChange={handleNetworkChange}
                    currentNetwork={currentNetwork}
                />
                <div className="page-content">
                    <div className="swap-container">
                        {/* Skeleton для верхнего блока */}
                        <div className="swap-block">
                            <div className="swap-block-header">
                                <div className="swap-header-left">
                                    <div className="skeleton-loader" style={{width: '24px', height: '24px', borderRadius: '50%'}}></div>
                                    <div className="skeleton-loader" style={{width: '60px', height: '14px', marginLeft: '10px'}}></div>
                                </div>
                                <div className="swap-header-right">
                                    <div className="skeleton-loader" style={{width: '40px', height: '14px'}}></div>
                                    <div className="skeleton-loader" style={{width: '30px', height: '14px', marginLeft: '8px'}}></div>
                                </div>
                            </div>
                            
                            <div className="swap-block-content">
                                <div className="swap-amount-section">
                                    <div className="skeleton-loader" style={{width: '100%', height: '40px'}}></div>
                                </div>
                                
                                <div className="swap-token-selector">
                                    <div className="skeleton-loader" style={{width: '120px', height: '40px', borderRadius: '4px'}}></div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Skeleton для разделителя с кнопкой */}
                        <div className="swap-blocks-divider">
                            <div className="swap-blocks-divider-line"></div>
                            <div className="skeleton-loader" style={{width: '32px', height: '32px', borderRadius: '50%', marginRight: '40px'}}></div>
                        </div>
                        
                        {/* Skeleton для нижнего блока */}
                        <div className="swap-block">
                            <div className="swap-block-header">
                                <div className="swap-header-left">
                                    <div className="skeleton-loader" style={{width: '24px', height: '24px', borderRadius: '50%'}}></div>
                                    <div className="skeleton-loader" style={{width: '60px', height: '14px', marginLeft: '10px'}}></div>
                                </div>
                                <div className="swap-header-right">
                                    <div className="skeleton-loader" style={{width: '40px', height: '14px'}}></div>
                                    <div className="skeleton-loader" style={{width: '30px', height: '14px', marginLeft: '8px'}}></div>
                                </div>
                            </div>
                            
                            <div className="swap-block-content">
                                <div className="swap-amount-section">
                                    <div className="skeleton-loader" style={{width: '100%', height: '40px'}}></div>
                                </div>
                                
                                <div className="swap-token-selector">
                                    <div className="skeleton-loader" style={{width: '120px', height: '40px', borderRadius: '4px'}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <Menu />
            </div>
        );
    }
    
    return (
        <div className="wallet-page-wallet">
            <Header 
                userData={userData} 
                onNetworkChange={handleNetworkChange}
                currentNetwork={currentNetwork}
            />
            
            <div className="page-content">
                <div className="swap-container">
                    {/* Upper Block - You Pay */}
                    <div className="swap-block">
                        <div className="swap-block-header">
                            <div className="swap-header-left">
                                {fromToken && (
                                    <img 
                                        src={fromToken.logo} 
                                        alt={fromToken.symbol} 
                                        className="swap-token-icon-small"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = getBlockchainIcon(fromToken.blockchain);
                                        }}
                                    />
                                )}
                                <span className="swap-header-text">You pay</span>
                            </div>
                            <div className="swap-header-right">
                                <span className="swap-balance">{getTokenBalance(fromToken)}</span>
                                <span className="swap-token-name">{fromToken?.symbol}</span>
                            </div>
                        </div>
                        
                        <div className="swap-block-content">
                            <div className="swap-amount-section">
                                <input 
                                    type="number"
                                    className="swap-amount-input"
                                    value={fromAmount}
                                    onChange={(e) => handleFromAmountChange(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.000001"
                                />
                            </div>
                            
                            <div className="swap-token-selector">
                                <button 
                                    className="swap-token-button"
                                    onClick={() => openTokenSelector('from')}
                                >
                                    <span className="swap-selected-token">
                                        {fromToken?.symbol}
                                    </span>
                                    <span className="swap-selector-arrow">›</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Horizontal divider between pay and receive blocks WITH SWAP BUTTON */}
                    <div className="swap-blocks-divider">
                        <div className="swap-blocks-divider-line"></div>
                        <button className="swap-swap-button" onClick={handleSwapTokens}>
                            ⇅
                        </button>
                    </div>
                    
                    {/* Lower Block - You Receive */}
                    <div className="swap-block">
                        <div className="swap-block-header">
                            <div className="swap-header-left">
                                {toToken && (
                                    <img 
                                        src={toToken.logo} 
                                        alt={toToken.symbol} 
                                        className="swap-token-icon-small"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = getBlockchainIcon(toToken.blockchain);
                                        }}
                                    />
                                )}
                                <span className="swap-header-text">You receive</span>
                            </div>
                            <div className="swap-header-right">
                                <span className="swap-balance">{getTokenBalance(toToken)}</span>
                                <span className="swap-token-name">{toToken?.symbol}</span>
                            </div>
                        </div>
                        
                        <div className="swap-block-content">
                            <div className="swap-amount-section">
                                <input 
                                    type="number"
                                    className="swap-amount-input"
                                    value={toAmount}
                                    readOnly
                                    placeholder="0"
                                />
                            </div>
                            
                            <div className="swap-token-selector">
                                <button 
                                    className="swap-token-button"
                                    onClick={() => openTokenSelector('to')}
                                >
                                    <span className="swap-selected-token">
                                        {toToken?.symbol}
                                    </span>
                                    <span className="swap-selector-arrow">›</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Exchange Rate */}
            <div className="swap-rate-display">
                1 {fromToken?.symbol} ≈ {exchangeRate.toFixed(6)} {toToken?.symbol}
            </div>
            
            {/* Check Deal Button - Fixed above Menu */}
            <button 
                className="swap-deal-button"
                onClick={handleCheckDeal}
                disabled={!fromAmount || parseFloat(fromAmount) <= 0}
            >
                Check Deal
            </button>
            
            <Menu />
            
            {/* Token Selector Modal */}
            {showTokenSelector && (
                <TokenSelectorModal
                    tokens={tokens}
                    userWallets={userWallets}
                    onSelect={(token) => handleTokenSelect(token, selectorType)}
                    onClose={() => setShowTokenSelector(false)}
                    selectedToken={selectorType === 'from' ? fromToken : toToken}
                />
            )}
        </div>
    );
}

export default Swap;