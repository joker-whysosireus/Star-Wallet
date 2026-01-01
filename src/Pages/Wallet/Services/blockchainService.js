import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import { providers, KeyPair, keyStores, transactions, utils } from 'near-api-js';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        API_KEY: ''
    },
    ETHEREUM: {
        RPC_URL: 'https://rpc.ankr.com/eth',
        CHAIN_ID: 1
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    }
};

// === КОНФИГУРАЦИЯ TESTNET ===
const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_KEY: ''
    },
    ETHEREUM: {
        RPC_URL: 'https://rpc.sepolia.org',
        CHAIN_ID: 11155111
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://testnet.nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    }
};

// === ТОКЕНЫ ДЛЯ ОТПРАВКИ ===
const TRANSACTION_TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' 
    }
};

// === УТИЛИТЫ ДЛЯ ПОЛУЧЕНИЯ КОШЕЛЬКОВ ИЗ SEED-ФРАЗЫ ===
const getTonWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new TonClient({
            endpoint: config.TON.RPC_URL
        });
        return { wallet: client.open(wallet), keyPair };
    } catch (error) {
        console.error('Error getting TON wallet from seed:', error);
        throw error;
    }
};

const getEthWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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

const getSolWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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

const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const TronWeb = (await import('tronweb')).default;
        
        const tronWeb = new TronWeb({ 
            fullHost: config.TRON.RPC_URL,
            privateKey: privateKey
        });
        
        return { tronWeb, privateKey };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = Buffer.from(seedBuffer).toString('hex').slice(0, 64);
        
        const keyPair = KeyPair.fromRandom('ed25519');
        
        const publicKey = keyPair.getPublicKey();
        const accountId = `evm.${Buffer.from(publicKey.data).toString('hex').slice(0, 40)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        const keyStore = new keyStores.InMemoryKeyStore();
        await keyStore.setKey(config.NEAR.NETWORK_ID, accountId, keyPair);
        
        const provider = new providers.JsonRpcProvider(config.NEAR.RPC_URL);
        
        return { 
            accountId, 
            keyPair, 
            keyStore, 
            provider 
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ BITCOIN ===
const getBitcoinUTXOs = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${address}/utxo`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch UTXOs: ${response.status}`);
        }
        
        const utxos = await response.json();
        return utxos.map(utxo => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value
        }));
    } catch (error) {
        console.error('Error getting Bitcoin UTXOs:', error);
        throw error;
    }
};

const broadcastBitcoinTransaction = async (rawTx, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: rawTx
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to broadcast transaction: ${response.status} - ${errorText}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error broadcasting Bitcoin transaction:', error);
        throw error;
    }
};

// === ОСНОВНЫЕ ФУНКЦИИ ОТПРАВКИ ===
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', network = 'mainnet' }) => {
    try {
        console.log(`[TON ${network}] Sending ${amount} TON to ${toAddress}`);
        const { wallet, keyPair } = await getTonWalletFromSeed(seedPhrase, network);
        
        const seqno = await wallet.getSeqno();
        const amountInNano = toNano(amount);

        const transfer = wallet.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: toAddress,
                    value: amountInNano,
                    body: comment,
                    bounce: false
                })
            ]
        });

        await wallet.send(transfer);

        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
            
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
                    const explorerUrl = network === 'testnet' 
                        ? `https://testnet.tonscan.org/tx/${toAddress}`
                        : `https://tonscan.org/tx/${toAddress}`;
                    
                    return {
                        success: true,
                        hash: `seqno_${seqno}`,
                        message: `Successfully sent ${amount} TON`,
                        explorerUrl,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                console.warn(`Attempt ${attempts}: Error checking transaction status:`, error);
                continue;
            }
        }

        throw new Error('Transaction confirmation timeout');
        
    } catch (error) {
        console.error(`[TON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[NEAR ${network}] Sending ${amount} NEAR to ${toAddress}`);
        
        const { accountId, keyPair, keyStore, provider } = await getNearWalletFromSeed(seedPhrase, network);
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        let recipientAccountId = toAddress;
        if (toAddress.startsWith('0x')) {
            recipientAccountId = `evm.${toAddress.slice(2).toLowerCase()}.${network === 'testnet' ? 'testnet' : 'near'}`;
        } else if (!toAddress.includes('.')) {
            recipientAccountId = `${toAddress}.${network === 'testnet' ? 'testnet' : 'near'}`;
        }
        
        const blockInfo = await provider.block({ finality: 'final' });
        const blockHash = blockInfo.header.hash;
        
        const actions = [
            transactions.transfer(utils.format.parseNearAmount(amount.toString()))
        ];
        
        const transaction = transactions.createTransaction(
            accountId,
            keyPair.getPublicKey(),
            recipientAccountId,
            1,
            actions,
            blockHash
        );
        
        const signedTx = await transactions.signTransaction(
            transaction,
            keyPair.getPublicKey(),
            keyPair
        );
        
        const result = await provider.sendTransaction(signedTx);
        
        const explorerUrl = network === 'testnet'
            ? `${config.NEAR.EXPLORER_URL}/txns/${result.transaction.hash}`
            : `${config.NEAR.EXPLORER_URL}/txns/${result.transaction.hash}`;
        
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR to ${recipientAccountId}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            const decimals = await contract.decimals();
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits);
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
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount.toString())
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

