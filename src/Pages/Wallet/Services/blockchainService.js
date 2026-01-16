// blockchainService.js - полный исправленный файл
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
import crypto from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

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
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    BITCOIN_CASH: {
        EXPLORER_API: 'https://api.blockchair.com/bitcoin-cash',
        RPC_URL: 'https://bch.lexitools.org/v1/',
        NETWORK: bitcoin.networks.bitcoin
    },
    LITECOIN: {
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: {
                public: 0x019da462,
                private: 0x019d9cfe
            },
            pubKeyHash: 0x30,
            scriptHash: 0x32,
            wif: 0xb0
        }
    },
    ETHEREUM_CLASSIC: {
        RPC_URL: 'https://etc.rpc.blxrbdn.com',
        CHAIN_ID: 61
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        NETWORK: 'mainnet',
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io'
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
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    BITCOIN_CASH: {
        EXPLORER_API: 'https://api.blockchair.com/bitcoin-cash/testnet',
        RPC_URL: 'https://testnet.lexitools.org/v1/',
        NETWORK: bitcoin.networks.testnet
    },
    LITECOIN: {
        NETWORK: bitcoin.networks.testnet
    },
    ETHEREUM_CLASSIC: {
        RPC_URL: 'https://etc.mordor.rpc.blxrbdn.com',
        CHAIN_ID: 63
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
        NETWORK: 'testnet',
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io'
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

// ========== TON (без изменений) ==========
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

// ========== ETHEREUM (без изменений) ==========
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

// ========== SOLANA (без изменений) ==========
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

// ========== BSC (без изменений) ==========
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

// ========== BITCOIN (BTC) (без изменений) ==========
const getBtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const networkConfig = config.BITCOIN.NETWORK;
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        
        return {
            keyPair: child,
            address: address,
            network: networkConfig
        };
    } catch (error) {
        console.error('Error getting BTC wallet from seed:', error);
        throw error;
    }
};

export const sendBtc = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, address: fromAddress, network: btcNetwork } = await getBtcWalletFromSeed(seedPhrase, network);
        
        const amountInSatoshi = Math.floor(amount * 100000000);
        
        const amountToSend = amountInSatoshi - 1000;
        if (amountToSend <= 546) {
            throw new Error('Amount too small after deducting fee');
        }
        
        const utxoUrl = `${config.BITCOIN.EXPLORER_API}/address/${fromAddress}/utxo`;
        const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            const estimatedFee = 1000;
            
            if (totalUtxoAmount >= amountInSatoshi + estimatedFee) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInSatoshi + 1000) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + 1000) / 100000000} BTC, Have: ${totalUtxoAmount / 100000000} BTC`);
        }
        
        for (const utxo of selectedUtxos) {
            const txUrl = `${config.BITCOIN.EXPLORER_API}/tx/${utxo.txid}`;
            const txResponse = await callWithRetry(() => fetch(txUrl));
            const txData = await txResponse.json();
            
            const output = txData.vout[utxo.vout];
            const scriptBuffer = Buffer.from(output.scriptpubkey, 'hex');
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: scriptBuffer,
                    value: BigInt(utxo.value)
                }
            });
        }
        
        psbt.addOutput({
            address: toAddress,
            value: BigInt(amountToSend),
        });
        
        const changeAmount = totalUtxoAmount - amountToSend - 1000;
        
        if (changeAmount > 546) {
            psbt.addOutput({
                address: fromAddress,
                value: BigInt(changeAmount),
            });
        }
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        const broadcastUrl = `${config.BITCOIN.EXPLORER_API}/tx`;
        const broadcastResponse = await callWithRetry(() => fetch(broadcastUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: txHex
        }));
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${errorText}`);
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

// ========== BITCOIN CASH (BCH) (без изменений) ==========
const getBchWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.BITCOIN_CASH.NETWORK);
        const child = root.derivePath("m/44'/145'/0'/0/0");
        
        return {
            keyPair: child,
            network: config.BITCOIN_CASH.NETWORK
        };
    } catch (error) {
        console.error('Error getting BCH wallet from seed:', error);
        throw error;
    }
};

