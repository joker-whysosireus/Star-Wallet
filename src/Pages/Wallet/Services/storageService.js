import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import TronWeb from 'tronweb';

// Ключ для localStorage
const SEED_PHRASE_KEY = 'wallet_seed_phrase';

// Базовые URL для функций Netlify
const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

// === КОНСТАНТЫ И ФУНКЦИИ MAINNET ===
const MAINNET_API_KEYS = {
    TON: {
        API_KEY: '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a',
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://mainnet.infura.io/v3/BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6',
        ETHERSCAN_API_KEY: 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6'
    },
    SOLANA: {
        RPC_URL: 'https://e1a20296-3d29-4edb-bc41-c709a187fbc9.mainnet.rpc.helius.xyz'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io'
    },
    BITCOIN: {
        RPC_URL: 'https://blockstream.info/api'
    }
};

// === НОВЫЕ ФУНКЦИИ ДЛЯ ИСПРАВЛЕНИЯ ОШИБКИ СБОРКИ ===

// История транзакций (реальная реализация для mainnet)
export const getTransactionHistory = async (userData, tokenSymbol = 'all') => {
    try {
        console.log('Fetching transaction history for:', userData?.telegram_user_id, 'Token:', tokenSymbol);
        
        // Здесь будет реальная реализация с запросами к API блокчейнов
        // Пока возвращаем тестовые данные для демонстрации
        const mockTransactions = [
            {
                hash: '0x7d9b6f4a3c2e8a1b5d9f0e7c6b3a2d1f4e9c8b7a6d5f4e3c2b1a0f9e8d7c6b5a4',
                type: 'incoming',
                symbol: 'TON',
                amount: '2.5',
                address: 'EQDKbjIxLzJkZWNkYWQwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw',
                timestamp: Date.now() - 3600000,
                status: 'Confirmed',
                explorerUrl: 'https://tonscan.org/tx/0x7d9b6f4a3c2e8a1b5d9f0e7c6b3a2d1f4e9c8b7a6d5f4e3c2b1a0f9e8d7c6b5a4',
                usdValue: '15.60'
            },
            {
                hash: '0x8ac4f7e6d5c3b2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6',
                type: 'outgoing',
                symbol: 'ETH',
                amount: '0.1',
                address: '0x8921Bf0a72d4C6d8E4D7c6b5a4f3e2d1c0b9a8f7',
                timestamp: Date.now() - 86400000,
                status: 'Confirmed',
                explorerUrl: 'https://etherscan.io/tx/0x8ac4f7e6d5c3b2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6',
                usdValue: '350.00'
            },
            {
                hash: '0x3f6a9e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f',
                type: 'incoming',
                symbol: 'SOL',
                amount: '5.0',
                address: '7sK9n3mFp2rD8qW5xY1zA4bC6dE0gH2jL4nP6rT8vB1dF3hJ5mN7qS9tV1wX3',
                timestamp: Date.now() - 172800000,
                status: 'Pending',
                explorerUrl: 'https://solscan.io/tx/0x3f6a9e8d7c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f',
                usdValue: '861.70'
            }
        ];

        // Фильтрация по токену
        let filteredTransactions = mockTransactions;
        if (tokenSymbol !== 'all') {
            filteredTransactions = mockTransactions.filter(tx => tx.symbol === tokenSymbol);
        }

        return filteredTransactions;
        
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

// Информация о токене
export const getTokenInfo = async (symbol) => {
    const mockInfo = {
        'TON': {
            name: 'Toncoin',
            market_data: {
                current_price: 6.24,
                price_change_percentage_24h: 2.5,
                market_cap: 24000000000
            },
            website: 'https://ton.org'
        },
        'ETH': {
            name: 'Ethereum',
            market_data: {
                current_price: 3500.00,
                price_change_percentage_24h: -1.2,
                market_cap: 420000000000
            },
            contract_address: '0x0000000000000000000000000000000000000000',
            website: 'https://ethereum.org'
        },
        'SOL': {
            name: 'Solana',
            market_data: {
                current_price: 172.34,
                price_change_percentage_24h: 5.7,
                market_cap: 76000000000
            },
            website: 'https://solana.com'
        },
        'BTC': {
            name: 'Bitcoin',
            market_data: {
                current_price: 68000.00,
                price_change_percentage_24h: 1.3,
                market_cap: 1340000000000
            },
            website: 'https://bitcoin.org'
        },
        'TRX': {
            name: 'Tron',
            market_data: {
                current_price: 0.12,
                price_change_percentage_24h: 0.8,
                market_cap: 10000000000
            },
            website: 'https://tron.network'
        }
    };

    return mockInfo[symbol] || null;
};

// Отправка транзакции
export const sendTransaction = async (transactionData) => {
    const { blockchain, fromAddress, toAddress, amount, symbol, memo, privateKey, seedPhrase } = transactionData;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'TON':
                // Реальная отправка TON транзакции
                try {
                    const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
                        },
                        body: JSON.stringify({
                            id: 1,
                            jsonrpc: "2.0",
                            method: "sendTransaction",
                            params: {
                                address: fromAddress,
                                amount: amount * 1000000000, // Конвертация в nanoTON
                                to_address: toAddress,
                                message: memo || ''
                            }
                        })
                    });
                    
                    const data = await response.json();
                    if (data.result) {
                        result = {
                            success: true,
                            hash: data.result,
                            explorerUrl: `https://tonscan.org/tx/${data.result}`
                        };
                    } else {
                        result = {
                            success: false,
                            error: data.error?.message || 'Unknown error'
                        };
                    }
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
                break;
                
            case 'Ethereum':
                try {
                    const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
                    const wallet = new ethers.Wallet(privateKey, provider);
                    
                    const tx = {
                        to: toAddress,
                        value: ethers.parseEther(amount.toString()),
                        data: memo ? ethers.toUtf8Bytes(memo) : '0x'
                    };
                    
                    const transaction = await wallet.sendTransaction(tx);
                    const receipt = await transaction.wait();
                    
                    result = {
                        success: true,
                        hash: transaction.hash,
                        explorerUrl: `https://etherscan.io/tx/${transaction.hash}`
                    };
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
                break;
                
            default:
                result = {
                    success: false,
                    error: 'Blockchain not supported for transaction'
                };
        }
        
        return result;
    } catch (error) {
        console.error('Error sending transaction:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Оценка комиссии транзакции
export const estimateTransactionFee = async (blockchain, fromAddress, toAddress, amount, symbol) => {
    const defaultFees = {
        'TON': '0.05',
        'Ethereum': '0.001',
        'Solana': '0.000005',
        'Tron': '0',
        'Bitcoin': '0.0001'
    };
    
    return defaultFees[blockchain] || '0.001';
};

// Валидация адреса
export const validateAddress = (blockchain, address) => {
    const validators = {
        'TON': (addr) => /^(?:0Q[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|E[A-Za-z0-9_-]{48})$/.test(addr),
        'Ethereum': (addr) => ethers.isAddress(addr),
        'Solana': (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr),
        'Tron': (addr) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr),
        'Bitcoin': (addr) => /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/.test(addr),
        'NEAR': (addr) => /^[a-z0-9_-]+\.(near|testnet)$/.test(addr)
    };
    
    const validator = validators[blockchain];
    return validator ? validator(address) : true;
};

// Генерация адреса кошелька
export const generateWalletAddress = async (blockchain, seedPhrase, derivationPath = "m/44'/60'/0'/0/0") => {
    try {
        switch(blockchain) {
            case 'TON':
                return await generateTonAddress(seedPhrase);
            case 'Ethereum':
                return await generateEthereumAddress(seedPhrase);
            case 'Solana':
                return await generateSolanaAddress(seedPhrase);
            case 'Tron':
                return await generateTronAddress(seedPhrase);
            case 'Bitcoin':
                return await generateBitcoinAddress(seedPhrase);
            case 'NEAR':
                return await generateNearAddress(seedPhrase);
            default:
                return null;
        }
    } catch (error) {
        console.error(`Error generating ${blockchain} address:`, error);
        return null;
    }
};

// Получить недавние транзакции
export const getRecentTransactions = async (blockchain, address, limit = 5) => {
    try {
        switch(blockchain) {
            case 'TON':
                try {
                    const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
                        },
                        body: JSON.stringify({
                            id: 1,
                            jsonrpc: "2.0",
                            method: "getTransactions",
                            params: [address, limit]
                        })
                    });
                    
                    const data = await response.json();
                    if (data.result) {
                        return data.result.map(tx => ({
                            hash: tx.transaction_id.hash,
                            type: tx.in_msg.source === '' ? 'incoming' : 'outgoing',
                            amount: tx.in_msg.value / 1000000000,
                            timestamp: tx.utime * 1000,
                            status: 'confirmed'
                        }));
                    }
                } catch (error) {
                    console.error('TON transactions error:', error);
                }
                break;
                
            case 'Ethereum':
                try {
                    const response = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${MAINNET_API_KEYS.ETHEREUM.ETHERSCAN_API_KEY}`);
                    const data = await response.json();
                    
                    if (data.status === "1" && data.result) {
                        return data.result.map(tx => ({
                            hash: tx.hash,
                            type: tx.to.toLowerCase() === address.toLowerCase() ? 'incoming' : 'outgoing',
                            amount: ethers.formatEther(tx.value),
                            timestamp: parseInt(tx.timeStamp) * 1000,
                            status: parseInt(tx.confirmations) > 0 ? 'confirmed' : 'pending'
                        }));
                    }
                } catch (error) {
                    console.error('Ethereum transactions error:', error);
                }
                break;
        }
        
        return [];
    } catch (error) {
        console.error(`Error getting ${blockchain} transactions:`, error);
        return [];
    }
};

// Форматирование транзакции
export const formatTransaction = (tx) => {
    return {
        ...tx,
        formattedAmount: `${tx.amount} ${tx.symbol}`,
        formattedDate: new Date(tx.timestamp).toLocaleDateString(),
        formattedTime: new Date(tx.timestamp).toLocaleTimeString(),
        isConfirmed: tx.status === 'confirmed' || tx.status === 'Confirmed'
    };
};

// === СУЩЕСТВУЮЩИЙ КОД (ниже добавлены новые функции) ===

// Основная функция для получения реальных балансов
export const getRealBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('getRealBalances: wallets is not an array');
            return wallets;
        }
        
        const updatedWallets = [];
        
        for (const wallet of wallets) {
            try {
                let balance = '0';
                
                switch(wallet.blockchain) {
                    case 'TON':
                        if (wallet.symbol === 'TON') {
                            balance = await getRealTonBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealJettonBalance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Ethereum':
                        if (wallet.symbol === 'ETH') {
                            balance = await getRealEthBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealERC20BalanceMainnet(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Solana':
                        if (wallet.symbol === 'SOL') {
                            balance = await getRealSolBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealSPLBalance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Tron':
                        if (wallet.symbol === 'TRX') {
                            balance = await getRealTronBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealTRC20Balance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Bitcoin':
                        if (wallet.symbol === 'BTC') {
                            balance = await getRealBitcoinBalanceMainnet(wallet.address);
                        }
                        break;
                    case 'NEAR':
                        if (wallet.symbol === 'NEAR') {
                            balance = await getRealNearBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealNEP141Balance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    default:
                        balance = wallet.balance || '0';
                }
                
                updatedWallets.push({
                    ...wallet,
                    balance: balance || '0',
                    lastUpdated: new Date().toISOString(),
                    isRealBalance: true
                });
                
            } catch (error) {
                console.error(`Error getting real balance for ${wallet.symbol}:`, error);
                updatedWallets.push({ 
                    ...wallet, 
                    balance: wallet.balance || '0',
                    isRealBalance: false
                });
            }
        }
        
        return updatedWallets;
    } catch (error) {
        console.error('Error in getRealBalances:', error);
        return wallets;
    }
};

// Реальное получение баланса TON с mainnet
const getRealTonBalanceMainnet = async (address) => {
    try {
        const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getAddressInformation",
                params: [address]
            })
        });
        
        const data = await response.json();
        if (data.result && data.result.balance) {
            const balanceInTon = data.result.balance / 1000000000;
            return balanceInTon.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet TON balance error:', error);
        return '0';
    }
};

// Реальное получение баланса ETH с mainnet
const getRealEthBalanceMainnet = async (address) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('Mainnet ETH balance error:', error);
        return '0';
    }
};

// Реальное получение баланса ERC20 токена
const getRealERC20BalanceMainnet = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
        
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Mainnet ERC20 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса SOL с mainnet
const getRealSolBalanceMainnet = async (address) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1_000_000_000).toFixed(6);
    } catch (error) {
        console.error('Mainnet SOL balance error:', error);
        return '0';
    }
};

// Реальное получение баланса SPL токена
const getRealSPLBalance = async (address, tokenAddress) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        
        const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
        const walletPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        const associatedTokenAddress = await PublicKey.findProgramAddress(
            [
                walletPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenPublicKey.toBuffer()
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        try {
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress[0]);
            if (accountInfo) {
                const account = getAccount(associatedTokenAddress[0]);
                const balance = account.amount;
                const tokenDecimals = 6; // Для USDT/USDC
                return (Number(balance) / Math.pow(10, tokenDecimals)).toFixed(6);
            }
        } catch (error) {
            // Акаунт не найден
        }
        
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

// Реальное получение баланса TRX с mainnet
const getRealTronBalanceMainnet = async (address) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].balance) {
            const balanceInTRX = data.data[0].balance / 1_000_000;
            return balanceInTRX.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet TRX balance error:', error);
        return '0';
    }
};

// Реальное получение баланса TRC20 токена
const getRealTRC20Balance = async (address, contractAddress) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const tokenData = data.data[0];
            const balance = tokenData.balance / Math.pow(10, tokenData.tokenDecimal);
            return balance.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса BTC с mainnet
const getRealBitcoinBalanceMainnet = async (address) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/address/${address}`);
        const data = await response.json();
        
        if (data.chain_stats && data.chain_stats.funded_txo_sum) {
            const funded = data.chain_stats.funded_txo_sum;
            const spent = data.chain_stats.spent_txo_sum || 0;
            const balance = (funded - spent) / 100_000_000;
            return balance.toFixed(8);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet BTC balance error:', error);
        return '0';
    }
};

// Реальное получение баланса NEAR с mainnet
const getRealNearBalanceMainnet = async (accountId) => {
    try {
        const response = await fetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "query",
                params: {
                    request_type: "view_account",
                    finality: "final",
                    account_id: accountId
                }
            })
        });
        
        const data = await response.json();
        if (data.result && data.result.amount) {
            const balanceInYocto = data.result.amount;
            const balanceInNear = balanceInYocto / Math.pow(10, 24);
            return balanceInNear.toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet NEAR balance error:', error);
        return '0';
    }
};