export const sendSol = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const { keypair, connection } = await getSolWalletFromSeed(seedPhrase, network);
        
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
    } catch (error) {
        console.error(`[SOL ${network} ERROR]:`, error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { tronWeb } = await getTronWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const contract = await tronWeb.contract().at(contractAddress);
            const decimals = await contract.decimals().call();
            const amountInUnits = Math.floor(amount * Math.pow(10, parseInt(decimals.toString())));
            const tx = await contract.transfer(toAddress, amountInUnits.toString()).send({
                feeLimit: 100_000_000
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${tx}`
                : `https://tronscan.org/#/transaction/${tx}`;
            
            return {
                success: true,
                hash: tx,
                message: `Successfully sent ${amount} TRC20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInSun = Math.floor(amount * 1_000_000);
            const tx = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                tronWeb.defaultAddress.base58
            );
            const signedTx = await tronWeb.trx.sign(tx);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
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
        throw new Error(`Failed to send: ${error.message}`);
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[BTC ${network}] Sending ${amount} BTC to ${toAddress}`);
        
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const networkConfig = config.BITCOIN.NETWORK;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        const utxos = await getBitcoinUTXOs(fromAddress, network);
        if (utxos.length === 0) {
            throw new Error('No UTXOs found for address');
        }
        
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        let totalInput = 0;
        for (const utxo of utxos.slice(0, 3)) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, networkConfig),
                    value: utxo.value
                }
            });
            totalInput += utxo.value;
        }
        
        const amountInSatoshi = Math.floor(amount * 1e8);
        
        const estimatedSize = (utxos.length * 180) + 34 + 10;
        const fee = estimatedSize * 1;
        
        if (totalInput < amountInSatoshi + fee) {
            throw new Error('Insufficient balance');
        }
        
        const change = totalInput - amountInSatoshi - fee;
        
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        if (change > 546) {
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        for (let i = 0; i < utxos.slice(0, 3).length; i++) {
            psbt.signInput(i, child);
        }
        
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
        const txid = await broadcastBitcoinTransaction(rawTx, network);
        
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

// Универсальная функция отправки
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
            case 'BSC':
                result = await sendEth({ 
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

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
export const validateAddress = (blockchain, address, network = 'mainnet') => {
    try {
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
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[0-9a-fA-F]{40}$/.test(address);
            case 'Bitcoin':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.BITCOIN.NETWORK);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                return /^[a-z0-9_-]+\.(near|testnet)$/.test(address) || /^0x[0-9a-fA-F]{40}$/.test(address);
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

export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendTron,
    sendNear,
    sendBitcoin,
    validateAddress,
    estimateTransactionFee,
    TRANSACTION_TOKENS,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};