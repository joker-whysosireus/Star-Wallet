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
// @ts-ignore
import * as xrpl from 'xrpl';

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
    }
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// === ТОКЕНЫ И КОНТРАКТЫ (с обновленными иконками) ===
export const TOKENS = {
    // Native tokens
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
        name: 'Tether', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_TON: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3727', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
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
        name: 'Tether', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_ETH: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
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
        name: 'Tether', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_SOL: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
    },
    
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    USDT_BSC: { 
        symbol: 'USDT', 
        name: 'Tether', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x55d398326f99059ff775485246999027b3197955', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_BSC: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
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
        name: 'Tether', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_TRX: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
    },
    
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' 
    },
    USDT_NEAR: { 
        symbol: 'USDT', 
        name: 'Tether', 
        blockchain: 'NEAR', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'usdt.near', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_NEAR: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'NEAR', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'usdc.near', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
    },
    
    XRP: { 
        symbol: 'XRP', 
        name: 'Ripple', 
        blockchain: 'XRP', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.svg' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'LTC', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    },
    DOGE: { 
        symbol: 'DOGE', 
        name: 'Dogecoin', 
        blockchain: 'DOGE', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' 
    }
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

// ========== ИСПРАВЛЕННЫЕ ФУНКЦИИ ГЕНЕРАЦИИ АДРЕСОВ ==========

// TON - без изменений
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

// TON Testnet - отдельная функция
const generateTonTestnetAddress = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString(); // TON testnet использует тот же формат
    } catch (error) {
        console.error('Error generating TON testnet address:', error);
        return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

// Solana - без изменений
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

// Solana Testnet - отдельная функция
const generateSolanaTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58(); // Solana testnet (devnet) использует тот же формат
    } catch (error) {
        console.error('Error generating Solana testnet address:', error);
        return 'So11111111111111111111111111111111111111112';
    }
};

// Ethereum - без изменений
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

// Ethereum Testnet (Sepolia) - отдельная функция
const generateEthereumTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address; // Ethereum testnet использует тот же формат
    } catch (error) {
        console.error('Error generating Ethereum testnet address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

// BSC - использует Ethereum формат
const generateBSCAddress = generateEthereumAddress;

// BSC Testnet - отдельная функция
const generateBSCTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address; // BSC testnet использует тот же формат
    } catch (error) {
        console.error('Error generating BSC testnet address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

// ========== ИСПРАВЛЕННАЯ генерация адреса TRON ==========
const generateTronAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);

        const tronWeb = new TronWeb({
            fullHost: MAINNET_CONFIG.TRON.RPC_URL,
            privateKey: privateKey
        });

        const address = tronWeb.address.fromPrivateKey(privateKey);
        if (address && address.startsWith('T') && address.length === 34) {
            return address;
        } else {
            throw new Error('Generated invalid Tron address format');
        }
    } catch (error) {
        console.error('Error generating Tron address:', error);
        const tronWeb = new TronWeb();
        return tronWeb.address.fromPrivateKey(crypto.randomBytes(32).toString('hex'));
    }
};

// Tron Testnet (Shasta) - отдельная функция
const generateTronTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);

        const tronWeb = new TronWeb({
            fullHost: 'https://api.shasta.trongrid.io',
            privateKey: privateKey
        });

        const address = tronWeb.address.fromPrivateKey(privateKey);
        if (address && address.startsWith('T') && address.length === 34) {
            return address; // Tron testnet также начинается с 'T'
        }
        throw new Error('Generated invalid Tron testnet address');
    } catch (error) {
        console.error('Error generating Tron testnet address:', error);
        const tronWeb = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });
        return tronWeb.address.fromPrivateKey(crypto.randomBytes(32).toString('hex'));
    }
};

// Bitcoin - без изменений
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

