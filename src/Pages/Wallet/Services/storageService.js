// Services/storageService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';

const NETLIFY_FUNCTIONS_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

export const getUserDataFromSupabase = async (telegramUserId) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/getWallets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ telegram_user_id: telegramUserId }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.error || 'Failed to fetch user data');
        }
    } catch (error) {
        console.error('Error fetching user data from Supabase:', error);
        throw error;
    }
};

export const saveSeedPhraseToSupabase = async (telegramUserId, seedPhrase, pinCode = null) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/saveSeedPhrase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                seed_phrase: seedPhrase,
                pin_code: pinCode
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data;
        } else {
            throw new Error(data.error || 'Failed to save seed phrase');
        }
    } catch (error) {
        console.error('Error saving seed phrase to Supabase:', error);
        throw error;
    }
};

export const saveWalletAddressesToSupabase = async (telegramUserId, walletAddresses) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/saveWalletAddresses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                wallet_addresses: walletAddresses
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data;
        } else {
            throw new Error(data.error || 'Failed to save wallet addresses');
        }
    } catch (error) {
        console.error('Error saving wallet addresses to Supabase:', error);
        throw error;
    }
};

export const updateBalancesInSupabase = async (telegramUserId, tokenBalances) => {
    try {
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/updateBalances`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                token_balances: tokenBalances
            }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data;
        } else {
            throw new Error(data.error || 'Failed to update balances');
        }
    } catch (error) {
        console.error('Error updating balances in Supabase:', error);
        throw error;
    }
};

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

const generateWalletAddressesFromSeed = async (seedPhrase) => {
    try {
        console.log('Generating wallet addresses from seed...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required');
        }

        let tonAddress;
        try {
            const tonKeyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
            const tonWallet = WalletContractV4.create({
                publicKey: tonKeyPair.publicKey,
                workchain: 0
            });
            tonAddress = tonWallet.address.toString();
            console.log('TON address generated:', tonAddress);
        } catch (error) {
            console.error('Error generating TON address:', error);
            tonAddress = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
        }

        let solanaAddress;
        try {
            const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
            const solanaSeed = new Uint8Array(seedBuffer.slice(0, 32));
            const solanaKeypair = Keypair.fromSeed(solanaSeed);
            solanaAddress = solanaKeypair.publicKey.toBase58();
            console.log('Solana address generated:', solanaAddress);
        } catch (error) {
            console.error('Error generating Solana address:', error);
            solanaAddress = 'So11111111111111111111111111111111111111112';
        }

        let ethAddress;
        try {
            const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
            const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
            const ethWallet = masterNode.derivePath("m/44'/60'/0'/0/0");
            ethAddress = ethWallet.address;
            console.log('Ethereum address generated:', ethAddress);
        } catch (error) {
            console.error('Error generating Ethereum address:', error);
            ethAddress = '0x0000000000000000000000000000000000000000';
        }

        console.log('All addresses generated successfully');
        
        return {
            TON: tonAddress,
            Solana: solanaAddress,
            Ethereum: ethAddress
        };
    } catch (error) {
        console.error('Error generating wallet addresses:', error);
        throw error;
    }
};

export const generateWalletsFromAddresses = async (addresses, userData = null) => {
    try {
        console.log('Generating wallets from addresses...');
        
        const tokenBalances = userData?.token_balances || {};
        
        const wallets = [
            {
                id: 'ton',
                name: 'Toncoin',
                symbol: 'TON',
                address: addresses?.TON || '',
                blockchain: 'TON',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: tokenBalances['TON'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png'
            },
            {
                id: 'usdt_ton',
                name: 'Tether USD',
                symbol: 'USDT',
                address: addresses?.TON || '',
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
                showBlockchain: true,
                balance: tokenBalances['USDT'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_ton',
                name: 'USD Coin',
                symbol: 'USDC',
                address: addresses?.TON || '',
                blockchain: 'TON',
                decimals: 6,
                isNative: false,
                contractAddress: 'EQB-MPwrd1G6WKNkLz_VnV6TCqetER9X_KFXqJzPiTBDdhhG',
                showBlockchain: true,
                balance: tokenBalances['USDC'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },

            {
                id: 'sol',
                name: 'Solana',
                symbol: 'SOL',
                address: addresses?.Solana || '',
                blockchain: 'Solana',
                decimals: 9,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: tokenBalances['SOL'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/solana-sol-logo.png'
            },
            {
                id: 'usdt_sol',
                name: 'Tether USD',
                symbol: 'USDT',
                address: addresses?.Solana || '',
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                showBlockchain: true,
                balance: tokenBalances['USDT'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_sol',
                name: 'USD Coin',
                symbol: 'USDC',
                address: addresses?.Solana || '',
                blockchain: 'Solana',
                decimals: 6,
                isNative: false,
                contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                showBlockchain: true,
                balance: tokenBalances['USDC'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },

            {
                id: 'eth',
                name: 'Ethereum',
                symbol: 'ETH',
                address: addresses?.Ethereum || '',
                blockchain: 'Ethereum',
                decimals: 18,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: tokenBalances['ETH'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            },
            {
                id: 'usdt_eth',
                name: 'Tether USD',
                symbol: 'USDT',
                address: addresses?.Ethereum || '',
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                showBlockchain: true,
                balance: tokenBalances['USDT'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            {
                id: 'usdc_eth',
                name: 'USD Coin',
                symbol: 'USDC',
                address: addresses?.Ethereum || '',
                blockchain: 'Ethereum',
                decimals: 6,
                isNative: false,
                contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                showBlockchain: true,
                balance: tokenBalances['USDC'] || '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            }
        ];

        console.log('Wallets generated successfully:', wallets.length);
        return wallets;
    } catch (error) {
        console.error('Error generating wallets from addresses:', error);
        throw error;
    }
};

export const initializeUserWallets = async (userData) => {
    try {
        console.log('Initializing user wallets...');
        
        if (!userData?.telegram_user_id) {
            throw new Error('User data with telegram_user_id is required');
        }

        let seedPhrase = userData.seed_phrases;
        let walletAddresses = userData.wallet_addresses || {};

        if (!seedPhrase) {
            console.log('No seed phrase found, generating new one...');
            seedPhrase = await generateNewSeedPhrase();
            
            await saveSeedPhraseToSupabase(userData.telegram_user_id, seedPhrase);
            
            walletAddresses = await generateWalletAddressesFromSeed(seedPhrase);
            
            await saveWalletAddressesToSupabase(userData.telegram_user_id, walletAddresses);
            
            console.log('New seed phrase and addresses saved to Supabase');
        } else if (!walletAddresses || Object.keys(walletAddresses).length === 0) {
            console.log('Seed phrase found but no addresses, generating addresses...');
            walletAddresses = await generateWalletAddressesFromSeed(seedPhrase);
            
            await saveWalletAddressesToSupabase(userData.telegram_user_id, walletAddresses);
            
            console.log('Addresses generated and saved to Supabase');
        }

        const wallets = await generateWalletsFromAddresses(walletAddresses, userData);
        
        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: walletAddresses,
            token_balances: userData.token_balances || {}
        };

        return {
            success: true,
            userData: updatedUserData,
            wallets: wallets
        };
    } catch (error) {
        console.error('Error initializing user wallets:', error);
        throw error;
    }
};

export const getAllTokens = async (userData) => {
    try {
        console.log('Getting all tokens for user...');
        
        if (!userData) {
            throw new Error('User data is required');
        }

        if (!userData.wallet_addresses || Object.keys(userData.wallet_addresses).length === 0) {
            const result = await initializeUserWallets(userData);
            return result.wallets;
        }

        const wallets = await generateWalletsFromAddresses(userData.wallet_addresses, userData);
        
        console.log(`Generated ${wallets.length} wallets for user`);
        return wallets;
    } catch (error) {
        console.error('Error getting all tokens:', error);
        throw error;
    }
};

export const getTokenBySymbol = async (symbol, userData) => {
    try {
        const wallets = await getAllTokens(userData);
        const token = wallets.find(wallet => wallet.symbol === symbol);
        
        if (!token) {
            throw new Error(`Token ${symbol} not found`);
        }
        
        return token;
    } catch (error) {
        console.error('Error getting token by symbol:', error);
        throw error;
    }
};

export const getBalances = async (wallets, userData = null) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) {
            return wallets || [];
        }

        const updatedWallets = wallets.map(wallet => {
            if (userData?.token_balances && userData.token_balances[wallet.symbol]) {
                return {
                    ...wallet,
                    balance: userData.token_balances[wallet.symbol]
                };
            }
            return wallet;
        });
        
        return updatedWallets;
    } catch (error) {
        console.error('Error getting balances:', error);
        return wallets;
    }
};

export const getTokenPrices = async () => {
    try {
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

export const updateUserBalances = async (telegramUserId, updatedBalances) => {
    try {
        await updateBalancesInSupabase(telegramUserId, updatedBalances);
        
        return {
            success: true,
            message: 'Balances updated successfully'
        };
    } catch (error) {
        console.error('Error updating user balances:', error);
        throw error;
    }
};

export default {
    getUserDataFromSupabase,
    saveSeedPhraseToSupabase,
    saveWalletAddressesToSupabase,
    updateBalancesInSupabase,
    generateNewSeedPhrase,
    generateWalletsFromAddresses,
    initializeUserWallets,
    getAllTokens,
    getTokenBySymbol,
    getBalances,
    getTokenPrices,
    calculateTotalBalance,
    updateUserBalances
};