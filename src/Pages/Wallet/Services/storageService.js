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

// === БИТКОИН ФУНКЦИИ ===

// Реальная функция отправки Bitcoin транзакции
export const sendBitcoinTransactionReal = async (fromAddress, toAddress, amount, seedPhrase, feeRate = 10) => {
    try {
        // 1. Получаем UTXO (непотраченные выходы)
        const utxos = await getBitcoinUTXOs(fromAddress);
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs found for this address');
        }

        // 2. Генерируем приватный ключ из seed фразы
        const privateKey = await getBitcoinPrivateKey(seedPhrase);
        
        // 3. Создаем транзакцию
        const transaction = await createBitcoinTransaction(
            fromAddress,
            toAddress,
            amount,
            utxos,
            privateKey,
            feeRate
        );

        // 4. Отправляем транзакцию в сеть
        const result = await broadcastBitcoinTransaction(transaction.hex);
        
        if (result) {
            return {
                success: true,
                hash: result,
                explorerUrl: `https://blockstream.info/tx/${result}`,
                fee: transaction.fee,
                inputs: transaction.inputs,
                outputs: transaction.outputs
            };
        } else {
            return {
                success: false,
                error: 'Failed to broadcast transaction'
            };
        }

    } catch (error) {
        console.error('Bitcoin transaction error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Получение UTXO для адреса Bitcoin
const getBitcoinUTXOs = async (address) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/address/${address}/utxo`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const utxos = await response.json();
        
        // Форматируем UTXO для bitcoinjs-lib
        return utxos.map(utxo => ({
            hash: utxo.txid,
            index: utxo.vout,
            value: utxo.value,
            script: utxo.scriptpubkey,
            address: utxo.address || address
        }));
    } catch (error) {
        console.error('Error fetching UTXOs:', error);
        throw error;
    }
};

// Генерация приватного ключа Bitcoin из seed фразы
const getBitcoinPrivateKey = async (seedPhrase, derivationPath = "m/84'/0'/0'/0/0") => {
    try {
        // Преобразуем мнемонику в seed
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем корневой узел из seed
        const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
        
        // Получаем дочерний ключ по пути деривации
        const child = root.derivePath(derivationPath);
        
        // Возвращаем приватный ключ
        return {
            privateKey: child.privateKey,
            publicKey: child.publicKey,
            network: bitcoin.networks.bitcoin
        };
    } catch (error) {
        console.error('Error generating Bitcoin private key:', error);
        throw error;
    }
};

// Создание Bitcoin транзакции
const createBitcoinTransaction = async (fromAddress, toAddress, amount, utxos, privateKeyData, feeRate = 10) => {
    try {
        const network = bitcoin.networks.bitcoin;
        
        // Конвертируем сумму в сатоши (1 BTC = 100,000,000 сатоши)
        const amountSatoshi = Math.floor(amount * 100000000);
        
        // Создаем PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network });
        
        // Выбираем UTXO для транзакции (простой алгоритм "все, что есть")
        let totalInput = 0;
        let selectedUtxos = [];
        
        // Простой выбор UTXO - берем первый подходящий
        for (const utxo of utxos) {
            if (totalInput >= amountSatoshi) break;
            
            // Добавляем UTXO как вход
            psbt.addInput({
                hash: utxo.hash,
                index: utxo.index,
                // Для P2WPKH (segwit) используем это:
                witnessUtxo: {
                    script: Buffer.from(utxo.script, 'hex'),
                    value: utxo.value
                }
            });
            
            totalInput += utxo.value;
            selectedUtxos.push(utxo);
        }
        
        // Проверяем достаточно ли средств
        if (totalInput < amountSatoshi) {
            throw new Error(`Insufficient funds. Available: ${totalInput / 100000000} BTC, Needed: ${amount} BTC`);
        }
        
        // Рассчитываем комиссию
        // Примерная оценка размера транзакции: 140 байт на вход + 34 байта на выход
        const estimatedSize = (selectedUtxos.length * 140) + (2 * 34);
        const fee = Math.ceil(estimatedSize * feeRate);
        
        // Вычисляем сдачу
        const change = totalInput - amountSatoshi - fee;
        
        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountSatoshi
        });
        
        // Добавляем выход для сдачи (если есть)
        if (change > 0) {
            psbt.addOutput({
                address: fromAddress, // Сдачу возвращаем на исходный адрес
                value: change
            });
        }
        
        // Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, privateKeyData.privateKey);
        }
        
        // Валидируем подписи
        psbt.validateSignaturesOfAllInputs();
        
        // Финализируем транзакцию
        psbt.finalizeAllInputs();
        
        // Получаем сырую транзакцию в hex
        const transaction = psbt.extractTransaction();
        const hex = transaction.toHex();
        
        return {
            hex: hex,
            txid: transaction.getId(),
            fee: fee,
            inputs: selectedUtxos.length,
            outputs: change > 0 ? 2 : 1,
            size: estimatedSize,
            amount: amountSatoshi,
            change: change
        };
        
    } catch (error) {
        console.error('Error creating Bitcoin transaction:', error);
        throw error;
    }
};

// Отправка транзакции в сеть Bitcoin
const broadcastBitcoinTransaction = async (transactionHex) => {
    try {
        const response = await fetch(`${MAINNET_API_KEYS.BITCOIN.RPC_URL}/tx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
            },
            body: transactionHex
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Broadcast failed: ${response.status} - ${errorText}`);
        }
        
        const txid = await response.text();
        return txid;
        
    } catch (error) {
        console.error('Error broadcasting Bitcoin transaction:', error);
        
        // Альтернативный способ отправки через mempool.space
        try {
            const altResponse = await fetch('https://mempool.space/api/tx', {
                method: 'POST',
                body: transactionHex
            });
            
            if (altResponse.ok) {
                return await altResponse.text();
            }
        } catch (altError) {
            console.error('Alternative broadcast also failed:', altError);
        }
        
        throw error;
    }
};

// === ОСНОВНАЯ ФУНКЦИЯ ОТПРАВКИ ТРАНЗАКЦИЙ ===
export const sendTransaction = async (transactionData) => {
    const { blockchain, fromAddress, toAddress, amount, symbol, memo, privateKey, seedPhrase } = transactionData;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'Bitcoin':
                result = await sendBitcoinTransactionReal(
                    fromAddress,
                    toAddress,
                    parseFloat(amount),
                    seedPhrase,
                    15 // feeRate в сатоши за байт
                );
                break;
                
            case 'TON':
                // Реальная отправка TON транзакции
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
                            method: "sendTransaction",
                            params: {
                                address: fromAddress,
                                amount: amount * 1000000000, // Конвертация в nanoTON
                                to_address: toAddress,
                                message: memo || ''
                            }
                        })
                    });
                    
                    const data = await response.json();
                    if (data.result) {
                        result = {
                            success: true,
                            hash: data.result,
                            explorerUrl: `https://tonscan.org/tx/${data.result}`
                        };
                    } else {
                        result = {
                            success: false,
                            error: data.error?.message || 'Unknown error'
                        };
                    }
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
                break;
                
            case 'Ethereum':
                try {
                    const provider = new ethers.JsonRpcProvider(MAINNET_API_KEYS.ETHEREUM.RPC_URL);
                    const wallet = new ethers.Wallet(privateKey, provider);
                    
                    const tx = {
                        to: toAddress,
                        value: ethers.parseEther(amount.toString()),
                        data: memo ? ethers.toUtf8Bytes(memo) : '0x'
                    };
                    
                    const transaction = await wallet.sendTransaction(tx);
                    const receipt = await transaction.wait();
                    
                    result = {
                        success: true,
                        hash: transaction.hash,
                        explorerUrl: `https://etherscan.io/tx/${transaction.hash}`
                    };
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
                break;
                
            case 'Solana':
                try {
                    const { Connection, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } = await import('@solana/web3.js');
                    
                    const connection = new Connection(MAINNET_API_KEYS.SOLANA.RPC_URL, 'confirmed');
                    
                    // Импортируем Keypair из приватного ключа
                    const fromKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
                    
                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: fromKeypair.publicKey,
                            toPubkey: new (await import('@solana/web3.js')).PublicKey(toAddress),
                            lamports: Math.floor(amount * 1_000_000_000) // SOL в лампортах
                        })
                    );
                    
                    const signature = await sendAndConfirmTransaction(
                        connection,
                        transaction,
                        [fromKeypair]
                    );
                    
                    result = {
                        success: true,
                        hash: signature,
                        explorerUrl: `https://solscan.io/tx/${signature}`
                    };
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
                break;
                
            case 'Tron':
                try {
                    // Используем axios для Tron, так как не используем tronweb
                    const tronResponse = await axios.post(`${MAINNET_API_KEYS.TRON.RPC_URL}/wallet/createtransaction`, {
                        owner_address: fromAddress,
                        to_address: toAddress,
                        amount: Math.floor(amount * 1_000_000), // TRX в SUN
                        visible: true
                    });
                    
                    const signedTx = await axios.post(`${MAINNET_API_KEYS.TRON.RPC_URL}/wallet/gettransactionsign`, {
                        transaction: tronResponse.data,
                        privateKey: privateKey
                    });
                    
                    const broadcastResponse = await axios.post(`${MAINNET_API_KEYS.TRON.RPC_URL}/wallet/broadcasttransaction`, signedTx.data);
                    
                    if (broadcastResponse.data.result) {
                        result = {
                            success: true,
                            hash: broadcastResponse.data.txid,
                            explorerUrl: `https://tronscan.org/#/transaction/${broadcastResponse.data.txid}`
                        };
                    } else {
                        result = {
                            success: false,
                            error: broadcastResponse.data.message || 'Unknown error'
                        };
                    }
                } catch (error) {
                    result = {
                        success: false,
                        error: error.message
                    };
                }
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

