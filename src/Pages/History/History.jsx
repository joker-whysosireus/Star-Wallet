import React, { useState, useEffect } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import { getTransactionHistory, getAllTokens} from '../Wallet/Services/storageService';
import './History.css';

function History({ userData }) {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tokens, setTokens] = useState([]);
    const [selectedToken, setSelectedToken] = useState('all');
    
    useEffect(() => {
        if (!userData) return;
        
        loadData();
    }, [userData, selectedToken]);
    
    const loadData = async () => {
        try {
            setIsLoading(true);
            
            const allTokens = await getAllTokens(userData);
            setTokens(allTokens);
            
            const history = await getTransactionHistory(userData, selectedToken);
            setTransactions(history);
        } catch (error) {
            console.error('Error loading history:', error);
            setTransactions([]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };
    
    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };
    
    return (
        <div className="history-page">
            <Header userData={userData} />
            <div className="page-content">
                <div className="history-header">
                    <h2>Transaction History</h2>
                    <div className="history-filters">
                        <select 
                            value={selectedToken}
                            onChange={(e) => setSelectedToken(e.target.value)}
                            className="token-filter"
                        >
                            <option value="all">All Tokens</option>
                            {tokens.map(token => (
                                <option key={token.symbol} value={token.symbol}>
                                    {token.symbol}
                                </option>
                            ))}
                        </select>
                        <button 
                            onClick={loadData}
                            className="refresh-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? '🔄' : '↻'}
                        </button>
                    </div>
                </div>
                
                {isLoading ? (
                    <div className="loading-history">
                        <div className="loader"></div>
                        <p>Loading transactions...</p>
                    </div>
                ) : transactions.length > 0 ? (
                    <div className="transactions-list">
                        {transactions.map((tx, index) => (
                            <div key={index} className={`transaction-item ${tx.type}`}>
                                <div className="transaction-icon">
                                    {tx.type === 'incoming' ? '↓' : '↑'}
                                </div>
                                <div className="transaction-details">
                                    <div className="transaction-type">
                                        {tx.type === 'incoming' ? 'Received' : 'Sent'} {tx.symbol}
                                    </div>
                                    <div className="transaction-address">
                                        {tx.type === 'incoming' ? 'From: ' : 'To: '}
                                        {formatAddress(tx.address)}
                                    </div>
                                    <div className="transaction-time">
                                        {formatDate(tx.timestamp)}
                                    </div>
                                </div>
                                <div className="transaction-amount">
                                    <div className={`amount ${tx.type}`}>
                                        {tx.type === 'incoming' ? '+' : '-'}{tx.amount} {tx.symbol}
                                    </div>
                                    <div className="transaction-status">
                                        {tx.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-transactions">
                        <p>No transactions found</p>
                        <button 
                            onClick={loadData}
                            className="retry-btn"
                        >
                            Retry
                        </button>
                    </div>
                )}
            </div>
            <Menu />
        </div>
    );
}

export default History;