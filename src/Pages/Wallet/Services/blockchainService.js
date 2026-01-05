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
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
        API_KEY: '9298de9d-5ebf-4b3b-a382-d99d35187c93'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
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
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        API_KEY: '9298de9d-5ebf-4b3b-a382-d99d35187c93'
    },
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
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

// ========== TON (не меняем) ==========
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

// ========== ETHEREUM (не меняем) ==========
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

// ========== SOLANA (не меняем) ==========
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

// ========== BSC (не меняем) ==========
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

// ========== TRON: ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем приватный ключ из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKeyHex = wallet.privateKey.substring(2);

        // ПРЯМОЙ ИМПОРТ TronWeb - используем window.TronWeb если доступен
        let TronWebConstructor;
        
        if (typeof window !== 'undefined' && window.TronWeb) {
            // Используем глобальный TronWeb если он уже загружен
            TronWebConstructor = window.TronWeb;
        } else {
            // Импортируем динамически
            try {
                const TronWebModule = await import('tronweb');
                TronWebConstructor = TronWebModule.default || TronWebModule;
                
                // Если это не конструктор, пробуем получить из глобального объекта
                if (typeof TronWebConstructor !== 'function') {
                    throw new Error('TronWeb is not a constructor');
                }
            } catch (importError) {
                console.error('Failed to import TronWeb:', importError);
                throw new Error('TronWeb library not available. Please make sure tronweb is installed.');
            }
        }

        // Создаем экземпляр TronWeb
        const tronWeb = new TronWebConstructor({
            fullHost: config.TRON.FULL_NODE,
            headers: { 
                "TRON-PRO-API-KEY": config.TRON.API_KEY,
                "Content-Type": "application/json" 
            }
        });

        // Генерируем адрес из приватного ключа
        const address = tronWeb.address.fromPrivateKey(privateKeyHex);
        
        // Устанавливаем приватный ключ и адрес
        tronWeb.setPrivateKey(privateKeyHex);
        tronWeb.setAddress(address);
        
        console.log(`TRON wallet initialized: ${address}`);
        return { 
            tronWeb, 
            address,
            privateKey: privateKeyHex 
        };
        
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw new Error(`TRON wallet initialization failed: ${error.message}`);
    }
};

export const sendTronNative = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { tronWeb, address: senderAddress } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Проверяем баланс отправителя
        const balance = await tronWeb.trx.getBalance(senderAddress);
        const balanceInTRX = tronWeb.fromSun(balance);
        
        console.log(`Sender balance: ${balanceInTRX} TRX`);
        
        // Отправка нативных TRX
        const amountInSun = tronWeb.toSun(amount);
        
        console.log(`Sending ${amount} TRX (${amountInSun} SUN) from ${senderAddress} to ${toAddress}`);
        
        if (balance < amountInSun) {
            throw new Error(`Insufficient TRX balance. Available: ${balanceInTRX}, Required: ${amount}`);
        }
        
        // Создаем и отправляем транзакцию
        const transaction = await tronWeb.transactionBuilder.sendTrx(
            toAddress,
            amountInSun,
            senderAddress
        );
        
        const signedTransaction = await tronWeb.trx.sign(transaction);
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
    } catch (error) {
        console.error(`[TRON Native ${network} ERROR]:`, error);
        throw new Error(`Failed to send native TRX: ${error.message}`);
    }
};

