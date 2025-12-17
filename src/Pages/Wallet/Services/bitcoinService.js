// Services/bitcoinService.js
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';

// Mainnet конфигурация
const BITCOIN_MAINNET_RPC = 'https://blockstream.info/api';
const BITCOIN_NETWORK = bitcoin.networks.bitcoin;

/**
 * Получение кошелька Bitcoin из сид-фразы пользователя
 */
const getBitcoinWalletFromUserData = async (userData) => {
    try {
        if (!userData?.seed_phrases) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedPhrase = userData.seed_phrases;
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        
        // Создаем BIP32 корневой ключ
        const bip32 = BIP32Factory(ecc);
        const root = bip32.fromSeed(seed, BITCOIN_NETWORK);
        
        // Используем путь BIP84 для SegWit (bech32 адреса, начинаются с bc1)
        const path = "m/84'/0'/0'/0/0";
        const child = root.derivePath(path);
        
        // Создаем SegWit адрес
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: BITCOIN_NETWORK
        });
        
        return {
            privateKey: child.privateKey.toString('hex'),
            publicKey: child.publicKey.toString('hex'),
            address: address,
            keyPair: child,
            network: BITCOIN_NETWORK
        };
    } catch (error) {
        console.error('Error getting Bitcoin wallet from user data:', error);
        throw error;
    }
};

/**
 * Реальное получение баланса BTC с mainnet
 */
export const getBitcoinBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const response = await fetch(`${BITCOIN_MAINNET_RPC}/address/${address}`);
        const data = await response.json();
        
        if (data.chain_stats && data.chain_stats.funded_txo_sum) {
            const funded = data.chain_stats.funded_txo_sum;
            const spent = data.chain_stats.spent_txo_sum || 0;
            const balance = (funded - spent) / 100_000_000;
            return balance.toFixed(8);
        }
        return '0.00000000';
    } catch (error) {
        console.error('Error getting Bitcoin balance:', error);
        return '0.00000000';
    }
};

/**
 * Получение неиспользованных выходов (UTXOs)
 */
const fetchUTXOs = async (address) => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/address/${address}/utxo`);
        const utxos = await response.json();
        
        return utxos.map(utxo => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
            status: utxo.status
        }));
    } catch (error) {
        console.error('Error fetching UTXOs:', error);
        return [];
    }
};

/**
 * Реальная отправка BTC на mainnet
 */
export const sendBitcoinReal = async ({ toAddress, amount, userData, feeRate = 10 }) => {
    try {
        console.log(`[BITCOIN MAINNET] Sending ${amount} BTC to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters for mainnet');
        }

        // Валидация Bitcoin адреса
        if (!validateBitcoinAddressForMainnet(toAddress)) {
            throw new Error('Invalid Bitcoin address format for mainnet');
        }

        // Получаем кошелек из userData
        const wallet = await getBitcoinWalletFromUserData(userData);
        const fromAddress = wallet.address;
        
        // Проверяем баланс
        const balance = await getBitcoinBalance(fromAddress);
        const balanceInBTC = parseFloat(balance);
        
        console.log(`Mainnet current balance: ${balanceInBTC} BTC`);
        
        if (parseFloat(amount) > balanceInBTC) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInBTC} BTC`);
        }

        // Получаем UTXOs
        const utxos = await fetchUTXOs(fromAddress);
        if (utxos.length === 0) {
            throw new Error('No UTXOs found for this address');
        }

        // Создаем PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: BITCOIN_NETWORK });
        
        // Добавляем входы (UTXOs)
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalInput += utxo.value;
            selectedUtxos.push(utxo);
            
            // Получаем raw транзакцию для получения scriptPubKey
            const txResponse = await fetch(`${BITCOIN_MAINNET_RPC}/tx/${utxo.txid}/hex`);
            const rawTx = await txResponse.text();
            const tx = bitcoin.Transaction.fromHex(rawTx);
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: tx.outs[utxo.vout].script,
                    value: utxo.value
                }
            });
            
            // Если собрали достаточно средств, останавливаемся
            const amountInSatoshi = Math.floor(parseFloat(amount) * 100_000_000);
            const estimatedFee = 50000; // Оценочная комиссия
            if (totalInput >= amountInSatoshi + estimatedFee) {
                break;
            }
        }

        const amountInSatoshi = Math.floor(parseFloat(amount) * 100_000_000);
        
        if (totalInput < amountInSatoshi) {
            throw new Error('Insufficient funds including fees');
        }

        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });

        // Добавляем сдачу (если есть)
        const fee = 50000; // Примерная комиссия в сатоши
        const change = totalInput - amountInSatoshi - fee;
        
        if (change > 10000) { // Минимальная сумма сдачи
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }

        // Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, wallet.keyPair);
        }

        // Проверяем подписи
        psbt.validateSignaturesOfAllInputs();
        psbt.finalizeAllInputs();

        // Получаем raw транзакцию
        const rawTx = psbt.extractTransaction().toHex();
        
        console.log('Signing and sending mainnet transaction...');
        
        // Отправляем транзакцию
        const txId = await broadcastTransaction(rawTx);
        
        console.log(`Mainnet transaction sent. TxID: ${txId}`);
        
        return {
            success: true,
            hash: txId,
            message: `Successfully sent ${amount} BTC to ${toAddress} on mainnet`,
            explorerUrl: `https://blockstream.info/tx/${txId}`,
            timestamp: new Date().toISOString(),
            confirmed: false // Для Bitcoin нужно ждать подтверждений
        };

    } catch (error) {
        console.error('[BITCOIN MAINNET ERROR]:', error);
        throw new Error(`Failed to send BTC on mainnet: ${error.message}`);
    }
};

