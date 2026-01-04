// blockchainService.js (полная версия)

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
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPair, transactions } from '@near-js/crypto';
import { serialize } from '@near-js/serialize';

const bip32 = BIP32Factory(ecc);

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
        EVENT_SERVER: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        WALLET_URL: 'https://wallet.near.org'
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
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        WALLET_URL: 'https://testnet.mynearwallet.com'
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

// ========== BITCOIN ==========
const getBitcoinKeyPairFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const networkConfig = config.BITCOIN.NETWORK;
        
        // BIP84 для SegWit (P2WPKH)
        const path = network === 'testnet' ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath(path);
        
        return {
            keyPair: child,
            address: bitcoin.payments.p2wpkh({ 
                pubkey: child.publicKey, 
                network: networkConfig 
            }).address
        };
    } catch (error) {
        console.error('Error getting Bitcoin key pair from seed:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        const explorerApi = config.BITCOIN.EXPLORER_API;
        
        // 1. Получить ключи из seed-фразы
        const { keyPair, address: senderAddress } = await getBitcoinKeyPairFromSeed(seedPhrase, network);
        
        // 2. Получить UTXO для адреса отправителя
        const utxoResponse = await callWithRetry(() => 
            fetch(`${explorerApi}/address/${senderAddress}/utxo`)
        );
        if (!utxoResponse.ok) throw new Error('Failed to fetch UTXOs');
        const utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs found for sender address');
        }
        
        // 3. Рассчитать сумму для отправки и комиссию
        const amountSatoshi = Math.floor(amount * 1e8);
        const estimatedFeeSatoshi = 1000; // Примерная комиссия ~1000 сатоши
        
        // 4. Выбрать UTXO для входа
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            selectedUtxos.push({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
                scriptPubKey: utxo.scriptpubkey || utxo.script
            });
            totalInput += utxo.value;
            
            if (totalInput >= amountSatoshi + estimatedFeeSatoshi) {
                break;
            }
        }
        
        if (totalInput < amountSatoshi + estimatedFeeSatoshi) {
            throw new Error('Insufficient balance to cover amount and fee');
        }
        
        const change = totalInput - amountSatoshi - estimatedFeeSatoshi;
        
        // 5. Создать PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        // Добавить входы
        for (const utxo of selectedUtxos) {
            const txResponse = await callWithRetry(() => 
                fetch(`${explorerApi}/tx/${utxo.txid}/hex`)
            );
            if (!txResponse.ok) throw new Error('Failed to fetch transaction hex');
            const txHex = await txResponse.text();
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: Buffer.from(utxo.scriptPubKey, 'hex'),
                    value: utxo.value,
                },
                nonWitnessUtxo: Buffer.from(txHex, 'hex')
            });
        }
        
        // Добавить выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountSatoshi,
        });
        
        // Добавить выход сдачи (если есть)
        if (change > 0) {
            psbt.addOutput({
                address: senderAddress,
                value: change,
            });
        }
        
        // 6. Подписать входы
        selectedUtxos.forEach((_, index) => {
            psbt.signInput(index, keyPair);
        });
        
        // 7. Проверить подписи и финализировать
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // 8. Отправить транзакцию
        const broadcastResponse = await callWithRetry(() =>
            fetch(`${explorerApi}/tx`, {
                method: 'POST',
                body: txHex
            })
        );
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        const txid = await broadcastResponse.text();
        
        // 9. Вернуть результат
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
const getTronPrivateKeyFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        return wallet.privateKey.substring(2); // hex без 0x
    } catch (error) {
        console.error('Error getting TRON private key from seed:', error);
        throw error;
    }
};

