import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getBalances, 
    getTokenPricesFromRPC
} from '../../Services/storageService';
import './ReceiveToken.css';

const ReceiveToken = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet, userData } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [usdValue, setUsdValue] = useState('0.00');
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        if (!wallet || !userData) {
            navigate('/wallet');
            return;
        }
        
        setToken(wallet);
        loadBalances();
    }, []);
    
    const loadBalances = async () => {
        try {
            const updatedWallets = await getBalances([token], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                const updatedToken = updatedWallets[0];
                setToken(updatedToken);
                
                const prices = await getTokenPricesFromRPC();
                const price = prices[token.symbol] || 1;
                const usd = parseFloat(updatedToken.balance || 0) * price;
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
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                });
        }
    };
    
    if (!token || !userData) {
        return null; // Не показываем loader, просто ничего не показываем
    }
    
    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
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
                    {copied ? 'Copied!' : 'Copy Address'}
                </button>
            </div>
            
            <Menu />
        </div>
    );
};

export default ReceiveToken;