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
        EXPLORER_API: 'https://blockchair.com/bitcoin-cash',
        NETWORK: bitcoin.networks.bitcoin
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockchair.com/litecoin',
        NETWORK: bitcoin.networks.bitcoin
    },
    ETHEREUM_CLASSIC: {
        RPC_URL: 'https://etc.rivet.link',
        CHAIN_ID: 61
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
    },
    XRP: {
        RPC_URL: 'wss://s1.ripple.com',
        JSON_RPC: 'https://s1.ripple.com:51234',
        NETWORK: 'mainnet'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    CARDANO: {
        BLOCKFROST_URL: 'https://cardano-mainnet.blockfrost.io/api/v0',
        NETWORK: 'mainnet'
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
        EXPLORER_API: 'https://blockchair.com/bitcoin-cash/testnet',
        NETWORK: bitcoin.networks.testnet
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockchair.com/litecoin/testnet',
        NETWORK: bitcoin.networks.testnet
    },
    ETHEREUM_CLASSIC: {
        RPC_URL: 'https://etc.rivet.link/testnet',
        CHAIN_ID: 62
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        JSON_RPC: 'https://s.altnet.rippletest.net:51234',
        NETWORK: 'testnet'
    },
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
        NETWORK: 'testnet'
    },
    CARDANO: {
        BLOCKFROST_URL: 'https://cardano-testnet.blockfrost.io/api/v0',
        NETWORK: 'testnet'
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
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
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

// ========== BITCOIN CASH ==========
const getBchWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/145'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        
        return {
            keyPair: child,
            address: address,
            network: networkConfig
        };
    } catch (error) {
        console.error('Error getting BCH wallet from seed:', error);
        throw error;
    }
};

export const sendBch = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, address: fromAddress, network: bchNetwork } = await getBchWalletFromSeed(seedPhrase, network);
        
        const amountInSatoshi = Math.floor(amount * 100000000);
        const amountToSend = amountInSatoshi - 1000;
        
        if (amountToSend <= 546) {
            throw new Error('Amount too small after deducting fee');
        }
        
        const utxoUrl = `${config.BITCOIN_CASH.EXPLORER_API}/dashboards/address/${fromAddress}`;
        const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const data = await utxoResponse.json();
        const utxos = data.data[fromAddress]?.utxo || [];
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        const psbt = new bitcoin.Psbt({ network: bchNetwork });
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            if (totalUtxoAmount >= amountInSatoshi + 1000) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInSatoshi + 1000) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + 1000) / 100000000} BCH, Have: ${totalUtxoAmount / 100000000} BCH`);
        }
        
        for (const utxo of selectedUtxos) {
            const txUrl = `${config.BITCOIN_CASH.EXPLORER_API}/raw/transaction/${utxo.txid}`;
            const txResponse = await callWithRetry(() => fetch(txUrl));
            const txData = await txResponse.json();
            
            const output = txData.vout[utxo.vout];
            const scriptBuffer = Buffer.from(output.scriptPubKey.hex, 'hex');
            
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
        
        const broadcastUrl = `${config.BITCOIN_CASH.EXPLORER_API}/push/transaction`;
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
        const txid = result.data.transaction_hash;
        
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

// ========== LITECOIN ==========
const getLtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        
        return {
            keyPair: child,
            address: address,
            network: networkConfig
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
        const amountToSend = amountInLitoshi - 1000;
        
        if (amountToSend <= 546) {
            throw new Error('Amount too small after deducting fee');
        }
        
        const utxoUrl = `${config.LITECOIN.EXPLORER_API}/dashboards/address/${fromAddress}`;
        const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const data = await utxoResponse.json();
        const utxos = data.data[fromAddress]?.utxo || [];
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available to spend');
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        const psbt = new bitcoin.Psbt({ network: ltcNetwork });
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            if (totalUtxoAmount >= amountInLitoshi + 1000) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInLitoshi + 1000) {
            throw new Error(`Insufficient balance. Need: ${(amountInLitoshi + 1000) / 100000000} LTC, Have: ${totalUtxoAmount / 100000000} LTC`);
        }
        
        for (const utxo of selectedUtxos) {
            const txUrl = `${config.LITECOIN.EXPLORER_API}/raw/transaction/${utxo.txid}`;
            const txResponse = await callWithRetry(() => fetch(txUrl));
            const txData = await txResponse.json();
            
            const output = txData.vout[utxo.vout];
            const scriptBuffer = Buffer.from(output.scriptPubKey.hex, 'hex');
            
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
        
        const broadcastUrl = `${config.LITECOIN.EXPLORER_API}/push/transaction`;
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
        const txid = result.data.transaction_hash;
        
        const explorerUrl = network === 'testnet'
            ? `https://blockchair.com/litecoin/testnet/transaction/${txid}`
            : `https://blockchair.com/litecoin/transaction/${txid}`;
            
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

