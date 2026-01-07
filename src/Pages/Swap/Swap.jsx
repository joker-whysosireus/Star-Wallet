import { useState, useEffect } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
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
    const [fromAmount, setFromAmount] = useState('0');
    const [toAmount, setToAmount] = useState('0');
    const [exchangeRate, setExchangeRate] = useState(1.62);
    const [loading, setLoading] = useState(true);
    const [prices, setPrices] = useState({});
    
    useEffect(() => {
        loadTokens();
        loadPrices();
        
        // Подписываемся на обновления цен
        const stopUpdates = startPriceUpdates((updatedPrices) => {
            setPrices(updatedPrices);
            if (fromToken && toToken) {
                updateExchangeRate(fromToken, toToken, updatedPrices);
            }
        }, 30000); // Обновляем каждые 30 секунд
        
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
        }
    };
    
    const handleToAmountChange = (value) => {
        setToAmount(value);
        if (value && exchangeRate) {
            const calculated = parseFloat(value) / exchangeRate;
            setFromAmount(calculated.toFixed(6));
        }
    };
    
    const handleFromTokenChange = (tokenId) => {
        const token = tokens.find(t => t.id === tokenId);
        if (token) {
            setFromToken(token);
            updateExchangeRate(token, toToken, prices);
        }
    };
    
    const handleToTokenChange = (tokenId) => {
        const token = tokens.find(t => t.id === tokenId);
        if (token) {
            setToToken(token);
            updateExchangeRate(fromToken, token, prices);
        }
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
            if (fromAmount && fromAmount !== '0') {
                const calculated = parseFloat(fromAmount) * rate;
                setToAmount(calculated.toFixed(6));
            }
        }
    };
    
    const handleSwapTokens = () => {
        const tempToken = fromToken;
        setFromToken(toToken);
        setToToken(tempToken);
        
        const tempAmount = fromAmount;
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
    
    return (
        <div className="wallet-page-wallet">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="swap-container">
                    
                    <div className="swap-card">
                        {/* "You pay" section */}
                        <div className="swap-section">
                            <div className="swap-label">You pay</div>
                            <div className="swap-input-group">
                                <div className="swap-input-wrapper">
                                    <input 
                                        type="number"
                                        className="swap-input"
                                        value={fromAmount}
                                        onChange={(e) => handleFromAmountChange(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="0.000001"
                                    />
                                    <div className="swap-currency">
                                        {fromToken && (
                                            <div className="swap-token-info">
                                                <img 
                                                    src={fromToken.logo} 
                                                    alt={fromToken.symbol} 
                                                    className="swap-token-logo"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = getBlockchainIcon(fromToken.blockchain);
                                                    }}
                                                />
                                                <select 
                                                    className="swap-select"
                                                    value={fromToken?.id || ''}
                                                    onChange={(e) => handleFromTokenChange(e.target.value)}
                                                >
                                                    {tokens.map(token => (
                                                        <option key={token.id} value={token.id}>
                                                            {token.symbol}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="swap-note">Deposit - {formatCurrency(fromAmount)} {fromToken?.symbol}</div>
                        </div>
                        
                        {/* Swap arrow */}
                        <div className="swap-divider">
                            <div className="swap-arrow" onClick={handleSwapTokens}>
                                ⇅
                            </div>
                        </div>
                        
                        {/* "You receive" section */}
                        <div className="swap-section">
                            <div className="swap-label">You receive</div>
                            <div className="swap-input-group">
                                <div className="swap-input-wrapper">
                                    <input 
                                        type="number"
                                        className="swap-input"
                                        value={toAmount}
                                        onChange={(e) => handleToAmountChange(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="0.000001"
                                        readOnly
                                    />
                                    <div className="swap-currency">
                                        {toToken && (
                                            <div className="swap-token-info">
                                                <img 
                                                    src={toToken.logo} 
                                                    alt={toToken.symbol} 
                                                    className="swap-token-logo"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = getBlockchainIcon(toToken.blockchain);
                                                    }}
                                                />
                                                <select 
                                                    className="swap-select"
                                                    value={toToken?.id || ''}
                                                    onChange={(e) => handleToTokenChange(e.target.value)}
                                                >
                                                    {tokens.map(token => (
                                                        <option key={token.id} value={token.id}>
                                                            {token.symbol}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Exchange rate */}
                        <div className="swap-rate">
                            1 {toToken?.symbol} ≈ {exchangeRate.toFixed(2)} {fromToken?.symbol}
                        </div>
                        
                        {/* Check deal button */}
                        <button 
                            className="swap-button"
                            onClick={handleCheckDeal}
                            disabled={!fromAmount || parseFloat(fromAmount) <= 0}
                        >
                            Check Deal
                        </button>
                    </div>
                </div>
            </div>
            
            <Menu />
        </div>
    );
}

export default Swap;