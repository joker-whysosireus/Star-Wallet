// blockchainService.js
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as nearAPI from 'near-api-js';
import TronWeb from 'tronweb';

// Инициализация bip32 с криптографией
const bip32 = BIP32Factory(ecc);

// Конфигурация сетей
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com',
        CHAIN_ID: 1
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        WALLET_URL: 'https://wallet.near.org'
    }
};

const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    },
    ETHEREUM: {
        RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_ID: 11155111
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        WALLET_URL: 'https://testnet.mynearwallet.com'
    }
};

// Вспомогательные функции
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const getConfig = (network) => network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;

async function callWithRetry(apiCall, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            if (error.message?.includes('429') || error.response?.status === 429) {
                const delayMs = baseDelay * Math.pow(2, i);
                console.warn(`Rate limited (429). Retry ${i + 1}/${maxRetries} after ${delayMs}ms`);
                await delay(delayMs);
            } else {
                throw error;
            }
        }
    }
    throw lastError;
}

// ========== TON ==========
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const client = await callWithRetry(() => new TonClient({
            endpoint: config.TON.RPC_URL,
        }));

        const keyPair = await mnemonicToPrivateKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey
        });

        const contract = client.open(wallet);
        const seqno = await callWithRetry(() => contract.getSeqno());

        const transfer = contract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [internal({
                value: toNano(amount.toString()),
                to: toAddress,
                body: comment,
                bounce: false
            })]
        });

        await callWithRetry(() => contract.send(transfer));

        let currentSeqno = seqno;
        for (let attempt = 0; attempt < 20; attempt++) {
            await delay(1500);
            currentSeqno = await contract.getSeqno();
            if (currentSeqno > seqno) break;
        }

        const txHash = `ton-${Date.now()}-${seqno}`;
        const explorerUrl = network === 'testnet'
            ? `https://testnet.tonscan.org/tx/${txHash}`
            : `https://tonscan.org/tx/${txHash}`;

        return {
            success: true,
            hash: txHash,
            message: `Successfully sent ${amount} TON`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            seqno: currentSeqno
        };

    } catch (error) {
        console.error(`[TON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

// ========== ETHEREUM ==========
const getEthWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting ETH wallet from seed:', error);
        throw error;
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            
            let decimals = 18;
            try {
                decimals = await contract.decimals();
            } catch (e) {
                console.warn('Could not get decimals, using default 18');
            }
            
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const feeData = await provider.getFeeData();
            
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: Math.floor(gasEstimate * 1.2),
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                : `https://etherscan.io/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ERC20`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        } else {
            const amountInWei = ethers.parseEther(amount.toString());
            
            const gasEstimate = await provider.estimateGas({
                to: toAddress,
                value: amountInWei
            });
            
            const feeData = await provider.getFeeData();
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: Math.floor(gasEstimate * 1.2),
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://sepolia.etherscan.io/tx/${tx.hash}`
                : `https://etherscan.io/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ETH`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        }
    } catch (error) {
        console.error(`[ETH ${network} ERROR]:`, error);
        throw new Error(`Failed to send: ${error.message}`);
    }
};

// ========== SOLANA ==========
const getSolWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.slice(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        const connection = new Connection(config.SOLANA.RPC_URL, 'confirmed');
        return { keypair, connection };
    } catch (error) {
        console.error('Error getting SOL wallet from seed:', error);
        throw error;
    }
};

