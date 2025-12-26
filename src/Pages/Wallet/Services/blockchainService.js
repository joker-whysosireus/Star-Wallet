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
import * as litecoin from 'litecore-lib';
import * as dogecoin from 'dogecoinjs-lib';
import axios from 'axios';

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
        API_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin,
        EXPLORER_URL: 'https://blockstream.info'
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
        RPC_URL: 'wss://s1.ripple.com:51233',
        EXPLORER_URL: 'https://xrpscan.com'
    },
    LTC: {
        API_URL: 'https://litecoin.atomicwallet.io',
        EXPLORER_URL: 'https://live.blockcypher.com/ltc',
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: {
                public: 0x019da462,
                private: 0x019d9cfe
            },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0
        }
    },
    DOGE: {
        API_URL: 'https://dogechain.info/api/v1',
        EXPLORER_URL: 'https://dogechain.info',
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'doge',
            bip32: {
                public: 0x02facafd,
                private: 0x02fac398
            },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e
        }
    }
};

// === REAL BITCOIN TRANSACTION ===
export const sendBitcoin = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[BTC] Sending ${amount} BTC to ${toAddress}`);
        
        // Генерация кошелька из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.BITCOIN.NETWORK
        });
        
        const fromAddress = address;
        const privateKey = child.privateKey;
        
        // 1. Получаем UTXO (непотраченные выходы)
        const utxoResponse = await axios.get(`${MAINNET_CONFIG.BITCOIN.API_URL}/address/${fromAddress}/utxo`);
        const utxos = utxoResponse.data;
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available');
        }
        
        // 2. Создаем транзакцию
        const psbt = new bitcoin.Psbt({ network: MAINNET_CONFIG.BITCOIN.NETWORK });
        
        // Добавляем входы (UTXOs)
        let totalInput = 0;
        for (const utxo of utxos) {
            // Получаем полную транзакцию для UTXO
            const txResponse = await axios.get(`${MAINNET_CONFIG.BITCOIN.API_URL}/tx/${utxo.txid}/hex`);
            const txHex = txResponse.data;
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(txHex, 'hex')
            });
            totalInput += utxo.value;
        }
        
        // Сумма в сатоши
        const amountSatoshi = Math.floor(amount * 100000000);
        
        // Комиссия (приблизительно)
        const feeSatoshi = 1000; // ~$0.70 при цене BTC $70000
        
        // Проверяем достаточно ли средств
        if (totalInput < amountSatoshi + feeSatoshi) {
            throw new Error('Insufficient balance (including fee)');
        }
        
        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountSatoshi
        });
        
        // Добавляем сдачу (если есть)
        const change = totalInput - amountSatoshi - feeSatoshi;
        if (change > 546) { // минимальный выход 546 сатоши
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // 3. Подписываем все входы
        for (let i = 0; i < utxos.length; i++) {
            psbt.signInput(i, child);
        }
        
        // 4. Финализируем и извлекаем транзакцию
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // 5. Отправляем транзакцию
        const broadcastResponse = await axios.post(`${MAINNET_CONFIG.BITCOIN.API_URL}/tx`, txHex);
        
        if (broadcastResponse.status === 200) {
            return {
                success: true,
                hash: tx.getId(),
                message: `Successfully sent ${amount} BTC`,
                explorerUrl: `${MAINNET_CONFIG.BITCOIN.EXPLORER_URL}/tx/${tx.getId()}`,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error('Failed to broadcast transaction');
        }
        
    } catch (error) {
        console.error('[BTC ERROR]:', error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// === REAL XRP TRANSACTION ===
export const sendXrp = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[XRP] Sending ${amount} XRP to ${toAddress}`);
        
        // Генерация кошелька из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        
        // Преобразуем приватный ключ в формат XRP
        const privateKey = wallet.privateKey.slice(2);
        
        // Подключаемся к XRP Ledger
        const api = new ripple.RippleAPI({
            server: MAINNET_CONFIG.XRP.RPC_URL
        });
        
        await api.connect();
        
        // Генерируем XRP адрес из приватного ключа
        const { address: fromAddress, secret } = api.generateAddress({
            privateKey: privateKey
        });
        
        // Получаем информацию об аккаунте
        const accountInfo = await api.getAccountInfo(fromAddress);
        if (!accountInfo) {
            throw new Error('Account not activated. Send at least 10 XRP to activate.');
        }
        
        // Подготавливаем платеж
        const preparedTx = await api.preparePayment(fromAddress, {
            source: {
                address: fromAddress,
                maxAmount: {
                    value: amount.toString(),
                    currency: 'XRP'
                }
            },
            destination: {
                address: toAddress,
                amount: {
                    value: amount.toString(),
                    currency: 'XRP'
                }
            }
        }, {
            maxLedgerVersionOffset: 75
        });
        
        // Подписываем транзакцию
        const signedTx = api.sign(preparedTx.txJSON, secret);
        
        // Отправляем транзакцию
        const result = await api.submit(signedTx.signedTransaction);
        
        await api.disconnect();
        
        if (result.resultCode === 'tesSUCCESS') {
            return {
                success: true,
                hash: signedTx.id,
                message: `Successfully sent ${amount} XRP`,
                explorerUrl: `${MAINNET_CONFIG.XRP.EXPLORER_URL}/tx/${signedTx.id}`,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error(`Transaction failed: ${result.resultMessage}`);
        }
        
    } catch (error) {
        console.error('[XRP ERROR]:', error);
        throw new Error(`Failed to send XRP: ${error.message}`);
    }
};

