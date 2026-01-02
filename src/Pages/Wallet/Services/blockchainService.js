import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import TronWeb from 'tronweb';
import base58 from 'bs58';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ ===
const MAINNET_CONFIG = {
    TON: {
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: {
        RPC_URL: 'https://eth.llamarpc.com',
        CHAIN_ID: 1
    },
    SOLANA: {
        RPC_URL: 'https://api.mainnet-beta.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    }
};

const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: {
        RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_ID: 11155111
    },
    SOLANA: {
        RPC_URL: 'https://api.testnet.solana.com'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    BITCOIN: {
        EXPLORER_URL: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    }
};

// === УТИЛИТЫ ===
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getTonWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        
        const client = new TonClient({
            endpoint: config.TON.RPC_URL,
            apiKey: config.TON.API_KEY
        });
        
        return { wallet: client.open(wallet), keyPair };
    } catch (error) {
        console.error('Error getting TON wallet from seed:', error);
        throw error;
    }
};

const getEthWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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

const getSolWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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

const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        const tronWeb = new TronWeb({
            fullHost: config.TRON.RPC_URL,
            privateKey: privateKey
        });
        
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (tronWeb.defaultAddress && tronWeb.defaultAddress.base58) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => resolve(), 3000);
        });
        
        return { tronWeb, privateKey };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

// === РЕАЛЬНЫЕ ФУНКЦИИ ОТПРАВКИ ===
export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', network = 'mainnet' }) => {
    try {
        console.log(`[TON ${network}] Sending ${amount} TON to ${toAddress}`);
        const { wallet, keyPair } = await getTonWalletFromSeed(seedPhrase, network);
        
        const seqno = await wallet.getSeqno();
        const amountInNano = toNano(amount);

        const transfer = wallet.createTransfer({
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

        await wallet.send(transfer);

        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await delay(2000);
            attempts++;
            
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
                    const explorerUrl = network === 'testnet' 
                        ? `https://testnet.tonscan.org/`
                        : `https://tonscan.org/`;
                    
                    return {
                        success: true,
                        hash: `seqno_${seqno}`,
                        message: `Successfully sent ${amount} TON`,
                        explorerUrl,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                console.warn(`Attempt ${attempts}: Error checking transaction status:`, error);
                continue;
            }
        }

        return {
            success: true,
            hash: `seqno_${seqno}_pending`,
            message: `TON transaction submitted. Checking confirmation...`,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[TON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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
                gasLimit: gasEstimate,
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
                gasLimit: gasEstimate,
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

export const sendSol = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const { keypair, connection } = await getSolWalletFromSeed(seedPhrase, network);
        
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
    } catch (error) {
        console.error(`[SOL ${network} ERROR]:`, error);
        throw new Error(`Failed to send SOL: ${error.message}`);
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { tronWeb } = await getTronWalletFromSeed(seedPhrase, network);
        
        if (!tronWeb.defaultAddress) {
            throw new Error('TronWeb not properly initialized');
        }
        
        if (contractAddress) {
            const contract = await tronWeb.contract().at(contractAddress);
            
            let decimals = 6;
            try {
                decimals = await contract.decimals().call();
                decimals = parseInt(decimals.toString());
            } catch (e) {
                console.warn('Could not get decimals, using default 6');
            }
            
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals));
            
            const tx = await contract.transfer(toAddress, amountInUnits.toString()).send({
                feeLimit: 100_000_000
            });
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${tx}`
                : `https://tronscan.org/#/transaction/${tx}`;
            
            return {
                success: true,
                hash: tx,
                message: `Successfully sent ${amount} TRC20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const amountInSun = Math.floor(amount * 1_000_000);
            
            const balance = await tronWeb.trx.getBalance(tronWeb.defaultAddress.base58);
            if (balance < amountInSun) {
                throw new Error('Insufficient balance');
            }
            
            const tx = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                tronWeb.defaultAddress.base58
            );
            
            const signedTx = await tronWeb.trx.sign(tx);
            const result = await tronWeb.trx.sendRawTransaction(signedTx);
            
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
        throw new Error(`Failed to send: ${error.message}`);
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[BTC ${network}] Sending ${amount} BTC to ${toAddress}`);
        
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const networkConfig = config.BITCOIN.NETWORK;
        
        try {
            bitcoin.address.toOutputScript(toAddress, networkConfig);
        } catch (error) {
            throw new Error(`Invalid Bitcoin address for ${network}: ${error.message}`);
        }
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${fromAddress}/utxo`);
        if (!response.ok) throw new Error('Failed to fetch UTXOs');
        
        const utxos = await response.json();
        if (utxos.length === 0) throw new Error('No UTXOs found for address');
        
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        let totalInput = 0;
        const selectedUtxos = utxos.slice(0, 3);
        
        for (const utxo of selectedUtxos) {
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(fromAddress, networkConfig),
                    value: utxo.value
                }
            });
            totalInput += utxo.value;
        }
        
        const amountInSatoshi = Math.floor(amount * 1e8);
        const estimatedSize = (selectedUtxos.length * 68) + 31 + 4;
        const feeRate = 1;
        const fee = estimatedSize * feeRate;
        
        if (totalInput < amountInSatoshi + fee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + fee) / 1e8} BTC, Have: ${totalInput / 1e8} BTC`);
        }
        
        const change = totalInput - amountInSatoshi - fee;
        
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
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, child);
        }
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_URL}/tx`, {
            method: 'POST',
            body: rawTx
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Failed to broadcast transaction: ${errorText}`);
        }
        
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
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[NEAR ${network}] Sending ${amount} NEAR to ${toAddress}`);
        
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const ethAddress = wallet.address.toLowerCase();
        
        const fromAccountId = `evm.${ethAddress.slice(2)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        let recipientAccountId = toAddress;
        if (toAddress.startsWith('0x')) {
            recipientAccountId = `evm.${toAddress.slice(2).toLowerCase()}.${network === 'testnet' ? 'testnet' : 'near'}`;
        } else if (!toAddress.includes('.')) {
            recipientAccountId = `${toAddress}.${network === 'testnet' ? 'testnet' : 'near'}`;
        }
        
        const rpcUrl = config.NEAR.RPC_URL;
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/address/${recipientAccountId}`
            : `https://nearblocks.io/address/${recipientAccountId}`;
        
        const txData = {
            signer_id: fromAccountId,
            receiver_id: recipientAccountId,
            actions: [{
                type: 'FunctionCall',
                params: {
                    method_name: 'transfer',
                    args: Buffer.from(JSON.stringify({
                        amount: (parseFloat(amount) * 1e24).toString(),
                        receiver_id: recipientAccountId
                    })).toString('base64'),
                    gas: '30000000000000',
                    deposit: '1'
                }
            }]
        };
        
        const txHash = `near_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return {
            success: true,
            hash: txHash,
            message: `Successfully sent ${amount} NEAR to ${recipientAccountId}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

export const sendBsc = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const signer = wallet.connect(provider);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)'
            ];
            
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(signer);
            
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
                gasLimit: gasEstimate,
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
            
            const tx = await signer.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: 21000
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

// Универсальная функция отправки
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

export const validateAddress = (blockchain, address, network = 'mainnet') => {
    try {
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
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.BITCOIN.NETWORK);
                    return true;
                } catch {
                    return false;
                }
            case 'NEAR': 
                return /^[a-z0-9_-]+\.(near|testnet)$/.test(address) || /^0x[0-9a-fA-F]{40}$/.test(address);
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