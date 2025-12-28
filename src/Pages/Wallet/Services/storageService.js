// storageService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, fromNano } from '@ton/ton';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, getAccount } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import TronWeb from 'tronweb';
import crypto from 'crypto';
import * as xrpl from 'xrpl';
import { Buffer } from 'buffer';
import axios from 'axios';

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
        NETWORK: 'mainnet',
        EXPLORER_URL: 'https://xrpscan.com/tx/'
    },
    LTC: { 
        EXPLORER_URL: 'https://api.blockcypher.com/v1/ltc/main',
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
        EXPLORER_URL: 'https://dogechain.info/api/v1/',
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
        NETWORK: 'testnet',
        EXPLORER_URL: 'https://testnet.xrpl.org/transactions/'
    },
    LTC: {
        EXPLORER_URL: 'https://api.blockcypher.com/v1/ltc/test3',
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
        EXPLORER_URL: 'https://dogechain.info/api/v1/testnet',
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

// === ТОКЕНЫ ===
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
        contractAddress: 'usdt.tether-token.near', 
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
        contractAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_BSC: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
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
        contractAddress: 'usdt.fakes.testnet', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_NEAR: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        blockchain: 'NEAR', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'usdc.fakes.testnet', 
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

// === РЕАЛЬНЫЕ ФУНКЦИИ ГЕНЕРАЦИИ АДРЕСОВ ===

// TON адрес
const generateTonAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new TonClient({
            endpoint: config.TON.RPC_URL,
            apiKey: config.TON.API_KEY
        });
        const openedWallet = client.open(wallet);
        return openedWallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        throw new Error('Failed to generate TON address');
    }
};

// Solana адрес
const generateSolanaAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        throw new Error('Failed to generate Solana address');
    }
};

// Ethereum адрес
const generateEthereumAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        throw new Error('Failed to generate Ethereum address');
    }
};

// BSC адрес (совпадает с Ethereum)
const generateBSCAddress = generateEthereumAddress;

// TRON адрес - ПРАВИЛЬНАЯ ГЕНЕРАЦИЯ
const generateTronAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const tronWeb = new TronWeb({
            fullHost: config.TRON.RPC_URL,
            privateKey: privateKey
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKey);
        
        if (!address || !address.startsWith('T') || address.length !== 34) {
            throw new Error('Invalid TRON address generated');
        }
        
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        throw new Error('Failed to generate TRON address');
    }
};

// Bitcoin адрес
const generateBitcoinAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        
        if (!address) throw new Error('Failed to generate Bitcoin address');
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        throw new Error('Failed to generate Bitcoin address');
    }
};

// NEAR адрес - ЧИСЛЕННЫЙ HEX-АДРЕС
const generateNearAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256').update(seedBuffer).digest('hex');
        const hexAddress = hash.substring(0, 64);
        
        if (!/^[0-9a-f]{64}$/i.test(hexAddress)) {
            throw new Error('Invalid NEAR address generated');
        }
        
        return hexAddress;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        throw new Error('Failed to generate NEAR address');
    }
};

// XRP адрес - ПРАВИЛЬНЫЙ r-АДРЕС
const generateXrpAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 16));
        
        const keypair = xrpl.Wallet.fromSeed(Buffer.from(seedArray).toString('hex'));
        return keypair.address;
    } catch (error) {
        console.error('Error generating XRP address:', error);
        throw new Error('Failed to generate XRP address');
    }
};

// Litecoin адрес
const generateLtcAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.LTC.NETWORK : MAINNET_CONFIG.LTC.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        
        if (!address) throw new Error('Failed to generate Litecoin address');
        return address;
    } catch (error) {
        console.error('Error generating LTC address:', error);
        throw new Error('Failed to generate Litecoin address');
    }
};