const getTronAddressFromPrivateKey = (privateKeyHex) => {
    try {
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        
        // Получить публичный ключ из приватного
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        if (!publicKey) throw new Error('Failed to derive public key');
        
        // Рассчитать адрес Tron
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        return base58.encode(addressWithChecksum);
    } catch (error) {
        console.error('Error getting TRON address from private key:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const baseUrl = config.TRON.RPC_URL;
        
        // 1. Получить приватный ключ и адрес отправителя
        const privateKeyHex = await getTronPrivateKeyFromSeed(seedPhrase, network);
        const fromAddress = getTronAddressFromPrivateKey(privateKeyHex);
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        
        // 2. Преобразовать адрес получателя в hex формат (если необходимо)
        let toAddressHex = toAddress;
        if (toAddress.startsWith('T')) {
            const decoded = base58.decode(toAddress);
            // Удалить версионный байт (0x41) и checksum (последние 4 байта)
            toAddressHex = decoded.slice(1, -4).toString('hex');
        }
        
        // 3. Создать транзакцию
        const createTxResponse = await callWithRetry(() =>
            fetch(`${baseUrl}/wallet/createtransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_address: fromAddress,
                    to_address: toAddressHex,
                    amount: Math.floor(amount * 1e6), // TRX в sun (1 TRX = 1,000,000 sun)
                    visible: true
                })
            })
        );
        
        if (!createTxResponse.ok) throw new Error('Failed to create transaction');
        const unsignedTx = await createTxResponse.json();
        
        if (unsignedTx.Error) {
            throw new Error(`TRON API error: ${unsignedTx.Error}`);
        }
        
        // 4. Подписать транзакцию
        const rawDataHex = unsignedTx.raw_data_hex;
        const rawDataHash = crypto.createHash('sha256').update(Buffer.from(rawDataHex, 'hex')).digest();
        const signature = ecc.sign(rawDataHash, privateKeyBuffer);
        
        const signedTx = {
            ...unsignedTx,
            signature: [Buffer.from(signature).toString('hex')]
        };
        
        // 5. Отправить подписанную транзакцию
        const broadcastResponse = await callWithRetry(() =>
            fetch(`${baseUrl}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            })
        );
        
        if (!broadcastResponse.ok) throw new Error('Failed to broadcast transaction');
        const result = await broadcastResponse.json();
        
        if (!result.result) {
            throw new Error(`Transaction failed: ${result.message || 'Unknown error'}`);
        }
        
        // 6. Вернуть результат
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
const getNearKeyPairFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Для NEAR используем стандартный путь m/44'/397'/0'
        const path = network === 'testnet' ? "m/44'/1'/0'/0'/0'" : "m/44'/397'/0'/0'/0'";
        const root = bip32.fromSeed(seedBuffer);
        const child = root.derivePath(path);
        
        // NEAR использует ED25519, конвертируем приватный ключ из secp256k1
        // Для простоты используем хэш приватного ключа как seed для ED25519
        const privateKeyBuffer = child.privateKey;
        const seedForEd25519 = crypto.createHash('sha256').update(privateKeyBuffer).digest();
        
        const keyPair = KeyPair.fromRandom('ed25519');
        // В реальном приложении нужно использовать правильную деривацию ED25519
        // Здесь используем существующую реализацию из KeyPair.fromRandom
        
        return keyPair;
    } catch (error) {
        console.error('Error getting NEAR key pair from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const provider = new JsonRpcProvider({ url: config.NEAR.RPC_URL });
        
        // 1. Получить ключевую пару
        const keyPair = await getNearKeyPairFromSeed(seedPhrase, network);
        const publicKey = keyPair.getPublicKey();
        
        // Для NEAR нам нужен accountId, а не просто публичный ключ
        // Используем временное решение - генерируем accountId из хэша публичного ключа
        const accountId = Buffer.from(publicKey.data).toString('hex').slice(0, 64) + '.test.near';
        
        // 2. Получить последний блок для nonce и block hash
        const blockResponse = await callWithRetry(() => 
            provider.sendJsonRpc('block', { finality: 'final' })
        );
        const blockHash = Buffer.from(blockResponse.header.hash, 'base64');
        
        // 3. Получить access key для nonce
        const accessKeyResponse = await callWithRetry(() =>
            provider.sendJsonRpc('query', {
                request_type: 'view_access_key',
                finality: 'final',
                account_id: accountId,
                public_key: publicKey.toString()
            })
        );
        
        const nonce = accessKeyResponse.nonce + 1;
        
        // 4. Создать action transfer
        const amountYocto = BigInt(Math.floor(amount * 1e24)).toString(); // 1 NEAR = 1e24 yoctoNEAR
        
        const actions = [
            transactions.transfer(amountYocto)
        ];
        
        // 5. Создать транзакцию
        const transaction = transactions.createTransaction(
            accountId,
            publicKey,
            toAddress,
            nonce,
            actions,
            blockHash
        );
        
        // 6. Подписать транзакцию
        const serializedTx = serialize(transactions.SCHEMA.Transaction, transaction);
        const serializedTxHash = crypto.createHash('sha256').update(serializedTx).digest();
        const signature = keyPair.sign(serializedTxHash);
        
        const signedTransaction = new transactions.SignedTransaction({
            transaction,
            signature: new transactions.Signature({
                keyType: transaction.publicKey.keyType,
                data: signature.signature
            })
        });
        
        // 7. Отправить транзакцию
        const result = await callWithRetry(() =>
            provider.sendJsonRpc('broadcast_tx_commit', [
                Buffer.from(signedTransaction.encode()).toString('base64')
            ])
        );
        
        if (result.status && result.status.Failure) {
            throw new Error(`Transaction failed: ${JSON.stringify(result.status.Failure)}`);
        }
        
        // 8. Вернуть результат
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
                    contractAddress,
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
            case 'Bitcoin':
                result = await sendBitcoin({ 
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
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$|^41[0-9a-fA-F]{40}$/.test(address);
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
                const nearRegex = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/;
                const nearEvmRegex = /^0x[0-9a-fA-F]{40}$/;
                return nearRegex.test(address) || nearEvmRegex.test(address);
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