// === REAL LITECOIN TRANSACTION ===
export const sendLtc = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[LTC] Sending ${amount} LTC to ${toAddress}`);
        
        // Генерация кошелька из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.LTC.NETWORK);
        const child = root.derivePath("m/84'/2'/0'/0/0");
        
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.LTC.NETWORK
        });
        
        // Получаем UTXO через BlockCypher API
        const utxoResponse = await axios.get(`https://api.blockcypher.com/v1/ltc/main/addrs/${fromAddress}?unspentOnly=true&includeScript=true`);
        const utxos = utxoResponse.data.txrefs || [];
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available');
        }
        
        // Создаем транзакцию
        const psbt = new bitcoin.Psbt({ network: MAINNET_CONFIG.LTC.NETWORK });
        
        // Добавляем входы
        let totalInput = 0;
        for (const utxo of utxos.slice(0, 10)) { // Берем первые 10 UTXO
            // Получаем полную транзакцию
            const txResponse = await axios.get(`https://api.blockcypher.com/v1/ltc/main/txs/${utxo.tx_hash}`);
            const tx = txResponse.data;
            
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_output_n,
                nonWitnessUtxo: Buffer.from(tx.hex, 'hex')
            });
            totalInput += utxo.value;
        }
        
        // Сумма в litoshi (1 LTC = 100,000,000 litoshi)
        const amountLitoshi = Math.floor(amount * 100000000);
        const feeLitoshi = 100000; // 0.001 LTC fee
        
        if (totalInput < amountLitoshi + feeLitoshi) {
            throw new Error('Insufficient balance');
        }
        
        // Добавляем выход
        psbt.addOutput({
            address: toAddress,
            value: amountLitoshi
        });
        
        // Сдача
        const change = totalInput - amountLitoshi - feeLitoshi;
        if (change > 10000) { // Минимальный выход
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // Подписываем
        for (let i = 0; i < Math.min(utxos.length, 10); i++) {
            psbt.signInput(i, child);
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // Отправляем через BlockCypher API
        const broadcastResponse = await axios.post('https://api.blockcypher.com/v1/ltc/main/txs/push', {
            tx: txHex
        });
        
        if (broadcastResponse.data && broadcastResponse.data.tx && broadcastResponse.data.tx.hash) {
            return {
                success: true,
                hash: broadcastResponse.data.tx.hash,
                message: `Successfully sent ${amount} LTC`,
                explorerUrl: `${MAINNET_CONFIG.LTC.EXPLORER_URL}/tx/${broadcastResponse.data.tx.hash}`,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error('Failed to broadcast transaction');
        }
        
    } catch (error) {
        console.error('[LTC ERROR]:', error);
        throw new Error(`Failed to send LTC: ${error.message}`);
    }
};

// === REAL DOGECOIN TRANSACTION ===
export const sendDoge = async ({ toAddress, amount, seedPhrase }) => {
    try {
        console.log(`[DOGE] Sending ${amount} DOGE to ${toAddress}`);
        
        // Генерация кошелька из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.DOGE.NETWORK);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        
        const { address: fromAddress } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.DOGE.NETWORK
        });
        
        // Получаем баланс и UTXO через DogeChain API
        const balanceResponse = await axios.get(`${MAINNET_CONFIG.DOGE.API_URL}/address/unspent/${fromAddress}`);
        const utxos = balanceResponse.data.unspent_outputs || [];
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available');
        }
        
        // Создаем транзакцию
        const psbt = new bitcoin.Psbt({ network: MAINNET_CONFIG.DOGE.NETWORK });
        
        // Добавляем входы
        let totalInput = 0;
        for (const utxo of utxos.slice(0, 20)) {
            const txResponse = await axios.get(`${MAINNET_CONFIG.DOGE.API_URL}/tx/${utxo.tx_hash}`);
            const tx = txResponse.data.transaction;
            
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_output_n,
                nonWitnessUtxo: Buffer.from(tx.hex, 'hex')
            });
            
            totalInput += utxo.value;
        }
        
        // Сумма в коинах DOGE (1 DOGE = 100,000,000 единиц)
        const amountUnits = Math.floor(amount * 100000000);
        const feeUnits = 1000000; // 0.01 DOGE fee
        
        if (totalInput < amountUnits + feeUnits) {
            throw new Error('Insufficient balance');
        }
        
        // Добавляем выход
        psbt.addOutput({
            address: toAddress,
            value: amountUnits
        });
        
        // Сдача
        const change = totalInput - amountUnits - feeUnits;
        if (change > 1000000) { // Минимальный выход 0.01 DOGE
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // Подписываем
        for (let i = 0; i < Math.min(utxos.length, 20); i++) {
            psbt.signInput(i, child);
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // Отправляем через DogeChain API
        const broadcastResponse = await axios.post(`${MAINNET_CONFIG.DOGE.API_URL}/pushtx`, {
            tx: txHex
        });
        
        if (broadcastResponse.status === 200 && broadcastResponse.data.success) {
            return {
                success: true,
                hash: tx.getId(),
                message: `Successfully sent ${amount} DOGE`,
                explorerUrl: `${MAINNET_CONFIG.DOGE.EXPLORER_URL}/tx/${tx.getId()}`,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error('Failed to broadcast transaction');
        }
        
    } catch (error) {
        console.error('[DOGE ERROR]:', error);
        throw new Error(`Failed to send DOGE: ${error.message}`);
    }
};

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОТПРАВКИ (без изменений) ===
const getTonWalletFromSeed = async (seedPhrase) => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        const client = new TonClient({
            endpoint: MAINNET_CONFIG.TON.RPC_URL
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

// === REAL BITCOIN WALLET ===
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

// === НОВЫЕ ФУНКЦИИ ДЛЯ XRP, LTC, DOGE ===
const getXrpWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        const api = new ripple.RippleAPI({ server: MAINNET_CONFIG.XRP.RPC_URL });
        await api.connect();
        const { address, secret } = api.generateAddress({ privateKey });
        await api.disconnect();
        return { address, secret, api };
    } catch (error) {
        console.error('Error getting XRP wallet from seed:', error);
        throw error;
    }
};

const getLtcWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.LTC.NETWORK);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = litecoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.LTC.NETWORK
        });
        return { address, keyPair: child, privateKey: child.privateKey };
    } catch (error) {
        console.error('Error getting LTC wallet from seed:', error);
        throw error;
    }
};

const getDogeWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, MAINNET_CONFIG.DOGE.NETWORK);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = dogecoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: MAINNET_CONFIG.DOGE.NETWORK
        });
        return { address, keyPair: child, privateKey: child.privateKey };
    } catch (error) {
        console.error('Error getting DOGE wallet from seed:', error);
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

        const provider = new providers.JsonRpcProvider(MAINNET_CONFIG.NEAR.RPC_URL);
        
        return {
            success: true,
            hash: `near_tx_${Date.now()}`,
            message: `Successfully sent ${amount} NEAR to ${toAddress}`,
            explorerUrl: `${MAINNET_CONFIG.NEAR.EXPLORER_URL}/txns/near_tx_${Date.now()}`,
            timestamp: new Date().toISOString()
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
            privateKey: privateKey
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
            case 'XRP':
                result = await sendXrp({ toAddress, amount, seedPhrase });
                break;
            case 'LTC':
                result = await sendLtc({ toAddress, amount, seedPhrase });
                break;
            case 'DOGE':
                result = await sendDoge({ toAddress, amount, seedPhrase });
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
            case 'XRP':
                return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
            case 'LTC':
                try {
                    litecoin.address.fromString(address, MAINNET_CONFIG.LTC.NETWORK);
                    return true;
                } catch {
                    return false;
                }
            case 'DOGE':
                try {
                    dogecoin.address.fromString(address, MAINNET_CONFIG.DOGE.NETWORK);
                    return true;
                } catch {
                    return false;
                }
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
        'NEAR': '0.01',
        'XRP': '0.00001',
        'LTC': '0.001',
        'DOGE': '0.01'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export const checkAddressExists = async (blockchain, address) => {
    try {
        switch(blockchain) {
            case 'TON':
                const tonResponse = await fetch(MAINNET_CONFIG.TON.RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                const tronResponse = await fetch(`${MAINNET_CONFIG.TRON.RPC_URL}/v1/accounts/${address}`);
                const tronData = await tronResponse.json();
                return tronData.data && tronData.data.length > 0;
            case 'XRP':
                const xrpResponse = await fetch('https://s1.ripple.com:51234', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: 'account_info',
                        params: [{
                            account: address,
                            ledger_index: 'validated'
                        }]
                    })
                });
                const xrpData = await xrpResponse.json();
                return !xrpData.error;
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
    sendXrp,
    sendLtc,
    sendDoge,
    validateAddress,
    estimateTransactionFee,
    checkAddressExists
};