export const sendBch = async ({ toAddress, amount, seedPhrase, fromAddress, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, network: bchNetwork } = await getBchWalletFromSeed(seedPhrase, network);
        
        if (!fromAddress) {
            throw new Error('fromAddress is required for Bitcoin Cash transactions');
        }
        
        const amountInSatoshi = Math.floor(amount * 100000000);
        const fee = 1000;
        
        if (amountInSatoshi <= 546) {
            throw new Error('Amount too small (minimum 546 satoshis)');
        }
        
        const baseUrl = network === 'testnet' 
            ? 'https://api.blockchair.com/bitcoin-cash/testnet'
            : 'https://api.blockchair.com/bitcoin-cash';
        
        const addressUrl = `${baseUrl}/dashboards/address/${fromAddress}`;
        const addressResponse = await callWithRetry(() => fetch(addressUrl));
        
        if (!addressResponse.ok) {
            throw new Error(`Failed to fetch address data: ${addressResponse.status}`);
        }
        
        const addressData = await addressResponse.json();
        const utxos = addressData.data[fromAddress]?.utxo || [];
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            if (totalUtxoAmount >= amountInSatoshi + fee) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInSatoshi + fee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + fee) / 100000000} BCH, Have: ${totalUtxoAmount / 100000000} BCH`);
        }
        
        const psbt = new bitcoin.Psbt({ network: bchNetwork });
        
        for (const utxo of selectedUtxos) {
            const txUrl = `${baseUrl}/raw/transaction/${utxo.txid}`;
            const txResponse = await callWithRetry(() => fetch(txUrl));
            
            if (!txResponse.ok) {
                throw new Error(`Failed to fetch transaction: ${utxo.txid}`);
            }
            
            const txData = await txResponse.json();
            const rawTx = txData.data[utxo.txid]?.raw_transaction;
            
            if (!rawTx) {
                throw new Error(`Could not get raw transaction for: ${utxo.txid}`);
            }
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(rawTx, 'hex')
            });
        }
        
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi,
        });
        
        const changeAmount = totalUtxoAmount - amountInSatoshi - fee;
        if (changeAmount > 546) {
            psbt.addOutput({
                address: fromAddress,
                value: changeAmount,
            });
        }
        
        selectedUtxos.forEach((_, index) => {
            psbt.signInput(index, keyPair);
        });
        
        selectedUtxos.forEach((_, index) => {
            if (!psbt.validateSignaturesOfInput(index)) {
                throw new Error(`Invalid signature for input ${index}`);
            }
        });
        
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        const broadcastUrl = `${baseUrl}/push/transaction`;
        const broadcastResponse = await callWithRetry(() => fetch(broadcastUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: txHex })
        }));
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        const result = await broadcastResponse.json();
        const txid = result.data?.transaction_hash || tx.getId();
        
        const explorerUrl = network === 'testnet'
            ? `https://blockchair.com/bitcoin-cash/testnet/transaction/${txid}`
            : `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
            
        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} BCH`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[BCH ${network} ERROR]:`, error);
        throw new Error(`Failed to send BCH: ${error.message}`);
    }
};

// ========== LITECOIN (LTC) - ИСПРАВЛЕННАЯ ==========
const getLtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Используем правильный derivation path для Litecoin
        const root = bip32.fromSeed(seedBuffer, config.LITECOIN.NETWORK);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        
        // Генерируем адрес отправителя из ключа
        const { address } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: config.LITECOIN.NETWORK
        });
        
        return {
            keyPair: child,
            address: address,
            network: config.LITECOIN.NETWORK
        };
    } catch (error) {
        console.error('Error getting LTC wallet from seed:', error);
        throw error;
    }
};

export const sendLtc = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, address: fromAddress, network: ltcNetwork } = await getLtcWalletFromSeed(seedPhrase, network);
        
        const amountInLitoshi = Math.floor(amount * 100000000);
        const feePerByte = 2; // Базовый сбор в litoshi за байт
        
        // Используем публичные API ноды
        const apiBase = network === 'testnet' 
            ? 'https://litecoinspace.org/testnet/api'
            : 'https://litecoinspace.org/api';
        
        // Получаем UTXO для адреса отправителя
        const utxoUrl = `${apiBase}/address/${fromAddress}/utxo`;
        const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        // Сортируем UTXO по убыванию стоимости для оптимизации
        utxos.sort((a, b) => b.value - a.value);
        
        const psbt = new bitcoin.Psbt({ network: ltcNetwork });
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        // Выбираем достаточно UTXO для покрытия суммы + комиссия
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            const estimatedTxSize = 10 + (selectedUtxos.length * 148) + (2 * 34);
            const estimatedFee = estimatedTxSize * feePerByte;
            
            if (totalUtxoAmount >= amountInLitoshi + estimatedFee) {
                break;
            }
        }
        
        // Точный расчет размера и комиссии
        const estimatedTxSize = 10 + (selectedUtxos.length * 148) + (2 * 34);
        const estimatedFee = estimatedTxSize * feePerByte;
        
        if (totalUtxoAmount < amountInLitoshi + estimatedFee) {
            throw new Error(`Insufficient balance. Need: ${(amountInLitoshi + estimatedFee) / 100000000} LTC, Have: ${totalUtxoAmount / 100000000} LTC`);
        }
        
        // Добавляем входы в транзакцию
        for (const utxo of selectedUtxos) {
            const txUrl = `${apiBase}/tx/${utxo.txid}/hex`;
            const txResponse = await callWithRetry(() => fetch(txUrl));
            
            if (!txResponse.ok) {
                throw new Error(`Failed to fetch transaction: ${utxo.txid}`);
            }
            
            const rawTx = await txResponse.text();
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo: Buffer.from(rawTx, 'hex')
            });
        }
        
        // Добавляем выход для получателя
        psbt.addOutput({
            address: toAddress,
            value: amountInLitoshi,
        });
        
        // Добавляем сдачу (если есть)
        const changeAmount = totalUtxoAmount - amountInLitoshi - estimatedFee;
        if (changeAmount > 546) { // Минимальный выход Dust limit
            psbt.addOutput({
                address: fromAddress,
                value: changeAmount,
            });
        }
        
        // Подписываем все входы
        selectedUtxos.forEach((_, index) => {
            psbt.signInput(index, keyPair);
        });
        
        // Валидируем подписи
        selectedUtxos.forEach((_, index) => {
            if (!psbt.validateSignaturesOfInput(index)) {
                throw new Error(`Invalid signature for input ${index}`);
            }
        });
        
        // Финазируем и получаем сырую транзакцию
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // Отправляем транзакцию в сеть
        const broadcastUrl = `${apiBase}/tx`;
        const broadcastResponse = await callWithRetry(() => fetch(broadcastUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: txHex
        }));
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        const txid = await broadcastResponse.text();
        
        const explorerUrl = network === 'testnet'
            ? `https://litecoinspace.org/testnet/tx/${txid}`
            : `https://litecoinspace.org/tx/${txid}`;
            
        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} LTC`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[LTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send LTC: ${error.message}`);
    }
};

