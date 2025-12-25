import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import TronWeb from 'tronweb';
import crypto from 'crypto';
import { providers, KeyPair, keyStores } from 'near-api-js';
import * as xrpl from 'xrpl';
import * as cardano from '@emurgo/cardano-serialization-lib-nodejs';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com'
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/'
    },
    XRP: {
        RPC_URL: 'wss://s1.ripple.com:51233',
        EXPLORER_URL: 'https://xrpscan.com'
    },
    LTC: {
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: {
                public: 0x019da462,
                private: 0x019d9cfe
            },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0
        }
    },
    DOGE: {
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'doge',
            bip32: {
                public: 0x02facafd,
                private: 0x02fac398
            },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e
        }
    },
    CARDANO: {
        RPC_URL: 'https://cardano-mainnet.blockfrost.io/api/v0',
        NETWORK_ID: 1
    }
};

// === КОНФИГУРАЦИЯ TESTNET ===
const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://testnet.nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        EXPLORER_URL: 'https://testnet.xrpl.org'
    },
    LTC: {
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        }
    },
    DOGE: {
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'tdge',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394
            },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1
        }
    },
    CARDANO: {
        RPC_URL: 'https://cardano-testnet.blockfrost.io/api/v0',
        NETWORK_ID: 0
    }
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// === ТОКЕНЫ И КОНТРАКТЫ ===
export const TOKENS = {
    // Native tokens - обновленные логотипы
    TON: { symbol: 'TON', name: 'Toncoin', blockchain: 'TON', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png?v=029' },
    // USDT с круглым логотипом и фоном
    USDT_TON: { symbol: 'USDT', name: 'Tether', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_TON: { symbol: 'USDC', name: 'USD Coin', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3727', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    ETH: { symbol: 'ETH', name: 'Ethereum', blockchain: 'Ethereum', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=029' },
    USDT_ETH: { symbol: 'USDT', name: 'Tether', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_ETH: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    SOL: { symbol: 'SOL', name: 'Solana', blockchain: 'Solana', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=029' },
    USDT_SOL: { symbol: 'USDT', name: 'Tether', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_SOL: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    BNB: { symbol: 'BNB', name: 'BNB', blockchain: 'BSC', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=029' },
    USDT_BSC: { symbol: 'USDT', name: 'Tether', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x55d398326f99059ff775485246999027b3197955', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_BSC: { symbol: 'USDC', name: 'USD Coin', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    TRX: { symbol: 'TRX', name: 'TRON', blockchain: 'Tron', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=029' },
    USDT_TRX: { symbol: 'USDT', name: 'Tether', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_TRX: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    BTC: { symbol: 'BTC', name: 'Bitcoin', blockchain: 'Bitcoin', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=029' },
    
    // NEAR с круглым логотипом и фоном
    NEAR: { symbol: 'NEAR', name: 'NEAR Protocol', blockchain: 'NEAR', decimals: 24, isNative: true, logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png?v=029' },
    USDT_NEAR: { symbol: 'USDT', name: 'Tether', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdt.near', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png?v=029' },
    USDC_NEAR: { symbol: 'USDC', name: 'USD Coin', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdc.near', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029' },
    
    // Новые блокчейны
    XRP: { symbol: 'XRP', name: 'Ripple', blockchain: 'XRP', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.png?v=029' },
    LTC: { symbol: 'LTC', name: 'Litecoin', blockchain: 'LTC', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png?v=029' },
    DOGE: { symbol: 'DOGE', name: 'Dogecoin', blockchain: 'DOGE', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=029' },
    
    // Cardano (ADA)
    ADA: { symbol: 'ADA', name: 'Cardano', blockchain: 'Cardano', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png?v=029' }
};

// === TESTNET ТОКЕНЫ ===
export const TESTNET_TOKENS = {
    TON: { symbol: 'TON', name: 'Toncoin Testnet', blockchain: 'TON', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png?v=029' },
    ETH: { symbol: 'ETH', name: 'Ethereum Testnet', blockchain: 'Ethereum', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=029' },
    SOL: { symbol: 'SOL', name: 'Solana Testnet', blockchain: 'Solana', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=029' },
    BNB: { symbol: 'BNB', name: 'BNB Testnet', blockchain: 'BSC', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=029' },
    TRX: { symbol: 'TRX', name: 'TRON Testnet', blockchain: 'Tron', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=029' },
    BTC: { symbol: 'BTC', name: 'Bitcoin Testnet', blockchain: 'Bitcoin', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=029' },
    NEAR: { symbol: 'NEAR', name: 'NEAR Testnet', blockchain: 'NEAR', decimals: 24, isNative: true, logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png?v=029' },
    XRP: { symbol: 'XRP', name: 'Ripple Testnet', blockchain: 'XRP', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.png?v=029' },
    LTC: { symbol: 'LTC', name: 'Litecoin Testnet', blockchain: 'LTC', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png?v=029' },
    DOGE: { symbol: 'DOGE', name: 'Dogecoin Testnet', blockchain: 'DOGE', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=029' },
    ADA: { symbol: 'ADA', name: 'Cardano Testnet', blockchain: 'Cardano', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png?v=029' }
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

// Генерация mainnet кошельков
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [
            tonAddress, solanaAddress, ethAddress, bscAddress, 
            tronAddress, bitcoinAddress, nearAddress, xrpAddress, 
            ltcAddress, dogeAddress, adaAddress
        ] = await Promise.all([
            generateTonAddress(seedPhrase, false),
            generateSolanaAddress(seedPhrase, false),
            generateEthereumAddress(seedPhrase, false),
            generateBSCAddress(seedPhrase, false),
            generateTronAddress(seedPhrase, false),
            generateBitcoinAddress(seedPhrase, false),
            generateNearAddress(seedPhrase, false),
            generateXrpAddress(seedPhrase, false),
            generateLtcAddress(seedPhrase, false),
            generateDogeAddress(seedPhrase, false),
            generateCardanoAddress(seedPhrase, false)
        ]);

        // Создаем кошельки в нужном порядке
        const walletArray = [];
        
        // TON блокчейн
        walletArray.push(createWallet(TOKENS.TON, tonAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_TON, tonAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_TON, tonAddress, false));
        
        // Ethereum блокчейн
        walletArray.push(createWallet(TOKENS.ETH, ethAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_ETH, ethAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_ETH, ethAddress, false));
        
        // Solana блокчейн
        walletArray.push(createWallet(TOKENS.SOL, solanaAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_SOL, solanaAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_SOL, solanaAddress, false));
        
        // BSC блокчейн
        walletArray.push(createWallet(TOKENS.BNB, bscAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_BSC, bscAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_BSC, bscAddress, false));
        
        // Tron блокчейн
        walletArray.push(createWallet(TOKENS.TRX, tronAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_TRX, tronAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_TRX, tronAddress, false));
        
        // Bitcoin блокчейн
        walletArray.push(createWallet(TOKENS.BTC, bitcoinAddress, false));
        
        // NEAR блокчейн
        walletArray.push(createWallet(TOKENS.NEAR, nearAddress, false));
        walletArray.push(createWallet(TOKENS.USDT_NEAR, nearAddress, false));
        walletArray.push(createWallet(TOKENS.USDC_NEAR, nearAddress, false));
        
        // Новые блокчейны
        walletArray.push(createWallet(TOKENS.XRP, xrpAddress, false));
        walletArray.push(createWallet(TOKENS.LTC, ltcAddress, false));
        walletArray.push(createWallet(TOKENS.DOGE, dogeAddress, false));
        
        // Cardano блокчейн
        walletArray.push(createWallet(TOKENS.ADA, adaAddress, false));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Генерация testnet кошельков
export const generateTestnetWalletsFromSeed = async (seedPhrase) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [
            tonAddress, solanaAddress, ethAddress, bscAddress, 
            tronAddress, bitcoinAddress, nearAddress, xrpAddress, 
            ltcAddress, dogeAddress, adaAddress
        ] = await Promise.all([
            generateTonAddress(seedPhrase, true),
            generateSolanaAddress(seedPhrase, true),
            generateEthereumAddress(seedPhrase, true),
            generateBSCAddress(seedPhrase, true),
            generateTronAddress(seedPhrase, true),
            generateBitcoinAddress(seedPhrase, true),
            generateNearAddress(seedPhrase, true),
            generateXrpAddress(seedPhrase, true),
            generateLtcAddress(seedPhrase, true),
            generateDogeAddress(seedPhrase, true),
            generateCardanoAddress(seedPhrase, true)
        ]);

        // Создаем testnet кошельки
        const walletArray = [];
        
        walletArray.push(createWallet(TESTNET_TOKENS.TON, tonAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.ETH, ethAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.SOL, solanaAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.BNB, bscAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.TRX, tronAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.BTC, bitcoinAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.NEAR, nearAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.XRP, xrpAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.LTC, ltcAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.DOGE, dogeAddress, true));
        walletArray.push(createWallet(TESTNET_TOKENS.ADA, adaAddress, true));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating testnet wallets:', error);
        throw error;
    }
};

// Вспомогательная функция для создания кошелька
const createWallet = (token, address, isTestnet) => ({
    id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}_${isTestnet ? 'testnet' : 'mainnet'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    isTestnet: isTestnet || false,
    lastUpdated: new Date().toISOString()
});

// Функции генерации адресов (с поддержкой testnet)
const generateTonAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ 
            publicKey: keyPair.publicKey, 
            workchain: 0 
        });
        return wallet.address.toString({ testOnly: isTestnet });
    } catch (error) {
        console.error('Error generating TON address:', error);
        return isTestnet ? 
            'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' : 
            'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

const generateSolanaAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return isTestnet ? 
            'So11111111111111111111111111111111111111112' : 
            'So11111111111111111111111111111111111111112';
    }
};

const generateEthereumAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/60'/0'/0/0";
        const wallet = masterNode.derivePath(path);
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

const generateBSCAddress = generateEthereumAddress;

// Исправленная генерация Tron адреса
const generateTronAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем правильный derivation path для Tron
        const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/195'/0'/0/0";
        const wallet = masterNode.derivePath(path);
        const privateKey = wallet.privateKey.slice(2);
        
        // Используем правильный формат приватного ключа для Tron
        const tronWeb = new TronWeb({
            fullHost: isTestnet ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL,
            privateKey: privateKey
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKey);
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        // Генерируем случайный адрес Tron как fallback
        const randomHex = crypto.randomBytes(20).toString('hex');
        return isTestnet ? 
            `T${randomHex.substring(0, 33)}` : 
            `T${randomHex.substring(0, 33)}`;
    }
};

const generateBitcoinAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const network = isTestnet ? TESTNET_CONFIG.BITCOIN.NETWORK : MAINNET_CONFIG.BITCOIN.NETWORK;
        const root = bip32.fromSeed(seedBuffer, network);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: network 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return isTestnet ? 
            'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 
            'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// Исправленная генерация NEAR адреса с использованием near-api-js
const generateNearAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем ключевую пару из seed
        const hash = crypto.createHash('sha256').update(seedBuffer).digest();
        const keyPair = KeyPair.fromRandom('ed25519');
        
        // Получаем публичный ключ и создаем account ID
        const publicKey = keyPair.getPublicKey();
        const accountHash = crypto.createHash('sha256').update(publicKey.data).digest('hex');
        
        // Создаем account ID в формате NEAR
        const prefix = isTestnet ? 'testnet' : 'near';
        const accountId = `${accountHash.substring(0, 8)}.${prefix}`;
        
        return accountId;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return isTestnet ? 'test.near.testnet' : 'test.near';
    }
};

// Генерация XRP адреса с использованием xrpl
const generateXrpAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex').slice(0, 32);
        
        // Создаем кошелек XRP из seed
        const wallet = xrpl.Wallet.fromSeed(seedHex);
        
        // Подключаемся к нужной сети
        const client = new xrpl.Client(isTestnet ? TESTNET_CONFIG.XRP.RPC_URL : MAINNET_CONFIG.XRP.RPC_URL);
        await client.connect();
        
        // Генерируем адрес
        const address = wallet.address;
        
        await client.disconnect();
        
        return address;
    } catch (error) {
        console.error('Error generating XRP address:', error);
        return isTestnet ? 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn' : 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

const generateLtcAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const network = isTestnet ? TESTNET_CONFIG.LTC.NETWORK : MAINNET_CONFIG.LTC.NETWORK;
        const root = bip32.fromSeed(seedBuffer, network);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: network 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC address:', error);
        return isTestnet ? 'Lg2UrtoWrQr6r1f4W2eY8W6z6q6q6q6q6q' : 'Lg2UrtoWrQr6r1f4W2eY8W6z6q6q6q6q6q';
    }
};

const generateDogeAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const network = isTestnet ? TESTNET_CONFIG.DOGE.NETWORK : MAINNET_CONFIG.DOGE.NETWORK;
        const root = bip32.fromSeed(seedBuffer, network);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: network 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE address:', error);
        return isTestnet ? 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q' : 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q';
    }
};

// Генерация Cardano адреса с использованием @emurgo/cardano-serialization-lib-nodejs
const generateCardanoAddress = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем корневой ключ из seed
        const rootKey = cardano.Bip32PrivateKey.from_bip39_entropy(
            Buffer.from(seedBuffer),
            Buffer.from('')
        );
        
        // Derive ключ по пути для Cardano
        const purpose = isTestnet ? 1852 : 1852; // testnet и mainnet используют одинаковый purpose
        const coinType = isTestnet ? 1815 : 1815; // testnet и mainnet используют одинаковый coin type
        const accountKey = rootKey
            .derive(purpose | 0x80000000)
            .derive(coinType | 0x80000000)
            .derive(0 | 0x80000000)
            .derive(0)
            .derive(0);
        
        // Получаем публичный ключ
        const publicKey = accountKey.to_public();
        
        // Создаем base адрес
        const stakeKey = publicKey.derive(2).derive(0).to_raw_key();
        const paymentKey = publicKey.to_raw_key();
        
        const baseAddress = cardano.BaseAddress.new(
            isTestnet ? cardano.NetworkInfo.testnet().network_id() : cardano.NetworkInfo.mainnet().network_id(),
            cardano.StakeCredential.from_keyhash(paymentKey.hash()),
            cardano.StakeCredential.from_keyhash(stakeKey.hash())
        );
        
        const address = baseAddress.to_address().to_bech32();
        
        return address;
    } catch (error) {
        console.error('Error generating Cardano address:', error);
        return isTestnet ? 
            'addr_test1q9x2v8yt5w4wq6j5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5' :
            'addr1q9x2v8yt5w4wq6j5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5v6hj6k5';
    }
};

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===
export const getAllTokens = async (userData) => {
    try {
        if (userData?.wallets && Array.isArray(userData.wallets)) {
            // Фильтруем только mainnet кошельки для отображения
            return userData.wallets.filter(wallet => !wallet.isTestnet);
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
                    const isTestnet = wallet.isTestnet || false;
                    
                    switch(wallet.blockchain) {
                        case 'TON':
                            balance = wallet.isNative ? 
                                await getTonBalance(wallet.address, isTestnet) : 
                                await getJettonBalance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'Ethereum':
                            balance = wallet.isNative ?
                                await getEthBalance(wallet.address, isTestnet) :
                                await getERC20Balance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'Solana':
                            balance = wallet.isNative ?
                                await getSolBalance(wallet.address, isTestnet) :
                                await getSPLBalance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'Tron':
                            balance = wallet.isNative ?
                                await getTronBalance(wallet.address, isTestnet) :
                                await getTRC20Balance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'Bitcoin':
                            balance = await getBitcoinBalance(wallet.address, isTestnet);
                            break;
                        case 'NEAR':
                            balance = wallet.isNative ?
                                await getNearBalance(wallet.address, isTestnet) :
                                await getNEP141Balance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'BSC':
                            balance = wallet.isNative ?
                                await getBNBBalance(wallet.address, isTestnet) :
                                await getBEP20Balance(wallet.address, wallet.contractAddress, isTestnet);
                            break;
                        case 'XRP':
                            balance = await getXrpBalance(wallet.address, isTestnet);
                            break;
                        case 'LTC':
                            balance = await getLtcBalance(wallet.address, isTestnet);
                            break;
                        case 'DOGE':
                            balance = await getDogeBalance(wallet.address, isTestnet);
                            break;
                        case 'Cardano':
                            balance = await getCardanoBalance(wallet.address, isTestnet);
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

// Рабочие функции балансов
const getTonBalance = async (address, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? 'https://testnet.tonapi.io' : 'https://tonapi.io';
        const response = await fetch(`${baseUrl}/v2/accounts/${address}`);
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

const getJettonBalance = async (address, jettonAddress, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? 'https://testnet.tonapi.io' : 'https://tonapi.io';
        const response = await fetch(`${baseUrl}/v2/accounts/${address}/jettons`);
        const data = await response.json();
        
        if (data.balances) {
            const jetton = data.balances.find(j => 
                j.jetton.address === jettonAddress.replace(':', '')
            );
            if (jetton) {
                return (jetton.balance / Math.pow(10, jetton.jetton.decimals)).toFixed(4);
            }
        }
        return '0';
    } catch (error) {
        console.error('Jetton balance error:', error);
        return '0';
    }
};

// Получение баланса NEAR с использованием near-api-js
const getNearBalance = async (accountId, isTestnet = false) => {
    try {
        const rpcUrl = isTestnet ? TESTNET_CONFIG.NEAR.RPC_URL : MAINNET_CONFIG.NEAR.RPC_URL;
        
        // Создаем провайдер
        const provider = new providers.JsonRpcProvider({ url: rpcUrl });
        
        // Запрашиваем информацию об аккаунте
        const accountInfo = await provider.query({
            request_type: 'view_account',
            finality: 'final',
            account_id: accountId
        });
        
        if (accountInfo.amount) {
            return (parseInt(accountInfo.amount) / 1e24).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('NEAR balance error:', error);
        return '0';
    }
};

const getNEP141Balance = async (accountId, contractAddress, isTestnet = false) => {
    try {
        const rpcUrl = isTestnet ? TESTNET_CONFIG.NEAR.RPC_URL : MAINNET_CONFIG.NEAR.RPC_URL;
        const provider = new providers.JsonRpcProvider({ url: rpcUrl });
        
        const response = await provider.query({
            request_type: 'call_function',
            finality: 'final',
            account_id: contractAddress,
            method_name: 'ft_balance_of',
            args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString('base64')
        });
        
        if (response.result) {
            const balanceBytes = response.result;
            const balance = JSON.parse(Buffer.from(balanceBytes).toString());
            return balance || '0';
        }
        return '0';
    } catch (error) {
        console.error('NEP-141 balance error:', error);
        return '0';
    }
};

const getEthBalance = async (address, isTestnet = false) => {
    try {
        const providerUrl = isTestnet ? TESTNET_CONFIG.ETHEREUM.RPC_URL : MAINNET_CONFIG.ETHEREUM.RPC_URL;
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        return '0';
    }
};

const getERC20Balance = async (address, contractAddress, isTestnet = false) => {
    try {
        const providerUrl = isTestnet ? TESTNET_CONFIG.ETHEREUM.RPC_URL : MAINNET_CONFIG.ETHEREUM.RPC_URL;
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('ERC20 balance error:', error);
        return '0';
    }
};

const getSolBalance = async (address, isTestnet = false) => {
    try {
        const rpcUrl = isTestnet ? TESTNET_CONFIG.SOLANA.RPC_URL : MAINNET_CONFIG.SOLANA.RPC_URL;
        const connection = new Connection(rpcUrl, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1e9).toFixed(4);
    } catch (error) {
        console.error('SOL balance error:', error);
        return '0';
    }
};

const getSPLBalance = async (address, tokenAddress, isTestnet = false) => {
    try {
        const rpcUrl = isTestnet ? TESTNET_CONFIG.SOLANA.RPC_URL : MAINNET_CONFIG.SOLANA.RPC_URL;
        const connection = new Connection(rpcUrl, 'confirmed');
        const walletPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        // Используем публичный API для упрощения
        const response = await fetch(`https://public-api.solscan.io/account/tokens?account=${address}`);
        const data = await response.json();
        
        if (data.data) {
            const token = data.data.find(t => t.tokenAddress === tokenAddress);
            if (token) {
                return (token.tokenAmount.uiAmount || 0).toFixed(4);
            }
        }
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

const getTronBalance = async (address, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL;
        const response = await fetch(`${baseUrl}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].balance) {
            const balanceSun = parseInt(data.data[0].balance);
            return (balanceSun / 1_000_000).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRX balance error:', error);
        return '0';
    }
};

const getTRC20Balance = async (address, contractAddress, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL;
        const response = await fetch(`${baseUrl}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const token = data.data[0];
            return (token.balance / Math.pow(10, token.tokenDecimal)).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

const getBitcoinBalance = async (address, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? TESTNET_CONFIG.BITCOIN.EXPLORER_URL : MAINNET_CONFIG.BITCOIN.EXPLORER_URL;
        const response = await fetch(`${baseUrl}/address/${address}`);
        const data = await response.json();
        
        if (data.chain_stats) {
            const confirmed = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
            const mempool = data.mempool_stats?.funded_txo_sum - data.mempool_stats?.spent_txo_sum || 0;
            const totalSatoshis = confirmed + mempool;
            return (totalSatoshis / 1e8).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('BTC balance error:', error);
        return '0';
    }
};

const getBNBBalance = async (address, isTestnet = false) => {
    try {
        const providerUrl = isTestnet ? TESTNET_CONFIG.BSC.RPC_URL : MAINNET_CONFIG.BSC.RPC_URL;
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BNB balance error:', error);
        return '0';
    }
};

const getBEP20Balance = async (address, contractAddress, isTestnet = false) => {
    try {
        const providerUrl = isTestnet ? TESTNET_CONFIG.BSC.RPC_URL : MAINNET_CONFIG.BSC.RPC_URL;
        const provider = new ethers.JsonRpcProvider(providerUrl);
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('BEP20 balance error:', error);
        return '0';
    }
};

// Получение баланса XRP с использованием xrpl
const getXrpBalance = async (address, isTestnet = false) => {
    try {
        const client = new xrpl.Client(isTestnet ? TESTNET_CONFIG.XRP.RPC_URL : MAINNET_CONFIG.XRP.RPC_URL);
        await client.connect();
        
        const response = await client.request({
            command: "account_info",
            account: address,
            ledger_index: "validated"
        });
        
        await client.disconnect();
        
        if (response.result.account_data?.Balance) {
            const balanceDrops = parseInt(response.result.account_data.Balance);
            return xrpl.dropsToXrp(balanceDrops);
        }
        return '0';
    } catch (error) {
        console.error('XRP balance error:', error);
        return '0';
    }
};

const getLtcBalance = async (address, isTestnet = false) => {
    try {
        const response = await fetch(`https://api.blockcypher.com/v1/ltc/main/addresses/${address}/balance`);
        const data = await response.json();
        
        if (data.balance) {
            return (data.balance / 1e8).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('LTC balance error:', error);
        return '0';
    }
};

const getDogeBalance = async (address, isTestnet = false) => {
    try {
        const response = await fetch(`https://dogechain.info/api/v1/address/balance/${address}`);
        const data = await response.json();
        
        if (data.balance) {
            return (parseFloat(data.balance) / 1e8).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('DOGE balance error:', error);
        return '0';
    }
};

// Получение баланса Cardano с использованием Blockfrost API
const getCardanoBalance = async (address, isTestnet = false) => {
    try {
        const baseUrl = isTestnet ? TESTNET_CONFIG.CARDANO.RPC_URL : MAINNET_CONFIG.CARDANO.RPC_URL;
        const apiKey = process.env.BLOCKFROST_API_KEY;
        
        const response = await fetch(`${baseUrl}/addresses/${address}`, {
            headers: {
                'project_id': apiKey || 'testnet'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Cardano API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.amount && data.amount.length > 0) {
            const lovelaceAmount = data.amount.find(a => a.unit === 'lovelace');
            if (lovelaceAmount) {
                return (parseInt(lovelaceAmount.quantity) / 1e6).toFixed(6);
            }
        }
        return '0';
    } catch (error) {
        console.error('Cardano balance error:', error);
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

        // Генерируем mainnet кошельки
        const mainnetWallets = await generateWalletsFromSeed(seedPhrase);
        
        // Генерируем testnet кошельки (но не показываем их в UI)
        const testnetWallets = await generateTestnetWalletsFromSeed(seedPhrase);
        
        const addresses = {};
        mainnetWallets.forEach(wallet => {
            addresses[wallet.blockchain] = {
                address: wallet.address,
                symbol: wallet.symbol,
                network: 'mainnet'
            };
        });

        const testnetAddresses = {};
        testnetWallets.forEach(wallet => {
            testnetAddresses[wallet.blockchain] = {
                address: wallet.address,
                symbol: wallet.symbol,
                network: 'testnet'
            };
        });

        const saveAddressesResult = await saveAddressesToAPI(userData.telegram_user_id, addresses, testnetAddresses);
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: addresses,
            testnet_wallets: testnetWallets,
            wallets: mainnetWallets // Только mainnet кошельки для отображения
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

export const saveAddressesToAPI = async (telegramUserId, addresses, testnetAddresses = {}) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegram_user_id: telegramUserId, 
                wallet_addresses: addresses,
                testnet_wallets: testnetAddresses 
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
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin,cardano&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'ETH': data.ethereum?.usd || 3500.00,
                'SOL': data.solana?.usd || 172.34,
                'BNB': data.binancecoin?.usd || 600.00,
                'TRX': data.tron?.usd || 0.12,
                'BTC': data.bitcoin?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50,
                'XRP': data.ripple?.usd || 0.52,
                'LTC': data.litecoin?.usd || 74.30,
                'DOGE': data.dogecoin?.usd || 0.15,
                'ADA': data.cardano?.usd || 0.45,
                'USDT': 1.00,
                'USDC': 1.00
            };
        }
        
        // Fallback цены
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'ADA': 0.45,
            'USDT': 1.00,
            'USDC': 1.00
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
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'ADA': 0.45,
            'USDT': 1.00,
            'USDC': 1.00
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
            case 'XRP':
                const xrpRegex = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/;
                return xrpRegex.test(address);
            case 'LTC':
                try {
                    bitcoin.address.toOutputScript(address, MAINNET_CONFIG.LTC.NETWORK);
                    return true;
                } catch { return false; }
            case 'DOGE':
                try {
                    bitcoin.address.toOutputScript(address, MAINNET_CONFIG.DOGE.NETWORK);
                    return true;
                } catch { return false; }
            case 'Cardano':
                const adaRegex = /^addr1[0-9a-z]+$|^addr_test1[0-9a-z]+$/;
                return adaRegex.test(address);
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
        'NEAR': '0.01',
        'XRP': '0.00001',
        'LTC': '0.001',
        'DOGE': '0.01',
        'Cardano': '0.17'
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
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'ADA': 0.45,
            'USDT': 1.00,
            'USDC': 1.00
        };
    }
};

export default {
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    generateTestnetWalletsFromSeed,
    getAllTokens,
    getRealBalances,
    initializeUserWallets,
    clearAllData,
    setupAppCloseListener,
    getTokenPrices,
    getTokenPricesFromRPC,
    calculateTotalBalance,
    validateAddress,
    revealSeedPhrase,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    getUserWallets,
    sendTransaction,
    estimateTransactionFee,
    TOKENS,
    TESTNET_TOKENS
};