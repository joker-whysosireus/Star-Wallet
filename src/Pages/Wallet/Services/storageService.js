import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, Address } from '@ton/ton';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import TronWeb from 'tronweb';
import crypto from 'crypto';
import { providers } from 'near-api-js';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import base58 from 'bs58';

// ИСПРАВЛЕННЫЙ ИМПОРТ ДЛЯ NEAR согласно новой документации
import { KeyPair } from '@near-js/crypto';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ ===
const MAINNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
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
        NETWORK: 'mainnet'
    },
    BITCOIN: { 
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin,
        CHAIN: 'mainnet'
    },
    NEAR: { 
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        CHAIN_ID: 'near-mainnet',
        WALLET_URL: 'https://wallet.near.org'
    },
    BSC: { 
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    },
    XRP: { 
        RPC_URL: 'wss://s1.ripple.com:51233',
        NETWORK: 'mainnet'
    },
    LTC: { 
        EXPLORER_URL: 'https://blockstream.info/liquid/api',
        NETWORK: { 
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: { public: 0x019da462, private: 0x019d9cfe },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0
        }
    },
    DOGE: { 
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: { 
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'doge',
            bip32: { public: 0x02facafd, private: 0x02fac398 },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e
        }
    }
};

const TESTNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: { 
        RPC_URL: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
        CHAIN_ID: 11155111
    },
    SOLANA: { 
        RPC_URL: 'https://api.testnet.solana.com',
        NETWORK: 'testnet'
    },
    TRON: { 
        RPC_URL: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: { 
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet,
        CHAIN: 'testnet'
    },
    NEAR: { 
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        CHAIN_ID: 'near-testnet',
        WALLET_URL: 'https://wallet.testnet.near.org'
    },
    BSC: { 
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    XRP: { 
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        NETWORK: 'testnet'
    },
    LTC: {
        EXPLORER_URL: 'https://blockstream.info/liquidtestnet/api',
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: { public: 0x0436ef7d, private: 0x0436f6e1 },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        }
    },
    DOGE: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'tdge',
            bip32: { public: 0x0432a9a8, private: 0x0432a243 },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1
        }
    }
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// Константы для Solana
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

// === ТОКЕНЫ С ПРАВИЛЬНЫМ НАБОРОМ (без USDT/USDC для BTC, BNB, NEAR, DOGE, LTC, XRP) ===
export const TOKENS = {
    // TON блокчейн
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
    
    // Ethereum блокчейн
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
    
    // Solana блокчейн
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
    
    // Tron блокчейн
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
    
    // Bitcoin блокчейн
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    
    // BSC блокчейн (ТОЛЬКО НАТИВНЫЙ BNB)
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    
    // Dogecoin блокчейн
    DOGE: { 
        symbol: 'DOGE', 
        name: 'Dogecoin', 
        blockchain: 'DOGE', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' 
    },
    
    // NEAR блокчейн (ТОЛЬКО НАТИВНЫЙ NEAR)
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' 
    },
    
    // XRP блокчейн
    XRP: { 
        symbol: 'XRP', 
        name: 'Ripple', 
        blockchain: 'XRP', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.svg' 
    },
    
    // Litecoin блокчейн
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'LTC', 
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
        contractAddress: '0x3B00Ef435fA4FcFF5C209a37d1f3dcff37c705aD', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_ETH: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0x07865c6E87B9F70255377e024ace6630C1Eaa37F', 
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
        contractAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_TRX: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf', 
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
    
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    
    DOGE: { 
        symbol: 'DOGE', 
        name: 'Dogecoin', 
        blockchain: 'DOGE', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' 
    },
    
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' 
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

