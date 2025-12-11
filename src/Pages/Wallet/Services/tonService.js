import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, internal, fromNano, toNano, Address } from '@ton/ton';
import { beginCell } from '@ton/ton';

const TON_RPC_URL = 'https://toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = '6e8469038f459cce744a29d3947a0228dd4d7b88e448392c9581799582db5f3a';

const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem('wallet_seed_phrase');
        if (!seedPhrase) {
            throw new Error('Seed phrase not found');
        }
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        throw error;
    }
};

const createTonClient = () => {
    return new TonClient({
        endpoint: TON_RPC_URL,
        apiKey: TON_API_KEY
    });
};

const getWalletFromSeed = async () => {
    try {
        const seedPhrase = getSeedPhrase();
        
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

export const sendTon = async (toAddress, amount, comment = '') => {
    try {
        console.log(`Sending ${amount} TON to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0) {
            throw new Error('Invalid parameters');
        }

        if (!validateTonAddress(toAddress)) {
            throw new Error('Invalid TON address format');
        }

        const { walletContract, keyPair, client } = await getWalletFromSeed();
        
        const balance = await walletContract.getBalance();
        const balanceInTon = fromNano(balance);
        
        console.log(`Current balance: ${balanceInTon} TON`);
        
        if (parseFloat(amount) > parseFloat(balanceInTon)) {
            throw new Error(`Insufficient balance. Available: ${balanceInTon} TON`);
        }

        const seqno = await walletContract.getSeqno();
        console.log(`Current seqno: ${seqno}`);

        const amountInNano = toNano(amount);

        const transferBody = comment ? beginCell()
            .storeUint(0, 32)
            .storeStringTail(comment)
            .endCell() : '';

        const transfer = walletContract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: toAddress,
                    value: amountInNano,
                    body: transferBody,
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

export const getTonBalance = async () => {
    try {
        const { walletContract } = await getWalletFromSeed();
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
        Address.parse(address);
        return true;
    } catch (error) {
        return false;
    }
};

export const getTransactionHistory = async (limit = 10) => {
    try {
        const { walletContract, client } = await getWalletFromSeed();
        const address = walletContract.address;
        
        console.log(`Fetching transaction history for: ${address.toString()}`);
        
        const transactions = await client.getTransactions(address, {
            limit: limit,
            lt: null,
            hash: null,
            to_lt: null,
            archival: false
        });
        
        const formattedTransactions = [];
        
        for (const tx of transactions) {
            try {
                const inMsg = tx.inMessage;
                
                let from = 'Unknown';
                let to = address.toString();
                let amount = '0';
                
                if (inMsg && inMsg.info.type === 'internal') {
                    const info = inMsg.info;
                    from = info.src?.toString() || 'Unknown';
                    to = info.dest?.toString() || address.toString();
                    amount = fromNano(info.value.coins);
                }
                
                formattedTransactions.push({
                    hash: tx.hash().toString('hex'),
                    timestamp: tx.now * 1000,
                    from: from,
                    to: to,
                    amount: amount,
                    fee: fromNano(tx.totalFees.coins),
                    status: 'confirmed',
                    type: from === address.toString() ? 'outgoing' : 'incoming'
                });
            } catch (error) {
                console.error('Error processing transaction:', error);
            }
        }
        
        return formattedTransactions;
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
            const price = data['the-open-network']?.usd;
            console.log(`Current TON price: $${price}`);
            return price ? price.toString() : '6.24';
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