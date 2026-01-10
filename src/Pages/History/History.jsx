import React, { useState, useEffect } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import './History.css';
import { generateWalletsFromSeed, getTokenPrices, getBlockchainIcon } from '../Wallet/Services/storageService';

function History({ userData }) {
    const [currentNetwork, setCurrentNetwork] = useState(() => {
        const savedNetwork = localStorage.getItem('selected_network');
        return savedNetwork || 'mainnet';
    });
    
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [groupedTransactions, setGroupedTransactions] = useState({});
    const [tokenPrices, setTokenPrices] = useState({});

    useEffect(() => {
        if (userData?.telegram_user_id) {
            loadTransactions();
        }
        
        loadTokenPrices();
        
        const priceInterval = setInterval(loadTokenPrices, 60000);
        
        return () => clearInterval(priceInterval);
    }, [userData, currentNetwork]);

    const loadTokenPrices = async () => {
        try {
            const prices = await getTokenPrices();
            setTokenPrices(prices);
        } catch (error) {
            console.error('Error loading token prices:', error);
        }
    };

    const loadTransactions = async () => {
        setIsLoading(true);
        try {
            if (!userData?.telegram_user_id) {
                console.log('No user ID found');
                setIsLoading(false);
                return;
            }
            
            console.log('Loading transactions from database for network:', currentNetwork);
            
            const response = await fetch('https://star-wallet-backend.netlify.app/.netlify/functions/get-transactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    network: currentNetwork
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            console.log('Transactions loaded from DB:', data);
            
            let combinedTransactions = data.transactions || [];
            
            console.log('Total transactions found:', combinedTransactions.length);
            
            combinedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            setTransactions(combinedTransactions);
            groupTransactionsByDate(combinedTransactions);
        } catch (error) {
            console.error('Error loading transactions:', error);
            setTransactions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const groupTransactionsByDate = (txs) => {
        const groups = {};
        
        txs.forEach(tx => {
            const date = new Date(tx.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let groupKey;
            if (date.toDateString() === today.toDateString()) {
                groupKey = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                groupKey = 'Yesterday';
            } else {
                groupKey = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                });
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(tx);
        });
        
        setGroupedTransactions(groups);
    };

    const handleNetworkChange = (newNetwork) => {
        localStorage.setItem('selected_network', newNetwork);
        setCurrentNetwork(newNetwork);
        setTransactions([]);
        setGroupedTransactions({});
        if (userData?.telegram_user_id) {
            loadTransactions();
        }
    };

    const handleTransactionClick = (transaction) => {
        if (transaction.explorerUrl && transaction.explorerUrl !== '#') {
            window.open(transaction.explorerUrl, '_blank');
        }
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'completed': return '#4CAF50';
            case 'pending': return '#FF9800';
            case 'failed': return '#F44336';
            default: return '#9E9E9E';
        }
    };

    const getUSDValue = (amount, symbol) => {
        const price = tokenPrices[symbol] || 0;
        const usdValue = (parseFloat(amount) * price).toFixed(2);
        return usdValue === '0.00' ? '0.00' : usdValue;
    };

    const groupTransactionsByDateFiltered = (txs) => {
        const groups = {};
        
        txs.forEach(tx => {
            const date = new Date(tx.timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let groupKey;
            if (date.toDateString() === today.toDateString()) {
                groupKey = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                groupKey = 'Yesterday';
            } else {
                groupKey = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                });
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(tx);
        });
        
        return groups;
    };

    const groupedFilteredTransactions = groupTransactionsByDateFiltered(transactions);

    return (
        <div className="history-page">
            <Header 
                userData={userData} 
                onNetworkChange={handleNetworkChange}
                currentNetwork={currentNetwork}
            />
            
            <div className="page-content">
                <div className="transactions-container">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="transaction-skeleton">
                                <div className="skeleton-icon"></div>
                                <div className="skeleton-details">
                                    <div className="skeleton-line" style={{width: '60%'}}></div>
                                    <div className="skeleton-line" style={{width: '40%'}}></div>
                                </div>
                                <div className="skeleton-amount">
                                    <div className="skeleton-line" style={{width: '50%'}}></div>
                                </div>
                            </div>
                        ))
                    ) : transactions.length > 0 ? (
                        Object.entries(groupedFilteredTransactions).map(([date, txList]) => (
                            <div key={date} className="transaction-group">
                                <div className="transaction-date">{date}</div>
                                {txList.map(tx => (
                                    <div 
                                        key={tx.id} 
                                        className="transaction-card"
                                        onClick={() => handleTransactionClick(tx)}
                                    >
                                        <div className="transaction-icon">
                                            <img 
                                                src={getBlockchainIcon(tx.blockchain)} 
                                                alt={tx.blockchain}
                                                className="blockchain-icon"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = 
                                                        `<div class="blockchain-fallback">${tx.blockchain.charAt(0)}</div>`;
                                                }}
                                            />
                                        </div>
                                        <div className="transaction-details">
                                            <div className="transaction-type">
                                                <span className="transaction-symbol">{tx.symbol}</span>
                                            </div>
                                            <div className="transaction-blockchain">
                                                {tx.blockchain}
                                            </div>
                                            <div className="transaction-time">
                                                {new Date(tx.timestamp).toLocaleTimeString([], { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </div>
                                        </div>
                                        <div className="transaction-amount">
                                            <div className={`amount ${tx.type}`}>
                                                {tx.type === 'received' ? '+' : tx.type === 'sent' ? '-' : ''}{tx.amount} {tx.symbol}
                                            </div>
                                            <div className="transaction-usd">
                                                ${getUSDValue(tx.amount, tx.symbol)}
                                            </div>
                                            <div 
                                                className="transaction-status" 
                                                style={{ color: getStatusColor(tx.status) }}
                                            >
                                                {tx.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))
                    ) : (
                        <div className="no-transactions">
                            <div className="no-transactions-icon">📄</div>
                            <h3>No transactions yet</h3>
                            <p>Your transaction history will appear here</p>
                        </div>
                    )}
                </div>
            </div>
            
            <Menu />
        </div>
    );
}

export default History;