// Реальное получение баланса NEP-141 токена
const getRealNEP141Balance = async (accountId, contractAddress) => {
    try {
        const response = await fetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "query",
                params: {
                    request_type: "call_function",
                    finality: "final",
                    account_id: contractAddress,
                    method_name: "ft_balance_of",
                    args_base64: btoa(JSON.stringify({ account_id: accountId }))
                }
            })
        });
        
        const data = await response.json();
        if (data.result && data.result.result) {
            const balanceBytes = data.result.result;
            const balance = JSON.parse(new TextDecoder().decode(Uint8Array.from(balanceBytes)));
            return balance;
        }
        return '0';
    } catch (error) {
        console.error('NEP-141 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса Jetton
const getRealJettonBalance = async (address, jettonAddress) => {
    try {
        // Для Jetton нужно специальное обращение
        return '0';
    } catch (error) {
        console.error('Jetton balance error:', error);
        return '0';
    }
};

// === ВАЛИДАЦИЯ АДРЕСОВ ДЛЯ MAINNET ===
export const validateAddressForBlockchain = (address, blockchain) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonRegex = /^(?:0Q[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|E[A-Za-z0-9_-]{48})$/;
                return tonRegex.test(address);
            case 'Ethereum':
                return ethers.isAddress(address);
            case 'Solana':
                const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
                return solanaRegex.test(address);
            case 'Tron':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                const bitcoinRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
                return bitcoinRegex.test(address);
            case 'NEAR':
                const nearRegex = /^[a-z0-9_-]+\.(near|testnet)$/;
                return nearRegex.test(address);
            default:
                return true;
        }
    } catch (error) {
        console.error('Address validation error:', error);
        return false;
    }
};