// ========== BITCOIN: ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getBitcoinWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, config.BITCOIN.NETWORK);
        const child = root.derivePath("m/84'/0'/0'/0/0"); // Путь для SegWit (bech32)
        
        // Генерируем P2WPKH адрес
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: config.BITCOIN.NETWORK
        });
        
        return { 
            keyPair: child, 
            network: config.BITCOIN.NETWORK,
            address: address 
        };
    } catch (error) {
        console.error('Error getting Bitcoin wallet from seed:', error);
        throw error;
    }
};

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { keyPair, network: btcNetwork, address: senderAddress } = await getBitcoinWalletFromSeed(seedPhrase, network);
        
        console.log(`Bitcoin sender address: ${senderAddress}, sending amount: ${amount} BTC, network: ${network}`);
        
        // 1. Получаем информацию об адресе для проверки баланса
        const addressInfoUrl = `${config.BITCOIN.EXPLORER_API}/address/${senderAddress}`;
        const addressInfoResponse = await fetch(addressInfoUrl);
        
        let addressBalance = 0;
        if (addressInfoResponse.ok) {
            const addressData = await addressInfoResponse.json();
            const funded = addressData.chain_stats?.funded_txo_sum || 0;
            const spent = addressData.chain_stats?.spent_txo_sum || 0;
            addressBalance = (funded - spent) / 1e8;
            console.log(`Address balance from API: ${addressBalance} BTC`);
        }
        
        // 2. Получаем UTXOs отправителя
        const utxoResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${senderAddress}/utxo`);
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        let utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error(`No UTXOs available. Address balance: ${addressBalance} BTC. Please fund it first.`);
        }
        
        // Фильтруем только подтвержденные UTXOs
        utxos = utxos.filter(utxo => utxo.status && utxo.status.confirmed === true);
        console.log(`Found ${utxos.length} confirmed UTXOs`);
        
        // 3. Создаем PSBT
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        // 4. Рассчитываем общий баланс и добавляем inputs
        let totalInput = 0;
        const selectedUtxos = [];
        const amountSats = Math.floor(amount * 100_000_000);
        
        // Сортируем UTXOs по значению (от большего к меньшему)
        utxos.sort((a, b) => b.value - a.value);
        
        for (const utxo of utxos) {
            try {
                // Получаем полную транзакцию для получения скрипта выхода
                const txHexResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/tx/${utxo.txid}/hex`);
                if (!txHexResponse.ok) continue;
                
                const txHex = await txHexResponse.text();
                const rawTx = bitcoin.Transaction.fromHex(txHex);
                
                // Получаем выход (output) по индексу vout
                const output = rawTx.outs[utxo.vout];
                
                // Создаем witnessUtxo
                const witnessUtxo = {
                    script: output.script,
                    value: utxo.value
                };
                
                // Добавляем input в PSBT
                psbt.addInput({
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: witnessUtxo
                });
                
                totalInput += utxo.value;
                selectedUtxos.push(utxo);
                
                // Оценочная комиссия
                const estimatedTxSize = selectedUtxos.length * 68 + 2 * 31 + 10;
                const feeRate = network === 'testnet' ? 1 : 2; // сатоши за байт
                const estimatedFee = Math.ceil(estimatedTxSize * feeRate);
                
                if (totalInput >= amountSats + estimatedFee) {
                    console.log(`Enough UTXOs selected: ${totalInput} sats`);
                    break;
                }
            } catch (error) {
                console.warn(`Error processing UTXO ${utxo.txid}:${utxo.vout}:`, error);
                continue;
            }
        }
        
        // Расчет комиссии
        const estimatedTxSize = selectedUtxos.length * 68 + 2 * 31 + 10;
        const feeRate = network === 'testnet' ? 1 : 2; // сатоши за байт
        const fee = Math.ceil(estimatedTxSize * feeRate);
        
        console.log(`Total input: ${totalInput} sats (${totalInput / 1e8} BTC), Amount: ${amountSats} sats (${amount} BTC), Fee: ${fee} sats (${fee / 1e8} BTC)`);
        
        if (totalInput < amountSats + fee) {
            throw new Error(`Insufficient balance. Available: ${(totalInput / 1e8).toFixed(8)} BTC, Needed: ${amount} BTC + fee (${fee / 1e8} BTC)`);
        }
        
        // 5. Добавляем output для получателя
        psbt.addOutput({
            address: toAddress,
            value: amountSats
        });
        
        // 6. Добавляем change output (сдача)
        const change = totalInput - amountSats - fee;
        if (change > 546) { // Минимальный выход 546 сатоши
            psbt.addOutput({
                address: senderAddress,
                value: change
            });
            console.log(`Change output: ${change} sats to ${senderAddress}`);
        } else {
            console.log(`Change too small (${change} sats), adding to fee`);
        }
        
        // 7. Подписываем все inputs
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        // 8. Финализируем и извлекаем транзакцию
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const txHex = tx.toHex();
        
        console.log(`Transaction created, size: ${txHex.length / 2} bytes`);
        
        // 9. Отправляем транзакцию
        const broadcastResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
            method: 'POST',
            body: txHex
        });
        
        if (!broadcastResponse.ok) {
            const errorText = await broadcastResponse.text();
            throw new Error(`Failed to broadcast transaction: ${broadcastResponse.status} - ${errorText}`);
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
        console.error(`[BITCOIN ${network} ERROR]:`, error);
        throw new Error(`Failed to send Bitcoin: ${error.message}`);
    }
};

