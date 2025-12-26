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
import * as ripple from 'ripple-lib';

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

// === КОНФИГУРАЦИЯ TESTNET ===
const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        NETWORK: 'testnet'
    },
    ETHEREUM: {
        RPC_URL: 'https://sepolia.infura.io/v3/',
        CHAIN_ID: 11155111,
        NETWORK: 'sepolia'
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
        API_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet,
        EXPLORER_URL: 'https://blockstream.info/testnet'
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://testnet.nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        CHAIN_ID: 97,
        NETWORK: 'testnet'
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        EXPLORER_URL: 'https://testnet.xrpl.org',
        NETWORK: 'testnet'
    },
    LTC: {
        API_URL: 'https://testnet.litecore.io',
        EXPLORER_URL: 'https://testnet.litecore.io',
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394
            },
            pubKeyHash: 0x6f,
            scriptHash: 0x3a,
            wif: 0xef
        }
    },
    DOGE: {
        API_URL: 'https://testnet.dogechain.info/api/v1',
        EXPLORER_URL: 'https://testnet.dogechain.info',
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394
            },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1
        }
    }
};

// Базовые URL для Netlify функций
const WALLET_API_URL = 'https://your-domain.netlify.app/.netlify/functions';

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
    
    NEAR: { symbol: 'NEAR', name: 'NEAR Protocol', blockchain: 'NEAR', decimals: 24, isNative: true, logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' },
    USDT_NEAR: { symbol: 'USDT', name: 'Tether', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdt.near', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
    USDC_NEAR: { symbol: 'USDC', name: 'USD Coin', blockchain: 'NEAR', decimals: 6, isNative: false, contractAddress: 'usdc.near', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    
    XRP: { symbol: 'XRP', name: 'Ripple', blockchain: 'XRP', decimals: 6, isNative: true, logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.png' },
    LTC: { symbol: 'LTC', name: 'Litecoin', blockchain: 'LTC', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' },
    DOGE: { symbol: 'DOGE', name: 'Dogecoin', blockchain: 'DOGE', decimals: 8, isNative: true, logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' }
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

// Вспомогательная функция для создания кошелька
const createWallet = (token, address) => ({
    id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
});

// Вспомогательная функция для создания testnet кошелька
const createTestnetWallet = (symbol, address, blockchain) => {
    const token = TOKENS[`${symbol}_${blockchain}`] || TOKENS[symbol];
    return {
        id: `${symbol.toLowerCase()}_${blockchain.toLowerCase()}_testnet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${symbol} Testnet`,
        symbol: symbol,
        address: address,
        blockchain: blockchain,
        decimals: blockchain === 'Bitcoin' ? 8 : blockchain === 'XRP' ? 6 : (token?.decimals || 18),
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        balance: '0',
        isActive: true,
        logo: token?.logo || TOKENS[symbol]?.logo || '',
        lastUpdated: new Date().toISOString(),
        isTestnet: true
    };
};

// Функции генерации адресов MAINNET
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
        // Используем детерминированную генерацию для Tron
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        
        // Создаем приватный ключ из seed
        const privateKeyHex = crypto.createHash('sha256').update(seedHex + "TRON_MAINNET").digest('hex');
        
        // Используем TronWeb для генерации адреса
        const tronWeb = new TronWeb({
            fullHost: MAINNET_CONFIG.TRON.RPC_URL,
            privateKey: privateKeyHex
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKeyHex);
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return 'Txxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
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
        // Для NEAR используем BIP44 путь: m/44'/397'/0'/0'/0'
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        
        // Генерируем детерминированный account ID для NEAR
        const hash = crypto.createHash('sha256').update(seedHex + "NEAR_MAINNET").digest('hex');
        const accountSuffix = hash.substring(0, 10);
        
        // NEAR аккаунты имеют формат: имя.near
        return `near_${accountSuffix}.near`;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return 'near.near';
    }
};

const generateXrpAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        
        // Используем ripple-lib для генерации адреса
        const api = new ripple.RippleAPI();
        
        // Создаем seed из hash seed фразы
        const seedHash = crypto.createHash('sha256').update(seedHex + "XRP_MAINNET").digest('hex');
        const seed = seedHash.substring(0, 29); // XRP seed должен быть 29 символов
        
        const wallet = api.generateAddress({ seed: seed });
        return wallet.address;
    } catch (error) {
        console.error('Error generating XRP address:', error);
        return 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn';
    }
};

const generateLtcAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.LTC.NETWORK);
        const child = root.derivePath("m/84'/2'/0'/0/0");
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

// Функции генерации TESTNET адресов
const generateTonTestnetAddress = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON testnet address:', error);
        return 'kQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAj9v';
    }
};

const generateSolanaTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana testnet address:', error);
        return '11111111111111111111111111111111';
    }
};

const generateEthereumTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/1'/0'/0/0"); // testnet derivation path
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum testnet address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

const generateBSCTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0"); // Используем тот же путь, что и для mainnet
        return wallet.address;
    } catch (error) {
        console.error('Error generating BSC testnet address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

const generateTronTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        const privateKeyHex = crypto.createHash('sha256').update(seedHex + "TRON_TESTNET").digest('hex');
        
        const tronWeb = new TronWeb({ 
            fullHost: TESTNET_CONFIG.TRON.RPC_URL, 
            privateKey: privateKeyHex
        });
        
        return tronWeb.address.fromPrivateKey(privateKeyHex);
    } catch (error) {
        console.error('Error generating Tron testnet address:', error);
        return 'TXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    }
};

const generateBitcoinTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, TESTNET_CONFIG.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: TESTNET_CONFIG.BITCOIN.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin testnet address:', error);
        return 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateNearTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        const hash = crypto.createHash('sha256').update(seedHex + "NEAR_TESTNET").digest('hex');
        const accountSuffix = hash.substring(0, 10);
        return `near_${accountSuffix}.testnet`;
    } catch (error) {
        console.error('Error generating NEAR testnet address:', error);
        return 'test.near';
    }
};

const generateXrpTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex');
        
        const api = new ripple.RippleAPI();
        const seedHash = crypto.createHash('sha256').update(seedHex + "XRP_TESTNET").digest('hex');
        const seed = seedHash.substring(0, 29);
        
        const wallet = api.generateAddress({ seed: seed });
        return wallet.address;
    } catch (error) {
        console.error('Error generating XRP testnet address:', error);
        return 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe';
    }
};

const generateLtcTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, TESTNET_CONFIG.LTC.NETWORK);
        const child = root.derivePath("m/84'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: TESTNET_CONFIG.LTC.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating LTC testnet address:', error);
        return 'tltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

const generateDogeTestnetAddress = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, TESTNET_CONFIG.DOGE.NETWORK);
        const child = root.derivePath("m/44'/1'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: TESTNET_CONFIG.DOGE.NETWORK 
        });
        return address;
    } catch (error) {
        console.error('Error generating DOGE testnet address:', error);
        return 'nURea4kArENHjqZ2tdnYc4eX3nWk8a6yXZ';
    }
};

