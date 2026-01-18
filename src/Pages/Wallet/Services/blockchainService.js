// blockchainService.js - ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from '@bitcoin-js/tiny-secp256k1-asmjs';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

const bip32 = BIP32Factory(ecc);

// ========== КОНФИГУРАЦИИ RPC ==========
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
        NETWORK: bitcoin.networks.bitcoin
    },
    LITECOIN: {
        EXPLORER_API: 'https://litecoinspace.org/api',
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
        RPC_URLS: [
            'https://etc.etcdesktop.com',
            'https://etc.rpc.proofofstake.cloud',
            'https://etc.rivet.link'
        ],
        CHAIN_ID: 61,
        BLOCKSCOUT_API: 'https://blockscout.com/etc/mainnet/api'
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
        SOLIDITY_NODE: 'https://api.trongrid.io'
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
        NETWORK: bitcoin.networks.testnet
    },
    LITECOIN: {
        EXPLORER_API: 'https://litecoinspace.org/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    ETHEREUM_CLASSIC: {
        RPC_URLS: [
            'https://etc.mordor.etcdesktop.com'
        ],
        CHAIN_ID: 63,
        BLOCKSCOUT_API: 'https://blockscout.com/etc/mordor/api'
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
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io'
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
            console.warn(`API call failed (attempt ${i + 1}/${maxRetries}):`, error.message);
            await delay(baseDelay * Math.pow(2, i));
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

// ========== BITCOIN (BTC) ==========
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

// ========== BITCOIN CASH (BCH) ==========
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

// ========== LITECOIN (LTC) ==========
const getLtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        const root = bip32.fromSeed(seedBuffer, config.LITECOIN.NETWORK);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        
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
        const feePerByte = 2;
        
        const apiBase = config.LITECOIN.EXPLORER_API;
        const utxoUrl = `${apiBase}/address/${fromAddress}/utxo`;
        const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        const psbt = new bitcoin.Psbt({ network: ltcNetwork });
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            const estimatedTxSize = 10 + (selectedUtxos.length * 148) + (2 * 34);
            const estimatedFee = estimatedTxSize * feePerByte;
            
            if (totalUtxoAmount >= amountInLitoshi + estimatedFee) {
                break;
            }
        }
        
        const estimatedTxSize = 10 + (selectedUtxos.length * 148) + (2 * 34);
        const estimatedFee = estimatedTxSize * feePerByte;
        
        if (totalUtxoAmount < amountInLitoshi + estimatedFee) {
            throw new Error(`Insufficient balance. Need: ${(amountInLitoshi + estimatedFee) / 100000000} LTC, Have: ${totalUtxoAmount / 100000000} LTC`);
        }
        
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
        
        psbt.addOutput({
            address: toAddress,
            value: BigInt(amountInLitoshi),
        });
        
        const changeAmount = totalUtxoAmount - amountInLitoshi - estimatedFee;
        if (changeAmount > 546) {
            psbt.addOutput({
                address: fromAddress,
                value: BigInt(changeAmount),
            });
        }
        
        selectedUtxos.forEach((_, index) => {
            psbt.signInput(index, keyPair);
        });
        
        selectedUtxos.forEach((_, index) => {
            try {
                psbt.validateSignaturesOfInput(index);
            } catch (e) {
                console.warn(`Signature validation warning for input ${index}:`, e.message);
            }
        });
        
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
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

