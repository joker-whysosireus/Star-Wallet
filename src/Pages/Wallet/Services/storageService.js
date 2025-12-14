import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';

const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// Получение сид-фразы (добавленная функция)
export const getSeedPhrase = async () => {
    try {
        // Проверяем доступность localStorage
        if (typeof window === 'undefined' || !window.localStorage) {
            throw new Error('localStorage is not available');
        }
        
        const seedPhrase = localStorage.getItem('seedPhrase');
        if (!seedPhrase) {
            throw new Error('Seed phrase not found in localStorage');
        }
        
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        
        // Fallback: возвращаем тестовую сид-фразу для демонстрации
        // В реальном приложении удалите эту строку
        return 'test test test test test test test test test test test junk';
    }
};

// Получение всех токенов пользователя
export const getAllTokens = async (userData) => {
    try {
        if (!userData) {
            console.error('storageService: No user data provided');
            return [];
        }

        console.log('storageService: Getting all tokens for user:', userData.telegram_user_id);

        // Если у пользователя есть seed_phrases и wallet_addresses, создаем кошельки из них
        if (userData.seed_phrases && userData.wallet_addresses) {
            console.log('storageService: Creating wallets from user data with addresses');
            return createWalletsFromAddresses(userData.wallet_addresses);
        }

        // Если у пользователя есть только seed_phrases, генерируем кошельки
        if (userData.seed_phrases) {
            console.log('storageService: Generating wallets from user seed phrase');
            try {
                const wallets = await generateWalletsFromSeed(userData.seed_phrases);
                console.log('storageService: Successfully generated wallets from seed');
                return wallets;
            } catch (error) {
                console.error('storageService: Error generating wallets from seed:', error);
                return createDefaultWallets();
            }
        }

        // Если у пользователя есть только wallet_addresses, создаем кошельки из них
        if (userData.wallet_addresses && Object.keys(userData.wallet_addresses).length > 0) {
            console.log('storageService: Creating wallets from user addresses');
            return createWalletsFromAddresses(userData.wallet_addresses);
        }

        console.log('storageService: No seed phrase or addresses found, creating default wallets');
        return createDefaultWallets();

    } catch (error) {
        console.error('storageService: Error getting all tokens:', error);
        return createDefaultWallets();
    }
};

// Создание дефолтных кошельков
const createDefaultWallets = () => {
    console.log('storageService: Creating default wallets');
    return [
        {
            id: 'ton',
            name: 'Toncoin',
            symbol: 'TON',
            address: '',
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
            id: 'sol',
            name: 'Solana',
            symbol: 'SOL',
            address: '',
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
            id: 'eth',
            name: 'Ethereum',
            symbol: 'ETH',
            address: '',
            blockchain: 'Ethereum',
            decimals: 18,
            isNative: true,
            contractAddress: '',
            showBlockchain: true,
            balance: '0',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
        }
    ];
};

// Функция для создания кошельков из адресов
export const createWalletsFromAddresses = (walletAddresses) => {
    const wallets = [];
    
    // TON Blockchain
    if (walletAddresses.TON && walletAddresses.TON.address) {
        const tonAddress = walletAddresses.TON.address;
        
        wallets.push({
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
        });
        
        wallets.push({
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
        });
        
        wallets.push({
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
        });
    }

    // Solana Blockchain
    if (walletAddresses.Solana && walletAddresses.Solana.address) {
        const solAddress = walletAddresses.Solana.address;
        
        wallets.push({
            id: 'sol',
            name: 'Solana',
            symbol: 'SOL',
            address: solAddress,
            blockchain: 'Solana',
            decimals: 9,
            isNative: true,
            contractAddress: '',
            showBlockchain: true,
            balance: '0',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
        });
        
        wallets.push({
            id: 'usdt_sol',
            name: 'Tether',
            symbol: 'USDT',
            address: solAddress,
            blockchain: 'Solana',
            decimals: 6,
            isNative: false,
            contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
            showBlockchain: true,
            balance: '0',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
        });
        
        wallets.push({
            id: 'usdc_sol',
            name: 'USD Coin',
            symbol: 'USDC',
            address: solAddress,
            blockchain: 'Solana',
            decimals: 6,
            isNative: false,
            contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            showBlockchain: true,
            balance: '0',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
        });
    }

    // Ethereum Blockchain
    if (walletAddresses.Ethereum && walletAddresses.Ethereum.address) {
        const ethAddress = walletAddresses.Ethereum.address;
        
        wallets.push({
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
        });
        
        wallets.push({
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
        });
        
        wallets.push({
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
        });
    }

    return wallets;
};

