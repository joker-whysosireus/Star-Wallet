import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRScannerModal from './Components/QR/QRScannerModal';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import { 
    getBalances, 
    getTokenPrices, 
    sendTransaction,
    validateAddress,
    estimateTransactionFee
} from '../../Services/storageService';
import './SendToken.css';

const SendToken = ({ userData }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet, userData } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState('');
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [usdValue, setUsdValue] = useState('0.00');
    const [transactionFee, setTransactionFee] = useState('0');
    const [isAddressValid, setIsAddressValid] = useState(true);
    const [balance, setBalance] = useState('0');
    
    useEffect(() => {
        if (!wallet || !userData) {
            navigate('/wallet');
            return;
        }
        
        loadBalances();
    }, []);
    
    useEffect(() => {
        if (toAddress && token) {
            validateAddressAsync();
        }
    }, [toAddress, token]);
    
    useEffect(() => {
        if (amount && token && toAddress && isAddressValid) {
            estimateFeeAsync();
        }
    }, [amount, token, toAddress, isAddressValid]);
    
    const loadBalances = async () => {
        try {
            const updatedWallets = await getBalances([token], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                const updatedToken = updatedWallets[0];
                setToken(updatedToken);
                setBalance(updatedToken.balance || '0');
                
                const prices = await getTokenPrices();
                const price = prices[token.symbol] || 1;
                const usd = parseFloat(updatedToken.balance || 0) * price;
                setUsdValue(usd.toFixed(2));
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };
    
    const validateAddressAsync = async () => {
        try {
            const isValid = await validateAddress(token.blockchain, toAddress);
            setIsAddressValid(isValid);
        } catch (error) {
            console.error('Address validation error:', error);
            setIsAddressValid(false);
        }
    };
    
    const estimateFeeAsync = async () => {
        try {
            const fee = await estimateTransactionFee(
                token.blockchain,
                token.address,
                toAddress,
                amount,
                token.symbol
            );
            setTransactionFee(fee);
        } catch (error) {
            console.error('Fee estimation error:', error);
            setTransactionFee('0');
        }
    };
    
    const handleSend = async () => {
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            setTransactionStatus({ type: 'error', message: 'Please enter valid address and amount' });
            return;
        }

        if (!isAddressValid) {
            setTransactionStatus({ type: 'error', message: 'Invalid recipient address' });
            return;
        }

        const totalAmount = parseFloat(amount) + parseFloat(transactionFee || 0);
        if (totalAmount > parseFloat(balance || 0)) {
            setTransactionStatus({ type: 'error', message: 'Insufficient balance' });
            return;
        }

        setIsLoading(true);
        setTransactionStatus(null);

        try {
            const result = await sendTransaction({
                blockchain: token.blockchain,
                fromAddress: token.address,
                toAddress: toAddress,
                amount: amount,
                symbol: token.symbol,
                contractAddress: token.contractAddress,
                memo: comment,
                privateKey: userData.private_key,
                seedPhrase: userData.seed_phrase
            });

            if (result.success) {
                setTransactionStatus({ 
                    type: 'success', 
                    message: `Successfully sent ${amount} ${token.symbol}`,
                    hash: result.hash
                });
                
                await loadBalances();
                
                setTimeout(() => {
                    setAmount('');
                    setToAddress('');
                    setComment('');
                }, 3000);
            } else {
                setTransactionStatus({ 
                    type: 'error', 
                    message: `Transaction failed: ${result.error}` 
                });
            }
        } catch (error) {
            setTransactionStatus({ 
                type: 'error', 
                message: `Error: ${error.message}` 
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
        if (balance) {
            const maxAmount = Math.max(0, parseFloat(balance) - parseFloat(transactionFee || 0));
            setAmount(maxAmount.toFixed(6));
        }
    };
    
    const handleSetAmount = (percent) => {
        if (balance) {
            const availableBalance = parseFloat(balance) - parseFloat(transactionFee || 0);
            const value = (availableBalance * percent / 100).toFixed(6);
            setAmount(Math.max(0, parseFloat(value)).toString());
        }
    };
    
    if (!token || !userData) {
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
            <Header userData={userData} />
            
            <div className="page-content send-page">
                <div className="send-header">
                    <h2>Send {token.symbol}</h2>
                    <p>Choose recipient</p>
                </div>
                
                <div className="send-content">
                    <div className="address-input-container">
                        <div className="address-input-wrapper">
                            <input
                                type="text"
                                value={toAddress}
                                onChange={(e) => setToAddress(e.target.value)}
                                placeholder={`Enter ${token.blockchain} address`}
                                className={`address-input ${!isAddressValid && toAddress ? 'invalid' : ''}`}
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
                                    ${(parseFloat(amount || 0) * (parseFloat(usdValue) / parseFloat(balance || 1))).toFixed(2)}
                                </div>
                            </div>
                            <div className="amount-right">
                                <button className="max-btn" onClick={handleMaxAmount}>
                                    Max
                                </button>
                                <div className="balance-display">
                                    Balance: {balance} {token.symbol}
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
                                max={balance}
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
                </div>
                
                <button 
                    className="send-button"
                    onClick={handleSend}
                    disabled={isLoading || !toAddress || !amount || !isAddressValid}
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