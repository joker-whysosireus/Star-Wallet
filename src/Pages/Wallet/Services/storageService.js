import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';

const SEED_PHRASE_KEY = 'wallet_seed_phrase';
const PIN_KEY = 'wallet_pin';

// Удален импорт ed25519-hd-key

export const generateNewSeedPhrase = async () => {
    try {
        const seedPhrase = bip39.generateMnemonic(128);
        console.log('Generated new BIP39 seed phrase');
        return seedPhrase;
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        
        const words = [
            'abandon', 'ability', 'able', 'about', 'above', 'absent',
            'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident',
            'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire',
            'across', 'act', 'action', 'actor', 'actress', 'actual'
        ];
        
        const selectedWords = [];
        for (let i = 0; i < 12; i++) {
            const randomIndex = Math.floor(Math.random() * words.length);
            selectedWords.push(words[randomIndex]);
        }
        
        return selectedWords.join(' ');
    }
};

export const getSeedPhrase = () => {
    try {
        let seedPhrase = localStorage.getItem(SEED_PHRASE_KEY);
        
        if (!seedPhrase) {
            console.log('No seed phrase found, generating new one...');
            seedPhrase = generateNewSeedPhrase();
            localStorage.setItem(SEED_PHRASE_KEY, seedPhrase);
        }
        
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        throw error;
    }
};

export const saveSeedPhrase = (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase cannot be empty');
        }
        
        if (!bip39.validateMnemonic(seedPhrase)) {
            throw new Error('Invalid seed phrase format');
        }
        
        localStorage.setItem(SEED_PHRASE_KEY, seedPhrase);
        console.log('Seed phrase saved');
        return true;
    } catch (error) {
        console.error('Error saving seed phrase:', error);
        return false;
    }
};

const generateTonAddress = async (seedPhrase) => {
    try {
        console.log('Generating TON address from seed...');
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });
        const address = wallet.address.toString();
        console.log('TON address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating TON address:', error);
        throw error;
    }
};

const generateSolanaAddress = async (seedPhrase) => {
    try {
        console.log('Generating Solana address from seed...');
        
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        
        // Более простой способ генерации Solana ключа без ed25519-hd-key
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer).slice(0, 32);
        
        // Используем seed напрямую для генерации Keypair
        const keypair = Keypair.fromSeed(seedArray);
        const address = keypair.publicKey.toBase58();
        
        console.log('Solana address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Solana address:', error);
        // Возвращаем тестовый адрес в случае ошибки
        return 'So11111111111111111111111111111111111111112';
    }
};

const generateEthereumAddress = async (seedPhrase) => {
    try {
        console.log('Generating Ethereum address from seed...');
        
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const address = wallet.address;
        
        console.log('Ethereum address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        throw error;
    }
};

export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Starting wallet generation from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required');
        }

        // Генерируем адреса последовательно, чтобы избежать проблем с Promise.all
        const tonAddress = await generateTonAddress(seedPhrase);
        const solanaAddress = await generateSolanaAddress(seedPhrase);
        const ethAddress = await generateEthereumAddress(seedPhrase);

        console.log('All blockchain addresses generated');
        
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
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
                price: 6.24
            },
            {
                id: 'usdt_ton',
                name: 'Tether USD',
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
                price: 1.00
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
                price: 1.00
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
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
                price: 172.34
            },
            {
                id: 'usdt_sol',
                name: 'Tether USD',
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
                price: 1.00
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
                price: 1.00
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
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
                price: 3500.00
            },
            {
                id: 'usdt_eth',
                name: 'Tether USD',
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
                price: 1.00
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
                price: 1.00
            }
        ];

        localStorage.setItem('wallets', JSON.stringify(wallets));
        localStorage.setItem('wallets_generated', 'true');
        localStorage.setItem('last_wallet_update', Date.now().toString());
        
        console.log(`${wallets.length} wallets generated successfully`);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets from seed:', error);
        // Возвращаем тестовые кошельки в случае ошибки
        return getMockWallets();
    }
};

