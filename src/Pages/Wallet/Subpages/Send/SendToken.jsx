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
    const { wallet, userData } = location.state || {};
    
    const [token, setToken] = useState(wallet);
    const [amount, setAmount] = useState('');
    const [toAddress, setToAddress] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [transactionStatus, setTransactionStatus] = useState(null);
    const [transactionFee, setTransactionFee] = useState('0');
    const [isAddressValid, setIsAddressValid] = useState(true);
    const [balance, setBalance] = useState('0');
    
    const amountInputRef = useRef(null);
    const underlineRef = useRef(null);
    
    useEffect(() => {
        if (!wallet || !userData) {
            navigate('/wallet');
            return;
        }
        
        setToken(wallet);
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
    
    useEffect(() => {
        // Запускаем пульсацию полосы при фокусе
        if (amountInputRef.current === document.activeElement) {
            if (underlineRef.current) {
                underlineRef.current.classList.add('pulsing');
            }
        }
    }, [amount]);
    
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
            const fee = await estimateTransactionFee(token.blockchain);
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
            let privateKey = userData.private_key;
            
            if (!privateKey && userData.seed_phrases && 
                (token.blockchain === 'Ethereum' || token.blockchain === 'BSC')) {
                const { ethers } = await import('ethers');
                const { mnemonicToSeedSync } = await import('bip39');
                
                const seed = mnemonicToSeedSync(userData.seed_phrases);
                const hdNode = ethers.HDNodeWallet.fromSeed(seed);
                const ethWallet = hdNode.derivePath("m/44'/60'/0'/0/0");
                privateKey = ethWallet.privateKey;
            }

            const result = await sendTransaction({
                blockchain: token.blockchain,
                fromAddress: token.address,
                toAddress: toAddress,
                amount: amount,
                symbol: token.symbol,
                contractAddress: token.contractAddress,
                memo: '',
                privateKey: privateKey,
                seedPhrase: userData.seed_phrases
            });

            if (result.success) {
                setTransactionStatus({ 
                    type: 'success', 
                    message: `Successfully sent ${amount} ${token.symbol}`,
                    hash: result.hash,
                    explorerUrl: result.explorerUrl
                });
                
                setTimeout(async () => {
                    await loadBalances();
                    
                    setTimeout(() => {
                        setAmount('');
                        setToAddress('');
                    }, 3000);
                }, 5000);
            } else {
                setTransactionStatus({ 
                    type: 'error', 
                    message: `Transaction failed: ${result.error}` 
                });
            }
        } catch (error) {
            console.error('Transaction error:', error);
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
            'TON': { color: '#0088cc', bg: 'rgba(0, 136, 204, 0.1)' },
            'Solana': { color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)' },
            'Ethereum': { color: '#8c8cff', bg: 'rgba(140, 140, 255, 0.1)' },
            'Tron': { color: '#ff0000', bg: 'rgba(255, 0, 0, 0.1)' },
            'Bitcoin': { color: '#f7931a', bg: 'rgba(247, 147, 26, 0.1)' },
            'NEAR': { color: '#0b4731', bg: 'rgba(11, 71, 49, 0.1)' },
            'BSC': { color: '#bfcd43', bg: 'rgba(191, 205, 67, 0.1)' },
        };
        
        return badges[blockchain] || { color: '#666', bg: 'rgba(102, 102, 102, 0.1)' };
    };
    
    if (!token || !userData) {
        return null;
    }
    
    const badge = getBlockchainBadge(token.blockchain);
    
    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
            <div className="page-content send-page">
                <div className="send-header">
                    <h2>Send {token.symbol}</h2>
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
                            />
                            <div className="qr-button-wrapper">
                                <button 
                                    className="qr-button"
                                    onClick={() => setShowQRScanner(true)}
                                    disabled={isLoading}
                                    title="Scan QR Code"
                                >
                                    <svg className="qr-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M1 1h8v8H1V1zm2 2v4h4V3H3zM1 15h8v8H1v-8zm2 2v4h4v-4H3zM15 1h8v8h-8V1zm2 2v4h4V3h-4zM15 15h8v8h-8v-8zm2 2v4h4v-4h-4z"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="amount-section">
                        <div className="amount-input-container" onClick={focusAmountInput}>
                            <div className="amount-row">
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
                                />
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
                                        color: badge.color,
                                        backgroundColor: badge.bg
                                    }}
                                >
                                    {token.blockchain}
                                </div>
                            </div>
                            <div 
                                ref={underlineRef}
                                className="amount-underline"
                                style={{ 
                                    width: `${Math.max(40, amount ? amount.length * 20 : 40)}px`,
                                    maxWidth: '250px'
                                }}
                            ></div>
                            <div className="balance-display">
                                Balance: {balance} {token.symbol}
                            </div>
                        </div>
                        
                        <div className="percentage-buttons">
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(25)}
                            >
                                25%
                            </button>
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(50)}
                            >
                                50%
                            </button>
                            <button 
                                className="percentage-button"
                                onClick={() => handleSetAmount(75)}
                            >
                                75%
                            </button>
                            <button 
                                className="percentage-button max-button"
                                onClick={handleMaxAmount}
                            >
                                MAX
                            </button>
                        </div>
                    </div>
                    
                    {transactionStatus && (
                        <div className={`transaction-status ${transactionStatus.type}`}>
                            {transactionStatus.message}
                            {transactionStatus.hash && (
                                <div className="transaction-hash">
                                    Hash: {transactionStatus.hash.substring(0, 20)}...
                                </div>
                            )}
                            {transactionStatus.explorerUrl && (
                                <button 
                                    className="view-explorer-btn"
                                    onClick={() => window.open(transactionStatus.explorerUrl, '_blank')}
                                >
                                    View on Explorer
                                </button>
                            )}
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