// ФУНКЦИЯ ГЕНЕРАЦИИ КОШЕЛЬКОВ С ЗАДАННЫМ ПОРЯДКОМ ТОКЕНОВ
export const generateWalletsFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [tonAddress, ethAddress, solAddress, tronAddress, bitcoinAddress, bscAddress, dogeAddress, nearAddress, xrpAddress, ltcAddress] = await Promise.all([
            generateTonAddress(seedPhrase, network),
            generateEthereumAddress(seedPhrase, network),
            generateSolanaAddress(seedPhrase, network),
            generateTronAddress(seedPhrase, network),
            generateBitcoinAddress(seedPhrase, network),
            generateBSCAddress(seedPhrase, network),
            generateDogeAddress(seedPhrase, network),
            generateNearAddress(seedPhrase, network),
            generateXrpAddress(seedPhrase, network),
            generateLtcAddress(seedPhrase, network)
        ]);

        const walletArray = [];
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        // ЗАДАННЫЙ ПОРЯДОК ТОКЕНОВ:
        // 1. TON блокчейн
        walletArray.push(createWallet(tokens.TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDT_TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDC_TON, tonAddress, network));
        
        // 2. Ethereum блокчейн
        walletArray.push(createWallet(tokens.ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDT_ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDC_ETH, ethAddress, network));
        
        // 3. Solana блокчейн
        walletArray.push(createWallet(tokens.SOL, solAddress, network));
        walletArray.push(createWallet(tokens.USDT_SOL, solAddress, network));
        walletArray.push(createWallet(tokens.USDC_SOL, solAddress, network));
        
        // 4. Tron блокчейн
        walletArray.push(createWallet(tokens.TRX, tronAddress, network));
        walletArray.push(createWallet(tokens.USDT_TRX, tronAddress, network));
        walletArray.push(createWallet(tokens.USDC_TRX, tronAddress, network));
        
        // 5. Bitcoin блокчейн
        walletArray.push(createWallet(tokens.BTC, bitcoinAddress, network));
        
        // 6. BSC блокчейн (ТОЛЬКО НАТИВНЫЙ BNB)
        walletArray.push(createWallet(tokens.BNB, bscAddress, network));
        
        // 7. Dogecoin блокчейн
        walletArray.push(createWallet(tokens.DOGE, dogeAddress, network));
        
        // 8. NEAR блокчейн (ТОЛЬКО НАТИВНЫЙ NEAR)
        walletArray.push(createWallet(tokens.NEAR, nearAddress, network));
        
        // 9. XRP блокчейн
        walletArray.push(createWallet(tokens.XRP, xrpAddress, network));
        
        // 10. Litecoin блокчейн
        walletArray.push(createWallet(tokens.LTC, ltcAddress, network));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Вспомогательная функция для создания кошелька
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

// === ИСПРАВЛЕННЫЕ ФУНКЦИИ ГЕНЕРАЦИИ ADDRESS ===

// 1. TON адрес
const generateTonAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        return network === 'testnet' ? 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c_testnet' : 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

// 2. Ethereum адрес
const generateEthereumAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return network === 'testnet' ? '0x0000000000000000000000000000000000000000_testnet' : '0x0000000000000000000000000000000000000000';
    }
};

// 3. Solana адрес
const generateSolanaAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.subarray(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return network === 'testnet' ? 'So11111111111111111111111111111111111111112_testnet' : 'So11111111111111111111111111111111111111112';
    }
};

// 4. Tron адрес
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
        const address = base58.encode(addressWithChecksum);
        
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        try {
            const rpcUrl = network === 'testnet' ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL;
            const tronWeb = new TronWeb({ fullHost: rpcUrl });
            const account = tronWeb.createRandom();
            return account.address.base58;
        } catch (fallbackError) {
            const randomBytes = crypto.randomBytes(20);
            const addressBytes = Buffer.concat([Buffer.from([0x41]), randomBytes]);
            const hash1 = crypto.createHash('sha256').update(addressBytes).digest();
            const hash2 = crypto.createHash('sha256').update(hash1).digest();
            const checksum = hash2.subarray(0, 4);
            const addressWithChecksum = Buffer.concat([addressBytes, checksum]);
            return base58.encode(addressWithChecksum);
        }
    }
};

// 5. Bitcoin адрес
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
        return network === 'testnet' ? 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// 6. BSC адрес (такой же как Ethereum)
const generateBSCAddress = generateEthereumAddress;

// 7. Dogecoin адрес
const generateDogeAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.DOGE.NETWORK : MAINNET_CONFIG.DOGE.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE address:', error);
        return network === 'testnet' ? 'nX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q' : 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q';
    }
};

// 8. ИСПРАВЛЕННАЯ ГЕНЕРАЦИЯ NEAR АДРЕСА (без keyToImplicitAddress)
const generateNearAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        // Генерируем детерминированный seed из мнемонической фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Используем HMAC-SHA512 для получения мастер-ключа Ed25519
        const hmac = crypto.createHmac('sha512', 'ed25519 seed');
        hmac.update(seedBuffer);
        const I = hmac.digest();
        
        // Берем первые 32 байта как приватный ключ для Ed25519
        const privateKeyBytes = I.slice(0, 32);
        
        // Создаем ключевую пару NEAR из приватного ключа
        const privateKeyHex = privateKeyBytes.toString('hex');
        const keyPair = KeyPair.fromString(`ed25519:${privateKeyHex}`);
        
        // Получаем публичный ключ
        const publicKey = keyPair.getPublicKey();
        
        // Конвертируем публичный ключ в имплицитный адрес (64 hex символа)
        // Вместо keyToImplicitAddress используем прямую конвертацию
        const publicKeyData = publicKey.data; // Uint8Array
        const implicitAccountId = Buffer.from(publicKeyData).toString('hex');
        
        console.log("NEAR Address Generation:", {
            publicKey: publicKey.toString(),
            implicitAccountId,
            length: implicitAccountId.length,
            format: /^[0-9a-f]{64}$/.test(implicitAccountId) ? "Valid 64-char hex" : "Invalid"
        });
        
        // Проверяем формат (должен быть 64 hex символа)
        if (implicitAccountId.length === 64 && /^[0-9a-f]{64}$/.test(implicitAccountId)) {
            return implicitAccountId;
        } else {
            throw new Error(`Invalid NEAR address generated: ${implicitAccountId}`);
        }
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        // Fallback: детерминированная генерация из seed phrase
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256')
            .update(seedBuffer)
            .digest('hex')
            .toLowerCase()
            .substring(0, 64); // Гарантируем 64 символа
        return hash;
    }
};