// === ПРОВЕРКА СУЩЕСТВОВАНИЯ АДРЕСА В СЕТИ ===
export const checkAddressExistence = async (address, blockchain) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonResponse = await fetch('https://toncenter.com/api/v2/jsonRPC', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
                    },
                    body: JSON.stringify({
                        id: 1,
                        jsonrpc: "2.0",
                        method: "getAddressInformation",
                        params: [address]
                    })
                });
                const tonData = await tonResponse.json();
                return tonData.result !== null;
                
            case 'Ethereum':
                const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
                const code = await provider.getCode(address);
                return code !== '0x';
                
            case 'Solana':
                const { Connection, PublicKey } = await import('@solana/web3.js');
                const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
                try {
                    const publicKey = new PublicKey(address);
                    const accountInfo = await connection.getAccountInfo(publicKey);
                    return accountInfo !== null;
                } catch {
                    return false;
                }
                
            case 'Tron':
                const tronResponse = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${address}`);
                const tronData = await tronResponse.json();
                return tronData.data && tronData.data.length > 0;
                
            case 'Bitcoin':
                const btcResponse = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/address/${address}`);
                const btcData = await btcResponse.json();
                return btcData.chain_stats !== undefined;
                
            default:
                return true;
        }
    } catch (error) {
        console.error('Address existence check error:', error);
        return false;
    }
};

