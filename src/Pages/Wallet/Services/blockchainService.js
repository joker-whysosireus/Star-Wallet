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

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v3/jsonRPC',
        API_KEY: '683bdd6cfa7a49a1b14c38c0c80b0b99'
    },
    ETHEREUM: {
        RPC_URL: 'https://mainnet.infura.io/v3/683bdd6cfa7a49a1b14c38c0c80b0b99'
    },
    SOLANA: {
        RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=e1a20296-3d29-4edb-bc41-c709a187fbc9'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        API_KEY: '36b3eb2e-5f06-46f7-8aa4-bab1546a6a9f'
    },
    BITCOIN: {
        RPC_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/'
    }
};

// === УТИЛИТЫ ДЛЯ ПОЛУЧЕНИЯ КОШЕЛЬКОВ ИЗ SEED-ФРАЗЫ ===
const getTonWalletFromSeed = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        const client = new TonClient({
            endpoint: MAINNET_CONFIG.TON.RPC_URL,
            apiKey: MAINNET_CONFIG.TON.API_KEY
        });
        return { wallet: client.open(wallet), keyPair };
    } catch (error) {
        console.error('Error getting TON wallet from seed:', error);
        throw error;
    }
};

const getEthWalletFromSeed = async (seedPhrase, providerUrl = MAINNET_CONFIG.ETHEREUM.RPC_URL) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(providerUrl);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting ETH wallet from seed:', error);
        throw error;
    }
};

const getSolWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        const connection = new Connection(MAINNET_CONFIG.SOLANA.RPC_URL, 'confirmed');
        return { keypair, connection };
    } catch (error) {
        console.error('Error getting SOL wallet from seed:', error);
        throw error;
    }
};

// === REAL BITCOIN FUNCTIONS ===
const getBitcoinWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.BITCOIN.NETWORK
        });
        return { address, keyPair: child, privateKey: child.privateKey };
    } catch (error) {
        console.error('Error getting Bitcoin wallet from seed:', error);
        throw error;
    }
};

