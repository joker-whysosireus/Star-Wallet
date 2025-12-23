import React, { useState, useEffect } from 'react';
import { getTokenPrices } from '../../Services/storageService';
import './TokenCard.css';

const TokenCard = ({ wallet, isLoading = false }) => {
    const [usdBalance, setUsdBalance] = useState('$0.00');
    
    useEffect(() => {
        if (!isLoading && wallet) {
            calculateUsdBalance();
        }
    }, [wallet, isLoading]);

    const calculateUsdBalance = async () => {
        try {
            const prices = await getTokenPrices();
            const price = prices[wallet.symbol] || 1.00;
            const balance = parseFloat(wallet.balance || 0);
            const usdValue = balance * price;
            
            if (usdValue >= 1000) {
                setUsdBalance(`$${(usdValue / 1000).toFixed(1)}K`);
            } else if (usdValue >= 1) {
                setUsdBalance(`$${usdValue.toFixed(2)}`);
            } else if (usdValue > 0) {
                setUsdBalance(`$${usdValue.toFixed(4)}`);
            } else {
                setUsdBalance('$0.00');
            }
        } catch (error) {
            console.error('Error calculating USD balance:', error);
            setUsdBalance('$0.00');
        }
    };
    
    if (isLoading || !wallet) {
        return (
            <div className="token-card">
                <div className="token-left">
                    <div className="token-icon skeleton-loader"></div>
                    <div className="token-names">
                        <div className="token-name skeleton-loader" style={{ width: '80px', height: '14px', marginBottom: '6px' }}></div>
                        <div className="token-symbol skeleton-loader" style={{ width: '60px', height: '18px' }}></div>
                    </div>
                </div>
                <div className="token-right">
                    <div className="token-balance skeleton-loader" style={{ width: '80px', height: '18px', marginBottom: '6px' }}></div>
                    <div className="token-usd-balance skeleton-loader" style={{ width: '60px', height: '14px' }}></div>
                    <div className="blockchain-badge skeleton-loader" style={{ width: '40px', height: '12px', marginTop: '4px' }}></div>
                </div>
            </div>
        );
    }
    
    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', text: 'TON' },
            'Solana': { color: '#00ff88', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', text: 'ETH' },
            'Tron': { color: '#ff0000', text: 'TRX' },
            'Bitcoin': { color: '#E49E00', text: 'BTC' },
            'NEAR': { color: '#0b4731ff', text: 'NEAR' },
            'BSC': { color: '#bfcd43ff', text: 'BNB' }, 
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };
    
    const badge = getBlockchainBadge(wallet.blockchain);

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
                <div className="token-usd-balance">{usdBalance}</div>
                {wallet.showBlockchain && (
                    <div 
                        className="blockchain-badge-tokencard" 
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