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

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ ===
const MAINNET_CONFIG = {
    TON: { RPC_URL: 'https://toncenter.com/api/v2/jsonRPC' },
    ETHEREUM: { RPC_URL: 'https://eth.llamarpc.com' },
    SOLANA: { RPC_URL: 'https://api.mainnet-beta.solana.com' },
    TRON: { RPC_URL: 'https://api.trongrid.io' },
    BITCOIN: { EXPLORER_URL: 'https://blockstream.info/api', NETWORK: bitcoin.networks.bitcoin },
    NEAR: { RPC_URL: 'https://rpc.mainnet.near.org', NETWORK_ID: 'mainnet' },
    BSC: { RPC_URL: 'https://bsc-dataseed.binance.org/' },
    XRP: { RPC_URL: 'wss://s1.ripple.com:51233' },
    LTC: { 
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
    TON: { RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC' },
    ETHEREUM: { RPC_URL: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161' },
    SOLANA: { RPC_URL: 'https://api.testnet.solana.com' },
    TRON: { RPC_URL: 'https://api.shasta.trongrid.io' },
    BITCOIN: { EXPLORER_URL: 'https://blockstream.info/testnet/api', NETWORK: bitcoin.networks.testnet },
    NEAR: { RPC_URL: 'https://rpc.testnet.near.org', NETWORK_ID: 'testnet' },
    BSC: { RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/' },
    XRP: { RPC_URL: 'wss://s.altnet.rippletest.net:51233' },
    LTC: {
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

// === ОБНОВЛЕННЫЕ ТОКЕНЫ С ПРАВИЛЬНЫМИ ИКОНКАМИ ===
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

// === ТОКЕНЫ ДЛЯ TESTNET ===
export const TESTNET_TOKENS = {
    // Native tokens for testnet
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
        name: 'Tether (Testnet)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs_testnet', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_TON: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3727_testnet', 
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
        name: 'Tether (Testnet)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0x3B00Ef435fA4FcFF5C209a37d1f3dcff37c705aD', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_ETH: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
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
        name: 'Tether (Testnet)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB_testnet', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_SOL: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_testnet', 
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
        name: 'Tether (Testnet)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_BSC: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x64544969ed7EBf5f083679233325356EbE738930', 
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
        name: 'Tether (Testnet)', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj_testnet', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_TRX: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf_testnet', 
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
        name: 'Tether (Testnet)', 
        blockchain: 'NEAR', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'usdt.testnet', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_NEAR: { 
        symbol: 'USDC', 
        name: 'USD Coin (Testnet)', 
        blockchain: 'NEAR', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'usdc.testnet', 
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

// Функция генерации mainnet кошельков
export const generateWalletsFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress] = await Promise.all([
            generateTonAddress(seedPhrase, network),
            generateSolanaAddress(seedPhrase, network),
            generateEthereumAddress(seedPhrase, network),
            generateBSCAddress(seedPhrase, network),
            generateTronAddress(seedPhrase, network),
            generateBitcoinAddress(seedPhrase, network),
            generateNearAddress(seedPhrase, network),
            generateXrpAddress(seedPhrase, network),
            generateLtcAddress(seedPhrase, network),
            generateDogeAddress(seedPhrase, network)
        ]);

        const walletArray = [];
        
        // TON блокчейн
        walletArray.push(createWallet(TOKENS.TON, tonAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_TON, tonAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_TON, tonAddress, network));
        }
        
        // Ethereum блокчейн
        walletArray.push(createWallet(TOKENS.ETH, ethAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_ETH, ethAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_ETH, ethAddress, network));
        }
        
        // Solana блокчейн
        walletArray.push(createWallet(TOKENS.SOL, solanaAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_SOL, solanaAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_SOL, solanaAddress, network));
        }
        
        // BSC блокчейн
        walletArray.push(createWallet(TOKENS.BNB, bscAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_BSC, bscAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_BSC, bscAddress, network));
        }
        
        // Tron блокчейн
        walletArray.push(createWallet(TOKENS.TRX, tronAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_TRX, tronAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_TRX, tronAddress, network));
        }
        
        // Bitcoin блокчейн
        walletArray.push(createWallet(TOKENS.BTC, bitcoinAddress, network));
        
        // NEAR блокчейн
        walletArray.push(createWallet(TOKENS.NEAR, nearAddress, network));
        if (network === 'mainnet') {
            walletArray.push(createWallet(TOKENS.USDT_NEAR, nearAddress, network));
            walletArray.push(createWallet(TOKENS.USDC_NEAR, nearAddress, network));
        }
        
        // Новые блокчейны
        walletArray.push(createWallet(TOKENS.XRP, xrpAddress, network));
        walletArray.push(createWallet(TOKENS.LTC, ltcAddress, network));
        walletArray.push(createWallet(TOKENS.DOGE, dogeAddress, network));
        
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

// === ФУНКЦИИ ГЕНЕРАЦИИ ADDRESS ===
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

const generateSolanaAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return network === 'testnet' ? 'So11111111111111111111111111111111111111112_testnet' : 'So11111111111111111111111111111111111111112';
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
        return network === 'testnet' ? '0x0000000000000000000000000000000000000000_testnet' : '0x0000000000000000000000000000000000000000';
    }
};

