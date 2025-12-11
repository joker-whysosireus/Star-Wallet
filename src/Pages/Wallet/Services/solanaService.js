// Services/solanaService.js
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';

const SOLANA_RPC_URLS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana/'
];

const getKeypairFromUserData = async (userData) => {
    try {
        if (!userData?.seed_phrases) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedPhrase = userData.seed_phrases;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer).slice(0, 32);
        const keypair = Keypair.fromSeed(seedArray);
        
        return keypair;
    } catch (error) {
        console.error('Error getting keypair from user data:', error);
        throw error;
    }
};

export const getSolBalance = async (userData) => {
    try {
        const keypair = await getKeypairFromUserData(userData);
        const publicKey = keypair.publicKey;
        
        console.log(`Fetching SOL balance for: ${publicKey.toBase58()}`);
        
        for (const url of SOLANA_RPC_URLS) {
            try {
                const connection = new Connection(url, 'confirmed');
                const balance = await connection.getBalance(publicKey);
                const balanceInSol = (balance / LAMPORTS_PER_SOL).toFixed(4);
                
                console.log(`SOL balance: ${balanceInSol}`);
                return balanceInSol;
            } catch (error) {
                console.error(`Failed with ${url}:`, error.message);
                continue;
            }
        }
        
        return '0.0000';
    } catch (error) {
        console.error('Error getting SOL balance:', error);
        return '0.0000';
    }
};

export const sendSol = async ({ toAddress, amount, memo = '', userData }) => {
    try {
        console.log(`Sending ${amount} SOL to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters');
        }

        let toPubkey;
        try {
            toPubkey = new PublicKey(toAddress);
        } catch (error) {
            throw new Error('Invalid Solana address');
        }

        const fromKeypair = await getKeypairFromUserData(userData);

        let connection;
        for (const url of SOLANA_RPC_URLS) {
            try {
                connection = new Connection(url, 'confirmed');
                await connection.getVersion();
                break;
            } catch (error) {
                console.error(`Failed to connect to ${url}:`, error.message);
                continue;
            }
        }

        if (!connection) {
            throw new Error('All RPC endpoints failed');
        }

        const balance = await connection.getBalance(fromKeypair.publicKey);
        const balanceInSol = balance / LAMPORTS_PER_SOL;
        
        console.log(`Current balance: ${balanceInSol} SOL`);
        
        if (parseFloat(amount) > balanceInSol) {
            throw new Error(`Insufficient balance. Available: ${balanceInSol.toFixed(4)} SOL`);
        }

        const transferInstruction = SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: toPubkey,
            lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
        });

        const transaction = new Transaction().add(transferInstruction);
        
        transaction.feePayer = fromKeypair.publicKey;

        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;

        console.log('Signing transaction...');
        
        transaction.sign(fromKeypair);
        
        if (!transaction.signature) {
            throw new Error('Failed to sign transaction');
        }

        console.log('Sending transaction...');
        
        const signature = await connection.sendRawTransaction(
            transaction.serialize(),
            {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            }
        );

        console.log(`Transaction sent. Signature: ${signature}`);
        
        return { 
            success: true, 
            signature,
            message: `Successfully sent ${amount} SOL to ${toAddress}`,
            explorerUrl: `https://solscan.io/tx/${signature}`,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error sending SOL:', error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

export const getSolPrice = async () => {
    try {
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        
        if (response.ok) {
            const data = await response.json();
            const price = data.solana?.usd;
            console.log(`Current SOL price: $${price}`);
            return price ? price.toString() : '172.34';
        }
        
        return '172.34';
    } catch (error) {
        console.error('Error getting SOL price:', error);
        return '172.34';
    }
};

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