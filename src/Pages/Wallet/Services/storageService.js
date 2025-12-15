import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

// Ключ для localStorage
const SEED_PHRASE_KEY = 'wallet_seed_phrase';

// Базовые URL для функций Netlify
const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

// API функции
export const saveWalletToAPI = async (telegramUserId, walletData) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                ...walletData
            }),
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving wallet to API:', error);
        throw error;
    }
};

export const getWalletFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-wallet?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting wallet from API:', error);
        throw error;
    }
};

export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-seed`, {
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
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving seed phrase to API:', error);
        throw error;
    }
};

export const getSeedPhraseFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-seed?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting seed phrase from API:', error);
        throw error;
    }
};

export const saveAddressesToAPI = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-addresses`, {
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
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving addresses to API:', error);
        throw error;
    }
};

export const getAddressesFromAPI = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-addresses?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting addresses from API:', error);
        throw error;
    }
};

// Локальные функции
export const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem(SEED_PHRASE_KEY);
        if (!seedPhrase) {
            console.log('No seed phrase found');
            return null;
        }
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        return null;
    }
};

export const generateNewSeedPhrase = async () => {
    try {
        const { generateMnemonic } = await import('bip39');
        const seedPhrase = generateMnemonic(128);
        console.log('New seed phrase generated');
        return seedPhrase;
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

export const saveSeedPhrase = (seedPhrase) => {
    try {
        localStorage.setItem(SEED_PHRASE_KEY, seedPhrase);
        console.log('Seed phrase saved locally');
        return true;
    } catch (error) {
        console.error('Error saving seed phrase:', error);
        return false;
    }
};

// Генерация адресов
const generateTonAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for TON address generation');
            return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
        }
        
        console.log('Generating TON address from seed...');
        const tonKeyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const tonWallet = WalletContractV4.create({
            publicKey: tonKeyPair.publicKey,
            workchain: 0
        });
        const address = tonWallet.address.toString();
        console.log('TON address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating TON address:', error);
        return 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
    }
};

const generateSolanaAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Solana address generation');
            return 'So11111111111111111111111111111111111111112';
        }
        
        console.log('Generating Solana address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const solanaSeed = new Uint8Array(seedBuffer.slice(0, 32));
        const solanaKeypair = Keypair.fromSeed(solanaSeed);
        const address = solanaKeypair.publicKey.toBase58();
        console.log('Solana address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return 'So11111111111111111111111111111111111111112';
    }
};

const generateEthereumAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Ethereum address generation');
            return '0x0000000000000000000000000000000000000000';
        }
        
        console.log('Generating Ethereum address from seed...');
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const ethWallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const address = ethWallet.address;
        console.log('Ethereum address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

// Генерация Tron адреса из сид-фразы
const generateTronAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Tron address generation');
            return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
        }
        
        console.log('Generating Tron address from seed...');
        
        // Динамический импорт TronWeb
        const TronWeb = (await import('tronweb')).default;
        
        // Используем bip39 для создания seed из мнемонической фразы
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Используем ethers.js для создания кошелька из seed
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем путь BIP44 для Tron: m/44'/195'/0'/0/0
        const tronWallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = tronWallet.privateKey.slice(2); // Убираем '0x'
        
        // Создаем адрес Tron из приватного ключа
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            privateKey: privateKey
        });
        
        const address = tronWeb.address.fromPrivateKey(privateKey);
        console.log('Tron address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    }
};

// Генерация Bitcoin адреса из сид-фразы
const generateBitcoinAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Bitcoin address generation');
            return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        }
        
        console.log('Generating Bitcoin address from seed...');
        
        // Используем BIP39 для создания seed из мнемонической фразы
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Используем bip32 для создания кошелька Bitcoin
        const { BIP32Factory } = await import('bip32');
        const ecc = await import('elliptic').then(elliptic => elliptic.ec);
        const bip32 = BIP32Factory(ecc);
        
        // Создаем корневой ключ из seed
        const root = bip32.fromSeed(seedBuffer);
        
        // Используем путь BIP84 для SegWit (начинаются с bc1)
        // m/84'/0'/0'/0/0 - стандартный путь для Bitcoin SegWit
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        // Динамический импорт bitcoinjs-lib
        const { payments, networks } = await import('bitcoinjs-lib');
        
        const { address } = payments.p2wpkh({
            pubkey: child.publicKey,
            network: networks.bitcoin
        });
        
        console.log('Bitcoin address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// Генерация NEAR адреса из сид-фразы
const generateNearAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for NEAR address generation');
            return 'nearwallet.testnet';
        }
        
        console.log('Generating NEAR address from seed...');
        
        // Используем BIP39 для создания seed из мнемонической фразы
        const bip39 = await import('bip39');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Используем ethers.js для создания кошелька из seed
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем путь BIP44 для NEAR: m/44'/397'/0'/0'/0'
        const nearWallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = nearWallet.privateKey.slice(2);
        
        // Создаем NEAR аккаунт из приватного ключа
        const accountSuffix = privateKey.substring(0, 10);
        const accountId = `near_${accountSuffix}.testnet`;
        
        console.log('NEAR account generated:', accountId);
        return accountId;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return 'nearwallet.testnet';
    }
};

