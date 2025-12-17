// Services/walletService.js
import { generateNewSeedPhrase, generateWalletsFromSeed } from './storageService';

const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// === КОНСТАНТЫ ДЛЯ MAINNET С РЕАЛЬНЫМИ КЛЮЧАМИ ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        API_KEY: '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a',
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

// === РЕАЛЬНЫЕ ФУНКЦИИ ДЛЯ MAINNET ===

/**
 * Получает реальные балансы с mainnet для всех кошельков
 */
export const getRealTokenBalances = async (wallets, userData) => {
    try {
        if (!Array.isArray(wallets) || !userData) {
            console.error('getRealTokenBalances: invalid parameters');
            return wallets;
        }
        
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    let balance = '0';
                    
                    switch(wallet.blockchain) {
                        case 'TON':
                            if (wallet.symbol === 'TON') {
                                balance = await getRealTonBalance(wallet.address);
                            } else if (wallet.contractAddress) {
                                balance = await getRealJettonBalance(wallet.address, wallet.contractAddress);
                            }
                            break;
                        case 'Ethereum':
                            if (wallet.symbol === 'ETH') {
                                balance = await getRealEthBalance(wallet.address);
                            } else if (wallet.contractAddress) {
                                balance = await getRealERC20Balance(wallet.address, wallet.contractAddress);
                            }
                            break;
                        case 'Solana':
                            if (wallet.symbol === 'SOL') {
                                balance = await getRealSolBalance(wallet.address);
                            } else if (wallet.contractAddress) {
                                balance = await getRealSPLBalance(wallet.address, wallet.contractAddress);
                            }
                            break;
                        case 'Tron':
                            if (wallet.symbol === 'TRX') {
                                balance = await getRealTronBalance(wallet.address);
                            } else if (wallet.contractAddress) {
                                balance = await getRealTRC20Balance(wallet.address, wallet.contractAddress);
                            }
                            break;
                        case 'Bitcoin':
                            if (wallet.symbol === 'BTC') {
                                balance = await getRealBitcoinBalance(wallet.address);
                            }
                            break;
                        case 'NEAR':
                            if (wallet.symbol === 'NEAR') {
                                balance = await getRealNearBalance(wallet.address);
                            } else if (wallet.contractAddress) {
                                balance = await getRealNEP141Balance(wallet.address, wallet.contractAddress);
                            }
                            break;
                        default:
                            balance = wallet.balance || '0';
                    }
                    
                    return { 
                        ...wallet, 
                        balance: balance || '0',
                        lastUpdated: new Date().toISOString(),
                        isRealBalance: true
                    };
                } catch (error) {
                    console.error(`Error getting balance for ${wallet.symbol}:`, error);
                    return { 
                        ...wallet, 
                        balance: '0',
                        isRealBalance: false
                    };
                }
            })
        );
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting real balances:', error);
        return wallets;
    }
};

/**
 * Реальное получение баланса TON с mainnet
 */
