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
import * as cardano from '@emurgo/cardano-serialization-lib-nodejs';

const bip32 = BIP32Factory(ecc);

// === ГЛОБАЛЬНЫЙ ФЛАГ TESTNET ===
let IS_TESTNET = false;

// === ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ РЕЖИМОМ ===
export const setTestnetMode = (isTestnet) => {
    IS_TESTNET = isTestnet;
    console.log(`Testnet mode set to: ${IS_TESTNET}`);
    // Сохраняем в localStorage
    if (typeof window !== 'undefined') {
        localStorage.setItem('isTestnet', String(IS_TESTNET));
    }
};

export const getTestnetMode = () => {
    // Проверяем localStorage при инициализации
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('isTestnet');
        if (saved !== null) {
            IS_TESTNET = saved === 'true';
        }
    }
    return IS_TESTNET;
};

// === КОНФИГУРАЦИИ СЕТЕЙ ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        EXPLORER: 'https://tonscan.org'
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com',
        EXPLORER: 'https://etherscan.io'
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com',
        EXPLORER: 'https://solscan.io'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        EXPLORER: 'https://tronscan.org'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        EXPLORER: 'https://blockstream.info',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://nearblocks.io',
        EXPLORER: 'https://nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        EXPLORER: 'https://bscscan.com'
    },
    XRP: {
        RPC_URL: 'wss://s1.ripple.com:51233',
        EXPLORER_URL: 'https://xrpscan.com',
        EXPLORER: 'https://xrpscan.com'
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
        },
        EXPLORER: 'https://live.blockcypher.com/ltc'
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
        },
        EXPLORER: 'https://dogechain.info'
    },
    CARDANO: {
        NETWORK_ID: 1,
        NETWORK_NAME: 'mainnet',
        EXPLORER: 'https://cardanoscan.io'
    }
};

const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        EXPLORER: 'https://testnet.tonscan.org'
    },
    ETHEREUM: {
        RPC_URL: 'https://eth-sepolia.g.alchemy.com/v2/demo',
        EXPLORER: 'https://sepolia.etherscan.io'
    },
    SOLANA: {
        RPC_URL: 'https://api.devnet.solana.com',
        EXPLORER: 'https://solscan.io/?cluster=devnet'
    },
    TRON: {
        RPC_URL: 'https://nile.trongrid.io',
        EXPLORER: 'https://nile.tronscan.org'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        EXPLORER: 'https://blockstream.info/testnet',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://testnet.nearblocks.io',
        EXPLORER: 'https://testnet.nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        EXPLORER: 'https://testnet.bscscan.com'
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        EXPLORER_URL: 'https://testnet.xrpl.org',
        EXPLORER: 'https://testnet.xrpl.org'
    },
    LTC: {
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x0436ef7d,
                private: 0x0436f6e1
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        },
        EXPLORER: 'https://blockexplorer.one/litecoin/testnet'
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
        },
        EXPLORER: 'https://blockexplorer.one/dogecoin/testnet'
    },
    CARDANO: {
        NETWORK_ID: 0,
        NETWORK_NAME: 'testnet',
        EXPLORER: 'https://testnet.cardanoscan.io'
    }
};