// Функция для генерации testnet кошельков
export const generateTestnetWalletsFromSeed = async (seedPhrase) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        // Генерируем testnet адреса
        const [
            tonTestnetAddress, solanaTestnetAddress, ethTestnetAddress, 
            bscTestnetAddress, tronTestnetAddress, bitcoinTestnetAddress, 
            nearTestnetAddress, xrpTestnetAddress, ltcTestnetAddress, 
            dogeTestnetAddress
        ] = await Promise.all([
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

        // Создаем testnet кошельки
        const testnetWallets = [];
        
        // TON testnet
        testnetWallets.push(createTestnetWallet('TON', tonTestnetAddress, 'TON'));
        testnetWallets.push(createTestnetWallet('USDT', tonTestnetAddress, 'TON'));
        testnetWallets.push(createTestnetWallet('USDC', tonTestnetAddress, 'TON'));
        
        // Ethereum testnet
        testnetWallets.push(createTestnetWallet('ETH', ethTestnetAddress, 'Ethereum'));
        testnetWallets.push(createTestnetWallet('USDT', ethTestnetAddress, 'Ethereum'));
        testnetWallets.push(createTestnetWallet('USDC', ethTestnetAddress, 'Ethereum'));
        
        // Solana testnet
        testnetWallets.push(createTestnetWallet('SOL', solanaTestnetAddress, 'Solana'));
        testnetWallets.push(createTestnetWallet('USDT', solanaTestnetAddress, 'Solana'));
        testnetWallets.push(createTestnetWallet('USDC', solanaTestnetAddress, 'Solana'));
        
        // BSC testnet
        testnetWallets.push(createTestnetWallet('BNB', bscTestnetAddress, 'BSC'));
        testnetWallets.push(createTestnetWallet('USDT', bscTestnetAddress, 'BSC'));
        testnetWallets.push(createTestnetWallet('USDC', bscTestnetAddress, 'BSC'));
        
        // Tron testnet
        testnetWallets.push(createTestnetWallet('TRX', tronTestnetAddress, 'Tron'));
        testnetWallets.push(createTestnetWallet('USDT', tronTestnetAddress, 'Tron'));
        testnetWallets.push(createTestnetWallet('USDC', tronTestnetAddress, 'Tron'));
        
        // Bitcoin testnet
        testnetWallets.push(createTestnetWallet('BTC', bitcoinTestnetAddress, 'Bitcoin'));
        
        // NEAR testnet
        testnetWallets.push(createTestnetWallet('NEAR', nearTestnetAddress, 'NEAR'));
        testnetWallets.push(createTestnetWallet('USDT', nearTestnetAddress, 'NEAR'));
        testnetWallets.push(createTestnetWallet('USDC', nearTestnetAddress, 'NEAR'));
        
        // XRP testnet
        testnetWallets.push(createTestnetWallet('XRP', xrpTestnetAddress, 'XRP'));
        
        // LTC testnet
        testnetWallets.push(createTestnetWallet('LTC', ltcTestnetAddress, 'LTC'));
        
        // DOGE testnet
        testnetWallets.push(createTestnetWallet('DOGE', dogeTestnetAddress, 'DOGE'));
        
        return testnetWallets;
    } catch (error) {
        console.error('Error generating testnet wallets:', error);
        return [];
    }
};