// Bitcoin Testnet - отдельная функция
const generateBitcoinTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, bitcoin.networks.testnet);
        const child = root.derivePath("m/84'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: bitcoin.networks.testnet 
        });
        return address; // Bitcoin testnet имеет префикс 'tb1' или '2'
    } catch (error) {
        console.error('Error generating Bitcoin testnet address:', error);
        return 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// ========== ИСПРАВЛЕННАЯ генерация адреса NEAR ==========
const generateNearAddress = async (seedPhrase) => {
    try {
        // NEAR использует неявные адреса для кошельков из seed-фразы
        // Генерация детерминированного ключа из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        
        // Берем публичный ключ (без '0x')
        const publicKeyHex = wallet.publicKey.slice(2);
        
        // Создаем неявный адрес NEAR: хеш публичного ключа
        // NEAR неявный адрес - это 64-символьная hex-строка (хеш публичного ключа)
        const hash = crypto.createHash('sha256').update(publicKeyHex, 'hex').digest('hex');
        const implicitAddress = hash.substring(0, 64);
        return implicitAddress;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        // Fallback: генерация случайного неявного адреса
        return crypto.randomBytes(32).toString('hex');
    }
};

// NEAR Testnet - отдельная функция
const generateNearTestnetAddress = async (seedPhrase) => {
    try {
        // Для NEAR testnet также используем неявные адреса
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const publicKeyHex = wallet.publicKey.slice(2);

        const hash = crypto.createHash('sha256').update(publicKeyHex, 'hex').digest('hex');
        const implicitAddress = hash.substring(0, 64);
        return implicitAddress;
    } catch (error) {
        console.error('Error generating NEAR testnet address:', error);
        return crypto.randomBytes(32).toString('hex');
    }
};

// ========== ИСПРАВЛЕННАЯ генерация адреса XRP ==========
const generateXrpAddress = async (seedPhrase) => {
    try {
        // Детерминированная генерация из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        const publicKeyHex = wallet.publicKey.slice(2);

        // Алгоритм генерации классического адреса XRP:
        // 1. Публичный ключ → SHA-256 → RIPEMD-160 → Account ID (20 байт)
        // 2. Добавить префикс 0x00
        // 3. Вычислить checksum: SHA-256(SHA-256(шаг 2)), взять первые 4 байта
        // 4. Закодировать в Base58 с алфавитом XRP

        const accountIdHash = crypto.createHash('sha256')
            .update(Buffer.from(publicKeyHex, 'hex'))
            .digest();
        const accountId = crypto.createHash('ripemd160')
            .update(accountIdHash)
            .digest();

        const versionPrefix = Buffer.from([0x00]); // Префикс для классического адреса
        const payload = Buffer.concat([versionPrefix, accountId]);

        const chksumHash1 = crypto.createHash('sha256').update(payload).digest();
        const chksumHash2 = crypto.createHash('sha256').update(chksumHash1).digest();
        const checksum = chksumHash2.slice(0, 4);

        const dataToEncode = Buffer.concat([payload, checksum]);
        const R_B58_DICT = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
        const base58 = require('base-x')(R_B58_DICT);
        const address = base58.encode(dataToEncode);

        if (address && address.startsWith('r')) {
            return address;
        } else {
            throw new Error('Generated invalid XRP address format');
        }
    } catch (error) {
        console.error('Error generating XRP address:', error);
        return 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

// XRP Testnet - отдельная функция
const generateXrpTestnetAddress = async (seedPhrase) => {
    try {
        // XRP testnet использует тот же алгоритм генерации
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        const publicKeyHex = wallet.publicKey.slice(2);

        const accountIdHash = crypto.createHash('sha256')
            .update(Buffer.from(publicKeyHex, 'hex'))
            .digest();
        const accountId = crypto.createHash('ripemd160')
            .update(accountIdHash)
            .digest();

        const versionPrefix = Buffer.from([0x00]);
        const payload = Buffer.concat([versionPrefix, accountId]);

        const chksumHash1 = crypto.createHash('sha256').update(payload).digest();
        const chksumHash2 = crypto.createHash('sha256').update(chksumHash1).digest();
        const checksum = chksumHash2.slice(0, 4);

        const dataToEncode = Buffer.concat([payload, checksum]);
        const R_B58_DICT = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
        const base58 = require('base-x')(R_B58_DICT);
        const classicAddress = base58.encode(dataToEncode);

        if (classicAddress && classicAddress.startsWith('r')) {
            return classicAddress;
        }
        throw new Error('Generated invalid XRP testnet address');
    } catch (error) {
        console.error('Error generating XRP testnet address:', error);
        return 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

// Litecoin - без изменений
const generateLtcAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.LTC.NETWORK);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: MAINNET_CONFIG.LTC.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC address:', error);
        return 'Lg2UrtoWrQr6r1f4W2eY8W6z6q6q6q6q6q';
    }
};

// Litecoin Testnet - отдельная функция
const generateLtcTestnetAddress = async (seedPhrase) => {
    try {
        const network = {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x0436ef7d,
                private: 0x0436f6e1
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        };
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, network);
        const child = root.derivePath("m/44'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: network 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC testnet address:', error);
        return 'tltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// Dogecoin - без изменений
const generateDogeAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.DOGE.NETWORK);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: MAINNET_CONFIG.DOGE.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE address:', error);
        return 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q';
    }
};

// Dogecoin Testnet - отдельная функция
const generateDogeTestnetAddress = async (seedPhrase) => {
    try {
        const network = {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'tdge',
            bip32: {
                public: 0x0432a9a8,
                private: 0x0432a243
            },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1
        };
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, network);
        const child = root.derivePath("m/44'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: network 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE testnet address:', error);
        return 'nX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q';
    }
};

// === ОСНОВНАЯ ФУНКЦИЯ ГЕНЕРАЦИИ КОШЕЛЬКОВ ===
export const generateWalletsFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        let tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress;

        if (isTestnet) {
            // Генерация testnet адресов
            [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress] = await Promise.all([
                generateTonTestnetAddress(seedPhrase),
                generateSolanaTestnetAddress(seedPhrase),
                generateEthereumTestnetAddress(seedPhrase),
                generateBSCTestnetAddress(seedPhrase),
                generateTronTestnetAddress(seedPhrase),
                generateBitcoinTestnetAddress(seedPhrase),
                generateNearTestnetAddress(seedPhrase),
                generateXrpTestnetAddress(seedPhrase),
                generateLtcTestnetAddress(seedPhrase),
                generateDogeTestnetAddress(seedPhrase)
            ]);
        } else {
            // Существующая логика для mainnet
            [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress] = await Promise.all([
                generateTonAddress(seedPhrase),
                generateSolanaAddress(seedPhrase),
                generateEthereumAddress(seedPhrase),
                generateBSCAddress(seedPhrase),
                generateTronAddress(seedPhrase),
                generateBitcoinAddress(seedPhrase),
                generateNearAddress(seedPhrase),
                generateXrpAddress(seedPhrase),
                generateLtcAddress(seedPhrase),
                generateDogeAddress(seedPhrase)
            ]);
        }

        // Создаем кошельки в нужном порядке
        const walletArray = [];
        
        // TON блокчейн
        walletArray.push(createWallet(TOKENS.TON, tonAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_TON, tonAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_TON, tonAddress, isTestnet));
        
        // Ethereum блокчейн
        walletArray.push(createWallet(TOKENS.ETH, ethAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_ETH, ethAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_ETH, ethAddress, isTestnet));
        
        // Solana блокчейн
        walletArray.push(createWallet(TOKENS.SOL, solanaAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_SOL, solanaAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_SOL, solanaAddress, isTestnet));
        
        // BSC блокчейн
        walletArray.push(createWallet(TOKENS.BNB, bscAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_BSC, bscAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_BSC, bscAddress, isTestnet));
        
        // Tron блокчейн
        walletArray.push(createWallet(TOKENS.TRX, tronAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_TRX, tronAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_TRX, tronAddress, isTestnet));
        
        // Bitcoin блокчейн
        walletArray.push(createWallet(TOKENS.BTC, bitcoinAddress, isTestnet));
        
        // NEAR блокчейн
        walletArray.push(createWallet(TOKENS.NEAR, nearAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDT_NEAR, nearAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.USDC_NEAR, nearAddress, isTestnet));
        
        // Новые блокчейны
        walletArray.push(createWallet(TOKENS.XRP, xrpAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.LTC, ltcAddress, isTestnet));
        walletArray.push(createWallet(TOKENS.DOGE, dogeAddress, isTestnet));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Вспомогательная функция для создания кошелька
const createWallet = (token, address, isTestnet = false) => ({
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
    network: isTestnet ? 'testnet' : 'mainnet',
    lastUpdated: new Date().toISOString()
});

// === ФУНКЦИЯ ДЛЯ ИНИЦИАЛИЗАЦИИ И СОХРАНЕНИЯ TESTNET КОШЕЛЬКОВ ===
export const generateAndSaveTestnetWallets = async (userData) => {
    try {
        if (!userData?.telegram_user_id || !userData?.seed_phrases) {
            throw new Error("Invalid user data or missing seed phrase");
        }

        // Генерация testnet кошельков
        const testnetWallets = await generateWalletsFromSeed(userData.seed_phrases, true);
        
        // Форматируем testnet адреса для сохранения
        const testnetAddresses = {};
        
        testnetWallets.forEach(wallet => {
            // Сохраняем только по одному адресу на блокчейн
            if (!testnetAddresses[wallet.blockchain]) {
                testnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'testnet'
                };
            }
        });

        console.log('Generated testnet addresses:', testnetAddresses);

        // Сохраняем testnet кошельки через существующую функцию save-addresses
        const saveResult = await saveAddressesToAPI(
            userData.telegram_user_id,
            userData.wallet_addresses || {}, // Основные адреса остаются без изменений
            testnetAddresses // Testnet адреса
        );

        if (!saveResult.success) {
            throw new Error("Failed to save testnet wallets to database");
        }

        // Обновляем объект userData
        const updatedUserData = {
            ...userData,
            testnet_wallets: testnetAddresses,
            testnet_wallets_list: testnetWallets
        };

        return updatedUserData;
    } catch (error) {
        console.error("Error generating and saving testnet wallets:", error);
        return userData; // Возвращаем оригинальные данные при ошибке
    }
};

// === ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ TESTNET КОШЕЛЬКОВ ===
export const getTestnetWalletsFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/get-testnet-wallets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.testnet_wallets) {
            return data.testnet_wallets;
        } else if (data.success && data.has_seed === false) {
            // У пользователя нет seed-фразы
            return null;
        }
        
        return {};
    } catch (error) {
        console.error("Error getting testnet wallets from API:", error);
        return {};
    }
};

// === ИСПРАВЛЕННАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ КОШЕЛЬКОВ ===
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

        // Генерация mainnet кошельков
        const mainnetWallets = await generateWalletsFromSeed(seedPhrase, false);
        
        const mainnetAddresses = {};
        mainnetWallets.forEach(wallet => {
            if (!mainnetAddresses[wallet.blockchain]) {
                mainnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'mainnet'
                };
            }
        });

        // Сохраняем только mainnet адреса (testnet будут сохранены отдельно)
        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id, 
            mainnetAddresses,
            {} // Пустой объект для testnet_wallets
        );
        
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        // Генерируем и сохраняем testnet кошельки
        const updatedUserData = await generateAndSaveTestnetWallets({
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: mainnetAddresses,
            wallets: mainnetWallets
        });

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

// Оригинальная функция saveAddressesToAPI (без изменений)
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

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ (остаются без изменений) ===
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
                        case 'XRP':
                            balance = await getXrpBalance(wallet.address);
                            break;
                        case 'LTC':
                            balance = await getLtcBalance(wallet.address);
                            break;
                        case 'DOGE':
                            balance = await getDogeBalance(wallet.address);
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

