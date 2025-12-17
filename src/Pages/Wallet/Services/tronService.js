// Services/tronService.js
import TronWeb from 'tronweb';
import * as bip39 from 'bip39';
import { ethers } from 'ethers';

// Mainnet конфигурация
const TRON_MAINNET_RPC = 'https://api.trongrid.io';

/**
 * Получение кошелька Tron из сид-фразы пользователя
 */
const getTronWalletFromUserData = async (userData) => {
    try {
        if (!userData?.seed_phrases) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedPhrase = userData.seed_phrases;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем путь BIP44 для Tron: m/44'/195'/0'/0/0
        const tronWallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = tronWallet.privateKey.slice(2); // Убираем '0x'
        
        const tronWeb = new TronWeb({
            fullHost: TRON_MAINNET_RPC,
            privateKey: privateKey
        });
        
        return {
            tronWeb,
            address: tronWeb.address.fromPrivateKey(privateKey),
            privateKey: privateKey
        };
    } catch (error) {
        console.error('Error getting Tron wallet from user data:', error);
        throw error;
    }
};

/**
 * Реальная отправка TRX на mainnet
 */
export const sendTrxReal = async ({ toAddress, amount, userData }) => {
    try {
        console.log(`[TRON MAINNET] Sending ${amount} TRX to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters for mainnet');
        }

        // Валидация Tron адреса
        if (!validateTronAddressForMainnet(toAddress)) {
            throw new Error('Invalid Tron address format for mainnet');
        }

        // Получаем кошелек из userData
        const { tronWeb, address: fromAddress } = await getTronWalletFromUserData(userData);
        
        // Проверяем баланс
        const balance = await tronWeb.trx.getBalance(fromAddress);
        const balanceInTRX = balance / 1_000_000;
        
        console.log(`Mainnet current balance: ${balanceInTRX} TRX`);
        
        if (parseFloat(amount) > balanceInTRX) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInTRX} TRX`);
        }

        // Конвертируем amount в Sun (1 TRX = 1,000,000 Sun)
        const amountInSun = Math.floor(amount * 1_000_000);
        
        console.log('Signing and sending mainnet transaction...');
        
        // Создаем транзакцию
        const transaction = await tronWeb.transactionBuilder.sendTrx(
            toAddress,
            amountInSun,
            fromAddress
        );
        
        // Подписываем транзакцию
        const signedTransaction = await tronWeb.trx.sign(transaction);
        
        // Отправляем транзакцию
        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        
        console.log(`Mainnet transaction sent. TxID: ${result.txid}`);
        
        // Ждем подтверждения
        console.log('Waiting for mainnet confirmation...');
        await waitForTransactionConfirmation(result.txid, tronWeb);
        
        return {
            success: true,
            hash: result.txid,
            message: `Successfully sent ${amount} TRX to ${toAddress} on mainnet`,
            explorerUrl: `https://tronscan.org/#/transaction/${result.txid}`,
            timestamp: new Date().toISOString(),
            confirmed: true
        };

    } catch (error) {
        console.error('[TRON MAINNET ERROR]:', error);
        throw new Error(`Failed to send TRX on mainnet: ${error.message}`);
    }
};

/**
 * Реальная отправка TRC20 токенов на mainnet
 */
export const sendTRC20Real = async ({ contractAddress, toAddress, amount, userData }) => {
    try {
        console.log(`[TRON MAINNET] Sending ${amount} TRC20 to ${toAddress}`);
        
        if (!contractAddress || !toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters for mainnet');
        }

        if (!validateTronAddressForMainnet(toAddress)) {
            throw new Error('Invalid Tron address format for mainnet');
        }

        // Получаем кошелек из userData
        const { tronWeb, address: fromAddress } = await getTronWalletFromUserData(userData);
        
        // Получаем контракт токена
        const contract = await tronWeb.contract().at(contractAddress);
        
        // Получаем decimals токена
        const decimals = await contract.decimals().call();
        const tokenDecimals = parseInt(decimals.toString());
        
        // Получаем баланс
        const balance = await contract.balanceOf(fromAddress).call();
        const balanceInUnits = parseFloat(balance.toString()) / Math.pow(10, tokenDecimals);
        
        console.log(`Mainnet token balance: ${balanceInUnits}`);
        
        // Конвертируем amount в наименьшие единицы
        const amountInUnits = Math.floor(amount * Math.pow(10, tokenDecimals));
        
        if (parseFloat(balance.toString()) < amountInUnits) {
            throw new Error(`Insufficient token balance on mainnet. Available: ${balanceInUnits}`);
        }
        
        // Получаем символ токена
        let tokenSymbol = 'TRC20';
        try {
            const symbol = await contract.symbol().call();
            tokenSymbol = symbol.toString();
        } catch (error) {
            console.warn('Could not get token symbol');
        }
        
        console.log(`Sending ${amount} ${tokenSymbol}...`);
        
        // Создаем транзакцию transfer
        const transaction = await contract.transfer(
            toAddress,
            amountInUnits.toString()
        ).send({
            feeLimit: 100_000_000,
            callValue: 0,
            shouldPollResponse: false
        });
        
        console.log(`Mainnet TRC20 transaction sent. TxID: ${transaction}`);
        
        // Ждем подтверждения
        await waitForTransactionConfirmation(transaction, tronWeb);
        
        return {
            success: true,
            hash: transaction,
            message: `Successfully sent ${amount} ${tokenSymbol} to ${toAddress} on mainnet`,
            explorerUrl: `https://tronscan.org/#/transaction/${transaction}`,
            timestamp: new Date().toISOString(),
            tokenSymbol: tokenSymbol,
            confirmed: true
        };

    } catch (error) {
        console.error('[TRON MAINNET TRC20 ERROR]:', error);
        throw new Error(`Failed to send TRC20 tokens on mainnet: ${error.message}`);
    }
};

