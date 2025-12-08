import React, { useState } from 'react';
import './TokenSelectModal.css';

function TokenSelectModal({ isOpen, onClose, tokens, onSelectToken, excludeTokenId }) {
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const filteredTokens = tokens.filter(token => {
        if (token.id === excludeTokenId) return false;
        
        if (searchTerm.trim() === '') return true;
        
        const term = searchTerm.toLowerCase();
        return (
            token.symbol.toLowerCase().includes(term) ||
            token.name.toLowerCase().includes(term) ||
            token.blockchain.toLowerCase().includes(term)
        );
    });

    const getMockBalance = (tokenId) => {
        const balances = {
            'ton': '25.43',
            'sol': '3.25',
            'eth': '0.45',
            'usdt_ton': '150.00',
            'usdt_sol': '85.00',
            'usdt_eth': '200.00'
        };
        return balances[tokenId] || '0';
    };

    return (
        <div className="token-modal-overlay" onClick={onClose}>
            <div className="token-modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="token-modal-header">
                    <h2>Select Token</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                
                <div className="token-modal-search">
                    <input 
                        type="text" 
                        placeholder="Search token name or symbol"
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>
                
                <div className="token-list">
                    {filteredTokens.length === 0 ? (
                        <div className="no-tokens-found">
                            <p>No tokens found</p>
                        </div>
                    ) : (
                        filteredTokens.map(token => (
                            <div 
                                key={token.id} 
                                className="token-item"
                                onClick={() => {
                                    onSelectToken(token);
                                    onClose();
                                }}
                            >
                                <div className="token-icon-small">
                                    <div className="token-icon-fallback">
                                        {token.symbol.substring(0, 2)}
                                    </div>
                                </div>
                                <div className="token-info">
                                    <div className="token-symbol-row">
                                        <span className="token-symbol">{token.symbol}</span>
                                        <span className="token-balance">
                                            {getMockBalance(token.id)} {token.symbol}
                                        </span>
                                    </div>
                                    <span className="token-name">{token.name} • {token.blockchain}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default TokenSelectModal;