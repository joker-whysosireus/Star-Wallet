import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, Address } from '@ton/ton';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import base58 from 'bs58';
import * as bitcoin from 'bitcoinjs-lib';

const bip32 = BIP32Factory(ecc);

const MAINNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        API_URL: 'https://tonapi.io/v2',
        API_URL_V1: 'https://tonapi.io/v1',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: { 
        RPC_URL: 'https://eth.llamarpc.com',
        CHAIN_ID: 1
    },
    SOLANA: { 
        RPC_URL: 'https://api.mainnet-beta.solana.com',
        NETWORK: 'mainnet-beta'
    },
    TRON: { 
        RPC_URL: 'https://api.trongrid.io',
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    BITCOIN: { 
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    BSC: { 
        RPC_URL: 'https://bsc-dataseed1.binance.org/',
        CHAIN_ID: 56
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockstream.info/litecoin/api',
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: { public: 0x019da462, private: 0x019d9cfe },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0,
        }
    }
};

const TESTNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_URL: 'https://testnet.tonapi.io/v2',
        API_URL_V1: 'https://testnet.tonapi.io/v1',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: { 
        RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_ID: 11155111
    },
    SOLANA: { 
        RPC_URL: 'https://api.testnet.solana.com',
        NETWORK: 'testnet'
    },
    TRON: { 
        RPC_URL: 'https://api.shasta.trongrid.io',
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: { 
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    BSC: { 
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockstream.info/litecoin/testnet/api',
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: { public: 0x043587cf, private: 0x04358394 },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef,
        }
    }
};

const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    USDT_TON: { 
        symbol: 'USDT', 
        name: 'Tether (TON)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    USDT_ETH: { 
        symbol: 'USDT', 
        name: 'Tether (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    USDT_SOL: { 
        symbol: 'USDT', 
        name: 'Tether (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    USDT_TRX: { 
        symbol: 'USDT', 
        name: 'Tether (TRC20)', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'Litecoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    }
};

export const TESTNET_TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    USDT_TON: { 
        symbol: 'USDT', 
        name: 'Tether (TON)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    USDT_ETH: { 
        symbol: 'USDT', 
        name: 'Tether (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0x3B00Ef435fA4FcFF5C209a37d1f3dcff37c705aD', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    USDT_SOL: { 
        symbol: 'USDT', 
        name: 'Tether (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    USDT_TRX: { 
        symbol: 'USDT', 
        name: 'Tether (TRC20)', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'Litecoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    }
};

export const generateNewSeedPhrase = () => {
    try {
        return bip39.generateMnemonic(128);
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

export const generateWalletsFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [tonAddress, ethAddress, solAddress, tronAddress, bitcoinAddress, bscAddress, litecoinAddress] = await Promise.all([
            generateTonAddress(seedPhrase, network),
            generateEthereumAddress(seedPhrase, network),
            generateSolanaAddress(seedPhrase, network),
            generateTronAddress(seedPhrase, network),
            generateBitcoinAddress(seedPhrase, network),
            generateBSCAddress(seedPhrase, network),
            generateLitecoinAddress(seedPhrase, network)
        ]);

        const walletArray = [];
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        walletArray.push(createWallet(tokens.TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDT_TON, tonAddress, network));
        walletArray.push(createWallet(tokens.ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.SOL, solAddress, network));
        walletArray.push(createWallet(tokens.TRX, tronAddress, network));
        walletArray.push(createWallet(tokens.BTC, bitcoinAddress, network));
        walletArray.push(createWallet(tokens.BNB, bscAddress, network));
        walletArray.push(createWallet(tokens.LTC, litecoinAddress, network));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

const createWallet = (token, address, network = 'mainnet') => ({
    id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}_${network}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    network: network,
    lastUpdated: new Date().toISOString()
});

const generateTonAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        return '';
    }
};

const generateEthereumAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '';
    }
};

const generateSolanaAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.subarray(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return '';
    }
};

const generateTronAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKeyHex = wallet.privateKey.substring(2);
        
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        return base58.encode(addressWithChecksum);
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return '';
    }
};

const generateBitcoinAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.BITCOIN.NETWORK : MAINNET_CONFIG.BITCOIN.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return '';
    }
};

const generateLitecoinAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' 
            ? TESTNET_CONFIG.LITECOIN.NETWORK 
            : MAINNET_CONFIG.LITECOIN.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating Litecoin address:', error);
        return '';
    }
};

const generateBSCAddress = generateEthereumAddress;

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

        const mainnetWallets = await generateWalletsFromSeed(seedPhrase, 'mainnet');
        
        const mainnetAddresses = {};
        mainnetWallets.forEach(wallet => {
            if (!mainnetAddresses[wallet.blockchain]) {
                mainnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'mainnet',
                    tokenType: wallet.isNative ? 'native' : 'token'
                };
            }
        });

        const testnetWallets = await generateWalletsFromSeed(seedPhrase, 'testnet');
        const testnetAddresses = {};
        testnetWallets.forEach(wallet => {
            if (!testnetAddresses[wallet.blockchain]) {
                testnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'testnet',
                    tokenType: wallet.isNative ? 'native' : 'token'
                };
            }
        });

        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id, 
            mainnetAddresses,
            testnetAddresses
        );
        
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: mainnetAddresses,
            testnet_wallets: testnetAddresses,
            wallets: mainnetWallets,
            testnet_wallets_list: testnetWallets
        };

        return updatedUserData;

    } catch (error) {
        console.error("Error initializing user wallets:", error);
        return { ...userData, wallets: [] };
    }
};

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

export const saveAddressesToAPI = async (telegramUserId, wallet_addresses, testnet_wallets = {}) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegram_user_id: telegramUserId, 
                wallet_addresses: wallet_addresses,
                testnet_wallets: testnet_wallets 
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error saving addresses:", error);
        return { success: false, error: error.message };
    }
};

