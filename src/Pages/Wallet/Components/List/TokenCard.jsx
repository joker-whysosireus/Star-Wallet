import React, { useState, useEffect } from 'react';
import { getTokenPrices } from '../../Services/storageService';
import './TokenCard.css';

const TokenCard = ({ wallet, isLoading = false, network = 'mainnet', isUSDTInList = false }) => {
    const [usdBalance, setUsdBalance] = useState('$0.00');
    const [tokenPrice, setTokenPrice] = useState('$0.00');
    
    useEffect(() => {
        if (!isLoading && wallet && !wallet.isSkeleton) {
            calculateUsdBalance();
            getTokenPrice();
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
    
    const getTokenPrice = async () => {
        try {
            const prices = await getTokenPrices();
            const price = prices[wallet.symbol] || 1.00;
            
            if (price >= 1) {
                setTokenPrice(`$${price.toFixed(2)}`);
            } else if (price > 0.01) {
                setTokenPrice(`$${price.toFixed(4)}`);
            } else {
                setTokenPrice(`$${price.toFixed(6)}`);
            }
        } catch (error) {
            console.error('Error getting token price:', error);
            setTokenPrice('$0.00');
        }
    };
    
    // Форматирование баланса: только первые три нуля после целого числа
    const formatBalance = (balanceStr) => {
        if (!balanceStr || balanceStr === '0') return '0.000';
        
        const balance = parseFloat(balanceStr);
        if (isNaN(balance)) return '0.000';
        
        // Разделяем целую и дробную части
        const [integerPart, decimalPart] = balance.toString().split('.');
        
        if (!decimalPart) {
            return `${integerPart}.000`;
        }
        
        // Ограничиваем до 3 знаков после запятой
        const limitedDecimal = decimalPart.length > 3 ? decimalPart.substring(0, 3) : decimalPart;
        
        // Если после запятой все нули или их меньше 3, дополняем до 3 знаков
        if (limitedDecimal === '0' || limitedDecimal === '00') {
            return `${integerPart}.${limitedDecimal.padEnd(3, '0')}`;
        }
        
        // Если есть значимые цифры после запятой, показываем до 3 знаков
        return `${integerPart}.${limitedDecimal.padEnd(3, '0').substring(0, 3)}`;
    };
    
    if (isLoading || wallet?.isSkeleton) {
        return (
            <div className="token-card">
                <div className="token-left">
                    <div className="token-icon skeleton-loader"></div>
                    <div className="token-names">
                        <div className="token-name skeleton-loader" style={{ width: '80px', height: '14px', marginBottom: '6px' }}></div>
                        <div className="token-symbol skeleton-loader" style={{ width: '60px', height: '18px' }}></div>
                        <div className="token-price skeleton-loader" style={{ width: '50px', height: '12px', marginTop: '2px' }}></div>
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
            'XRP': { color: '#23292f', text: 'XRP' },
            'LTC': { color: '#bfbbbb', text: 'LTC' }
        };
        
        return badges[blockchain] || { color: '#666', text: blockchain };
    };
    
    const badge = getBlockchainBadge(wallet.blockchain);
    const formattedBalance = formatBalance(wallet.balance);

    // Для USDT в основном списке (Wallet) - без бейджа
    if (isUSDTInList) {
        return (
            <div className="token-card">
                <div className="token-left">
                    <div className="token-icon">
                        <img 
                            src={wallet.logo} 
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
                        <div className="token-name" style={{ fontSize: '14px', color: 'white' }}>Tether</div>
                        <div className="token-symbol" style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>USDT</div>
                        <div className="token-price">{tokenPrice}</div>
                    </div>
                </div>
                <div className="token-right">
                    <div className="token-balance" style={{ fontSize: '16px', fontWeight: '600', color: 'white' }}>
                        {formattedBalance}
                    </div>
                    <div className="token-usd-balance" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {usdBalance}
                    </div>
                    {/* Нет бейджа для USDT в основном списке */}
                </div>
            </div>
        );
    }

    // Для всех остальных токенов (и USDT в USDTDetail через showUSDTBadge)
    return (
        <div className="token-card">
            <div className="token-left">
                <div className="token-icon">
                    <img 
                        src={wallet.logo} 
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
                    <div className="token-price">{tokenPrice}</div>
                </div>
            </div>
            <div className="token-right">
                <div className="token-balance">{formattedBalance}</div>
                <div className="token-usd-balance">{usdBalance}</div>
                {(wallet.showUSDTBadge && wallet.symbol === 'USDT') ? (
                    <div 
                        className="blockchain-badge-tokencard" 
                        style={{ backgroundColor: '#26A17B' }}
                        title="USDT"
                    >
                        USDT
                    </div>
                ) : (
                    wallet.showBlockchain && wallet.symbol !== 'USDT' && (
                        <div 
                            className="blockchain-badge-tokencard" 
                            style={{ backgroundColor: badge.color }}
                            title={wallet.blockchain}
                        >
                            {badge.text}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default React.memo(TokenCard);