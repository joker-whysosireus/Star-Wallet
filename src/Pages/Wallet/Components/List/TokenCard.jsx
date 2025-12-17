import React from 'react';
import './TokenCard.css';

const TokenCard = ({ wallet }) => {
    if (!wallet) {
        return null;
    }
    
    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', text: 'TON' },
            'Solana': { color: '#00ff88', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', text: 'ETH' },
            'Tron': { color: '#ff0000', text: 'TRX' },
            'Bitcoin': { color: '#f7931a', text: 'BTC' },
            'NEAR': { color: '#0b4731ff', text: 'NEAR' },
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };
    
    const badge = getBlockchainBadge(wallet.blockchain);
    
    const getUsdBalance = () => {
        const prices = {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50
        };
        
        const price = prices[wallet.symbol] || 1.00;
        const balance = parseFloat(wallet.balance || 0);
        const usdValue = balance * price;
        
        if (usdValue >= 1000) {
            return `$${(usdValue / 1000).toFixed(1)}K`;
        } else if (usdValue >= 1) {
            return `$${usdValue.toFixed(2)}`;
        } else {
            return `$${usdValue.toFixed(4)}`;
        }
    };

    const getLogoUrl = () => {
        if (wallet.symbol === 'TON') {
            return 'https://ton.org/download/ton_symbol.svg';
        }
        return wallet.logo;
    };

    return (
        <div className="token-card">
            <div className="token-left">
                <div className="token-icon">
                    <img 
                        src={getLogoUrl()} 
                        alt={wallet.symbol}
                        className="token-logo"
                        onError={(e) => {
                            console.error(`Failed to load logo for ${wallet.symbol}:`, e);
                            e.target.style.display = 'none';
                            const fallback = document.createElement('div');
                            fallback.className = 'token-logo-fallback';
                            fallback.textContent = wallet.symbol.substring(0, 2);
                            e.target.parentNode.appendChild(fallback);
                        }}
                    />
                </div>
                <div className="token-names">
                    <div className="token-name">{wallet.name}</div>
                    <div className="token-symbol">{wallet.symbol}</div>
                </div>
            </div>
            <div className="token-right">
                <div className="token-balance">{wallet.balance || '0.00'}</div>
                <div className="token-usd-balance">{getUsdBalance()}</div>
                {wallet.showBlockchain && (
                    <div 
                        className="blockchain-badge" 
                        style={{ backgroundColor: badge.color }}
                        title={wallet.blockchain}
                    >
                        {badge.text}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(TokenCard);