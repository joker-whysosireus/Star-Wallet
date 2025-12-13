import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { getBalances, getTokenPrices } from '../../Services/storageService';
import './ReceiveToken.css';

const ReceiveToken = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        if (!wallet) {
            navigate('/wallet');
            return;
        }
        
        loadBalances();
    }, []);
    
    const loadBalances = async () => {
        try {
            const updatedWallets = await getBalances([token]);
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
                <Header />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading...</p>
                </div>
                <Menu />
            </div>
        );
    }
    
    return (
        <div className="wallet-page">
            <Header />
            
            <div className="page-content receive-page">
                <div className="receive-header">
                    <h2>Your {token.symbol} Address</h2>
                    <p>Receive {token.symbol} to this address</p>
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
                            
                            <p className="receive-info">
                                Use this address to receive {token.symbol} to your {token.blockchain} wallet
                            </p>
                        </>
                    ) : (
                        <div className="no-address-message">
                            <p>Address not available</p>
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