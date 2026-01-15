import React, { useState, useEffect, useRef } from 'react';
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

const SendToken = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { wallet, userData, network = 'mainnet' } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState('');
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [transactionFee, setTransactionFee] = useState('0');
    const [isAddressValid, setIsAddressValid] = useState(true);
    const [balance, setBalance] = useState('0');
    const [isCameraAvailable, setIsCameraAvailable] = useState(true);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [transactionResult, setTransactionResult] = useState(null);
    
    const amountInputRef = useRef(null);
    const underlineRef = useRef(null);
    const toastTimeoutRef = useRef(null);
    
    useEffect(() => {
        if (!wallet || !userData) {
            navigate('/wallet');
            return;
        }
        
        setToken(wallet);
        loadBalances();
        checkCameraAvailability();
        
        return () => {
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
            }
        };
    }, []);
    
    const showToastMessage = (message, type = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setShowToast(true);
        
        if (toastTimeoutRef.current) {
            clearTimeout(toastTimeoutRef.current);
        }
        
        toastTimeoutRef.current = setTimeout(() => {
            setShowToast(false);
        }, 5000);
    };
    
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            showToastMessage('Copied to clipboard!', 'info');
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    };
    
    const checkCameraAvailability = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setIsCameraAvailable(false);
                return;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            setIsCameraAvailable(videoDevices.length > 0);
        } catch (error) {
            console.error('Camera check error:', error);
            setIsCameraAvailable(false);
        }
    };
    
    useEffect(() => {
        if (toAddress && token) {
            validateAddressAsync();
        }
    }, [toAddress, token, network]);
    
    useEffect(() => {
        if (amount && token && toAddress && isAddressValid) {
            estimateFeeAsync();
        }
    }, [amount, token, toAddress, isAddressValid, network]);
    
    const loadBalances = async () => {
        try {
            const updatedWallets = await getBalances([token], userData);
            if (updatedWallets && updatedWallets.length > 0) {
                const updatedToken = updatedWallets[0];
                setToken(updatedToken);
                setBalance(updatedToken.balance || '0');
            }
        } catch (error) {
            console.error('Error loading balances:', error);
        }
    };
    
    const validateAddressAsync = async () => {
        if (!toAddress.trim()) {
            setIsAddressValid(true);
            return;
        }
        
        try {
            const isValid = await validateAddress(token.blockchain, toAddress, network);
            setIsAddressValid(isValid);
        } catch (error) {
            console.error('Address validation error:', error);
            setIsAddressValid(false);
        }
    };
    
    const estimateFeeAsync = async () => {
        try {
            const fee = await estimateTransactionFee(token.blockchain, network);
            setTransactionFee(fee);
        } catch (error) {
            console.error('Fee estimation error:', error);
            setTransactionFee('0');
        }
    };
    
    const handleSend = async () => {
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            showToastMessage('Please enter valid address and amount', 'error');
            return;
        }

        if (!isAddressValid) {
            showToastMessage('Invalid recipient address', 'error');
            return;
        }

        // Проверка минимальных сумм
        if (token.blockchain === 'Bitcoin') {
            const amountSats = parseFloat(amount) * 100000000;
            if (amountSats < 546) {
                showToastMessage('Minimum Bitcoin amount is 0.00000546 BTC', 'error');
                return;
            }
        }

        if (token.blockchain === 'NEAR') {
            if (parseFloat(amount) < 0.001) {
                showToastMessage('Minimum NEAR amount is 0.001', 'error');
                return;
            }
        }

        const totalAmount = parseFloat(amount) + parseFloat(transactionFee || 0);
        if (totalAmount > parseFloat(balance || 0)) {
            showToastMessage('Insufficient balance', 'error');
            return;
        }

        setIsLoading(true);
        setTransactionStatus(null);
        setSendSuccess(false);
        setShowSuccessModal(false);
        setShowErrorModal(false);

        try {
            const txParams = {
                blockchain: token.blockchain,
                toAddress: toAddress,
                amount: amount,
                seedPhrase: userData.seed_phrases,
                memo: comment,
                network: network
            };

            if (token.contractAddress && !(token.blockchain === 'TRON' && token.symbol === 'TRX')) {
                txParams.contractAddress = token.contractAddress;
            }

            const result = await sendTransaction(txParams);

            if (result.success) {
                setSendSuccess(true);
                setTransactionResult(result);
                
                // Показываем модальное окно успеха
                setShowSuccessModal(true);
                
                setTransactionStatus({ 
                    type: 'success', 
                    message: `Successfully sent ${amount} ${token.symbol}`,
                    hash: result.hash,
                    explorerUrl: result.explorerUrl
                });
                
                // Обновляем баланс через 2 секунды
                setTimeout(async () => {
                    await loadBalances();
                }, 2000);
                
                // Сбрасываем форму через 5 секунд
                setTimeout(() => {
                    if (showSuccessModal) {
                        setShowSuccessModal(false);
                    }
                    setAmount('');
                    setToAddress('');
                    setComment('');
                    setTransactionStatus(null);
                    setSendSuccess(false);
                }, 5000);
            } else {
                setTransactionResult(result);
                setShowErrorModal(true);
                
                setTransactionStatus({ 
                    type: 'error', 
                    message: `Transaction failed: ${result.error}` 
                });
            }
        } catch (error) {
            console.error('Transaction error:', error);
            setTransactionResult({ error: error.message });
            setShowErrorModal(true);
            
            setTransactionStatus({ 
                type: 'error', 
                message: `Error: ${error.message}` 
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleScanQR = (scannedData) => {
        if (!scannedData || typeof scannedData !== 'string') {
            showToastMessage('Invalid QR code data', 'error');
            return;
        }
        
        setToAddress(scannedData);
        setShowQRScanner(false);
        
        if (scannedData && token) {
            setTimeout(() => {
                validateAddressAsync();
            }, 100);
        }
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
    
    const focusAmountInput = () => {
        if (amountInputRef.current) {
            amountInputRef.current.focus();
            if (underlineRef.current) {
                underlineRef.current.classList.add('pulsing');
            }
        }
    };
    
    const handleInputBlur = () => {
        if (underlineRef.current) {
            underlineRef.current.classList.remove('pulsing');
        }
    };
    
    const getBlockchainBadge = (blockchain) => {
        const badges = {
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)', text: 'TON' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)', text: 'SOL' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)', text: 'ETH' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)', text: 'BTC' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)', text: 'BNB' },
            'BitcoinCash': { color: '#8dc351', bg: 'rgba(141, 195, 81, 0.1)', text: 'BCH' },
            'Litecoin': { color: '#bfbbbf', bg: 'rgba(191, 187, 191, 0.1)', text: 'LTC' },
            'EthereumClassic': { color: '#6c8cf2', bg: 'rgba(108, 140, 242, 0.1)', text: 'ETC' },
            'NEAR': { color: '#000000', bg: 'rgba(0, 0, 0, 0.1)', text: 'NEAR' },
            'TRON': { color: '#ff060a', bg: 'rgba(255, 6, 10, 0.1)', text: 'TRX' }
        };
        
        return badges[blockchain] || { color: '#666', bg: 'rgba(102, 102, 102, 0.1)', text: blockchain.substring(0, 4).toUpperCase() };
    };
    
    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false);
        setAmount('');
        setToAddress('');
        setComment('');
        setTransactionStatus(null);
        setSendSuccess(false);
    };
    
    const handleCloseErrorModal = () => {
        setShowErrorModal(false);
    };
    
    const handleViewExplorer = () => {
        if (transactionResult?.explorerUrl) {
            window.open(transactionResult.explorerUrl, '_blank');
        }
    };
    
    if (!token || !userData) {
        return null;
    }
    
    const badge = getBlockchainBadge(token.blockchain);
    const buttonText = sendSuccess ? '✓ Sent!' : (isLoading ? 'Sending...' : 'Send');
    
    return (
        <div className="wallet-page">
            <Header 
                userData={userData} 
                currentNetwork={network}
                disableNetworkSwitch={false}
            />
            
            <div className="page-content send-page">
                <div className="send-header">
                    <h2>Send {token.symbol} ({network})</h2>
                    <p>Choose recipient</p>
                </div>
                
                <div className="send-content">
                    <div className="address-section">
                        <div className="address-input-wrapper">
                            <input
                                type="text"
                                value={toAddress}
                                onChange={(e) => setToAddress(e.target.value)}
                                placeholder={`Enter ${token.blockchain} address`}
                                className={`address-input ${!isAddressValid && toAddress ? 'invalid' : ''}`}
                                disabled={isLoading}
                            />
                            <div className="qr-button-wrapper">
                                <button 
                                    className="qr-button"
                                    onClick={() => setShowQRScanner(true)}
                                    disabled={isLoading || !isCameraAvailable}
                                    title="Scan QR Code"
                                >
                                    <svg className="qr-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M1 1h8v8H1V1zm2 2v4h4V3H3zM1 15h8v8H1v-8zm2 2v4h4v-4H3zM15 1h8v8h-8V1zm2 2v4h4V3h-4zM15 15h8v8h-8v-8zm2 2v4h4v-4h-4z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <input
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Comment (optional)"
                            className="comment-input"
                            disabled={isLoading}
                        />
                    </div>
                    
                    <div className="amount-section">
                        <div className="amount-input-container" onClick={focusAmountInput}>
                            <div className="amount-row">
                                <div className="amount-input-wrapper">
                                    <input
                                        ref={amountInputRef}
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onBlur={handleInputBlur}
                                        placeholder="0"
                                        className="amount-input"
                                        min="0"
                                        max={balance}
                                        step="0.000001"
                                        inputMode="decimal"
                                        disabled={isLoading}
                                    />
                                    <div 
                                        ref={underlineRef}
                                        className="amount-underline"
                                    ></div>
                                </div>
                                <div className="token-icon-large">
                                    <img 
                                        src={token.logo} 
                                        alt={token.symbol}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            const fallback = document.createElement('div');
                                            fallback.className = 'token-icon-fallback-large';
                                            fallback.textContent = token.symbol.substring(0, 2);
                                            e.target.parentNode.appendChild(fallback);
                                        }}
                                    />
                                </div>
                                <div 
                                    className="blockchain-badge"
                                    style={{ 
                                        backgroundColor: badge.color,
                                        color: 'white'
                                    }}
                                >
                                    {badge.text}
                                </div>
                            </div>
                            <div className="balance-display">
                                Balance: {balance} {token.symbol}
                            </div>
                        </div>
                        
                        <div className="percentage-buttons">
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(25)}
                                disabled={isLoading}
                            >
                                25%
                            </button>
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(50)}
                                disabled={isLoading}
                            >
                                50%
                            </button>
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(75)}
                                disabled={isLoading}
                            >
                                75%
                            </button>
                            <button 
                                className="percentage-button max-button"
                                onClick={handleMaxAmount}
                                disabled={isLoading}
                            >
                                MAX
                            </button>
                        </div>
                    </div>
                    
                    {transactionStatus && (
                        <div className={`transaction-status ${transactionStatus.type}`}>
                            {transactionStatus.message}
                            {transactionStatus.hash && (
                                <>
                                    <div className="transaction-hash">
                                        Hash: {transactionStatus.hash}
                                    </div>
                                    {transactionStatus.explorerUrl && (
                                        <button 
                                            className="view-explorer-btn"
                                            onClick={() => window.open(transactionStatus.explorerUrl, '_blank')}
                                        >
                                            View on Explorer
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
                
                <button 
                    className={`send-button ${sendSuccess ? 'send-button-success' : ''} ${isLoading ? 'send-button-loading' : ''}`}
                    onClick={handleSend}
                    disabled={isLoading || !toAddress || !amount || !isAddressValid || sendSuccess}
                >
                    {isLoading ? (
                        <div className="spinner-container">
                            <div className="spinner"></div>
                            <span>Sending...</span>
                        </div>
                    ) : buttonText}
                </button>
                
                {/* Toast Notifications */}
                {showToast && (
                    <div className={`toast-notification toast-${toastType}`}>
                        <div className="toast-content">
                            <span className="toast-message">{toastMessage}</span>
                            <button 
                                className="toast-close"
                                onClick={() => setShowToast(false)}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Success Modal */}
                {showSuccessModal && (
                    <div className="modal-overlay">
                        <div className="modal-content success-modal">
                            <div className="modal-icon">✓</div>
                            <h3 className="modal-title">Success!</h3>
                            <p className="modal-message">
                                You have successfully sent {amount} {token.symbol}
                            </p>
                            {transactionResult?.explorerUrl && (
                                <button 
                                    className="modal-button explorer-button"
                                    onClick={handleViewExplorer}
                                >
                                    View Transaction
                                </button>
                            )}
                            <button 
                                className="modal-button close-button"
                                onClick={handleCloseSuccessModal}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Error Modal */}
                {showErrorModal && (
                    <div className="modal-overlay">
                        <div className="modal-content error-modal">
                            <div className="modal-icon">✗</div>
                            <h3 className="modal-title">Transaction Failed</h3>
                            <p className="modal-message">
                                {transactionResult?.error || 'Unknown error occurred'}
                            </p>
                            <div className="modal-actions">
                                <button 
                                    className="modal-button copy-button"
                                    onClick={() => copyToClipboard(transactionResult?.error || '')}
                                >
                                    Copy Error
                                </button>
                                <button 
                                    className="modal-button close-button"
                                    onClick={handleCloseErrorModal}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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