const getRealTonBalance = async (address) => {
    try {
        const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': MAINNET_CONFIG.TON.API_KEY 
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
        console.error('Real TON balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса Ethereum с mainnet
 */
const getRealEthBalance = async (address) => {
    try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('Real ETH balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса ERC20 токена
 */
const getRealERC20Balance = async (address, contractAddress) => {
    try {
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.ETHEREUM.RPC_URL);
        
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Real ERC20 balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса Solana с mainnet
 */
const getRealSolBalance = async (address) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1_000_000_000).toFixed(6);
    } catch (error) {
        console.error('Real SOL balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса SPL токена
 */
const getRealSPLBalance = async (address, tokenAddress) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        
        const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
        const walletPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        // Получаем ассоциированный токен-аккаунт
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
                
                // Для USDT/USDC 6 decimals
                const tokenDecimals = 6;
                return (Number(balance) / Math.pow(10, tokenDecimals)).toFixed(6);
            }
        } catch (error) {
            // Акаунт не найден, баланс 0
        }
        
        return '0';
    } catch (error) {
        console.error('Real SPL balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса Tron с mainnet
 */
const getRealTronBalance = async (address) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].balance) {
            const balanceInTRX = data.data[0].balance / 1_000_000;
            return balanceInTRX.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Real TRX balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса TRC20 токена
 */
const getRealTRC20Balance = async (address, contractAddress) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const tokenData = data.data[0];
            const balance = tokenData.balance / Math.pow(10, tokenData.tokenDecimal);
            return balance.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Real TRC20 balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса Bitcoin с mainnet
 */
const getRealBitcoinBalance = async (address) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/address/${address}`);
        const data = await response.json();
        
        if (data.chain_stats && data.chain_stats.funded_txo_sum) {
            const funded = data.chain_stats.funded_txo_sum;
            const spent = data.chain_stats.spent_txo_sum || 0;
            const balance = (funded - spent) / 100_000_000;
            return balance.toFixed(8);
        }
        return '0';
    } catch (error) {
        console.error('Real BTC balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса NEAR с mainnet
 */
const getRealNearBalance = async (accountId) => {
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
        console.error('Real NEAR balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса Jetton
 */
const getRealJettonBalance = async (address, jettonAddress) => {
    try {
        // Для Jetton баланса нужно делать отдельные запросы
        // Пока возвращаем 0
        return '0';
    } catch (error) {
        console.error('Real Jetton balance error:', error);
        return '0';
    }
};

/**
 * Реальное получение баланса NEP-141 токена
 */
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
        console.error('Real NEP-141 balance error:', error);
        return '0';
    }
};

/**
 * Проверка существования адреса в сети
 */
export const checkAddressExists = async (address, blockchain) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonResponse = await fetch('https://toncenter.com/api/v2/jsonRPC', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-Key': MAINNET_CONFIG.TON.API_KEY 
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
                const { ethers } = await import('ethers');
                const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.ETHEREUM.RPC_URL);
                const code = await provider.getCode(address);
                return code !== '0x';
                
            case 'Solana':
                const { Connection, PublicKey } = await import('@solana/web3.js');
                const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
                const publicKey = new PublicKey(address);
                const accountInfo = await connection.getAccountInfo(publicKey);
                return accountInfo !== null;
                
            case 'Tron':
                const tronResponse = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`);
                const tronData = await tronResponse.json();
                return tronData.data && tronData.data.length > 0;
                
            case 'Bitcoin':
                const btcResponse = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/address/${address}`);
                const btcData = await btcResponse.json();
                return btcData.chain_stats !== undefined;
                
            case 'NEAR':
                const nearResponse = await fetch('https://rpc.mainnet.near.org', {
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
                            account_id: address
                        }
                    })
                });
                const nearData = await nearResponse.json();
                return !nearData.error;
                
            default:
                return true;
        }
    } catch (error) {
        console.error('Address check error:', error);
        return false;
    }
};

/**
 * Реальная отправка токенов на mainnet
 */
export const sendTokensReal = async (params) => {
    const { fromToken, toAddress, amount, userData, comment = '' } = params;
    
    try {
        console.log(`Sending ${amount} ${fromToken.symbol} to ${toAddress} on mainnet`);
        
        if (!fromToken || !toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters for mainnet transfer');
        }

        // Проверяем баланс перед отправкой
        const currentBalance = await getRealTokenBalances([fromToken], userData);
        const walletBalance = currentBalance[0]?.balance || '0';
        
        if (parseFloat(amount) > parseFloat(walletBalance)) {
            throw new Error(`Insufficient balance. Available: ${walletBalance} ${fromToken.symbol}`);
        }

        // Вызываем соответствующий сервис для отправки
        switch(fromToken.blockchain) {
            case 'TON':
                const { sendTonReal } = await import('./tonService');
                return await sendTonReal({
                    fromAddress: fromToken.address,
                    toAddress,
                    amount,
                    seedPhrase: userData.seed_phrases,
                    comment
                });
                
            case 'Ethereum':
                const { sendEthReal, sendERC20Real } = await import('./ethereumService');
                if (fromToken.symbol === 'ETH') {
                    return await sendEthReal({
                        toAddress,
                        amount,
                        userData
                    });
                } else {
                    return await sendERC20Real({
                        contractAddress: fromToken.contractAddress,
                        toAddress,
                        amount,
                        userData
                    });
                }
                
            case 'Solana':
                const { sendSolReal } = await import('./solanaService');
                if (fromToken.symbol === 'SOL') {
                    return await sendSolReal({
                        toAddress,
                        amount,
                        userData
                    });
                } else {
                    throw new Error('SPL token transfers not yet implemented');
                }
                
            case 'Tron':
                const { sendTrxReal, sendTRC20Real } = await import('./tronService');
                if (fromToken.symbol === 'TRX') {
                    return await sendTrxReal({
                        toAddress,
                        amount,
                        userData
                    });
                } else {
                    return await sendTRC20Real({
                        contractAddress: fromToken.contractAddress,
                        toAddress,
                        amount,
                        userData
                    });
                }
                
            case 'Bitcoin':
                const { sendBitcoinReal } = await import('./bitcoinService');
                if (fromToken.symbol === 'BTC') {
                    return await sendBitcoinReal({
                        toAddress,
                        amount,
                        userData
                    });
                } else {
                    throw new Error('Only BTC transfers supported');
                }
                
            default:
                throw new Error(`Blockchain ${fromToken.blockchain} not supported for mainnet transfers`);
        }
    } catch (error) {
        console.error('Error sending tokens:', error);
        throw new Error(`Failed to send ${fromToken.symbol}: ${error.message}`);
    }
};

/**
 * Получение реальных цен токенов
 */
export const getRealTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum,tron,bitcoin,near-protocol,tether,usd-coin&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data['solana']?.usd || 172.34,
                'ETH': data['ethereum']?.usd || 3500.00,
                'USDT': data['tether']?.usd || 1.00,
                'USDC': data['usd-coin']?.usd || 1.00,
                'TRX': data['tron']?.usd || 0.12,
                'BTC': data['bitcoin']?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50
            };
        }
        
        // Fallback prices
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
        console.error('Error getting real token prices:', error);
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

/**
 * Расчет общего баланса в USD
 */
export const calculateRealTotalBalance = async (wallets, userData) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return '0.00';
        }
        
        // Получаем реальные балансы
        const walletsWithRealBalances = await getRealTokenBalances(wallets, userData);
        
        // Получаем реальные цены
        const prices = await getRealTokenPrices();
        
        // Рассчитываем общий баланс
        let totalUSD = 0;
        
        for (const wallet of walletsWithRealBalances) {
            const price = prices[wallet.symbol] || 0;
            const balance = parseFloat(wallet.balance || 0);
            totalUSD += balance * price;
        }
        
        return totalUSD.toFixed(2);
    } catch (error) {
        console.error('Error calculating real total balance:', error);
        return '0.00';
    }
};

// === СУЩЕСТВУЮЩИЙ КОД ===

export const initializeUserWallets = async (userData) => {
    try {
        console.log("walletService: Initializing user wallets for:", userData.telegram_user_id);
        
        if (!userData || !userData.telegram_user_id) {
            throw new Error("Invalid user data");
        }

        let seedPhrase = userData.seed_phrases;
        
        if (!seedPhrase) {
            console.log("walletService: No seed phrase found, generating new one...");
            seedPhrase = await generateNewSeedPhrase();
            console.log("walletService: New seed phrase generated");
            
            const saveSeedResult = await saveSeedPhraseToAPI(
                userData.telegram_user_id,
                seedPhrase
            );
            
            if (!saveSeedResult.success) {
                throw new Error("Failed to save seed phrase to database");
            }
        }

        const wallets = await generateWalletsFromSeed(seedPhrase);
        
        const addresses = {};
        wallets.forEach(wallet => {
            addresses[wallet.blockchain] = {
                address: wallet.address,
                symbol: wallet.symbol,
                network: 'mainnet'
            };
        });

        console.log("walletService: Saving addresses to database...");
        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id,
            addresses
        );

        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: addresses,
            wallets: wallets
        };

        localStorage.setItem('user_wallets', JSON.stringify(wallets));
        localStorage.setItem('user_seed_phrase', seedPhrase);
        localStorage.setItem('user_data', JSON.stringify(updatedUserData));

        console.log("walletService: User wallets initialized successfully");
        return updatedUserData;

    } catch (error) {
        console.error("walletService: Error initializing user wallets:", error);
        return {
            ...userData,
            wallets: []
        };
    }
};

export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-seed`, {
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error saving seed phrase:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const saveAddressesToAPI = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error saving addresses:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const getUserWallets = async (telegramUserId) => {
    try {
        const cachedWallets = localStorage.getItem('user_wallets');
        if (cachedWallets) {
            return JSON.parse(cachedWallets);
        }

        const response = await fetch(`${WALLET_API_URL}/get-wallets?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.wallets) {
            localStorage.setItem('user_wallets', JSON.stringify(data.wallets));
            return data.wallets;
        }

        return [];
    } catch (error) {
        console.error("Error getting user wallets:", error);
        return [];
    }
};

export const getUserSeedPhrase = async (telegramUserId) => {
    try {
        const cachedSeedPhrase = localStorage.getItem('user_seed_phrase');
        if (cachedSeedPhrase) {
            return cachedSeedPhrase;
        }

        const response = await fetch(`${WALLET_API_URL}/get-seed?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.seed_phrase) {
            localStorage.setItem('user_seed_phrase', data.seed_phrase);
            return data.seed_phrase;
        }

        return null;
    } catch (error) {
        console.error("Error getting user seed phrase:", error);
        return null;
    }
};

export const updateTokenBalances = async (telegramUserId, balances) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/update-balances`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                token_balances: balances
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error updating token balances:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const clearUserData = () => {
    localStorage.removeItem('user_wallets');
    localStorage.removeItem('user_seed_phrase');
    localStorage.removeItem('user_data');
    localStorage.removeItem('wallets');
    localStorage.removeItem('wallet_seed_phrase');
    
    console.log("User data cleared from localStorage");
};

export default {
    initializeUserWallets,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    getUserWallets,
    getUserSeedPhrase,
    updateTokenBalances,
    clearUserData,
    // НОВЫЕ ФУНКЦИИ MAINNET
    getRealTokenBalances,
    checkAddressExists,
    sendTokensReal,
    getRealTokenPrices,
    calculateRealTotalBalance
};