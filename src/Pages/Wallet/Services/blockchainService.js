// blockchainService.js
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { BIP32Factory } from 'bip32';
import TronWeb from 'tronweb';
import { KeyPair, connect, keyStores, utils, transactions, providers } from 'near-api-js';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

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
        FULL_HOST: 'https://api.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api'
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet'
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
        FULL_HOST: 'https://api.shasta.trongrid.io'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api'
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet'
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

// ========== BITCOIN ==========
const getBitcoinWalletFromSeed = (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
        const seedBuffer = bip39.mnemonicToSeedSync(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const derivationPath = network === 'testnet' ? "m/84'/1'/0'/0/0" : "m/84'/0'/0'/0/0";
        const child = root.derivePath(derivationPath);
        
        if (!child.privateKey) {
            throw new Error('Failed to derive private key');
        }
        
        // Создаем ECPair из приватного ключа
        const keyPair = bitcoin.ECPair.fromPrivateKey(child.privateKey, { network: networkConfig });
        
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: networkConfig
        });
        
        if (!address) {
            throw new Error('Failed to generate Bitcoin address');
        }
        
        return {
            keyPair,
            address,
            network: networkConfig,
            child
        };
    } catch (error) {
        console.error('Error getting Bitcoin wallet:', error);
        throw new Error(`Failed to get Bitcoin wallet: ${error.message}`);
    }
};

const getBitcoinUtxos = async (address, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${address}/utxo`);
        if (!response.ok) throw new Error('Failed to fetch UTXOs');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error getting Bitcoin UTXOs:', error);
        throw error;
    }
};

const getBitcoinRawTransaction = async (txid, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/tx/${txid}/hex`);
        if (!response.ok) throw new Error('Failed to fetch raw transaction');
        return await response.text();
    } catch (error) {
        console.error('Error getting Bitcoin raw transaction:', error);
        throw error;
    }
};

const broadcastBitcoinTransaction = async (txHex, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Broadcast failed: ${errorText}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error('Error broadcasting Bitcoin transaction:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`Starting Bitcoin send: ${amount} BTC to ${toAddress} on ${network}`);
        
        const wallet = getBitcoinWalletFromSeed(seedPhrase, network);
        console.log('From address:', wallet.address);
        
        try {
            bitcoin.address.toOutputScript(toAddress, wallet.network);
        } catch (error) {
            throw new Error(`Invalid Bitcoin address: ${toAddress}`);
        }
        
        const utxos = await getBitcoinUtxos(wallet.address, network);
        console.log('UTXOs found:', utxos.length);
        
        if (utxos.length === 0) {
            throw new Error('No UTXOs available for this address');
        }
        
        const amountInSatoshi = Math.floor(amount * 100000000);
        console.log('Amount in satoshi:', amountInSatoshi);
        
        utxos.sort((a, b) => b.value - a.value);
        
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
            
            const estimatedFee = 2000;
            if (totalInput >= amountInSatoshi + estimatedFee) {
                break;
            }
        }
        
        console.log('Total input:', totalInput, 'Selected UTXOs:', selectedUtxos.length);
        
        const estimatedFee = 2000;
        if (totalInput < amountInSatoshi + estimatedFee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + estimatedFee) / 1e8} BTC, Have: ${totalInput / 1e8} BTC`);
        }
        
        const psbt = new bitcoin.Psbt({ network: wallet.network });
        
        for (const utxo of selectedUtxos) {
            const rawTx = await getBitcoinRawTransaction(utxo.txid, network);
            const rawTxBuffer = Buffer.from(rawTx, 'hex');
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: bitcoin.address.toOutputScript(wallet.address, wallet.network),
                    value: utxo.value
                },
                nonWitnessUtxo: rawTxBuffer
            });
        }
        
        psbt.addOutput({
            address: toAddress,
            value: amountInSatoshi
        });
        
        const fee = 2000;
        const change = totalInput - amountInSatoshi - fee;
        
        if (change > 1000) {
            psbt.addOutput({
                address: wallet.address,
                value: change
            });
        }
        
        console.log('PSBT created, signing inputs...');
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            if (!wallet.child.privateKey) {
                throw new Error('Private key not available for signing');
            }
            
            const signingKeyPair = bitcoin.ECPair.fromPrivateKey(wallet.child.privateKey, { network: wallet.network });
            psbt.signInput(i, signingKeyPair);
            
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        psbt.finalizeAllInputs();
        
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        console.log('Transaction ready, broadcasting...');
        
        const txid = await broadcastBitcoinTransaction(txHex, network);
        
        console.log('Transaction broadcasted, txid:', txid);
        
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

// ========== TRON ==========
const getTronPrivateKeyFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        if (!privateKey || privateKey.length !== 64) {
            throw new Error('Invalid TRON private key generated');
        }
        
        return privateKey;
    } catch (error) {
        console.error('Error getting TRON private key:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const privateKey = await getTronPrivateKeyFromSeed(seedPhrase);
        
        console.log(`Starting TRON send: ${amount} TRX to ${toAddress} on ${network}`);
        
        // Инициализируем TronWeb правильно
        const tronWeb = new TronWeb({
            fullHost: config.TRON.FULL_HOST
        });
        
        // Устанавливаем приватный ключ
        tronWeb.setPrivateKey(privateKey);
        
        const fromAddress = tronWeb.address.fromPrivateKey(privateKey);
        console.log('From address:', fromAddress);
        
        const amountInSun = tronWeb.toSun(amount.toString());
        console.log('Amount in SUN:', amountInSun);
        
        const balance = await tronWeb.trx.getBalance(fromAddress);
        console.log('Sender balance:', tronWeb.fromSun(balance), 'TRX');
        
        if (balance < amountInSun) {
            throw new Error(`Insufficient balance. Need: ${amount} TRX, Have: ${tronWeb.fromSun(balance)} TRX`);
        }
        
        console.log('Creating transaction...');
        const transaction = await tronWeb.transactionBuilder.sendTrx(
            toAddress,
            amountInSun,
            fromAddress
        );
        
        if (!transaction) {
            throw new Error('Failed to create transaction');
        }
        
        console.log('Signing transaction...');
        const signedTransaction = await tronWeb.trx.sign(transaction);
        
        if (!signedTransaction.signature || signedTransaction.signature.length === 0) {
            throw new Error('Transaction not signed properly');
        }
        
        console.log('Broadcasting transaction...');
        const result = await tronWeb.trx.sendRawTransaction(signedTransaction);
        
        if (!result.result) {
            throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
        }
        
        console.log('Transaction successful, txid:', result.txid);
        
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
        
    } catch (error) {
        console.error(`[TRON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== NEAR ==========
const getNearAccountFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        const accountId = wallet.address.toLowerCase();
        
        const keyStore = new keyStores.InMemoryKeyStore();
        const privateKeyHex = wallet.privateKey.slice(2);
        const seed = hexToBytes(privateKeyHex);
        const hash = sha256(seed);
        
        const keyPair = KeyPair.fromString(`ed25519:${bytesToHex(hash.slice(0, 32))}`);
        
        await keyStore.setKey(config.NEAR.NETWORK_ID, accountId, keyPair);
        
        const nearConfig = {
            networkId: config.NEAR.NETWORK_ID,
            keyStore: keyStore,
            nodeUrl: config.NEAR.RPC_URL
        };
        
        const nearConnection = await connect(nearConfig);
        const account = await nearConnection.account(accountId);
        
        return {
            account,
            accountId,
            keyPair,
            nearConnection
        };
    } catch (error) {
        console.error('Error getting NEAR account:', error);
        throw error;
    }
};

