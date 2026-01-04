// blockchainService.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as nearAPI from 'near-api-js';
// Импортируем TronWeb по умолчанию для совместимости с CommonJS
import TronWeb from 'tronweb';

// Инициализация bip32 с криптографией
const bip32 = BIP32Factory(ecc);

// КОНФИГУРАЦИЯ СЕТЕЙ (с вашим TRON API ключом)
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
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    },
    TRON: {
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
        API_KEY: '9298de9d-5ebf-4b3b-a382-d99d35187c93' // Ваш ключ добавлен сюда
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
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
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    TRON: {
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        API_KEY: '9298de9d-5ebf-4b3b-a382-d99d35187c93' // Ключ для тестнета (может использоваться тот же)
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
    }
};

// Вспомогательные функции
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
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // 1. Генерируем приватный ключ из seed-фразы через ethers
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKeyHex = wallet.privateKey.substring(2); // Убираем "0x"
        
        // 2. Инициализируем TronWeb КОРРЕКТНО
        // Конструктор ожидает объект с fullHost, а не каждый хост отдельно
        const tronWeb = new TronWeb({
            fullHost: config.TRON.FULL_NODE, // Используем только FULL_NODE
            headers: { "TRON-PRO-API-KEY": config.TRON.API_KEY }
        });
        
        // 3. Импортируем аккаунт с приватным ключом
        const account = tronWeb.address.fromPrivateKey(privateKeyHex);
        
        // Устанавливаем адрес по умолчанию и приватный ключ
        tronWeb.setAddress(account);
        tronWeb.setPrivateKey(privateKeyHex);
        
        return { tronWeb, account, privateKey: privateKeyHex };
        
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { tronWeb, account } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Проверяем, инициализирован ли TronWeb
        if (!tronWeb.defaultAddress || !tronWeb.defaultAddress.base58) {
            throw new Error('TronWeb not properly initialized');
        }
        
        if (contractAddress) {
            // Отправка TRC20 токена
            const contract = await tronWeb.contract().at(contractAddress);
            
            // Конвертируем amount в минимальные единицы (у большинства TRC20 6 decimals)
            const amountInSun = tronWeb.toSun(amount); // toSun конвертирует TRX, для токенов нужно умножить
            
            // Для USDT TRC20 (6 decimals) используем правильный множитель
            const decimals = 6; // Для USDT на TRON
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals));
            
            console.log(`Sending TRC20: ${amount} = ${amountInUnits} units to ${toAddress}`);
            
            const result = await contract.transfer(toAddress, amountInUnits).send({
                feeLimit: 100_000_000, // Ограничение комиссии (в SUN)
                callValue: 0
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result}`
                : `https://tronscan.org/#/transaction/${result}`;
            
            return {
                success: true,
                hash: result,
                message: `Successfully sent ${amount} TRC20 Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            // Отправка нативных TRX
            const amountInSun = tronWeb.toSun(amount); // Конвертируем в SUN (1 TRX = 1,000,000 SUN)
            
            console.log(`Sending TRX: ${amount} TRX = ${amountInSun} SUN from ${account} to ${toAddress}`);
            
            // Используем transactionBuilder для создания транзакции[citation:3]
            const transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                account
            );
            
            // Подписываем транзакцию[citation:3]
            const signedTransaction = await tronWeb.trx.sign(transaction);
            
            // Отправляем подписанную транзакцию
            const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
            
            if (!result.result) {
                throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
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
        throw new Error(`Failed to send TRON: ${error.message}`);
    }
};

// ========== BITCOIN ========== (ИСПРАВЛЕНО)
const getBitcoinWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0"); // Путь для SegWit (bech32)
        
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: config.BITCOIN.NETWORK
        });
        
        return { 
            keyPair: child, 
            network: config.BITCOIN.NETWORK,
            address: address 
        };
    } catch (error) {
        console.error('Error getting Bitcoin wallet from seed:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, network: btcNetwork, address: senderAddress } = await getBitcoinWalletFromSeed(seedPhrase, network);
        
        // 1. Получаем UTXOs отправителя
        const utxoResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${senderAddress}/utxo`);
        if (!utxoResponse.ok) throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        
        const utxos = await utxoResponse.json();
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available for this address');
        }
        
        // 2. Создаем PSBT
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        // 3. Рассчитываем общий баланс и добавляем inputs
        let totalInput = BigInt(0);
        const inputs = [];
        
        for (const utxo of utxos) {
            // Получаем полную информацию о транзакции для проверки скрипта
            const txResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/tx/${utxo.txid}/hex`);
            if (!txResponse.ok) continue;
            
            const txHex = await txResponse.text();
            const tx = bitcoin.Transaction.fromHex(txHex);
            
            // Создаем скрипт для P2WPKH
            const p2wpkh = bitcoin.payments.p2wpkh({
                pubkey: keyPair.publicKey,
                network: btcNetwork
            });
            
            // Подготавливаем witnessUtxo с правильными типами данных
            const witnessUtxo = {
                script: p2wpkh.output,
                value: BigInt(utxo.value) // Конвертируем в BigInt
            };
            
            // Добавляем input в PSBT с КОРРЕКТНЫМ форматом witnessUtxo
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: witnessUtxo // Правильный формат: { script: Buffer, value: BigInt }
            });
            
            totalInput += BigInt(utxo.value);
            inputs.push(utxo);
            
            // Проверяем, достаточно ли средств
            const amountSats = BigInt(Math.floor(amount * 100_000_000));
            const estimatedFee = BigInt(1000); // Консервативная оценка комиссии
            
            if (totalInput >= amountSats + estimatedFee) {
                break;
            }
        }
        
        const amountSats = BigInt(Math.floor(amount * 100_000_000));
        const fee = BigInt(500); // Базовая комиссия
        
        if (totalInput < amountSats + fee) {
            throw new Error(`Insufficient balance. Available: ${Number(totalInput) / 100_000_000} BTC, Needed: ${amount} BTC + fee`);
        }
        
        // 4. Добавляем output для получателя
        psbt.addOutput({
            address: toAddress,
            value: Number(amountSats) // Конвертируем BigInt в Number для addOutput
        });
        
        // 5. Добавляем change output (сдача)
        const change = totalInput - amountSats - fee;
        if (change > BigInt(1000)) { // Добавляем change только если он значительный
            psbt.addOutput({
                address: senderAddress,
                value: Number(change)
            });
        }
        
        // 6. Подписываем все inputs
        for (let i = 0; i < inputs.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        // 7. Финализируем и извлекаем транзакцию
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // 8. Отправляем транзакцию
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Failed to broadcast transaction: ${broadcastResponse.status} - ${errorText}`);
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
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[BITCOIN ${network} ERROR]:`, error);
        throw new Error(`Failed to send Bitcoin: ${error.message}`);
    }
};

// ========== NEAR ========== (ИСПРАВЛЕНО для EVM аккаунтов)
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем EVM-адрес из seed-фразы (как в storageService.js)
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const evmAddress = wallet.address.toLowerCase(); // "0x..." формат
        
        // Для NEAR EVM используем обычный EVM адрес без .testnet/.near
        const accountId = evmAddress; // Используем чистый EVM адрес, как в вашем примере
        
        const nearConfig = {
            networkId: config.NEAR.NETWORK_ID,
            nodeUrl: config.NEAR.RPC_URL,
            walletUrl: `https://wallet.${config.NEAR.NETWORK_ID}.near.org`,
            helperUrl: config.NEAR.HELPER_URL,
        };
        
        // Подключаемся к NEAR
        const near = await nearAPI.connect(nearConfig);
        
        // Пытаемся получить аккаунт
        let account;
        try {
            account = await near.account(accountId);
        } catch (error) {
            // Если аккаунт не существует, создаем объект с адресом для информации
            console.warn(`NEAR account ${accountId} does not exist yet. It will be created on first transfer.`);
            account = null;
        }
        
        return { 
            near, 
            account,
            accountId, // EVM адрес в формате "0x..."
            keyPair: null // Для EVM аккаунтов ключ управляется через Ethereum
        };
        
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { near, account, accountId } = await getNearWalletFromSeed(seedPhrase, network);
        
        // Если аккаунт отправителя не существует, выбрасываем ошибку
        if (!account) {
            throw new Error(`Sender account ${accountId} does not exist on NEAR. Please fund it first (send some NEAR to this address to activate it).`);
        }
        
        // Определяем адрес получателя
        // Если toAddress начинается с "0x...", это EVM адрес
        // В противном случае, предполагаем это обычный NEAR аккаунт
        const recipientAddress = toAddress.startsWith('0x') 
            ? toAddress.toLowerCase() // EVM адрес в нижнем регистре
            : toAddress; // Обычный NEAR аккаунт
        
        console.log(`Sending ${amount} NEAR from ${accountId} to ${recipientAddress}`);
        
        // Конвертируем amount в yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const amountInYocto = nearAPI.utils.format.parseNearAmount(amount.toString());
        
        if (!amountInYocto) {
            throw new Error('Invalid amount format');
        }
        
        // Отправляем транзакцию
        const result = await account.sendMoney(
            recipientAddress, // Отправляем напрямую на адрес получателя
            amountInYocto
        );
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/txns/${result.transaction.hash}`
            : `https://nearblocks.io/txns/${result.transaction.hash}`;
        
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        
        // Более информативные сообщения об ошибках
        if (error.message.includes('does not exist')) {
            throw new Error(`Account does not exist. Please ensure the sender account has been activated by sending some NEAR to it first.`);
        }
        
        throw new Error(`Failed to send NEAR: ${error.message}`);
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
            case 'BSC':
                result = await sendBsc({ 
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
            case 'Bitcoin':
                result = await sendBitcoin({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'NEAR':
                result = await sendNear({ 
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

// ========== ВАЛИДАЦИЯ АДРЕСОВ ==========
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
                // Tron адреса начинаются с T (mainnet: 'T', testnet: 'T' для Shasta)
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                try {
                    const networkConfig = config.BITCOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'NEAR':
                // Для NEAR принимаем как EVM адреса (0x...), так и обычные NEAR аккаунты
                const nearAccountRegex = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/;
                const evmAddressRegex = /^0x[0-9a-fA-F]{40}$/;
                return nearAccountRegex.test(address) || evmAddressRegex.test(address);
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
    sendBsc,
    sendTron,
    sendBitcoin,
    sendNear,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};