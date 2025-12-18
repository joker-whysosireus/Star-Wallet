import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import axios from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';

// Инициализация bip32 с эллиптической кривой
const bip32 = BIP32Factory(ecc);

// Ключи для localStorage
const SEED_PHRASE_KEY = 'wallet_seed_phrase';
const WALLETS_KEY = 'user_wallets';
const USER_DATA_KEY = 'user_data';
const WALLETS_GENERATED_KEY = 'wallets_generated';

// Базовые URL для функций Netlify
const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

// === КОНСТАНТЫ И ФУНКЦИИ MAINNET ===
const MAINNET_API_KEYS = {
    TON: {
        API_KEY: '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a',
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://mainnet.infura.io/v3/BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6',
        ETHERSCAN_API_KEY: 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        BSCSCAN_API_KEY: '8X9S7Q8J4T5V3C2W1B5N6M7P8Q9R0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5'
    },
    SOLANA: {
        RPC_URL: 'https://e1a20296-3d29-4edb-bc41-c709a187fbc9.mainnet.rpc.helius.xyz'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io'
    },
    BITCOIN: {
        RPC_URL: 'https://blockstream.info/api'
    }
};

// === ГЕНЕРАЦИЯ АДРЕСОВ ===

// Генерация TON адреса
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

// Генерация Solana адреса
const generateSolanaAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Solana address generation');
            return 'So11111111111111111111111111111111111111112';
        }
        
        console.log('Generating Solana address from seed...');
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

// Генерация Ethereum адреса
const generateEthereumAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Ethereum address generation');
            return '0x0000000000000000000000000000000000000000';
        }
        
        console.log('Generating Ethereum address from seed...');
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

// Генерация BSC адреса (использует тот же адрес что и Ethereum)
const generateBSCAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for BSC address generation');
            return '0x0000000000000000000000000000000000000000';
        }
        
        console.log('Generating BSC address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const bscWallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const address = bscWallet.address;
        console.log('BSC address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating BSC address:', error);
        return '0x0000000000000000000000000000000000000000';
    }
};

// Генерация Tron адреса
const generateTronAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Tron address generation');
            return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
        }
        
        console.log('Generating Tron address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем кошелек Ethereum (Tron использует тот же формат)
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const tronWallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        
        // Получаем приватный ключ (без префикса 0x)
        const privateKey = tronWallet.privateKey.slice(2);
        
        // Создаем публичный ключ из приватного
        const wallet = new ethers.Wallet(privateKey);
        const publicKey = wallet.signingKey.publicKey.slice(2); // убираем 0x
        
        // SHA256 публичного ключа
        const sha256Hash = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest();
        
        // RIPEMD160 от SHA256
        const ripemd160Hash = crypto.createHash('ripemd160').update(sha256Hash).digest();
        
        // Добавляем префикс 0x41 (mainnet Tron)
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), ripemd160Hash]);
        
        // Двойной SHA256 для checksum
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.slice(0, 4);
        
        // Объединяем адрес и checksum
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        
        // Base58 кодирование
        const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        
        let result = '';
        let num = BigInt('0x' + addressWithChecksum.toString('hex'));
        
        while (num > 0) {
            const remainder = Number(num % 58n);
            num = num / 58n;
            result = base58Alphabet[remainder] + result;
        }
        
        // Добавляем ведущие '1' для каждого нулевого байта
        for (let i = 0; i < addressWithChecksum.length; i++) {
            if (addressWithChecksum[i] === 0) {
                result = '1' + result;
            } else {
                break;
            }
        }
        
        console.log('Tron address generated:', result);
        return result;
        
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
    }
};

// Генерация Bitcoin адреса
const generateBitcoinAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for Bitcoin address generation');
            return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
        }
        
        console.log('Generating Bitcoin address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, bitcoin.networks.bitcoin);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { payments } = bitcoin;
        const { address } = payments.p2wpkh({
            pubkey: child.publicKey,
            network: bitcoin.networks.bitcoin
        });
        
        console.log('Bitcoin address generated:', address);
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    }
};

