// blockchainService.js
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import { KeyPair, connect, keyStores, utils } from 'near-api-js';

// Инициализация bip32 с криптографией
const bip32 = BIP32Factory(ecc);

// Конфигурация сетей
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
        RPC_URL: 'https://api.trongrid.io',
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api'
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
        RPC_URL: 'https://api.shasta.trongrid.io',
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api'
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

// ========== BITCOIN ==========
const getBitcoinWalletFromSeed = (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        
        // Генерируем seed из мнемонической фразы
        const seedBuffer = bip39.mnemonicToSeedSync(seedPhrase);
        
        // Создаем корневой узел HD
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        
        // Используем BIP84 путь для SegWit (bech32 адреса)
        const derivationPath = network === 'testnet' ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
        const child = root.derivePath(derivationPath);
        
        // Создаем ключевую пару
        const keyPair = bitcoin.ECPair.fromPrivateKey(child.privateKey, { network: networkConfig });
        
        // Генерируем P2WPKH адрес (bech32)
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: networkConfig
        });
        
        return {
            keyPair,
            address,
            child,
            network: networkConfig
        };
    } catch (error) {
        console.error('Error getting Bitcoin wallet:', error);
        throw error;
    }
};

const getBitcoinUtxos = async (address, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${address}/utxo`);
        if (!response.ok) throw new Error('Failed to fetch UTXOs');
        return await response.json();
    } catch (error) {
        console.error('Error getting Bitcoin UTXOs:', error);
        throw error;
    }
};

const getBitcoinTransaction = async (txid, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/tx/${txid}`);
        if (!response.ok) throw new Error('Failed to fetch transaction');
        return await response.json();
    } catch (error) {
        console.error('Error getting Bitcoin transaction:', error);
        throw error;
    }
};