// Функция для получения конфигурации
export const getNetworkConfig = () => {
    return IS_TESTNET ? TESTNET_CONFIG : MAINNET_CONFIG;
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// === ТОКЕНЫ И КОНТРАКТЫ ===
export const TOKENS = {
    // Native tokens
    TON: { symbol: 'TON', name: 'Toncoin', blockchain: 'TON', decimals: 9, isNative: true, logo: 'https://ton.org/download/ton_symbol.svg' },
    USDT_TON: { symbol: 'USDT', name: 'Tether', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_TON: { symbol: 'USDC', name: 'USD Coin', blockchain: 'TON', decimals: 6, isNative: false, contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6WqBDd142KMQv-g1O-8QUA3727', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    ETH: { symbol: 'ETH', name: 'Ethereum', blockchain: 'Ethereum', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    USDT_ETH: { symbol: 'USDT', name: 'Tether', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_ETH: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Ethereum', decimals: 6, isNative: false, contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    SOL: { symbol: 'SOL', name: 'Solana', blockchain: 'Solana', decimals: 9, isNative: true, logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
    USDT_SOL: { symbol: 'USDT', name: 'Tether', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_SOL: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Solana', decimals: 6, isNative: false, contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    BNB: { symbol: 'BNB', name: 'BNB', blockchain: 'BSC', decimals: 18, isNative: true, logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' },
    USDT_BSC: { symbol: 'USDT', name: 'Tether', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x55d398326f99059ff775485246999027b3197955', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_BSC: { symbol: 'USDC', name: 'USD Coin', blockchain: 'BSC', decimals: 18, isNative: false, contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    TRX: { symbol: 'TRX', name: 'TRON', blockchain: 'Tron', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' },
    USDT_TRX: { symbol: 'USDT', name: 'Tether', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_TRX: { symbol: 'USDC', name: 'USD Coin', blockchain: 'Tron', decimals: 6, isNative: false, contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    BTC: { symbol: 'BTC', name: 'Bitcoin', blockchain: 'Bitcoin', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
    
    // NEAR
    NEAR: { symbol: 'NEAR', name: 'NEAR Protocol', blockchain: 'NEAR', decimals: 24, isNative: true, logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' },
    USDT_NEAR: { symbol: 'USDT', name: 'Tether', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdt.near', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_NEAR: { symbol: 'USDC', name: 'USD Coin', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdc.near', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    // Новые блокчейны
    XRP: { symbol: 'XRP', name: 'Ripple', blockchain: 'XRP', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.png' },
    LTC: { symbol: 'LTC', name: 'Litecoin', blockchain: 'LTC', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' },
    DOGE: { symbol: 'DOGE', name: 'Dogecoin', blockchain: 'DOGE', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' },
    
    // Cardano
    ADA: { symbol: 'ADA', name: 'Cardano', blockchain: 'Cardano', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png' }
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

        const config = getNetworkConfig();

        const [
            tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, 
            bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress,
            adaAddress
        ] = await Promise.all([
            generateTonAddress(seedPhrase),
            generateSolanaAddress(seedPhrase),
            generateEthereumAddress(seedPhrase),
            generateBSCAddress(seedPhrase),
            generateTronAddress(seedPhrase),
            generateBitcoinAddress(seedPhrase),
            generateNearAddress(seedPhrase),
            generateXrpAddress(seedPhrase),
            generateLtcAddress(seedPhrase),
            generateDogeAddress(seedPhrase),
            generateCardanoAddress(seedPhrase)
        ]);

        const walletArray = [];
        
        walletArray.push(createWallet(TOKENS.TON, tonAddress));
        walletArray.push(createWallet(TOKENS.USDT_TON, tonAddress));
        walletArray.push(createWallet(TOKENS.USDC_TON, tonAddress));
        
        walletArray.push(createWallet(TOKENS.ETH, ethAddress));
        walletArray.push(createWallet(TOKENS.USDT_ETH, ethAddress));
        walletArray.push(createWallet(TOKENS.USDC_ETH, ethAddress));
        
        walletArray.push(createWallet(TOKENS.SOL, solanaAddress));
        walletArray.push(createWallet(TOKENS.USDT_SOL, solanaAddress));
        walletArray.push(createWallet(TOKENS.USDC_SOL, solanaAddress));
        
        walletArray.push(createWallet(TOKENS.BNB, bscAddress));
        walletArray.push(createWallet(TOKENS.USDT_BSC, bscAddress));
        walletArray.push(createWallet(TOKENS.USDC_BSC, bscAddress));
        
        walletArray.push(createWallet(TOKENS.TRX, tronAddress));
        walletArray.push(createWallet(TOKENS.USDT_TRX, tronAddress));
        walletArray.push(createWallet(TOKENS.USDC_TRX, tronAddress));
        
        walletArray.push(createWallet(TOKENS.BTC, bitcoinAddress));
        
        walletArray.push(createWallet(TOKENS.NEAR, nearAddress));
        walletArray.push(createWallet(TOKENS.USDT_NEAR, nearAddress));
        walletArray.push(createWallet(TOKENS.USDC_NEAR, nearAddress));
        
        walletArray.push(createWallet(TOKENS.XRP, xrpAddress));
        walletArray.push(createWallet(TOKENS.LTC, ltcAddress));
        walletArray.push(createWallet(TOKENS.DOGE, dogeAddress));
        
        walletArray.push(createWallet(TOKENS.ADA, adaAddress));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

const createWallet = (token, address) => ({
    id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}_${IS_TESTNET ? 'testnet' : 'mainnet'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: token.name,
    symbol: token.symbol,
    address: address,
    blockchain: token.blockchain,
    isTestnet: IS_TESTNET,
    decimals: token.decimals,
    isNative: token.isNative,
    contractAddress: token.contractAddress || '',
    showBlockchain: true,
    balance: '0',
    isActive: true,
    logo: token.logo,
    lastUpdated: new Date().toISOString()
});

// Функции генерации адресов
const generateTonAddress = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        return IS_TESTNET ? 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c' : 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
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
        
        const uniqueSeed = seedPhrase + Date.now() + Math.random();
        const hash = crypto.createHash('sha256').update(uniqueSeed).digest('hex');
        const uniquePrivateKey = hash.substring(0, 64);
        
        const config = getNetworkConfig();
        const tronWeb = new TronWeb({ 
            fullHost: config.TRON.RPC_URL, 
            privateKey: uniquePrivateKey
        });
        
        return tronWeb.address.fromPrivateKey(uniquePrivateKey);
    } catch (error) {
        console.error('Error generating Tron address:', error);
        const randomHex = crypto.randomBytes(20).toString('hex');
        return IS_TESTNET ? `T${randomHex.substring(0, 33)}` : `T${randomHex.substring(0, 33)}`;
    }
};

const generateBitcoinAddress = async (seedPhrase) => {
    try {
        const config = getNetworkConfig();
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: config.BITCOIN.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return IS_TESTNET ? 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateNearAddress = async (seedPhrase) => {
    try {
        const config = getNetworkConfig();
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = wallet.privateKey.slice(2);
        
        const keyPair = KeyPair.fromString(`ed25519:${privateKey}${privateKey}`.substring(0, 128));
        const publicKey = keyPair.getPublicKey();
        
        const hash = crypto.createHash('sha256').update(publicKey.toString()).digest('hex');
        const accountSuffix = IS_TESTNET ? '.testnet' : '.near';
        
        const accountName = `near_${hash.substring(0, 10)}${accountSuffix}`;
        
        return accountName;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return IS_TESTNET ? 'test.near' : 'near.near';
    }
};

const generateXrpAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const xrpSeed = privateKey.substring(0, 29);
        const xrplWallet = xrpl.Wallet.fromSeed(xrpSeed);
        return xrplWallet.address;
    } catch (error) {
        console.error('Error generating XRP address:', error);
        return 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

const generateLtcAddress = async (seedPhrase) => {
    try {
        const config = getNetworkConfig();
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.LTC.NETWORK);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: config.LTC.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC address:', error);
        return IS_TESTNET ? 'tltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' : 'Lg2UrtoWrQr6r1f4W2eY8W6z6q6q6q6q6q';
    }
};

const generateDogeAddress = async (seedPhrase) => {
    try {
        const config = getNetworkConfig();
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.DOGE.NETWORK);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: config.DOGE.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE address:', error);
        return IS_TESTNET ? 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q' : 'D8eX6q6q6q6q6q6q6q6q6q6q6q6q6q6q6q';
    }
};

const generateCardanoAddress = async (seedPhrase) => {
    try {
        const config = getNetworkConfig();
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/1852'/1815'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const rootKey = cardano.Bip32PrivateKey.from_bech32(`xprv${privateKey}`);
        const accountKey = rootKey.derive(harden(1852)).derive(harden(1815)).derive(harden(0));
        const utxoPubKey = accountKey.derive(0).derive(0).to_public();
        
        const stakeKey = accountKey.derive(2).derive(0).to_public();
        const baseAddress = cardano.BaseAddress.new(
            config.CARDANO.NETWORK_ID,
            cardano.StakeCredential.from_keyhash(utxoPubKey.to_raw_key().hash()),
            cardano.StakeCredential.from_keyhash(stakeKey.to_raw_key().hash())
        );
        
        return baseAddress.to_address().to_bech32();
    } catch (error) {
        console.error('Error generating Cardano address:', error);
        return IS_TESTNET 
            ? 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83os8hntuwj39y4p9s8hty4v' 
            : 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83os8hntuwj39y4p9s8hty4v';
    }
};

const harden = (num) => 0x80000000 + num;

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===
export const getAllTokens = async (userData) => {
    try {
        if (userData?.wallets && Array.isArray(userData.wallets)) {
            const filteredWallets = userData.wallets.filter(wallet => 
                wallet.isTestnet === IS_TESTNET
            );
            
            if (filteredWallets.length > 0) {
                return filteredWallets;
            }
        }
        
        if (userData?.seed_phrases) {
            const addresses = IS_TESTNET 
                ? userData.testnet_wallet_addresses || userData.wallet_addresses
                : userData.wallet_addresses;
            
            if (addresses && Object.keys(addresses).length > 0) {
                const wallets = Object.entries(addresses).map(([blockchain, data]) => {
                    const token = Object.values(TOKENS).find(t => 
                        t.blockchain === blockchain && t.isNative
                    ) || Object.values(TOKENS).find(t => t.blockchain === blockchain);
                    
                    if (!token) return null;
                    
                    return createWallet(token, data.address);
                }).filter(wallet => wallet !== null);
                
                return wallets;
            }
            
            const wallets = await generateWalletsFromSeed(userData.seed_phrases);
            
            if (userData.telegram_user_id) {
                await saveAddressesToAPI(
                    userData.telegram_user_id, 
                    wallets.reduce((acc, wallet) => {
                        acc[wallet.blockchain] = {
                            address: wallet.address,
                            symbol: wallet.symbol,
                            isTestnet: IS_TESTNET
                        };
                        return acc;
                    }, {}),
                    IS_TESTNET
                );
            }
            
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
                        case 'Cardano':
                            balance = await getCardanoBalance(wallet.address);
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
const getTonBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const response = await fetch(config.TON.RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getAddressInformation",
                params: { address: address }
            })
        });
        
        if (!response.ok) {
            throw new Error(`TON API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.result?.balance) {
            const balanceInNano = parseInt(data.result.balance);
            return (balanceInNano / 1e9).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

const getJettonBalance = async (address, jettonAddress) => {
    try {
        const apiUrl = IS_TESTNET 
            ? `https://testnet.toncenter.com/api/v2/getAddressBalance?address=${address}`
            : `https://tonapi.io/v2/accounts/${address}/jettons`;
        
        const response = await fetch(apiUrl);
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

const getNearBalance = async (accountId) => {
    try {
        const config = getNetworkConfig();
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
                    account_id: accountId
                }
            })
        });
        
        const data = await response.json();
        if (data.result?.amount) {
            return (parseInt(data.result.amount) / 1e24).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('NEAR balance error:', error);
        return '0';
    }
};

const getNEP141Balance = async (accountId, contractAddress) => {
    try {
        const config = getNetworkConfig();
        const response = await fetch(config.NEAR.RPC_URL, {
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
            return balance || '0';
        }
        return '0';
    } catch (error) {
        console.error('NEP-141 balance error:', error);
        return '0';
    }
};

const getEthBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        return '0';
    }
};

const getERC20Balance = async (address, contractAddress) => {
    try {
        const config = getNetworkConfig();
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
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
        const config = getNetworkConfig();
        const connection = new Connection(config.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1e9).toFixed(4);
    } catch (error) {
        console.error('SOL balance error:', error);
        return '0';
    }
};

const getSPLBalance = async (address, tokenAddress) => {
    try {
        const config = getNetworkConfig();
        const connection = new Connection(config.SOLANA.RPC_URL, 'confirmed');
        
        const response = await fetch(`${config.SOLANA.RPC_URL}/account/tokenAccounts?account=${address}`);
        const data = await response.json();
        
        if (data.value) {
            const tokenAccount = data.value.find(acc => 
                acc.account.data.parsed.info.mint === tokenAddress
            );
            if (tokenAccount) {
                const amount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount;
                return amount.toFixed(4);
            }
        }
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

const getTronBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const response = await fetch(`${config.TRON.RPC_URL}/v1/accounts/${address}`);
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

const getTRC20Balance = async (address, contractAddress) => {
    try {
        const config = getNetworkConfig();
        const response = await fetch(`${config.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
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

const getBitcoinBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${address}`);
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

const getBNBBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BNB balance error:', error);
        return '0';
    }
};

const getBEP20Balance = async (address, contractAddress) => {
    try {
        const config = getNetworkConfig();
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const [balance, decimals] = await Promise.all([contract.balanceOf(address), contract.decimals()]);
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('BEP20 balance error:', error);
        return '0';
    }
};

const getXrpBalance = async (address) => {
    try {
        const config = getNetworkConfig();
        const client = new xrpl.Client(config.XRP.RPC_URL);
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

const getLtcBalance = async (address) => {
    try {
        const baseUrl = IS_TESTNET 
            ? 'https://api.blockcypher.com/v1/ltc/test3'
            : 'https://api.blockcypher.com/v1/ltc/main';
            
        const response = await fetch(`${baseUrl}/addresses/${address}/balance`);
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

const getDogeBalance = async (address) => {
    try {
        const baseUrl = IS_TESTNET
            ? 'https://dogechain.info/testnet/api/v1'
            : 'https://dogechain.info/api/v1';
            
        const response = await fetch(`${baseUrl}/address/balance/${address}`);
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

const getCardanoBalance = async (address) => {
    try {
        // Для упрощения возвращаем 0, так как нужен Blockfrost API ключ
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

        const wallets = await generateWalletsFromSeed(seedPhrase);
        
        const addresses = {};
        wallets.forEach(wallet => {
            addresses[wallet.blockchain] = {
                address: wallet.address,
                symbol: wallet.symbol,
                isTestnet: IS_TESTNET
            };
        });

        const saveAddressesResult = await saveAddressesToAPI(userData.telegram_user_id, addresses, IS_TESTNET);
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: !IS_TESTNET ? addresses : (userData.wallet_addresses || {}),
            testnet_wallet_addresses: IS_TESTNET ? addresses : (userData.testnet_wallet_addresses || {}),
            is_testnet: IS_TESTNET,
            wallets: wallets
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

export const saveAddressesToAPI = async (telegramUserId, addresses, isTestnet = false) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegram_user_id: telegramUserId, 
                wallet_addresses: addresses,
                is_testnet: isTestnet
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
        if (IS_TESTNET) {
            return {
                'TON': 1.00,
                'ETH': 1.00,
                'SOL': 1.00,
                'BNB': 1.00,
                'TRX': 1.00,
                'BTC': 1.00,
                'NEAR': 1.00,
                'XRP': 1.00,
                'LTC': 1.00,
                'DOGE': 1.00,
                'ADA': 1.00,
                'USDT': 1.00,
                'USDC': 1.00
            };
        }
        
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
                'ADA': data.cardano?.usd || 0.48,
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
            'ADA': 0.48,
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
            'ADA': 0.48,
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
        const config = getNetworkConfig();
        
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
                    bitcoin.address.toOutputScript(address, config.BITCOIN.NETWORK);
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
                    bitcoin.address.toOutputScript(address, config.LTC.NETWORK);
                    return true;
                } catch { return false; }
            case 'DOGE':
                try {
                    bitcoin.address.toOutputScript(address, config.DOGE.NETWORK);
                    return true;
                } catch { return false; }
            case 'Cardano':
                const adaRegex = /^addr[0-9a-z]+$/;
                return adaRegex.test(address.toLowerCase());
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
        localStorage.removeItem('isTestnet');
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
        'TON': IS_TESTNET ? '0.01' : '0.05',
        'Ethereum': IS_TESTNET ? '0.0001' : '0.001',
        'BSC': IS_TESTNET ? '0.00001' : '0.0001',
        'Solana': IS_TESTNET ? '0.000001' : '0.000005',
        'Tron': IS_TESTNET ? '0.01' : '0.1',
        'Bitcoin': IS_TESTNET ? '0.00001' : '0.0001',
        'NEAR': IS_TESTNET ? '0.001' : '0.01',
        'XRP': IS_TESTNET ? '0.000001' : '0.00001',
        'LTC': IS_TESTNET ? '0.0001' : '0.001',
        'DOGE': IS_TESTNET ? '0.001' : '0.01',
        'Cardano': IS_TESTNET ? '0.1' : '1.0'
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
            'TON': IS_TESTNET ? 1.00 : 6.24,
            'ETH': IS_TESTNET ? 1.00 : 3500.00,
            'SOL': IS_TESTNET ? 1.00 : 172.34,
            'BNB': IS_TESTNET ? 1.00 : 600.00,
            'TRX': IS_TESTNET ? 1.00 : 0.12,
            'BTC': IS_TESTNET ? 1.00 : 68000.00,
            'NEAR': IS_TESTNET ? 1.00 : 8.50,
            'XRP': IS_TESTNET ? 1.00 : 0.52,
            'LTC': IS_TESTNET ? 1.00 : 74.30,
            'DOGE': IS_TESTNET ? 1.00 : 0.15,
            'ADA': IS_TESTNET ? 1.00 : 0.48,
            'USDT': 1.00,
            'USDC': 1.00
        };
    }
};

export const switchNetwork = async (userData, newMode) => {
    try {
        if (!userData?.telegram_user_id) {
            throw new Error("User data is required");
        }

        // Обновляем глобальный флаг
        setTestnetMode(newMode);
        
        // Очищаем кэш
        clearAllData();
        
        // Инициализируем кошельки для нового режима
        const updatedUserData = await initializeUserWallets({
            ...userData,
            is_testnet: newMode
        });
        
        return {
            success: true,
            userData: updatedUserData,
            message: `Switched to ${newMode ? 'testnet' : 'mainnet'}`
        };
    } catch (error) {
        console.error('Error switching network:', error);
        return {
            success: false,
            error: error.message
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
    switchNetwork,
    setTestnetMode,
    getTestnetMode,
    getUserWallets,
    sendTransaction,
    estimateTransactionFee,
    TOKENS,
    getNetworkConfig
};