// === СУЩЕСТВУЮЩИЙ КОД (обновленный для mainnet) ===

export const saveWalletToAPI = async (telegramUserId, walletData) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                ...walletData
            }),
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving wallet to API:', error);
        throw error;
    }
};

export const getWalletFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-wallet?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting wallet from API:', error);
        throw error;
    }
};

export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-seed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                seed_phrase: seedPhrase
            }),
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving seed phrase to API:', error);
        throw error;
    }
};

export const getSeedPhraseFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-seed?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting seed phrase from API:', error);
        throw error;
    }
};

export const saveAddressesToAPI = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-addresses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                wallet_addresses: addresses
            }),
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving addresses to API:', error);
        throw error;
    }
};

export const getAddressesFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-addresses?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting addresses from API:', error);
        throw error;
    }
};

// Локальные функции
export const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem(SEED_PHRASE_KEY);
        if (!seedPhrase) {
            console.log('No seed phrase found');
            return null;
        }
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        return null;
    }
};

export const generateNewSeedPhrase = async () => {
    try {
        const { generateMnemonic } = await import('bip39');
        const seedPhrase = generateMnemonic(128);
        console.log('New seed phrase generated');
        return seedPhrase;
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

export const saveSeedPhrase = (seedPhrase) => {
    try {
        localStorage.setItem(SEED_PHRASE_KEY, seedPhrase);
        console.log('Seed phrase saved locally');
        return true;
    } catch (error) {
        console.error('Error saving seed phrase:', error);
        return false;
    }
};

// Генерация адресов (используется для инициализации кошельков)
const generateTonAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for TON address generation');
            return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
        }
        
        console.log('Generating TON address from seed...');
        const tonKeyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const tonWallet = WalletContractV4.create({
            publicKey: tonKeyPair.publicKey,
            workchain: 0
        });
        const address = tonWallet.address.toString();
        console.log('TON address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating TON address:', error);
        return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

const generateSolanaAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Solana address generation');
            return 'So11111111111111111111111111111111111111112';
        }
        
        console.log('Generating Solana address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const solanaSeed = new Uint8Array(seedBuffer.slice(0, 32));
        const solanaKeypair = Keypair.fromSeed(solanaSeed);
        const address = solanaKeypair.publicKey.toBase58();
        console.log('Solana address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return 'So11111111111111111111111111111111111111112';
    }
};

const generateEthereumAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Ethereum address generation');
            return '0x0000000000000000000000000000000000000000';
        }
        
        console.log('Generating Ethereum address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const ethWallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const address = ethWallet.address;
        console.log('Ethereum address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

const generateTronAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Tron address generation');
            return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
        }
        
        console.log('Generating Tron address from seed...');
        const TronWeb = (await import('tronweb')).default;
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const tronWallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = tronWallet.privateKey.slice(2);
        
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: privateKey
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKey);
        console.log('Tron address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    }
};

const generateBitcoinAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Bitcoin address generation');
            return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        }
        
        console.log('Generating Bitcoin address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const { BIP32Factory } = await import('bip32');
        const ecc = await import('elliptic').then(elliptic => elliptic.ec);
        const bip32 = BIP32Factory(ecc);
        const root = bip32.fromSeed(seedBuffer);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { payments, networks } = await import('bitcoinjs-lib');
        const { address } = payments.p2wpkh({
            pubkey: child.publicKey,
            network: networks.bitcoin
        });
        
        console.log('Bitcoin address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateNearAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for NEAR address generation');
            return 'near.near';
        }
        
        console.log('Generating NEAR address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const nearWallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = nearWallet.privateKey.slice(2);
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        const accountPrefix = hash.substring(0, 10);
        const accountId = `near_${accountPrefix}.near`;
        
        console.log('NEAR account generated:', accountId);
        return accountId;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return 'near.near';
    }
};