const broadcastBitcoinTransaction = async (txHex, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error broadcasting Bitcoin transaction:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`Starting Bitcoin send: ${amount} BTC to ${toAddress} on ${network}`);
        
        // Получаем кошелек
        const wallet = getBitcoinWalletFromSeed(seedPhrase, network);
        console.log('From address:', wallet.address);
        
        // Получаем UTXOs
        const utxos = await getBitcoinUtxos(wallet.address, network);
        console.log('UTXOs found:', utxos.length);
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available for this address');
        }
        
        // Рассчитываем сумму в сатоши
        const amountInSatoshi = Math.floor(amount * 100000000);
        console.log('Amount in satoshi:', amountInSatoshi);
        
        // Сортируем UTXOs по убыванию (наибольшие первыми)
        utxos.sort((a, b) => b.value - a.value);
        
        // Собираем достаточное количество UTXOs
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            // Проверяем, хватает ли средств с учетом комиссии
            const estimatedFee = 1000; // Базовая комиссия
            if (totalInput >= amountInSatoshi + estimatedFee) {
                break;
            }
        }
        
        console.log('Total input:', totalInput, 'Selected UTXOs:', selectedUtxos.length);
        
        // Проверяем баланс
        const estimatedFee = 1000; // Базовая комиссия
        if (totalInput < amountInSatoshi + estimatedFee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + estimatedFee) / 1e8} BTC, Have: ${totalInput / 1e8} BTC`);
        }
        
        // Создаем PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: wallet.network });
        
        // Добавляем входы
        for (const utxo of selectedUtxos) {
            // Получаем полную информацию о транзакции для witnessUtxo
            const tx = await getBitcoinTransaction(utxo.txid, network);
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(wallet.address, wallet.network),
                    value: utxo.value
                },
                nonWitnessUtxo: Buffer.from(tx.hex, 'hex')
            });
        }
        
        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        // Рассчитываем и добавляем сдачу
        const fee = 1000; // Фиксированная комиссия
        const change = totalInput - amountInSatoshi - fee;
        
        if (change > 0) {
            psbt.addOutput({
                address: wallet.address,
                value: change
            });
        }
        
        console.log('PSBT created, signing inputs...');
        
        // Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, wallet.keyPair);
        }
        
        // Проверяем подписи
        for (let i = 0; i < selectedUtxos.length; i++) {
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        // Финализируем PSBT
        psbt.finalizeAllInputs();
        
        // Извлекаем готовую транзакцию
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        console.log('Transaction ready, broadcasting...');
        
        // Отправляем транзакцию
        const txid = await broadcastBitcoinTransaction(txHex, network);
        
        console.log('Transaction broadcasted, txid:', txid);
        
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
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// ========== TRON ==========
const getTronPrivateKeyFromSeed = async (seedPhrase) => {
    try {
        // Генерируем seed из мнемонической фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем HD кошелек Ethereum (TRON использует тот же путь)
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем путь для TRON: m/44'/195'/0'/0/0
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        
        // Возвращаем приватный ключ без 0x префикса
        return wallet.privateKey.slice(2);
    } catch (error) {
        console.error('Error getting TRON private key:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const privateKey = await getTronPrivateKeyFromSeed(seedPhrase);
        
        console.log(`Starting TRON send: ${amount} TRX to ${toAddress} on ${network}`);
        
        // Динамически импортируем tronweb для избежания проблем с SSR
        const TronWeb = (await import('tronweb')).default;
        
        // Инициализируем TronWeb
        const tronWeb = new TronWeb({
            fullHost: config.TRON.RPC_URL,
            headers: { 'TRON-PRO-API-KEY': 'your-api-key-here' }
        });
        
        // Устанавливаем приватный ключ
        tronWeb.setPrivateKey(privateKey);
        
        // Получаем адрес отправителя
        const fromAddress = tronWeb.address.fromPrivateKey(privateKey);
        console.log('From address:', fromAddress);
        
        // Конвертируем сумму в SUN (1 TRX = 1,000,000 SUN)
        const amountInSun = tronWeb.toSun(amount);
        console.log('Amount in SUN:', amountInSun);
        
        // Создаем транзакцию через tronGrid API
        const createTxUrl = `${config.TRON.RPC_URL}/wallet/createtransaction`;
        const txData = {
            owner_address: fromAddress,
            to_address: toAddress,
            amount: amountInSun,
            visible: true
        };
        
        console.log('Creating transaction...');
        const createResponse = await fetch(createTxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txData)
        });
        
        if (!createResponse.ok) {
            throw new Error(`Failed to create transaction: ${createResponse.status}`);
        }
        
        const transaction = await createResponse.json();
        
        if (transaction.Error) {
            throw new Error(`Transaction error: ${transaction.Error}`);
        }
        
        // Подписываем транзакцию
        console.log('Signing transaction...');
        const signedTransaction = await tronWeb.trx.sign(transaction);
        
        // Отправляем подписанную транзакцию
        const sendTxUrl = `${config.TRON.RPC_URL}/wallet/broadcasttransaction`;
        const sendResponse = await fetch(sendTxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(signedTransaction)
        });
        
        if (!sendResponse.ok) {
            throw new Error(`Failed to broadcast transaction: ${sendResponse.status}`);
        }
        
        const result = await sendResponse.json();
        
        if (!result.result) {
            throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
        }
        
        console.log('Transaction successful, txid:', result.txid);
        
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
        
    } catch (error) {
        console.error(`[TRON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== NEAR ==========
const getNearAccountFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем Ethereum-подобный адрес из seed phrase
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        // Используем Ethereum адрес как идентификатор аккаунта NEAR
        const accountId = wallet.address.toLowerCase();
        
        // Создаем in-memory keystore
        const keyStore = new keyStores.InMemoryKeyStore();
        
        // Генерируем ключевую пару ED25519 для NEAR
        const keyPair = KeyPair.fromRandom('ed25519');
        
        // Сохраняем ключ в keystore
        await keyStore.setKey(config.NEAR.NETWORK_ID, accountId, keyPair);
        
        // Создаем подключение к NEAR
        const nearConnection = await connect({
            networkId: config.NEAR.NETWORK_ID,
            keyStore: keyStore,
            nodeUrl: config.NEAR.RPC_URL,
            helperUrl: config.NEAR.HELPER_URL,
            walletUrl: `https://wallet.${config.NEAR.NETWORK_ID}.near.org`
        });
        
        // Получаем аккаунт
        const account = await nearConnection.account(accountId);
        
        return {
            account,
            accountId,
            keyPair,
            nearConnection
        };
    } catch (error) {
        console.error('Error getting NEAR account:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`Starting NEAR send: ${amount} NEAR to ${toAddress} on ${network}`);
        
        // Получаем аккаунт отправителя
        const { account, accountId } = await getNearAccountFromSeed(seedPhrase, network);
        console.log('From account:', accountId);
        
        // Проверяем, существует ли аккаунт отправителя
        try {
            await account.state();
        } catch (error) {
            if (error.message.includes('does not exist')) {
                throw new Error('Sender account does not exist on NEAR. Fund it first with at least 0.1 NEAR');
            }
            throw error;
        }
        
        // Конвертируем сумму в yoctoNEAR
        const amountInYocto = utils.format.parseNearAmount(amount.toString());
        if (!amountInYocto) {
            throw new Error('Invalid amount');
        }
        
        console.log('Amount in yoctoNEAR:', amountInYocto);
        
        // Для NEAR EVM-адресов (0x...) мы отправляем напрямую, без преобразования
        if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
            throw new Error('NEAR recipient must be a valid 0x... address (42 characters)');
        }
        
        // Отправляем транзакцию
        console.log('Sending transaction...');
        const result = await account.sendMoney(toAddress, amountInYocto);
        
        console.log('Transaction result:', result);
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/ru/txns/${result.transaction.hash}`
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
        
        if (error.message.includes('does not exist')) {
            throw new Error('Account does not exist on NEAR network');
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
            case 'Tron':
                result = await sendTron({ 
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
                // Проверяем обычный TRON адрес (T...) или hex адрес
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[0-9a-fA-F]{40}$/.test(address);
            case 'Bitcoin':
                try {
                    const networkConfig = network === 'testnet' 
                        ? bitcoin.networks.testnet 
                        : bitcoin.networks.bitcoin;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'NEAR':
                // Для NEAR принимаем Ethereum-подобные адреса (0x...) - 42 символа
                return /^0x[0-9a-fA-F]{40}$/.test(address);
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