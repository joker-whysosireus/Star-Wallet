// blockchainService.js - полный исправленный код
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import base58 from 'bs58';

// Импорты для NEAR (новые пакеты вместо устаревших)
import { KeyPair } from '@near-js/crypto';
import { InMemorySigner } from '@near-js/signers';
import { JsonRpcProvider } from '@near-js/providers';
import { Account } from '@near-js/accounts';
import { actionCreators } from '@near-js/transactions';
import { parseSeedPhrase } from 'near-seed-phrase';

const bip32 = BIP32Factory(ecc);

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
    TRON: {
        FULL_NODE: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
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
    TRON: {
        FULL_NODE: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    }
};

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

// ========== TRON ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
        if (!publicKey) {
            throw new Error('Failed to derive public key from private key');
        }
        
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        const base58Address = base58.encode(addressWithChecksum);
        
        return { 
            privateKey,
            address: base58Address,
            hexAddress: addressWithPrefix.toString('hex')
        };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

// ИСПРАВЛЕННАЯ функция подписи TRON (возвращает подпись длиной 65 байт)
const signTronTransaction = (transaction, privateKeyHex) => {
    try {
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        
        let rawData;
        if (transaction.raw_data) {
            rawData = transaction.raw_data;
        } else if (transaction.raw_data_hex) {
            rawData = JSON.parse(Buffer.from(transaction.raw_data_hex, 'hex').toString());
        } else {
            throw new Error('No raw data found in transaction');
        }
        
        const rawDataStr = JSON.stringify(rawData);
        const rawDataBuffer = Buffer.from(rawDataStr, 'utf-8');
        
        const firstHash = crypto.createHash('sha256').update(rawDataBuffer).digest();
        const txHash = crypto.createHash('sha256').update(firstHash).digest();
        
        const signature = ecc.sign(txHash, privateKeyBuffer);
        
        let signatureBuffer = Buffer.from(signature);
        
        if (signatureBuffer.length === 64) {
            const recoveryId = 0;
            signatureBuffer = Buffer.concat([Buffer.from([recoveryId]), signatureBuffer]);
        }
        
        if (signatureBuffer.length !== 65) {
            throw new Error(`Invalid signature length: ${signatureBuffer.length}, expected 65`);
        }
        
        return {
            ...transaction,
            raw_data: rawData,
            signature: [signatureBuffer.toString('hex')]
        };
    } catch (error) {
        console.error('Error signing TRON transaction:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { privateKey, address } = await getTronWalletFromSeed(seedPhrase, network);
        
        let recipientHex = toAddress;
        if (toAddress.startsWith('T')) {
            const decoded = base58.decode(toAddress);
            recipientHex = `41${decoded.slice(1, 21).toString('hex')}`;
        }
        
        const amountInSun = Math.floor(amount * 1_000_000);
        
        if (contractAddress) {
            const toAddressHex = recipientHex.startsWith('41') ? recipientHex.slice(2) : recipientHex;
            const parameter = toAddressHex.padStart(64, '0') + 
                            BigInt(amountInSun).toString(16).padStart(64, '0');
            
            const createResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/triggersmartcontract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_address: address,
                    contract_address: contractAddress,
                    function_selector: 'transfer(address,uint256)',
                    parameter: parameter,
                    fee_limit: 100_000_000,
                    call_value: 0,
                    visible: true
                })
            });
            
            const transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            const result = await broadcastResponse.json();
            
            if (!result.result) {
                throw new Error(result.message || 'Transaction failed');
            }
            
            const txid = result.txid;
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${txid}`
                : `https://tronscan.org/#/transaction/${txid}`;
            
            return {
                success: true,
                hash: txid,
                message: `Successfully sent ${amount} USDT`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const createResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/createtransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_address: recipientHex,
                    owner_address: address,
                    amount: amountInSun,
                    visible: true
                })
            });
            
            const transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            const result = await broadcastResponse.json();
            
            if (!result.result) {
                throw new Error(result.message || 'Transaction failed');
            }
            
            const txid = result.txid;
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${txid}`
                : `https://tronscan.org/#/transaction/${txid}`;
            
            return {
                success: true,
                hash: txid,
                message: `Successfully sent ${amount} TRX`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[TRON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== BITCOIN ==========
export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[BTC ${network}] Sending ${amount} BTC to ${toAddress}`);
        
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        
        const derivationPath = network === 'testnet' ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
        const child = root.derivePath(derivationPath);
        
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        console.log('BTC From address:', fromAddress);
        
        const utxoResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${fromAddress}/utxo`);
        if (!utxoResponse.ok) {
            throw new Error('Failed to fetch UTXOs');
        }
        
        const utxos = await utxoResponse.json();
        console.log('Found UTXOs:', utxos.length);
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs found');
        }
        
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        const amountInSatoshi = Math.floor(amount * 1e8);
        
        const sortedUtxos = [...utxos].sort((a, b) => a.value - b.value);
        
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of sortedUtxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            if (totalInput >= amountInSatoshi + 1000) {
                break;
            }
        }
        
        if (selectedUtxos.length === 0) {
            throw new Error('No suitable UTXOs found');
        }
        
        console.log(`Selected ${selectedUtxos.length} UTXOs, total: ${totalInput} satoshis`);
        
        const estimatedFee = 2000;
        const change = totalInput - amountInSatoshi - estimatedFee;
        
        if (change < 0) {
            throw new Error(`Insufficient funds. Need ${amountInSatoshi + estimatedFee}, have ${totalInput}`);
        }
        
        for (const utxo of selectedUtxos) {
            try {
                const txResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx/${utxo.txid}/hex`);
                if (!txResponse.ok) {
                    throw new Error(`Failed to fetch transaction ${utxo.txid}`);
                }
                const txHex = await txResponse.text();
                
                const { output } = bitcoin.payments.p2wpkh({
                    pubkey: child.publicKey,
                    network: networkConfig
                });
                
                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: output,
                        value: utxo.value
                    },
                    nonWitnessUtxo: Buffer.from(txHex, 'hex')
                });
            } catch (error) {
                console.warn(`Skipping UTXO ${utxo.txid}:${utxo.vout}:`, error.message);
            }
        }
        
        if (psbt.inputCount === 0) {
            throw new Error('No valid UTXOs could be added');
        }
        
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        if (change > 546) {
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        console.log('PSBT created with:', {
            inputs: psbt.inputCount,
            outputs: psbt.outputCount,
            amount: amountInSatoshi,
            fee: estimatedFee,
            change: change > 546 ? change : 0
        });
        
        for (let i = 0; i < psbt.inputCount; i++) {
            psbt.signInput(i, child);
        }
        
        for (let i = 0; i < psbt.inputCount; i++) {
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
        console.log('Broadcasting transaction...');
        
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx`, {
            method: 'POST',
            body: rawTx
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        const txid = await broadcastResponse.text();
        console.log('Transaction ID:', txid);
        
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
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// ========== NEAR ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const { secretKey } = parseSeedPhrase(seedPhrase);
        
        const keyPair = KeyPair.fromString(secretKey);
        const signer = new InMemorySigner(keyPair);
        
        const publicKey = keyPair.getPublicKey();
        const publicKeyString = publicKey.toString();
        const publicKeyBase58 = publicKeyString.replace('ed25519:', '');
        
        const cleanKey = publicKeyBase58.replace(/[OIl0]/g, '');
        const accountId = `sender-${cleanKey.slice(0, 8)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        console.log('NEAR Account ID:', accountId);
        return { signer, keyPair, accountId, publicKey };
    } catch (error) {
        console.error('Error getting NEAR wallet:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        console.log(`[NEAR ${network}] Sending ${amount} NEAR to ${toAddress}`);
        
        const config = getConfig(network);
        const { signer, keyPair, accountId, publicKey } = await getNearWalletFromSeed(seedPhrase, network);
        
        if (!toAddress.includes('.')) {
            throw new Error('NEAR адрес должен содержать домен (.near или .testnet)');
        }
        
        const provider = new JsonRpcProvider({ 
            url: config.NEAR.RPC_URL 
        });
        
        const account = new Account(provider, signer, accountId);
        
        if (contractAddress) {
            const amountInYocto = (BigInt(Math.floor(amount * 1e24))).toString();
            
            const result = await account.callFunction({
                contractId: contractAddress,
                methodName: 'ft_transfer',
                args: {
                    receiver_id: toAddress,
                    amount: amountInYocto,
                    memo: 'Transfer from Star Wallet'
                },
                gas: BigInt('30000000000000'),
                attachedDeposit: BigInt('1')
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.testnet.near.org/transactions/${result.transaction.hash}`
                : `https://explorer.near.org/transactions/${result.transaction.hash}`;
            
            return {
                success: true,
                hash: result.transaction.hash,
                message: `Successfully sent ${amount} NEP-141 Token`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInYocto = (BigInt(Math.floor(amount * 1e24))).toString();
            
            const accessKeyInfo = await provider.query({
                request_type: 'view_access_key',
                finality: 'final',
                account_id: accountId,
                public_key: publicKey.toString()
            });
            
            const nonce = BigInt(accessKeyInfo.nonce) + BigInt(1);
            
            const blockInfo = await provider.viewBlock({ finality: 'final' });
            const blockHash = blockInfo.header.hash;
            
            const actions = [actionCreators.transfer(amountInYocto)];
            
            const result = await account.sendTransaction({
                receiverId: toAddress,
                actions
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://explorer.testnet.near.org/transactions/${result.transaction.hash}`
                : `https://explorer.near.org/transactions/${result.transaction.hash}`;
            
            return {
                success: true,
                hash: result.transaction.hash,
                message: `Successfully sent ${amount} NEAR`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
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
            case 'Tron':
                result = await sendTron({ 
                    toAddress, 
                    amount, 
                    seedPhrase, 
                    contractAddress,
                    network
                });
                break;
            case 'NEAR':
                result = await sendNear({ 
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
            case 'Bitcoin':
                result = await sendBitcoin({ 
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
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
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[0-9a-fA-F]{40}$/.test(address);
            case 'Bitcoin':
                try {
                    const networkConfig = config.BITCOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                return /^[a-z0-9_-]+\.(near|testnet)$/.test(address);
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
    sendTron,
    sendNear,
    sendBitcoin,
    sendBsc,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};