/**
 * Валидация Tron адреса для mainnet
 */
export const validateTronAddressForMainnet = (address) => {
    try {
        // Tron адреса начинаются с T и имеют длину 34 символа
        const tronAddressRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
        return tronAddressRegex.test(address);
    } catch (error) {
        console.error('Tron address validation error:', error);
        return false;
    }
};

/**
 * Проверка существования Tron адреса на mainnet
 */
export const checkTronAddressExists = async (address) => {
    try {
        const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}`);
        const data = await response.json();
        return data.data && data.data.length > 0;
    } catch (error) {
        console.error('Error checking Tron address existence:', error);
        return false;
    }
};

/**
 * Получение баланса TRX с mainnet
 */
export const getTronBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].balance) {
            const balanceInTRX = data.data[0].balance / 1_000_000;
            return balanceInTRX.toFixed(6);
        }
        return '0.000000';
    } catch (error) {
        console.error('Error getting TRX balance:', error);
        return '0.000000';
    }
};

/**
 * Получение баланса TRC20 токена
 */
export const getTRC20Balance = async (address, contractAddress) => {
    try {
        const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}/trc20?contract_address=${contractAddress}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const tokenData = data.data[0];
            const balance = tokenData.balance / Math.pow(10, tokenData.tokenDecimal);
            return balance.toFixed(6);
        }
        return '0.000000';
    } catch (error) {
        console.error('Error getting TRC20 balance:', error);
        return '0.000000';
    }
};

/**
 * Получение истории транзакций
 */
export const getTransactionHistory = async (address, limit = 10) => {
    try {
        const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}/transactions?limit=${limit}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return data.data.map(tx => ({
                hash: tx.txID,
                timestamp: tx.raw_data.timestamp,
                from: tx.raw_data.contract[0].parameter.value.owner_address || 'Unknown',
                to: tx.raw_data.contract[0].parameter.value.to_address || address,
                amount: tx.raw_data.contract[0].parameter.value.amount / 1_000_000 || '0',
                status: 'confirmed',
                type: tx.raw_data.contract[0].type === 'TransferContract' ? 'transfer' : 'other'
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

/**
 * Получение текущего курса TRX
 */
export const getTrxPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data.tron?.usd || '0.12';
        }
        return '0.12';
    } catch (error) {
        console.error('Error getting TRX price:', error);
        return '0.12';
    }
};

/**
 * Ожидание подтверждения транзакции
 */
const waitForTransactionConfirmation = async (txId, tronWeb, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const txInfo = await tronWeb.trx.getTransactionInfo(txId);
            if (txInfo && txInfo.id) {
                console.log(`Transaction confirmed at block ${txInfo.blockNumber}`);
                return txInfo;
            }
        } catch (error) {
            // Транзакция еще не подтверждена
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Transaction confirmation timeout');
};

/**
 * Получение рекомендованной комиссии
 */
export const getRecommendedFee = async () => {
    try {
        const response = await fetch(`${TRON_MAINNET_RPC}/wallet/getbandwidthprices`);
        const data = await response.json();
        return {
            bandwidth: data.prices || 0,
            energy: 0
        };
    } catch (error) {
        console.error('Error getting recommended fee:', error);
        return {
            bandwidth: 1000,
            energy: 0
        };
    }
};

/**
 * Проверка активации аккаунта
 */
export const checkAccountActivated = async (address) => {
    try {
        const response = await fetch(`${TRON_MAINNET_RPC}/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            const account = data.data[0];
            return account.balance > 0 || account.trc20.length > 0;
        }
        return false;
    } catch (error) {
        console.error('Error checking account activation:', error);
        return false;
    }
};

export default {
    sendTrxReal,
    sendTRC20Real,
    validateTronAddressForMainnet,
    checkTronAddressExists,
    getTronBalance,
    getTRC20Balance,
    getTransactionHistory,
    getTrxPrice,
    getRecommendedFee,
    checkAccountActivated
};