// ========== ETHEREUM CLASSIC (ETC) - ИСПРАВЛЕННАЯ ==========
const getEtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        // Используем правильный derivation path для Ethereum Classic (BIP44 coin type 61)
        const wallet = hdNode.derivePath("m/44'/61'/0'/0/0");
        
        // Используем публичные RPC ноды ETC
        const rpcUrl = network === 'testnet' 
            ? 'https://www.ethercluster.com/mordor' // Mordor testnet
            : 'https://etc.rpc.blxrbdn.com'; // Mainnet
        
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        return { 
            wallet: wallet.connect(provider), 
            provider,
            address: wallet.address
        };
    } catch (error) {
        console.error('Error getting ETC wallet from seed:', error);
        throw error;
    }
};

export const sendEtc = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { wallet, provider, address: fromAddress } = await getEtcWalletFromSeed(seedPhrase, network);
        
        // Получаем баланс и данные о комиссии
        const balance = await provider.getBalance(fromAddress);
        const feeData = await provider.getFeeData();
        
        // Для ETC используем legacy gasPrice (EIP-1559 не поддерживается)
        const gasPrice = feeData.gasPrice || (await provider.getGasPrice());
        
        if (!gasPrice) {
            throw new Error('Could not get gas price from ETC network');
        }
        
        if (contractAddress) {
            // Отправка токена (ERC20 на ETC)
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
                console.warn('Could not get token decimals, using default 18');
            }
            
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            
            // Проверяем баланс токена
            const tokenBalance = await contract.balanceOf(fromAddress);
            if (tokenBalance < amountInUnits) {
                throw new Error(`Insufficient token balance. Have: ${ethers.formatUnits(tokenBalance, decimals)}, Need: ${amount}`);
            }
            
            // Оцениваем gas для трансфера токена
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const gasLimit = Math.floor(Number(gasEstimate) * 1.2);
            const gasCost = gasPrice * BigInt(gasLimit);
            
            // Проверяем достаточно ли ETC для оплаты газа
            if (balance < gasCost) {
                throw new Error(`Insufficient ETC for gas. Need ${ethers.formatEther(gasCost)} ETC for gas, have ${ethers.formatEther(balance)} ETC`);
            }
            
            // Отправляем транзакцию
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: gasLimit,
                gasPrice: gasPrice,
                chainId: network === 'testnet' ? 63 : 61 // Mordor: 63, Mainnet: 61
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://blockscout.com/etc/mordor/tx/${tx.hash}`
                : `https://blockscout.com/etc/mainnet/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ETC Token`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        } else {
            // Отправка нативных ETC
            const amountInWei = ethers.parseEther(amount.toString());
            
            // Оцениваем газ для простого трансфера
            const estimatedGas = await provider.estimateGas({
                from: fromAddress,
                to: toAddress,
                value: amountInWei
            });
            
            const gasLimit = estimatedGas * 2n;
            const gasCost = gasPrice * gasLimit;
            const totalCost = amountInWei + gasCost;
            
            if (balance < totalCost) {
                throw new Error(`Insufficient ETC balance for transaction. Need ${ethers.formatEther(totalCost)} ETC (including gas), have ${ethers.formatEther(balance)} ETC`);
            }
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: gasLimit,
                gasPrice: gasPrice,
                chainId: network === 'testnet' ? 63 : 61
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://blockscout.com/etc/mordor/tx/${tx.hash}`
                : `https://blockscout.com/etc/mainnet/tx/${tx.hash}`;
            
            return {
                success: true,
                hash: tx.hash,
                message: `Successfully sent ${amount} ETC`,
                explorerUrl,
                timestamp: new Date().toISOString(),
                blockNumber: receipt.blockNumber
            };
        }
    } catch (error) {
        console.error(`[ETC ${network} ERROR]:`, error);
        throw new Error(`Failed to send ETC: ${error.message}`);
    }
};