// Генерация всех кошельков
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required');
        }

        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);
        const tronAddress = await generateTronAddress(seedPhrase);
        const bitcoinAddress = await generateBitcoinAddress(seedPhrase);
        const nearAddress = await generateNearAddress(seedPhrase);

        console.log('All addresses generated');
        
        const wallets = [
            {
                id: 'ton',
                name: 'Toncoin',
                symbol: 'TON',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
            },
            {
                id: 'usdt_ton',
                name: 'Tether',
                symbol: 'USDT',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_ton',
                name: 'USD Coin',
                symbol: 'USDC',
                address: tonAddress,
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'sol',
                name: 'Solana',
                symbol: 'SOL',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
            },
            {
                id: 'usdt_sol',
                name: 'Tether',
                symbol: 'USDT',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_sol',
                name: 'USD Coin',
                symbol: 'USDC',
                address: solanaAddress,
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'eth',
                name: 'Ethereum',
                symbol: 'ETH',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 18,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            },
            {
                id: 'usdt_eth',
                name: 'Tether',
                symbol: 'USDT',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_eth',
                name: 'USD Coin',
                symbol: 'USDC',
                address: ethAddress,
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'trx',
                name: 'TRON',
                symbol: 'TRX',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tron-trx-logo.png'
            },
            {
                id: 'usdt_trx',
                name: 'Tether',
                symbol: 'USDT',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: false,
                contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_trx',
                name: 'USD Coin',
                symbol: 'USDC',
                address: tronAddress,
                blockchain: 'Tron',
                decimals: 6,
                isNative: false,
                contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            {
                id: 'btc',
                name: 'Bitcoin',
                symbol: 'BTC',
                address: bitcoinAddress,
                blockchain: 'Bitcoin',
                decimals: 8,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
            },
            {
                id: 'near',
                name: 'NEAR Protocol',
                symbol: 'NEAR',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 24,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png'
            },
            {
                id: 'usdt_near',
                name: 'Tether',
                symbol: 'USDT',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 6,
                isNative: false,
                contractAddress: 'usdt.near',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_near',
                name: 'USD Coin',
                symbol: 'USDC',
                address: nearAddress,
                blockchain: 'NEAR',
                decimals: 6,
                isNative: false,
                contractAddress: 'usdc.near',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            }
        ];

        localStorage.setItem('wallets', JSON.stringify(wallets));
        localStorage.setItem('wallets_generated', 'true');
        
        console.log('Wallets generated:', wallets.length);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

export const getAllTokens = () => {
    try {
        const cachedWallets = localStorage.getItem('wallets');
        if (cachedWallets) {
            const wallets = JSON.parse(cachedWallets);
            if (Array.isArray(wallets)) {
                return wallets;
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

export const getBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('getBalances: wallets is not an array');
            return [];
        }
        
        const updatedWallets = [...wallets];
        
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'TON')) {
            if (wallet.symbol === 'TON') {
                try {
                    const { getTonBalance } = await import('./tonService');
                    const balance = await getTonBalance();
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting TON balance:', error);
                }
            }
        }
        
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'Solana')) {
            if (wallet.symbol === 'SOL') {
                try {
                    const { getSolBalance } = await import('./solanaService');
                    const balance = await getSolBalance();
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting SOL balance:', error);
                }
            }
        }
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting balances:', error);
        return wallets;
    }
};

export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum,tron,bitcoin,near-protocol&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data['solana']?.usd || 172.34,
                'ETH': data['ethereum']?.usd || 3500.00,
                'USDT': 1.00,
                'USDC': 1.00,
                'TRX': data['tron']?.usd || 0.12,
                'BTC': data['bitcoin']?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50
            };
        }
        
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
        console.error('Error getting token prices:', error);
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