/**
 * Валидация Bitcoin адреса для mainnet
 */
export const validateBitcoinAddressForMainnet = (address) => {
    try {
        // Поддерживаемые форматы: Legacy (1...), SegWit (3...), Native SegWit (bc1...)
        const bitcoinAddressRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$/;
        
        if (!bitcoinAddressRegex.test(address)) {
            return false;
        }
        
        // Дополнительная проверка через bitcoinjs-lib
        try {
            bitcoin.address.toOutputScript(address, BITCOIN_NETWORK);
            return true;
        } catch {
            return false;
        }
    } catch (error) {
        console.error('Bitcoin address validation error:', error);
        return false;
    }
};

/**
 * Проверка существования Bitcoin адреса на mainnet
 */
export const checkBitcoinAddressExists = async (address) => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/address/${address}`);
        const data = await response.json();
        return data.chain_stats !== undefined;
    } catch (error) {
        console.error('Error checking Bitcoin address existence:', error);
        return false;
    }
};

/**
 * Бродкаст транзакции в сеть
 */
const broadcastTransaction = async (rawTx) => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/tx`, {
            method: 'POST',
            body: rawTx
        });
        
        if (response.ok) {
            const txId = await response.text();
            return txId;
        } else {
            const errorText = await response.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
    } catch (error) {
        console.error('Error broadcasting transaction:', error);
        throw error;
    }
};

/**
 * Получение истории транзакций
 */
export const getTransactionHistory = async (address, limit = 10) => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/address/${address}/txs`);
        const transactions = await response.json();
        
        if (transactions && transactions.length > 0) {
            return transactions.slice(0, limit).map(tx => ({
                hash: tx.txid,
                timestamp: tx.status.block_time * 1000,
                confirmations: tx.status.confirmed ? tx.status.block_height : 0,
                amount: calculateTransactionAmount(tx, address),
                fee: tx.fee / 100_000_000,
                status: tx.status.confirmed ? 'confirmed' : 'pending',
                type: determineTransactionType(tx, address)
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

/**
 * Расчет суммы транзакции для конкретного адреса
 */
const calculateTransactionAmount = (tx, address) => {
    let total = 0;
    
    // Проверяем выходы
    for (const output of tx.vout) {
        if (output.scriptpubkey_address === address) {
            total += output.value;
        }
    }
    
    // Проверяем входы (для исходящих транзакций)
    for (const input of tx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === address) {
            total -= input.prevout.value;
        }
    }
    
    return total / 100_000_000;
};

/**
 * Определение типа транзакции
 */
const determineTransactionType = (tx, address) => {
    let isSender = false;
    let isReceiver = false;
    
    // Проверяем входы
    for (const input of tx.vin) {
        if (input.prevout && input.prevout.scriptpubkey_address === address) {
            isSender = true;
        }
    }
    
    // Проверяем выходы
    for (const output of tx.vout) {
        if (output.scriptpubkey_address === address) {
            isReceiver = true;
        }
    }
    
    if (isSender && isReceiver) return 'self';
    if (isSender) return 'sent';
    if (isReceiver) return 'received';
    return 'unknown';
};

/**
 * Получение текущего курса BTC
 */
export const getBitcoinPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data.bitcoin?.usd || '68000.00';
        }
        return '68000.00';
    } catch (error) {
        console.error('Error getting Bitcoin price:', error);
        return '68000.00';
    }
};

/**
 * Получение рекомендованной комиссии
 */
export const getRecommendedFee = async () => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/fee-estimates`);
        const data = await response.json();
        
        return {
            fastest: data['1'] || 20,
            halfHour: data['3'] || 15,
            hour: data['6'] || 10,
            economy: data['144'] || 5
        };
    } catch (error) {
        console.error('Error getting recommended fee:', error);
        return {
            fastest: 20,
            halfHour: 15,
            hour: 10,
            economy: 5
        };
    }
};

/**
 * Получение информации о транзакции
 */
export const getTransactionInfo = async (txId) => {
    try {
        const response = await fetch(`${BITCOIN_MAINNET_RPC}/tx/${txId}`);
        return await response.json();
    } catch (error) {
        console.error('Error getting transaction info:', error);
        return null;
    }
};

export default {
    sendBitcoinReal,
    getBitcoinBalance,
    validateBitcoinAddressForMainnet,
    checkBitcoinAddressExists,
    getTransactionHistory,
    getBitcoinPrice,
    getRecommendedFee,
    getTransactionInfo
};