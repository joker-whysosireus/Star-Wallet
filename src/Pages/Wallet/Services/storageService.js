// Services/storageService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import { getUserWallets, getUserSeedPhrase } from './walletService';

// Функция для получения сид-фразы из базы данных
export const getSeedPhrase = async (userData) => {
    try {
        if (!userData || !userData.telegram_user_id) {
            console.error('No user data or telegram_user_id provided');
            return null;
        }

        // Получаем сид-фразу из базы данных через API
        const seedPhrase = await getUserSeedPhrase(userData.telegram_user_id);
        
        if (!seedPhrase) {
            console.error('Seed phrase not found in database');
            return null;
        }

        // Сохраняем в localStorage для локального доступа
        localStorage.setItem('wallet_seed_phrase', seedPhrase);
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
        const seedPhrase = generateMnemonic(128);
        console.log('New seed phrase generated');
        return seedPhrase;
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

// Генерация TON адреса из сид-фразы
const generateTonAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for TON address generation');
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
        throw error;
    }
};

// Генерация Solana адреса из сид-фразы
const generateSolanaAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for Solana address generation');
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
        throw error;
    }
};

// Генерация Ethereum адреса из сид-фразы
const generateEthereumAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for Ethereum address generation');
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
        throw error;
    }
};

// Генерация всех кошельков из сид-фразы
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required and cannot be empty');
        }

        // Генерируем адреса для всех блокчейнов
        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);

        console.log('All addresses generated successfully');
        
        // Создаем кошельки для всех токенов
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
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
                network: 'mainnet'
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
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
                network: 'mainnet'
            }
        ];

        console.log('Wallets generated successfully:', wallets.length);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets from seed:', error);
        throw error;
    }
};

// Получение всех токенов пользователя
export const getAllTokens = async (userData) => {
    try {
        if (!userData || !userData.telegram_user_id) {
            console.error('No user data provided');
            return [];
        }

        // Пробуем получить из localStorage
        const cachedWallets = localStorage.getItem('user_wallets');
        if (cachedWallets) {
            return JSON.parse(cachedWallets);
        }

        // Если нет в localStorage, получаем из базы данных
        const wallets = await getUserWallets(userData.telegram_user_id);
        
        if (wallets && wallets.length > 0) {
            return wallets;
        }

        // Если кошельков нет, создаем новые из сид-фразы
        const seedPhrase = await getSeedPhrase(userData);
        if (seedPhrase) {
            return await generateWalletsFromSeed(seedPhrase);
        }

        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

// Генерация кошельков (для обратной совместимости)
export const generateWallets = async (userData) => {
    try {
        if (!userData || !userData.telegram_user_id) {
            throw new Error('User data is required');
        }

        const seedPhrase = await getSeedPhrase(userData);
        if (!seedPhrase) {
            throw new Error('No seed phrase found');
        }

        const wallets = await generateWalletsFromSeed(seedPhrase);
        return { wallets, seedPhrase };
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Получение балансов кошельков
export const getBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('getBalances: wallets is not an array');
            return wallets || [];
        }
        
        const updatedWallets = [...wallets];
        
        // Получаем балансы для TON кошельков
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'TON')) {
            if (wallet.symbol === 'TON') {
                try {
                    const { getTonBalance } = await import('./tonService');
                    const balance = await getTonBalance(wallet.address);
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting TON balance:', error);
                }
            }
        }
        
        // Получаем балансы для Solana кошельков
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'Solana')) {
            if (wallet.symbol === 'SOL') {
                try {
                    const { getSolBalance } = await import('./solanaService');
                    const balance = await getSolBalance(wallet.address);
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting SOL balance:', error);
                }
            }
        }
        
        // Получаем балансы для Ethereum кошельков
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'Ethereum')) {
            if (wallet.symbol === 'ETH') {
                try {
                    const { getEthBalance } = await import('./ethereumService');
                    const balance = await getEthBalance(wallet.address);
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting ETH balance:', error);
                }
            }
        }
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting balances:', error);
        return wallets;
    }
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
        
        // Fallback цены
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

// Расчет общего баланса
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
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        network: 'mainnet'
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
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
        network: 'mainnet'
    }
};

export default {
    getSeedPhrase,
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    generateWallets,
    getAllTokens,
    getBalances,
    getTokenPrices,
    calculateTotalBalance,
    TOKENS
};