// === ОСНОВНЫЕ ФУНКЦИИ ОТПРАВКИ ===
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '' }) => {
    try {
        console.log(`[TON] Sending ${amount} TON to ${toAddress}`);
        const { wallet, keyPair } = await getTonWalletFromSeed(seedPhrase);
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
                        explorerUrl: `https://tonscan.org/tx/${toAddress}`,
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
            explorerUrl: `https://tonscan.org/address/${toAddress}`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[TON ERROR]:', error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[NEAR] Sending ${amount} NEAR to ${toAddress}`);
        
        // Генерация ключа из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        const privateKey = wallet.privateKey.slice(2);
        
        // Создание ключевой пары для NEAR
        const keyPair = KeyPair.fromString(`ed25519:${privateKey}`);
        const keyStore = new keyStores.InMemoryKeyStore();
        const accountId = `near_${crypto.createHash('sha256').update(privateKey).digest('hex').substring(0, 10)}.near`;
        await keyStore.setKey(MAINNET_CONFIG.NEAR.NETWORK_ID, accountId, keyPair);

        // Использование прямого RPC вызова для отправки транзакции
        const provider = new providers.JsonRpcProvider(MAINNET_CONFIG.NEAR.RPC_URL);
        
        // Получение текущего nonce
        const nonceResponse = await provider.query({
            request_type: 'view_account',
            account_id: accountId,
            finality: 'final'
        });
        
        const nonce = nonceResponse.nonce + 1;
        const blockHash = crypto.randomBytes(32).toString('base64');
        
        const amountInYocto = (BigInt(amount * 1e24)).toString();
        
        // Создание транзакции
        const txData = {
            signer_id: accountId,
            public_key: keyPair.getPublicKey().toString(),
            nonce: nonce,
            receiver_id: toAddress,
            actions: [{
                type: 'Transfer',
                transfer: {
                    deposit: amountInYocto
                }
            }],
            block_hash: blockHash
        };
        
        // Подпись транзакции
        const signature = keyPair.sign(Buffer.from(JSON.stringify(txData)));
        const signedTx = {
            ...txData,
            signature: signature.signature.toString('base64')
        };
        
        // Отправка транзакции через RPC
        const result = await provider.sendTransaction(signedTx);
        
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR to ${toAddress}`,
            explorerUrl: `${MAINNET_CONFIG.NEAR.EXPLORER_URL}/txns/${result.transaction.hash}`,
            timestamp: new Date().toISOString(),
            blockHeight: result.transaction_outcome.block_hash
        };
    } catch (error) {
        console.error('[NEAR ERROR]:', error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, providerUrl = MAINNET_CONFIG.ETHEREUM.RPC_URL }) => {
    try {
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, providerUrl);
        
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
                explorerUrl: `https://etherscan.io/tx/${tx.hash}`,
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
                explorerUrl: `https://etherscan.io/tx/${tx.hash}`,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        }
    } catch (error) {
        console.error('[ETH ERROR]:', error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

export const sendSol = async ({ toAddress, amount, seedPhrase }) => {
    try {
        const { keypair, connection } = await getSolWalletFromSeed(seedPhrase);
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: Math.floor(amount * LAMPORTS_PER_SOL)
            })
        );
        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
        return {
            success: true,
            hash: signature,
            message: `Successfully sent ${amount} SOL`,
            explorerUrl: `https://solscan.io/tx/${signature}`,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('[SOL ERROR]:', error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null }) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const tronWeb = new TronWeb({
            fullHost: MAINNET_CONFIG.TRON.RPC_URL,
            privateKey: privateKey,
            headers: { "TRON-PRO-API-KEY": MAINNET_CONFIG.TRON.API_KEY }
        });
        
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
                explorerUrl: `https://tronscan.org/#/transaction/${tx}`,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInSun = Math.floor(amount * 1_000_000);
            const tx = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                wallet.address
            );
            const signedTx = await tronWeb.trx.sign(tx);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            return {
                success: true,
                hash: result.txid,
                message: `Successfully sent ${amount} TRX`,
                explorerUrl: `https://tronscan.org/#/transaction/${result.txid}`,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('[TRON ERROR]:', error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[BTC] Sending ${amount} BTC to ${toAddress}`);
        
        // Получаем кошелек из seed фразы
        const { address: fromAddress, keyPair } = await getBitcoinWalletFromSeed(seedPhrase);
        
        // Получаем UTXO для адреса отправителя через Blockstream API
        const utxoResponse = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/address/${fromAddress}/utxo`);
        if (!utxoResponse.ok) {
            throw new Error('Failed to fetch UTXOs');
        }
        
        const utxos = await utxoResponse.json();
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs available for this address');
        }
        
        // Выбираем UTXO с достаточным балансом (упрощенный алгоритм)
        const satoshiAmount = Math.floor(amount * 1e8);
        const feeRate = 20; // sat/byte (консервативная оценка)
        
        let selectedUtxos = [];
        let totalInput = 0;
        
        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            // Примерный расчет размера транзакции
            const estimatedSize = selectedUtxos.length * 180 + 2 * 34 + 10;
            const estimatedFee = estimatedSize * feeRate;
            
            if (totalInput >= satoshiAmount + estimatedFee) {
                break;
            }
        }
        
        if (totalInput < satoshiAmount + 1000) { // минимальная комиссия
            throw new Error('Insufficient balance for transaction');
        }
        
        // Создаем PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: MAINNET_CONFIG.BITCOIN.NETWORK });
        
        // Добавляем входы
        for (const utxo of selectedUtxos) {
            // Получаем информацию о предыдущей транзакции
            const txResponse = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/tx/${utxo.txid}/hex`);
            const txHex = await txResponse.text();
            const tx = bitcoin.Transaction.fromHex(txHex);
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: tx.outs[utxo.vout].script,
                    value: utxo.value
                },
                sighashType: bitcoin.Transaction.SIGHASH_ALL
            });
        }
        
        // Добавляем выходы
        psbt.addOutput({
            address: toAddress,
            value: satoshiAmount
        });
        
        // Добавляем сдачу (если есть)
        const estimatedSize = selectedUtxos.length * 180 + 2 * 34 + 10;
        const fee = estimatedSize * feeRate;
        const change = totalInput - satoshiAmount - fee;
        
        if (change > 546) { // минимальный выход (dust limit)
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        // Финализируем транзакцию
        psbt.finalizeAllInputs();
        
        // Извлекаем подписанную транзакцию
        const signedTx = psbt.extractTransaction();
        const txHex = signedTx.toHex();
        
        // Отправляем транзакцию в сеть
        const broadcastResponse = await fetch(`${MAINNET_CONFIG.BITCOIN.RPC_URL}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Failed to broadcast transaction: ${errorText}`);
        }
        
        const txid = signedTx.getId();
        
        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} BTC`,
            explorerUrl: `https://blockstream.info/tx/${txid}`,
            timestamp: new Date().toISOString(),
            fee: `${(fee / 1e8).toFixed(8)} BTC`
        };
    } catch (error) {
        console.error('[BTC ERROR]:', error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// Универсальная функция отправки
export const sendTransaction = async (params) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress } = params;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'TON':
                result = await sendTon({ toAddress, amount, seedPhrase, comment: memo });
                break;
            case 'Ethereum':
                result = await sendEth({ toAddress, amount, seedPhrase, contractAddress });
                break;
            case 'Solana':
                result = await sendSol({ toAddress, amount, seedPhrase });
                break;
            case 'Tron':
                result = await sendTron({ toAddress, amount, seedPhrase, contractAddress });
                break;
            case 'NEAR':
                result = await sendNear({ toAddress, amount, seedPhrase });
                break;
            case 'BSC':
                result = await sendEth({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    providerUrl: MAINNET_CONFIG.BSC.RPC_URL 
                });
                break;
            case 'Bitcoin':
                result = await sendBitcoin({ toAddress, amount, seedPhrase });
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
                    // Валидация через bitcoinjs-lib
                    bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                return /^[a-z0-9_-]+\.(near|testnet)$/.test(address);
            default: 
                return true;
        }
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
};