// Основная функция генерации кошельков
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress, xrpAddress, ltcAddress, dogeAddress] = await Promise.all([
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

        // Создаем кошельки в нужном порядке
        const walletArray = [];
        
        // TON блокчейн
        walletArray.push(createWallet(TOKENS.TON, tonAddress));
        walletArray.push(createWallet(TOKENS.USDT_TON, tonAddress));
        walletArray.push(createWallet(TOKENS.USDC_TON, tonAddress));
        
        // Ethereum блокчейн
        walletArray.push(createWallet(TOKENS.ETH, ethAddress));
        walletArray.push(createWallet(TOKENS.USDT_ETH, ethAddress));
        walletArray.push(createWallet(TOKENS.USDC_ETH, ethAddress));
        
        // Solana блокчейн
        walletArray.push(createWallet(TOKENS.SOL, solanaAddress));
        walletArray.push(createWallet(TOKENS.USDT_SOL, solanaAddress));
        walletArray.push(createWallet(TOKENS.USDC_SOL, solanaAddress));
        
        // BSC блокчейн
        walletArray.push(createWallet(TOKENS.BNB, bscAddress));
        walletArray.push(createWallet(TOKENS.USDT_BSC, bscAddress));
        walletArray.push(createWallet(TOKENS.USDC_BSC, bscAddress));
        
        // Tron блокчейн
        walletArray.push(createWallet(TOKENS.TRX, tronAddress));
        walletArray.push(createWallet(TOKENS.USDT_TRX, tronAddress));
        walletArray.push(createWallet(TOKENS.USDC_TRX, tronAddress));
        
        // Bitcoin блокчейн
        walletArray.push(createWallet(TOKENS.BTC, bitcoinAddress));
        
        // NEAR блокчейн
        walletArray.push(createWallet(TOKENS.NEAR, nearAddress));
        walletArray.push(createWallet(TOKENS.USDT_NEAR, nearAddress));
        walletArray.push(createWallet(TOKENS.USDC_NEAR, nearAddress));
        
        // XRP блокчейн
        walletArray.push(createWallet(TOKENS.XRP, xrpAddress));
        
        // LTC блокчейн
        walletArray.push(createWallet(TOKENS.LTC, ltcAddress));
        
        // DOGE блокчейн
        walletArray.push(createWallet(TOKENS.DOGE, dogeAddress));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// === ФУНКЦИИ ПОЛУЧЕНИЯ БАЛАНСОВ ===
export const getAllTokens = async (userData, includeTestnet = false) => {
    try {
        // Если есть кэшированные кошельки в localStorage, используем их
        if (includeTestnet) {
            const cachedTestnetWallets = localStorage.getItem('cached_testnet_wallets');
            if (cachedTestnetWallets) {
                return JSON.parse(cachedTestnetWallets);
            }
        } else {
            const cachedWallets = localStorage.getItem('cached_wallets');
            if (cachedWallets) {
                return JSON.parse(cachedWallets);
            }
        }

        if (userData?.wallets && Array.isArray(userData.wallets)) {
            if (includeTestnet && userData?.testnet_wallets_list) {
                return [...userData.testnet_wallets_list];
            }
            return userData.wallets;
        }
        
        if (userData?.seed_phrases) {
            const wallets = await generateWalletsFromSeed(userData.seed_phrases);
            
            if (includeTestnet) {
                const testnetWallets = await generateTestnetWalletsFromSeed(userData.seed_phrases);
                // Кэшируем testnet кошельки
                localStorage.setItem('cached_testnet_wallets', JSON.stringify(testnetWallets));
                return testnetWallets;
            }
            
            // Кэшируем mainnet кошельки
            localStorage.setItem('cached_wallets', JSON.stringify(wallets));
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
                    
                    // Если это testnet кошелек, возвращаем нулевой баланс
                    if (wallet.isTestnet) {
                        return { ...wallet, balance: '0' };
                    }
                    
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

// Функции получения балансов MAINNET
const getTonBalance = async (address) => {
    try {
        const response = await fetch(`https://tonapi.io/v2/accounts/${address}`);
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

const getJettonBalance = async (address, jettonAddress) => {
    try {
        const response = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons`);
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
        return (balance / 1e9).toFixed(4);
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

const getTronBalance = async (address) => {
    try {
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`);
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
        const response = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
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
        const response = await fetch(`${MAINNET_CONFIG.BITCOIN.EXPLORER_URL}/address/${address}`);
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

const getXrpBalance = async (address) => {
    try {
        const response = await fetch('https://s1.ripple.com:51234', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "method": "account_info",
                "params": [{
                    "account": address,
                    "strict": true,
                    "ledger_index": "validated",
                    "queue": true
                }]
            })
        });
        
        const data = await response.json();
        
        if (data.result.account_data) {
            const balanceDrops = parseInt(data.result.account_data.Balance);
            return (balanceDrops / 1000000).toFixed(6);
        } else if (data.result.error === 'actNotFound') {
            return '0';
        }
        
        return '0';
    } catch (error) {
        console.error('XRP balance error:', error);
        return '0';
    }
};

const getLtcBalance = async (address) => {
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

const getDogeBalance = async (address) => {
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
        
        // Генерируем testnet кошельки
        const testnetWallets = await generateTestnetWalletsFromSeed(seedPhrase);
        
        const addresses = {};
        const testnetAddresses = {};
        
        mainnetWallets.forEach(wallet => {
            if (!addresses[wallet.blockchain]) {
                addresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'mainnet'
                };
            }
        });
        
        testnetWallets.forEach(wallet => {
            if (!testnetAddresses[wallet.blockchain]) {
                testnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'testnet'
                };
            }
        });

        // Сохраняем оба набора адресов
        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id, 
            addresses,
            testnetAddresses
        );
        
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: addresses,
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
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,ethereum,solana,binancecoin,tron,bitcoin,near-protocol,ripple,litecoin,dogecoin,tether,usd-coin&vs_currencies=usd');
        
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
                'USDC': data['usd-coin']?.usd || 1.00
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
            // Не включаем testnet кошельки в общий баланс
            if (!wallet.isTestnet) {
                const price = prices[wallet.symbol] || 0;
                const balance = parseFloat(wallet.balance || 0);
                totalUSD += balance * price;
            }
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
        localStorage.removeItem('cached_testnet_wallets');
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

// Добавляем недостающую функцию для исправления Netlify ошибки
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
    TOKENS
};