// Dogecoin адрес
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
        
        if (!address) throw new Error('Failed to generate Dogecoin address');
        return address;
    } catch (error) {
        console.error('Error generating DOGE address:', error);
        throw new Error('Failed to generate Dogecoin address');
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

// Генерация всех кошельков из seed фразы
export const generateWalletsFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [
            tonAddress, 
            solanaAddress, 
            ethAddress, 
            bscAddress, 
            tronAddress, 
            bitcoinAddress, 
            nearAddress, 
            xrpAddress, 
            ltcAddress, 
            dogeAddress
        ] = await Promise.all([
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
        
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        // TON блокчейн
        walletArray.push(createWallet(tokens.TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDT_TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDC_TON, tonAddress, network));
        
        // Ethereum блокчейн
        walletArray.push(createWallet(tokens.ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDT_ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDC_ETH, ethAddress, network));
        
        // Solana блокчейн
        walletArray.push(createWallet(tokens.SOL, solanaAddress, network));
        walletArray.push(createWallet(tokens.USDT_SOL, solanaAddress, network));
        walletArray.push(createWallet(tokens.USDC_SOL, solanaAddress, network));
        
        // BSC блокчейн
        walletArray.push(createWallet(tokens.BNB, bscAddress, network));
        walletArray.push(createWallet(tokens.USDT_BSC, bscAddress, network));
        walletArray.push(createWallet(tokens.USDC_BSC, bscAddress, network));
        
        // Tron блокчейн
        walletArray.push(createWallet(tokens.TRX, tronAddress, network));
        walletArray.push(createWallet(tokens.USDT_TRX, tronAddress, network));
        walletArray.push(createWallet(tokens.USDC_TRX, tronAddress, network));
        
        // Bitcoin блокчейн
        walletArray.push(createWallet(tokens.BTC, bitcoinAddress, network));
        
        // NEAR блокчейн
        walletArray.push(createWallet(tokens.NEAR, nearAddress, network));
        walletArray.push(createWallet(tokens.USDT_NEAR, nearAddress, network));
        walletArray.push(createWallet(tokens.USDC_NEAR, nearAddress, network));
        
        // XRP блокчейн
        walletArray.push(createWallet(tokens.XRP, xrpAddress, network));
        
        // Litecoin блокчейн
        walletArray.push(createWallet(tokens.LTC, ltcAddress, network));
        
        // Dogecoin блокчейн
        walletArray.push(createWallet(tokens.DOGE, dogeAddress, network));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
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

        // Генерация MAINNET кошельков
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

        // Генерация TESTNET кошельков
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

        // Сохранение в базу
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
        throw error;
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

// === РЕАЛЬНЫЕ ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===

// Получение баланса TON
const getTonBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        const response = await fetch(config.TON.RPC_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': config.TON.API_KEY
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
            return fromNano(data.result.balance);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        throw error;
    }
};

// Получение баланса Jetton токенов на TON
const getTonJettonBalance = async (walletAddress, jettonAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        // Сначала получаем адрес кошелька джеттона
        const walletResponse = await fetch(config.TON.RPC_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': config.TON.API_KEY
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "runGetMethod",
                params: {
                    address: jettonAddress,
                    method: "get_wallet_address",
                    stack: [["tvm.Slice", walletAddress]]
                }
            })
        });
        
        const walletData = await walletResponse.json();
        if (!walletData.result?.stack?.[0]) return '0';
        
        const jettonWalletAddress = walletData.result.stack[0][1].bytes;
        
        // Получаем баланс кошелька джеттона
        const balanceResponse = await fetch(config.TON.RPC_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': config.TON.API_KEY
            },
            body: JSON.stringify({
                id: 2,
                jsonrpc: "2.0",
                method: "runGetMethod",
                params: {
                    address: jettonWalletAddress,
                    method: "get_wallet_data",
                    stack: []
                }
            })
        });
        
        const balanceData = await balanceResponse.json();
        if (balanceData.result?.stack?.[0]) {
            const balanceHex = balanceData.result.stack[0][1];
            const balance = parseInt(balanceHex, 16);
            return (balance / 1e6).toFixed(6); // USDT/USDC имеют 6 decimals
        }
        return '0';
    } catch (error) {
        console.error('TON Jetton balance error:', error);
        return '0';
    }
};