export const estimateTransactionFee = async (blockchain) => {
    const defaultFees = {
        'TON': '0.05',
        'Ethereum': '0.001',
        'BSC': '0.0001',
        'Solana': '0.000005',
        'Tron': '0.1',
        'Bitcoin': '0.0001',
        'NEAR': '0.01'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export const checkAddressExists = async (blockchain, address) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonResponse = await fetch(MAINNET_CONFIG.TON.RPC_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-Key': MAINNET_CONFIG.TON.API_KEY 
                    },
                    body: JSON.stringify({
                        id: 1,
                        jsonrpc: "2.0",
                        method: "getAddressInformation",
                        params: { address }
                    })
                });
                const tonData = await tonResponse.json();
                return tonData.result !== null;
            case 'NEAR':
                const nearResponse = await fetch(MAINNET_CONFIG.NEAR.RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: "dontcare",
                        method: "query",
                        params: {
                            request_type: "view_account",
                            finality: "final",
                            account_id: address
                        }
                    })
                });
                const nearData = await nearResponse.json();
                return !nearData.error;
            case 'Tron':
                const tronResponse = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`, {
                    headers: { "TRON-PRO-API-KEY": MAINNET_CONFIG.TRON.API_KEY }
                });
                const tronData = await tronResponse.json();
                return tronData.data && tronData.data.length > 0;
            default:
                return true;
        }
    } catch (error) {
        console.error('Address check error:', error);
        return false;
    }
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
    checkAddressExists
};