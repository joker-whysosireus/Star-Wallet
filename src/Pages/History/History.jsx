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

    // API ключи
    const API_KEYS = {
        ETHERSCAN_API_KEY: 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6',
        BSCSCAN_API_KEY: '7VVXJQ5YA1M9Q55YI46YY9NX6HQT713YJN', // Нужно получить на https://bscscan.com/apis
        SOLANA_RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=e1a20296-3d29-4edb-bc41-c709a187fbc9'
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
            
            const allTransactions = await Promise.all([
                fetchTonTransactions(wallets.find(w => w.blockchain === 'TON')?.address || ''),
                fetchEthTransactions(wallets.find(w => w.blockchain === 'Ethereum')?.address || ''),
                fetchBscTransactions(wallets.find(w => w.blockchain === 'BSC')?.address || ''),
                fetchBtcTransactions(wallets.find(w => w.blockchain === 'Bitcoin')?.address || ''),
                fetchSolTransactions(wallets.find(w => w.blockchain === 'Solana')?.address || '')
            ]);
            
            let combinedTransactions = [];
            allTransactions.forEach(txList => {
                if (Array.isArray(txList) && txList.length > 0) {
                    combinedTransactions = [...combinedTransactions, ...txList];
                }
            });
            
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

    // Исправленная функция для TON транзакций
    const fetchTonTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const baseUrl = currentNetwork === 'testnet' 
                ? 'https://testnet.tonapi.io/v2'
                : 'https://tonapi.io/v2';
            
            const response = await fetch(`${baseUrl}/accounts/${address}/events?limit=20`);
            if (!response.ok) return [];
            
            const data = await response.json();
            const transactions = [];
            
            (data.events || []).forEach(event => {
                const tonTransfer = event.actions?.find(action => 
                    action.type === 'TonTransfer' && action.TonTransfer
                );
                
                if (tonTransfer?.TonTransfer) {
                    const transfer = tonTransfer.TonTransfer;
                    const amount = (transfer.amount / 1e9).toFixed(4);
                    
                    // Проверяем направление правильно
                    const senderAddress = transfer.sender?.address || '';
                    const recipientAddress = transfer.recipient?.address || '';
                    
                    // Определяем тип транзакции
                    let type = 'unknown';
                    if (recipientAddress === address) {
                        type = 'received';
                    } else if (senderAddress === address) {
                        type = 'sent';
                    }
                    
                    if (type !== 'unknown') {
                        transactions.push({
                            id: event.event_id,
                            blockchain: 'TON',
                            type: type,
                            amount: amount,
                            symbol: 'TON',
                            fromAddress: senderAddress,
                            toAddress: recipientAddress,
                            timestamp: event.timestamp * 1000,
                            status: 'completed',
                            explorerUrl: currentNetwork === 'testnet'
                                ? `https://testnet.tonscan.org/tx/${event.event_id}`
                                : `https://tonscan.org/tx/${event.event_id}`
                        });
                    }
                }
            });
            
            return transactions;
        } catch (error) {
            console.error('Error fetching TON transactions:', error);
            return [];
        }
    };

    // Исправленная функция для Ethereum транзакций
    const fetchEthTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://api-sepolia.etherscan.io/api'
                : 'https://api.etherscan.io/api';
            
            // Используем предоставленный ключ
            const apiKey = API_KEYS.ETHERSCAN_API_KEY;
            
            const response = await fetch(
                `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${apiKey}`
            );
            
            if (!response.ok) {
                console.warn('Etherscan API error, status:', response.status);
                return [];
            }
            
            const data = await response.json();
            
            if (data.status !== '1') {
                console.warn('Etherscan API error message:', data.message);
                return [];
            }
            
            // Фильтруем только транзакции с ненулевым значением
            const validTransactions = data.result
                .filter(tx => parseInt(tx.value) > 0)
                .map(tx => {
                    const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
                    
                    return {
                        id: tx.hash,
                        blockchain: 'Ethereum',
                        type: isIncoming ? 'received' : 'sent',
                        amount: (parseInt(tx.value) / 1e18).toFixed(6),
                        symbol: 'ETH',
                        fromAddress: tx.from,
                        toAddress: tx.to,
                        timestamp: parseInt(tx.timeStamp) * 1000,
                        status: parseInt(tx.isError) === 0 ? 'completed' : 'failed',
                        explorerUrl: currentNetwork === 'testnet'
                            ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                            : `https://etherscan.io/tx/${tx.hash}`
                    };
                });
            
            console.log(`Found ${validTransactions.length} Ethereum transactions`);
            return validTransactions;
        } catch (error) {
            console.error('Error fetching ETH transactions:', error);
            return [];
        }
    };

    // Функция для BSC транзакций
    const fetchBscTransactions = async (address) => {
        if (!address) return [];
        
        try {
            // BscScan использует тот же формат, что и Etherscan
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://api-testnet.bscscan.com/api'
                : 'https://api.bscscan.com/api';
            
            // Нужно получить ключ на bscscan.com/apis
            const apiKey = API_KEYS.BSCSCAN_API_KEY;
            if (!apiKey) {
                console.warn('BSC API key not configured');
                return [];
            }
            
            const response = await fetch(
                `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc&apikey=${apiKey}`
            );
            
            if (!response.ok) return [];
            const data = await response.json();
            
            if (data.status !== '1') {
                console.warn('BscScan API error:', data.message);
                return [];
            }
            
            return data.result
                .filter(tx => parseInt(tx.value) > 0)
                .map(tx => {
                    const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
                    
                    return {
                        id: tx.hash,
                        blockchain: 'BSC',
                        type: isIncoming ? 'received' : 'sent',
                        amount: (parseInt(tx.value) / 1e18).toFixed(6),
                        symbol: 'BNB',
                        fromAddress: tx.from,
                        toAddress: tx.to,
                        timestamp: parseInt(tx.timeStamp) * 1000,
                        status: parseInt(tx.isError) === 0 ? 'completed' : 'failed',
                        explorerUrl: currentNetwork === 'testnet'
                            ? `https://testnet.bscscan.com/tx/${tx.hash}`
                            : `https://bscscan.com/tx/${tx.hash}`
                    };
                });
        } catch (error) {
            console.error('Error fetching BSC transactions:', error);
            return [];
        }
    };

    // Исправленная функция для Bitcoin транзакций
    const fetchBtcTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://blockstream.info/testnet/api'
                : 'https://blockstream.info/api';
            
            const response = await fetch(`${baseUrl}/address/${address}/txs`);
            if (!response.ok) return [];
            
            const data = await response.json();
            
            return data.slice(0, 20).map(tx => {
                // Собираем все адреса получателей
                const outputAddresses = tx.vout
                    .map(output => output.scriptpubkey_address)
                    .filter(addr => addr);
                
                // Собираем все адреса отправителей (из предыдущих выходов)
                const inputAddresses = [];
                // Для получения адресов отправителей нужно больше данных
                // В упрощенном виде считаем, что если наш адрес в выходах - это получение
                // Иначе - отправка
                
                const isIncoming = tx.vout.some(output => 
                    output.scriptpubkey_address === address
                );
                
                let amount = 0;
                let type = 'unknown';
                
                if (isIncoming) {
                    // Получение: сумма только тех выходов, которые на наш адрес
                    amount = tx.vout
                        .filter(output => output.scriptpubkey_address === address)
                        .reduce((sum, output) => sum + output.value, 0);
                    type = 'received';
                } else {
                    // Отправка: общая сумма всех выходов
                    amount = tx.vout.reduce((sum, output) => sum + output.value, 0);
                    type = 'sent';
                }
                
                // Если amount равен 0, пропускаем транзакцию
                if (amount === 0) return null;
                
                return {
                    id: tx.txid,
                    blockchain: 'Bitcoin',
                    type: type,
                    amount: (amount / 1e8).toFixed(8),
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

    // Исправленная функция для Solana транзакций
    const fetchSolTransactions = async (address) => {
        if (!address) return [];
        
        try {
            const rpcUrl = currentNetwork === 'testnet'
                ? 'https://api.testnet.solana.com'
                : API_KEYS.SOLANA_RPC_URL;
            
            // Получаем подписи транзакций
            const signaturesResponse = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getSignaturesForAddress',
                    params: [address, { limit: 10 }]
                })
            });
            
            if (!signaturesResponse.ok) return [];
            const signaturesData = await signaturesResponse.json();
            
            if (!signaturesData.result || !Array.isArray(signaturesData.result)) {
                return [];
            }
            
            const transactions = [];
            
            // Обрабатываем только первые несколько транзакций для производительности
            const signatures = signaturesData.result.slice(0, 10);
            
            for (const sig of signatures) {
                try {
                    const txResponse = await fetch(rpcUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTransaction',
                            params: [sig.signature, {
                                encoding: 'jsonParsed',
                                maxSupportedTransactionVersion: 0
                            }]
                        })
                    });
                    
                    if (!txResponse.ok) continue;
                    
                    const txData = await txResponse.json();
                    if (!txData.result) continue;
                    
                    const meta = txData.result.meta;
                    const message = txData.result.transaction.message;
                    
                    // Определяем сумму транзакции
                    let amount = 0;
                    if (meta && meta.postBalances && meta.preBalances) {
                        // Находим индекс нашего аккаунта в списке аккаунтов
                        const accountIndex = message.accountKeys.findIndex(
                            (key, index) => key.pubkey === address
                        );
                        
                        if (accountIndex !== -1) {
                            const preBalance = meta.preBalances[accountIndex];
                            const postBalance = meta.postBalances[accountIndex];
                            
                            if (postBalance > preBalance) {
                                // Получение
                                amount = (postBalance - preBalance) / 1e9;
                            } else if (postBalance < preBalance) {
                                // Отправка
                                amount = (preBalance - postBalance) / 1e9;
                            }
                        }
                    }
                    
                    // Если сумма нулевая, пропускаем
                    if (amount === 0) continue;
                    
                    // Определяем тип транзакции
                    let type = 'unknown';
                    const accountKeys = message.accountKeys || [];
                    
                    // Простой эвристический метод определения типа
                    if (meta) {
                        // Если наш адрес в списке получателей (увеличился баланс)
                        const senderIndex = meta.preBalances.findIndex((balance, index) => {
                            const account = accountKeys[index];
                            return account && account.pubkey === address && 
                                   meta.postBalances[index] < balance;
                        });
                        
                        const receiverIndex = meta.postBalances.findIndex((balance, index) => {
                            const account = accountKeys[index];
                            return account && account.pubkey === address && 
                                   meta.preBalances[index] < balance;
                        });
                        
                        if (receiverIndex !== -1) {
                            type = 'received';
                        } else if (senderIndex !== -1) {
                            type = 'sent';
                        }
                    }
                    
                    transactions.push({
                        id: sig.signature,
                        blockchain: 'Solana',
                        type: type !== 'unknown' ? type : 'transfer',
                        amount: amount.toFixed(4),
                        symbol: 'SOL',
                        timestamp: sig.blockTime * 1000,
                        status: 'completed',
                        explorerUrl: currentNetwork === 'testnet'
                            ? `https://explorer.solana.com/tx/${sig.signature}?cluster=testnet`
                            : `https://solscan.io/tx/${sig.signature}`
                    });
                } catch (error) {
                    console.error('Error fetching Solana transaction details:', error);
                    continue;
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
        if (transaction.explorerUrl && transaction.explorerUrl !== '#') {
            window.open(transaction.explorerUrl, '_blank');
        }
    };

    const filteredTransactions = selectedFilter === 'all' 
        ? transactions 
        : transactions.filter(tx => 
            (selectedFilter === 'sent' && tx.type === 'sent') ||
            (selectedFilter === 'received' && tx.type === 'received')
        );

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

    const groupedFilteredTransactions = groupTransactionsByDateFiltered(filteredTransactions);

    return (
        <div className="history-page">
            <Header 
                userData={userData} 
                onNetworkChange={handleNetworkChange}
                currentNetwork={currentNetwork}
            />
            
            <div className="page-content">
                <div className="transaction-filters-container">
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
                        <button 
                            className="refresh-button-small"
                            onClick={handleRefresh}
                            disabled={isLoading}
                        >
                            {isLoading ? '⟳' : '↻'}
                        </button>
                    </div>
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
                                        </div>
                                        <div className="transaction-details">
                                            <div className="transaction-type">
                                                <span className={`type-badge ${tx.type}`}>
                                                    {tx.type === 'received' ? 'Received' : tx.type === 'sent' ? 'Sent' : 'Transfer'}
                                                </span>
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