// Получение баланса Ethereum
const getEthBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        throw error;
    }
};

// Получение баланса ERC20 токенов
const getERC20Balance = async (address, contractAddress, decimals = 6, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        
        const abi = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        // Получаем decimals из контракта, если не указаны
        let tokenDecimals = decimals;
        try {
            tokenDecimals = await contract.decimals();
        } catch (e) {
            console.log('Using default decimals:', decimals);
        }
        
        const balance = await contract.balanceOf(address);
        return ethers.formatUnits(balance, tokenDecimals);
    } catch (error) {
        console.error('ERC20 balance error:', error);
        throw error;
    }
};

// Получение баланса Solana
const getSolBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
        console.error('SOL balance error:', error);
        throw error;
    }
};

// Получение баланса SPL токенов
const getSPLBalance = async (address, tokenMintAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        const ownerPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenMintAddress);
        
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            ownerPublicKey,
            { mint: tokenPublicKey }
        );
        
        if (tokenAccounts.value.length > 0) {
            let totalBalance = 0;
            for (const tokenAccount of tokenAccounts.value) {
                const accountInfo = await connection.getTokenAccountBalance(tokenAccount.pubkey);
                if (accountInfo.value.uiAmount) {
                    totalBalance += accountInfo.value.uiAmount;
                }
            }
            return totalBalance.toString();
        }
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        throw error;
    }
};

// Получение баланса TRON
const getTronBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const tronWeb = new TronWeb({ 
            fullHost: config.TRON.RPC_URL
        });
        
        const balance = await tronWeb.trx.getBalance(address);
        return (balance / 1e6).toString();
    } catch (error) {
        console.error('TRON balance error:', error);
        throw error;
    }
};

// Получение баланса TRC20 токенов
const getTRC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const tronWeb = new TronWeb({ 
            fullHost: config.TRON.RPC_URL
        });
        
        const contract = await tronWeb.contract().at(contractAddress);
        const result = await contract.balanceOf(address).call();
        
        if (result) {
            return (result / 1e6).toString();
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        throw error;
    }
};

// Получение баланса BSC
const getBSCBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BSC balance error:', error);
        throw error;
    }
};

// Получение баланса BEP20 токенов
const getBEP20Balance = async (address, contractAddress, decimals = 18, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        
        const abi = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        let tokenDecimals = decimals;
        try {
            tokenDecimals = await contract.decimals();
        } catch (e) {
            console.log('Using default decimals:', decimals);
        }
        
        const balance = await contract.balanceOf(address);
        return ethers.formatUnits(balance, tokenDecimals);
    } catch (error) {
        console.error('BEP20 balance error:', error);
        throw error;
    }
};

// Получение баланса Bitcoin
const getBitcoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${address}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const balance = (funded - spent) / 1e8;
        
        return balance.toString();
    } catch (error) {
        console.error('Bitcoin balance error:', error);
        throw error;
    }
};

// Получение баланса NEAR
const getNearBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        // Для hex-адресов (неявных аккаунтов) используем специальный RPC запрос
        const response = await fetch(config.NEAR.RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        
        const data = await response.json();
        if (data.result) {
            const balance = data.result.amount;
            return (parseInt(balance) / 1e24).toString();
        }
        
        return '0';
    } catch (error) {
        console.error('NEAR balance error:', error);
        throw error;
    }
};

// Получение баланса XRP
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
            
            if (error.data?.error === 'actNotFound') {
                return '0';
            }
            throw error;
        }
    } catch (error) {
        console.error('XRP balance error:', error);
        throw error;
    }
};

