import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal, fromNano, Cell, beginCell } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import base58 from 'bs58';
import { JsonRpcProvider } from '@near-js/providers';
import { KeyPair as NearKeyPair } from '@near-js/crypto';
import { serialize, deserialize } from 'borsh';
import { sha256 } from '@noble/hashes/sha256';
import { sign } from '@noble/ed25519';

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
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
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
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
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

// === УТИЛИТЫ ===
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getConfig = (network) => network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;

// === TON ===
const getTonWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        
        const client = new TonClient({
            endpoint: config.TON.RPC_URL,
            apiKey: config.TON.API_KEY
        });
        
        const openedWallet = client.open(wallet);
        return { wallet: openedWallet, keyPair, client };
    } catch (error) {
        console.error('Error getting TON wallet from seed:', error);
        throw error;
    }
};

// Функция для создания Jetton transfer
const createJettonTransferBody = (toAddress, amount, responseAddress, forwardAmount, forwardPayload) => {
    return beginCell()
        .storeUint(0xf8a7ea5, 32) // jetton transfer op
        .storeUint(0, 64) // query_id
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(responseAddress)
        .storeBit(0) // no custom payload
        .storeCoins(forwardAmount)
        .storeBit(1) // we store forward payload as a reference
        .storeRef(
            beginCell()
                .storeBuffer(Buffer.from(forwardPayload))
                .endCell()
        )
        .endCell();
};

