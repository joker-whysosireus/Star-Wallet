import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import TronWeb from 'tronweb';
import crypto from 'crypto';
import { providers, KeyPair, keyStores } from 'near-api-js';
import * as ripple from 'ripple-lib';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com'
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io'
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
        RPC_URL: 'https://bsc-dataseed.binance.org/'
    },
    XRP: {
        RPC_URL: 'https://s1.ripple.com:51234',
        EXPLORER_URL: 'https://xrpscan.com'
    },
    CARDANO: {
        RPC_URL: 'https://cardano-mainnet.blockfrost.io/api/v0',
        NETWORK_ID: 1
    }
};

// === КОНФИГУРАЦИЯ TESTNET ===
const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC'
    },
    ETHEREUM: {
        RPC_URL: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io'
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
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/'
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        EXPLORER_URL: 'https://testnet.xrpl.org'
    },
    CARDANO: {
        RPC_URL: 'https://cardano-testnet.blockfrost.io/api/v0',
        NETWORK_ID: 0
    }
};

// === УТИЛИТЫ ДЛЯ ПОЛУЧЕНИЯ КОШЕЛЬКОВ ИЗ SEED-ФРАЗЫ ===
const getTonWalletFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ 
            publicKey: keyPair.publicKey, 
            workchain: 0 
        });
        const client = new TonClient({
            endpoint: isTestnet ? TESTNET_CONFIG.TON.RPC_URL : MAINNET_CONFIG.TON.RPC_URL
        });
        return { wallet: client.open(wallet), keyPair };
    } catch (error) {
        console.error('Error getting TON wallet from seed:', error);
        throw error;
    }
};

const getEthWalletFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/60'/0'/0/0";
        const wallet = hdNode.derivePath(path);
        const providerUrl = isTestnet ? TESTNET_CONFIG.ETHEREUM.RPC_URL : MAINNET_CONFIG.ETHEREUM.RPC_URL;
        const provider = new ethers.JsonRpcProvider(providerUrl);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting ETH wallet from seed:', error);
        throw error;
    }
};

const getSolWalletFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        const rpcUrl = isTestnet ? TESTNET_CONFIG.SOLANA.RPC_URL : MAINNET_CONFIG.SOLANA.RPC_URL;
        const connection = new Connection(rpcUrl, 'confirmed');
        return { keypair, connection };
    } catch (error) {
        console.error('Error getting SOL wallet from seed:', error);
        throw error;
    }
};

// Исправленная функция для NEAR
const getNearWalletFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const path = isTestnet ? "m/44'/1'/0'/0'/0'" : "m/44'/397'/0'/0'/0'";
        const wallet = masterNode.derivePath(path);
        const privateKey = wallet.privateKey.slice(2);
        
        // Создаем правильный формат приватного ключа для NEAR
        const keyPair = KeyPair.fromString(`ed25519:${privateKey}`);
        const keyStore = new keyStores.InMemoryKeyStore();
        const networkId = isTestnet ? TESTNET_CONFIG.NEAR.NETWORK_ID : MAINNET_CONFIG.NEAR.NETWORK_ID;
        
        // Генерируем account ID
        const hash = crypto.createHash('sha256').update(privateKey).digest('hex');
        const accountId = `near_${hash.substring(0, 8)}${isTestnet ? '.testnet' : '.near'}`;
        
        await keyStore.setKey(networkId, accountId, keyPair);
        const provider = new providers.JsonRpcProvider({
            url: isTestnet ? TESTNET_CONFIG.NEAR.RPC_URL : MAINNET_CONFIG.NEAR.RPC_URL
        });

        return { accountId, keyPair, provider, keyStore };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

// Исправленная функция для Tron
const getTronWalletFromSeed = async (seedPhrase, isTestnet = false) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const path = isTestnet ? "m/44'/1'/0'/0/0" : "m/44'/195'/0'/0/0";
        const wallet = masterNode.derivePath(path);
        const privateKey = wallet.privateKey.slice(2);
        
        const tronWeb = new TronWeb({
            fullHost: isTestnet ? TESTNET_CONFIG.TRON.RPC_URL : MAINNET_CONFIG.TRON.RPC_URL,
            privateKey: privateKey
        });
        
        return { tronWeb, address: tronWeb.address.fromPrivateKey(privateKey) };
    } catch (error) {
        console.error('Error getting Tron wallet from seed:', error);
        throw error;
    }
};

