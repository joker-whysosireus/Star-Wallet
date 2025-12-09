import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';

// Mainnet RPC endpoints
const SOLANA_RPC_URLS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana'
];

let currentRpcIndex = 0;
let connection = null;

// Получение сид-фразы из localStorage
const getSeedPhrase = () => {
    try {
        const seedPhrase = localStorage.getItem('wallet_seed_phrase');
        if (!seedPhrase) {
            throw new Error('Seed phrase not found. Please create or restore wallet.');
        }
        return seedPhrase;
    } catch (error) {
        console.error('Error getting seed phrase:', error);
        throw error;
    }
};

// Создание соединения (mainnet)
const createConnection = () => {
    const url = SOLANA_RPC_URLS[currentRpcIndex];
    return new Connection(url, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: false,
        confirmTransactionInitialTimeout: 60000,
    });
};

// Получение соединения с переключением
const getConnection = async () => {
    if (connection) {
        try {
            await connection.getVersion();
            return connection;
        } catch (error) {
            console.error('Connection check failed, switching RPC...');
        }
    }
    
    for (let i = 0; i < SOLANA_RPC_URLS.length; i++) {
        try {
            currentRpcIndex = (currentRpcIndex + 1) % SOLANA_RPC_URLS.length;
            connection = createConnection();
            await connection.getVersion();
            console.log(`Connected to Solana RPC: ${SOLANA_RPC_URLS[currentRpcIndex]}`);
            return connection;
        } catch (error) {
            console.error(`Failed to connect to ${SOLANA_RPC_URLS[currentRpcIndex]}:`, error);
        }
    }
    
    throw new Error('All Solana RPC endpoints failed');
};

// Получение Keypair из сид-фразы (mainnet)
const getKeypairFromSeed = async () => {
    try {
        const seedPhrase = getSeedPhrase();
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        return Keypair.fromSeed(seedArray);
    } catch (error) {
        console.error('Error getting keypair from seed:', error);
        throw error;
    }
};

// Получение баланса SOL (mainnet)
export const getSolBalance = async () => {
    try {
        const keypair = await getKeypairFromSeed();
        const publicKey = keypair.publicKey;
        
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const connection = await getConnection();
                const balance = await connection.getBalance(publicKey);
                return (balance / LAMPORTS_PER_SOL).toFixed(4);
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error);
                if (attempt === 2) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
        
        return '0.0000';
    } catch (error) {
        console.error('Error getting SOL balance:', error);
        return '0.0000';
    }
};

// Отправка SOL (mainnet)
export const sendSol = async (toAddress, solAmount) => {
    try {
        if (!toAddress || !solAmount || parseFloat(solAmount) <= 0) {
            throw new Error('Invalid parameters');
        }

        // Получаем ключ отправителя
        const fromKeypair = await getKeypairFromSeed();

        // Создаем публичный ключ получателя
        const toPubkey = new PublicKey(toAddress);

        // Проверяем баланс
        const connection = await getConnection();
        const balance = await connection.getBalance(fromKeypair.publicKey);
        const balanceInSol = balance / LAMPORTS_PER_SOL;
        
        if (parseFloat(solAmount) > balanceInSol) {
            throw new Error(`Insufficient balance. Available: ${balanceInSol} SOL`);
        }

        // Создаем инструкцию перевода
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPubkey,
            lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
        });

        // Создаем транзакцию
        const transaction = new Transaction().add(transferInstruction);
        transaction.feePayer = fromKeypair.publicKey;

        // Получаем актуальный blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        // Подписываем и отправляем транзакцию
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [fromKeypair],
            {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            }
        );

        console.log(`SOL transaction sent. Signature: ${signature}`);
        
        return { 
            success: true, 
            signature,
            message: `Successfully sent ${solAmount} SOL to ${toAddress}`,
            explorerUrl: `https://solscan.io/tx/${signature}`
        };

    } catch (error) {
        console.error('Error sending SOL:', error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

// Получение цены SOL
export const getSolPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data.solana?.usd || '172.34';
        }
        return '172.34';
    } catch (error) {
        console.error('Error getting SOL price:', error);
        return '172.34';
    }
};

// Проверка адреса Solana
export const validateSolanaAddress = (address) => {
    try {
        new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
};

export default {
    getSolBalance,
    sendSol,
    getSolPrice,
    validateSolanaAddress
};