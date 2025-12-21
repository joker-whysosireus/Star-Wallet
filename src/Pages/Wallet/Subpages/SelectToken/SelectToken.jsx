import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import TokenCard from '../../Components/List/TokenCard';
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
    const [isLoading, setIsLoading] = useState(true);
    const [showSkeleton, setShowSkeleton] = useState(false);
    
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
                setShowSkeleton(false);
                setIsLoading(false);
                return;
            }
            
            const updatedWallets = await getBalances(allTokens, userData);
            setWallets(updatedWallets);
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
    
    const getTitle = () => {
        if (mode === 'send') return 'Select Token to Send';
        if (mode === 'receive') return 'Select Token to Receive';
        return 'Select Token';
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
            
            <div className="page-content">
                <div className="select-token-header">
                    <h1>{getTitle()}</h1>
                </div>
                
                <div className="assets-container">
                    {showSkeleton ? (
                        Array.from({ length: 10 }).map((_, index) => (
                            <div 
                                key={`skeleton-${index}`} 
                                className="token-block"
                                style={{ height: '68px', background: 'rgba(255, 255, 255, 0.03)' }}
                            >
                                <div className="token-card">
                                    <div className="token-left">
                                        <div className="token-icon skeleton-loader" style={{ background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                        <div className="token-names">
                                            <div className="skeleton-loader" style={{ height: '14px', width: '80px', marginBottom: '6px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                            <div className="skeleton-loader" style={{ height: '18px', width: '60px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                        </div>
                                    </div>
                                    <div className="token-right">
                                        <div className="skeleton-loader skeleton-token-balance"></div>
                                        <div className="skeleton-loader skeleton-usd-balance"></div>
                                        <div className="skeleton-loader" style={{ height: '12px', width: '40px', marginTop: '4px', background: 'rgba(255, 255, 255, 0.03)' }}></div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : wallets.length > 0 ? (
                        wallets.map((wallet) => (
                            <div 
                                key={wallet.id} 
                                className="token-block"
                                onClick={() => handleTokenClick(wallet)}
                            >
                                <TokenCard wallet={wallet} />
                            </div>
                        ))
                    ) : (
                        <div className="no-wallets-message">
                            <p>No wallets found</p>
                        </div>
                    )}
                </div>
            </div>
            
            <Menu />
        </div>
    );
};

export default SelectToken;