// ========== NEAR - ИСПРАВЛЕННАЯ ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        // Генерируем seed из мнемонической фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seed = Buffer.from(seedBuffer).slice(0, 32);
        
        // Создаем ключевую пару ed25519 для NEAR
        const keyPair = nacl.sign.keyPair.fromSeed(seed);
        
        // Конвертируем публичный ключ в base58 с префиксом 'ed25519:'
        const publicKeyBase58 = bs58.encode(Buffer.from(keyPair.publicKey));
        const nearPublicKey = `ed25519:${publicKeyBase58}`;
        
        // Генерируем accountId из публичного ключа
        const accountId = `${Buffer.from(keyPair.publicKey).toString('hex').slice(0, 40)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        return {
            secretKey: keyPair.secretKey,
            publicKey: keyPair.publicKey,
            nearPublicKey: nearPublicKey,
            accountId: accountId,
            networkId: network === 'testnet' ? 'testnet' : 'mainnet',
            rpcUrl: network === 'testnet' ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org'
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const { secretKey, publicKey, nearPublicKey, accountId, networkId, rpcUrl } = await getNearWalletFromSeed(seedPhrase, network);
        
        // Динамический импорт near-api-js
        const nearAPI = await import('near-api-js');
        const { connect, keyStores, KeyPair, utils } = nearAPI;
        
        // Создаем хранилище ключей и добавляем ключевую пару
        const keyStore = new keyStores.InMemoryKeyStore();
        const keyPair = KeyPair.fromString(nearPublicKey.split(':')[1]);
        
        await keyStore.setKey(networkId, accountId, keyPair);
        
        // Конфигурация подключения к NEAR
        const nearConfig = {
            networkId,
            keyStore,
            nodeUrl: rpcUrl,
            walletUrl: network === 'testnet' ? 'https://testnet.mynearwallet.com' : 'https://app.mynearwallet.com',
            helperUrl: network === 'testnet' ? 'https://helper.testnet.near.org' : 'https://helper.mainnet.near.org',
            explorerUrl: network === 'testnet' ? 'https://explorer.testnet.near.org' : 'https://explorer.near.org',
        };
        
        // Подключаемся к NEAR
        const near = await connect(nearConfig);
        const account = await near.account(accountId);
        
        try {
            // Проверяем существование аккаунта
            await account.state();
        } catch (error) {
            if (error.message.includes('does not exist')) {
                throw new Error('NEAR account does not exist. You need to create it first with minimum 0.1 NEAR');
            }
            throw error;
        }
        
        // Конвертируем сумму в yoctoNEAR
        const amountInYocto = utils.format.parseNearAmount(amount.toString());
        if (!amountInYocto) {
            throw new Error('Invalid amount format for NEAR');
        }
        
        // Валидация адреса получателя (поддерживает named accounts, implicit accounts)
        let recipientAccountId = toAddress.trim();
        
        // Убираем возможные префиксы
        if (recipientAccountId.startsWith('near:')) {
            recipientAccountId = recipientAccountId.substring(5);
        }
        if (recipientAccountId.startsWith('testnet:')) {
            recipientAccountId = recipientAccountId.substring(8);
        }
        
        // Отправляем транзакцию
        const result = await account.sendMoney(recipientAccountId, amountInYocto);
        
        const explorerUrl = network === 'testnet'
            ? `https://explorer.testnet.near.org/transactions/${result.transaction.hash}`
            : `https://explorer.near.org/transactions/${result.transaction.hash}`;
            
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR to ${recipientAccountId}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== TRON (TRX) - ИСПРАВЛЕННАЯ ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        // Генерируем приватный ключ из seed фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // Используем BIP44 derivation path для TRON (coin type 195)
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        
        // Приватный ключ в hex формате (без префикса '0x')
        const privateKeyHex = wallet.privateKey.slice(2);
        
        // Генерируем TRON адрес из публичного ключа
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
        // Keccak256 хеш публичного ключа, берем последние 20 байт
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        
        // Добавляем префикс для TRON (0x41) и вычисляем checksum
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        const tronAddress = bs58.encode(addressWithChecksum);
        
        // Конфигурация TronWeb
        const fullNode = network === 'testnet' 
            ? 'https://api.shasta.trongrid.io'
            : 'https://api.trongrid.io';
        
        const solidityNode = network === 'testnet'
            ? 'https://api.shasta.trongrid.io'
            : 'https://api.trongrid.io';
        
        const eventServer = network === 'testnet'
            ? 'https://api.shasta.trongrid.io'
            : 'https://api.trongrid.io';
        
        return {
            privateKey: privateKeyHex,
            address: tronAddress,
            fullNode: fullNode,
            solidityNode: solidityNode,
            eventServer: eventServer,
            network: network
        };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const { privateKey, address: fromAddress, fullNode, solidityNode, eventServer, network: tronNetwork } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Импортируем TronWeb
        const TronWebModule = await import('tronweb');
        let TronWeb;
        
        // Обрабатываем разные форматы экспорта TronWeb
        if (typeof TronWebModule.default === 'function') {
            TronWeb = TronWebModule.default;
        } else if (typeof TronWebModule === 'function') {
            TronWeb = TronWebModule;
        } else {
            TronWeb = TronWebModule.TronWeb || TronWebModule.default.TronWeb;
        }
        
        // Создаем экземпляр TronWeb
        const tronWeb = new TronWeb({
            fullHost: fullNode,
            solidityNode: solidityNode,
            eventServer: eventServer,
            privateKey: privateKey
        });
        
        // Проверяем подключение к сети
        try {
            const nodeInfo = await tronWeb.trx.getNodeInfo();
            console.log('Connected to TRON network:', nodeInfo);
        } catch (error) {
            throw new Error('Failed to connect to TRON network: ' + error.message);
        }
        
        if (contractAddress) {
            // Отправка TRC20 токена
            const contract = await tronWeb.contract().at(contractAddress);
            
            // Получаем decimals токена
            let decimals = 6;
            try {
                const decimalsResult = await contract.decimals().call();
                decimals = decimalsResult.toString();
            } catch (e) {
                console.warn('Could not get token decimals, using default 6');
            }
            
            // Конвертируем сумму в базовые единицы токена
            const amountInUnits = tronWeb.toBigNumber(amount).times(10 ** decimals).toFixed(0);
            
            // Проверяем баланс токена
            const balanceResult = await contract.balanceOf(fromAddress).call();
            const balance = tronWeb.toBigNumber(balanceResult.toString());
            
            if (balance.lt(amountInUnits)) {
                throw new Error(`Insufficient TRC20 balance. Have: ${balance.div(10 ** decimals).toString()}, Need: ${amount}`);
            }
            
            // Вызываем transfer функцию контракта
            const result = await contract.transfer(
                toAddress,
                amountInUnits
            ).send({
                feeLimit: 100000000,
                callValue: 0,
                shouldPollResponse: true
            });
            
            const txHash = typeof result === 'string' ? result : result?.transaction?.txID || result;
            
            const explorerUrl = tronNetwork === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${txHash}`
                : `https://tronscan.org/#/transaction/${txHash}`;
                
            return {
                success: true,
                hash: txHash,
                message: `Successfully sent ${amount} TRC20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            // Отправка нативных TRX
            const amountInSun = tronWeb.toSun(amount);
            
            // Проверяем баланс TRX
            const balance = await tronWeb.trx.getBalance(fromAddress);
            if (balance < amountInSun) {
                throw new Error(`Insufficient TRX balance. Have: ${tronWeb.fromSun(balance)}, Need: ${amount}`);
            }
            
            // Создаем и отправляем транзакцию
            const transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                fromAddress
            );
            
            const signedTransaction = await tronWeb.trx.sign(transaction);
            const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
            
            if (!result.result) {
                throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
            }
            
            const txHash = result.transaction?.txID || result.txid;
            
            const explorerUrl = tronNetwork === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${txHash}`
                : `https://tronscan.org/#/transaction/${txHash}`;
                
            return {
                success: true,
                hash: txHash,
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

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ==========
export const sendTransaction = async (params) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, network = 'mainnet', fromAddress } = params;
    
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
            case 'Bitcoin':
                result = await sendBtc({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'BitcoinCash':
                result = await sendBch({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    fromAddress,
                    network
                });
                break;
            case 'Litecoin':
                result = await sendLtc({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'EthereumClassic':
                result = await sendEtc({ 
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
            case 'TRON':
                result = await sendTrx({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    contractAddress,
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

// ========== ОБНОВЛЕННАЯ ФУНКЦИЯ ВАЛИДАЦИИ ==========
export const validateAddress = (blockchain, address, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        switch(blockchain) {
            case 'TON': 
                return /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/.test(address);
            case 'Ethereum':
            case 'BSC':
            case 'EthereumClassic':
                return ethers.isAddress(address);
            case 'Solana':
                try { 
                    new PublicKey(address); 
                    return true; 
                } catch { 
                    return false; 
                }
            case 'Bitcoin':
                try {
                    const networkConfig = config.BITCOIN.NETWORK;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'BitcoinCash':
                const bchRegex = /^(bitcoincash:)?(q|p)[a-z0-9]{41}$|^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
                return bchRegex.test(address);
            case 'Litecoin':
                // Валидация LTC адресов (legacy, P2SH, bech32)
                const ltcLegacyRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/;
                const ltcBech32Regex = /^(ltc1)[a-z0-9]{39,59}$/;
                return ltcLegacyRegex.test(address) || ltcBech32Regex.test(address);
            case 'NEAR':
                // Валидация NEAR адресов
                const nearNamedRegex = /^[a-z0-9_\-]+\.(near|testnet)$/;
                const nearImplicitRegex = /^[a-f0-9]{64}$/;
                const nearEthImplicitRegex = /^0x[a-f0-9]{40}$/;
                return nearNamedRegex.test(address) || nearImplicitRegex.test(address) || nearEthImplicitRegex.test(address);
            case 'TRON':
                // Валидация TRON адресов (начинается с T)
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
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
        'Bitcoin': { mainnet: '0.0001', testnet: '0.00001' },
        'BitcoinCash': { mainnet: '0.0001', testnet: '0.00001' },
        'Litecoin': { mainnet: '0.0001', testnet: '0.00001' },
        'EthereumClassic': { mainnet: '0.0001', testnet: '0.00001' },
        'NEAR': { mainnet: '0.0001', testnet: '0.00001' },
        'TRON': { mainnet: '0.000001', testnet: '0.0000001' }
    };
    
    const fees = defaultFees[blockchain] || { mainnet: '0.01', testnet: '0.001' };
    return network === 'testnet' ? fees.testnet : fees.mainnet;
};

export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendBsc,
    sendBtc,
    sendBch,
    sendLtc,
    sendEtc,
    sendNear,
    sendTrx,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};