// Services/tonService.js
import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, internal, fromNano, toNano } from '@ton/ton';

const TON_RPC_URL = 'https://toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a';

const createTonClient = () => {
    return new TonClient({
        endpoint: TON_RPC_URL,
        apiKey: TON_API_KEY
    });
};

const getWalletFromUserData = async (userData) => {
    try {
        if (!userData?.seed_phrases) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedPhrase = userData.seed_phrases;
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
        console.error('Error getting wallet from user data:', error);
        throw error;
    }
};

export const sendTon = async ({ toAddress, amount, comment = '', userData }) => {
    try {
        console.log(`Sending ${amount} TON to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters');
        }

        const { walletContract, keyPair, client } = await getWalletFromUserData(userData);
        
        const balance = await walletContract.getBalance();
        const balanceInTon = fromNano(balance);
        
        console.log(`Current balance: ${balanceInTon} TON`);
        
        if (parseFloat(amount) > parseFloat(balanceInTon)) {
            throw new Error(`Insufficient balance. Available: ${balanceInTon} TON`);
        }

        const seqno = await walletContract.getSeqno();
        console.log(`Current seqno: ${seqno}`);

        const amountInNano = toNano(amount);

        const transfer = walletContract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: toAddress,
                    value: amountInNano,
                    body: comment || '',
                    bounce: false
                })
            ]
        });

        console.log('Sending transaction...');
        
        await walletContract.send(transfer);

        console.log('Waiting for confirmation...');
        
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                const currentSeqno = await walletContract.getSeqno();
                if (currentSeqno > seqno) {
                    console.log(`Transaction confirmed. New seqno: ${currentSeqno}`);
                    
                    const transactions = await client.getTransactions(walletContract.address, {
                        limit: 1,
                        lt: null,
                        hash: null,
                        to_lt: null,
                        archival: false
                    });
                    
                    const txHash = transactions[0]?.hash().toString('hex') || `seqno_${seqno}`;
                    
                    return {
                        success: true,
                        hash: txHash,
                        message: `Successfully sent ${amount} TON to ${toAddress}`,
                        explorerUrl: `https://tonscan.org/tx/${txHash}`,
                        timestamp: new Date().toISOString(),
                        seqno: seqno
                    };
                }
            } catch (error) {
                console.error('Error checking confirmation:', error);
            }
            
            attempts++;
        }

        return {
            success: true,
            hash: `seqno_${seqno}`,
            message: `Transaction sent (awaiting confirmation)`,
            explorerUrl: `https://tonscan.org/address/${toAddress}`,
            timestamp: new Date().toISOString(),
            seqno: seqno
        };

    } catch (error) {
        console.error('Error sending TON:', error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const getTonBalance = async (userData) => {
    try {
        if (!userData) {
            throw new Error('User data is required');
        }
        
        const { walletContract } = await getWalletFromUserData(userData);
        const balance = await walletContract.getBalance();
        const balanceInTon = fromNano(balance);
        console.log(`TON balance: ${balanceInTon}`);
        return parseFloat(balanceInTon).toFixed(4);
    } catch (error) {
        console.error('Error getting TON balance:', error);
        return '0.0000';
    }
};

export const validateTonAddress = (address) => {
    try {
        return address && address.length > 0;
    } catch (error) {
        return false;
    }
};

export const getTransactionHistory = async (userData, limit = 10) => {
    try {
        if (!userData) {
            return [];
        }
        
        const { walletContract, client } = await getWalletFromUserData(userData);
        const address = walletContract.address;
        
        const transactions = await client.getTransactions(address, {
            limit: limit,
            lt: null,
            hash: null,
            to_lt: null,
            archival: false
        });
        
        return transactions.map(tx => ({
            hash: tx.hash().toString('hex'),
            timestamp: tx.now * 1000,
            from: tx.inMessage?.info?.src?.toString() || 'Unknown',
            to: tx.inMessage?.info?.dest?.toString() || address.toString(),
            amount: fromNano(tx.inMessage?.info?.value?.coins || 0),
            status: 'confirmed',
            type: tx.inMessage?.info?.src?.toString() === address.toString() ? 'outgoing' : 'incoming'
        }));
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        return [];
    }
};

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