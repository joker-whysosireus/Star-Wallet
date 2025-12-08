import React, { useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import QRScannerModal from './QRScannerModal';
import Header from '../../../assets/Header/Header';
import Menu from '../../../assets/Menus/Menu/Menu';
import { TOKENS } from '../Services/tokensConfig';
import { 
    getBalances,
    getTokenPrices 
} from '../Services/storageService';
import './TokenDetail.css';

const TokenDetail = () => {
    const { symbol } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    
    const [wallet, setWallet] = useState(null);
    const [mode, setMode] = useState('view');
    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState('');
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [usdValue, setUsdValue] = useState('0.00');
    
    useEffect(() => {
        const walletData = location.state?.wallet || location.state;
        
        if (walletData) {
            setWallet(walletData);
            loadBalances();
        } else if (symbol) {
            const token = Object.values(TOKENS).find(t => t.symbol === symbol);
            if (token) {
                const mockWallet = {
                    ...token,
                    address: 'TQCc68Mp5dZ2Lm9XrJARoqo2D4Xtye5gFkR',
                    balance: '25.43',
                    isActive: true
                };
                setWallet(mockWallet);
                setUsdValue((25.43 * 6.24).toFixed(2));
            }
        }
        
        setIsLoading(false);
    }, [symbol, location.state]);

    const loadBalances = async () => {
        if (!wallet) return;
        
        try {
            const updatedWallets = await getBalances([wallet]);
            if (updatedWallets && updatedWallets.length > 0) {
                setWallet(updatedWallets[0]);
                const prices = await getTokenPrices();
                const price = prices[wallet.symbol] || 1;
                const usd = parseFloat(updatedWallets[0].balance) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };

    const handleCopyAddress = () => {
        if (wallet?.address) {
            navigator.clipboard.writeText(wallet.address)
                .then(() => {
                    alert('Address copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy address:', err);
                });
        }
    };

    const handleSend = async () => {
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            setTransactionStatus({ type: 'error', message: 'Please enter valid address and amount' });
            return;
        }

        if (parseFloat(amount) > parseFloat(wallet.balance || 0)) {
            setTransactionStatus({ type: 'error', message: 'Insufficient balance' });
            return;
        }

        setIsLoading(true);
        setTransactionStatus(null);

        setTimeout(() => {
            setIsLoading(false);
            setTransactionStatus({ 
                type: 'success', 
                message: `Successfully sent ${amount} ${wallet.symbol} to ${toAddress.substring(0, 10)}...` 
            });
            setAmount('');
            setToAddress('');
            setComment('');
            
            const newBalance = parseFloat(wallet.balance) - parseFloat(amount);
            setWallet({ ...wallet, balance: newBalance.toFixed(4) });
        }, 2000);
    };

    const handleScanQR = (scannedData) => {
        setToAddress(scannedData);
        setShowQRScanner(false);
    };

    const handleMaxAmount = () => {
        if (wallet?.balance) {
            setAmount(wallet.balance);
        }
    };

    const handleSetAmount = (percent) => {
        if (wallet?.balance) {
            const value = (parseFloat(wallet.balance) * percent / 100).toFixed(6);
            setAmount(value);
        }
    };

    if (isLoading && !wallet) {
        return (
            <div className="page-container">
                <Header />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading token details...</p>
                </div>
                <Menu />
            </div>
        );
    }

    if (!wallet) {
        return (
            <div className="page-container">
                <Header />
                <div className="page-content">
                    <h1 style={{ color: 'white' }}>Token not found</h1>
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

    // View Mode
    if (mode === 'view') {
        return (
            <div className="page-container">
                <Header />
                
                <div className="page-content">
                    <div className="token-header">
                        <h1>{wallet.name}</h1>
                    </div>
                    
                    <div className="token-icon-container">
                        <div className="token-icon-large">
                            {wallet.symbol.substring(0, 2)}
                        </div>
                    </div>
                    
                    <div className="token-balance-display">
                        <p className="token-amount">{wallet.balance || '0.00'} {wallet.symbol}</p>
                        <p className="usd-amount">${usdValue}</p>
                    </div>
                    
                    <div className="action-buttons">
                        <button 
                            className="action-btn"
                            onClick={() => setMode('receive')}
                        >
                            <span className="action-btn-icon">↓</span>
                            <span className="action-btn-text">Receive</span>
                        </button>
                        <button 
                            className="action-btn"
                            onClick={() => setMode('send')}
                        >
                            <span className="action-btn-icon">↑</span>
                            <span className="action-btn-text">Send</span>
                        </button>
                        <button 
                            className="action-btn"
                            onClick={() => navigate('/swap')}
                        >
                            <span className="action-btn-icon">↔</span>
                            <span className="action-btn-text">Swap</span>
                        </button>
                    </div>
                </div>
                
                <Menu />
            </div>
        );
    }

    // Receive Mode
    if (mode === 'receive') {
        return (
            <div className="page-container">
                <Header />
                
                <div className="page-content">
                    <div className="receive-header">
                        <h2>Your {wallet.symbol} Address</h2>
                        <p>Receive {wallet.symbol} to this address</p>
                    </div>
                    
                    <div className="warning-banner">
                        Only send {wallet.symbol} tokens to this address
                    </div>
                    
                    {wallet.address ? (
                        <>
                            <div className="qr-container">
                                <div className="qr-wrapper">
                                    <QRCode 
                                        value={wallet.address} 
                                        size={180}
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                    />
                                </div>
                            </div>
                            
                            <p className="receive-info">
                                Use this address to receive {wallet.symbol} to your {wallet.blockchain} wallet
                            </p>
                        </>
                    ) : (
                        <div className="no-address-message">
                            <p>Address not available</p>
                        </div>
                    )}
                    
                    <button 
                        className="copy-address-btn"
                        onClick={handleCopyAddress}
                        disabled={!wallet.address}
                    >
                        Copy Address
                    </button>
                </div>
                
                <Menu />
            </div>
        );
    }

    // Send Mode
    if (mode === 'send') {
        return (
            <div className="page-container">
                <Header />
                
                <div className="page-content">
                    <div className="send-header">
                        <h2>Send {wallet.symbol}</h2>
                        <p>Choose recipient</p>
                    </div>
                    
                    <div className="address-input-container">
                        <div className="address-input-wrapper">
                            <input
                                type="text"
                                value={toAddress}
                                onChange={(e) => setToAddress(e.target.value)}
                                placeholder="Enter recipient address"
                                className="address-input"
                            />
                            <div className="address-divider"></div>
                            <button 
                                className="scan-btn"
                                onClick={() => setShowQRScanner(true)}
                                disabled={isLoading}
                            >
                                📷
                            </button>
                        </div>
                    </div>
                    
                    <div className="amount-section">
                        <div className="amount-header">
                            <div className="amount-left">
                                <div className="amount-label">Enter amount</div>
                                <div className="amount-display">
                                    <span className="token-amount-small">{amount || '0'}</span>
                                    <span className="token-symbol-small">{wallet.symbol}</span>
                                </div>
                                <div className="usd-display">
                                    ${(parseFloat(amount || 0) * (parseFloat(usdValue) / parseFloat(wallet.balance || 1))).toFixed(2)}
                                </div>
                            </div>
                            <div className="amount-right">
                                <button className="max-btn" onClick={handleMaxAmount}>
                                    Max
                                </button>
                                <div className="balance-display">
                                    Balance: ${usdValue}
                                </div>
                            </div>
                        </div>
                        
                        {/* Кнопки быстрого выбора */}
                        <div className="amount-buttons">
                            <button 
                                className="amount-button"
                                onClick={() => handleSetAmount(25)}
                            >
                                <span className="amount-button-icon">¼</span>
                                25%
                            </button>
                            <button 
                                className="amount-button"
                                onClick={() => handleSetAmount(50)}
                            >
                                <span className="amount-button-icon">½</span>
                                50%
                            </button>
                            <button 
                                className="amount-button"
                                onClick={() => handleSetAmount(75)}
                            >
                                <span className="amount-button-icon">¾</span>
                                75%
                            </button>
                            <button 
                                className="amount-button"
                                onClick={handleMaxAmount}
                            >
                                <span className="amount-button-icon">M</span>
                                Max
                            </button>
                        </div>
                        
                        <div className="amount-input-container">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.0"
                                className="amount-input"
                                min="0"
                                max={wallet.balance}
                                step="0.000001"
                            />
                        </div>
                        
                        <input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Comment (optional)"
                            className="comment-input"
                        />
                    </div>
                    
                    {transactionStatus && (
                        <div className={`transaction-status ${transactionStatus.type}`}>
                            {transactionStatus.message}
                        </div>
                    )}
                    
                    <button 
                        className="send-button"
                        onClick={handleSend}
                        disabled={isLoading || !toAddress || !amount}
                    >
                        {isLoading ? 'Sending...' : 'Send'}
                    </button>
                </div>
                
                {showQRScanner && (
                    <QRScannerModal
                        isOpen={showQRScanner}
                        onClose={() => setShowQRScanner(false)}
                        onScan={handleScanQR}
                    />
                )}
                
                <Menu />
            </div>
        );
    }

    return null;
};

export default TokenDetail;