const sendNearTransactionDirectly = async (senderId, receiverId, amountInYocto, keyPair, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const provider = new providers.JsonRpcProvider(config.NEAR.RPC_URL);
        const block = await provider.block({ finality: 'final' });
        
        let accessKeys;
        try {
            accessKeys = await provider.query({
                request_type: 'view_access_key_list',
                account_id: senderId,
                finality: 'final'
            });
        } catch (error) {
            throw new Error(`Account ${senderId} does not exist on NEAR network`);
        }
        
        const accessKey = accessKeys.keys.find(key => 
            key.access_key.permission === 'FullAccess'
        );
        
        if (!accessKey) {
            throw new Error(`No suitable access key found for account ${senderId}`);
        }
        
        const actions = [
            transactions.transfer(amountInYocto)
        ];
        
        const publicKey = keyPair.getPublicKey();
        
        const transaction = transactions.createTransaction(
            senderId,
            publicKey,
            receiverId,
            accessKey.access_key.nonce + 1,
            actions,
            block.header.hash
        );
        
        const serializedTx = transactions.serialize.transaction(transaction);
        const signature = keyPair.sign(serializedTx);
        const signedTransaction = new transactions.SignedTransaction({
            transaction,
            signature: new transactions.Signature({
                keyType: transaction.publicKey.keyType,
                data: signature.signature
            })
        });
        
        const result = await provider.sendTransaction(signedTransaction);
        return result;
    } catch (error) {
        console.error('Error sending NEAR transaction directly:', error);
        throw error;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`Starting NEAR send: ${amount} NEAR to ${toAddress} on ${network}`);
        
        const { account, accountId, keyPair } = await getNearAccountFromSeed(seedPhrase, network);
        console.log('From account:', accountId);
        
        const amountInYocto = utils.format.parseNearAmount(amount.toString());
        if (!amountInYocto) {
            throw new Error('Invalid amount');
        }
        
        console.log('Amount in yoctoNEAR:', amountInYocto);
        
        if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
            throw new Error('NEAR recipient must be a valid 0x... address (42 characters)');
        }
        
        console.log('Sending transaction...');
        
        let result;
        try {
            result = await account.sendMoney(toAddress, amountInYocto);
        } catch (error) {
            console.log('Standard method failed, trying direct RPC...', error.message);
            result = await sendNearTransactionDirectly(accountId, toAddress, amountInYocto, keyPair, network);
        }
        
        console.log('Transaction result:', result);
        
        let transactionHash;
        if (result.transaction && result.transaction.hash) {
            transactionHash = result.transaction.hash;
        } else if (result.transaction_outcome && result.transaction_outcome.id) {
            transactionHash = result.transaction_outcome.id;
        } else {
            throw new Error('Failed to get transaction hash from result');
        }
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/ru/txns/${transactionHash}`
            : `https://nearblocks.io/txns/${transactionHash}`;
        
        return {
            success: true,
            hash: transactionHash,
            message: `Successfully sent ${amount} NEAR`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        
        if (error.message.includes('does not exist')) {
            throw new Error(`Account does not exist on NEAR network. You need to create it first.`);
        }
        
        if (error.message.includes('access key')) {
            throw new Error(`Access key issue: ${error.message}`);
        }
        
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

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
                return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) || /^41[0-9a-fA-F]{40}$/.test(address);
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
            case 'NEAR':
                return /^0x[0-9a-fA-F]{40}$/.test(address);
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