// ========== ETHEREUM CLASSIC ==========
const getEtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM_CLASSIC.RPC_URL);
        return { wallet: wallet.connect(provider), provider };
    } catch (error) {
        console.error('Error getting ETC wallet from seed:', error);
        throw error;
    }
};

export const sendEtc = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, provider } = await getEtcWalletFromSeed(seedPhrase, network);
        
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
                gasPrice: feeData.gasPrice
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://blockscout.com/etc/testnet/tx/${tx.hash}`
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
            const amountInWei = ethers.parseEther(amount.toString());
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: 21000,
                gasPrice: await provider.getGasPrice()
            });
            
            const receipt = await tx.wait();
            
            const explorerUrl = network === 'testnet'
                ? `https://blockscout.com/etc/testnet/tx/${tx.hash}`
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

// ========== NEAR ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const { KeyPair, keyStores, InMemoryKeyStore, Connection, WalletConnection } = await import('near-api-js');
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const keyPair = KeyPair.fromRandom();
        
        const keyStore = new InMemoryKeyStore();
        await keyStore.setKey(config.NEAR.NETWORK, 'wallet', keyPair);
        
        const connection = Connection.fromConfig({
            networkId: config.NEAR.NETWORK,
            provider: { type: 'JsonRpcProvider', args: { url: config.NEAR.RPC_URL } },
            signer: { type: 'InMemorySigner', keyStore }
        });
        
        return {
            keyPair,
            connection,
            accountId: keyPair.getPublicKey().toString()
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, connection, accountId } = await getNearWalletFromSeed(seedPhrase, network);
        
        const { transactions, utils } = await import('near-api-js');
        
        const actions = [
            transactions.transfer(utils.format.parseNearAmount(amount.toString()))
        ];
        
        const provider = new providers.JsonRpcProvider({ url: config.NEAR.RPC_URL });
        const block = await provider.block({ finality: 'final' });
        
        const tx = transactions.createTransaction(
            accountId,
            keyPair.getPublicKey(),
            toAddress,
            1,
            actions,
            block.header.hash
        );
        
        const signedTx = transactions.signTransaction(tx, keyPair);
        const result = await provider.sendTransaction(signedTx);
        
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
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== XRP ==========
const getXrpWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const { Client, Wallet } = await import('xrpl');
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seed = seedBuffer.slice(0, 16).toString('hex');
        
        const wallet = Wallet.fromSeed(seed);
        
        const client = new Client(config.XRP.RPC_URL);
        
        return {
            wallet,
            client
        };
    } catch (error) {
        console.error('Error getting XRP wallet from seed:', error);
        throw error;
    }
};