const generateBSCAddress = generateEthereumAddress;

const generateTronAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const rpcUrl = network === 'testnet' ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL;
        const uniqueSeed = seedPhrase + Date.now() + Math.random() + network;
        const hash = crypto.createHash('sha256').update(uniqueSeed).digest('hex');
        const uniquePrivateKey = hash.substring(0, 64);
        
        const tronWeb = new TronWeb({ 
            fullHost: rpcUrl, 
            privateKey: uniquePrivateKey
        });
        
        return tronWeb.address.fromPrivateKey(uniquePrivateKey);
    } catch (error) {
        console.error('Error generating Tron address:', error);
        const randomHex = crypto.randomBytes(20).toString('hex');
        return network === 'testnet' ? `TX${randomHex.substring(0, 33)}` : `T${randomHex.substring(0, 33)}`;
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
        return network === 'testnet' ? 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateNearAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = wallet.privateKey.slice(2);
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        const suffix = network === 'testnet' ? 'testnet' : 'near';
        return `near_${hash.substring(0, 10)}.${suffix}`;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return network === 'testnet' ? 'test.near' : 'near.near';
    }
};

const generateXrpAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        const hash = crypto.createHash('sha256').update(privateKey + network, 'hex').digest('hex');
        return `r${hash.substring(0, 33)}`;
    } catch (error) {
        console.error('Error generating XRP address:', error);
        return 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

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

        // 2. ГЕНЕРАЦИЯ TESTNET КОШЕЛЬКОВ (только нативные токены)
        const testnetWallets = await generateWalletsFromSeed(seedPhrase, 'testnet');
        const testnetAddresses = {};
        testnetWallets.forEach(wallet => {
            if (wallet.isNative && !testnetAddresses[wallet.blockchain]) {
                testnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'testnet',
                    tokenType: 'native'
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
            testnet_wallets_list: testnetWallets.filter(w => w.isNative)
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
                return await generateTestnetWallets(userData.seed_phrases);
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

// Функция генерации testnet кошельков
const generateTestnetWallets = async (seedPhrase) => {
    try {
        // Генерируем адреса для всех блокчейнов
        const addresses = await generateAllTestnetAddresses(seedPhrase);
        const wallets = [];
        
        // Нативные токены для всех блокчейнов
        const nativeTokens = [
            TESTNET_TOKENS.TON,
            TESTNET_TOKENS.ETH,
            TESTNET_TOKENS.SOL,
            TESTNET_TOKENS.BNB,
            TESTNET_TOKENS.TRX,
            TESTNET_TOKENS.BTC,
            TESTNET_TOKENS.NEAR,
            TESTNET_TOKENS.XRP,
            TESTNET_TOKENS.LTC,
            TESTNET_TOKENS.DOGE
        ];
        
        // Добавляем нативные токены
        for (const token of nativeTokens) {
            if (addresses[token.blockchain]) {
                wallets.push(createWallet(
                    token,
                    addresses[token.blockchain],
                    'testnet'
                ));
            }
        }
        
        // Добавляем USDT для всех блокчейнов, которые поддерживают токены
        const usdtTokens = [
            TESTNET_TOKENS.USDT_TON,
            TESTNET_TOKENS.USDT_ETH,
            TESTNET_TOKENS.USDT_SOL,
            TESTNET_TOKENS.USDT_BSC,
            TESTNET_TOKENS.USDT_TRX,
            TESTNET_TOKENS.USDT_NEAR
        ];
        
        for (const token of usdtTokens) {
            if (addresses[token.blockchain]) {
                wallets.push(createWallet(
                    token,
                    addresses[token.blockchain],
                    'testnet'
                ));
            }
        }
        
        // Добавляем USDC для всех блокчейнов, которые поддерживают токены
        const usdcTokens = [
            TESTNET_TOKENS.USDC_TON,
            TESTNET_TOKENS.USDC_ETH,
            TESTNET_TOKENS.USDC_SOL,
            TESTNET_TOKENS.USDC_BSC,
            TESTNET_TOKENS.USDC_TRX,
            TESTNET_TOKENS.USDC_NEAR
        ];
        
        for (const token of usdcTokens) {
            if (addresses[token.blockchain]) {
                wallets.push(createWallet(
                    token,
                    addresses[token.blockchain],
                    'testnet'
                ));
            }
        }
        
        return wallets;
    } catch (error) {
        console.error('Error generating testnet wallets:', error);
        return [];
    }
};

// Генерация всех адресов для testnet
const generateAllTestnetAddresses = async (seedPhrase) => {
    const addresses = {};
    
    const addressGenerators = [
        { key: 'TON', func: () => generateTonAddress(seedPhrase, 'testnet') },
        { key: 'Ethereum', func: () => generateEthereumAddress(seedPhrase, 'testnet') },
        { key: 'Solana', func: () => generateSolanaAddress(seedPhrase, 'testnet') },
        { key: 'BSC', func: () => generateBSCAddress(seedPhrase, 'testnet') },
        { key: 'Tron', func: () => generateTronAddress(seedPhrase, 'testnet') },
        { key: 'Bitcoin', func: () => generateBitcoinAddress(seedPhrase, 'testnet') },
        { key: 'NEAR', func: () => generateNearAddress(seedPhrase, 'testnet') },
        { key: 'XRP', func: () => generateXrpAddress(seedPhrase, 'testnet') },
        { key: 'LTC', func: () => generateLtcAddress(seedPhrase, 'testnet') },
        { key: 'DOGE', func: () => generateDogeAddress(seedPhrase, 'testnet') }
    ];
    
    // Генерируем адреса параллельно
    const results = await Promise.allSettled(
        addressGenerators.map(generator => generator.func())
    );
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            addresses[addressGenerators[index].key] = result.value;
        }
    });
    
    return addresses;
};

// Функция для создания кошельков из сохраненных testnet адресов
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

export const getRealBalances = async (wallets) => {
    if (!Array.isArray(wallets)) return wallets;
    
    try {
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    let balance = '0';
                    const rpcConfig = wallet.network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    
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
                            balance = wallet.isNative ?
                                await getNearBalance(wallet.address, wallet.network) :
                                await getNEP141Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'BSC':
                            balance = wallet.isNative ?
                                await getBNBBalance(wallet.address, wallet.network) :
                                await getBEP20Balance(wallet.address, wallet.contractAddress, wallet.network);
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

// БАЗОВЫЕ ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ БАЛАНСОВ (упрощенные версии)
const getTonBalance = async (address, network = 'mainnet') => {
    try {
        const rpcUrl = network === 'testnet' ? TESTNET_CONFIG.TON.RPC_URL : MAINNET_CONFIG.TON.RPC_URL;
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getAddressInformation",
                params: { address }
            })
        });
        
        const data = await response.json();
        if (data.result?.balance) {
            return (parseInt(data.result.balance) / 1e9).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

const getJettonBalance = async (address, jettonAddress, network = 'mainnet') => '0';
const getEthBalance = async (address, network = 'mainnet') => '0';
const getERC20Balance = async (address, contractAddress, network = 'mainnet') => '0';
const getSolBalance = async (address, network = 'mainnet') => '0';
const getSPLBalance = async (address, tokenAddress, network = 'mainnet') => '0';
const getTronBalance = async (address, network = 'mainnet') => '0';
const getTRC20Balance = async (address, contractAddress, network = 'mainnet') => '0';
const getBitcoinBalance = async (address, network = 'mainnet') => '0';
const getNearBalance = async (accountId, network = 'mainnet') => '0';
const getNEP141Balance = async (accountId, contractAddress, network = 'mainnet') => '0';
const getBNBBalance = async (address, network = 'mainnet') => '0';
const getBEP20Balance = async (address, contractAddress, network = 'mainnet') => '0';
const getXrpBalance = async (address, network = 'mainnet') => '0';
const getLtcBalance = async (address, network = 'mainnet') => '0';
const getDogeBalance = async (address, network = 'mainnet') => '0';

// === ОСТАЛЬНЫЕ ФУНКЦИИ ===
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
    TOKENS,
    TESTNET_TOKENS
};