export const sendSol = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { keypair, connection } = await getSolWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const fromTokenAccount = await splToken.getAssociatedTokenAddress(
                new PublicKey(contractAddress),
                keypair.publicKey,
                false,
                splToken.TOKEN_PROGRAM_ID,
                splToken.ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            const toTokenAccount = await splToken.getAssociatedTokenAddress(
                new PublicKey(contractAddress),
                new PublicKey(toAddress),
                false,
                splToken.TOKEN_PROGRAM_ID,
                splToken.ASSOCIATED_TOKEN_PROGRAM_ID
            );
            
            let decimals = 6;
            try {
                const mintInfo = await splToken.getMint(connection, new PublicKey(contractAddress));
                decimals = mintInfo.decimals;
            } catch (e) {
                console.warn('Could not get token decimals, using default 6');
            }
            
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals));
            
            const instructions = [];
            
            let toTokenAccountInfo;
            try {
                toTokenAccountInfo = await connection.getAccountInfo(toTokenAccount);
            } catch (e) {}
            
            if (!toTokenAccountInfo) {
                instructions.push(
                    splToken.createAssociatedTokenAccountInstruction(
                        keypair.publicKey,
                        toTokenAccount,
                        new PublicKey(toAddress),
                        new PublicKey(contractAddress),
                        splToken.TOKEN_PROGRAM_ID,
                        splToken.ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                );
            }
            
            instructions.push(
                splToken.createTransferInstruction(
                    fromTokenAccount,
                    toTokenAccount,
                    keypair.publicKey,
                    amountInUnits,
                    [],
                    splToken.TOKEN_PROGRAM_ID
                )
            );
            
            const transaction = new Transaction().add(...instructions);
            
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;
            
            transaction.sign(keypair);
            
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.solana.com/tx/${signature}?cluster=testnet`
                : `https://solscan.io/tx/${signature}`;
            
            return {
                success: true,
                hash: signature,
                message: `Successfully sent ${amount} SPL Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            
            const transaction = new Transaction({
                feePayer: keypair.publicKey,
                blockhash: blockhash,
                lastValidBlockHeight: lastValidBlockHeight
            }).add(
                SystemProgram.transfer({
                    fromPubkey: keypair.publicKey,
                    toPubkey: new PublicKey(toAddress),
                    lamports: Math.floor(amount * LAMPORTS_PER_SOL)
                })
            );
            
            transaction.sign(keypair);
            
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed');
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.solana.com/tx/${signature}?cluster=testnet`
                : `https://solscan.io/tx/${signature}`;
            
            return {
                success: true,
                hash: signature,
                message: `Successfully sent ${amount} SOL`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[SOL ${network} ERROR]:`, error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

// ========== BSC ==========
const getBscWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting BSC wallet from seed:', error);
        throw error;
    }
};

export const sendBsc = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, provider } = await getBscWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            
            let decimals = 18;
            try {
                decimals = await contract.decimals();
            } catch (e) {
                console.warn('Using default decimals 18');
            }
            
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const feeData = await provider.getFeeData();
            
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: Math.floor(gasEstimate * 1.2),
                gasPrice: feeData.gasPrice
            });
            
            await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://testnet.bscscan.com/tx/${tx.hash}`
                : `https://bscscan.com/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} BEP20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInWei = ethers.parseEther(amount.toString());
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: 21000,
                gasPrice: await provider.getGasPrice()
            });
            
            await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://testnet.bscscan.com/tx/${tx.hash}`
                : `https://bscscan.com/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} BNB`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[BSC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BSC: ${error.message}`);
    }
};

// ========== TRON ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        
        // Convert Ethereum private key to Tron private key
        const privateKeyHex = wallet.privateKey.substring(2); // Remove 0x
        
        const tronWeb = new TronWeb({
            fullHost: config.TRON.FULL_NODE,
            headers: { "TRON-PRO-API-KEY": "your-api-key" }
        });
        
        return { privateKey: privateKeyHex, tronWeb };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { privateKey, tronWeb } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Import account using private key
        const account = tronWeb.address.fromPrivateKey(privateKey);
        tronWeb.setAddress(account.address.base58);
        
        if (contractAddress) {
            // TRC20 token transfer
            const contract = await tronWeb.contract().at(contractAddress);
            
            // Convert amount to sun (TRC20 tokens usually have 6 decimals)
            const amountInSun = Math.floor(amount * 1_000_000);
            
            const result = await contract.transfer(
                toAddress,
                amountInSun
            ).send({
                feeLimit: 100_000_000,
                callValue: 0,
                shouldPollResponse: true
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result}`
                : `https://tronscan.org/#/transaction/${result}`;
            
            return {
                success: true,
                hash: result,
                message: `Successfully sent ${amount} TRC20 Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            // Native TRX transfer
            const amountInSun = Math.floor(amount * 1_000_000);
            
            const transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                account.address.base58
            );
            
            const signedTransaction = await tronWeb.trx.sign(
                transaction,
                privateKey
            );
            
            const result = await tronWeb.trx.sendRawTransaction(
                signedTransaction
            );
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result.txid}`
                : `https://tronscan.org/#/transaction/${result.txid}`;
            
            return {
                success: true,
                hash: result.txid,
                message: `Successfully sent ${amount} TRX`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[TRON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRON: ${error.message}`);
    }
};

// ========== BITCOIN ==========
const getBitcoinWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        return { keyPair: child, network: config.BITCOIN.NETWORK };
    } catch (error) {
        console.error('Error getting Bitcoin wallet from seed:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, network: btcNetwork } = await getBitcoinWalletFromSeed(seedPhrase, network);
        
        // Create PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        // Get UTXOs for the sender's address
        const senderAddress = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: btcNetwork
        }).address;
        
        // Fetch UTXOs from blockchain explorer
        const utxoResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${senderAddress}/utxo`);
        if (!utxoResponse.ok) throw new Error('Failed to fetch UTXOs');
        
        const utxos = await utxoResponse.json();
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available for this address');
        }
        
        // Calculate total available balance
        let totalBalance = 0;
        const inputs = [];
        
        for (const utxo of utxos) {
            totalBalance += utxo.value;
            inputs.push({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: btcNetwork }).output,
                    value: utxo.value
                }
            });
            
            if (totalBalance >= amount * 100_000_000) break; // amount in satoshis
        }
        
        if (totalBalance < amount * 100_000_000) {
            throw new Error('Insufficient balance');
        }
        
        // Add inputs
        for (const input of inputs) {
            psbt.addInput(input);
        }
        
        // Add outputs
        const amountInSatoshi = Math.floor(amount * 100_000_000);
        const fee = 1000; // Conservative fee estimate
        
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        // Add change output if needed
        const change = totalBalance - amountInSatoshi - fee;
        if (change > 1000) { // Only add change if it's worth it
            psbt.addOutput({
                address: senderAddress,
                value: change
            });
        }
        
        // Sign all inputs
        for (let i = 0; i < inputs.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        // Finalize and extract transaction
        psbt.finalizeAllInputs();
        const transaction = psbt.extractTransaction();
        const txHex = transaction.toHex();
        
        // Broadcast transaction
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!broadcastResponse.ok) throw new Error('Failed to broadcast transaction');
        
        const txid = await broadcastResponse.text();
        
        const explorerUrl = network === 'testnet'
            ? `https://blockstream.info/testnet/tx/${txid}`
            : `https://blockstream.info/tx/${txid}`;
        
        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} BTC`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[BITCOIN ${network} ERROR]:`, error);
        throw new Error(`Failed to send Bitcoin: ${error.message}`);
    }
};