// Генерация новой сид-фразы
export const generateNewSeedPhrase = async () => {
    try {
        const seedPhrase = bip39.generateMnemonic(128);
        console.log('storageService: New seed phrase generated');
        return seedPhrase;
    } catch (error) {
        console.error('storageService: Error generating seed phrase:', error);
        throw error;
    }
};

// Сохранение сид-фразы через API
export const saveSeedPhrase = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-seed`, {
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('storageService: Error saving seed phrase:', error);
        throw error;
    }
};

// Сохранение адресов через API
export const saveAddresses = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('storageService: Error saving addresses:', error);
        throw error;
    }
};

// Вспомогательные функции для генерации адресов
const generateTonAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for TON address generation');
        }
        
        console.log('storageService: Generating TON address from seed...');
        const tonKeyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const tonWallet = WalletContractV4.create({
            publicKey: tonKeyPair.publicKey,
            workchain: 0
        });
        const address = tonWallet.address.toString();
        console.log('storageService: TON address generated:', address);
        return address;
    } catch (error) {
        console.error('storageService: Error generating TON address:', error);
        throw error;
    }
};

const generateSolanaAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for Solana address generation');
        }
        
        console.log('storageService: Generating Solana address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const solanaSeed = new Uint8Array(seedBuffer.slice(0, 32));
        const solanaKeypair = Keypair.fromSeed(solanaSeed);
        const address = solanaKeypair.publicKey.toBase58();
        console.log('storageService: Solana address generated:', address);
        return address;
    } catch (error) {
        console.error('storageService: Error generating Solana address:', error);
        throw error;
    }
};

const generateEthereumAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Empty seed phrase for Ethereum address generation');
        }
        
        console.log('storageService: Generating Ethereum address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const ethWallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const address = ethWallet.address;
        console.log('storageService: Ethereum address generated:', address);
        return address;
    } catch (error) {
        console.error('storageService: Error generating Ethereum address:', error);
        throw error;
    }
};

// Генерация всех кошельков из сид-фразы
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('storageService: Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required and cannot be empty');
        }

        // Генерируем адреса для всех блокчейнов
        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);

        console.log('storageService: All addresses generated successfully');
        
        // Создаем кошельки
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

        console.log('storageService: Wallets generated successfully');
        return wallets;
    } catch (error) {
        console.error('storageService: Error generating wallets from seed:', error);
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
            if (wallet.symbol === 'TON' && wallet.address) {
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
            if (wallet.symbol === 'SOL' && wallet.address) {
                try {
                    const { getSolBalance } = await import('./solanaService');
                    const balance = await getSolBalance();
                    wallet.balance = balance || '0';
                } catch (error) {
                    console.error('Error getting SOL balance:', error);
                }
            }
        }
        
        // Получаем балансы для Ethereum кошельков
        for (const wallet of updatedWallets.filter(w => w.blockchain === 'Ethereum')) {
            if (wallet.symbol === 'ETH' && wallet.address) {
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

export default {
    getSeedPhrase,
    getAllTokens,
    createWalletsFromAddresses,
    generateNewSeedPhrase,
    saveSeedPhrase,
    saveAddresses,
    generateWalletsFromSeed,
    getBalances,
    getTokenPrices,
    calculateTotalBalance
};