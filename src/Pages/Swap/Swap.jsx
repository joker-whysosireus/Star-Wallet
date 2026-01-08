import { useState, useEffect, useRef } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import TokenSelectorModal from './Components/TokenSelectorModal/TokenSelectorModal';
import { 
  getAllTokens, 
  getTokenPrices, 
  getCurrentPrices,
  startPriceUpdates,
  stopPriceUpdates,
  TOKENS,
  getBlockchainIcon
} from '../Wallet/Services/storageService';
import './Swap.css';

function Swap({ userData }) {
    const [tokens, setTokens] = useState([]);
    const [fromToken, setFromToken] = useState(null);
    const [toToken, setToToken] = useState(null);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('0');
    const [exchangeRate, setExchangeRate] = useState(1.62);
    const [loading, setLoading] = useState(true);
    const [prices, setPrices] = useState({});
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [selectorType, setSelectorType] = useState(''); // 'from' or 'to'
    
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
    }, []);
    
    const loadTokens = async () => {
        try {
            // Создаем список токенов из TOKENS
            const tokenList = Object.values(TOKENS)
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
                    network: 'mainnet'
                }));
            
            setTokens(tokenList);
            
            // Устанавливаем начальные токены: USDT и TON
            const usdtToken = tokenList.find(token => token.symbol === 'USDT');
            const tonToken = tokenList.find(token => token.symbol === 'TON');
            
            setFromToken(usdtToken || tokenList[0]);
            setToToken(tonToken || tokenList[1]);
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
            const rate = toPrice / fromPrice;
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
        setFromToken(toToken);
        setToToken(tempToken);
        
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
        
        alert(`You are about to swap ${fromAmount} ${fromSymbol} for ${toAmount} ${toSymbol}\nExchange rate: 1 ${toSymbol} ≈ ${exchangeRate.toFixed(2)} ${fromSymbol}`);
        // Здесь будет логика для проверки и выполнения сделки
    };
    
    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num)) return '0';
        
        if (num < 0.000001) {
            return num.toFixed(9);
        } else if (num < 0.001) {
            return num.toFixed(6);
        } else if (num < 1) {
            return num.toFixed(4);
        } else {
            return num.toFixed(2);
        }
    };
    
    const openTokenSelector = (type) => {
        setSelectorType(type);
        setShowTokenSelector(true);
    };
    
    if (loading) {
        return (
            <div className="wallet-page-wallet">
                <Header userData={userData} />
                <div className="page-content">
                    <div className="swap-loading">Loading...</div>
                </div>
                <Menu />
            </div>
        );
    }
    
    return (
        <div className="wallet-page-wallet">
            <Header userData={userData} />
            
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
                                <span className="swap-balance">0</span>
                                <span className="swap-token-name">{fromToken?.symbol}</span>
                            </div>
                        </div>
                        
                        {/* Horizontal divider line */}
                        <div className="swap-horizontal-divider">
                            <div className="swap-divider-line"></div>
                            <button className="swap-swap-button" onClick={handleSwapTokens}>
                                ⇅
                            </button>
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
                    
                    {/* Vertical divider between pay and receive blocks */}
                    <div className="swap-vertical-divider">
                        <div className="swap-blocks-divider-line"></div>
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
                        </div>
                        
                        {/* Horizontal divider line - without button for receive block */}
                        <div className="swap-horizontal-divider">
                            <div className="swap-divider-line"></div>
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
                1 {toToken?.symbol} ≈ {exchangeRate.toFixed(2)} {fromToken?.symbol}
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
                    onSelect={(token) => handleTokenSelect(token, selectorType)}
                    onClose={() => setShowTokenSelector(false)}
                    selectedToken={selectorType === 'from' ? fromToken : toToken}
                />
            )}
        </div>
    );
}

export default Swap;