// ========== ETHEREUM CLASSIC (ETC) - ИСПРАВЛЕННЫЙ ==========
const getEtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/61'/0'/0/0");
        
        // Используем самый надежный RPC для ETC
        const rpcUrl = 'https://etc.etcdesktop.com'; // Самый стабильный
        
        const provider = new ethers.JsonRpcProvider(
            rpcUrl,
            {
                chainId: config.ETHEREUM_CLASSIC.CHAIN_ID,
                name: 'ethereum-classic'
            },
            { staticNetwork: true, timeout: 30000 }
        );
        
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
        const config = getConfig(network);
        const { wallet, provider, address: fromAddress } = await getEtcWalletFromSeed(seedPhrase, network);
        
        // Получаем текущий nonce
        const nonce = await provider.getTransactionCount(fromAddress, 'pending');
        
        // Получаем баланс
        const balance = await provider.getBalance(fromAddress);
        
        // Получаем актуальный gasPrice
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || (await provider.getGasPrice());
        
        if (contractAddress) {
            // Токен ETC (ERC20)
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
            
            // Оцениваем gas для токеновой транзакции
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const gasLimit = Math.floor(Number(gasEstimate) * 1.5); // Запас 50%
            
            // Проверяем достаточно ли ETC для газа
            const gasCost = gasPrice * BigInt(gasLimit);
            if (balance < gasCost) {
                throw new Error(`Insufficient ETC for gas. Need ${ethers.formatEther(gasCost)} ETC for gas, have ${ethers.formatEther(balance)} ETC`);
            }
            
            // Создаем и отправляем транзакцию
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: gasLimit,
                gasPrice: gasPrice,
                nonce: nonce
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
            // Нативный ETC
            const amountInWei = ethers.parseEther(amount.toString());
            
            // Оцениваем gas для обычного перевода
            const estimatedGas = await provider.estimateGas({
                from: fromAddress,
                to: toAddress,
                value: amountInWei
            });
            
            const gasLimit = estimatedGas * 2n; // Запас 100%
            const gasCost = gasPrice * gasLimit;
            const totalCost = amountInWei + gasCost;
            
            // Проверяем баланс
            if (balance < totalCost) {
                throw new Error(`Insufficient ETC balance. Need ${ethers.formatEther(totalCost)} ETC, have ${ethers.formatEther(balance)} ETC`);
            }
            
            // Создаем и отправляем транзакцию
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: gasLimit,
                gasPrice: gasPrice,
                nonce: nonce
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
        
        if (error.message.includes('timeout') || error.message.includes('Load failed')) {
            throw new Error('ETC RPC timeout. Please try again later.');
        } else if (error.message.includes('insufficient funds') || error.message.includes('Insufficient')) {
            throw new Error('Insufficient ETC balance for transaction.');
        } else if (error.message.includes('nonce')) {
            throw new Error('Nonce error. Please wait a moment and try again.');
        }
        
        throw new Error(`Failed to send ETC: ${error.message}`);
    }
};

