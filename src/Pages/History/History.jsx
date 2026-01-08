import React, { useState, useEffect, useCallback } from 'react';
import Menu from "../../assets/Menus/Menu/Menu";
import Header from "../../assets/Header/Header";
import './History.css';
import { 
    generateTonAddress,
    generateEthereumAddress,
    generateSolanaAddress,
    generateBitcoinAddress,
    generateBSCAddress,
    getTokenPrices
} from '../Wallet/Services/storageService';

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

    useEffect(() => {
        if (userData?.seed_phrases) {
            loadTransactions();
        }
        
        // Загружаем цены токенов
        loadTokenPrices();
        
        // Обновляем цены каждую минуту
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
            
            // Генерируем адреса для всех блокчейнов
            const addresses = await Promise.all([
                generateTonAddress(seedPhrase, currentNetwork),
                generateEthereumAddress(seedPhrase, currentNetwork),
                generateSolanaAddress(seedPhrase, currentNetwork),
                generateBitcoinAddress(seedPhrase, currentNetwork),
                generateBSCAddress(seedPhrase, currentNetwork)
            ]);
            
            const [tonAddress, ethAddress, solAddress, btcAddress, bscAddress] = addresses;
            
            // Загружаем транзакции для каждого блокчейна
            const allTransactions = await Promise.all([
                fetchTonTransactions(tonAddress),
                fetchEthTransactions(ethAddress),
                fetchSolTransactions(solAddress),
                fetchBtcTransactions(btcAddress),
                fetchBscTransactions(bscAddress)
            ]);
            
            // Объединяем все транзакции
            let combinedTransactions = [];
            allTransactions.forEach(txList => {
                if (Array.isArray(txList)) {
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
                    month: 'long', 
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

    // Функции для загрузки транзакций из разных блокчейнов
    const fetchTonTransactions = async (address) => {
        try {
            const config = currentNetwork === 'testnet' 
                ? { API_URL: 'https://testnet.tonapi.io/v2' }
                : { API_URL: 'https://tonapi.io/v2' };
            
            const response = await fetch(`${config.API_URL}/accounts/${address}/events?limit=100`);
            if (!response.ok) return [];
            
            const data = await response.json();
            
            return (data.events || []).map(event => {
                const tonTransfer = event.actions?.find(action => action.type === 'TonTransfer');
                const jettonTransfer = event.actions?.find(action => action.type === 'JettonTransfer');
                
                let amount = '0';
                let symbol = 'TON';
                let type = 'unknown';
                
                if (tonTransfer?.TonTransfer) {
                    amount = (tonTransfer.TonTransfer.amount / 1e9).toFixed(4);
                    const from = tonTransfer.TonTransfer.sender?.address;
                    const to = tonTransfer.TonTransfer.recipient?.address;
                    type = to === address ? 'received' : 'sent';
                } else if (jettonTransfer?.JettonTransfer) {
                    amount = (jettonTransfer.JettonTransfer.amount / 1e6).toFixed(2); // USDT обычно 6 decimals
                    symbol = jettonTransfer.JettonTransfer.jetton?.symbol || 'JETTON';
                    const from = jettonTransfer.JettonTransfer.sender?.address;
                    const to = jettonTransfer.JettonTransfer.recipient?.address;
                    type = to === address ? 'received' : 'sent';
                }
                
                return {
                    id: event.event_id,
                    blockchain: 'TON',
                    type,
                    amount,
                    symbol,
                    address: tonTransfer?.TonTransfer?.sender?.address || jettonTransfer?.JettonTransfer?.sender?.address,
                    timestamp: event.timestamp * 1000,
                    status: 'completed',
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://testnet.tonscan.org/tx/${event.event_id}`
                        : `https://tonscan.org/tx/${event.event_id}`
                };
            }).filter(tx => tx.type !== 'unknown');
        } catch (error) {
            console.error('Error fetching TON transactions:', error);
            return [];
        }
    };

    const fetchEthTransactions = async (address) => {
        try {
            const config = currentNetwork === 'testnet'
                ? { RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com' }
                : { RPC_URL: 'https://eth.llamarpc.com' };
            
            // Для простоты используем Etherscan API (в реальном приложении нужен API ключ)
            const apiKey = 'demo'; // Замените на реальный API ключ
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://api-sepolia.etherscan.io/api'
                : 'https://api.etherscan.io/api';
            
            const response = await fetch(
                `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
            );
            
            if (!response.ok) return [];
            const data = await response.json();
            
            if (data.status !== '1') return [];
            
            return data.result.map(tx => ({
                id: tx.hash,
                blockchain: 'Ethereum',
                type: tx.to.toLowerCase() === address.toLowerCase() ? 'received' : 'sent',
                amount: (parseInt(tx.value) / 1e18).toFixed(6),
                symbol: 'ETH',
                address: tx.from,
                timestamp: parseInt(tx.timeStamp) * 1000,
                status: parseInt(tx.isError) === 0 ? 'completed' : 'failed',
                explorerUrl: currentNetwork === 'testnet'
                    ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                    : `https://etherscan.io/tx/${tx.hash}`
            }));
        } catch (error) {
            console.error('Error fetching ETH transactions:', error);
            return [];
        }
    };

    const fetchSolTransactions = async (address) => {
        try {
            const config = currentNetwork === 'testnet'
                ? { RPC_URL: 'https://api.testnet.solana.com' }
                : { RPC_URL: 'https://api.mainnet-beta.solana.com' };
            
            const response = await fetch(config.RPC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getConfirmedSignaturesForAddress2',
                    params: [address, { limit: 50 }]
                })
            });
            
            if (!response.ok) return [];
            const data = await response.json();
            
            const transactions = [];
            
            // Для каждой подписи получаем детали транзакции
            for (const signature of data.result || []) {
                const txResponse = await fetch(config.RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTransaction',
                        params: [signature.signature]
                    })
                });
                
                if (txResponse.ok) {
                    const txData = await txResponse.json();
                    if (txData.result) {
                        transactions.push({
                            id: signature.signature,
                            blockchain: 'Solana',
                            type: 'transfer', // Нужно определить по аккаунтам
                            amount: '0', // Нужно вычислить из инструкций
                            symbol: 'SOL',
                            timestamp: signature.blockTime * 1000,
                            status: 'completed',
                            explorerUrl: currentNetwork === 'testnet'
                                ? `https://explorer.solana.com/tx/${signature.signature}?cluster=testnet`
                                : `https://solscan.io/tx/${signature.signature}`
                        });
                    }
                }
            }
            
            return transactions;
        } catch (error) {
            console.error('Error fetching SOL transactions:', error);
            return [];
        }
    };

    const fetchBtcTransactions = async (address) => {
        try {
            const config = currentNetwork === 'testnet'
                ? { EXPLORER_API: 'https://blockstream.info/testnet/api' }
                : { EXPLORER_API: 'https://blockstream.info/api' };
            
            const response = await fetch(`${config.EXPLORER_API}/address/${address}/txs`);
            if (!response.ok) return [];
            
            const data = await response.json();
            
            return data.map(tx => {
                // Определяем тип транзакции (получение/отправка)
                let totalReceived = 0;
                let totalSent = 0;
                
                tx.vout.forEach(output => {
                    if (output.scriptpubkey_address === address) {
                        totalReceived += output.value;
                    }
                });
                
                let type = totalReceived > 0 ? 'received' : 'sent';
                let amount = totalReceived > 0 
                    ? (totalReceived / 1e8).toFixed(8)
                    : (tx.vout.reduce((sum, out) => sum + out.value, 0) / 1e8).toFixed(8);
                
                return {
                    id: tx.txid,
                    blockchain: 'Bitcoin',
                    type,
                    amount,
                    symbol: 'BTC',
                    timestamp: tx.status.block_time * 1000,
                    status: tx.status.confirmed ? 'completed' : 'pending',
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://blockstream.info/testnet/tx/${tx.txid}`
                        : `https://blockstream.info/tx/${tx.txid}`
                };
            });
        } catch (error) {
            console.error('Error fetching BTC transactions:', error);
            return [];
        }
    };

    const fetchBscTransactions = async (address) => {
        // BSC использует тот же формат, что и Ethereum
        return fetchEthTransactions(address);
    };

    const handleNetworkChange = (newNetwork) => {
        localStorage.setItem('selected_network', newNetwork);
        setCurrentNetwork(newNetwork);
        setTransactions([]);
        setGroupedTransactions({});
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

    const getBlockchainIcon = (blockchain) => {
        const icons = {
            'TON': 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
            'Ethereum': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
            'Solana': 'https://cryptologos.cc/logos/solana-sol-logo.png',
            'Bitcoin': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
            'BSC': 'https://cryptologos.cc/logos/bnb-bnb-logo.png'
        };
        return icons[blockchain] || '';
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
        return (parseFloat(amount) * price).toFixed(2);
    };

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
                        Array.from({ length: 8 }).map((_, index) => (
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
                        Object.entries(groupTransactionsByDate(filteredTransactions)).map(([date, txList]) => (
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
                                                {tx.address && (
                                                    <span className="transaction-address">
                                                        {tx.type === 'received' 
                                                            ? ` from ${tx.address.substring(0, 6)}...${tx.address.substring(tx.address.length - 4)}`
                                                            : ` to ${tx.address.substring(0, 6)}...${tx.address.substring(tx.address.length - 4)}`
                                                        }
                                                    </span>
                                                )}
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