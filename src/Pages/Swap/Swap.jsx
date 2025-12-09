// src/Pages/Swap/Swap.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import TokenSelectModal from './Components/TokenSelectModal';
import { getAllTokens } from '../Wallet/Services/storageService';
import './Swap.css';

function Swap({ userData }) {
    const [fromToken, setFromToken] = useState(null);
    const [toToken, setToToken] = useState(null);
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [percentage, setPercentage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [availableTokens, setAvailableTokens] = useState([]);
    const [exchangeRate, setExchangeRate] = useState(0);
    const [prices, setPrices] = useState({});
    const [fromBalance, setFromBalance] = useState(0);
    const [toBalance, setToBalance] = useState(0);
    
    const [showFromTokenModal, setShowFromTokenModal] = useState(false);
    const [showToTokenModal, setShowToTokenModal] = useState(false);
    
    const navigate = useNavigate();

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
            webApp.BackButton.show();
            webApp.BackButton.onClick(() => {
                navigate('/wallet');
            });

            return () => {
                webApp.BackButton.offClick();
                webApp.BackButton.hide();
            };
        }
    }, [navigate]);

    // Загрузка токенов
    useEffect(() => {
        const loadTokensAndPrices = () => {
            try {
                const tokens = getAllTokens();
                
                if (!tokens || tokens.length === 0) {
                    console.error('No tokens found');
                    setAvailableTokens([]);
                    return;
                }
                
                setAvailableTokens(tokens);
                
                let initialFromToken = tokens.find(t => t.symbol === 'TON') || tokens[0];
                let initialToToken = tokens.find(t => t.symbol === 'USDT') || 
                                   (tokens.length > 1 ? tokens[1] : null);
                
                setFromToken(initialFromToken);
                if (initialToToken) {
                    setToToken(initialToToken);
                }

                const initialPrices = {
                    'TON': 6.24,
                    'SOL': 172.34,
                    'ETH': 3500.00,
                    'USDT': 1.00,
                    'USDC': 1.00
                };
                setPrices(initialPrices);
                
            } catch (error) {
                console.error('Error loading tokens:', error);
                setAvailableTokens([]);
            }
        };

        loadTokensAndPrices();
    }, []);

    useEffect(() => {
        if (fromToken && toToken) {
            calculateExchangeRate(fromToken, toToken);
            setFromBalance(getTokenBalance(fromToken));
            setToBalance(getTokenBalance(toToken));
        }
    }, [fromToken, toToken]);

    useEffect(() => {
        if (fromAmount && !isNaN(fromAmount) && parseFloat(fromAmount) > 0 && exchangeRate > 0) {
            const calculated = (parseFloat(fromAmount) * exchangeRate).toFixed(6);
            setToAmount(calculated);
        } else {
            setToAmount('');
        }
    }, [fromAmount, exchangeRate]);

    const calculateExchangeRate = (from, to) => {
        const rates = {
            'TON': { 
                'USDT': 6.24, 
                'SOL': 0.036, 
                'ETH': 0.0034,
                'USDC': 6.23
            },
            'USDT': { 
                'TON': 0.16, 
                'SOL': 0.0058, 
                'ETH': 0.000286,
                'USDC': 0.99
            },
            'SOL': { 
                'TON': 27.78, 
                'USDT': 172.5, 
                'ETH': 0.058,
                'USDC': 172.4
            },
            'ETH': { 
                'TON': 294, 
                'USDT': 3500, 
                'SOL': 17.24,
                'USDC': 3499
            },
            'USDC': {
                'TON': 6.24,
                'USDT': 1.01,
                'SOL': 0.036,
                'ETH': 0.0034
            }
        };

        const fromRate = rates[from.symbol] || {};
        const rate = fromRate[to.symbol] || 1;
        setExchangeRate(rate);
    };

    const handleFromAmountChange = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setFromAmount(value);
            setPercentage(null);
        }
    };

    const handlePercentageClick = (percent) => {
        setPercentage(percent);
        
        const balance = getTokenBalance(fromToken);
        const amount = (balance * percent / 100).toFixed(6);
        
        setFromAmount(amount);
    };

    const getTokenBalance = (token) => {
        if (!token) return 0;
        
        const balances = {
            'ton': 25.43,
            'usdt_ton': 150.00,
            'usdc_ton': 120.50,
            'sol': 3.25,
            'usdt_sol': 85.00,
            'usdc_sol': 75.50,
            'eth': 0.45,
            'usdt_eth': 200.00,
            'usdc_eth': 180.00
        };
        
        return balances[token.id] || 0;
    };

    const handleSwapTokens = () => {
        if (!fromToken || !toToken) return;
        
        const tempToken = fromToken;
        setFromToken(toToken);
        setToToken(tempToken);
        
        const tempAmount = fromAmount;
        setFromAmount(toAmount);
        setToAmount(tempAmount);
        
        calculateExchangeRate(toToken, tempToken);
    };

    const handleSelectFromToken = () => {
        setShowFromTokenModal(true);
    };

    const handleSelectToToken = () => {
        setShowToTokenModal(true);
    };

    const handleSwap = () => {
        if (!fromToken || !toToken) {
            setTransactionStatus({ type: 'error', message: 'Please select tokens' });
            return;
        }

        if (!fromAmount || parseFloat(fromAmount) <= 0) {
            setTransactionStatus({ type: 'error', message: 'Please enter a valid amount' });
            return;
        }

        const balance = getTokenBalance(fromToken);
        if (parseFloat(fromAmount) > balance) {
            setTransactionStatus({ type: 'error', message: 'Insufficient balance' });
            return;
        }

        setIsLoading(true);
        setTransactionStatus(null);

        setTimeout(() => {
            setIsLoading(false);
            setTransactionStatus({ 
                type: 'success', 
                message: `Successfully swapped ${fromAmount} ${fromToken.symbol} to ${toAmount} ${toToken.symbol}` 
            });
            setFromAmount('');
            setToAmount('');
            setPercentage(null);
        }, 2000);
    };

    // Если токены не загружены
    if (!fromToken || availableTokens.length === 0) {
        return (
            <div className="page-container">
                <Header userData={userData} />
                <div className="page-content">
                    <div className="swap-header">
                        <h1>Swap Tokens</h1>
                        <p>Exchange tokens instantly</p>
                    </div>
                    <div style={{ 
                        textAlign: 'center', 
                        color: 'rgba(255, 255, 255, 0.7)',
                        padding: '40px 20px'
                    }}>
                        <p>No tokens available. Please set up your wallet first.</p>
                    </div>
                </div>
                <Menu />
            </div>
        );
    }

    const fromTokenPrice = prices[fromToken.symbol] || 1;
    const toTokenPrice = prices[toToken?.symbol] || 1;
    const fromUsdValue = (parseFloat(fromAmount || 0) * fromTokenPrice).toFixed(2);
    const toUsdValue = (parseFloat(toAmount || 0) * toTokenPrice).toFixed(2);

    return (
        <div className="page-container">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="swap-header">
                    <h1>Swap Tokens</h1>
                    <p>Exchange tokens instantly</p>
                </div>

                <div className="swap-container">
                    {/* From Token Block */}
                    <div className="swap-block from-block">
                        <div className="swap-block-content">
                            <div className="swap-left">
                                <div className="swap-label">You pay</div>
                                <div className="swap-amount">{fromAmount || '0'} {fromToken.symbol}</div>
                                <div className="swap-usd">${fromUsdValue}</div>
                            </div>
                            <div className="swap-right">
                                <div className="swap-balance">Balance: {fromBalance.toFixed(2)} {fromToken.symbol}</div>
                                <div className="token-selector" onClick={handleSelectFromToken}>
                                    <div className="selected-token-info">
                                        <div className="token-icon">
                                            <div className="token-icon-fallback">
                                                {fromToken.symbol.substring(0, 2)}
                                            </div>
                                        </div>
                                        <div className="token-info">
                                            <span className="token-symbol">{fromToken.symbol}</span>
                                            <span className="token-name">{fromToken.name}</span>
                                        </div>
                                    </div>
                                    <div className="token-arrow">▼</div>
                                </div>
                                <div className="percentage-buttons">
                                    <button 
                                        className={`percentage-btn ${percentage === 50 ? 'active' : ''}`}
                                        onClick={() => handlePercentageClick(50)}
                                    >
                                        50%
                                    </button>
                                    <button 
                                        className={`percentage-btn ${percentage === 100 ? 'active' : ''}`}
                                        onClick={() => handlePercentageClick(100)}
                                    >
                                        Max
                                    </button>
                                </div>
                                <div className="swap-fee">Fee: ~$0.10</div>
                            </div>
                        </div>
                    </div>

                    {/* Exchange Symbol */}
                    <div className="exchange-symbol-container">
                        <div className="exchange-symbol" onClick={handleSwapTokens}>
                            ⇅
                        </div>
                    </div>

                    {/* To Token Block */}
                    <div className="swap-block to-block">
                        <div className="swap-block-content">
                            <div className="swap-left">
                                <div className="swap-label">You receive</div>
                                <div className="swap-amount">{toAmount || '0'} {toToken?.symbol || '...'}</div>
                                <div className="swap-usd">${toUsdValue}</div>
                            </div>
                            <div className="swap-right">
                                <div className="swap-balance">Balance: {toBalance.toFixed(2)} {toToken?.symbol}</div>
                                <div className="token-selector" onClick={handleSelectToToken}>
                                    <div className="selected-token-info">
                                        <div className="token-icon">
                                            <div className="token-icon-fallback">
                                                {toToken?.symbol?.substring(0, 2)}
                                            </div>
                                        </div>
                                        <div className="token-info">
                                            <span className="token-symbol">{toToken?.symbol}</span>
                                            <span className="token-name">{toToken?.name}</span>
                                        </div>
                                    </div>
                                    <div className="token-arrow">▼</div>
                                </div>
                                <div className="swap-fee">Rate: 1 {fromToken?.symbol} = {exchangeRate.toFixed(6)} {toToken?.symbol}</div>
                            </div>
                        </div>
                    </div>

                    {transactionStatus && (
                        <div className={`transaction-status ${transactionStatus.type}`}>
                            {transactionStatus.message}
                        </div>
                    )}
                </div>
                
                <button 
                    className="swap-btn"
                    onClick={handleSwap}
                    disabled={isLoading || !fromAmount || parseFloat(fromAmount) <= 0}
                >
                    {isLoading ? 'Swapping...' : 'Swap Tokens'}
                </button>
            </div>

            {/* Модальные окна для выбора токенов */}
            <TokenSelectModal
                isOpen={showFromTokenModal}
                onClose={() => setShowFromTokenModal(false)}
                tokens={availableTokens}
                onSelectToken={setFromToken}
                excludeTokenId={toToken?.id}
            />
            
            <TokenSelectModal
                isOpen={showToTokenModal}
                onClose={() => setShowToTokenModal(false)}
                tokens={availableTokens}
                onSelectToken={setToToken}
                excludeTokenId={fromToken?.id}
            />

            <Menu />
        </div>
    );
}

export default Swap;