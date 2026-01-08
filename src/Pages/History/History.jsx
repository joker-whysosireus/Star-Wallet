import React, { useState, useEffect, useCallback } from 'react';
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
    const [selectedFilter, setSelectedFilter] = useState('all');

    // API ключи (позже вынести в .env)
    const API_KEYS = {
        ETHERSCAN_API_KEY: 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6', // Получить на https://etherscan.io/apis
        BSCSCAN_API_KEY: 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6', // Получить на https://bscscan.com/apis
        SOLANA_RPC_URL: 'e1a20296-3d29-4edb-bc41-c709a187fbc9' // Или https://docs.helius.dev/ для лучшего API
    };

    useEffect(() => {
        if (userData?.seed_phrases) {
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
            if (!userData?.seed_phrases) return;
            
            const seedPhrase = userData.seed_phrases;
            const wallets = await generateWalletsFromSeed(seedPhrase, currentNetwork);
            
            // Загружаем транзакции только для основных блокчейнов
            const allTransactions = await Promise.all([
                fetchTonTransactions(wallets.find(w => w.blockchain === 'TON')?.address || ''),
                fetchEthTransactions(wallets.find(w => w.blockchain === 'Ethereum')?.address || ''),
                fetchBscTransactions(wallets.find(w => w.blockchain === 'BSC')?.address || ''),
                fetchBtcTransactions(wallets.find(w => w.blockchain === 'Bitcoin')?.address || ''),
                fetchSolTransactions(wallets.find(w => w.blockchain === 'Solana')?.address || '')
            ]);
            
            // Объединяем все транзакции
            let combinedTransactions = [];
            allTransactions.forEach(txList => {
                if (Array.isArray(txList) && txList.length > 0) {
                    combinedTransactions = [...combinedTransactions, ...txList];
                }
            });
            
            // Сортируем по дате (новые сверху)
            combinedTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            setTransactions(combinedTransactions);
            groupTransactionsByDate(combinedTransactions);
        } catch (error) {
            console.error('Error loading transactions:', error);
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

    // TON транзакции (публичный API, не требует ключа)
    const fetchTonTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const baseUrl = currentNetwork === 'testnet' 
                ? 'https://testnet.tonapi.io/v2'
                : 'https://tonapi.io/v2';
            
            const response = await fetch(`${baseUrl}/accounts/${address}/events?limit=20`);
            if (!response.ok) {
                console.warn('TON API error, using fallback');
                return [];
            }
            
            const data = await response.json();
            const transactions = [];
            
            (data.events || []).forEach(event => {
                // Только TonTransfer транзакции (отправка/получение TON)
                const tonTransfer = event.actions?.find(action => 
                    action.type === 'TonTransfer' && action.TonTransfer
                );
                
                if (tonTransfer?.TonTransfer) {
                    const transfer = tonTransfer.TonTransfer;
                    const amount = (transfer.amount / 1e9).toFixed(4);
                    const isIncoming = transfer.recipient?.address === address;
                    
                    transactions.push({
                        id: event.event_id,
                        blockchain: 'TON',
                        type: isIncoming ? 'received' : 'sent',
                        amount,
                        symbol: 'TON',
                        timestamp: event.timestamp * 1000,
                        status: 'completed',
                        explorerUrl: currentNetwork === 'testnet'
                            ? `https://testnet.tonscan.org/tx/${event.event_id}`
                            : `https://tonscan.org/tx/${event.event_id}`
                    });
                }
            });
            
            return transactions;
        } catch (error) {
            console.error('Error fetching TON transactions:', error);
            return [];
        }
    };

    // Ethereum транзакции (требует API ключ)
    const fetchEthTransactions = async (address) => {
        if (!address || !API_KEYS.ETHERSCAN_API_KEY || API_KEYS.ETHERSCAN_API_KEY === 'YOUR_ETHERSCAN_API_KEY') {
            console.warn('Ethereum API key not configured');
            return [];
        }
        
        try {
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://api-sepolia.etherscan.io/api'
                : 'https://api.etherscan.io/api';
            
            // Получаем только обычные транзакции (не контрактные вызовы)
            const response = await fetch(
                `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=${API_KEYS.ETHERSCAN_API_KEY}`
            );
            
            if (!response.ok) return [];
            const data = await response.json();
            
            if (data.status !== '1') {
                console.warn('Etherscan API error:', data.message);
                return [];
            }
            
            return data.result.map(tx => {
                // Фильтруем только простые переводы (value > 0)
                if (parseInt(tx.value) === 0) return null;
                
                const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
                
                return {
                    id: tx.hash,
                    blockchain: 'Ethereum',
                    type: isIncoming ? 'received' : 'sent',
                    amount: (parseInt(tx.value) / 1e18).toFixed(6),
                    symbol: 'ETH',
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    status: parseInt(tx.isError) === 0 ? 'completed' : 'failed',
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                        : `https://etherscan.io/tx/${tx.hash}`
                };
            }).filter(tx => tx !== null);
        } catch (error) {
            console.error('Error fetching ETH transactions:', error);
            return [];
        }
    };

    // BSC транзакции (аналогично Ethereum)
    const fetchBscTransactions = async (address) => {
        if (!address || !API_KEYS.BSCSCAN_API_KEY || API_KEYS.BSCSCAN_API_KEY === 'YOUR_BSCSCAN_API_KEY') {
            console.warn('BSC API key not configured');
            return [];
        }
        
        try {
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://api-testnet.bscscan.com/api'
                : 'https://api.bscscan.com/api';
            
            const response = await fetch(
                `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=${API_KEYS.BSCSCAN_API_KEY}`
            );
            
            if (!response.ok) return [];
            const data = await response.json();
            
            if (data.status !== '1') {
                console.warn('BscScan API error:', data.message);
                return [];
            }
            
            return data.result.map(tx => {
                if (parseInt(tx.value) === 0) return null;
                
                const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
                
                return {
                    id: tx.hash,
                    blockchain: 'BSC',
                    type: isIncoming ? 'received' : 'sent',
                    amount: (parseInt(tx.value) / 1e18).toFixed(6),
                    symbol: 'BNB',
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    status: parseInt(tx.isError) === 0 ? 'completed' : 'failed',
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://testnet.bscscan.com/tx/${tx.hash}`
                        : `https://bscscan.com/tx/${tx.hash}`
                };
            }).filter(tx => tx !== null);
        } catch (error) {
            console.error('Error fetching BSC transactions:', error);
            return [];
        }
    };

    // Bitcoin транзакции (публичный API)
    const fetchBtcTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://blockstream.info/testnet/api'
                : 'https://blockstream.info/api';
            
            const response = await fetch(`${baseUrl}/address/${address}/txs`);
            if (!response.ok) return [];
            
            const data = await response.json();
            
            return data.slice(0, 15).map(tx => {
                const isIncoming = tx.vout.some(output => 
                    output.scriptpubkey_address === address
                );
                
                // Если не входящая и не исходящая (внутренние), пропускаем
                if (!isIncoming && !tx.vout.some(output => output.value > 0)) return null;
                
                const amount = isIncoming
                    ? (tx.vout
                        .filter(output => output.scriptpubkey_address === address)
                        .reduce((sum, output) => sum + output.value, 0) / 1e8).toFixed(8)
                    : (tx.vout.reduce((sum, output) => sum + output.value, 0) / 1e8).toFixed(8);
                
                return {
                    id: tx.txid,
                    blockchain: 'Bitcoin',
                    type: isIncoming ? 'received' : 'sent',
                    amount,
                    symbol: 'BTC',
                    timestamp: tx.status.block_time * 1000,
                    status: tx.status.confirmed ? 'completed' : 'pending',
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://blockstream.info/testnet/tx/${tx.txid}`
                        : `https://blockstream.info/tx/${tx.txid}`
                };
            }).filter(tx => tx !== null);
        } catch (error) {
            console.error('Error fetching BTC transactions:', error);
            return [];
        }
    };

    // Solana транзакции (публичный RPC)
    const fetchSolTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const rpcUrl = currentNetwork === 'testnet'
                ? 'https://api.testnet.solana.com'
                : API_KEYS.SOLANA_RPC_URL;
            
            // Получаем список подписей транзакций
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getSignaturesForAddress',
                    params: [address, { limit: 10 }]
                })
            });
            
            if (!response.ok) return [];
            const data = await response.json();
            
            const transactions = [];
            
            // Для каждой подписи получаем детали
            for (const sig of data.result || []) {
                const txResponse = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTransaction',
                        params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
                    })
                });
                
                if (txResponse.ok) {
                    const txData = await txResponse.json();
                    if (txData.result) {
                        // Парсим инструкции для определения типа транзакции
                        const instructions = txData.result.transaction?.message?.instructions || [];
                        const isTransfer = instructions.some(ix => 
                            ix.program === 'system' && (ix.parsed?.type === 'transfer' || ix.parsed?.type === 'transferChecked')
                        );
                        
                        if (isTransfer) {
                            // Упрощённо - в реальном приложении нужно парсить amount из инструкций
                            transactions.push({
                                id: sig.signature,
                                blockchain: 'Solana',
                                type: 'transfer', // Требуется детальный анализ
                                amount: '0', // Нужно вычислить из инструкций
                                symbol: 'SOL',
                                timestamp: sig.blockTime * 1000,
                                status: 'completed',
                                explorerUrl: currentNetwork === 'testnet'
                                    ? `https://explorer.solana.com/tx/${sig.signature}?cluster=testnet`
                                    : `https://solscan.io/tx/${sig.signature}`
                            });
                        }
                    }
                }
            }
            
            return transactions;
        } catch (error) {
            console.error('Error fetching SOL transactions:', error);
            return [];
        }
    };

    const handleNetworkChange = (newNetwork) => {
        localStorage.setItem('selected_network', newNetwork);
        setCurrentNetwork(newNetwork);
        setTransactions([]);
        setGroupedTransactions({});
        if (userData?.seed_phrases) {
            loadTransactions();
        }
    };

    const handleRefresh = () => {
        loadTransactions();
    };

    const handleTransactionClick = (transaction) => {
        if (transaction.explorerUrl) {
            window.open(transaction.explorerUrl, '_blank');
        }
    };

    const filteredTransactions = selectedFilter === 'all' 
        ? transactions 
        : transactions.filter(tx => 
            (selectedFilter === 'sent' && tx.type === 'sent') ||
            (selectedFilter === 'received' && tx.type === 'received')
        );

    // Функция для группировки транзакций по датам для отображения
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

    const groupedFilteredTransactions = groupTransactionsByDateFiltered(filteredTransactions);

    return (
        <div className="history-page">
            <Header 
                userData={userData} 
                onNetworkChange={handleNetworkChange}
                currentNetwork={currentNetwork}
            />
            
            <div className="page-content">
                <div className="history-header">
                    <h1 className="history-title">Transaction History</h1>
                    <button 
                        className="refresh-button"
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        {isLoading ? '⟳' : '↻'}
                    </button>
                </div>
                
                <div className="transaction-filters">
                    <button 
                        className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedFilter('all')}
                    >
                        All
                    </button>
                    <button 
                        className={`filter-btn ${selectedFilter === 'sent' ? 'active' : ''}`}
                        onClick={() => setSelectedFilter('sent')}
                    >
                        Sent
                    </button>
                    <button 
                        className={`filter-btn ${selectedFilter === 'received' ? 'active' : ''}`}
                        onClick={() => setSelectedFilter('received')}
                    >
                        Received
                    </button>
                </div>
                
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
                    ) : filteredTransactions.length > 0 ? (
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
                                            <div className={`type-indicator ${tx.type}`}>
                                                {tx.type === 'received' ? '↓' : '↑'}
                                            </div>
                                        </div>
                                        <div className="transaction-details">
                                            <div className="transaction-type">
                                                {tx.type === 'received' ? 'Received' : 'Sent'} {tx.symbol}
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
                                                {tx.type === 'received' ? '+' : '-'}{tx.amount} {tx.symbol}
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