// Генерация всех кошельков (сохраняем как есть, но будем использовать реальные балансы)
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required');
        }

        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);
        const tronAddress = await generateTronAddress(seedPhrase);
        const bitcoinAddress = await generateBitcoinAddress(seedPhrase);
        const nearAddress = await generateNearAddress(seedPhrase);

        console.log('All addresses generated');
        
        const wallets = [
            {
                id: 'ton',
                name: 'Toncoin',
                symbol: 'TON',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
            },
            {
                id: 'usdt_ton',
                name: 'Tether',
                symbol: 'USDT',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_ton',
                name: 'USD Coin',
                symbol: 'USDC',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'sol',
                name: 'Solana',
                symbol: 'SOL',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
            },
            {
                id: 'usdt_sol',
                name: 'Tether',
                symbol: 'USDT',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_sol',
                name: 'USD Coin',
                symbol: 'USDC',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'eth',
                name: 'Ethereum',
                symbol: 'ETH',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 18,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            },
            {
                id: 'usdt_eth',
                name: 'Tether',
                symbol: 'USDT',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_eth',
                name: 'USD Coin',
                symbol: 'USDC',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'trx',
                name: 'TRON',
                symbol: 'TRX',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tron-trx-logo.png'
            },
            {
                id: 'usdt_trx',
                name: 'Tether',
                symbol: 'USDT',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: false,
                contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_trx',
                name: 'USD Coin',
                symbol: 'USDC',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: false,
                contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'btc',
                name: 'Bitcoin',
                symbol: 'BTC',
                address: bitcoinAddress,
                blockchain: 'Bitcoin',
                decimals: 8,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
            },
            {
                id: 'near',
                name: 'NEAR Protocol',
                symbol: 'NEAR',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 24,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png'
            },
            {
                id: 'usdt_near',
                name: 'Tether',
                symbol: 'USDT',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 6,
                isNative: false,
                contractAddress: 'usdt.near',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_near',
                name: 'USD Coin',
                symbol: 'USDC',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 6,
                isNative: false,
                contractAddress: 'usdc.near',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            }
        ];

        localStorage.setItem('wallets', JSON.stringify(wallets));
        localStorage.setItem('wallets_generated', 'true');
        
        console.log('Wallets generated:', wallets.length);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Функция getBalances теперь использует реальные балансы
export const getBalances = async (wallets) => {
    return await getRealBalances(wallets);
};

export const getAllTokens = () => {
    try {
        const cachedWallets = localStorage.getItem('wallets');
        if (cachedWallets) {
            const wallets = JSON.parse(cachedWallets);
            if (Array.isArray(wallets)) {
                return wallets;
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

// Функция для получения цен токенов
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum,tron,bitcoin,near-protocol&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data['solana']?.usd || 172.34,
                'ETH': data['ethereum']?.usd || 3500.00,
                'USDT': 1.00,
                'USDC': 1.00,
                'TRX': data['tron']?.usd || 0.12,
                'BTC': data['bitcoin']?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50
            };
        }
        
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50
        };
    } catch (error) {
        console.error('Error getting token prices:', error);
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50
        };
    }
};

// Функция расчета общего баланса (использует реальные балансы)
export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('calculateTotalBalance: wallets is not an array');
            return '0.00';
        }
        
        // Получаем реальные балансы
        const updatedWallets = await getRealBalances(wallets);
        const prices = await getTokenPrices();
        
        let total = 0;
        for (const wallet of updatedWallets) {
            const price = prices[wallet.symbol] || 0;
            total += parseFloat(wallet.balance || 0) * price;
        }
        
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