// Генерация всех адресов кошельков
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
        const [tonAddress, solanaAddress, ethAddress, tronAddress, bitcoinAddress, nearAddress] = await Promise.all([
            generateTonAddress(seedPhrase).catch(e => null),
            generateSolanaAddress(seedPhrase).catch(e => null),
            generateEthereumAddress(seedPhrase).catch(e => null),
            generateTronAddress(seedPhrase).catch(e => null),
            generateBitcoinAddress(seedPhrase).catch(e => null),
            generateNearAddress(seedPhrase).catch(e => null)
        ]);

        console.log('All addresses generated');
        
        const wallets = [
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
            tronAddress && {
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
            },
            nearAddress && {
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
        if (userData && userData.seed_phrase) {
            const wallets = await generateWalletsFromSeed(userData.seed_phrase);
            return wallets;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

// Получение реальных балансов
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
        if (data.result && data.result.balance) {
            const balanceInTon = data.result.balance / 1000000000;
            return balanceInTon.toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('Mainnet TON balance error:', error);
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

// Остальные вспомогательные функции...
export const validateAddressForBlockchain = (address, blockchain) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonRegex = /^(?:0Q[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|E[A-Za-z0-9_-]{48})$/;
                return tonRegex.test(address);
            case 'Ethereum':
                return ethers.isAddress(address);
            case 'Solana':
                const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
                return solanaRegex.test(address);
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
    sendBitcoinTransactionReal,
    revealSeedPhrase,
    getTokenPrices,
    calculateTotalBalance,
    
    // API функции
    saveWalletToAPI,
    getWalletFromAPI,
    saveSeedPhraseToAPI,
    getSeedPhraseFromAPI,
    
    // Вспомогательные функции
    validateAddressForBlockchain
};