import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import TronWeb from 'tronweb';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v3/jsonRPC',
        API_KEY: '683bdd6cfa7a49a1b14c38c0c80b0b99'
    },
    ETHEREUM: {
        RPC_URL: 'https://mainnet.infura.io/v3/683bdd6cfa7a49a1b14c38c0c80b0b99'
    },
    SOLANA: {
        RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=e1a20296-3d29-4edb-bc41-c709a187fbc9'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        API_KEY: '36b3eb2e-5f06-46f7-8aa4-bab1546a6a9f'
    },
    BITCOIN: {
        RPC_URL: 'https://blockstream.info/api'
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/'
    }
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// === ТИПЫ И КОНСТАНТЫ ТОКЕНОВ ===
export const TOKENS = {
    // Native tokens
    TON: { symbol: 'TON', name: 'Toncoin', blockchain: 'TON', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' },
    SOL: { symbol: 'SOL', name: 'Solana', blockchain: 'Solana', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
    ETH: { symbol: 'ETH', name: 'Ethereum', blockchain: 'Ethereum', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    BNB: { symbol: 'BNB', name: 'BNB', blockchain: 'BSC', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
    TRX: { symbol: 'TRX', name: 'TRON', blockchain: 'Tron', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' },
    BTC: { symbol: 'BTC', name: 'Bitcoin', blockchain: 'Bitcoin', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
    NEAR: { symbol: 'NEAR', name: 'NEAR Protocol', blockchain: 'NEAR', decimals: 24, isNative: true, logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png' },
    
    // USDT tokens
    USDT_TON: { symbol: 'USDT', name: 'Tether', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    USDT_SOL: { symbol: 'USDT', name: 'Tether', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    USDT_ETH: { symbol: 'USDT', name: 'Tether', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    USDT_BSC: { symbol: 'USDT', name: 'Tether', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x55d398326f99059ff775485246999027b3197955', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    USDT_TRX: { symbol: 'USDT', name: 'Tether', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    USDT_NEAR: { symbol: 'USDT', name: 'Tether', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdt.near', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    
    // USDC tokens for all blockchains except Bitcoin
    USDC_TON: { symbol: 'USDC', name: 'USD Coin', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3727', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    USDC_SOL: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    USDC_ETH: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    USDC_BSC: { symbol: 'USDC', name: 'USD Coin', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    USDC_TRX: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    USDC_NEAR: { symbol: 'USDC', name: 'USD Coin', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdc.near', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' }
};

// === ОСНОВНЫЕ ФУНКЦИИ ГЕНЕРАЦИИ КОШЕЛЬКОВ ===
export const generateNewSeedPhrase = () => {
    try {
        return bip39.generateMnemonic(128);
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress] = await Promise.all([
            generateTonAddress(seedPhrase),
            generateSolanaAddress(seedPhrase),
            generateEthereumAddress(seedPhrase),
            generateBSCAddress(seedPhrase),
            generateTronAddress(seedPhrase),
            generateBitcoinAddress(seedPhrase),
            generateNearAddress(seedPhrase)
        ]);

        const wallets = Object.values(TOKENS).map(token => {
            let address = '';
            switch(token.blockchain) {
                case 'TON': address = tonAddress; break;
                case 'Solana': address = solanaAddress; break;
                case 'Ethereum': address = ethAddress; break;
                case 'BSC': address = bscAddress; break;
                case 'Tron': address = tronAddress; break;
                case 'Bitcoin': address = bitcoinAddress; break;
                case 'NEAR': address = nearAddress; break;
            }
            
            return {
                id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}`,
                name: token.name,
                symbol: token.symbol,
                address: address,
                blockchain: token.blockchain,
                decimals: token.decimals,
                isNative: token.isNative,
                contractAddress: token.contractAddress || '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: token.logo,
                lastUpdated: new Date().toISOString()
            };
        });
        
        return wallets;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Функции генерации адресов
const generateTonAddress = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

const generateSolanaAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return 'So11111111111111111111111111111111111111112';
    }
};

const generateEthereumAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

const generateBSCAddress = generateEthereumAddress;

const generateTronAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        const tronWeb = new TronWeb({ 
            fullHost: MAINNET_CONFIG.TRON.RPC_URL, 
            privateKey: privateKey,
            headers: { "TRON-PRO-API-KEY": MAINNET_CONFIG.TRON.API_KEY }
        });
        return tronWeb.address.fromPrivateKey(privateKey);
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    }
};

const generateBitcoinAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, bitcoin.networks.bitcoin);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: bitcoin.networks.bitcoin 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateNearAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = wallet.privateKey.slice(2);
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        return `near_${hash.substring(0, 10)}.near`;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return 'near.near';
    }
};

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===
export const getAllTokens = async (userData) => {
    try {
        if (userData?.wallets && Array.isArray(userData.wallets)) {
            return userData.wallets;
        }
        
        if (userData?.seed_phrases) {
            const wallets = await generateWalletsFromSeed(userData.seed_phrases);
            return wallets;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

export const getRealBalances = async (wallets) => {
    if (!Array.isArray(wallets)) return wallets;
    
    try {
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    let balance = '0';
                    
                    switch(wallet.blockchain) {
                        case 'TON':
                            balance = wallet.isNative ? 
                                await getTonBalance(wallet.address) : 
                                await getJettonBalance(wallet.address, wallet.contractAddress);
                            break;
                        case 'Ethereum':
                            balance = wallet.isNative ?
                                await getEthBalance(wallet.address) :
                                await getERC20Balance(wallet.address, wallet.contractAddress);
                            break;
                        case 'Solana':
                            balance = wallet.isNative ?
                                await getSolBalance(wallet.address) :
                                await getSPLBalance(wallet.address, wallet.contractAddress);
                            break;
                        case 'Tron':
                            balance = wallet.isNative ?
                                await getTronBalance(wallet.address) :
                                await getTRC20Balance(wallet.address, wallet.contractAddress);
                            break;
                        case 'Bitcoin':
                            balance = await getBitcoinBalance(wallet.address);
                            break;
                        case 'NEAR':
                            balance = wallet.isNative ?
                                await getNearBalance(wallet.address) :
                                await getNEP141Balance(wallet.address, wallet.contractAddress);
                            break;
                        case 'BSC':
                            balance = wallet.isNative ?
                                await getBNBBalance(wallet.address) :
                                await getBEP20Balance(wallet.address, wallet.contractAddress);
                            break;
                    }
                    
                    return {
                        ...wallet,
                        balance: balance || '0',
                        lastUpdated: new Date().toISOString(),
                        isRealBalance: true
                    };
                } catch (error) {
                    console.error(`Error getting balance for ${wallet.symbol}:`, error);
                    return { ...wallet, balance: wallet.balance || '0' };
                }
            })
        );
        
        return updatedWallets;
    } catch (error) {
        console.error('Error in getRealBalances:', error);
        return wallets;
    }
};

const getTonBalance = async (address) => {
    try {
        const response = await fetch(MAINNET_CONFIG.TON.RPC_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': MAINNET_CONFIG.TON.API_KEY 
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getAddressInformation",
                params: { address }
            })
        });
        
        const data = await response.json();
        if (data.result?.balance) {
            return (data.result.balance / 1e9).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

const getJettonBalance = async (address, jettonAddress) => {
    try {
        const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons`);
        const data = await response.json();
        
        if (data.balances) {
            const jetton = data.balances.find(j => 
                j.jetton.address === jettonAddress.replace(':', '')
            );
            if (jetton) {
                return (jetton.balance / Math.pow(10, jetton.jetton.decimals)).toFixed(6);
            }
        }
        return '0';
    } catch (error) {
        console.error('Jetton balance error:', error);
        return '0';
    }
};

const getNearBalance = async (accountId) => {
    try {
        const response = await fetch(MAINNET_CONFIG.NEAR.RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        if (data.result?.amount) {
            return (data.result.amount / 1e24).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('NEAR balance error:', error);
        return '0';
    }
};

const getNEP141Balance = async (accountId, contractAddress) => {
    try {
        const response = await fetch(MAINNET_CONFIG.NEAR.RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        if (data.result?.result) {
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

const getEthBalance = async (address) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        return '0';
    }
};

const getERC20Balance = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.ETHEREUM.RPC_URL);
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('ERC20 balance error:', error);
        return '0';
    }
};

const getSolBalance = async (address) => {
    try {
        const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1e9).toFixed(6);
    } catch (error) {
        console.error('SOL balance error:', error);
        return '0';
    }
};

const getSPLBalance = async (address, tokenAddress) => {
    try {
        const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
        const walletPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const associatedTokenAddress = await getAssociatedTokenAddress(tokenPublicKey, walletPublicKey);
        
        try {
            const balance = await connection.getTokenAccountBalance(associatedTokenAddress);
            return balance.value.uiAmount?.toFixed(6) || '0';
        } catch {
            return '0';
        }
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

const getTronBalance = async (address) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`, {
            headers: { "TRON-PRO-API-KEY": MAINNET_CONFIG.TRON.API_KEY }
        });
        const data = await response.json();
        if (data.data?.[0]?.balance) {
            return (data.data[0].balance / 1e6).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRX balance error:', error);
        return '0';
    }
};

const getTRC20Balance = async (address, contractAddress) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`, {
            headers: { "TRON-PRO-API-KEY": MAINNET_CONFIG.TRON.API_KEY }
        });
        const data = await response.json();
        if (data.data?.[0]) {
            return (data.data[0].balance / Math.pow(10, data.data[0].tokenDecimal)).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

const getBitcoinBalance = async (address) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/address/${address}`);
        const data = await response.json();
        if (data.chain_stats) {
            const balance = (data.chain_stats.funded_txo_sum - (data.chain_stats.spent_txo_sum || 0)) / 1e8;
            return balance.toFixed(8);
        }
        return '0';
    } catch (error) {
        console.error('BTC balance error:', error);
        return '0';
    }
};

const getBNBBalance = async (address) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.BSC.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BNB balance error:', error);
        return '0';
    }
};

const getBEP20Balance = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_CONFIG.BSC.RPC_URL);
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('BEP20 balance error:', error);
        return '0';
    }
};

// === ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЕМ ===
export const initializeUserWallets = async (userData) => {
    try {
        if (!userData?.telegram_user_id) {
            throw new Error("Invalid user data");
        }

        let seedPhrase = userData.seed_phrases;
        
        if (!seedPhrase) {
            seedPhrase = generateNewSeedPhrase();
            
            const saveResult = await saveSeedPhraseToAPI(userData.telegram_user_id, seedPhrase);
            if (!saveResult.success) {
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

        const saveAddressesResult = await saveAddressesToAPI(userData.telegram_user_id, addresses);
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: addresses,
            wallets: wallets
        };

        return updatedUserData;

    } catch (error) {
        console.error("Error initializing user wallets:", error);
        return { ...userData, wallets: [] };
    }
};

// === API ФУНКЦИИ (Netlify) ===
export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId, seed_phrase: seedPhrase })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error saving seed phrase:", error);
        return { success: false, error: error.message };
    }
};

export const saveAddressesToAPI = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId, wallet_addresses: addresses })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error saving addresses:", error);
        return { success: false, error: error.message };
    }
};

export const getUserWallets = async (telegramUserId) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/get-wallets?telegram_user_id=${telegramUserId}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        if (data.wallets) {
            return data.wallets;
        }

        return [];
    } catch (error) {
        console.error("Error getting user wallets:", error);
        return [];
    }
};

// === УТИЛИТНЫЕ ФУНКЦИИ ===
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum,binancecoin,tron,bitcoin,near-protocol,tether,usd-coin&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data.solana?.usd || 172.34,
                'ETH': data.ethereum?.usd || 3500.00,
                'BNB': data.binancecoin?.usd || 600.00,
                'USDT': data.tether?.usd || 1.00,
                'USDC': data['usd-coin']?.usd || 1.00,
                'TRX': data.tron?.usd || 0.12,
                'BTC': data.bitcoin?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50
            };
        }
        
        return {
            'TON': 6.24, 'SOL': 172.34, 'ETH': 3500.00, 'BNB': 600.00,
            'USDT': 1.00, 'USDC': 1.00, 'TRX': 0.12, 'BTC': 68000.00, 'NEAR': 8.50
        };
    } catch (error) {
        console.error('Error getting token prices:', error);
        return {
            'TON': 6.24, 'SOL': 172.34, 'ETH': 3500.00, 'BNB': 600.00,
            'USDT': 1.00, 'USDC': 1.00, 'TRX': 0.12, 'BTC': 68000.00, 'NEAR': 8.50
        };
    }
};

export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) return '0.00';
        
        const updatedWallets = await getRealBalances(wallets);
        const prices = await getTokenPrices();
        
        let totalUSD = 0;
        for (const wallet of updatedWallets) {
            const price = prices[wallet.symbol] || 0;
            totalUSD += parseFloat(wallet.balance || 0) * price;
        }
        
        return totalUSD.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

export const validateAddress = async (blockchain, address) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonRegex = /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/;
                return tonRegex.test(address);
            case 'Ethereum':
            case 'BSC':
                return ethers.isAddress(address);
            case 'Solana':
                try {
                    new PublicKey(address);
                    return true;
                } catch { return false; }
            case 'Tron':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                try {
                    bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
                    return true;
                } catch { return false; }
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

export const clearAllData = () => {
    try {
        localStorage.removeItem('cached_wallets');
        localStorage.removeItem('cached_total_balance');
        console.log('Cached wallet data cleared from localStorage');
        return true;
    } catch (error) {
        console.error('Error clearing cached data:', error);
        return false;
    }
};

export const setupAppCloseListener = () => {
    window.addEventListener('beforeunload', () => {
        console.log('App closing, clearing cached data');
        clearAllData();
    });

    if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        webApp.onEvent('viewportChanged', (event) => {
            if (event.isStateStable && !webApp.isExpanded) {
                clearAllData();
            }
        });
    }
};

export const revealSeedPhrase = async (userData) => {
    if (userData?.seed_phrases) return userData.seed_phrases;
    return null;
};

export const getBalances = getRealBalances;

// Функции для совместимости
export const sendTransaction = async (transactionData) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress } = transactionData;
    
    try {
        const { sendTransaction: sendTx } = await import('./blockchainService');
        
        // Подготавливаем параметры для отправки
        const txParams = {
            blockchain,
            toAddress,
            amount,
            seedPhrase,
            memo,
            contractAddress
        };
        
        return await sendTx(txParams);
    } catch (error) {
        console.error('Transaction error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const estimateTransactionFee = async (blockchain) => {
    const defaultFees = {
        'TON': '0.05',
        'Ethereum': '0.001',
        'BSC': '0.0001',
        'Solana': '0.000005',
        'Tron': '0.1',
        'Bitcoin': '0.0001',
        'NEAR': '0.01'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export default {
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    getAllTokens,
    getRealBalances,
    initializeUserWallets,
    clearAllData,
    setupAppCloseListener,
    getTokenPrices,
    calculateTotalBalance,
    validateAddress,
    revealSeedPhrase,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    getUserWallets,
    sendTransaction,
    estimateTransactionFee,
    TOKENS
};