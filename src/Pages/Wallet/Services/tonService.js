// src/Pages/Wallet/Services/tonService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, internal, fromNano, toNano } from '@ton/ton';

// Mainnet конфигурация
const TON_RPC_URL = 'https://toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a';

// Получение сид-фразы из localStorage
const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem('wallet_seed_phrase');
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        return null;
    }
};

// Создаем клиент TON
const createTonClient = () => {
    return new TonClient({
        endpoint: TON_RPC_URL,
        apiKey: TON_API_KEY
    });
};

// Получаем кошелек из сид-фразы
const getWalletFromSeed = async () => {
    try {
        const seedPhrase = getSeedPhrase();
        if (!seedPhrase) {
            throw new Error('Seed phrase not found. Please create a wallet first.');
        }

        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({
            publicKey: keyPair.publicKey,
            workchain: 0
        });

        const client = createTonClient();
        return { 
            walletContract: client.open(wallet), 
            keyPair,
            client 
        };
    } catch (error) {
        console.error('Error getting wallet from seed:', error);
        throw error;
    }
};

// Отправка TON
export const sendTon = async (toAddress, amount) => {
    try {
        console.log(`Sending ${amount} TON to ${toAddress}`);
        
        // Валидация параметров
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            throw new Error('Invalid parameters. Please check recipient address and amount.');
        }

        // Валидация адреса
        if (!validateTonAddress(toAddress)) {
            throw new Error('Invalid TON address format');
        }

        const { walletContract, keyPair } = await getWalletFromSeed();
        
        // Проверяем баланс отправителя
        const balance = await walletContract.getBalance();
        const balanceInTon = fromNano(balance);
        
        console.log(`Current balance: ${balanceInTon} TON`);
        
        if (parseFloat(amount) > parseFloat(balanceInTon)) {
            throw new Error(`Insufficient balance. Available: ${balanceInTon} TON`);
        }

        // Получаем seqno
        const seqno = await walletContract.getSeqno();
        console.log(`Current seqno: ${seqno}`);

        // Конвертируем в нанотоны
        const amountInNano = toNano(amount);

        // Создаем транзакцию
        const transfer = walletContract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: toAddress,
                    value: amountInNano,
                    body: '',
                    bounce: false
                })
            ]
        });

        // Отправляем транзакцию
        await walletContract.send(transfer);

        // Ждем подтверждения
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const currentSeqno = await walletContract.getSeqno();
            if (currentSeqno > seqno) {
                console.log(`Transaction confirmed. New seqno: ${currentSeqno}`);
                return {
                    success: true,
                    hash: `seqno_${seqno}`,
                    message: `Successfully sent ${amount} TON to ${toAddress}`,
                    explorerUrl: `https://tonscan.org/address/${toAddress}`,
                    timestamp: new Date().toISOString()
                };
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
        console.error('Error sending TON:', error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

// Получение баланса TON
export const getTonBalance = async () => {
    try {
        const { walletContract } = await getWalletFromSeed();
        const balance = await walletContract.getBalance();
        const balanceInTon = fromNano(balance);
        return balanceInTon;
    } catch (error) {
        console.error('Error getting TON balance:', error);
        return '0';
    }
};

// Проверка адреса TON
export const validateTonAddress = (address) => {
    try {
        const tonAddressRegex = /^(?:[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|kQ[A-Za-z0-9_-]{48}|EQ[A-Za-z0-9_-]{48})$/;
        return tonAddressRegex.test(address);
    } catch (error) {
        console.error('Error validating TON address:', error);
        return false;
    }
};

// Получение истории транзакций
export const getTransactionHistory = async (limit = 10) => {
    try {
        const { walletContract } = await getWalletFromSeed();
        const address = walletContract.address.toString();
        
        const response = await fetch(
            `${TON_RPC_URL}/getTransactions?address=${address}&limit=${limit}&api_key=${TON_API_KEY}`
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.ok && data.result) {
                return data.result.map(tx => ({
                    hash: tx.transaction_id.hash,
                    timestamp: tx.utime * 1000,
                    from: tx.in_msg?.source || 'Unknown',
                    to: tx.in_msg?.destination || address,
                    amount: fromNano(tx.in_msg?.value || '0'),
                    fee: fromNano(tx.fee || '0'),
                    status: 'confirmed',
                    type: tx.in_msg?.source === address ? 'outgoing' : 'incoming'
                }));
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

// Получение текущего курса TON
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

export default {
    sendTon,
    getTonBalance,
    validateTonAddress,
    getTransactionHistory,
    getTonPrice
};