export const getAllTokens = async (userData, network = 'mainnet') => {
    try {
        if (network === 'mainnet') {
            if (userData?.wallets && Array.isArray(userData.wallets)) {
                const filteredWallets = [];
                let usdtFound = false;
                
                for (const wallet of userData.wallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
            
            if (userData?.seed_phrases) {
                const allWallets = await generateWalletsFromSeed(userData.seed_phrases, 'mainnet');
                
                const filteredWallets = [];
                let usdtFound = false;
                
                for (const wallet of allWallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
        } else {
            if (userData?.seed_phrases) {
                const testnetWallets = await generateWalletsFromSeed(userData.seed_phrases, 'testnet');
                
                const filteredWallets = [];
                let usdtFound = false;
                
                for (const wallet of testnetWallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
            
            if (userData?.testnet_wallets && Object.keys(userData.testnet_wallets).length > 0) {
                return generateTestnetWalletsFromSaved(userData.testnet_wallets);
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

const generateTestnetWalletsFromSaved = (testnetWallets) => {
    const wallets = [];
    
    const allTestnetTokens = Object.values(TESTNET_TOKENS);
    
    for (const token of allTestnetTokens) {
        const blockchain = token.blockchain;
        const savedWallet = testnetWallets[blockchain];
        
        if (savedWallet && savedWallet.address) {
            wallets.push(createWallet(
                token,
                savedWallet.address,
                'testnet'
            ));
        }
    }
    
    return wallets;
};

const getTonBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.TON.API_URL}/accounts/${address}`);
        if (!response.ok) {
            throw new Error(`TON API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.balance) {
            const balanceInNano = parseInt(data.balance);
            return (balanceInNano / 1e9).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

const getJettonBalance = async (address, jettonAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        const response = await fetch(`${config.TON.API_URL_V1}/jetton/getBalances?account=${address}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.TON.API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`TON Jetton API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.balances && Array.isArray(data.balances)) {
            const jettonBalance = data.balances.find(
                jetton => jetton.address === jettonAddress
            );
            
            if (jettonBalance && jettonBalance.balance) {
                const balance = jettonBalance.balance;
                return (parseFloat(balance) / 1e6).toFixed(6);
            }
        }
        
        return '0';
    } catch (error) {
        console.error('TON Jetton balance error:', error);
        return '0';
    }
};

const getEthBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        return '0';
    }
};

const getERC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const abi = ['function balanceOf(address) view returns (uint256)'];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        
        let decimals = 6;
        try {
            const decimalsAbi = ['function decimals() view returns (uint8)'];
            const decimalsContract = new ethers.Contract(contractAddress, decimalsAbi, provider);
            decimals = await decimalsContract.decimals();
        } catch (e) {
            console.warn('Could not get decimals, using default 6');
        }
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('ERC20 balance error:', error);
        return '0';
    }
};

const getSolBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
        console.error('SOL balance error:', error);
        return '0';
    }
};

const getSPLBalance = async (address, tokenAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        
        const ownerPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        const associatedTokenAddress = await PublicKey.findProgramAddress(
            [
                ownerPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenPublicKey.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        try {
            const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAddress[0]);
            if (tokenAccount.value) {
                return tokenAccount.value.uiAmountString || '0';
            }
        } catch (e) {
            return '0';
        }
        
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

const getTronBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const baseUrl = config.TRON.RPC_URL;
        
        const response = await fetch(`${baseUrl}/wallet/getaccount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address.startsWith('T') ? address : undefined,
                address_hex: address.startsWith('41') ? address : undefined,
                visible: address.startsWith('T')
            })
        });

        if (!response.ok) return '0';
        
        const data = await response.json();
        
        if (data.balance !== undefined) {
            const balanceTRX = (parseInt(data.balance) / 1_000_000).toFixed(6);
            return balanceTRX;
        }
        return '0';
    } catch (error) {
        console.error('TRON balance error:', error);
        return '0';
    }
};

const getTRC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const baseUrl = config.TRON.RPC_URL;
        
        const response = await fetch(`${baseUrl}/wallet/triggerconstantcontract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_address: address,
                contract_address: contractAddress,
                function_selector: 'balanceOf(address)',
                parameter: address.replace('T', '').padStart(64, '0')
            })
        });

        if (!response.ok) return '0';
        
        const data = await response.json();
        
        if (data.constant_result && data.constant_result.length > 0) {
            const balanceHex = data.constant_result[0];
            const balance = parseInt(balanceHex, 16);
            return (balance / 1_000_000).toString();
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

const getBitcoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${address}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const balance = (funded - spent) / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('BTC balance error:', error);
        return '0';
    }
};

const getLitecoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.LITECOIN.EXPLORER_API}/address/${address}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const balance = (funded - spent) / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('LTC balance error:', error);
        return '0';
    }
};

const getBNBBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BNB balance error:', error);
        return '0';
    }
};

