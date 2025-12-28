import React, { useState } from 'react';
import TokenCard from './TokenCard';
import './ExpandableTokenCard.css';

const ExpandableTokenCard = ({ wallet, network, relatedTokens = [], onTokenClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Проверяем, нужно ли показывать кнопку раскрытия
    const shouldShowExpand = ['Solana', 'Ethereum', 'Tron', 'TON'].includes(wallet.blockchain) && 
                           ['SOL', 'ETH', 'TRX', 'TON'].includes(wallet.symbol);
    
    const handleExpandClick = (e) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };
    
    const handleTokenClick = () => {
        if (onTokenClick) {
            onTokenClick(wallet);
        }
    };
    
    return (
        <div className="expandable-token-container">
            <div className="main-token-wrapper" onClick={handleTokenClick}>
                <TokenCard wallet={wallet} network={network} />
                {shouldShowExpand && relatedTokens.length > 0 && (
                    <button 
                        className={`expand-button ${isExpanded ? 'expanded' : ''}`}
                        onClick={handleExpandClick}
                        aria-label={isExpanded ? "Скрыть токены" : "Показать токены"}
                    >
                        ^
                    </button>
                )}
            </div>
            
            {isExpanded && relatedTokens.length > 0 && (
                <div className={`related-tokens-container ${isExpanded ? 'visible' : ''}`}>
                    {relatedTokens.map(token => (
                        <div key={token.id} className="related-token-item">
                            <TokenCard 
                                wallet={token} 
                                network={network}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ExpandableTokenCard;