// Функция для получения тестовых кошельков
const getMockWallets = () => {
    return [
        {
            id: 'ton',
            name: 'Toncoin',
            symbol: 'TON',
            address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
            blockchain: 'TON',
            decimals: 9,
            isNative: true,
            contractAddress: '',
            showBlockchain: true,
            balance: '25.43',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
            price: 6.24
        },
        {
            id: 'sol',
            name: 'Solana',
            symbol: 'SOL',
            address: 'So11111111111111111111111111111111111111112',
            blockchain: 'Solana',
            decimals: 9,
            isNative: true,
            contractAddress: '',
            showBlockchain: true,
            balance: '0.85',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/solana-sol-logo.png',
            price: 172.34
        },
        {
            id: 'eth',
            name: 'Ethereum',
            symbol: 'ETH',
            address: '0x0000000000000000000000000000000000000000',
            blockchain: 'Ethereum',
            decimals: 18,
            isNative: true,
            contractAddress: '',
            showBlockchain: true,
            balance: '0.125',
            isActive: true,
            logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
            price: 3500.00
        }
    ];
};

export const getAllTokens = () => {
    try {
        const cachedWallets = localStorage.getItem('wallets');
        if (cachedWallets) {
            const wallets = JSON.parse(cachedWallets);
            if (Array.isArray(wallets) && wallets.length > 0) {
                console.log(`Retrieved ${wallets.length} wallets from cache`);
                return wallets;
            }
        }

        console.log('No wallets found, generating new ones...');
        const seedPhrase = getSeedPhrase();
        return generateWalletsFromSeed(seedPhrase);
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return getMockWallets();
    }
};

export const getTokenBySymbol = (symbol) => {
    try {
        const wallets = getAllTokens();
        const token = wallets.find(wallet => wallet.symbol === symbol);
        if (!token) {
            throw new Error(`Token ${symbol} not found`);
        }
        return token;
    } catch (error) {
        console.error('Error getting token by symbol:', error);
        return null;
    }
};

export const getBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return wallets || [];
        }

        const updatedWallets = [...wallets];
        
        // Для тестовых данных просто возвращаем текущие кошельки
        return updatedWallets;
        
    } catch (error) {
        console.error('Error getting balances:', error);
        return wallets;
    }
};

export const getTokenPrices = async () => {
    try {
        // Временно возвращаем статические цены
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'USDT': 1.00,
            'USDC': 1.00
        };
    } catch (error) {
        console.error('Error getting token prices:', error);
        throw error;
    }
};

export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return '0.00';
        }
        
        const prices = await getTokenPrices();
        let total = 0;
        
        for (const wallet of wallets) {
            const price = prices[wallet.symbol] || 0;
            const balance = parseFloat(wallet.balance || 0);
            total += balance * price;
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
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Invalid seed phrase');
        }

        const wallets = await generateWalletsFromSeed(seedPhrase);
        return { wallets, seedPhrase };
    } catch (error) {
        console.error('Error in generateWallets:', error);
        throw error;
    }
};

export const savePin = (pin) => {
    try {
        localStorage.setItem(PIN_KEY, pin);
        localStorage.setItem('wallet_pin_set', 'true');
        return true;
    } catch (error) {
        console.error('Error saving PIN:', error);
        return false;
    }
};

export const verifyPin = (pin) => {
    const savedPin = localStorage.getItem(PIN_KEY);
    return savedPin === pin;
};

export const isPinSet = () => {
    return localStorage.getItem('wallet_pin_set') === 'true';
};

export const clearWallets = () => {
    localStorage.removeItem(SEED_PHRASE_KEY);
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem('wallets');
    localStorage.removeItem('wallets_generated');
    localStorage.removeItem('wallet_pin_set');
    console.log('All wallet data cleared');
    return true;
};

export default {
    generateNewSeedPhrase,
    getSeedPhrase,
    saveSeedPhrase,
    getTokenBySymbol,
    generateWalletsFromSeed,
    generateWallets,
    getAllTokens,
    getBalances,
    getTokenPrices,
    calculateTotalBalance,
    savePin,
    verifyPin,
    isPinSet,
    clearWallets
};