import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { getTokenPricesFromRPC, getUSDTTokensForDetail, getBlockchainIcon } from '../../Services/storageService';
import './USDTDetail.css';

const USDTDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData, network = 'mainnet' } = location.state || {};
    
    const [usdtTokens, setUsdtTokens] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalBalance, setTotalBalance] = useState(0);
    const [totalUSD, setTotalUSD] = useState(0);
    
    useEffect(() => {
        if (!userData) {
            navigate('/wallet');
            return;
        }
        loadUSDTTokens();
    }, [userData, navigate]);

    const loadUSDTTokens = async () => {
        try {
            setIsLoading(true);
            const tokens = await getUSDTTokensForDetail(userData, network);
            setUsdtTokens(tokens);
            
            // Считаем общий баланс
            let total = 0;
            tokens.forEach(token => {
                total += parseFloat(token.balance || 0);
            });
            setTotalBalance(total);
            
            // Считаем общую стоимость
            const prices = await getTokenPricesFromRPC();
            setTotalUSD(total * (prices['USDT'] || 1));
        } catch (error) {
            console.error('Error loading USDT tokens:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTokenClick = (token, action = 'receive') => {
        navigate(`/${action}`, { 
            state: { 
                wallet: {
                    ...token,
                    symbol: 'USDT',
                    name: token.displayName || token.name
                },
                userData: userData,
                network: network
            }
        });
    };

    const getBlockchainBadge = (blockchain, standard) => {
        const badges = {
            'Tron': { color: '#ff0000', text: 'TRC20' },
            'Ethereum': { color: '#8c8cff', text: 'ERC20' },
            'TON': { color: '#0088cc', text: 'TON' },
            'Solana': { color: '#00ff88', text: 'SPL' }
        };
        
        return badges[blockchain] || { color: '#666', text: standard || blockchain };
    };

    const getBlockchainLogo = (blockchain) => {
        return getBlockchainIcon(blockchain);
    };

    if (isLoading) {
        return (
            <div className="page-container">
                <Header 
                    userData={userData} 
                    currentNetwork={network}
                    disableNetworkSwitch={true}
                />
                <div className="page-content">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Loading USDT tokens...</p>
                    </div>
                </div>
                <Menu />
            </div>
        );
    }

    return (
        <div className="page-container">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={true}
            />
            <div className="page-content">
                <div className="token-icon-container">
                    <div className="token-icon-large">
                        <img 
                            src="https://cryptologos.cc/logos/tether-usdt-logo.svg" 
                            alt="USDT"
                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                    </div>
                </div>
                
                <div className="token-balance-display">
                    <div className="token-amount-container">
                        <p className="token-amount">{totalBalance.toFixed(2)} USDT</p>
                    </div>
                    <p className="usd-amount">${totalUSD.toFixed(2)}</p>
                </div>
                
                <div className="usdt-tokens-grid">
                    {usdtTokens.map(token => {
                        const badge = getBlockchainBadge(token.blockchain, token.displayName);
                        const blockchainLogo = getBlockchainLogo(token.blockchain);
                        
                        return (
                            <div 
                                key={token.blockchain} 
                                className="usdt-token-card"
                            >
                                <div className="usdt-token-header">
                                    <div className="usdt-token-icon">
                                        <img 
                                            src={blockchainLogo} 
                                            alt={token.blockchain}
                                            className="blockchain-logo"
                                        />
                                    </div>
                                    <div className="usdt-token-info">
                                        <div className="usdt-token-name">{token.displayName || token.name}</div>
                                        <div 
                                            className="blockchain-badge" 
                                            style={{ backgroundColor: badge.color }}
                                        >
                                            {badge.text}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="usdt-token-balance-display">
                                    <div className="usdt-token-balance">
                                        {token.balance || '0.00'} USDT
                                    </div>
                                    <div className="usdt-token-usd">
                                        ${(parseFloat(token.balance || 0) * 1).toFixed(2)}
                                    </div>
                                </div>
                                
                                <div className="usdt-token-actions">
                                    <button 
                                        className="usdt-action-btn receive"
                                        onClick={() => handleTokenClick(token, 'receive')}
                                    >
                                        Receive
                                    </button>
                                    <button 
                                        className="usdt-action-btn send"
                                        onClick={() => handleTokenClick(token, 'send')}
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <Menu />
        </div>
    );
};

export default USDTDetail;