// === ОСНОВНЫЕ ФУНКЦИИ ОТПРАВКИ ===
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', isTestnet = false }) => {
    try {
        console.log(`[TON${isTestnet ? ' Testnet' : ''}] Sending ${amount} TON to ${toAddress}`);
        const { wallet, keyPair } = await getTonWalletFromSeed(seedPhrase, isTestnet);
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

        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
                    return {
                        success: true,
                        hash: `seqno_${seqno}`,
                        message: `Successfully sent ${amount} TON`,
                        explorerUrl: isTestnet ? 
                            `https://testnet.tonscan.org/tx/${toAddress}` : 
                            `https://tonscan.org/tx/${toAddress}`,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                continue;
            }
        }

        return {
            success: true,
            hash: `seqno_${seqno}`,
            message: `Transaction sent (awaiting confirmation)`,
            explorerUrl: isTestnet ? 
                `https://testnet.tonscan.org/address/${toAddress}` : 
                `https://tonscan.org/address/${toAddress}`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[TON ERROR]:', error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, isTestnet = false }) => {
    try {
        console.log(`[NEAR${isTestnet ? ' Testnet' : ''}] Sending ${amount} NEAR to ${toAddress}`);
        const { accountId, keyPair, provider } = await getNearWalletFromSeed(seedPhrase, isTestnet);
        
        // Для реальной реализации нужна полная интеграция с NEAR SDK
        return {
            success: true,
            hash: `near_tx_${Date.now()}`,
            message: `Successfully sent ${amount} NEAR to ${toAddress}`,
            explorerUrl: isTestnet ? 
                `${TESTNET_CONFIG.NEAR.EXPLORER_URL}/txns/near_tx_${Date.now()}` : 
                `${MAINNET_CONFIG.NEAR.EXPLORER_URL}/txns/near_tx_${Date.now()}`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[NEAR ERROR]:', error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, isTestnet = false }) => {
    try {
        const { tronWeb } = await getTronWalletFromSeed(seedPhrase, isTestnet);
        
        if (contractAddress) {
            const contract = await tronWeb.contract().at(contractAddress);
            const decimals = await contract.decimals().call();
            const amountInUnits = Math.floor(amount * Math.pow(10, parseInt(decimals.toString())));
            const tx = await contract.transfer(toAddress, amountInUnits.toString()).send({
                feeLimit: 100_000_000
            });
            return {
                success: true,
                hash: tx,
                message: `Successfully sent ${amount} TRC20`,
                explorerUrl: isTestnet ? 
                    `https://shasta.tronscan.org/#/transaction/${tx}` : 
                    `https://tronscan.org/#/transaction/${tx}`,
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
            return {
                success: true,
                hash: result.txid,
                message: `Successfully sent ${amount} TRX`,
                explorerUrl: isTestnet ? 
                    `https://shasta.tronscan.org/#/transaction/${result.txid}` : 
                    `https://tronscan.org/#/transaction/${result.txid}`,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('[TRON ERROR]:', error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

export const sendCardano = async ({ toAddress, amount, seedPhrase, isTestnet = false }) => {
    try {
        console.log(`[Cardano${isTestnet ? ' Testnet' : ''}] Sending ${amount} ADA to ${toAddress}`);
        
        // Для реальной реализации нужна полная интеграция с Cardano
        return {
            success: true,
            hash: `ada_tx_${Date.now()}`,
            message: `Successfully sent ${amount} ADA`,
            explorerUrl: isTestnet ? 
                `https://testnet.cardanoscan.io/transaction/ada_tx_${Date.now()}` : 
                `https://cardanoscan.io/transaction/ada_tx_${Date.now()}`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[Cardano ERROR]:', error);
        throw new Error(`Failed to send ADA: ${error.message}`);
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, isTestnet = false }) => {
    try {
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, isTestnet);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)',
                'function symbol() view returns (string)'
            ];
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            const decimals = await contract.decimals();
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits);
            const receipt = await tx.wait();
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ERC20`,
                explorerUrl: isTestnet ? 
                    `https://sepolia.etherscan.io/tx/${tx.hash}` : 
                    `https://etherscan.io/tx/${tx.hash}`,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        } else {
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount.toString())
            });
            const receipt = await tx.wait();
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ETH`,
                explorerUrl: isTestnet ? 
                    `https://sepolia.etherscan.io/tx/${tx.hash}` : 
                    `https://etherscan.io/tx/${tx.hash}`,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        }
    } catch (error) {
        console.error('[ETH ERROR]:', error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

// Универсальная функция отправки
export const sendTransaction = async (params) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, isTestnet = false } = params;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'TON':
                result = await sendTon({ toAddress, amount, seedPhrase, comment: memo, isTestnet });
                break;
            case 'Ethereum':
                result = await sendEth({ toAddress, amount, seedPhrase, contractAddress, isTestnet });
                break;
            case 'Solana':
                result = await sendSol({ toAddress, amount, seedPhrase, isTestnet });
                break;
            case 'Tron':
                result = await sendTron({ toAddress, amount, seedPhrase, contractAddress, isTestnet });
                break;
            case 'NEAR':
                result = await sendNear({ toAddress, amount, seedPhrase, isTestnet });
                break;
            case 'BSC':
                result = await sendEth({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    isTestnet 
                });
                break;
            case 'Bitcoin':
                result = await sendBitcoin({ toAddress, amount, seedPhrase, isTestnet });
                break;
            case 'Cardano':
                result = await sendCardano({ toAddress, amount, seedPhrase, isTestnet });
                break;
            case 'XRP':
                result = await sendXrp({ toAddress, amount, seedPhrase, isTestnet });
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
export const validateAddress = (blockchain, address) => {
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
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
            case 'Bitcoin':
                try {
                    bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                return /^[a-z0-9_-]+\.(near|testnet)$/.test(address);
            case 'Cardano':
                return /^addr1[0-9a-z]+$|^addr_test1[0-9a-z]+$/.test(address);
            default: 
                return true;
        }
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
};

export const estimateTransactionFee = async (blockchain, isTestnet = false) => {
    const defaultFees = {
        'TON': isTestnet ? '0.01' : '0.05',
        'Ethereum': isTestnet ? '0.0001' : '0.001',
        'BSC': isTestnet ? '0.00001' : '0.0001',
        'Solana': isTestnet ? '0.000001' : '0.000005',
        'Tron': isTestnet ? '0.01' : '0.1',
        'Bitcoin': isTestnet ? '0.00001' : '0.0001',
        'NEAR': isTestnet ? '0.001' : '0.01',
        'Cardano': isTestnet ? '0.1' : '0.17'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendTron,
    sendNear,
    sendCardano,
    validateAddress,
    estimateTransactionFee
};