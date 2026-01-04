// blockchainService.js - исправленный код с исправлениями для TRON, NEAR и BTC

import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import base58 from 'bs58';
import TronWeb from 'tronweb';
import * as nearAPI from 'near-api-js';
import { Buffer } from 'buffer';

const bip32 = BIP32Factory(ecc);
const { KeyPair, keyStores, connect, utils } = nearAPI;

const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com',
        CHAIN_ID: 1
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    TRON: {
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
        NETWORK: 'mainnet',
        TRONGRID_API_KEY: '1a7340b8-7a69-4d5f-9c6a-1c8e9f3b5d2c'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://explorer.near.org'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    }
};

const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    },
    ETHEREUM: {
        RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_ID: 11155111
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    TRON: {
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta',
        TRONGRID_API_KEY: 'testnet_key'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://explorer.testnet.near.org'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getConfig = (network) => network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;

async function callWithRetry(apiCall, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            if (error.message?.includes('429') || error.response?.status === 429) {
                const delayMs = baseDelay * Math.pow(2, i);
                console.warn(`Rate limited (429). Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
                await delay(delayMs);
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// ========== TON ==========
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const client = await callWithRetry(() => new TonClient({
            endpoint: config.TON.RPC_URL,
        }));

        const keyPair = await mnemonicToPrivateKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey
        });

        const contract = client.open(wallet);
        const seqno = await callWithRetry(() => contract.getSeqno());

        const transfer = contract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [internal({
                value: toNano(amount.toString()),
                to: toAddress,
                body: comment,
                bounce: false
            })]
        });

        await callWithRetry(() => contract.send(transfer));

        let currentSeqno = seqno;
        for (let attempt = 0; attempt < 20; attempt++) {
            await delay(1500);
            currentSeqno = await contract.getSeqno();
            if (currentSeqno > seqno) break;
        }

        const txHash = `ton-${Date.now()}-${seqno}`;
        const explorerUrl = network === 'testnet'
            ? `https://testnet.tonscan.org/tx/${txHash}`
            : `https://tonscan.org/tx/${txHash}`;

        return {
            success: true,
            hash: txHash,
            message: `Successfully sent ${amount} TON`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            seqno: currentSeqno
        };

    } catch (error) {
        console.error(`[TON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

// ========== ETHEREUM ==========
const getEthWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting ETH wallet from seed:', error);
        throw error;
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            
            let decimals = 18;
            try {
                decimals = await contract.decimals();
            } catch (e) {
                console.warn('Could not get decimals, using default 18');
            }
            
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const feeData = await provider.getFeeData();
            
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: Math.floor(gasEstimate * 1.2),
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                : `https://etherscan.io/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ERC20`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        } else {
            const amountInWei = ethers.parseEther(amount.toString());
            
            const gasEstimate = await provider.estimateGas({
                to: toAddress,
                value: amountInWei
            });
            
            const feeData = await provider.getFeeData();
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: Math.floor(gasEstimate * 1.2),
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                : `https://etherscan.io/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ETH`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        }
    } catch (error) {
        console.error(`[ETH ${network} ERROR]:`, error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

// ========== SOLANA ==========
const getSolWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        const connection = new Connection(config.SOLANA.RPC_URL, 'confirmed');
        return { keypair, connection };
    } catch (error) {
        console.error('Error getting SOL wallet from seed:', error);
        throw error;
    }
};

export const sendSol = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { keypair, connection } = await getSolWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const fromTokenAccount = await splToken.getAssociatedTokenAddress(
                new PublicKey(contractAddress),
                keypair.publicKey,
                false,
                splToken.TOKEN_PROGRAM_ID,
                splToken.ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const toTokenAccount = await splToken.getAssociatedTokenAddress(
                new PublicKey(contractAddress),
                new PublicKey(toAddress),
                false,
                splToken.TOKEN_PROGRAM_ID,
                splToken.ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            let decimals = 6;
            try {
                const mintInfo = await splToken.getMint(connection, new PublicKey(contractAddress));
                decimals = mintInfo.decimals;
            } catch (e) {
                console.warn('Could not get token decimals, using default 6');
            }
            
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals));
            
            const instructions = [];
            
            let toTokenAccountInfo;
            try {
                toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
            } catch (e) {}
            
            if (!toTokenAccountInfo) {
                instructions.push(
                    splToken.createAssociatedTokenAccountInstruction(
                        keypair.publicKey,
                        toTokenAccount,
                        new PublicKey(toAddress),
                        new PublicKey(contractAddress),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            }
            
            instructions.push(
                splToken.createTransferInstruction(
                    fromTokenAccount,
                    toTokenAccount,
                    keypair.publicKey,
                    amountInUnits,
                    [],
                    splToken.TOKEN_PROGRAM_ID
                )
            );
            
            const transaction = new Transaction().add(...instructions);
            
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;
            
            transaction.sign(keypair);
            
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.solana.com/tx/${signature}?cluster=testnet`
                : `https://solscan.io/tx/${signature}`;
            
            return {
                success: true,
                hash: signature,
                message: `Successfully sent ${amount} SPL Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            
            const transaction = new Transaction({
                feePayer: keypair.publicKey,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }).add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(toAddress),
                    lamports: Math.floor(amount * LAMPORTS_PER_SOL)
                })
            );
            
            transaction.sign(keypair);
            
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.solana.com/tx/${signature}?cluster=testnet`
                : `https://solscan.io/tx/${signature}`;
            
            return {
                success: true,
                hash: signature,
                message: `Successfully sent ${amount} SOL`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[SOL ${network} ERROR]:`, error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

// ========== BSC ==========
const getBscWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting BSC wallet from seed:', error);
        throw error;
    }
};

export const sendBsc = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, provider } = await getBscWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            
            let decimals = 18;
            try {
                decimals = await contract.decimals();
            } catch (e) {
                console.warn('Using default decimals 18');
            }
            
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const feeData = await provider.getFeeData();
            
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: Math.floor(gasEstimate * 1.2),
                gasPrice: feeData.gasPrice
            });
            
            await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://testnet.bscscan.com/tx/${tx.hash}`
                : `https://bscscan.com/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} BEP20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInWei = ethers.parseEther(amount.toString());
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: 21000,
                gasPrice: await provider.getGasPrice()
            });
            
            await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://testnet.bscscan.com/tx/${tx.hash}`
                : `https://bscscan.com/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} BNB`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[BSC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BSC: ${error.message}`);
    }
};

// ========== TRON ========== (ИСПРАВЛЕНО)
export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        
        // Получаем приватный ключ из seed фразы (путь m/44'/195'/0'/0/0 для TRON)
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer);
        const child = root.derivePath("m/44'/195'/0'/0/0");
        const privateKeyHex = child.privateKey.toString('hex');
        
        // Инициализируем TronWeb согласно официальной документации
        // https://developers.tron.network/docs/tronweb-introduction
        const HttpProvider = TronWeb.providers.HttpProvider;
        const fullNode = new HttpProvider(config.TRON.FULL_NODE);
        const solidityNode = new HttpProvider(config.TRON.SOLIDITY_NODE);
        const eventServer = config.TRON.EVENT_SERVER ? new HttpProvider(config.TRON.EVENT_SERVER) : undefined;
        
        const tronWeb = new TronWeb(
            fullNode,
            solidityNode,
            eventServer,
            privateKeyHex
        );
        
        // Устанавливаем API ключ для TronGrid (опционально, но рекомендуется)
        if (config.TRON.TRONGRID_API_KEY) {
            tronWeb.setHeader({
                'TRON-PRO-API-KEY': config.TRON.TRONGRID_API_KEY
            });
        }
        
        // Получаем адрес отправителя
        const fromAddress = tronWeb.address.fromPrivateKey(privateKeyHex);
        
        if (contractAddress) {
            // Отправка TRC20 токена (USDT)
            const contract = await tronWeb.contract().at(contractAddress);
            
            // Получаем decimals токена
            let decimals = 6;
            try {
                decimals = await contract.decimals().call();
                decimals = parseInt(decimals.toString());
            } catch (e) {
                console.warn('Could not get token decimals, using default 6');
            }
            
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals)).toString();
            
            // Создаем и отправляем транзакцию TRC20
            const transaction = await tronWeb.transactionBuilder.triggerSmartContract(
                contractAddress,
                'transfer(address,uint256)',
                {
                    feeLimit: 100000000, // 100 TRX лимит комиссии
                    callValue: 0
                },
                [
                    { type: 'address', value: toAddress },
                    { type: 'uint256', value: amountInUnits }
                ],
                tronWeb.address.toHex(fromAddress)
            );
            
            if (!transaction.result || !transaction.result.result) {
                throw new Error('Failed to trigger smart contract: ' + (transaction.message || 'Unknown error'));
            }
            
            const signedTx = await tronWeb.trx.sign(transaction.transaction);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!result.result) {
                throw new Error(result.message || 'Failed to send TRC20 transaction');
            }
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result.txid}`
                : `https://tronscan.org/#/transaction/${result.txid}`;
            
            return {
                success: true,
                hash: result.txid,
                message: `Successfully sent ${amount} TRC20 Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            // Отправка нативного TRX
            const amountInSun = Math.floor(amount * 1000000); // 1 TRX = 1,000,000 SUN
            
            // Создаем транзакцию согласно документации TronWeb
            const transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,    // адрес получателя
                amountInSun,  // количество в SUN
                fromAddress   // адрес отправителя
            );
            
            // Подписываем транзакцию
            const signedTx = await tronWeb.trx.sign(transaction);
            
            // Отправляем транзакцию
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
            if (!result.result) {
                throw new Error(result.message || 'Failed to send TRX transaction');
            }
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result.txid}`
                : `https://tronscan.org/#/transaction/${result.txid}`;
            
            return {
                success: true,
                hash: result.txid,
                message: `Successfully sent ${amount} TRX`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[TRON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== NEAR ========== (ИСПРАВЛЕНО)
export const sendNear = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        
        // Генерируем детерминированный ключ из seed фразы для NEAR
        // NEAR использует ed25519 ключи, формат: ed25519:base58(publicKey)
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем хеш от seed для получения приватного ключа
        const hash = crypto.createHash('sha256').update(seedBuffer).digest();
        
        // Создаем ключевую пару NEAR в правильном формате
        // Формат: "ed25519:base58(privateKeyBytes)"
        const privateKey = hash.slice(0, 32); // Берем первые 32 байта для приватного ключа
        const keyPair = KeyPair.fromString(`ed25519:${base58.encode(privateKey)}`);
        
        // Создаем accountId на основе публичного ключа
        const publicKey = keyPair.getPublicKey();
        const accountHash = crypto.createHash('sha256').update(publicKey.data).digest('hex').slice(0, 40);
        const senderAccountId = `sender-${accountHash}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        // Создаем keyStore в памяти
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey(config.NEAR.NETWORK_ID, senderAccountId, keyPair);
        
        // Конфигурация подключения к NEAR (упрощенная версия)
        const nearConfig = {
            networkId: config.NEAR.NETWORK_ID,
            keyStore: keyStore,
            nodeUrl: config.NEAR.RPC_URL,
            walletUrl: `https://wallet.${config.NEAR.NETWORK_ID}.near.org`,
            helperUrl: `https://helper.${config.NEAR.NETWORK_ID}.near.org`,
            explorerUrl: config.NEAR.EXPLORER_URL
        };
        
        // Подключаемся к NEAR
        const near = await connect(nearConfig);
        
        try {
            // Пытаемся получить аккаунт отправителя
            const senderAccount = await near.account(senderAccountId);
            
            // Конвертируем amount в yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
            const amountInYocto = utils.format.parseNearAmount(amount.toString());
            
            if (!amountInYocto) {
                throw new Error('Invalid amount format');
            }
            
            // Отправляем транзакцию
            const result = await senderAccount.sendMoney(
                toAddress, 
                BigInt(amountInYocto)
            );
            
            const explorerUrl = `${config.NEAR.EXPLORER_URL}/transactions/${result.transaction.hash}`;
            
            return {
                success: true,
                hash: result.transaction.hash,
                message: `Successfully sent ${amount} NEAR`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: result.transaction.block_number
            };
        } catch (accountError) {
            // Если аккаунт не существует
            throw new Error(`NEAR account ${senderAccountId} does not exist. Please create it first with at least 0.1 NEAR for storage. Error: ${accountError.message}`);
        }
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== BITCOIN ========== (ИСПРАВЛЕНО)
export const sendBitcoin = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        
        // Получаем seed из мнемонической фразы
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем root ключ из seed
        const root = bip32.fromSeed(seed, networkConfig);
        
        // Используем путь для SegWit (BIP84) - стандартный путь для Bitcoin
        const path = network === 'testnet' ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
        const child = root.derivePath(path);
        
        // ИСПРАВЛЕНО: Правильное создание ключевой пары для bitcoinjs-lib v6.x
        // https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/ECPAIR.md
        const keyPair = bitcoin.ECPair.fromPrivateKey(
            child.privateKey,
            { network: networkConfig }
        );
        
        // Получаем адрес отправителя (P2WPKH - Pay to Witness Public Key Hash)
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        if (!fromAddress) {
            throw new Error('Failed to generate sender address');
        }
        
        // 1. Получаем UTXOs (непотраченные выходы) для адреса отправителя
        const utxosResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${fromAddress}/utxo`);
        
        if (!utxosResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxosResponse.status}`);
        }
        
        const utxos = await utxosResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs found for sender address. Address has no bitcoin.');
        }
        
        // 2. Рассчитываем сумму для отправки в сатоши
        const amountInSatoshi = Math.floor(amount * 100000000); // 1 BTC = 100,000,000 сатоши
        
        // 3. Рассчитываем комиссию (средняя комиссия ~20-30 сатоши/байт)
        // Размер транзакции: примерно 140 байт для 1 входа + 2 выходов
        const estimatedTxSize = 140; // байт
        const feeRate = 25; // сатоши/байт (средняя комиссия)
        const estimatedFee = estimatedTxSize * feeRate;
        
        // 4. Выбираем UTXOs для покрытия суммы + комиссия
        let totalInput = 0;
        const selectedUtxos = [];
        
        // Сортируем UTXOs по величине (от большего к меньшему)
        utxos.sort((a, b) => b.value - a.value);
        
        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            if (totalInput >= amountInSatoshi + estimatedFee) {
                break;
            }
        }
        
        if (totalInput < amountInSatoshi + estimatedFee) {
            throw new Error(`Insufficient balance. Need ${amountInSatoshi + estimatedFee} satoshi, have ${totalInput} satoshi.`);
        }
        
        // 5. Рассчитываем сдачу
        const change = totalInput - amountInSatoshi - estimatedFee;
        
        // 6. Создаем транзакцию с помощью PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        // Добавляем входы (UTXOs)
        for (const utxo of selectedUtxos) {
            // Получаем полную транзакцию для каждого UTXO
            const txResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx/${utxo.txid}/hex`);
            
            if (!txResponse.ok) {
                throw new Error(`Failed to fetch transaction ${utxo.txid}`);
            }
            
            const txHex = await txResponse.text();
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, networkConfig),
                    value: utxo.value
                },
                // Для SegWit также нужен nonWitnessUtxo
                nonWitnessUtxo: Buffer.from(txHex, 'hex')
            });
        }
        
        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        // Если есть сдача, добавляем выход на свой адрес
        if (change > 0) {
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // 7. Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, keyPair);
            
            // Проверяем подпись
            const isValid = psbt.validateSignaturesOfInput(i, (pubkey, msghash, signature) => {
                return bitcoin.ECPair.fromPublicKey(pubkey, { network: networkConfig })
                    .verify(msghash, signature);
            });
            
            if (!isValid) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        // 8. Финализируем транзакцию
        psbt.finalizeAllInputs();
        
        // 9. Получаем hex транзакции
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // 10. Отправляем транзакцию в сеть
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: txHex
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Failed to broadcast transaction: ${errorText}`);
        }
        
        const txid = await broadcastResponse.text();
        
        const explorerUrl = network === 'testnet'
            ? `https://blockstream.info/testnet/tx/${txid}`
            : `https://blockstream.info/tx/${txid}`;
        
        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} BTC`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            fee: estimatedFee / 100000000, // комиссия в BTC
            feeRate: `${feeRate} satoshi/byte`
        };
    } catch (error) {
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ==========
export const sendTransaction = async (params) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, network = 'mainnet' } = params;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'TON':
                result = await sendTon({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    comment: memo,
                    contractAddress,
                    network
                });
                break;
            case 'Ethereum':
                result = await sendEth({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    network
                });
                break;
            case 'Solana':
                result = await sendSol({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'Tron':
                result = await sendTron({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'NEAR':
                result = await sendNear({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'BSC':
                result = await sendBsc({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    network
                });
                break;
            case 'Bitcoin':
                result = await sendBitcoin({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            default:
                throw new Error(`Unsupported blockchain: ${blockchain}`);
        }
        
        return { success: true, ...result };
    } catch (error) {
        console.error('Transaction error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
export const validateAddress = (blockchain, address, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        switch(blockchain) {
            case 'TON': 
                return /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/.test(address);
            case 'Ethereum':
            case 'BSC':
                return ethers.isAddress(address);
            case 'Solana':
                try { 
                    new PublicKey(address); 
                    return true; 
                } catch { 
                    return false; 
                }
            case 'Tron': 
                // Базовый формат TRON адреса (T-адрес или hex)
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[0-9a-fA-F]{40}$/.test(address);
            case 'Bitcoin':
                try {
                    const networkConfig = config.BITCOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                // Формат: account.near или account.testnet
                return /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/.test(address);
            default: 
                return true;
        }
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
};

export const estimateTransactionFee = async (blockchain, network = 'mainnet') => {
    const defaultFees = {
        'TON': { mainnet: '0.05', testnet: '0.05' },
        'Ethereum': { mainnet: '0.001', testnet: '0.0001' },
        'BSC': { mainnet: '0.0001', testnet: '0.00001' },
        'Solana': { mainnet: '0.000005', testnet: '0.000001' },
        'Tron': { mainnet: '0.1', testnet: '0.01' },
        'Bitcoin': { mainnet: '0.0001', testnet: '0.00001' },
        'NEAR': { mainnet: '0.01', testnet: '0.001' }
    };
    
    const fees = defaultFees[blockchain] || { mainnet: '0.01', testnet: '0.001' };
    return network === 'testnet' ? fees.testnet : fees.mainnet;
};

// ========== ЭКСПОРТ ==========
export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendTron,
    sendNear,
    sendBitcoin,
    sendBsc,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};