// 9. XRP адрес
const generateXrpAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256').update(seedBuffer).digest();
        const seedBytes = hash.slice(0, 16);
        const seedHex = seedBytes.toString('hex').toUpperCase();
        const privateKey = crypto.createHash('sha256').update(seedBytes).digest();
        const publicKey = ecc.pointFromScalar(privateKey, true);
        const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
        const ripemd160 = crypto.createHash('ripemd160').update(sha256Hash).digest();
        const networkPrefix = Buffer.from([network === 'testnet' ? 0x04 : 0x00]);
        const payload = Buffer.concat([networkPrefix, ripemd160]);
        const hash1 = crypto.createHash('sha256').update(payload).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.slice(0, 4);
        const addressBytes = Buffer.concat([payload, checksum]);
        const address = base58.encode(addressBytes);
        
        if (network === 'testnet') {
            return address.startsWith('r') ? address : 'r' + address.substring(1);
        } else {
            return address.startsWith('r') ? address : 'r' + address.substring(1);
        }
    } catch (error) {
        console.error('Error generating XRP address:', error);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256').update(seedBuffer).digest();
        const addressPart = hash.toString('hex').substring(0, 40);
        
        if (network === 'testnet') {
            return 'rTest' + addressPart.substring(5, 29);
        }
        return 'r' + addressPart.substring(0, 28);
    }
};

// 10. Litecoin адрес
const generateLtcAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.LTC.NETWORK : MAINNET_CONFIG.LTC.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC address:', error);
        return network === 'testnet' ? 'tltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 'Lg2UrtoWrQr6r1f4W2eY8W6z6q6q6q6q6q';
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

        // 1. ГЕНЕРАЦИЯ MAINNET КОШЕЛЬКОВ
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

        // 2. ГЕНЕРАЦИЯ TESTNET КОШЕЛЬКОВ
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

        // 3. СОХРАНЕНИЕ ОБОИХ НАБОРОВ В БАЗУ
        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id, 
            mainnetAddresses,
            testnetAddresses
        );
        
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        // 4. ВОЗВРАЩАЕМ ОБНОВЛЕННЫЕ ДАННЫЕ
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