// Получение баланса Litecoin
const getLtcBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.LTC.EXPLORER_URL}/addrs/${address}/balance`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const balance = data.balance / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('Litecoin balance error:', error);
        throw error;
    }
};

// Получение баланса Dogecoin
const getDogeBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.DOGE.EXPLORER_URL}/address/balance/${address}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const balance = data.balance / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('Dogecoin balance error:', error);
        throw error;
    }
};

// Универсальная функция получения баланса для кошелька
const getWalletBalance = async (wallet, network = 'mainnet') => {
    try {
        const { symbol, address, blockchain, isNative, contractAddress, decimals } = wallet;
        const targetNetwork = network || wallet.network || 'mainnet';
        
        switch(blockchain) {
            case 'TON':
                if (isNative) {
                    return await getTonBalance(address, targetNetwork);
                } else {
                    if (contractAddress) {
                        return await getTonJettonBalance(address, contractAddress, targetNetwork);
                    }
                }
                break;
                
            case 'Ethereum':
                if (isNative) {
                    return await getEthBalance(address, targetNetwork);
                } else {
                    if (contractAddress) {
                        return await getERC20Balance(address, contractAddress, decimals || 6, targetNetwork);
                    }
                }
                break;
                
            case 'Solana':
                if (isNative) {
                    return await getSolBalance(address, targetNetwork);
                } else {
                    if (contractAddress) {
                        return await getSPLBalance(address, contractAddress, targetNetwork);
                    }
                }
                break;
                
            case 'Tron':
                if (isNative) {
                    return await getTronBalance(address, targetNetwork);
                } else {
                    if (contractAddress) {
                        return await getTRC20Balance(address, contractAddress, targetNetwork);
                    }
                }
                break;
                
            case 'BSC':
                if (isNative) {
                    return await getBSCBalance(address, targetNetwork);
                } else {
                    if (contractAddress) {
                        return await getBEP20Balance(address, contractAddress, decimals || 18, targetNetwork);
                    }
                }
                break;
                
            case 'Bitcoin':
                return await getBitcoinBalance(address, targetNetwork);
                
            case 'NEAR':
                return await getNearBalance(address, targetNetwork);
                
            case 'XRP':
                return await getXrpBalance(address, targetNetwork);
                
            case 'LTC':
                return await getLtcBalance(address, targetNetwork);
                
            case 'DOGE':
                return await getDogeBalance(address, targetNetwork);
                
            default:
                throw new Error(`Unsupported blockchain: ${blockchain}`);
        }
        
        return '0';
        
    } catch (error) {
        console.error(`Error getting balance for ${wallet.symbol}:`, error);
        throw error;
    }
};

// === ОСНОВНЫЕ ЭКСПОРТИРУЕМЫЕ ФУНКЦИИ ===

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
            if (userData?.seed_phrases) {
                return await generateWalletsFromSeed(userData.seed_phrases, 'testnet');
            }
            
            if (userData?.testnet_wallets && Object.keys(userData.testnet_wallets).length > 0) {
                const tokens = TESTNET_TOKENS;
                const wallets = [];
                
                for (const [key, token] of Object.entries(tokens)) {
                    const savedWallet = userData.testnet_wallets[token.blockchain];
                    if (savedWallet && savedWallet.address) {
                        wallets.push(createWallet(token, savedWallet.address, 'testnet'));
                    }
                }
                
                return wallets;
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        throw error;
    }
};

export const getRealBalances = async (wallets) => {
    if (!Array.isArray(wallets)) return wallets;
    
    try {
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    const balance = await getWalletBalance(wallet, wallet.network);
                    return {
                        ...wallet,
                        balance: balance || '0',
                        lastUpdated: new Date().toISOString(),
                        isRealBalance: true
                    };
                } catch (error) {
                    console.error(`Failed to get balance for ${wallet.symbol}:`, error);
                    return {
                        ...wallet,
                        balance: '0',
                        lastUpdated: new Date().toISOString(),
                        error: error.message
                    };
                }
            })
        );
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting all token balances:', error);
        throw error;
    }
};

export const getBalances = getRealBalances;

// Получение цен токенов с кэшированием
let priceCache = null;
let priceCacheTime = 0;
const PRICE_CACHE_TTL = 60000; // 1 минута

export const getTokenPrices = async () => {
    const now = Date.now();
    
    if (priceCache && (now - priceCacheTime) < PRICE_CACHE_TTL) {
        return priceCache;
    }
    
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin,tether,usd-coin&vs_currencies=usd',
            {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json'
                }
            }
        );
        
        if (response.data) {
            const prices = {
                'TON': response.data['the-open-network']?.usd || 6.24,
                'ETH': response.data.ethereum?.usd || 3500.00,
                'SOL': response.data.solana?.usd || 172.34,
                'BNB': response.data.binancecoin?.usd || 600.00,
                'TRX': response.data.tron?.usd || 0.12,
                'BTC': response.data.bitcoin?.usd || 68000.00,
                'NEAR': response.data['near-protocol']?.usd || 8.50,
                'XRP': response.data.ripple?.usd || 0.52,
                'LTC': response.data.litecoin?.usd || 74.30,
                'DOGE': response.data.dogecoin?.usd || 0.15,
                'USDT': response.data.tether?.usd || 1.00,
                'USDC': response.data['usd-coin']?.usd || 1.00
            };
            
            priceCache = prices;
            priceCacheTime = now;
            return prices;
        }
        
        throw new Error('No data received from CoinGecko');
    } catch (error) {
        console.error('Error fetching token prices:', error);
        
        if (priceCache) {
            return priceCache;
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
    }
};

export const getTokenPricesFromRPC = getTokenPrices;

export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return '0.00';
        }
        
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

export const validateAddress = async (blockchain, address, network = 'mainnet') => {
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
                } catch { 
                    return false; 
                }
            case 'Tron':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$|^41[0-9a-fA-F]{40}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.BITCOIN.NETWORK);
                    return true;
                } catch { 
                    return false; 
                }
            case 'NEAR':
                const nearHexRegex = /^[0-9a-fA-F]{64}$/;
                const nearNamedRegex = /^[a-z0-9_-]+\.(near|testnet)$/;
                return nearHexRegex.test(address) || nearNamedRegex.test(address);
            case 'XRP':
                const xrpRegex = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/;
                return xrpRegex.test(address);
            case 'LTC':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.LTC.NETWORK);
                    return true;
                } catch { 
                    return false; 
                }
            case 'DOGE':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.DOGE.NETWORK);
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

export const sendTransaction = async (transactionData) => {
    try {
        const { sendTransaction: sendTx } = await import('./blockchainService');
        return await sendTx(transactionData);
    } catch (error) {
        console.error('Transaction error:', error);
        throw error;
    }
};

export const estimateTransactionFee = async (blockchain, network = 'mainnet') => {
    try {
        const fees = {
            'TON': { mainnet: '0.05', testnet: '0.05' },
            'Ethereum': { mainnet: '0.001', testnet: '0.0001' },
            'BSC': { mainnet: '0.0001', testnet: '0.00001' },
            'Solana': { mainnet: '0.000005', testnet: '0.000001' },
            'Tron': { mainnet: '0.1', testnet: '0.01' },
            'Bitcoin': { mainnet: '0.0001', testnet: '0.00001' },
            'NEAR': { mainnet: '0.01', testnet: '0.001' },
            'XRP': { mainnet: '0.00001', testnet: '0.000001' },
            'LTC': { mainnet: '0.001', testnet: '0.0001' },
            'DOGE': { mainnet: '0.01', testnet: '0.001' }
        };
        
        const blockchainFees = fees[blockchain] || { mainnet: '0.01', testnet: '0.001' };
        return network === 'testnet' ? blockchainFees.testnet : blockchainFees.mainnet;
    } catch (error) {
        console.error('Fee estimation error:', error);
        return '0.01';
    }
};

// Экспорт по умолчанию
export default {
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    getAllTokens,
    getRealBalances,
    getBalances,
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