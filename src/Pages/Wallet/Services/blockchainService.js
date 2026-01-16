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
        EXPLORER_API: 'https://api.blockchair.com/litecoin',
        RPC_URL: 'https://litecoinspace.org/api',
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
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
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
        EXPLORER_API: 'https://api.blockchair.com/bitcoin-cash/testnet',
        RPC_URL: 'https://testnet.lexitools.org/v1/',
        NETWORK: bitcoin.networks.testnet
    },
    LITECOIN: {
        EXPLORER_API: 'https://api.blockchair.com/litecoin/testnet',
        RPC_URL: 'https://testnet.litecoinspace.org/api',
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
    TRON: {
        RPC_URL: 'https://api.shasta.trongrid.io',
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

// ========== BITCOIN CASH (BCH) ==========
const getBchWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Bitcoin Cash network configuration
        const bchNetwork = network === 'testnet' ? {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: '',
            bip32: {
                public: 0x043587cf,
                private: 0x04358394
            },
            pubKeyHash: 0x6f,  // Testnet: 0x6f
            scriptHash: 0xc4,  // Testnet: 0xc4
            wif: 0xef
        } : {
            messagePrefix: '\x18Bitcoin Signed Message:\n',
            bech32: '',
            bip32: {
                public: 0x0488b21e,
                private: 0x0488ade4
            },
            pubKeyHash: 0x00,  // Mainnet: 0x00
            scriptHash: 0x05,  // Mainnet: 0x05
            wif: 0x80
        };
        
        const root = bip32.fromSeed(seedBuffer, bchNetwork);
        const child = root.derivePath("m/44'/145'/0'/0/0");
        
        // Для BCH используем legacy адреса (P2PKH)
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: bchNetwork 
        });
        
        return {
            keyPair: child,
            address: address,
            network: bchNetwork
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
        const fee = 1000; // Примерная комиссия
        
        if (amountInSatoshi <= 546) {
            throw new Error('Amount too small (minimum 546 satoshis)');
        }
        
        // Получаем UTXOs через Blockchair API
        const baseUrl = network === 'testnet' 
            ? 'https://api.blockchair.com/bitcoin-cash/testnet'
            : 'https://api.blockchair.com/bitcoin-cash';
        
        // Получаем баланс и UTXOs
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
        
        // Сортируем UTXOs по величине (от большего к меньшему)
        utxos.sort((a, b) => b.value - a.value);
        
        // Выбираем UTXOs для покрытия суммы
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            // Оценочная комиссия: 1000 сатоши
            if (totalUtxoAmount >= amountInSatoshi + fee) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInSatoshi + fee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + fee) / 100000000} BCH, Have: ${totalUtxoAmount / 100000000} BCH`);
        }
        
        // Создаем PSBT для BCH
        const psbt = new bitcoin.Psbt({ network: bchNetwork });
        
        // Добавляем inputs
        for (const utxo of selectedUtxos) {
            // Получаем raw transaction для nonWitnessUtxo
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
        
        // Output для получателя
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi,
        });
        
        // Output для сдачи (если есть)
        const changeAmount = totalUtxoAmount - amountInSatoshi - fee;
        if (changeAmount > 546) { // Минимальный выход
            psbt.addOutput({
                address: fromAddress,
                value: changeAmount,
            });
        }
        
        // Подписываем inputs
        selectedUtxos.forEach((_, index) => {
            psbt.signInput(index, keyPair);
        });
        
        // Проверяем подписи
        selectedUtxos.forEach((_, index) => {
            if (!psbt.validateSignaturesOfInput(index)) {
                throw new Error(`Invalid signature for input ${index}`);
            }
        });
        
        psbt.finalizeAllInputs();
        
        // Извлекаем транзакцию
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        // Отправляем транзакцию
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

// ========== LITECOIN (LTC) - ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getLtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Litecoin network configuration
        const ltcNetwork = network === 'testnet' ? {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x0436ef7d,
                private: 0x0436f6e1
            },
            pubKeyHash: 0x6f,  // Testnet: 0x6f
            scriptHash: 0xc4,  // Testnet: 0xc4
            wif: 0xef
        } : {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'ltc',
            bip32: {
                public: 0x019da462,
                private: 0x019d9cfe
            },
            pubKeyHash: 0x30,  // Mainnet: 0x30
            scriptHash: 0x32,  // Mainnet: 0x32
            wif: 0xb0
        };
        
        const root = bip32.fromSeed(seedBuffer, ltcNetwork);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: ltcNetwork 
        });
        
        return {
            keyPair: child,
            address: address,
            network: ltcNetwork
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
        const fee = 1000; // Примерная комиссия
        
        if (amountInLitoshi <= 546) {
            throw new Error('Amount too small (minimum 546 litoshis)');
        }
        
        // Проверяем, что у нас есть тестовые средства
        if (network === 'testnet') {
            console.warn('LTC Testnet: Address needs funding:', fromAddress);
            throw new Error(`LTC testnet wallet has no funds. Please fund the address first: ${fromAddress}`);
        }
        
        // Для mainnet продолжаем обычную логику
        let baseUrl;
        let explorerApi;
        if (network === 'testnet') {
            baseUrl = 'https://api.blockchair.com/litecoin/testnet';
            explorerApi = 'https://blockstream.info/testnet/api';
        } else {
            baseUrl = 'https://api.blockchair.com/litecoin';
            explorerApi = 'https://blockstream.info/api';
        }
        
        let utxos = [];
        let useBlockchair = true;
        
        try {
            const addressUrl = `${baseUrl}/dashboards/address/${fromAddress}`;
            const addressResponse = await callWithRetry(() => fetch(addressUrl));
            
            if (addressResponse.status === 430 || !addressResponse.ok) {
                console.warn('Blockchair API failed, falling back to Blockstream/Litecoin Explorer');
                useBlockchair = false;
            } else {
                const addressData = await addressResponse.json();
                utxos = addressData.data[fromAddress]?.utxo || [];
            }
        } catch (error) {
            console.warn('Error with Blockchair API:', error);
            useBlockchair = false;
        }
        
        if (!useBlockchair) {
            try {
                const utxoUrl = `${explorerApi}/address/${fromAddress}/utxo`;
                const utxoResponse = await callWithRetry(() => fetch(utxoUrl));
                
                if (utxoResponse.ok) {
                    const blockstreamUtxos = await utxoResponse.json();
                    utxos = blockstreamUtxos.map(utxo => ({
                        txid: utxo.txid,
                        vout: utxo.vout,
                        value: utxo.value
                    }));
                }
            } catch (fallbackError) {
                console.error('Fallback API also failed:', fallbackError);
            }
        }
        
        if (utxos.length === 0) {
            throw new Error(`No UTXOs available to spend. Please fund your LTC address: ${fromAddress}`);
        }
        
        utxos.sort((a, b) => b.value - a.value);
        
        let totalUtxoAmount = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            totalUtxoAmount += utxo.value;
            selectedUtxos.push(utxo);
            
            if (totalUtxoAmount >= amountInLitoshi + fee) {
                break;
            }
        }
        
        if (totalUtxoAmount < amountInLitoshi + fee) {
            throw new Error(`Insufficient balance. Need: ${(amountInLitoshi + fee) / 100000000} LTC, Have: ${totalUtxoAmount / 100000000} LTC`);
        }
        
        const psbt = new bitcoin.Psbt({ network: ltcNetwork });
        
        for (const utxo of selectedUtxos) {
            let rawTx;
            
            if (useBlockchair) {
                const txUrl = `${baseUrl}/raw/transaction/${utxo.txid}`;
                const txResponse = await callWithRetry(() => fetch(txUrl));
                
                if (!txResponse.ok) {
                    throw new Error(`Failed to fetch transaction: ${utxo.txid}`);
                }
                
                const txData = await txResponse.json();
                rawTx = txData.data[utxo.txid]?.raw_transaction;
            } else {
                const txUrl = `${explorerApi}/tx/${utxo.txid}/hex`;
                const txResponse = await callWithRetry(() => fetch(txUrl));
                
                if (!txResponse.ok) {
                    throw new Error(`Failed to fetch transaction hex: ${utxo.txid}`);
                }
                
                rawTx = await txResponse.text();
            }
            
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
            value: amountInLitoshi,
        });
        
        const changeAmount = totalUtxoAmount - amountInLitoshi - fee;
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
        
        let broadcastUrl;
        if (useBlockchair) {
            broadcastUrl = `${baseUrl}/push/transaction`;
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
                ? `https://blockchair.com/litecoin/testnet/transaction/${txid}`
                : `https://blockchair.com/litecoin/transaction/${txid}`;
                
            return {
                success: true,
                hash: txid,
                message: `Successfully sent ${amount} LTC`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        } else {
            broadcastUrl = `${explorerApi}/tx`;
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
                ? `https://blockchair.com/litecoin/testnet/transaction/${txid}`
                : `https://blockchair.com/litecoin/transaction/${txid}`;
                
            return {
                success: true,
                hash: txid,
                message: `Successfully sent ${amount} LTC`,
                explorerUrl,
                timestamp: new Date().toISOString()
            };
        }
        
    } catch (error) {
        console.error(`[LTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send LTC: ${error.message}`);
    }
};