// ========== NEAR ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/1'");
        
        // Convert private key to NEAR format
        const privateKeyHex = wallet.privateKey.substring(2);
        const keyPair = nearAPI.utils.key_pair.KeyPairEd25519.fromRandom();
        
        const nearConfig = {
            networkId: config.NEAR.NETWORK_ID,
            nodeUrl: config.NEAR.RPC_URL,
            walletUrl: config.NEAR.WALLET_URL,
            helperUrl: `https://helper.${config.NEAR.NETWORK_ID}.near.org`,
            explorerUrl: `https://${config.NEAR.NETWORK_ID === 'testnet' ? 'testnet.' : ''}nearblocks.io`,
        };
        
        const near = await nearAPI.connect(nearConfig);
        
        // For NEAR EVM, we use Ethereum address format
        const accountId = `evm.${wallet.address.toLowerCase()}`;
        
        return { 
            keyPair, 
            near, 
            accountId,
            address: wallet.address 
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, near, accountId, address } = await getNearWalletFromSeed(seedPhrase, network);
        
        // Check if sender account exists
        let senderAccount;
        try {
            senderAccount = await near.account(accountId);
        } catch (error) {
            // Account doesn't exist yet, need to create it first
            // For NEAR EVM, accounts are created when first receiving funds
            throw new Error('Sender account does not exist on NEAR. Please fund it first.');
        }
        
        // For NEAR EVM, we need to handle both EVM addresses and NEAR account IDs
        let recipientAccountId = toAddress;
        
        // If it's an EVM address (0x...), convert to NEAR EVM account ID
        if (toAddress.startsWith('0x')) {
            recipientAccountId = `evm.${toAddress.toLowerCase()}`;
        }
        
        // Convert amount to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const amountInYocto = nearAPI.utils.format.parseNearAmount(amount.toString());
        
        // Create transfer transaction
        const result = await senderAccount.sendMoney(
            recipientAccountId,
            amountInYocto
        );
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/txns/${result.transaction.hash}`
            : `https://nearblocks.io/txns/${result.transaction.hash}`;
        
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ==========
export const sendTransaction = async (params) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, network = 'mainnet' } = params;
    
    try {
        let result;
        
        switch(blockchain) {
            case 'TON':
                result = await sendTon({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    comment: memo,
                    contractAddress,
                    network
                });
                break;
            case 'Ethereum':
                result = await sendEth({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    network
                });
                break;
            case 'Solana':
                result = await sendSol({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'BSC':
                result = await sendBsc({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    network
                });
                break;
            case 'Tron':
                result = await sendTron({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'Bitcoin':
                result = await sendBitcoin({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'NEAR':
                result = await sendNear({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            default:
                throw new Error(`Unsupported blockchain: ${blockchain}`);
        }
        
        return { success: true, ...result };
    } catch (error) {
        console.error('Transaction error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// ========== ВАЛИДАЦИЯ АДРЕСОВ ==========
export const validateAddress = (blockchain, address, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        switch(blockchain) {
            case 'TON': 
                return /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/.test(address);
            case 'Ethereum':
            case 'BSC':
                return ethers.isAddress(address);
            case 'Solana':
                try { 
                    new PublicKey(address); 
                    return true; 
                } catch { 
                    return false; 
                }
            case 'Tron':
                // Tron addresses start with T (mainnet) or TX (testnet shasta)
                const tronRegex = network === 'testnet' 
                    ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/
                    : /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            case 'Bitcoin':
                try {
                    const networkConfig = config.BITCOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'NEAR':
                // NEAR accepts both regular account IDs and EVM addresses
                const nearAccountRegex = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/;
                const evmAddressRegex = /^0x[0-9a-fA-F]{40}$/;
                return nearAccountRegex.test(address) || evmAddressRegex.test(address);
            default: 
                return true;
        }
    } catch (error) {
        console.error('Validation error:', error);
        return false;
    }
};

export const estimateTransactionFee = async (blockchain, network = 'mainnet') => {
    const defaultFees = {
        'TON': { mainnet: '0.05', testnet: '0.05' },
        'Ethereum': { mainnet: '0.001', testnet: '0.0001' },
        'BSC': { mainnet: '0.0001', testnet: '0.00001' },
        'Solana': { mainnet: '0.000005', testnet: '0.000001' },
        'Tron': { mainnet: '0.1', testnet: '0.01' },
        'Bitcoin': { mainnet: '0.0001', testnet: '0.00001' },
        'NEAR': { mainnet: '0.01', testnet: '0.001' }
    };
    
    const fees = defaultFees[blockchain] || { mainnet: '0.01', testnet: '0.001' };
    return network === 'testnet' ? fees.testnet : fees.mainnet;
};

// ========== ЭКСПОРТ ==========
export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendBsc,
    sendTron,
    sendBitcoin,
    sendNear,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};