// ========== NEAR - ИСПРАВЛЕННЫЙ (только implicit) ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем seed из мнемонической фразы (совместимо с storageService.js)
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seed = Buffer.from(seedBuffer).slice(0, 32);
        
        // Генерируем ключевую пару ed25519
        const keyPair = nacl.sign.keyPair.fromSeed(seed);
        
        // Получаем публичный ключ в hex (64 символа) - это и есть implicit адрес
        const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
        
        // Конвертируем публичный ключ в NEAR формат: ed25519:base58(publicKey)
        const nearPublicKey = `ed25519:${bs58.encode(Buffer.from(keyPair.publicKey))}`;
        
        // Для implicit аккаунтов используем hex публичного ключа как accountId
        const accountId = publicKeyHex.toLowerCase();
        
        return {
            keyPair: keyPair,
            publicKeyHex: publicKeyHex,
            nearPublicKey: nearPublicKey,
            accountId: accountId,
            networkId: network === 'testnet' ? 'testnet' : 'mainnet',
            rpcUrl: config.NEAR.RPC_URL
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, nearPublicKey, accountId, networkId, rpcUrl } = await getNearWalletFromSeed(seedPhrase, network);
        
        // Используем fetch напрямую для отправки транзакций NEAR
        // Это более простой подход, чем использование near-api-js
        
        // 1. Получаем информацию об аккаунте
        const accountInfoResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "query",
                params: {
                    request_type: "view_account",
                    account_id: accountId,
                    finality: "final"
                }
            })
        });
        
        const accountInfo = await accountInfoResponse.json();
        
        if (accountInfo.error) {
            throw new Error(`NEAR account ${accountId} does not exist or not activated. Send at least 0.001 NEAR to activate it.`);
        }
        
        // 2. Получаем access keys
        const accessKeysResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "query",
                params: {
                    request_type: "view_access_key_list",
                    account_id: accountId,
                    finality: "final"
                }
            })
        });
        
        const accessKeys = await accessKeysResponse.json();
        
        // Ищем наш ключ
        const ourKey = accessKeys.result.keys.find(key => key.public_key === nearPublicKey);
        if (!ourKey) {
            throw new Error(`Key ${nearPublicKey} is not registered for account ${accountId}. Please add this key or receive a transaction first.`);
        }
        
        // 3. Получаем последний блок
        const blockResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "block",
                params: { finality: "final" }
            })
        });
        
        const block = await blockResponse.json();
        const blockHash = block.result.header.hash;
        
        // 4. Подготавливаем транзакцию
        const nonce = ourKey.access_key.nonce + 1;
        const actions = [{
            Transfer: {
                deposit: (parseFloat(amount) * 1e24).toString() // yoctoNEAR
            }
        }];
        
        const transaction = {
            signerId: accountId,
            publicKey: nearPublicKey,
            nonce: nonce,
            receiverId: toAddress,
            actions: actions,
            blockHash: blockHash
        };
        
        // 5. Подписываем транзакцию
        const txHash = crypto.createHash('sha256').update(JSON.stringify(transaction)).digest('hex');
        const signature = nacl.sign.detached(Buffer.from(txHash, 'hex'), keyPair.secretKey);
        const signatureBase64 = Buffer.from(signature).toString('base64');
        
        // 6. Отправляем транзакцию
        const sendTxResponse = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "dontcare",
                method: "broadcast_tx_commit",
                params: [Buffer.from(JSON.stringify({
                    ...transaction,
                    signature: signatureBase64,
                    hash: txHash
                })).toString('base64')]
            })
        });
        
        const result = await sendTxResponse.json();
        
        if (result.error) {
            throw new Error(`NEAR transaction failed: ${JSON.stringify(result.error)}`);
        }
        
        const explorerUrl = network === 'testnet'
            ? `https://explorer.testnet.near.org/transactions/${result.result.transaction.hash}`
            : `https://explorer.near.org/transactions/${result.result.transaction.hash}`;
        
        return {
            success: true,
            hash: result.result.transaction.hash,
            message: `Successfully sent ${amount} NEAR to ${toAddress}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        
        if (error.message.includes('does not exist') || error.message.includes('not activated')) {
            throw new Error('NEAR account not found or not activated. Send at least 0.001 NEAR to activate it.');
        } else if (error.message.includes('not registered')) {
            throw new Error('Access key not registered for this account.');
        } else if (error.message.includes('NotEnoughBalance')) {
            throw new Error('Insufficient NEAR balance.');
        }
        
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== TRON (TRX) - ИСПРАВЛЕННЫЙ ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        
        const privateKeyHex = wallet.privateKey.slice(2); // Убираем 0x
        
        return {
            privateKey: privateKeyHex,
            address: '', // Адрес будет получен из storageService
            fullNode: config.TRON.FULL_NODE,
            network: network
        };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet', fromAddress }) => {
    try {
        const config = getConfig(network);
        const { privateKey, fullNode } = await getTronWalletFromSeed(seedPhrase, network);
        
        // fromAddress должен быть передан из storageService
        if (!fromAddress) {
            throw new Error('fromAddress is required for TRON transactions');
        }
        
        // Проверяем подключение к сети TRON
        try {
            const testResponse = await fetch(`${fullNode}/wallet/getnowblock`);
            if (!testResponse.ok) {
                throw new Error(`TRON network unreachable: ${testResponse.status}`);
            }
        } catch (error) {
            throw new Error(`Cannot connect to TRON network: ${error.message}`);
        }
        
        if (contractAddress) {
            // TRC20 токен
            const amountInSun = Math.floor(amount * 1000000);
            const amountHex = amountInSun.toString(16).padStart(64, '0');
            const toAddressHex = toAddress.replace('T', '').padStart(64, '0');
            const parameter = toAddressHex + amountHex;
            
            const triggerData = {
                owner_address: fromAddress,
                contract_address: contractAddress,
                function_selector: 'transfer(address,uint256)',
                parameter: parameter,
                fee_limit: 100000000,
                call_value: 0,
                visible: true
            };
            
            // Вызываем смарт-контракт
            const response = await fetch(`${fullNode}/wallet/triggersmartcontract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(triggerData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`TRC20 trigger failed: ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.Error) {
                throw new Error(`TRC20 error: ${result.Error}`);
            }
            
            if (!result.transaction) {
                throw new Error('No transaction returned from TRON network');
            }
            
            // Подписываем транзакцию
            const signResponse = await fetch(`${fullNode}/wallet/gettransactionsign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction: result.transaction,
                    privateKey: privateKey
                })
            });
            
            const signedTx = await signResponse.json();
            
            if (!signedTx.signature || signedTx.signature.length === 0) {
                throw new Error('Transaction signing failed');
            }
            
            // Отправляем транзакцию
            const broadcastResponse = await fetch(`${fullNode}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            });
            
            const broadcastResult = await broadcastResponse.json();
            
            if (!broadcastResult.result) {
                throw new Error(`Broadcast failed: ${JSON.stringify(broadcastResult)}`);
            }
            
            const txHash = broadcastResult.txid;
            const explorerUrl = network === 'testnet'
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
            // Перевод нативных TRX
            const amountInSun = Math.floor(amount * 1000000);
            
            // Создаем транзакцию
            const createTxResponse = await fetch(`${fullNode}/wallet/createtransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_address: fromAddress,
                    to_address: toAddress,
                    amount: amountInSun,
                    visible: true
                })
            });
            
            if (!createTxResponse.ok) {
                const errorText = await createTxResponse.text();
                throw new Error(`Transaction creation failed: ${errorText}`);
            }
            
            const transaction = await createTxResponse.json();
            
            if (transaction.Error) {
                throw new Error(`Transaction error: ${transaction.Error}`);
            }
            
            if (!transaction.txID) {
                throw new Error('No transaction ID returned from TRON network');
            }
            
            // Подписываем транзакцию
            const signResponse = await fetch(`${fullNode}/wallet/gettransactionsign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transaction: transaction,
                    privateKey: privateKey
                })
            });
            
            const signedTx = await signResponse.json();
            
            if (!signedTx.signature || signedTx.signature.length === 0) {
                throw new Error('Transaction signing failed');
            }
            
            // Отправляем транзакцию
            const broadcastResponse = await fetch(`${fullNode}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTx)
            });
            
            const broadcastResult = await broadcastResponse.json();
            
            if (!broadcastResult.result) {
                throw new Error(`Broadcast failed: ${JSON.stringify(broadcastResult)}`);
            }
            
            const txHash = broadcastResult.txid;
            const explorerUrl = network === 'testnet'
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
        
        if (error.message.includes('network') || error.message.includes('unreachable')) {
            throw new Error('Cannot connect to TRON network. Please check your internet connection.');
        } else if (error.message.includes('insufficient')) {
            throw new Error('Insufficient TRX balance for transaction.');
        } else if (error.message.includes('NullPointerException')) {
            throw new Error('TRON transaction creation error. Please check addresses and try again.');
        }
        
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== ФУНКЦИЯ ВАЛИДАЦИИ АДРЕСОВ ==========
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
                const ltcLegacyRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/;
                const ltcBech32Regex = /^(ltc1)[a-z0-9]{39,59}$/;
                return ltcLegacyRegex.test(address) || ltcBech32Regex.test(address);
            case 'NEAR':
                // ТОЛЬКО implicit аккаунты (64 hex символа)
                const nearImplicitRegex = /^[a-fA-F0-9]{64}$/;
                const addressLower = address.toLowerCase();
                return nearImplicitRegex.test(addressLower);
            case 'TRON':
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

// ========== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ОТПРАВКИ ==========
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
                    network,
                    fromAddress
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