export const getRealBalances = async (wallets) => {
    if (!Array.isArray(wallets)) return wallets;
    
    try {
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    let balance = '0';
                    const config = wallet.network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    
                    switch(wallet.blockchain) {
                        case 'TON':
                            balance = wallet.isNative ?
                                await getTonBalance(wallet.address, wallet.network) :
                                await getJettonBalance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Ethereum':
                            balance = wallet.isNative ?
                                await getEthBalance(wallet.address, wallet.network) :
                                await getERC20Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Solana':
                            balance = wallet.isNative ?
                                await getSolBalance(wallet.address, wallet.network) :
                                await getSPLBalance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Tron':
                            balance = wallet.isNative ?
                                await getTronBalance(wallet.address, wallet.network) :
                                await getTRC20Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Bitcoin':
                            balance = await getBitcoinBalance(wallet.address, wallet.network);
                            break;
                        case 'Litecoin':
                            balance = await getLitecoinBalance(wallet.address, wallet.network);
                            break;
                        case 'BSC':
                            balance = await getBNBBalance(wallet.address, wallet.network);
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

export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,litecoin,tether&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'ETH': data.ethereum?.usd || 3500.00,
                'SOL': data.solana?.usd || 172.34,
                'BNB': data.binancecoin?.usd || 600.00,
                'TRX': data.tron?.usd || 0.12,
                'BTC': data.bitcoin?.usd || 68000.00,
                'LTC': data.litecoin?.usd || 85.00,
                'USDT': data.tether?.usd || 1.00,
                lastUpdated: Date.now()
            };
        }
        
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'LTC': 85.00,
            'USDT': 1.00,
            lastUpdated: Date.now()
        };
    } catch (error) {
        console.error('Error getting token prices:', error);
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'LTC': 85.00,
            'USDT': 1.00,
            lastUpdated: Date.now()
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
            const balance = parseFloat(wallet.balance || 0);
            totalUSD += balance * price;
        }
        
        return totalUSD.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

export const getTotalUSDTBalance = async (userData, network = 'mainnet') => {
    try {
        const usdtTokens = await getUSDTTokensForDetail(userData, network);
        let total = 0;
        usdtTokens.forEach(token => {
            total += parseFloat(token.balance || 0);
        });
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total USDT balance:', error);
        return '0.00';
    }
};

