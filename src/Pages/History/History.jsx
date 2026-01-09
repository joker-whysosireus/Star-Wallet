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

    // API ключи
    const ETHERSCAN_API_KEY = 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6';
    const CHAINGATEWAY_API_KEY = 'E7eAZ6guG5UJmEKQX2Km469PYHLtUJg25BkinEAY2d0533f5';
    const SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=e1a20296-3d29-4edb-bc41-c709a187fbc9';

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
            if (!userData?.seed_phrases) {
                console.log('No seed phrases found');
                setIsLoading(false);
                return;
            }
            
            console.log('Loading transactions for network:', currentNetwork);
            
            const seedPhrase = userData.seed_phrases;
            const wallets = await generateWalletsFromSeed(seedPhrase, currentNetwork);
            
            console.log('Generated wallets:', wallets);
            
            if (!wallets || wallets.length === 0) {
                console.log('No wallets generated');
                setIsLoading(false);
                return;
            }
            
            const tonAddress = wallets.find(w => w.blockchain === 'TON')?.address || '';
            const ethAddress = wallets.find(w => w.blockchain === 'Ethereum')?.address || '';
            const bscAddress = wallets.find(w => w.blockchain === 'BSC')?.address || '';
            const btcAddress = wallets.find(w => w.blockchain === 'Bitcoin')?.address || '';
            const solAddress = wallets.find(w => w.blockchain === 'Solana')?.address || '';
            
            console.log('Wallet addresses for transactions:', {
                TON: tonAddress ? `${tonAddress.substring(0, 10)}...` : 'Not found',
                Ethereum: ethAddress ? `${ethAddress.substring(0, 10)}...` : 'Not found',
                BSC: bscAddress ? `${bscAddress.substring(0, 10)}...` : 'Not found',
                Bitcoin: btcAddress ? `${btcAddress.substring(0, 10)}...` : 'Not found',
                Solana: solAddress ? `${solAddress.substring(0, 10)}...` : 'Not found'
            });
            
            const [tonTxs, ethTxs, bscTxs, btcTxs, solTxs] = await Promise.all([
                fetchTonTransactions(tonAddress),
                fetchEthTransactions(ethAddress),
                fetchBscTransactions(bscAddress),
                fetchBtcTransactions(btcAddress),
                fetchSolTransactions(solAddress)
            ]);
            
            console.log('Transaction counts found:', {
                TON: tonTxs.length,
                Ethereum: ethTxs.length,
                BSC: bscTxs.length,
                Bitcoin: btcTxs.length,
                Solana: solTxs.length
            });
            
            let combinedTransactions = [
                ...tonTxs,
                ...ethTxs,
                ...bscTxs,
                ...btcTxs,
                ...solTxs
            ];
            
            console.log('Total transactions found:', combinedTransactions.length);
            
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

    const fetchTonTransactions = async (address) => {
        if (!address || address.trim() === '') {
            console.log('TON: No address provided');
            return [];
        }
        
        try {
            console.log(`TON: Fetching transactions for address...`);
            
            const baseUrl = currentNetwork === 'testnet' 
                ? 'https://testnet.toncenter.com/api/v2'
                : 'https://toncenter.com/api/v2';
            
            const response = await fetch(`${baseUrl}/getTransactions?address=${address}&limit=20`);
            
            if (!response.ok) {
                console.log(`TON: API error - ${response.status}`);
                return [];
            }
            
            const data = await response.json();
            
            if (!data.ok || !Array.isArray(data.result)) {
                console.log('TON: Invalid response format');
                return [];
            }
            
            const transactions = [];
            
            data.result.forEach(tx => {
                try {
                    const inMsg = tx.in_msg;
                    if (inMsg && inMsg.value && parseInt(inMsg.value) > 0) {
                        const amount = (parseInt(inMsg.value) / 1e9).toFixed(4);
                        
                        transactions.push({
                            id: tx.transaction_id.hash,
                            blockchain: 'TON',
                            type: 'received',
                            amount: amount,
                            symbol: 'TON',
                            fromAddress: inMsg.source || '',
                            toAddress: inMsg.destination || address,
                            timestamp: tx.utime * 1000,
                            status: 'completed',
                            explorerUrl: currentNetwork === 'testnet'
                                ? `https://testnet.tonscan.org/tx/${tx.transaction_id.hash}`
                                : `https://tonscan.org/tx/${tx.transaction_id.hash}`
                        });
                    }
                    
                    const outMsgs = tx.out_msgs || [];
                    outMsgs.forEach(msg => {
                        if (msg.value && parseInt(msg.value) > 0) {
                            const amount = (parseInt(msg.value) / 1e9).toFixed(4);
                            
                            transactions.push({
                                id: tx.transaction_id.hash,
                                blockchain: 'TON',
                                type: 'sent',
                                amount: amount,
                                symbol: 'TON',
                                fromAddress: address,
                                toAddress: msg.destination || '',
                                timestamp: tx.utime * 1000,
                                status: 'completed',
                                explorerUrl: currentNetwork === 'testnet'
                                    ? `https://testnet.tonscan.org/tx/${tx.transaction_id.hash}`
                                    : `https://tonscan.org/tx/${tx.transaction_id.hash}`
                            });
                        }
                    });
                } catch (error) {
                    console.error('TON: Error parsing transaction:', error);
                }
            });
            
            console.log(`TON: Found ${transactions.length} transactions`);
            return transactions;
        } catch (error) {
            console.error('TON: Error fetching transactions:', error);
            return [];
        }
    };

    const fetchEthTransactions = async (address) => {
        if (!address || address.trim() === '') {
            console.log('ETH: No address provided');
            return [];
        }
        
        try {
            console.log(`ETH: Fetching transactions for address...`);
            
            const baseUrl = 'https://api.etherscan.io/v2/api';
            const chainId = currentNetwork === 'testnet' ? '11155111' : '1';
            
            const apiUrl = `${baseUrl}?module=account&action=txlist&address=${address}&chainid=${chainId}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
            
            console.log(`ETH: Fetching from URL: ${apiUrl}`);
            
            const response = await fetch(apiUrl);
            
            console.log(`ETH: API response status - ${response.status}`);
            
            if (!response.ok) {
                console.log(`ETH: API error - ${response.statusText}`);
                return [];
            }
            
            const data = await response.json();
            
            console.log('ETH: API response status:', data.status);
            console.log('ETH: API message:', data.message);
            console.log('ETH: Result length:', data.result ? data.result.length : 0);
            
            if (data.message && (data.message.includes('deprecated') || data.message.includes('Invalid API Key'))) {
                console.error(`ETH: API error - ${data.message}`);
                return [];
            }
            
            if (data.status !== '1' || !Array.isArray(data.result)) {
                console.log(`ETH: API error - status: ${data.status}, message: ${data.message}`);
                if (data.result && Array.isArray(data.result) && data.result.length > 0) {
                    console.log('ETH: First few results:', data.result.slice(0, 3));
                }
                return [];
            }
            
            const transactions = data.result
                .filter(tx => {
                    const value = parseInt(tx.value);
                    const isValueValid = value > 0;
                    const hasHash = tx.hash && tx.hash !== '0x';
                    const hasTimestamp = tx.timeStamp && parseInt(tx.timeStamp) > 0;
                    
                    return isValueValid && hasHash && hasTimestamp;
                })
                .map(tx => {
                    const isIncoming = tx.to.toLowerCase() === address.toLowerCase();
                    
                    const amountInWei = parseInt(tx.value);
                    const amountInEth = amountInWei / 1e18;
                    
                    let status = 'completed';
                    if (tx.isError && parseInt(tx.isError) === 1) {
                        status = 'failed';
                    }
                    
                    return {
                        id: tx.hash,
                        blockchain: 'Ethereum',
                        type: isIncoming ? 'received' : 'sent',
                        amount: amountInEth.toFixed(6),
                        symbol: 'ETH',
                        fromAddress: tx.from,
                        toAddress: tx.to,
                        timestamp: parseInt(tx.timeStamp) * 1000,
                        status: status,
                        explorerUrl: currentNetwork === 'testnet'
                            ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                            : `https://etherscan.io/tx/${tx.hash}`
                    };
                });
            
            console.log(`ETH: Found ${transactions.length} valid transactions`);
            
            if (transactions.length > 0) {
                console.log('ETH: Sample transactions:', transactions.slice(0, 3));
            }
            
            return transactions;
        } catch (error) {
            console.error('ETH: Error fetching transactions:', error);
            return [];
        }
    };

    // ОБНОВЛЕННАЯ ФУНКЦИЯ: Получение транзакций BSC через ChainGateway
    const fetchBscTransactions = async (address) => {
        if (!address || address.trim() === '') {
            console.log('BSC: No address provided');
            return [];
        }
        
        try {
            console.log(`BSC (ChainGateway): Fetching transactions for address: ${address}`);
            
            // Определяем сеть для ChainGateway API
            const networkParam = currentNetwork === 'testnet' ? 'bsc-testnet' : 'bsc';
            const baseUrl = 'https://api.chaingateway.io/v1';
            
            // ВАЖНО: Уточните точный эндпоинт и параметры в документации ChainGateway
            // Возможные варианты: /transactions, /bsc/transactions, /address/transactions
            const apiUrl = `${baseUrl}/transactions?network=${networkParam}&address=${address}&limit=50`;
            
            console.log(`BSC (ChainGateway): Fetching from URL: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'X-API-Key': CHAINGATEWAY_API_KEY
                }
            });
            
            console.log(`BSC (ChainGateway): API response status - ${response.status}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log(`BSC (ChainGateway): API error - ${response.statusText}. Details: ${errorText}`);
                return [];
            }
            
            const data = await response.json();
            console.log('BSC (ChainGateway): Raw API response data:', data);
            
            // ВАЖНО: Структура ответа может отличаться.
            // Проверьте реальную структуру в консоли и адаптируйте код ниже
            
            let transactionsArray = [];
            
            // Вариант 1: Если ответ содержит data.success и data.transactions
            if (data && data.success && Array.isArray(data.transactions)) {
                transactionsArray = data.transactions;
            }
            // Вариант 2: Если ответ содержит data.data
            else if (data && Array.isArray(data.data)) {
                transactionsArray = data.data;
            }
            // Вариант 3: Если ответ содержит data.result
            else if (data && Array.isArray(data.result)) {
                transactionsArray = data.result;
            }
            // Вариант 4: Если сам ответ является массивом
            else if (Array.isArray(data)) {
                transactionsArray = data;
            } else {
                console.error('BSC (ChainGateway): Unexpected API response format.', data);
                return [];
            }
            
            // Преобразуем транзакции в нужный формат
            const transactions = transactionsArray.map(tx => {
                // Определяем тип транзакции
                const isIncoming = tx.to && tx.to.toLowerCase() === address.toLowerCase();
                const type = isIncoming ? 'received' : 'sent';
                
                // Получаем сумму (адаптируйте в зависимости от формата API)
                let amountInBnb = 0;
                
                // Вариант 1: Значение в wei (самый вероятный)
                if (tx.value) {
                    const amountInWei = parseInt(tx.value, 16); // Если hex
                    amountInBnb = amountInWei / 1e18;
                }
                // Вариант 2: Значение уже в BNB
                else if (tx.amount) {
                    amountInBnb = parseFloat(tx.amount);
                }
                
                // Получаем timestamp (адаптируйте в зависимости от формата API)
                let timestamp = 0;
                if (tx.timestamp) {
                    timestamp = parseInt(tx.timestamp) * 1000; // Предполагаем секунды
                } else if (tx.blockTimestamp) {
                    timestamp = parseInt(tx.blockTimestamp) * 1000;
                } else if (tx.timeStamp) {
                    timestamp = parseInt(tx.timeStamp) * 1000;
                }
                
                // Определяем статус
                let status = 'completed';
                if (tx.status === 0 || tx.status === false) {
                    status = 'failed';
                } else if (tx.status === 'pending') {
                    status = 'pending';
                }
                
                return {
                    id: tx.hash || tx.transactionHash,
                    blockchain: 'BSC',
                    type: type,
                    amount: amountInBnb.toFixed(6),
                    symbol: 'BNB', // Если API возвращает токены, может потребоваться адаптация
                    fromAddress: tx.from || '',
                    toAddress: tx.to || '',
                    timestamp: timestamp,
                    status: status,
                    explorerUrl: currentNetwork === 'testnet'
                        ? `https://testnet.bscscan.com/tx/${tx.hash || tx.transactionHash}`
                        : `https://bscscan.com/tx/${tx.hash || tx.transactionHash}`
                };
            });
            
            console.log(`BSC (ChainGateway): Successfully parsed ${transactions.length} transactions`);
            return transactions;
        } catch (error) {
            console.error('BSC (ChainGateway): Error fetching transactions:', error);
            return [];
        }
    };

    const fetchBtcTransactions = async (address) => {
        if (!address || address.trim() === '') {
            console.log('BTC: No address provided');
            return [];
        }
        
        try {
            console.log(`BTC: Fetching transactions for address...`);
            
            const baseUrl = currentNetwork === 'testnet'
                ? 'https://blockstream.info/testnet/api'
                : 'https://blockstream.info/api';
            
            const response = await fetch(`${baseUrl}/address/${address}/txs`);
            
            if (!response.ok) {
                console.log(`BTC: API error - ${response.status}`);
                return [];
            }
            
            const data = await response.json();
            
            const transactions = data.slice(0, 20).map(tx => {
                const isIncoming = tx.vout.some(output => 
                    output.scriptpubkey_address === address
                );
                
                let amount = 0;
                let type = 'unknown';
                
                if (isIncoming) {
                    amount = tx.vout
                        .filter(output => output.scriptpubkey_address === address)
                        .reduce((sum, output) => sum + output.value, 0);
                    type = 'received';
                } else {
                    amount = tx.vout.reduce((sum, output) => sum + output.value, 0);
                    type = 'sent';
                }
                
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
            
            console.log(`BTC: Found ${transactions.length} transactions`);
            return transactions;
        } catch (error) {
            console.error('BTC: Error fetching transactions:', error);
            return [];
        }
    };

    const fetchSolTransactions = async (address) => {
        if (!address || address.trim() === '') {
            console.log('SOL: No address provided');
            return [];
        }
        
        try {
            console.log(`SOL: Fetching transactions for address...`);
            
            const rpcUrl = currentNetwork === 'testnet'
                ? 'https://api.testnet.solana.com'
                : SOLANA_RPC_URL;
            
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
                    
                    let amount = 0;
                    if (meta && meta.postBalances && meta.preBalances) {
                        const accountIndex = message.accountKeys.findIndex(
                            (key, index) => key.pubkey === address
                        );
                        
                        if (accountIndex !== -1) {
                            const preBalance = meta.preBalances[accountIndex];
                            const postBalance = meta.postBalances[accountIndex];
                            
                            if (postBalance > preBalance) {
                                amount = (postBalance - preBalance) / 1e9;
                            } else if (postBalance < preBalance) {
                                amount = (preBalance - postBalance) / 1e9;
                            }
                        }
                    }
                    
                    if (amount === 0) continue;
                    
                    let type = 'unknown';
                    const accountKeys = message.accountKeys || [];
                    
                    if (meta) {
                        const receiverIndex = meta.postBalances.findIndex((balance, index) => {
                            const account = accountKeys[index];
                            return account && account.pubkey === address && 
                                   meta.preBalances[index] < balance;
                        });
                        
                        const senderIndex = meta.preBalances.findIndex((balance, index) => {
                            const account = accountKeys[index];
                            return account && account.pubkey === address && 
                                   meta.postBalances[index] < balance;
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
                    console.error('SOL: Error fetching transaction details:', error);
                    continue;
                }
            }
            
            console.log(`SOL: Found ${transactions.length} transactions`);
            return transactions;
        } catch (error) {
            console.error('SOL: Error fetching transactions:', error);
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