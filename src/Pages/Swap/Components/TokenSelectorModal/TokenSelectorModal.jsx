import React, { useState, useEffect } from 'react';
import { getTokenPrices, getBlockchainIcon, subscribeToPriceUpdates } from '../../../Wallet/Services/storageService';
import './TokenSelectorModal.css';

const TokenSelectorModal = ({ tokens, userWallets, onSelect, onClose, selectedToken }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [prices, setPrices] = useState({});
    const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
    
    const loadPrices = async () => {
        try {
            const priceData = await getTokenPrices();
            setPrices(priceData);
            setLastUpdateTime(Date.now());
        } catch (error) {
            console.error('Error loading prices:', error);
        }
    };
    
    useEffect(() => {
        loadPrices();
        
        // Подписываемся на обновления цен каждые 3 минуты
        const unsubscribe = subscribeToPriceUpdates((newPrices) => {
            console.log('Price update received in TokenSelectorModal');
            setPrices(newPrices);
            setLastUpdateTime(Date.now());
        });
        
        return () => {
            unsubscribe();
        };
    }, []);
    
    const formatBalance = (balanceStr) => {
        if (!balanceStr || balanceStr === '0') return '0.000';
        
        const balance = parseFloat(balanceStr);
        if (isNaN(balance)) return '0.000';
        
        const [integerPart, decimalPart] = balance.toString().split('.');
        
        if (!decimalPart) {
            return `${integerPart}.000`;
        }
        
        const limitedDecimal = decimalPart.length > 3 ? decimalPart.substring(0, 3) : decimalPart;
        
        if (limitedDecimal === '0' || limitedDecimal === '00') {
            return `${integerPart}.${limitedDecimal.padEnd(3, '0')}`;
        }
        
        return `${integerPart}.${limitedDecimal.padEnd(3, '0').substring(0, 3)}`;
    };
    
    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' }
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };
    
    const handleTokenSelect = (token) => {
        onSelect(token);
    };
    
    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };
    
    const getSortedTokens = () => {
        // USDT в начало списка, остальные по алфавиту
        const usdtTokens = tokens.filter(token => token.symbol === 'USDT');
        const otherTokens = tokens.filter(token => token.symbol !== 'USDT')
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
        return [...usdtTokens, ...otherTokens];
    };
    
    const sortedTokens = getSortedTokens();
    
    // Получаем баланс пользователя для токена
    const getUserBalanceForToken = (token) => {
        if (!userWallets || userWallets.length === 0) return '0';
        
        // Ищем токен по символу и блокчейну
        const userWallet = userWallets.find(wallet => 
            wallet.symbol === token.symbol && 
            wallet.blockchain === token.blockchain
        );
        
        return userWallet ? userWallet.balance || '0' : '0';
    };
    
    return (
        <>
            <div className={`token-selector-backdrop ${isClosing ? 'closing' : ''}`} onClick={handleClose}></div>
            <div className={`token-selector-modal ${isClosing ? 'closing' : ''}`}>
                <div className="token-selector-header">
                    <h3>Select Token</h3>
                    <button className="token-selector-close" onClick={handleClose}>✕</button>
                </div>
                
                <div className="token-selector-list">
                    {sortedTokens.map(token => {
                        const badge = getBlockchainBadge(token.blockchain);
                        const userBalance = getUserBalanceForToken(token);
                        const formattedBalance = formatBalance(userBalance);
                        const price = prices[token.symbol] || 0;
                        const tokenPrice = price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(4)}`;
                        const usdBalance = (parseFloat(userBalance) * price).toFixed(2);
                        
                        return (
                            <div 
                                key={token.id}
                                className={`token-selector-item ${selectedToken?.id === token.id ? 'selected' : ''}`}
                                onClick={() => handleTokenSelect(token)}
                            >
                                <div className="token-left">
                                    <div className="token-icon">
                                        <img 
                                            src={token.logo} 
                                            alt={token.symbol}
                                            className="token-logo"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = getBlockchainIcon(token.blockchain);
                                            }}
                                        />
                                    </div>
                                    <div className="token-names">
                                        <div className="token-name">{token.name}</div>
                                        <div className="token-symbol">{token.symbol}</div>
                                        <div className="token-price">{tokenPrice}</div>
                                    </div>
                                </div>
                                <div className="token-right">
                                    <div className="token-balance">{formattedBalance}</div>
                                    <div className="token-usd-balance">
                                        ${usdBalance}
                                    </div>
                                    <div 
                                        className="blockchain-badge-tokencard" 
                                        style={{ backgroundColor: badge.bg, color: badge.color }}
                                        title={token.blockchain}
                                    >
                                        {badge.text}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {sortedTokens.length === 0 && (
                        <div className="no-tokens-found">
                            No tokens found
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default TokenSelectorModal;