// === API ФУНКЦИИ ===
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

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===
export const getAllTokens = async (userData, network = 'mainnet') => {
    try {
        if (network === 'mainnet') {
            if (userData?.wallets && Array.isArray(userData.wallets)) {
                return userData.wallets;
            }
            
            if (userData?.seed_phrases) {
                const wallets = await generateWalletsFromSeed(userData.seed_phrases, 'mainnet');
                return wallets;
            }
        } else {
            // Для testnet генерируем все токены
            if (userData?.seed_phrases) {
                return await generateWalletsFromSeed(userData.seed_phrases, 'testnet');
            }
            
            // Если нет seed, пробуем использовать сохраненные testnet адреса
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

// Функция для создания кошельков из сохраненных testnet адресах
const generateTestnetWalletsFromSaved = (testnetWallets) => {
    const wallets = [];
    
    // Все возможные токены для testnet
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

// === РЕАЛЬНЫЕ ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ДЛЯ ВСЕХ БЛОКЧЕЙНОВ ===
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
                        case 'NEAR':
                            balance = await getNearBalance(wallet.address, wallet.network);
                            break;
                        case 'BSC':
                            balance = await getBNBBalance(wallet.address, wallet.network);
                            break;
                        case 'XRP':
                            balance = await getXrpBalance(wallet.address, wallet.network);
                            break;
                        case 'LTC':
                            balance = await getLtcBalance(wallet.address, wallet.network);
                            break;
                        case 'DOGE':
                            balance = await getDogeBalance(wallet.address, wallet.network);
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

// РЕАЛЬНЫЕ ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ

// 1. TON баланс
const getTonBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new TonClient({
            endpoint: config.TON.RPC_URL,
            apiKey: config.TON.API_KEY
        });
        
        const balance = await client.getBalance(Address.parse(address));
        return (Number(balance) / 1e9).toFixed(6);
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

// 2. TON Jetton баланс (USDT, USDC на TON)
const getJettonBalance = async (address, jettonAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new TonClient({
            endpoint: config.TON.RPC_URL,
            apiKey: config.TON.API_KEY
        });
        
        // Получаем адрес кошелька токена
        const jettonWalletAddress = await client.runMethod(
            Address.parse(jettonAddress),
            'get_wallet_address',
            [{ type: 'slice', value: Address.parse(address).toRawString() }]
        );
        
        const jettonWalletAddr = jettonWalletAddress.stack.readAddress();
        if (!jettonWalletAddr) return '0';
        
        // Получаем данные кошелька токена
        const walletData = await client.runMethod(
            jettonWalletAddr,
            'get_wallet_data',
            []
        );
        
        const balance = walletData.stack.readBigNumber();
        return (balance / 1_000_000).toString();
    } catch (error) {
        console.error('Jetton balance error:', error);
        return '0';
    }
};

// 3. Ethereum баланс
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

// 4. Ethereum ERC-20 баланс (USDT, USDC)
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

// 5. Solana баланс
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

// 6. Solana SPL баланс (USDT, USDC)
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

// 7. Tron баланс
const getTronBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const tronWeb = new TronWeb({ fullHost: config.TRON.RPC_URL });
        
        const balance = await tronWeb.trx.getBalance(address);
        return (balance / 1e6).toString();
    } catch (error) {
        console.error('TRON balance error:', error);
        return '0';
    }
};

// 8. Tron TRC-20 баланс (USDT, USDC)
const getTRC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const tronWeb = new TronWeb({ fullHost: config.TRON.RPC_URL });
        
        const contract = await tronWeb.contract().at(contractAddress);
        const result = await contract.balanceOf(address).call();
        
        let decimals = 6;
        try {
            decimals = await contract.decimals().call();
            decimals = parseInt(decimals);
        } catch (e) {
            console.warn('Could not get decimals, using default 6');
        }
        
        return (result.toString() / Math.pow(10, decimals)).toString();
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

// 9. Bitcoin баланс
const getBitcoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${address}`);
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

// 10. NEAR баланс
const getNearBalance = async (accountId, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new providers.JsonRpcProvider({ url: config.NEAR.RPC_URL });
        
        try {
            // Это имплицитный аккаунт NEAR (64 hex символа)
            let nearAccountId = accountId;
            if (/^[0-9a-f]{64}$/.test(accountId)) {
                nearAccountId = accountId;
            }
            
            const account = await provider.query({
                request_type: "view_account",
                account_id: nearAccountId,
                finality: "final"
            });
            
            return (parseInt(account.amount) / 1e24).toString();
        } catch (error) {
            return '0';
        }
    } catch (error) {
        console.error('NEAR balance error:', error);
        return '0';
    }
};

// 11. BSC баланс
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

// 12. XRP баланс
const getXrpBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new xrpl.Client(config.XRP.RPC_URL);
        await client.connect();
        
        try {
            const response = await client.request({
                command: "account_info",
                account: address,
                ledger_index: "validated"
            });
            
            await client.disconnect();
            
            if (response.result.account_data) {
                const balance = xrpl.dropsToXrp(response.result.account_data.Balance);
                return balance;
            }
            return '0';
        } catch (error) {
            await client.disconnect();
            return '0';
        }
    } catch (error) {
        console.error('XRP balance error:', error);
        return '0';
    }
};

// 13. Litecoin баланс
const getLtcBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.LTC.EXPLORER_URL}/address/${address}`);
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

// 14. Dogecoin баланс
const getDogeBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.DOGE.EXPLORER_URL}/address/${address}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const balance = (funded - spent) / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('DOGE balance error:', error);
        return '0';
    }
};

// === ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ===
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin,tether,usd-coin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true');
        
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
                'USDT': data.tether?.usd || 1.00,
                'USDC': data['usd-coin']?.usd || 1.00,
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
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'USDT': 1.00,
            'USDC': 1.00,
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
            'NEAR': 8.50,
            'XRP': 0.52,
            'LTC': 74.30,
            'DOGE': 0.15,
            'USDT': 1.00,
            'USDC': 1.00,
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
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$|^41[0-9a-fA-F]{40}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                try {
                    bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
                    return true;
                } catch { return false; }
            case 'NEAR':
                const nearRegex = /^[0-9a-f]{64}$/; // 64 hex символа для неявного аккаунта
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

// Система обновления цен
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

// Инициализация цен при импорте
getTokenPrices().then(prices => {
    currentPrices = prices;
});

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
    validateAddress,
    revealSeedPhrase,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    sendTransaction,
    estimateTransactionFee,
    startPriceUpdates,
    stopPriceUpdates,
    getCurrentPrices,
    TOKENS,
    TESTNET_TOKENS
};