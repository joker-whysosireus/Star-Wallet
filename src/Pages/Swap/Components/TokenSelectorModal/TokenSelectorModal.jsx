import React, { useState, useEffect } from 'react';
import { getTokenPrices } from '../../../Wallet/Services/storageService';
import './TokenSelectorModal.css';

const TokenSelectorModal = ({ tokens, onSelect, onClose, selectedToken }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredTokens, setFilteredTokens] = useState(tokens);
    const [prices, setPrices] = useState({});
    
    useEffect(() => {
        loadPrices();
        setFilteredTokens(tokens);
    }, [tokens]);
    
    const loadPrices = async () => {
        try {
            const priceData = await getTokenPrices();
            setPrices(priceData);
        } catch (error) {
            console.error('Error loading prices:', error);
        }
    };
    
    const handleSearch = (e) => {
        const term = e.target.value.toLowerCase();
        setSearchTerm(term);
        
        if (!term.trim()) {
            setFilteredTokens(tokens);
        } else {
            const filtered = tokens.filter(token =>
                token.symbol.toLowerCase().includes(term) ||
                token.name.toLowerCase().includes(term)
            );
            setFilteredTokens(filtered);
        }
    };
    
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
    
    return (
        <>
            <div className="token-selector-backdrop" onClick={onClose}></div>
            <div className="token-selector-modal">
                <div className="token-selector-header">
                    <h3>Select Token</h3>
                    <button className="token-selector-close" onClick={onClose}>✕</button>
                </div>
                
                <div className="token-selector-search">
                    <input
                        type="text"
                        placeholder="Search token"
                        value={searchTerm}
                        onChange={handleSearch}
                        className="token-search-input"
                        autoFocus
                    />
                </div>
                
                <div className="token-selector-list">
                    {filteredTokens.map(token => {
                        const badge = getBlockchainBadge(token.blockchain);
                        const formattedBalance = formatBalance(token.balance);
                        const price = prices[token.symbol] || 0;
                        const tokenPrice = price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(4)}`;
                        
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
                                                e.target.style.display = 'none';
                                                const fallback = document.createElement('div');
                                                fallback.className = 'token-logo-fallback';
                                                fallback.textContent = token.symbol.substring(0, 2);
                                                e.target.parentNode.appendChild(fallback);
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
                                        ${(parseFloat(token.balance) * price).toFixed(2)}
                                    </div>
                                    <div 
                                        className="blockchain-badge-tokencard" 
                                        style={{ backgroundColor: badge.color }}
                                        title={token.blockchain}
                                    >
                                        {badge.text}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredTokens.length === 0 && (
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