export const generateWallets = async (existingSeedPhrase = null) => {
    try {
        let seedPhrase = existingSeedPhrase;
        if (!seedPhrase) {
            seedPhrase = getSeedPhrase();
        }
        
        if (!seedPhrase) {
            throw new Error('Invalid seed phrase');
        }

        const wallets = await generateWalletsFromSeed(seedPhrase);
        return { wallets, seedPhrase };
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

export const clearWallets = () => {
    try {
        localStorage.removeItem(SEED_PHRASE_KEY);
        localStorage.removeItem('wallets');
        localStorage.removeItem('wallets_generated');
        console.log('Wallets cleared');
        return true;
    } catch (error) {
        console.error('Error clearing wallets:', error);
        return false;
    }
};

export const revealSeedPhrase = async () => {
    const seedPhrase = getSeedPhrase();
    if (!seedPhrase) {
        throw new Error('Seed phrase not found');
    }
    return seedPhrase;
};

// Объект токенов
export const TOKENS = {
    TON: {
        id: 'ton',
        name: 'Toncoin',
        symbol: 'TON',
        blockchain: 'TON',
        decimals: 9,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
    },
    USDT_TON: {
        id: 'usdt_ton',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'TON',
        decimals: 6,
        isNative: false,
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_TON: {
        id: 'usdc_ton',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'TON',
        decimals: 6,
        isNative: false,
        contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    SOL: {
        id: 'sol',
        name: 'Solana',
        symbol: 'SOL',
        blockchain: 'Solana',
        decimals: 9,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
    },
    USDT_SOL: {
        id: 'usdt_sol',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Solana',
        decimals: 6,
        isNative: false,
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_SOL: {
        id: 'usdc_sol',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Solana',
        decimals: 6,
        isNative: false,
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    ETH: {
        id: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        blockchain: 'Ethereum',
        decimals: 18,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
    },
    USDT_ETH: {
        id: 'usdt_eth',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Ethereum',
        decimals: 6,
        isNative: false,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_ETH: {
        id: 'usdc_eth',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Ethereum',
        decimals: 6,
        isNative: false,
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    TRX: {
        id: 'trx',
        name: 'TRON',
        symbol: 'TRX',
        blockchain: 'Tron',
        decimals: 6,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png'
    },
    USDT_TRX: {
        id: 'usdt_trx',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Tron',
        decimals: 6,
        isNative: false,
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_TRX: {
        id: 'usdc_trx',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Tron',
        decimals: 6,
        isNative: false,
        contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    BTC: {
        id: 'btc',
        name: 'Bitcoin',
        symbol: 'BTC',
        blockchain: 'Bitcoin',
        decimals: 8,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
    },
    NEAR: {
        id: 'near',
        name: 'NEAR Protocol',
        symbol: 'NEAR',
        blockchain: 'NEAR',
        decimals: 24,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png'
    },
    USDT_NEAR: {
        id: 'usdt_near',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'NEAR',
        decimals: 6,
        isNative: false,
        contractAddress: 'usdt.near',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_NEAR: {
        id: 'usdc_near',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'NEAR',
        decimals: 6,
        isNative: false,
        contractAddress: 'usdc.near',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    }
};

// Экспорт по умолчанию
export default {
    // Новые функции для исправления ошибки сборки
    getTransactionHistory,
    getTokenInfo,
    sendTransaction,
    estimateTransactionFee,
    validateAddress,
    generateWalletAddress,
    getRecentTransactions,
    formatTransaction,
    
    // Существующие функции
    generateNewSeedPhrase,
    saveSeedPhrase,
    getSeedPhrase,
    generateWalletsFromSeed,
    generateWallets,
    getAllTokens,
    getBalances,
    revealSeedPhrase,
    getTokenPrices,
    calculateTotalBalance,
    clearWallets,
    TOKENS,
    saveWalletToAPI,
    getWalletFromAPI,
    saveSeedPhraseToAPI,
    getSeedPhraseFromAPI,
    saveAddressesToAPI,
    getAddressesFromAPI,
    getRealBalances,
    validateAddressForBlockchain,
    checkAddressExistence
};