// ========== NEAR: ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Генерируем приватный ключ из seed-фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/397'/0'/0'/0'"); // Путь для NEAR
        
        // Конвертируем приватный ключ в формат NEAR (ed25519)
        const privateKey = wallet.privateKey.substring(2);
        const keyPair = nearAPI.utils.KeyPair.fromString(
            `ed25519:${Buffer.from(privateKey, 'hex').toString('base64')}`
        );
        
        // Создаем хранилище ключей и добавляем ключевую пару
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        
        // Создаем accountId из публичного ключа
        const publicKey = keyPair.getPublicKey();
        const accountId = `${publicKey.toString().slice(8)}.${config.NEAR.NETWORK_ID === 'testnet' ? 'testnet' : 'near'}`;
        
        // Добавляем ключ в хранилище
        await keyStore.setKey(config.NEAR.NETWORK_ID, accountId, keyPair);
        
        // Конфигурация NEAR
        const nearConfig = {
            networkId: config.NEAR.NETWORK_ID,
            nodeUrl: config.NEAR.RPC_URL,
            walletUrl: `https://wallet.${config.NEAR.NETWORK_ID}.near.org`,
            helperUrl: config.NEAR.HELPER_URL,
            keyStore: keyStore,
        };
        
        // Подключаемся к NEAR
        const near = await nearAPI.connect(nearConfig);
        
        // Создаем объект аккаунта
        const account = new nearAPI.Account(near.connection, accountId);
        
        console.log(`NEAR account initialized: ${accountId}`);
        
        return { 
            near, 
            account,
            accountId,
            keyPair 
        };
        
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        // Возвращаем null вместо выброса ошибки, чтобы фронтенд мог обработать
        return null;
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const walletData = await getNearWalletFromSeed(seedPhrase, network);
        
        if (!walletData) {
            throw new Error('Failed to initialize NEAR wallet. Please check your seed phrase.');
        }
        
        const { account, accountId } = walletData;
        console.log(`Attempting to send ${amount} NEAR from ${accountId} to ${toAddress}`);
        
        // Конвертируем количество NEAR в йоктонеар
        const amountInYocto = nearAPI.utils.format.parseNearAmount(amount.toString());
        
        if (!amountInYocto) {
            throw new Error('Invalid amount format');
        }
        
        // Пытаемся отправить транзакцию
        const result = await account.sendMoney(
            toAddress,
            amountInYocto
        );
        
        // Формируем URL для explorer
        const explorerBase = network === 'testnet' 
            ? 'https://testnet.nearblocks.io/txns' 
            : 'https://nearblocks.io/txns';
        const explorerUrl = `${explorerBase}/${result.transaction.hash}`;
        
        return {
            success: true,
            hash: result.transaction.hash,
            message: `Successfully sent ${amount} NEAR`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        
        let errorMessage = error.message;
        if (error.message.includes('does not exist')) {
            errorMessage = `Account does not exist or has no balance. Please fund the account first.`;
        } else if (error.message.includes('NotEnoughBalance')) {
            errorMessage = `Insufficient NEAR balance.`;
        }
        
        throw new Error(`Failed to send NEAR: ${errorMessage}`);
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
                // Отправка нативного TRX (не USDT TRC20)
                result = await sendTronNative({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
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
                // Tron адреса начинаются с T (mainnet: 'T', testnet: 'T' для Shasta)
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
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
                // Для NEAR принимаем как EVM адреса (0x...), так и обычные NEAR аккаунты
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
    sendTronNative,
    sendBitcoin,
    sendNear,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};