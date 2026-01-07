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

// Конфигурация сетей - ОБНОВЛЕНО для NEAR EVM
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
    TRON: {
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io'
    },
    NEAR_EVM: {
        RPC_URL: 'https://eth-rpc.mainnet.near.org',
        CHAIN_ID: 397,
        EXPLORER_URL: 'https://nearblocks.io'
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
    TRON: {
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io'
    },
    NEAR_EVM: {
        RPC_URL: 'https://eth-rpc.testnet.near.org',
        CHAIN_ID: 398,
        EXPLORER_URL: 'https://testnet.nearblocks.io'
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

// ========== TRON (TRX) - ИСПРАВЛЕННАЯ ВЕРСИЯ НА ОСНОВЕ СТАТЬИ ==========
// ВАЖНО: Установите tronweb: npm install tronweb
import TronWeb from 'tronweb';

// Функция для получения приватного ключа TRON из seed фразы (совместима с storageService)
const getTronPrivateKeyFromSeed = async (seedPhrase) => {
    try {
        // Используем тот же метод, что и в storageService для генерации адреса
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        // Используем ТОТ ЖЕ путь, что и в storageService.js для TRON: "m/44'/195'/0'/0/0"
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0");
        // Возвращаем приватный ключ без префикса '0x', как ожидает TronWeb
        return wallet.privateKey.slice(2);
    } catch (error) {
        console.error('Error deriving Tron private key:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        // Конфигурация TRON сетей
        const tronConfig = {
            mainnet: {
                fullNode: 'https://api.trongrid.io',
                solidityNode: 'https://api.trongrid.io',
                eventServer: 'https://api.trongrid.io'
            },
            testnet: {
                fullNode: 'https://api.shasta.trongrid.io',
                solidityNode: 'https://api.shasta.trongrid.io',
                eventServer: 'https://api.shasta.trongrid.io'
            }
        };
        
        const config = network === 'testnet' ? tronConfig.testnet : tronConfig.mainnet;
        const privateKey = await getTronPrivateKeyFromSeed(seedPhrase);

        // Инициализация TronWeb (как в статье)
        let HttpProvider = TronWeb.providers.HttpProvider;
        let fullNode = new HttpProvider(config.fullNode);
        let solidityNode = new HttpProvider(config.solidityNode);
        let eventServer = new HttpProvider(config.eventServer);

        let tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);
        
        // Получаем адрес отправителя из приватного ключа
        let fromAddress = TronWeb.address.fromPrivateKey(privateKey);
        
        let txid;
        
        if (contractAddress) {
            // Отправка TRC20 токена (например, USDT)
            // Получаем ABI контракта
            let {abi} = await tronWeb.trx.getContract(contractAddress);
            
            // Создаем обертку контракта
            let contract = await tronWeb.contract(abi, contractAddress);
            
            // Получаем decimals токена
            let decimals = 6; // по умолчанию для USDT
            try {
                decimals = await contract.decimals().call();
            } catch (e) {
                console.warn('Could not get decimals, using default 6');
            }
            
            // Конвертируем amount с учетом decimals
            let amountInUnits = Math.floor(amount * 10**decimals).toString();
            
            // Вызываем transfer функцию контракта
            let result = await contract.transfer(toAddress, amountInUnits).send({
                feeLimit: 100_000_000,
                from: fromAddress
            });
            txid = result;
        } else {
            // Отправка нативного TRX (как в статье)
            // Конвертируем сумму в SUN (1 TRX = 1,000,000 SUN)
            let amountInSun = tronWeb.toSun(amount.toString());
            
            // Создаем транзакцию
            let transaction = await tronWeb.transactionBuilder.sendTrx(
                toAddress,
                amountInSun,
                fromAddress
            );
            
            // Подписываем транзакцию
            let signedTransaction = await tronWeb.trx.sign(transaction, privateKey);
            
            // Отправляем транзакцию
            let result = await tronWeb.trx.sendRawTransaction(signedTransaction);
            
            if (!result.result) {
                throw new Error(`Transaction failed: ${JSON.stringify(result)}`);
            }
            txid = result.txid;
        }

        const explorerUrl = network === 'testnet'
            ? `https://shasta.tronscan.org/#/transaction/${txid}`
            : `https://tronscan.org/#/transaction/${txid}`;

        return {
            success: true,
            hash: txid,
            message: `Successfully sent ${amount} ${contractAddress ? 'USDT (TRC20)' : 'TRX'}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`[TRX ${network} ERROR]:`, error);
        throw new Error(`Failed to send TRX: ${error.message}`);
    }
};

// ========== NEAR EVM - ИСПРАВЛЕННАЯ ВЕРСИЯ ==========
// Функция для получения кошелька NEAR EVM из seed фразы
const getNearEvmWalletFromSeed = async (seedPhrase) => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        // Используем стандартный Ethereum путь для NEAR EVM
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        return {
            wallet,
            address: wallet.address
        };
    } catch (error) {
        console.error('Error getting NEAR EVM wallet from seed:', error);
        throw error;
    }
};

export const sendNearEvm = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        // Получаем кошелек из seed фразы
        const { wallet } = await getNearEvmWalletFromSeed(seedPhrase);
        
        const config = getConfig(network);
        // Используем Translator RPC
        const provider = new ethers.JsonRpcProvider(config.NEAR_EVM.RPC_URL);
        const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
        
        // Проверяем, что адрес получателя валидный EVM адрес
        if (!ethers.isAddress(toAddress)) {
            throw new Error('Invalid NEAR EVM address. Must be a valid Ethereum address (0x...).');
        }
        
        // Конвертируем amount в wei (1 NEAR для EVM = 10^18 wei)
        const amountInWei = ethers.parseEther(amount.toString());
        
        // Получаем текущий nonce
        const nonce = await provider.getTransactionCount(connectedWallet.address, 'latest');
        
        // Получаем актуальные данные о gas
        const feeData = await provider.getFeeData();
        
        // Формируем транзакцию для отправки нативного NEAR через EVM-совместимый интерфейс
        const tx = await connectedWallet.sendTransaction({
            to: toAddress,
            value: amountInWei,
            nonce: nonce,
            gasLimit: 21000, // Базовый лимит для простой транзакции
            maxFeePerGas: feeData.maxFeePerGas || feeData.gasPrice,
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || feeData.gasPrice,
            chainId: config.NEAR_EVM.CHAIN_ID, // Chain ID для NEAR EVM
            type: 2 // EIP-1559
        });
        
        const receipt = await tx.wait();
        
        const explorerUrl = network === 'testnet'
            ? `${config.NEAR_EVM.EXPLORER_URL}/txns/${receipt.hash}`
            : `${config.NEAR_EVM.EXPLORER_URL}/txns/${receipt.hash}`;
        
        return {
            success: true,
            hash: receipt.hash,
            message: `Successfully sent ${amount} NEAR via EVM-compatible interface`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            blockNumber: receipt.blockNumber
        };
        
    } catch (error) {
        console.error(`[NEAR EVM ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR via EVM interface: ${error.message}`);
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
            case 'Tron':
                // Используем исправленную функцию sendTrx
                result = await sendTrx({
                    toAddress,
                    amount,
                    seedPhrase,
                    contractAddress,
                    network
                });
                break;
            case 'NEAR':
                // Для NEAR EVM (Translator RPC) - только EVM адреса
                if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
                    throw new Error('Invalid NEAR EVM address. Must be a valid Ethereum address (0x...).');
                }
                result = await sendNearEvm({
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
            case 'Tron':
                try {
                    // Проверка TRON адресов: base58 (T...) или hex (41...)
                    const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$|^41[0-9a-fA-F]{40}$/;
                    return tronRegex.test(address);
                } catch { 
                    return false; 
                }
            case 'NEAR':
                // Для NEAR EVM - только Ethereum-совместимые адреса
                if (address.startsWith('0x') && address.length === 42) {
                    return ethers.isAddress(address);
                }
                return false;
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
        'Tron': { mainnet: '0.1', testnet: '0.01' },
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
    sendBtc,
    sendTrx,
    sendNearEvm,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};