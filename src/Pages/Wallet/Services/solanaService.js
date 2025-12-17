// Services/solanaService.js
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';

// Mainnet конфигурация с реальным ключом
const SOLANA_MAINNET_RPC = 'https://e1a20296-3d29-4edb-bc41-c709a187fbc9.mainnet.rpc.helius.xyz';

/**
 * Реальная отправка SOL на mainnet
 */
export const sendSolReal = async ({ toAddress, amount, userData }) => {
    try {
        console.log(`[SOLANA MAINNET] Sending ${amount} SOL to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters for mainnet');
        }

        // 1. Восстанавливаем ключ отправителя из seed phrase пользователя
        const fromKeypair = await getKeypairFromUserData(userData);

        // 2. Создаем публичный ключ получателя
        const toPubkey = new PublicKey(toAddress);

        // 3. Подключаемся к mainnet
        const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
        
        // 4. Проверяем баланс
        const balance = await connection.getBalance(fromKeypair.publicKey);
        const balanceInSol = balance / LAMPORTS_PER_SOL;
        
        console.log(`Mainnet current balance: ${balanceInSol} SOL`);
        
        if (parseFloat(amount) > balanceInSol) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInSol} SOL`);
        }

        // 5. Создаем инструкцию перевода SOL
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPubkey,
            lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        });

        // 6. Создаем и настраиваем транзакцию
        const transaction = new Transaction().add(transferInstruction);
        transaction.feePayer = fromKeypair.publicKey;

        // 7. Получаем актуальный blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        // 8. Подписываем и отправляем транзакцию
        console.log('Signing and sending mainnet transaction...');
        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [fromKeypair],
            {
                commitment: 'confirmed',
                preflightCommitment: 'confirmed',
            }
        );

        console.log(`SOL mainnet transaction sent. Signature: ${signature}`);
        
        return { 
            success: true, 
            signature,
            message: `Successfully sent ${amount} SOL to ${toAddress} on mainnet`,
            explorerUrl: `https://solscan.io/tx/${signature}`,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[SOLANA MAINNET ERROR]:', error);
        throw new Error(`SOL mainnet send failed: ${error.message}`);
    }
};

/**
 * Получение Keypair из userData
 */
const getKeypairFromUserData = async (userData) => {
    try {
        const seedPhrase = userData?.seed_phrases;
        if (!seedPhrase) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer).slice(32, 64);
        return Keypair.fromSeed(seedArray);
    } catch (error) {
        console.error('Error getting keypair from user data:', error);
        throw error;
    }
};

/**
 * Валидация Solana адреса для mainnet
 */
export const validateSolanaAddressForMainnet = (address) => {
    try {
        const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!solanaRegex.test(address)) return false;
        
        new PublicKey(address);
        return true;
    } catch (error) {
        console.error('Solana address validation error:', error);
        return false;
    }
};

/**
 * Получение баланса SOL
 */
export const getSolBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toFixed(6);
    } catch (error) {
        console.error('Error getting SOL balance:', error);
        return '0.000000';
    }
};

/**
 * Получение цены SOL
 */
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

/**
 * Проверка существования Solana адреса
 */
export const checkSolanaAddressExists = async (address) => {
    try {
        const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
        const publicKey = new PublicKey(address);
        const accountInfo = await connection.getAccountInfo(publicKey);
        return accountInfo !== null;
    } catch (error) {
        console.error('Error checking Solana address existence:', error);
        return false;
    }
};

export default {
    getSolBalance,
    sendSolReal,
    validateSolanaAddressForMainnet,
    getSolPrice,
    checkSolanaAddressExists
};