import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getAllTokens,
    getBalances,
    getTokenPrices
} from '../../Services/storageService';
import './SelectToken.css';

const SelectToken = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { mode, userData } = location.state || {};
    
    const [wallets, setWallets] = useState([]);
    const [filteredWallets, setFilteredWallets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        
        loadTokens();
    }, [userData]);
    
    const loadTokens = async () => {
        setShowSkeleton(true);
        setIsLoading(true);
        
        try {
            const allTokens = await getAllTokens(userData);
            if (!Array.isArray(allTokens) || allTokens.length === 0) {
                setWallets([]);
                setFilteredWallets([]);
                setShowSkeleton(false);
                setIsLoading(false);
                return;
            }
            
            const updatedWallets = await getBalances(allTokens, userData);
            setWallets(updatedWallets);
            setFilteredWallets(updatedWallets);
        } catch (error) {
            console.error('Error loading tokens:', error);
        } finally {
            setShowSkeleton(false);
            setIsLoading(false);
        }
    };
    
    const handleTokenClick = (wallet) => {
        if (mode === 'send') {
            navigate('/send', { 
                state: { 
                    wallet: wallet,
                    userData: userData 
                } 
            });
        } else if (mode === 'receive') {
            navigate('/receive', { 
                state: { 
                    wallet: wallet,
                    userData: userData 
                } 
            });
        }
    };
    
    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);
        
        if (query === '') {
            setFilteredWallets(wallets);
        } else {
            const filtered = wallets.filter(wallet => 
                wallet.symbol.toLowerCase().includes(query) ||
                wallet.name.toLowerCase().includes(query) ||
                wallet.blockchain.toLowerCase().includes(query)
            );
            setFilteredWallets(filtered);
        }
    };
    
    const getTitle = () => {
        if (mode === 'send') return 'Select Token to Send';
        if (mode === 'receive') return 'Select Token to Receive';
        return 'Select Token';
    };
    
    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)' },
            'Tron': { color: '#ff0000', bg: 'rgba(255, 0, 0, 0.1)' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)' },
            'NEAR': { color: '#0b4731', bg: 'rgba(11, 71, 49, 0.1)' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)' },
            'XRP': { color: '#23292f', bg: 'rgba(35, 41, 47, 0.1)' },
            'LTC': { color: '#bfbbbb', bg: 'rgba(191, 187, 187, 0.1)' },
            'DOGE': { color: '#c2a633', bg: 'rgba(194, 166, 51, 0.1)' }
        };
        
        return badges[blockchain] || { color: '#666', bg: 'rgba(102, 102, 102, 0.1)' };
    };
    
    if (!mode || !userData) {
        return (
            <div className="page-container">
                <Header userData={userData} />
                <div className="page-content">
                    <h1 style={{ color: 'white' }}>Invalid access</h1>
                    <button 
                        onClick={() => navigate('/wallet')}
                        className="action-button"
                    >
                        Back to Wallet
                    </button>
                </div>
                <Menu />
            </div>
        );
    }
    
    return (
        <div className="page-container">
            <Header userData={userData} />
            
            <div className="page-content select-token-page">
                <div className="select-token-header">
                    <h1>{getTitle()}</h1>
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Search tokens..."
                            value={searchQuery}
                            onChange={handleSearch}
                            className="search-input"
                        />
                    </div>
                </div>
                
                <div className="tokens-grid-container">
                    {showSkeleton ? (
                        Array.from({ length: 12 }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="token-grid-item skeleton-item"
                            >
                                <div className="token-grid-icon skeleton-loader"></div>
                                <div className="token-grid-symbol skeleton-loader"></div>
                                <div className="token-grid-name skeleton-loader"></div>
                                <div className="token-grid-chain skeleton-loader"></div>
                            </div>
                        ))
                    ) : filteredWallets.length > 0 ? (
                        filteredWallets.map((wallet) => {
                            const badge = getBlockchainBadge(wallet.blockchain);
                            return (
                                <div 
                                    key={wallet.id} 
                                    className="token-grid-item"
                                    onClick={() => handleTokenClick(wallet)}
                                >
                                    <div className="token-grid-icon">
                                        <img 
                                            src={wallet.logo} 
                                            alt={wallet.symbol}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                const fallback = document.createElement('div');
                                                fallback.className = 'token-icon-fallback';
                                                fallback.textContent = wallet.symbol.substring(0, 2);
                                                e.target.parentNode.appendChild(fallback);
                                            }}
                                        />
                                    </div>
                                    <div className="token-grid-symbol">{wallet.symbol}</div>
                                    <div className="token-grid-name">{wallet.name}</div>
                                    <div 
                                        className="token-grid-chain"
                                        style={{ 
                                            color: badge.color,
                                            backgroundColor: badge.bg
                                        }}
                                    >
                                        {wallet.blockchain}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="no-tokens-message">
                            <p>No tokens found</p>
                            {searchQuery && <p>Try a different search term</p>}
                        </div>
                    )}
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default SelectToken;