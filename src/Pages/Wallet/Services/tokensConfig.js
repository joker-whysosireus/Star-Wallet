// src/Pages/Wallet/Services/tokensConfig.js

import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';

// Ключи для localStorage
const SEED_PHRASE_KEY = 'wallet_seed_phrase';

// Функция для получения сид-фразы
const getSeedPhrase = () => {
    try {
        const seed = localStorage.getItem(SEED_PHRASE_KEY);
        return seed;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        return null;
    }
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

        // Сохраняем в localStorage
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
export const getAllTokens = async () => {
    try {
        // Проверяем localStorage
        const cachedWallets = localStorage.getItem('wallets');
        if (cachedWallets) {
            return JSON.parse(cachedWallets);
        }

        // Если нет кошельков, генерируем из сид-фразы
        const seedPhrase = getSeedPhrase();
        if (seedPhrase) {
            console.log('Generating wallets from existing seed phrase...');
            return await generateWalletsFromSeed(seedPhrase);
        }

        throw new Error('No seed phrase found. Please create a wallet first.');
    } catch (error) {
        console.error('Error getting all tokens:', error);
        throw error;
    }
};

// Получение токенов по блокчейну
export const getTokensByBlockchain = async (blockchain) => {
    const allTokens = await getAllTokens();
    return allTokens.filter(token => token.blockchain === blockchain);
};

// Получение токена по ID
export const getTokenById = async (id) => {
    const allTokens = await getAllTokens();
    return allTokens.find(token => token.id === id);
};

// Получение токена по символу
export const getTokenBySymbol = async (symbol) => {
    const allTokens = await getAllTokens();
    return allTokens.find(token => token.symbol === symbol);
};

// Получение токена по символу и блокчейну
export const getTokenBySymbolAndBlockchain = async (symbol, blockchain) => {
    const allTokens = await getAllTokens();
    return allTokens.find(token => 
        token.symbol === symbol && token.blockchain === blockchain
    );
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

// Экспорт по умолчанию
export default {
    generateWalletsFromSeed,
    getAllTokens,
    getTokensByBlockchain,
    getTokenById,
    getTokenBySymbol,
    getTokenBySymbolAndBlockchain,
    initializeWallets,
    TOKENS
};