export const validateAddress = async (blockchain, address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
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
                } catch { 
                    return false; 
                }
                
            case 'Tron':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$|^41[0-9a-fA-F]{40}$/;
                if (!tronRegex.test(address)) return false;
                
                try {
                    const response = await fetch(`${config.TRON.RPC_URL}/wallet/validateaddress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        return data.result || data.message === 'SUCCESS';
                    }
                    return true;
                } catch {
                    return true;
                }
                
            case 'Bitcoin':
                try {
                    const networkConfig = network === 'testnet' 
                        ? bitcoin.networks.testnet 
                        : bitcoin.networks.bitcoin;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
                
            case 'Litecoin':
                try {
                    const networkConfig = network === 'testnet' 
                        ? TESTNET_CONFIG.LITECOIN.NETWORK 
                        : MAINNET_CONFIG.LITECOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
                
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

// ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ОТПРАВКИ ТРАНЗАКЦИЙ ==========
export const sendTransaction = async (transactionData) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, network = 'mainnet' } = transactionData;
    
    try {
        // Динамический импорт blockchainService
        const { sendTransaction: sendTx } = await import('./blockchainService');
        
        // Формируем параметры транзакции
        const txParams = {
            blockchain,
            toAddress,
            amount,
            seedPhrase,
            memo,
            network
        };
        
        // Для нативного TRX (TRX) - не передаем contractAddress
        // Для других токенов с контрактами - передаем contractAddress
        if (blockchain === 'Tron' && contractAddress && contractAddress.includes('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')) {
            // Для USDT TRC20 передаем contractAddress
            txParams.contractAddress = contractAddress;
        } else if (contractAddress && blockchain !== 'Tron' && blockchain !== 'Bitcoin' && blockchain !== 'Litecoin') {
            // Для других блокчейнов (кроме BTC, LTC) передаем contractAddress если есть
            txParams.contractAddress = contractAddress;
        }
        
        console.log(`Sending ${blockchain} transaction with params:`, txParams);
        
        const result = await sendTx(txParams);
        
        if (result.success) {
            console.log(`Transaction successful: ${result.hash}`);
            return {
                success: true,
                hash: result.hash,
                message: result.message,
                explorerUrl: result.explorerUrl,
                timestamp: result.timestamp
            };
        } else {
            console.error(`Transaction failed: ${result.error}`);
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        console.error('Transaction error in storageService:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const estimateTransactionFee = async (blockchain, network = 'mainnet') => {
    const defaultFees = {
        'TON': '0.05',
        'Ethereum': '0.001',
        'BSC': '0.0001',
        'Solana': '0.000005',
        'Tron': '0.1',
        'Bitcoin': '0.0001',
        'Litecoin': '0.0001'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export const getTokenPricesFromRPC = async () => {
    try {
        const prices = await getTokenPrices();
        return prices;
    } catch (error) {
        console.error('Error getting token prices from RPC:', error);
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'LTC': 85.00,
            'USDT': 1.00
        };
    }
};

let priceUpdateInterval = null;
let currentPrices = {};

export const startPriceUpdates = (callback, interval = 60000) => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }
    
    getTokenPrices().then(prices => {
        currentPrices = prices;
        if (callback) callback(prices);
    });
    
    priceUpdateInterval = setInterval(async () => {
        try {
            const prices = await getTokenPrices();
            currentPrices = prices;
            if (callback) callback(prices);
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }, interval);
    
    return () => {
        if (priceUpdateInterval) {
            clearInterval(priceUpdateInterval);
            priceUpdateInterval = null;
        }
    };
};

export const stopPriceUpdates = () => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
        priceUpdateInterval = null;
    }
};

export const getCurrentPrices = () => currentPrices;

getTokenPrices().then(prices => {
    currentPrices = prices;
});

export const getUSDTTokensForDetail = async (userData, network = 'mainnet') => {
    try {
        if (!userData?.seed_phrases) return [];
        
        const addresses = await Promise.all([
            generateTonAddress(userData.seed_phrases, network),
            generateEthereumAddress(userData.seed_phrases, network),
            generateSolanaAddress(userData.seed_phrases, network),
            generateTronAddress(userData.seed_phrases, network)
        ]);
        
        const [tonAddress, ethAddress, solAddress, tronAddress] = addresses;
        
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        const usdtTokens = [
            {
                ...tokens.USDT_TON,
                address: tonAddress,
                blockchain: 'TON',
                name: 'Tether (TON)',
                displayName: 'TON USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_ETH,
                address: ethAddress,
                blockchain: 'Ethereum',
                name: 'Tether (ERC20)',
                displayName: 'ERC20 USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_SOL,
                address: solAddress,
                blockchain: 'Solana',
                name: 'Tether (SPL)',
                displayName: 'SPL USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_TRX,
                address: tronAddress,
                blockchain: 'Tron',
                name: 'Tether (TRC20)',
                displayName: 'TRC20 USDT',
                showBlockchain: true,
                showUSDTBadge: true
            }
        ];
        
        const wallets = usdtTokens.map(token => ({
            ...token,
            balance: '0',
            isActive: true,
            network: network,
            id: `usdt_${token.blockchain.toLowerCase()}_${Date.now()}`,
            showBlockchain: true,
            showUSDTBadge: true
        }));
        
        return await getRealBalances(wallets);
    } catch (error) {
        console.error('Error getting USDT tokens for detail:', error);
        return [];
    }
};

export const getBlockchainIcon = (blockchain) => {
    const icons = {
        'TON': 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
        'Ethereum': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        'Solana': 'https://cryptologos.cc/logos/solana-sol-logo.png',
        'Tron': 'https://cryptologos.cc/logos/tron-trx-logo.png',
        'Bitcoin': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        'BSC': 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        'Litecoin': 'https://cryptologos.cc/logos/litecoin-ltc-logo.png'
    };
    
    return icons[blockchain] || '';
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
    getTokenPricesFromRPC,
    calculateTotalBalance,
    getTotalUSDTBalance,
    validateAddress,
    revealSeedPhrase,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    sendTransaction,
    estimateTransactionFee,
    startPriceUpdates,
    stopPriceUpdates,
    getCurrentPrices,
    getUSDTTokensForDetail,
    getBlockchainIcon,
    TOKENS,
    TESTNET_TOKENS
};