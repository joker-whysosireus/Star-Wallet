import { sendTransaction } from './storageService';

export const sendRealTransaction = async (transactionData) => {
    try {
        const { blockchain, fromAddress, toAddress, amount, symbol, comment, userData, contractAddress } = transactionData;
        
        if (!blockchain || !toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid transaction parameters');
        }
        
        console.log(`Sending ${amount} ${symbol} from ${fromAddress} to ${toAddress} on ${blockchain}`);
        
        // Получаем seed фразу из userData
        const seedPhrase = userData.seed_phrases;
        if (!seedPhrase) {
            throw new Error('Seed phrase not found');
        }
        
        // Определяем приватный ключ в зависимости от блокчейна
        let privateKey;
        if (blockchain === 'Ethereum' || blockchain === 'BSC') {
            const { ethers } = await import('ethers');
            const { mnemonicToSeedSync } = await import('bip39');
            
            const seed = mnemonicToSeedSync(seedPhrase);
            const hdNode = ethers.HDNodeWallet.fromSeed(seed);
            const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
            privateKey = wallet.privateKey;
        }
        
        // Отправляем транзакцию
        const result = await sendTransaction({
            blockchain,
            fromAddress,
            toAddress,
            amount,
            symbol,
            memo: comment,
            privateKey,
            seedPhrase,
            contractAddress
        });
        
        if (result.success) {
            return {
                success: true,
                hash: result.hash,
                message: `Successfully sent ${amount} ${symbol}`,
                explorerUrl: result.explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error(result.error || 'Transaction failed');
        }
        
    } catch (error) {
        console.error('Error sending transaction:', error);
        throw new Error(`Failed to send transaction: ${error.message}`);
    }
};

// Функция для проверки статуса транзакции
export const checkTransactionStatus = async (blockchain, txHash) => {
    try {
        let url;
        
        switch(blockchain) {
            case 'TON':
                url = `https://toncenter.com/api/v2/getTransactions?hash=${txHash}`;
                break;
            case 'Ethereum':
                url = `https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6`;
                break;
            case 'BSC':
                url = `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=8X9S7Q8J4T5V3C2W1B5N6M7P8Q9R0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5`;
                break;
            case 'Solana':
                // Для Solana другая логика
                break;
            default:
                return 'pending';
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        return data.status === '1' ? 'confirmed' : 'pending';
    } catch (error) {
        console.error('Error checking transaction status:', error);
        return 'pending';
    }
};

export default {
    sendRealTransaction,
    checkTransactionStatus
};