// Генерация NEAR адреса
const generateNearAddress = async (seedPhrase) => {
    try {
        if (!seedPhrase || seedPhrase.trim() === '') {
            console.warn('Empty seed phrase for NEAR address generation');
            return 'near.near';
        }
        
        console.log('Generating NEAR address from seed...');
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const nearWallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = nearWallet.privateKey.slice(2);
        
        // Создаем accountId на основе приватного ключа
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        const accountPrefix = hash.substring(0, 10);
        const accountId = `near_${accountPrefix}.near`;
        
        console.log('NEAR account generated:', accountId);
        return accountId;
    } catch (error) {
        console.error('Error generating NEAR address:', error);
        return 'near.near';
    }
};

// Генерация всех кошельков (с сохранением в localStorage)
export const generateWalletsFromSeed = async (seedPhrase) => {
    try {
        console.log('Generating wallets from seed phrase...');
        
        if (!seedPhrase || seedPhrase.trim() === '') {
            throw new Error('Seed phrase is required');
        }

        // Генерация всех адресов
        const [tonAddress, solanaAddress, ethAddress, bscAddress, tronAddress, bitcoinAddress, nearAddress] = await Promise.all([
            generateTonAddress(seedPhrase).catch(e => null),
            generateSolanaAddress(seedPhrase).catch(e => null),
            generateEthereumAddress(seedPhrase).catch(e => null),
            generateBSCAddress(seedPhrase).catch(e => null),
            generateTronAddress(seedPhrase).catch(e => null),
            generateBitcoinAddress(seedPhrase).catch(e => null),
            generateNearAddress(seedPhrase).catch(e => null)
        ]);

        console.log('All addresses generated');
        
        const wallets = [
            // TON Wallets
            tonAddress && {
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
            tonAddress && {
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
            tonAddress && {
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
            
            // Solana Wallets
            solanaAddress && {
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
            solanaAddress && {
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
            solanaAddress && {
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
            
            // Ethereum Wallets
            ethAddress && {
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
            ethAddress && {
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
            ethAddress && {
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
            
            // BSC Wallets
            bscAddress && {
                id: 'bnb_bsc',
                name: 'BNB',
                symbol: 'BNB',
                address: bscAddress,
                blockchain: 'BSC',
                decimals: 18,
                isNative: true,
                contractAddress: '',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png'
            },
            bscAddress && {
                id: 'usdt_bsc',
                name: 'Tether',
                symbol: 'USDT',
                address: bscAddress,
                blockchain: 'BSC',
                decimals: 18,
                isNative: false,
                contractAddress: '0x55d398326f99059ff775485246999027b3197955',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/tether-usdt-logo.png'
            },
            bscAddress && {
                id: 'usdc_bsc',
                name: 'USD Coin',
                symbol: 'USDC',
                address: bscAddress,
                blockchain: 'BSC',
                decimals: 18,
                isNative: false,
                contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                showBlockchain: true,
                balance: '0',
                isActive: true,
                logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png'
            },
            
            // Tron Wallets
            tronAddress && {
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
            tronAddress && {
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
            
            // Bitcoin Wallets
            bitcoinAddress && {
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
            
            // NEAR Wallets
            nearAddress && {
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
            nearAddress && {
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
            }
        ].filter(Boolean); // Убираем null значения

        // Сохраняем в localStorage
        localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
        localStorage.setItem(WALLETS_GENERATED_KEY, 'true');
        
        console.log('Wallets generated and saved to localStorage:', wallets.length);
        return wallets;
        
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

// Получение всех токенов (кошельков) для пользователя
export const getAllTokens = async (userData) => {
    try {
        // Проверяем кэш в localStorage
        const cachedWallets = localStorage.getItem(WALLETS_KEY);
        if (cachedWallets) {
            const wallets = JSON.parse(cachedWallets);
            if (Array.isArray(wallets)) {
                console.log('Using cached wallets from localStorage');
                return wallets;
            }
        }
        
        // Если в userData есть seed фраза, генерируем кошельки
        if (userData && userData.seed_phrases) {
            const wallets = await generateWalletsFromSeed(userData.seed_phrases);
            return wallets;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

// === ПОЛУЧЕНИЕ РЕАЛЬНЫХ БАЛАНСОВ ===

export const getRealBalances = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('getRealBalances: wallets is not an array');
            return wallets;
        }
        
        const updatedWallets = [];
        
        for (const wallet of wallets) {
            try {
                let balance = '0';
                
                switch(wallet.blockchain) {
                    case 'TON':
                        if (wallet.symbol === 'TON') {
                            balance = await getRealTonBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealJettonBalance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Ethereum':
                        if (wallet.symbol === 'ETH') {
                            balance = await getRealEthBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealERC20BalanceMainnet(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'BSC':
                        if (wallet.symbol === 'BNB') {
                            balance = await getRealBNBBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealBEP20BalanceMainnet(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Solana':
                        if (wallet.symbol === 'SOL') {
                            balance = await getRealSolBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealSPLBalance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Tron':
                        if (wallet.symbol === 'TRX') {
                            balance = await getRealTronBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealTRC20Balance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    case 'Bitcoin':
                        if (wallet.symbol === 'BTC') {
                            balance = await getRealBitcoinBalanceMainnet(wallet.address);
                        }
                        break;
                    case 'NEAR':
                        if (wallet.symbol === 'NEAR') {
                            balance = await getRealNearBalanceMainnet(wallet.address);
                        } else if (wallet.contractAddress) {
                            balance = await getRealNEP141Balance(wallet.address, wallet.contractAddress);
                        }
                        break;
                    default:
                        balance = wallet.balance || '0';
                }
                
                updatedWallets.push({
                    ...wallet,
                    balance: balance || '0',
                    lastUpdated: new Date().toISOString(),
                    isRealBalance: true
                });
                
            } catch (error) {
                console.error(`Error getting real balance for ${wallet.symbol}:`, error);
                updatedWallets.push({ 
                    ...wallet, 
                    balance: wallet.balance || '0',
                    isRealBalance: false
                });
            }
        }
        
        // Обновляем кэш в localStorage
        localStorage.setItem(WALLETS_KEY, JSON.stringify(updatedWallets));
        
        return updatedWallets;
    } catch (error) {
        console.error('Error in getRealBalances:', error);
        return wallets;
    }
};

// Реальное получение баланса TON с mainnet
const getRealTonBalanceMainnet = async (address) => {
    try {
        console.log(`Fetching TON balance for ${address}`);
        
        const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getAddressInformation",
                params: [address]
            })
        });
        
        const data = await response.json();
        console.log('TON balance response:', data);
        
        if (data.result && data.result.balance) {
            const balanceInTon = data.result.balance / 1000000000;
            console.log(`TON balance for ${address}: ${balanceInTon}`);
            return balanceInTon.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet TON balance error:', error);
        
        // Fallback на другой эндпоинт
        try {
            const fallbackResponse = await fetch(`https://tonapi.io/v1/account/getInfo?account=${address}`);
            const fallbackData = await fallbackResponse.json();
            
            if (fallbackData.balance) {
                const balanceInTon = fallbackData.balance / 1000000000;
                return balanceInTon.toFixed(6);
            }
        } catch (fallbackError) {
            console.error('Fallback TON balance error:', fallbackError);
        }
        
        return '0';
    }
};

// Реальное получение баланса ETH с mainnet
const getRealEthBalanceMainnet = async (address) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('Mainnet ETH balance error:', error);
        return '0';
    }
};

// Реальное получение баланса ERC20 токена
const getRealERC20BalanceMainnet = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
        
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Mainnet ERC20 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса BNB с mainnet
const getRealBNBBalanceMainnet = async (address) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.BSC.RPC_URL, {
            chainId: 56,
            name: 'bsc'
        });
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('Mainnet BNB balance error:', error);
        return '0';
    }
};

// Реальное получение баланса BEP20 токена
const getRealBEP20BalanceMainnet = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.BSC.RPC_URL, {
            chainId: 56,
            name: 'bsc'
        });
        
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Mainnet BEP20 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса SOL с mainnet
const getRealSolBalanceMainnet = async (address) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / 1_000_000_000).toFixed(6);
    } catch (error) {
        console.error('Mainnet SOL balance error:', error);
        return '0';
    }
};

// Реальное получение баланса SPL токена
const getRealSPLBalance = async (address, tokenAddress) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const { getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
        
        const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
        const walletPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        const associatedTokenAddress = await PublicKey.findProgramAddress(
            [
                walletPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenPublicKey.toBuffer()
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        try {
            const accountInfo = await connection.getAccountInfo(associatedTokenAddress[0]);
            if (accountInfo) {
                const account = getAccount(associatedTokenAddress[0]);
                const balance = account.amount;
                const tokenDecimals = 6; // Для USDT/USDC
                return (Number(balance) / Math.pow(10, tokenDecimals)).toFixed(6);
            }
        } catch (error) {
            // Акаунт не найден
        }
        
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

// Реальное получение баланса TRX с mainnet
const getRealTronBalanceMainnet = async (address) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].balance) {
            const balanceInTRX = data.data[0].balance / 1_000_000;
            return balanceInTRX.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet TRX balance error:', error);
        return '0';
    }
};

// Реальное получение баланса TRC20 токена
const getRealTRC20Balance = async (address, contractAddress) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const tokenData = data.data[0];
            const balance = tokenData.balance / Math.pow(10, tokenData.tokenDecimal);
            return balance.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса BTC с mainnet
const getRealBitcoinBalanceMainnet = async (address) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/address/${address}`);
        const data = await response.json();
        
        if (data.chain_stats && data.chain_stats.funded_txo_sum) {
            const funded = data.chain_stats.funded_txo_sum;
            const spent = data.chain_stats.spent_txo_sum || 0;
            const balance = (funded - spent) / 100_000_000;
            return balance.toFixed(8);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet BTC balance error:', error);
        return '0';
    }
};

// Реальное получение баланса NEAR с mainnet
const getRealNearBalanceMainnet = async (accountId) => {
    try {
        const response = await fetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        if (data.result && data.result.amount) {
            const balanceInYocto = data.result.amount;
            const balanceInNear = balanceInYocto / Math.pow(10, 24);
            return balanceInNear.toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet NEAR balance error:', error);
        return '0';
    }
};

// Реальное получение баланса NEP-141 токена
const getRealNEP141Balance = async (accountId, contractAddress) => {
    try {
        const response = await fetch('https://rpc.mainnet.near.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        if (data.result && data.result.result) {
            const balanceBytes = data.result.result;
            const balance = JSON.parse(new TextDecoder().decode(Uint8Array.from(balanceBytes)));
            return balance;
        }
        return '0';
    } catch (error) {
        console.error('NEP-141 balance error:', error);
        return '0';
    }
};

// Реальное получение баланса Jetton
const getRealJettonBalance = async (address, jettonAddress) => {
    try {
        // Для Jetton нужно специальное обращение
        return '0';
    } catch (error) {
        console.error('Jetton balance error:', error);
        return '0';
    }
};

// === ИСТОРИЯ ТРАНЗАКЦИЙ ===

/**
 * Получение истории транзакций для пользователя
 */
export const getTransactionHistory = async (userData, tokenSymbol = 'all') => {
    try {
        console.log('Getting transaction history for token:', tokenSymbol);
        
        if (!userData) {
            console.error('User data not provided');
            return [];
        }

        const allWallets = await getAllTokens(userData);
        let allTransactions = [];

        // Собираем транзакции для каждого кошелька
        for (const wallet of allWallets) {
            // Если выбран конкретный токен, фильтруем
            if (tokenSymbol !== 'all' && wallet.symbol !== tokenSymbol) {
                continue;
            }

            try {
                const walletTransactions = await getTransactionsForWallet(wallet);
                allTransactions = [...allTransactions, ...walletTransactions];
            } catch (error) {
                console.error(`Error fetching transactions for ${wallet.symbol}:`, error);
            }
        }

        // Сортируем по времени (новые первыми)
        allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`Found ${allTransactions.length} transactions`);
        return allTransactions;
    } catch (error) {
        console.error('Error getting transaction history:', error);
        return [];
    }
};

/**
 * Получение транзакций для конкретного кошелька
 */
const getTransactionsForWallet = async (wallet) => {
    try {
        let transactions = [];
        
        switch (wallet.blockchain) {
            case 'TON':
                transactions = await getTONTransactions(wallet);
                break;
            case 'Ethereum':
                transactions = await getEthereumTransactions(wallet);
                break;
            case 'BSC':
                transactions = await getBSCTransactions(wallet);
                break;
            case 'Solana':
                transactions = await getSolanaTransactions(wallet);
                break;
            case 'Tron':
                transactions = await getTronTransactions(wallet);
                break;
            case 'Bitcoin':
                transactions = await getBitcoinTransactions(wallet);
                break;
            case 'NEAR':
                transactions = await getNEARTransactions(wallet);
                break;
            default:
                transactions = [];
        }
        
        // Добавляем символ токена к каждой транзакции
        return transactions.map(tx => ({
            ...tx,
            symbol: wallet.symbol
        }));
    } catch (error) {
        console.error(`Error getting transactions for ${wallet.symbol}:`, error);
        return [];
    }
};

/**
 * Получение транзакций TON
 */
const getTONTransactions = async (wallet) => {
    try {
        const response = await fetch('https://toncenter.com/api/v2/jsonRPC', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': MAINNET_API_KEYS.TON.API_KEY 
            },
            body: JSON.stringify({
                id: 1,
                jsonrpc: "2.0",
                method: "getTransactions",
                params: {
                    address: wallet.address,
                    limit: 10
                }
            })
        });
        
        const data = await response.json();
        
        if (data.result && data.result.length > 0) {
            return data.result.map(tx => ({
                hash: tx.transaction_id.hash,
                timestamp: tx.utime * 1000,
                type: tx.in_msg.source === '' ? 'incoming' : 'outgoing',
                amount: (parseFloat(tx.in_msg.value || 0) / 1000000000).toString(),
                address: tx.in_msg.source || tx.in_msg.destination || wallet.address,
                status: 'confirmed',
                explorerUrl: `https://tonscan.org/tx/${tx.transaction_id.hash}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching TON transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций Ethereum
 */
const getEthereumTransactions = async (wallet) => {
    try {
        const apiKey = MAINNET_API_KEYS.ETHEREUM.ETHERSCAN_API_KEY;
        let url;
        
        if (wallet.symbol === 'ETH') {
            url = `https://api.etherscan.io/api?module=account&action=txlist&address=${wallet.address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${apiKey}`;
        } else if (wallet.contractAddress) {
            url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${wallet.contractAddress}&address=${wallet.address}&page=1&offset=10&sort=desc&apikey=${apiKey}`;
        } else {
            return [];
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1' && data.result) {
            return data.result.map(tx => ({
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp) * 1000,
                type: tx.to.toLowerCase() === wallet.address.toLowerCase() ? 'incoming' : 'outgoing',
                amount: (parseFloat(tx.value || tx.value) / Math.pow(10, wallet.decimals || 18)).toString(),
                address: tx.from === wallet.address ? tx.to : tx.from,
                status: 'confirmed',
                explorerUrl: `https://etherscan.io/tx/${tx.hash}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching Ethereum transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций BSC
 */
const getBSCTransactions = async (wallet) => {
    try {
        const apiKey = MAINNET_API_KEYS.BSC.BSCSCAN_API_KEY;
        let url;
        
        if (wallet.symbol === 'BNB') {
            url = `https://api.bscscan.com/api?module=account&action=txlist&address=${wallet.address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${apiKey}`;
        } else if (wallet.contractAddress) {
            url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${wallet.contractAddress}&address=${wallet.address}&page=1&offset=10&sort=desc&apikey=${apiKey}`;
        } else {
            return [];
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1' && data.result) {
            return data.result.map(tx => ({
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp) * 1000,
                type: tx.to.toLowerCase() === wallet.address.toLowerCase() ? 'incoming' : 'outgoing',
                amount: (parseFloat(tx.value) / Math.pow(10, wallet.decimals || 18)).toString(),
                address: tx.from === wallet.address ? tx.to : tx.from,
                status: 'confirmed',
                explorerUrl: `https://bscscan.com/tx/${tx.hash}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching BSC transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций Solana
 */
const getSolanaTransactions = async (wallet) => {
    try {
        const { Connection, PublicKey } = await import('@solana/web3.js');
        const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
        const publicKey = new PublicKey(wallet.address);
        
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
        
        const transactions = [];
        
        for (const signature of signatures) {
            const tx = await connection.getTransaction(signature.signature, {
                maxSupportedTransactionVersion: 0
            });
            
            if (tx) {
                transactions.push({
                    hash: signature.signature,
                    timestamp: signature.blockTime ? signature.blockTime * 1000 : Date.now(),
                    type: 'transfer', // Нужен более детальный анализ
                    amount: '0', // Нужен парсинг инструкций
                    address: wallet.address,
                    status: 'confirmed',
                    explorerUrl: `https://solscan.io/tx/${signature.signature}`
                });
            }
        }
        
        return transactions;
    } catch (error) {
        console.error('Error fetching Solana transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций Tron
 */
const getTronTransactions = async (wallet) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.TRON.RPC_URL}/v1/accounts/${wallet.address}/transactions?limit=10`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return data.data.map(tx => ({
                hash: tx.txID,
                timestamp: tx.raw_data.timestamp,
                type: tx.raw_data.contract[0].parameter.value.to_address === wallet.address ? 'incoming' : 'outgoing',
                amount: (tx.raw_data.contract[0].parameter.value.amount / 1000000).toString(),
                address: tx.raw_data.contract[0].parameter.value.owner_address || wallet.address,
                status: 'confirmed',
                explorerUrl: `https://tronscan.org/#/transaction/${tx.txID}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching Tron transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций Bitcoin
 */
const getBitcoinTransactions = async (wallet) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/address/${wallet.address}/txs`);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return data.slice(0, 10).map(tx => ({
                hash: tx.txid,
                timestamp: tx.status.block_time * 1000,
                type: 'transfer', // Нужен анализ inputs/outputs
                amount: (tx.vout.reduce((sum, output) => {
                    if (output.scriptpubkey_address === wallet.address) {
                        return sum + output.value;
                    }
                    return sum;
                }, 0) / 100000000).toString(),
                address: wallet.address,
                status: tx.status.confirmed ? 'confirmed' : 'pending',
                explorerUrl: `https://blockstream.info/tx/${tx.txid}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching Bitcoin transactions:', error);
        return [];
    }
};

/**
 * Получение транзакций NEAR
 */
const getNEARTransactions = async (wallet) => {
    try {
        // NEAR API сложнее для получения истории
        return [];
    } catch (error) {
        console.error('Error fetching NEAR transactions:', error);
        return [];
    }
};

// === ДРУГИЕ ФУНКЦИИ ===

// Очистка всех данных из localStorage
export const clearAllData = () => {
    try {
        localStorage.removeItem(SEED_PHRASE_KEY);
        localStorage.removeItem(WALLETS_KEY);
        localStorage.removeItem(USER_DATA_KEY);
        localStorage.removeItem(WALLETS_GENERATED_KEY);
        console.log('All wallet data cleared from localStorage');
        return true;
    } catch (error) {
        console.error('Error clearing data:', error);
        return false;
    }
};

// Функция для очистки данных при закрытии приложения
export const setupAppCloseListener = () => {
    // Очищаем данные при загрузке страницы (на случай предыдущей сессии)
    window.addEventListener('load', () => {
        console.log('App loaded, clearing previous session data');
        clearAllData();
    });

    // Очищаем данные при закрытии/обновлении страницы
    window.addEventListener('beforeunload', () => {
        console.log('App closing/refreshing, clearing data');
        clearAllData();
    });

    // Для Telegram WebApp
    if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        
        // Очищаем при закрытии WebApp
        webApp.onEvent('viewportChanged', (event) => {
            if (event.isStateStable && !webApp.isExpanded) {
                console.log('Telegram WebApp closing, clearing data');
                clearAllData();
            }
        });

        // Очищаем при нажатии кнопки закрытия
        if (webApp.close) {
            const originalClose = webApp.close;
            webApp.close = function() {
                console.log('Telegram WebApp close button pressed, clearing data');
                clearAllData();
                return originalClose.apply(this, arguments);
            };
        }
    }
};

// Локальные функции для seed фразы
export const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem(SEED_PHRASE_KEY);
        if (!seedPhrase) {
            console.log('No seed phrase found in localStorage');
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
        const seedPhrase = bip39.generateMnemonic(128);
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
        console.log('Seed phrase saved to localStorage');
        return true;
    } catch (error) {
        console.error('Error saving seed phrase:', error);
        return false;
    }
};

// Показать seed фразу (из userData или localStorage)
export const revealSeedPhrase = async (userData) => {
    if (userData && userData.seed_phrase) {
        return userData.seed_phrase;
    }
    
    const localSeed = getSeedPhrase();
    if (localSeed) {
        return localSeed;
    }
    
    throw new Error('Seed phrase not found');
};

// API функции
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

// Остальные функции
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

// Функция валидации адреса
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
                const { PublicKey } = await import('@solana/web3.js');
                try {
                    new PublicKey(address);
                    return true;
                } catch {
                    return false;
                }
            case 'Tron':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                const bitcoinRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
                return bitcoinRegex.test(address);
            case 'NEAR':
                const nearRegex = /^[a-z0-9_-]+\.(near|testnet)$/;
                return nearRegex.test(address);
            default:
                return true;
        }
    } catch (error) {
        console.error('Address validation error:', error);
        return false;
    }
};

// Функция для получения цен токенов
export const getTokenPrices = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana,ethereum,binancecoin,tron,bitcoin,near-protocol,tether,usd-coin&vs_currencies=usd');
        
        if (response.ok) {
            const data = await response.json();
            return {
                'TON': data['the-open-network']?.usd || 6.24,
                'SOL': data['solana']?.usd || 172.34,
                'ETH': data['ethereum']?.usd || 3500.00,
                'BNB': data['binancecoin']?.usd || 600.00,
                'USDT': data['tether']?.usd || 1.00,
                'USDC': data['usd-coin']?.usd || 1.00,
                'TRX': data['tron']?.usd || 0.12,
                'BTC': data['bitcoin']?.usd || 68000.00,
                'NEAR': data['near-protocol']?.usd || 8.50
            };
        }
        
        // Fallback prices
        return {
            'TON': 6.24,
            'SOL': 172.34,
            'ETH': 3500.00,
            'BNB': 600.00,
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
            'BNB': 600.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'TRX': 0.12,
            'BTC': 68000.00,
            'NEAR': 8.50
        };
    }
};

// Функция расчета общего баланса
export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets)) {
            console.error('calculateTotalBalance: wallets is not an array');
            return '0.00';
        }
        
        const updatedWallets = await getRealBalances(wallets);
        const prices = await getTokenPrices();
        
        let total = 0;
        for (const wallet of updatedWallets) {
            const price = prices[wallet.symbol] || 0;
            total += parseFloat(wallet.balance || 0) * price;
        }
        
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

// Функция для получения балансов (для совместимости)
export const getBalances = async (wallets, userData) => {
    try {
        return await getRealBalances(wallets);
    } catch (error) {
        console.error('Error in getBalances:', error);
        return wallets;
    }
};

// Функция оценки комиссии транзакции
export const estimateTransactionFee = async (blockchain, fromAddress, toAddress, amount, symbol) => {
    try {
        const fees = {
            'TON': '0.05',
            'Ethereum': '0.001',
            'BSC': '0.0001',
            'Solana': '0.000005',
            'Tron': '0.1',
            'Bitcoin': '0.0001',
            'NEAR': '0.01'
        };
        
        return fees[blockchain] || '0.01';
    } catch (error) {
        console.error('Fee estimation error:', error);
        return '0.01';
    }
};

// Функция отправки транзакции
export const sendTransaction = async (transactionData) => {
    const { blockchain, fromAddress, toAddress, amount, symbol, memo, privateKey, seedPhrase } = transactionData;
    
    try {
        console.log(`Sending ${amount} ${symbol} via ${blockchain}`);
        
        let result;
        
        switch(blockchain) {
            case 'TON':
                const { sendTonReal } = await import('./tonService');
                result = await sendTonReal({
                    fromAddress,
                    toAddress,
                    amount,
                    seedPhrase,
                    comment: memo || ''
                });
                break;
                
            case 'Ethereum':
                const { sendEthReal, sendERC20Real } = await import('./ethereumService');
                if (symbol === 'ETH') {
                    result = await sendEthReal({
                        toAddress,
                        amount,
                        privateKey
                    });
                } else {
                    result = await sendERC20Real({
                        contractAddress: transactionData.contractAddress,
                        toAddress,
                        amount,
                        privateKey
                    });
                }
                break;
                
            case 'BSC':
                const { sendBNBReal, sendBEP20Real } = await import('./bscService');
                if (symbol === 'BNB') {
                    result = await sendBNBReal({
                        toAddress,
                        amount,
                        privateKey
                    });
                } else {
                    result = await sendBEP20Real({
                        contractAddress: transactionData.contractAddress,
                        toAddress,
                        amount,
                        privateKey
                    });
                }
                break;
                
            case 'Solana':
                const { sendSolReal } = await import('./solanaService');
                result = await sendSolReal({
                    toAddress,
                    amount,
                    seedPhrase
                });
                break;
                
            case 'Tron':
                const { sendTrxReal, sendTRC20Real } = await import('./tronService');
                if (symbol === 'TRX') {
                    result = await sendTrxReal({
                        toAddress,
                        amount,
                        seedPhrase
                    });
                } else {
                    result = await sendTRC20Real({
                        contractAddress: transactionData.contractAddress,
                        toAddress,
                        amount,
                        seedPhrase
                    });
                }
                break;
                
            case 'Bitcoin':
                const { sendBitcoinReal } = await import('./bitcoinService');
                result = await sendBitcoinReal({
                    toAddress,
                    amount,
                    seedPhrase
                });
                break;
                
            default:
                result = {
                    success: false,
                    error: `Blockchain ${blockchain} not supported`
                };
        }
        
        return result;
    } catch (error) {
        console.error('Error sending transaction:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Экспорт по умолчанию
export default {
    // Основные функции
    generateNewSeedPhrase,
    saveSeedPhrase,
    getSeedPhrase,
    generateWalletsFromSeed,
    getAllTokens,
    getRealBalances,
    clearAllData,
    setupAppCloseListener,
    sendTransaction,
    revealSeedPhrase,
    getTokenPrices,
    calculateTotalBalance,
    getTransactionHistory,
    
    // API функции
    saveWalletToAPI,
    getWalletFromAPI,
    saveSeedPhraseToAPI,
    getSeedPhraseFromAPI,
    
    // Вспомогательные функции
    validateAddress,
    getBalances,
    estimateTransactionFee
};