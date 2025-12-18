import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, internal, fromNano, toNano } from '@ton/ton';

// Mainnet конфигурация с реальным ключом
const TON_RPC_URL = 'https://toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a';

/**
 * Реальная отправка TON на mainnet
 */
export const sendTonReal = async ({ fromAddress, toAddress, amount, seedPhrase, comment = '' }) => {
    try {
        console.log(`[TON MAINNET] Sending ${amount} TON from ${fromAddress} to ${toAddress}`);
        
        if (!fromAddress || !toAddress || !amount || parseFloat(amount) <= 0 || !seedPhrase) {
            throw new Error('Invalid parameters for mainnet');
        }

        // Валидация адреса для mainnet
        if (!validateTonAddressForMainnet(toAddress)) {
            throw new Error('Invalid TON address format for mainnet');
        }

        // Создаем клиент для mainnet
        const client = new TonClient({
            endpoint: TON_RPC_URL,
            apiKey: TON_API_KEY
        });

        // Получаем кошелек из сид-фразы
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });

        const walletContract = client.open(wallet);
        const senderAddress = walletContract.address.toString();
        
        // Проверяем, соответствует ли адрес
        if (fromAddress !== senderAddress) {
            console.warn('Provided address does not match generated wallet address');
        }

        // Проверяем баланс отправителя
        const balance = await client.getBalance(senderAddress);
        const balanceInTon = parseFloat(fromNano(balance));
        
        console.log(`Mainnet current balance: ${balanceInTon} TON`);
        
        if (parseFloat(amount) > balanceInTon) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInTon} TON`);
        }

        // Получаем seqno
        const seqno = await walletContract.getSeqno();
        console.log(`Mainnet current seqno: ${seqno}`);

        // Конвертируем в нанотоны
        const amountInNano = toNano(amount);

        // Создаем транзакцию с комментарием
        const transfer = walletContract.createTransfer({
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

        // Отправляем транзакцию
        await walletContract.send(transfer);

        // Ждем подтверждения
        for (let i = 0; i < 60; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const currentSeqno = await walletContract.getSeqno();
                if (currentSeqno > seqno) {
                    console.log(`Mainnet transaction confirmed. New seqno: ${currentSeqno}`);
                    
                    // Получаем хэш транзакции
                    const transactions = await getTransactionHistory(senderAddress, 1);
                    const latestTx = transactions[0];
                    
                    return {
                        success: true,
                        hash: latestTx?.hash || `seqno_${seqno}`,
                        message: `Successfully sent ${amount} TON to ${toAddress} on mainnet`,
                        explorerUrl: `https://tonscan.org/tx/${toAddress}`,
                        timestamp: new Date().toISOString(),
                        confirmed: true
                    };
                }
            } catch (seqnoError) {
                console.warn('Error checking seqno:', seqnoError);
            }
        }

        // Если не подтвердилось за 60 секунд, возвращаем как pending
        return {
            success: true,
            hash: `seqno_${seqno}`,
            message: `Transaction sent to mainnet (awaiting confirmation)`,
            explorerUrl: `https://tonscan.org/address/${toAddress}`,
            timestamp: new Date().toISOString(),
            confirmed: false
        };

    } catch (error) {
        console.error('[TON MAINNET ERROR]:', error);
        throw new Error(`Failed to send TON on mainnet: ${error.message}`);
    }
};

// Создаем клиент TON (mainnet)
const createTonClient = () => {
    return new TonClient({
        endpoint: TON_RPC_URL,
        apiKey: TON_API_KEY
    });
};

/**
 * Получение баланса TON (mainnet)
 */
export const getTonBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const client = createTonClient();
        const balance = await client.getBalance(address);
        const balanceInTon = fromNano(balance);
        
        console.log(`TON balance for ${address}: ${balanceInTon}`);
        return parseFloat(balanceInTon).toFixed(6);
    } catch (error) {
        console.error('Error getting TON balance:', error);
        return '0.000000';
    }
};

/**
 * Валидация TON адреса
 */
export const validateTonAddress = (address) => {
    try {
        const tonAddressRegex = /^(?:0Q[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|E[A-Za-z0-9_-]{48})$/;
        return tonAddressRegex.test(address);
    } catch (error) {
        console.error('Error validating TON address:', error);
        return false;
    }
};

/**
 * Валидация TON адреса для mainnet
 */
export const validateTonAddressForMainnet = (address) => {
    try {
        const mainnetTonAddressRegex = /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/;
        
        if (!mainnetTonAddressRegex.test(address)) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error validating TON address for mainnet:', error);
        return false;
    }
};

/**
 * Получение истории транзакций (mainnet)
 */
export const getTransactionHistory = async (address, limit = 10) => {
    try {
        const client = createTonClient();
        const transactions = await client.getTransactions(address, { limit });
        
        return transactions.map(tx => ({
            hash: tx.hash().toString('hex'),
            timestamp: tx.now * 1000,
            from: tx.inMessage?.info.src?.toString() || 'Unknown',
            to: tx.inMessage?.info.dest?.toString() || address,
            amount: fromNano(tx.inMessage?.info.value.coins || '0'),
            fee: fromNano(tx.totalFees.coins),
            status: 'confirmed',
            type: tx.inMessage?.info.src?.toString() === address ? 'outgoing' : 'incoming'
        }));
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

/**
 * Получение текущего курса TON
 */
export const getTonPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data['the-open-network']?.usd || '6.24';
        }
        return '6.24';
    } catch (error) {
        console.error('Error getting TON price:', error);
        return '6.24';
    }
};

/**
 * Проверка существования адреса на mainnet
 */
export const checkTonAddressExists = async (address) => {
    try {
        const client = createTonClient();
        const balance = await client.getBalance(address);
        return balance > 0;
    } catch (error) {
        console.error('Error checking TON address existence:', error);
        return false;
    }
};

export default {
    getTonBalance,
    sendTonReal,
    validateTonAddress,
    validateTonAddressForMainnet,
    getTransactionHistory,
    getTonPrice,
    checkTonAddressExists
};