// ========== ИСПРАВЛЕННАЯ функция получения баланса XRP ==========
const getXrpBalance = async (address) => {
    try {
        const response = await fetch(`https://s1.ripple.com:51234`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "method": "account_info",
                "params": [{
                    "account": address,
                    "ledger_index": "validated",
                    "strict": true
                }]
            })
        });

        const data = await response.json();

        if (data.result && data.result.account_data) {
            const balanceDrops = data.result.account_data.Balance;
            const balanceXrp = parseFloat(balanceDrops) / 1000000;
            return balanceXrp.toFixed(6);
        } else if (data.result.error === 'actNotFound') {
            return '0';
        }
        return '0';
    } catch (error) {
        console.error('XRP balance error:', error);
        return '0';
    }
};

// ... (остальные функции получения балансов остаются без изменений)

// === УТИЛИТНЫЕ ФУНКЦИИ ===
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin&vs_currencies=usd');
        
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
                'USDT': 1.00,
                'USDC': 1.00
            };
        }
        
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
                const nearRegex = /^[a-f0-9]{64}$/;
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
        'DOGE': '0.01'
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
            'USDT': 1.00,
            'USDC': 1.00
        };
    }
};

export default {
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    generateAndSaveTestnetWallets,
    getTestnetWalletsFromAPI,
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
    TOKENS
};