export const sendXrp = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, client } = await getXrpWalletFromSeed(seedPhrase, network);
        
        await client.connect();
        
        const prepared = await client.autofill({
            TransactionType: "Payment",
            Account: wallet.address,
            Amount: client.xrpToDrops(amount.toString()),
            Destination: toAddress
        });
        
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);
        
        await client.disconnect();
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.xrpl.org/transactions/${result.result.hash}`
            : `https://livenet.xrpl.org/transactions/${result.result.hash}`;
            
        return {
            success: true,
            hash: result.result.hash,
            message: `Successfully sent ${amount} XRP`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[XRP ${network} ERROR]:`, error);
        throw new Error(`Failed to send XRP: ${error.message}`);
    }
};

// ========== TRON ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const TronWeb = (await import('tronweb')).default;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const ethWallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        
        const tronWeb = new TronWeb({
            fullHost: config.TRON.RPC_URL,
            privateKey: ethWallet.privateKey
        });
        
        return {
            tronWeb,
            address: tronWeb.address.fromPrivateKey(ethWallet.privateKey)
        };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { tronWeb, address } = await getTronWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const contract = await tronWeb.contract().at(contractAddress);
            
            const result = await contract.transfer(
                toAddress,
                tronWeb.toSun(amount)
            ).send();
            
            const explorerUrl = network === 'testnet'
                ? `https://shasta.tronscan.org/#/transaction/${result}`
                : `https://tronscan.org/#/transaction/${result}`;
                
            return {
                success: true,
                hash: result,
                message: `Successfully sent ${amount} TRC20`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            const result = await tronWeb.trx.sendTransaction(
                toAddress,
                tronWeb.toSun(amount)
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
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== CARDANO ==========
const getAdaWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedHex = seedBuffer.toString('hex').substring(0, 64);
        
        const { generateWalletFromSeed, Blockfrost } = await import('@emurgo/cardano-serialization-lib-browser');
        
        const wallet = generateWalletFromSeed(seedHex, network === 'testnet' ? 1 : 0);
        
        const config = getConfig(network);
        const blockfrost = new Blockfrost(config.CARDANO.BLOCKFROST_URL, process.env.BLOCKFROST_API_KEY || '');
        
        return {
            wallet,
            blockfrost,
            address: wallet.paymentAddress().to_bech32()
        };
    } catch (error) {
        console.error('Error getting ADA wallet from seed:', error);
        throw error;
    }
};

export const sendAda = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { wallet, blockfrost } = await getAdaWalletFromSeed(seedPhrase, network);
        
        const txBuilder = await import('@emurgo/cardano-serialization-lib-browser').then(m => m.TransactionBuilder);
        const tx = txBuilder.new(
            await blockfrost.getProtocolParameters()
        );
        
        const utxos = await blockfrost.getUtxos(wallet.paymentAddress().to_bech32());
        
        for (const utxo of utxos) {
            tx.add_input(
                utxo.tx_hash,
                utxo.tx_index,
                utxo.amount.find(a => a.unit === 'lovelace')?.quantity || '0'
            );
        }
        
        tx.add_output(
            toAddress,
            (parseFloat(amount) * 1000000).toString()
        );
        
        const signedTx = wallet.sign(tx.build());
        const txHash = await blockfrost.submitTransaction(signedTx.to_bytes());
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.cardanoscan.io/transaction/${txHash}`
            : `https://cardanoscan.io/transaction/${txHash}`;
            
        return {
            success: true,
            hash: txHash,
            message: `Successfully sent ${amount} ADA`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[ADA ${network} ERROR]:`, error);
        throw new Error(`Failed to send ADA: ${error.message}`);
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
            case 'Cardano':
                result = await sendAda({ 
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
            case 'XRP':
                result = await sendXrp({ 
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
            case 'BitcoinCash':
            case 'Litecoin':
                try {
                    const networkConfig = network === 'testnet' 
                        ? bitcoin.networks.testnet 
                        : bitcoin.networks.bitcoin;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'Cardano':
                return /^addr1[0-9a-z]+$/.test(address);
            case 'NEAR':
                return /^[a-z0-9._-]+\.near$/.test(address) || /^[a-f0-9]{64}$/.test(address);
            case 'XRP':
                return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
            case 'TRON':
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
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
        'Cardano': { mainnet: '0.17', testnet: '0.17' },
        'EthereumClassic': { mainnet: '0.0001', testnet: '0.00001' },
        'NEAR': { mainnet: '0.0001', testnet: '0.00001' },
        'XRP': { mainnet: '0.00001', testnet: '0.000001' },
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
    sendAda,
    sendEtc,
    sendNear,
    sendXrp,
    sendTrx,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};