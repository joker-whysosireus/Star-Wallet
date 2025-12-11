// Pages/Wallet/Subpages/Receive/ReceiveToken.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { getBalances, getTokenPrices } from '../../Services/storageService';
import './ReceiveToken.css';

const ReceiveToken = ({ userData }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        if (!wallet || !userData) {
            navigate('/wallet');
            return;
        }
        
        loadBalances();
    }, []);
    
    const loadBalances = async () => {
        try {
            const updatedWallets = await getBalances([token], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                setToken(updatedWallets[0]);
                const prices = await getTokenPrices();
                const price = prices[token.symbol] || 1;
                const usd = parseFloat(updatedWallets[0].balance) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };
    
    const handleCopyAddress = () => {
        if (token?.address) {
            navigator.clipboard.writeText(token.address)
                .then(() => {
                    alert('Address copied to clipboard!');
                });
        }
    };
    
    if (!token) {
        return (
            <div className="wallet-page">
                <Header userData={userData} />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading...</p>
                </div>
                <Menu />
            </div>
        );
    }
    
    const getHeaderText = () => {
        if (token.symbol === 'USDT' || token.symbol === 'USDC') {
            return `Your ${token.blockchain} ${token.symbol} Address`;
        }
        return `Your ${token.symbol} Address`;
    };
    
    const getSubHeaderText = () => {
        if (token.symbol === 'USDT' || token.symbol === 'USDC') {
            return `Receive ${token.symbol} to this ${token.blockchain} address`;
        }
        return `Receive ${token.symbol} to this address`;
    };
    
    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
            <div className="page-content receive-page">
                <div className="receive-header">
                    <h2>{getHeaderText()}</h2>
                    <p>{getSubHeaderText()}</p>
                </div>
                
                <div className="receive-content">
                    <div className="warning-banner">
                        Only send {token.symbol} tokens to this address
                    </div>
                    
                    {token.address ? (
                        <>
                            <div className="qr-container">
                                <div className="qr-wrapper">
                                    <QRCode 
                                        value={token.address} 
                                        size={180}
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                    />
                                </div>
                            </div>
                            
                            <div className="address-display">
                                <p className="address-label">{token.blockchain} Address:</p>
                                <p className="address-value">{token.address}</p>
                            </div>
                            
                            <p className="receive-info">
                                Use this address to receive {token.symbol} to your {token.blockchain} wallet
                            </p>
                            
                            <div className="balance-info">
                                <p>Current Balance: {token.balance || '0.00'} {token.symbol}</p>
                                <p className="usd-balance">≈ ${usdValue}</p>
                            </div>
                        </>
                    ) : (
                        <div className="no-address-message">
                            <p>Address not available</p>
                            <p>Please make sure your wallet is properly initialized</p>
                        </div>
                    )}
                </div>
                
                <button 
                    className="copy-address-btn"
                    onClick={handleCopyAddress}
                    disabled={!token.address}
                >
                    Copy Address
                </button>
            </div>
            
            <Menu />
        </div>
    );
};

export default ReceiveToken;