export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('calculateTotalBalance: wallets is not an array');
            return '0.00';
        }
        
        const prices = await getTokenPrices();
        let total = 0;
        
        for (const wallet of wallets) {
            const price = prices[wallet.symbol] || 0;
            total += parseFloat(wallet.balance || 0) * price;
        }
        
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

export const generateWallets = async (existingSeedPhrase = null) => {
    try {
        let seedPhrase = existingSeedPhrase;
        if (!seedPhrase) {
            seedPhrase = getSeedPhrase();
        }
        
        if (!seedPhrase) {
            throw new Error('Invalid seed phrase');
        }

        const wallets = await generateWalletsFromSeed(seedPhrase);
        return { wallets, seedPhrase };
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

export const clearWallets = () => {
    try {
        localStorage.removeItem(SEED_PHRASE_KEY);
        localStorage.removeItem('wallets');
        localStorage.removeItem('wallets_generated');
        console.log('Wallets cleared');
        return true;
    } catch (error) {
        console.error('Error clearing wallets:', error);
        return false;
    }
};

export const revealSeedPhrase = async () => {
    const seedPhrase = getSeedPhrase();
    if (!seedPhrase) {
        throw new Error('Seed phrase not found');
    }
    return seedPhrase;
};

export const TOKENS = {
    TON: {
        id: 'ton',
        name: 'Toncoin',
        symbol: 'TON',
        blockchain: 'TON',
        decimals: 9,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
    },
    USDT_TON: {
        id: 'usdt_ton',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'TON',
        decimals: 6,
        isNative: false,
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_TON: {
        id: 'usdc_ton',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'TON',
        decimals: 6,
        isNative: false,
        contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    SOL: {
        id: 'sol',
        name: 'Solana',
        symbol: 'SOL',
        blockchain: 'Solana',
        decimals: 9,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
    },
    USDT_SOL: {
        id: 'usdt_sol',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Solana',
        decimals: 6,
        isNative: false,
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_SOL: {
        id: 'usdc_sol',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Solana',
        decimals: 6,
        isNative: false,
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    ETH: {
        id: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        blockchain: 'Ethereum',
        decimals: 18,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
    },
    USDT_ETH: {
        id: 'usdt_eth',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Ethereum',
        decimals: 6,
        isNative: false,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_ETH: {
        id: 'usdc_eth',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Ethereum',
        decimals: 6,
        isNative: false,
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    TRX: {
        id: 'trx',
        name: 'TRON',
        symbol: 'TRX',
        blockchain: 'Tron',
        decimals: 6,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png'
    },
    USDT_TRX: {
        id: 'usdt_trx',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'Tron',
        decimals: 6,
        isNative: false,
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_TRX: {
        id: 'usdc_trx',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'Tron',
        decimals: 6,
        isNative: false,
        contractAddress: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    },
    BTC: {
        id: 'btc',
        name: 'Bitcoin',
        symbol: 'BTC',
        blockchain: 'Bitcoin',
        decimals: 8,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
    },
    NEAR: {
        id: 'near',
        name: 'NEAR Protocol',
        symbol: 'NEAR',
        blockchain: 'NEAR',
        decimals: 24,
        isNative: true,
        contractAddress: '',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png'
    },
    USDT_NEAR: {
        id: 'usdt_near',
        name: 'Tether',
        symbol: 'USDT',
        blockchain: 'NEAR',
        decimals: 6,
        isNative: false,
        contractAddress: 'usdt.near',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
    },
    USDC_NEAR: {
        id: 'usdc_near',
        name: 'USD Coin',
        symbol: 'USDC',
        blockchain: 'NEAR',
        decimals: 6,
        isNative: false,
        contractAddress: 'usdc.near',
        showBlockchain: true,
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
    }
};

export default {
    generateNewSeedPhrase,
    saveSeedPhrase,
    getSeedPhrase,
    generateWalletsFromSeed,
    generateWallets,
    getAllTokens,
    getBalances,
    revealSeedPhrase,
    getTokenPrices,
    calculateTotalBalance,
    clearWallets,
    TOKENS,
    // API функции
    saveWalletToAPI,
    getWalletFromAPI,
    saveSeedPhraseToAPI,
    getSeedPhraseFromAPI,
    saveAddressesToAPI,
    getAddressesFromAPI
};