export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', contractAddress = null, network = 'mainnet' }) => {
    try {
        console.log(`[TON ${network}] Sending ${amount} ${contractAddress ? 'USDT' : 'TON'} to ${toAddress}`);
        
        const { wallet, keyPair, client } = await getTonWalletFromSeed(seedPhrase, network);
        
        // Получаем текущий seqno
        const seqno = await wallet.getSeqno();
        const amountInNano = toNano(amount);

        let transfer;
        
        if (contractAddress) {
            // Отправка Jetton (USDT)
            // Для Jetton нужно сначала найти jetton wallet адрес
            // Используем API для получения jetton wallet
            const config = getConfig(network);
            const response = await fetch(`${network === 'testnet' ? 'https://testnet.tonapi.io/v2' : 'https://tonapi.io/v2'}/accounts/${wallet.address.toString()}/jettons`, {
                headers: {
                    'Authorization': `Bearer ${config.TON.API_KEY}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch jetton wallets');
            }
            
            const data = await response.json();
            const jettonInfo = data.balances?.find(j => j.jetton.address === contractAddress);
            
            if (!jettonInfo) {
                throw new Error('Jetton wallet not found');
            }
            
            const jettonWalletAddress = jettonInfo.wallet_address.address;
            
            // Создаем тело для Jetton transfer
            const jettonTransferBody = createJettonTransferBody(
                toAddress,
                amountInNano,
                wallet.address, // response address
                toNano('0.05'), // forward amount
                comment ? Buffer.from(comment) : Buffer.alloc(0)
            );
            
            transfer = wallet.createTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [
                    internal({
                        to: jettonWalletAddress,
                        value: toNano('0.1'), // газ для jetton transfer
                        body: jettonTransferBody
                    })
                ]
            });
        } else {
            // Отправка нативного TON
            const messageBody = comment ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell() : null;
            
            transfer = wallet.createTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [
                    internal({
                        to: toAddress,
                        value: amountInNano,
                        body: messageBody,
                        bounce: false
                    })
                ]
            });
        }

        // Отправляем транзакцию
        await wallet.send(transfer);

        // Ждем подтверждения
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await delay(2000);
            attempts++;
            
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
                    // Получаем транзакции аккаунта
                    const transactions = await client.getTransactions(wallet.address, {
                        limit: 1,
                        archival: true
                    });
                    
                    const lastTx = transactions[0];
                    const txHash = lastTx?.hash().toString('hex');
                    
                    const explorerUrl = network === 'testnet' 
                        ? `https://testnet.tonscan.org/tx/${txHash}`
                        : `https://tonscan.org/tx/${txHash}`;
                    
                    return {
                        success: true,
                        hash: txHash || `seqno_${seqno}`,
                        message: `Successfully sent ${amount} ${contractAddress ? 'USDT' : 'TON'}`,
                        explorerUrl,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                console.warn(`Attempt ${attempts}: Error checking transaction status:`, error);
                continue;
            }
        }

        // Если не дождались подтверждения, возвращаем pending
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

// === ETHEREUM ===
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

// === SOLANA ===
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
            // Отправка SPL токена (USDT)
            const fromTokenAccount = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                new PublicKey(contractAddress),
                keypair.publicKey
            );
            
            const toTokenAccount = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                new PublicKey(contractAddress),
                new PublicKey(toAddress)
            );
            
            // Получаем информацию о токене
            const token = new Token(
                connection,
                new PublicKey(contractAddress),
                TOKEN_PROGRAM_ID,
                keypair
            );
            
            const tokenInfo = await token.getMintInfo();
            const decimals = tokenInfo.decimals;
            const amountInUnits = Math.floor(amount * Math.pow(10, decimals));
            
            const transaction = new Transaction().add(
                Token.createTransferInstruction(
                    TOKEN_PROGRAM_ID,
                    fromTokenAccount,
                    toTokenAccount,
                    keypair.publicKey,
                    [],
                    amountInUnits
                )
            );
            
            const { blockhash } = await connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = keypair.publicKey;
            
            transaction.sign(keypair);
            
            const signature = await connection.sendRawTransaction(transaction.serialize());
            
            await connection.confirmTransaction(signature);
            
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
            // Отправка нативного SOL
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

// === TRON ===
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
        // Генерируем адрес Tron из приватного ключа
        const privateKeyBuffer = Buffer.from(privateKey, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
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

const signTronTransaction = (transaction, privateKey) => {
    // Подписываем транзакцию Tron
    const txID = transaction.txID || transaction.transaction?.txID;
    const rawData = transaction.raw_data || transaction.transaction?.raw_data;
    
    if (!txID || !rawData) {
        throw new Error('Invalid transaction data');
    }
    
    // Хэшируем raw_data
    const rawDataHex = JSON.stringify(rawData);
    const hash = sha256(Buffer.from(rawDataHex, 'utf-8'));
    
    // Подписываем хэш с помощью приватного ключа
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    const signature = ecc.sign(hash, privateKeyBuffer);
    
    // Добавляем подпись к транзакции
    const signedTransaction = {
        ...transaction,
        signature: [Buffer.from(signature).toString('hex')]
    };
    
    return signedTransaction;
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { privateKey, address } = await getTronWalletFromSeed(seedPhrase, network);
        
        const amountInSun = Math.floor(amount * 1_000_000);
        
        if (contractAddress) {
            // TRC20 токен (USDT)
            // Кодируем параметры для вызова transfer
            const toAddressHex = toAddress.startsWith('T') ? 
                base58.decode(toAddress).slice(1, 21).toString('hex').padStart(64, '0') :
                toAddress.slice(2).padStart(64, '0');
            
            const amountHex = amountInSun.toString(16).padStart(64, '0');
            const parameter = toAddressHex + amountHex;
            
            // Создаем транзакцию вызова смарт-контракта
            const createResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/triggersmartcontract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_address: address,
                    contract_address: contractAddress,
                    function_selector: 'transfer(address,uint256)',
                    parameter: parameter,
                    fee_limit: 100000000,
                    call_value: 0,
                    visible: true
                })
            });
            
            if (!createResponse.ok) {
                throw new Error('Failed to create TRC20 transaction');
            }
            
            let transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            // Подписываем транзакцию
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            // Отправляем подписанную транзакцию
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            if (!broadcastResponse.ok) {
                throw new Error('Failed to broadcast transaction');
            }
            
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
            // Нативный TRX
            const createResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/createtransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_address: toAddress,
                    owner_address: address,
                    amount: amountInSun,
                    visible: true
                })
            });
            
            if (!createResponse.ok) {
                throw new Error('Failed to create TRX transaction');
            }
            
            let transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            // Подписываем транзакцию
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            // Отправляем подписанную транзакцию
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            if (!broadcastResponse.ok) {
                throw new Error('Failed to broadcast transaction');
            }
            
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
        throw new Error(`Failed to send: ${error.message}`);
    }
};