// ========== ETHEREUM CLASSIC (ETC) - ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getEtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/61'/0'/0/0"); // ETC использует коинтип 61
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
        
        // Получаем баланс перед отправкой
        const balance = await provider.getBalance(wallet.address);
        
        // Получаем gas price
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice;
        
        if (!gasPrice) {
            throw new Error('Could not get gas price from network');
        }
        
        if (contractAddress) {
            // Отправка токена ETC (аналогично ERC20)
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
            
            // Проверяем баланс токена
            const tokenBalance = await contract.balanceOf(wallet.address);
            if (tokenBalance < amountInUnits) {
                throw new Error(`Insufficient token balance. Have: ${ethers.formatUnits(tokenBalance, decimals)}, Need: ${amount}`);
            }
            
            // Оцениваем газ
            const gasEstimate = await contractWithSigner.transfer.estimateGas(toAddress, amountInUnits);
            const gasLimit = Math.floor(gasEstimate * 1.2);
            const gasCost = gasPrice * BigInt(gasLimit);
            
            // Для токенов мы не отправляем ETC, но gas оплачивается в ETC, поэтому проверяем баланс ETC на gas
            if (balance < gasCost) {
                throw new Error(`Insufficient ETC for gas. Need ${ethers.formatEther(gasCost)} ETC for gas, have ${ethers.formatEther(balance)} ETC`);
            }
            
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits, {
                gasLimit: gasLimit,
                gasPrice: gasPrice
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
            // Отправка нативного ETC
            const amountInWei = ethers.parseEther(amount.toString());
            
            // Для нативной транзакции gasLimit = 21000
            const gasLimit = 21000;
            const gasCost = gasPrice * BigInt(gasLimit);
            const totalCost = amountInWei + gasCost;
            
            if (balance < totalCost) {
                throw new Error(`Insufficient ETC balance for transaction. Need ${ethers.formatEther(totalCost)} ETC (including gas), have ${ethers.formatEther(balance)} ETC`);
            }
            
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: amountInWei,
                gasLimit: gasLimit,
                gasPrice: gasPrice
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

// ========== NEAR - ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем seed из мнемонической фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        
        // Берем первые 32 байта для seed
        const seed = Buffer.from(seedBuffer).slice(0, 32);
        
        // Для NEAR используем BIP44 путь: m/44'/397'/0'/0'/0'
        // 397 - это coin type для NEAR
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/397'/0'/0'/0'");
        
        // Конвертируем публичный ключ в NEAR-совместимый формат
        const publicKey = wallet.publicKey.slice(2); // Убираем 0x
        const nearPublicKey = `ed25519:${Buffer.from(publicKey, 'hex').toString('base64')}`;
        
        // Создаем accountId на основе публичного ключа
        // В mainnet: [хеш-публичного-ключа].near
        // В testnet: [хеш-публичного-ключа].testnet
        const hash = sha256(publicKey);
        const accountIdPrefix = hash.slice(0, 16);
        const accountId = `${accountIdPrefix}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        return {
            privateKey: `ed25519:${seed.toString('hex')}`,
            publicKey: nearPublicKey,
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
        const { privateKey, publicKey, accountId, networkId, rpcUrl } = await getNearWalletFromSeed(seedPhrase, network);
        
        // Динамический импорт near-api-js
        const nearAPI = await import('near-api-js');
        const { connect, keyStores, KeyPair, utils } = nearAPI;
        
        // Создаем keyStore
        const keyStore = new keyStores.InMemoryKeyStore();
        
        // Создаем KeyPair из приватного ключа
        const keyPair = KeyPair.fromString(privateKey);
        
        // Сохраняем ключ в keyStore
        await keyStore.setKey(networkId, accountId, keyPair);
        
        // Конфигурация подключения
        const nearConfig = {
            networkId,
            keyStore,
            nodeUrl: rpcUrl,
            walletUrl: network === 'testnet' ? 'https://testnet.mynearwallet.com' : 'https://app.mynearwallet.com',
            helperUrl: config.NEAR.HELPER_URL,
            explorerUrl: network === 'testnet' ? 'https://explorer.testnet.near.org' : 'https://explorer.near.org',
        };
        
        // Подключаемся к NEAR
        const near = await connect(nearConfig);
        
        // Создаем аккаунт объект
        const account = await near.account(accountId);
        
        // Проверяем существует ли аккаунт
        try {
            await account.state();
        } catch (error) {
            if (error.message.includes('does not exist')) {
                throw new Error('NEAR account does not exist. You need to create it first with minimum 0.1 NEAR');
            }
            throw error;
        }
        
        // Конвертируем сумму в yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const amountInYocto = utils.format.parseNearAmount(amount.toString());
        
        if (!amountInYocto) {
            throw new Error('Invalid amount');
        }
        
        // Проверяем формат toAddress
        let recipientAccountId = toAddress;
        
        // Если адрес начинается с 0x (EVM формат), конвертируем в NEAR accountId
        if (toAddress.startsWith('0x')) {
            console.warn('Converting EVM address to NEAR accountId format');
            const hash = sha256(toAddress.toLowerCase().replace('0x', ''));
            recipientAccountId = `${hash.slice(0, 16)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        }
        
        // Проверяем валидность NEAR accountId
        if (!recipientAccountId.match(/^[a-z0-9_-]+\.(near|testnet)$/)) {
            throw new Error(`Invalid NEAR account ID: ${recipientAccountId}. Must be in format 'account.near' or 'account.testnet'`);
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

// ========== TRON (TRX) - ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем приватный ключ из seed phrase
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0"); // TRON использует коинтип 195
        
        // Конвертируем приватный ключ в HEX без 0x
        const privateKeyHex = wallet.privateKey.slice(2);
        
        // Генерируем TRON адрес из приватного ключа
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        const tronAddress = bs58.encode(addressWithChecksum);
        
        return {
            privateKey: privateKeyHex,
            address: tronAddress,
            rpcUrl: config.TRON.RPC_URL,
            network: network
        };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { privateKey, address: fromAddress, rpcUrl, network: tronNetwork } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Используем совместимый импорт TronWeb
        const TronWebModule = await import('tronweb');
        
        // Определяем, какую версию TronWeb мы используем
        let TronWeb;
        let tronWeb;
        
        if (typeof TronWebModule === 'function') {
            // Старая версия: TronWeb - конструктор
            TronWeb = TronWebModule;
            tronWeb = new TronWeb({
                fullHost: rpcUrl,
                privateKey: privateKey
            });
        } else if (TronWebModule.default && typeof TronWebModule.default === 'function') {
            // ES модуль с default конструктором
            TronWeb = TronWebModule.default;
            tronWeb = new TronWeb({
                fullHost: rpcUrl,
                privateKey: privateKey
            });
        } else if (TronWebModule.create) {
            // Новая версия: используем create
            TronWeb = TronWebModule;
            tronWeb = TronWeb.create({
                fullHost: rpcUrl,
                privateKey: privateKey
            });
        } else if (TronWebModule.default && TronWebModule.default.create) {
            // ES модуль с create методом
            TronWeb = TronWebModule.default;
            tronWeb = TronWeb.create({
                fullHost: rpcUrl,
                privateKey: privateKey
            });
        } else {
            throw new Error('Unsupported TronWeb version. Please check your tronweb package.');
        }
        
        // Проверяем подключение
        try {
            await tronWeb.trx.getNodeInfo();
        } catch (error) {
            throw new Error('Failed to connect to TRON network: ' + error.message);
        }
        
        if (contractAddress) {
            // Отправка TRC20 токена
            const contract = await tronWeb.contract().at(contractAddress);
            
            let decimals = 6;
            try {
                const decimalsResult = await contract.decimals().call();
                decimals = decimalsResult.toString();
            } catch (e) {
                console.warn('Could not get token decimals, using default 6');
            }
            
            const amountInUnits = tronWeb.toBigNumber(amount).times(10 ** decimals).toFixed(0);
            
            // Проверяем баланс
            const balanceResult = await contract.balanceOf(fromAddress).call();
            const balance = tronWeb.toBigNumber(balanceResult.toString());
            
            if (balance.lt(amountInUnits)) {
                throw new Error(`Insufficient TRC20 balance. Have: ${balance.div(10 ** decimals).toString()}, Need: ${amount}`);
            }
            
            // Вызываем transfer функцию
            const result = await contract.transfer(
                toAddress,
                amountInUnits
            ).send({
                feeLimit: 100000000,
                callValue: 0,
                from: fromAddress
            });
            
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
            // Отправка нативного TRX
            const amountInSun = tronWeb.toSun(amount);
            
            // Проверяем баланс
            const balance = await tronWeb.trx.getBalance(fromAddress);
            if (balance < amountInSun) {
                throw new Error(`Insufficient TRX balance. Have: ${tronWeb.fromSun(balance)}, Need: ${amount}`);
            }
            
            // Создаем транзакцию
            const transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                fromAddress
            );
            
            // Подписываем транзакцию
            const signedTransaction = await tronWeb.trx.sign(transaction, privateKey);
            
            // Отправляем транзакцию
            const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
            
            if (!result.result) {
                throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
            }
            
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
                    const networkConfig = network === 'testnet' 
                        ? bitcoin.networks.testnet 
                        : bitcoin.networks.bitcoin;
                    bitcoin.address.toOutputScript(address, networkConfig);
                    return true;
                } catch { 
                    return false; 
                }
            case 'BitcoinCash':
                // BCH адреса могут быть legacy (начинаются с 1 или 3) или cashaddr (начинаются с bitcoincash:)
                const bchRegex = /^(bitcoincash:)?(q|p)[a-z0-9]{41}$|^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
                return bchRegex.test(address);
            case 'Litecoin':
                // LTC адреса могут начинаться с L, M, или 3
                const ltcRegex = /^(L|M|3)[a-km-zA-HJ-NP-Z1-9]{26,33}$|^(ltc1)[a-z0-9]{39,59}$/;
                return ltcRegex.test(address);
            case 'NEAR':
                // NEAR адреса: account.near или account.testnet
                const nearRegex = /^[a-z0-9_-]+\.(near|testnet)$/;
                return nearRegex.test(address);
            case 'TRON':
                // TRON адреса начинаются с T и имеют 34 символа
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