import React, { useState, useEffect } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import { getTransactionHistory, getAllTokens} from '../Wallet/Services/storageService';
import './History.css';

function History({ userData }) {
    const [transactions, setTransactions] = useState([]);
    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFilter, setSelectedFilter] = useState('all'); // 'all', 'incoming', 'outgoing'
    const [selectedToken, setSelectedToken] = useState('all');
    const [tokens, setTokens] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!userData) return;
        
        loadData();
    }, [userData, selectedToken]);

    useEffect(() => {
        // Фильтрация транзакций при изменении фильтров
        filterTransactions();
    }, [transactions, selectedFilter, selectedToken, searchQuery]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            
            // Загружаем все токены пользователя для фильтра
            const allTokens = await getAllTokens(userData);
            setTokens(allTokens);
            
            // Загружаем историю транзакций
            const history = await getTransactionHistory(userData, selectedToken);
            
            // Добавляем USD значения
            const prices = {
                'TON': 6.24,
                'SOL': 172.34,
                'ETH': 3500.00,
                'BNB': 600.00,
                'USDT': 1.00,
                'USDC': 1.00,
                'TRX': 0.12,
                'BTC': 68000.00,
                'NEAR': 8.50
            };
            
            const historyWithUSD = history.map(tx => ({
                ...tx,
                usdValue: (parseFloat(tx.amount || 0) * (prices[tx.symbol] || 1)).toFixed(2)
            }));
            
            setTransactions(historyWithUSD);
            
        } catch (error) {
            console.error('Error loading history:', error);
            setTransactions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const filterTransactions = () => {
        let filtered = [...transactions];
        
        // Фильтр по типу транзакции
        if (selectedFilter !== 'all') {
            filtered = filtered.filter(tx => tx.type === selectedFilter);
        }
        
        // Фильтр по поисковому запросу (адрес или хэш)
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(tx => 
                (tx.address && tx.address.toLowerCase().includes(query)) || 
                (tx.hash && tx.hash.toLowerCase().includes(query))
            );
        }
        
        setFilteredTransactions(filtered);
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    };

    const formatAddress = (address) => {
        if (!address) return '';
        return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
    };

    const getTransactionIcon = (type) => {
        const icons = {
            incoming: { symbol: '↓', color: '#4CAF50', label: 'Received' },
            outgoing: { symbol: '↑', color: '#F44336', label: 'Sent' }
        };
        return icons[type] || { symbol: '↔', color: '#FF9800', label: 'Transfer' };
    };

    const handleRefresh = () => {
        loadData();
    };

    const handleViewOnExplorer = (url) => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="history-page">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="history-header">
                    <h2>Transaction History</h2>
                    <div className="history-actions">
                        <button 
                            className="refresh-btn"
                            onClick={handleRefresh}
                            disabled={isLoading}
                        >
                            {isLoading ? '🔄' : '↻'}
                        </button>
                    </div>
                </div>

                {/* Фильтры и поиск */}
                <div className="history-controls">
                    <div className="filter-section">
                        <div className="filter-buttons">
                            <button 
                                className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('all')}
                            >
                                All
                            </button>
                            <button 
                                className={`filter-btn ${selectedFilter === 'incoming' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('incoming')}
                            >
                                Received
                            </button>
                            <button 
                                className={`filter-btn ${selectedFilter === 'outgoing' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('outgoing')}
                            >
                                Sent
                            </button>
                        </div>
                        
                        <div className="token-filter-section">
                            <select 
                                value={selectedToken}
                                onChange={(e) => setSelectedToken(e.target.value)}
                                className="token-select"
                            >
                                <option value="all">All Tokens</option>
                                {tokens.map(token => (
                                    <option key={`${token.symbol}-${token.blockchain}`} value={token.symbol}>
                                        {token.symbol} ({token.blockchain})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="search-section">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by address or hash..."
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Список транзакций */}
                <div className="transactions-container">
                    {isLoading ? (
                        <div className="loading-container">
                            <div className="loader"></div>
                            <p>Loading transactions...</p>
                        </div>
                    ) : filteredTransactions.length > 0 ? (
                        <div className="transactions-list">
                            {filteredTransactions.map((tx, index) => {
                                const icon = getTransactionIcon(tx.type);
                                
                                return (
                                    <div key={`${tx.hash}-${index}`} className="transaction-card">
                                        <div className="transaction-icon" style={{ color: icon.color }}>
                                            {icon.symbol}
                                        </div>
                                        
                                        <div className="transaction-details">
                                            <div className="transaction-main">
                                                <div className="transaction-type" style={{ color: icon.color }}>
                                                    {icon.label} {tx.symbol}
                                                </div>
                                                <div className="transaction-address">
                                                    {tx.type === 'incoming' ? 'From: ' : 'To: '}
                                                    {formatAddress(tx.address)}
                                                </div>
                                            </div>
                                            <div className="transaction-meta">
                                                <div className="transaction-time">
                                                    {formatDate(tx.timestamp)}
                                                </div>
                                                <div className={`transaction-status ${tx.status.toLowerCase()}`}>
                                                    {tx.status}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="transaction-amounts">
                                            <div className={`amount ${tx.type}`}>
                                                {tx.type === 'incoming' ? '+' : '-'}{tx.amount} {tx.symbol}
                                            </div>
                                            {tx.usdValue && (
                                                <div className="amount-usd">
                                                    ${tx.usdValue}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <button 
                                            className="explorer-btn"
                                            onClick={() => handleViewOnExplorer(tx.explorerUrl)}
                                            title="View on explorer"
                                            disabled={!tx.explorerUrl}
                                        >
                                            ↗
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="no-transactions">
                            <div className="no-transactions-icon">📄</div>
                            <h3>No transactions found</h3>
                            <p>
                                {searchQuery || selectedFilter !== 'all' || selectedToken !== 'all'
                                    ? 'Try changing your filters or search query.'
                                    : 'Transactions will appear here after you send or receive tokens.'}
                            </p>
                            {(searchQuery || selectedFilter !== 'all' || selectedToken !== 'all') && (
                                <button 
                                    className="clear-filters-btn"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setSelectedFilter('all');
                                        setSelectedToken('all');
                                    }}
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Статистика */}
                {!isLoading && transactions.length > 0 && (
                    <div className="history-stats">
                        <div className="stat-card">
                            <div className="stat-value">{transactions.length}</div>
                            <div className="stat-label">Total Transactions</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {transactions.filter(tx => tx.type === 'incoming').length}
                            </div>
                            <div className="stat-label">Received</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">
                                {transactions.filter(tx => tx.type === 'outgoing').length}
                            </div>
                            <div className="stat-label">Sent</div>
                        </div>
                    </div>
                )}
            </div>
            
            <Menu />
        </div>
    );
}

export default History;