// === BITCOIN ===
export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[BTC ${network}] Sending ${amount} BTC to ${toAddress}`);
        
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        
        // Проверяем адрес
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
        
        // Получаем UTXO
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
        
        // Подписываем все входы
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, child);
        }
        
        // Проверяем подписи
        for (let i = 0; i < selectedUtxos.length; i++) {
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
        // Отправляем транзакцию
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

// === NEAR ===
const getNearKeyPairFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'");
        
        // Генерируем ed25519 ключевую пару для NEAR
        const privateKeyHex = wallet.privateKey.slice(2);
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        
        // Создаем KeyPair для NEAR
        const keyPair = new NearKeyPair(
            0, // ed25519
            Uint8Array.from(privateKeyBuffer)
        );
        
        // Генерируем accountId из публичного ключа
        const publicKey = keyPair.getPublicKey().data;
        const publicKeyHex = Buffer.from(publicKey).toString('hex');
        const accountId = `${publicKeyHex.slice(0, 40)}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        return { keyPair, accountId };
    } catch (error) {
        console.error('Error getting NEAR key pair from seed:', error);
        throw error;
    }
};

// Borsh схемы для NEAR транзакций
class TransactionSchema {
    constructor(properties) {
        Object.keys(properties).forEach((key) => {
            this[key] = properties[key];
        });
    }
}

class ActionSchema {
    constructor(properties) {
        Object.keys(properties).forEach((key) => {
            this[key] = properties[key];
        });
    }
}

class TransferActionSchema {
    constructor(properties) {
        Object.keys(properties).forEach((key) => {
            this[key] = properties[key];
        });
    }
}

const SCHEMA = new Map([
    [TransactionSchema, {
        kind: 'struct',
        fields: [
            ['signerId', 'string'],
            ['publicKey', [32]],
            ['nonce', 'u64'],
            ['receiverId', 'string'],
            ['blockHash', [32]],
            ['actions', [ActionSchema]]
        ]
    }],
    [ActionSchema, {
        kind: 'enum',
        field: 'enum',
        values: [
            ['transfer', TransferActionSchema]
        ]
    }],
    [TransferActionSchema, {
        kind: 'struct',
        fields: [
            ['deposit', 'u128']
        ]
    }]
]);

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[NEAR ${network}] Sending ${amount} NEAR to ${toAddress}`);
        
        const config = getConfig(network);
        const { keyPair, accountId } = await getNearKeyPairFromSeed(seedPhrase, network);
        
        const provider = new JsonRpcProvider({ url: config.NEAR.RPC_URL });
        
        // Проверяем существует ли аккаунт отправителя
        try {
            await provider.query({
                request_type: 'view_account',
                account_id: accountId,
                finality: 'final'
            });
        } catch (error) {
            throw new Error(`Account ${accountId} does not exist. Please fund it first with NEAR tokens.`);
        }
        
        // Получаем nonce
        const accessKey = await provider.query({
            request_type: 'view_access_key',
            account_id: accountId,
            public_key: keyPair.getPublicKey().toString(),
            finality: 'final'
        });
        
        const nonce = BigInt(accessKey.nonce) + 1n;
        
        // Получаем последний блок
        const block = await provider.block({ finality: 'final' });
        const blockHash = Buffer.from(block.header.hash, 'base64');
        
        // Создаем транзакцию
        const transaction = new TransactionSchema({
            signerId: accountId,
            publicKey: keyPair.getPublicKey().data,
            nonce: nonce,
            receiverId: toAddress,
            blockHash: blockHash,
            actions: [new ActionSchema({
                transfer: new TransferActionSchema({
                    deposit: BigInt(Math.floor(amount * 1e24))
                })
            })]
        });
        
        // Сериализуем транзакцию
        const serializedTx = serialize(SCHEMA, transaction);
        
        // Подписываем транзакцию
        const signature = await sign(serializedTx, keyPair.secretKey);
        
        // Создаем подписанную транзакцию
        const signedTransaction = {
            transaction: transaction,
            signature: new Uint8Array([...signature])
        };
        
        // Отправляем транзакцию
        const result = await provider.sendJsonRpc('broadcast_tx_commit', [
            Buffer.from(serialize(new Map([
                ...SCHEMA,
                [Object, {
                    kind: 'struct',
                    fields: [
                        ['transaction', TransactionSchema],
                        ['signature', [64]]
                    ]
                }]
            ]), signedTransaction)).toString('base64')
        ]);
        
        if (result.status?.Failure) {
            throw new Error(`Transaction failed: ${JSON.stringify(result.status.Failure)}`);
        }
        
        const txHash = result.transaction?.hash || result.transaction_hash;
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.nearblocks.io/txns/${txHash}`
            : `https://nearblocks.io/txns/${txHash}`;
        
        return {
            success: true,
            hash: txHash,
            message: `Successfully sent ${amount} NEAR to ${toAddress}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// === BSC ===
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
            
            const tx = await wallet.sendTransaction({
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

// === УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ===
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