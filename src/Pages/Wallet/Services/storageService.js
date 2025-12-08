// src/Pages/Wallet/Services/storageService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

// Ключи для localStorage
const SEED_PHRASE_KEY = 'wallet_seed_phrase';
const PIN_KEY = 'wallet_pin';

// Получение сид-фразы из localStorage
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

// Генерация новой сид-фразы
export const generateNewSeedPhrase = async () => {
    try {
        const { generateMnemonic } = await import('bip39');
        const seedPhrase = generateMnemonic(128); // 12 слов
        console.log('New seed phrase generated');
        return seedPhrase;
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

// Сохранение сид-фразы в localStorage
export const saveSeedPhrase = (seedPhrase) => {
    try {
        localStorage.setItem(SEED_PHRASE_KEY, seedPhrase);
        console.log('Seed phrase saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving seed phrase:', error);
        return false;
    }
};

// Сохранение PIN
export const savePin = (pin) => {
    try {
        localStorage.setItem(PIN_KEY, pin);
        localStorage.setItem('wallet_pin_set', 'true');
        console.log('PIN saved successfully');
        return true;
    } catch (error) {
        console.error('Error saving PIN:', error);
        return false;
    }
};

// Проверка PIN
export const verifyPin = (pin) => {
    try {
        const savedPin = localStorage.getItem(PIN_KEY);
        return savedPin === pin;
    } catch (error) {
        console.error('Error verifying PIN:', error);
        return false;
    }
};

// Проверка установлен ли PIN
export const isPinSet = () => {
    return localStorage.getItem('wallet_pin_set') === 'true';
};

// Генерация TON адреса из сид-фразы
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

// Генерация Solana адреса из сид-фразы
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

// Генерация Ethereum адреса из сид-фразы
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

// Генерация всех кошельков из сид-фразы
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required and cannot be empty');
        }

        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);

        console.log('All addresses generated successfully');
        
        // Создаем кошельки для всех токенов (TRX удален)
        const wallets = [
            // TON Blockchain
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

            // Solana Blockchain
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

            // Ethereum Blockchain
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
            }
        ];

        localStorage.setItem('wallets', JSON.stringify(wallets));
        localStorage.setItem('wallets_generated', 'true');
        
        console.log('Wallets generated successfully:', wallets.length);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets from seed:', error);
        throw error;
    }
};

// Получение всех токенов
export const getAllTokens = () => {
    try {
        const cachedWallets = localStorage.getItem('wallets');
        if (cachedWallets) {
            const wallets = JSON.parse(cachedWallets);
            if (Array.isArray(wallets)) {
                return wallets;
            }
        }
        
        const seedPhrase = getSeedPhrase();
        if (seedPhrase) {
            console.log('No cached wallets, returning empty array');
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

// Получение всех кошельков
export const getAllWallets = () => {
    return getAllTokens();
};

// Получение балансов
export const getBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('getBalances: wallets is not an array:', wallets);
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
                    console.error(`Error getting TON balance:`, error);
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
                    console.error(`Error getting SOL balance:`, error);
                }
            }
        }
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting balances:', error);
        return wallets;
    }
};

// Показать сид-фразу
export const revealSeedPhrase = async () => {
    const seedPhrase = getSeedPhrase();
    if (!seedPhrase) {
        throw new Error('Seed phrase not found. Please create a new wallet.');
    }
    return seedPhrase;
};

// Получение цен токенов
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data['solana']?.usd || 172.34,
                'ETH': data['ethereum']?.usd || 3500.00,
                'USDT': 1.00,
                'USDC': 1.00
            };
        }
        
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00
        };
    } catch (error) {
        console.error('Error getting token prices:', error);
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00
        };
    }
};

// Инициализация кошелька
export const initializeWallet = async () => {
    try {
        let seedPhrase = getSeedPhrase();
        
        if (!seedPhrase) {
            seedPhrase = await generateNewSeedPhrase();
            saveSeedPhrase(seedPhrase);
            
            await generateWalletsFromSeed(seedPhrase);
        } else {
            const walletsGenerated = localStorage.getItem('wallets_generated');
            if (walletsGenerated !== 'true') {
                await generateWalletsFromSeed(seedPhrase);
            }
        }
        
        const wallets = getAllTokens();
        
        return {
            success: true,
            seedPhrase,
            wallets
        };
    } catch (error) {
        console.error('Error initializing wallet:', error);
        throw error;
    }
};

// Расчет общего баланса в USD
export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('calculateTotalBalance: wallets is not an array:', wallets);
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

// Очистка кошельков
export const clearWallets = () => {
    try {
        localStorage.removeItem(SEED_PHRASE_KEY);
        localStorage.removeItem(PIN_KEY);
        localStorage.removeItem('wallets');
        localStorage.removeItem('wallets_generated');
        localStorage.removeItem('wallet_pin_set');
        console.log('Wallets cleared successfully');
        return true;
    } catch (error) {
        console.error('Error clearing wallets:', error);
        return false;
    }
};

// Генерация кошельков
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

// Инициализация кошельков
export const initializeWallets = async () => {
    try {
        const seedPhrase = getSeedPhrase();
        if (!seedPhrase) {
            console.log('No seed phrase found, wallets not initialized');
            return false;
        }

        const walletsGenerated = localStorage.getItem('wallets_generated');
        if (walletsGenerated === 'true') {
            console.log('Wallets already generated');
            return true;
        }

        await generateWalletsFromSeed(seedPhrase);
        return true;
    } catch (error) {
        console.error('Error initializing wallets:', error);
        return false;
    }
};

// Статический объект токенов
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
    }
};

export default {
    generateNewSeedPhrase,
    saveSeedPhrase,
    getSeedPhrase,
    savePin,
    verifyPin,
    isPinSet,
    generateWalletsFromSeed,
    generateWallets,
    getAllWallets,
    getAllTokens,
    getBalances,
    revealSeedPhrase,
    getTokenPrices,
    initializeWallet,
    calculateTotalBalance,
    clearWallets,
    initializeWallets,
    TOKENS
};