// Pages/Wallet/Subpages/Send/SendToken.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRScannerModal from './Components/QR/QRScannerModal';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { getBalances, getTokenPrices } from '../../Services/storageService';
import { sendTon } from '../../Services/tonService';
import { sendSol } from '../../Services/solanaService';
import { sendEth, sendERC20 } from '../../Services/ethereumService';
import './SendToken.css';

const SendToken = ({ userData }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState('');
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
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
    
    const handleSend = async () => {
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            setTransactionStatus({ type: 'error', message: 'Please enter valid address and amount' });
            return;
        }

        if (parseFloat(amount) > parseFloat(token.balance || 0)) {
            setTransactionStatus({ type: 'error', message: 'Insufficient balance' });
            return;
        }

        setIsLoading(true);
        setTransactionStatus(null);

        try {
            let result;
            
            const serviceParams = {
                toAddress,
                amount,
                comment,
                userData
            };
            
            switch (token.blockchain) {
                case 'TON':
                    result = await sendTon(serviceParams);
                    break;
                case 'Solana':
                    result = await sendSol(serviceParams);
                    break;
                case 'Ethereum':
                    if (token.symbol === 'ETH') {
                        result = await sendEth(serviceParams);
                    } else if (token.contractAddress) {
                        result = await sendERC20({
                            ...serviceParams,
                            contractAddress: token.contractAddress,
                            decimals: token.decimals
                        });
                    } else {
                        throw new Error('Unsupported token');
                    }
                    break;
                default:
                    throw new Error('Unsupported blockchain');
            }

            if (result.success) {
                setTransactionStatus({ 
                    type: 'success', 
                    message: `Successfully sent ${amount} ${token.symbol} to ${toAddress.substring(0, 10)}...`,
                    hash: result.hash,
                    explorerUrl: result.explorerUrl
                });
                setAmount('');
                setToAddress('');
                setComment('');
                
                const newBalance = parseFloat(token.balance) - parseFloat(amount);
                setToken({ ...token, balance: newBalance.toFixed(4) });
                
                setTimeout(() => {
                    navigate('/wallet');
                }, 3000);
            } else {
                throw new Error(result.message || 'Transaction failed');
            }
        } catch (error) {
            console.error('Error sending transaction:', error);
            setTransactionStatus({ 
                type: 'error', 
                message: error.message || 'Failed to send transaction'
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleScanQR = (scannedData) => {
        setToAddress(scannedData);
        setShowQRScanner(false);
    };
    
    const handleMaxAmount = () => {
        if (token?.balance) {
            const maxAmount = parseFloat(token.balance);
            let fee = 0;
            
            switch (token.blockchain) {
                case 'TON':
                    fee = 0.05;
                    break;
                case 'Solana':
                    fee = 0.000005;
                    break;
                case 'Ethereum':
                    fee = token.symbol === 'ETH' ? 0.001 : 0.005;
                    break;
            }
            
            const available = maxAmount - fee;
            if (available > 0) {
                setAmount(available.toFixed(6));
            } else {
                setAmount('0');
            }
        }
    };
    
    const handleSetAmount = (percent) => {
        if (token?.balance) {
            const value = (parseFloat(token.balance) * percent / 100).toFixed(6);
            setAmount(value);
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
            return `Send ${token.blockchain} ${token.symbol}`;
        }
        return `Send ${token.symbol}`;
    };
    
    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
            <div className="page-content send-page">
                <div className="send-header">
                    <h2>{getHeaderText()}</h2>
                    <p>Choose recipient</p>
                </div>
                
                <div className="send-content">
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
                                QR
                            </button>
                        </div>
                    </div>
                    
                    <div className="amount-section">
                        <div className="amount-header">
                            <div className="amount-left">
                                <div className="amount-label">Enter amount</div>
                                <div className="amount-display">
                                    <span className="token-amount-small">{amount || '0'}</span>
                                    <span className="token-symbol-small">{token.symbol}</span>
                                </div>
                                <div className="usd-display">
                                    ${(parseFloat(amount || 0) * (parseFloat(usdValue) / parseFloat(token.balance || 1))).toFixed(2)}
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
                                max={token.balance}
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
                            {transactionStatus.hash && (
                                <div className="transaction-hash">
                                    Hash: <a href={transactionStatus.explorerUrl} target="_blank" rel="noopener noreferrer">
                                        {transactionStatus.hash.substring(0, 20)}...
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
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
};

export default SendToken;