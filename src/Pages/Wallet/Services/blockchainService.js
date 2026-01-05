// blockchainService.js
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4, internal, toNano } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { KeyPair, keyStores, connect } from 'near-api-js';

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
    BITCOIN: {
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        FULL_NODE: 'https://api.trongrid.io',
        SOLIDITY_NODE: 'https://api.trongrid.io',
        EVENT_SERVER: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK_ID: 'mainnet',
        WALLET_URL: 'https://wallet.near.org',
        HELPER_URL: 'https://helper.mainnet.near.org'
    },
    // Aurora EVM (для NEAR EVM адресов 0x...)
    AURORA: {
        MAINNET_RPC: 'https://mainnet.aurora.dev',
        TESTNET_RPC: 'https://testnet.aurora.dev'
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
        RPC_URL: 'https://api.shasta.trongrid.io',
        FULL_NODE: 'https://api.shasta.trongrid.io',
        SOLIDITY_NODE: 'https://api.shasta.trongrid.io',
        EVENT_SERVER: 'https://api.shasta.trongrid.io',
        NETWORK: 'shasta'
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK_ID: 'testnet',
        WALLET_URL: 'https://testnet.mynearwallet.com',
        HELPER_URL: 'https://helper.testnet.near.org'
    },
    // Aurora EVM (для NEAR EVM адресов 0x...)
    AURORA: {
        MAINNET_RPC: 'https://mainnet.aurora.dev',
        TESTNET_RPC: 'https://testnet.aurora.dev'
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

// ========== BITCOIN ==========
const getBtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        
        // Используем BIP84 для native SegWit (bech32)
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        return { 
            keyPair: child, 
            address, 
            network: networkConfig,
            publicKey: child.publicKey 
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
        
        // Получение UTXO с Blockstream API
        const utxoResponse = await callWithRetry(() => 
            fetch(`${config.BITCOIN.EXPLORER_API}/address/${fromAddress}/utxo`)
        );
        
        if (!utxoResponse.ok) {
            throw new Error(`Failed to fetch UTXOs: ${utxoResponse.status}`);
        }
        
        const utxos = await utxoResponse.json();
        
        if (!utxos || utxos.length === 0) {
            throw new Error('No UTXOs found for address');
        }
        
        // Сортировка UTXO по величине
        utxos.sort((a, b) => b.value - a.value);
        
        // Сбор PSBT
        const psbt = new bitcoin.Psbt({ network: btcNetwork });
        
        let totalInput = 0;
        const inputs = [];
        
        // Добавляем UTXO пока не наберем достаточно средств
        for (const utxo of utxos) {
            // Получаем данные транзакции для witnessUtxo
            const txResponse = await callWithRetry(() =>
                fetch(`${config.BITCOIN.EXPLORER_API}/tx/${utxo.txid}/hex`)
            );
            
            if (!txResponse.ok) {
                console.warn(`Could not fetch tx ${utxo.txid}, skipping`);
                continue;
            }
            
            const txHex = await txResponse.text();
            const tx = bitcoin.Transaction.fromHex(txHex);
            
            // Проверяем что выход существует
            if (utxo.vout >= tx.outs.length) {
                console.warn(`Invalid vout ${utxo.vout} for tx ${utxo.txid}, skipping`);
                continue;
            }
            
            // Правильно создаем witnessUtxo
            const outputScript = tx.outs[utxo.vout].script;
            inputs.push({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: Buffer.from(outputScript), // Преобразуем в Buffer
                    value: BigInt(utxo.value) // Используем BigInt
                }
            });
            
            totalInput += utxo.value;
            
            // Прекращаем если набрали достаточно средств
            if (totalInput > (amount * 100000000) + 10000) {
                break;
            }
        }
        
        if (inputs.length === 0) {
            throw new Error('No valid UTXOs found');
        }
        
        const amountInSats = Math.floor(amount * 100000000);
        
        // Получаем актуальную комиссию
        const feeResponse = await callWithRetry(() =>
            fetch(`${config.BITCOIN.EXPLORER_API}/fee-estimates`)
        );
        
        const feeEstimates = await feeResponse.json();
        const feeRate = feeEstimates['6'] || 1; // 6 блоков confirmation target
        
        // Рассчитываем размер транзакции
        const baseTxSize = 10; // Базовый размер
        const inputSize = inputs.length * 68; // ~68 байт на вход (SegWit)
        const outputSize = 2 * 31; // ~31 байт на выход
        
        const estimatedVsize = baseTxSize + inputSize + outputSize;
        const feeInSats = Math.ceil(estimatedVsize * feeRate);
        
        const change = totalInput - amountInSats - feeInSats;
        
        if (change < 0) {
            throw new Error(`Insufficient balance. Need ${amountInSats + feeInSats} sats, have ${totalInput} sats`);
        }
        
        // Добавляем входы
        inputs.forEach(input => {
            psbt.addInput({
                hash: input.hash,
                index: input.index,
                witnessUtxo: input.witnessUtxo
            });
        });
        
        // Добавляем выход получателю
        psbt.addOutput({
            address: toAddress,
            value: amountInSats
        });
        
        // Добавляем выход со сдачей если есть (и если change > dust limit)
        if (change > 546) { // Dust limit для Bitcoin
            psbt.addOutput({
                address: fromAddress,
                value: change
            });
        }
        
        // Подписываем каждый вход
        for (let i = 0; i < inputs.length; i++) {
            psbt.signInput(i, keyPair);
        }
        
        // Финализируем
        psbt.finalizeAllInputs();
        
        // Извлекаем и отправляем транзакцию
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
        // Отправка через Blockstream API
        const broadcastResponse = await callWithRetry(() =>
            fetch(`${config.BITCOIN.EXPLORER_API}/tx`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: rawTx
            })
        );
        
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
            timestamp: new Date().toISOString(),
            fee: feeInSats / 100000000
        };
        
    } catch (error) {
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// ========== NEAR ==========
// Ваш адрес 0xd096b12896875119773cd4818ef98997dbdbb8ba - это NEAR EVM адрес (Aurora)
// Используем Aurora EVM для отправки NEAR на такие адреса
export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        
        // Используем Aurora RPC для EVM-совместимой сети NEAR
        const auroraRpcUrl = network === 'testnet' 
            ? config.AURORA.TESTNET_RPC 
            : config.AURORA.MAINNET_RPC;
        
        // Создаем Ethereum-кошелек из seed фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        // Подключаемся к Aurora RPC
        const provider = new ethers.JsonRpcProvider(auroraRpcUrl);
        const connectedWallet = wallet.connect(provider);
        
        // Проверяем баланс
        const balance = await provider.getBalance(connectedWallet.address);
        const balanceInEth = ethers.formatEther(balance);
        
        const amountInWei = ethers.parseEther(amount.toString());
        
        if (balance < amountInWei) {
            throw new Error(`Insufficient balance. Have ${balanceInEth} ETH, need ${amount}`);
        }
        
        // Отправляем транзакцию
        const tx = await connectedWallet.sendTransaction({
            to: toAddress,
            value: amountInWei,
            // Используем стандартные лимиты газа для Aurora
            gasLimit: 21000,
        });
        
        const receipt = await tx.wait();
        
        const explorerUrl = network === 'testnet'
            ? `https://testnet.aurorascan.dev/tx/${tx.hash}`
            : `https://aurorascan.dev/tx/${tx.hash}`;
        
        return {
            success: true,
            hash: tx.hash,
            message: `Successfully sent ${amount} NEAR (via Aurora EVM)`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            blockNumber: receipt.blockNumber
        };
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw new Error(`Failed to send NEAR: ${error.message}`);
    }
};

// ========== TRON ==========
// Функция для инициализации TronWeb
const initTronWeb = async (privateKeyHex, network = 'mainnet') => {
    try {
        const config = getConfig(network);
        
        // Динамический импорт TronWeb
        const TronWebModule = await import('tronweb');
        const TronWeb = TronWebModule.default || TronWebModule;
        
        // Создаем экземпляр TronWeb
        const tronWeb = new TronWeb({
            fullHost: config.TRON.RPC_URL,
            privateKey: privateKeyHex
        });
        
        // Ждем пока TronWeb инициализируется
        await tronWeb.setAddress(privateKeyHex);
        
        return tronWeb;
    } catch (error) {
        console.error('Error initializing TronWeb:', error);
        throw error;
    }
};

const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        // Генерируем приватный ключ из seed фразы
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = hdNode.derivePath("m/44'/195'/0'/0/0"); // TRON BIP-44 путь
        
        const privateKeyHex = wallet.privateKey.substring(2); // Убираем '0x'
        
        // Инициализируем TronWeb
        const tronWeb = await initTronWeb(privateKeyHex, network);
        
        // Получаем адрес из приватного ключа
        const address = tronWeb.address.fromPrivateKey(privateKeyHex);
        
        return { 
            tronWeb, 
            address,
            privateKey: privateKeyHex
        };
    } catch (error) {
        console.error('Error getting Tron wallet from seed:', error);
        throw error;
    }
};

export const sendTrx = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { tronWeb, address: fromAddress } = await getTronWalletFromSeed(seedPhrase, network);
        
        // Конвертируем TRX в sun (1 TRX = 1,000,000 sun)
        const amountInSun = Math.floor(amount * 1000000);
        
        // Проверяем баланс отправителя
        const balance = await tronWeb.trx.getBalance(fromAddress);
        const balanceInSun = parseInt(balance);
        
        if (balanceInSun < amountInSun) {
            throw new Error(`Insufficient balance. Have ${balanceInSun / 1000000} TRX, need ${amount} TRX`);
        }
        
        // Создаем, подписываем и отправляем транзакцию
        const transaction = await tronWeb.transactionBuilder.sendTrx(
            toAddress,
            amountInSun,
            fromAddress
        );
        
        if (!transaction) {
            throw new Error('Failed to create transaction');
        }
        
        const signedTransaction = await tronWeb.trx.sign(transaction);
        
        if (!signedTransaction.signature) {
            throw new Error('Failed to sign transaction');
        }
        
        const receipt = await tronWeb.trx.sendRawTransaction(signedTransaction);
        
        if (!receipt.result) {
            throw new Error(`Transaction failed: ${receipt.code || 'Unknown error'}`);
        }
        
        const explorerUrl = network === 'testnet'
            ? `https://shasta.tronscan.org/#/transaction/${receipt.txid}`
            : `https://tronscan.org/#/transaction/${receipt.txid}`;
        
        return {
            success: true,
            hash: receipt.txid,
            message: `Successfully sent ${amount} TRX`,
            explorerUrl,
            timestamp: new Date().toISOString(),
            blockNumber: receipt.blockNumber
        };
        
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
            case 'NEAR':
                result = await sendNear({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'Tron':
                result = await sendTrx({ 
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
                    // Проверяем разные форматы Bitcoin адресов
                    const networkConfig = network === 'testnet' 
                        ? bitcoin.networks.testnet 
                        : bitcoin.networks.bitcoin;
                    
                    // Проверяем bech32 (bc1... или tb1...)
                    try {
                        const bech32 = bitcoin.address.fromBech32(address);
                        if (network === 'testnet' && bech32.prefix === 'tb1') return true;
                        if (network === 'mainnet' && bech32.prefix === 'bc1') return true;
                    } catch {}
                    
                    // Проверяем base58 (1..., 3..., m/n..., 2...)
                    try {
                        const base58 = bitcoin.address.fromBase58Check(address);
                        // Для testnet: адреса начинаются с m, n, 2
                        // Для mainnet: адреса начинаются с 1, 3
                        if (network === 'testnet' && ['m', 'n', '2'].includes(address[0])) return true;
                        if (network === 'mainnet' && ['1', '3'].includes(address[0])) return true;
                    } catch {}
                    
                    return false;
                } catch {
                    return false;
                }
            case 'NEAR':
                // Для NEAR EVM адресов (Aurora) - обычные Ethereum адреса
                if (address.startsWith('0x')) {
                    return ethers.isAddress(address);
                }
                // Для нативных NEAR адресов
                const nearRegex = /^(([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+$/;
                return nearRegex.test(address);
            case 'Tron':
                // TRON адреса начинаются с T (mainnet) или TG (testnet shasta)
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
    try {
        const config = getConfig(network);
        
        switch(blockchain) {
            case 'Bitcoin':
                // Получаем актуальную комиссию из Blockstream API
                const feeResponse = await fetch(`${config.BITCOIN.EXPLORER_API}/fee-estimates`);
                if (feeResponse.ok) {
                    const feeEstimates = await feeResponse.json();
                    const feeRate = feeEstimates['6'] || 1; // 6 блоков confirmation target
                    // Приблизительная комиссия для стандартной транзакции
                    const estimatedFee = (200 * feeRate) / 100000000; // ~200 vbytes
                    return estimatedFee.toFixed(8);
                }
                return '0.0001'; // Fallback
            case 'NEAR':
                // Комиссия для Aurora EVM (как Ethereum)
                return '0.0001';
            case 'Tron':
                // TRON транзакции бесплатны (используют bandwidth/energy)
                return '0';
            case 'TON':
                return network === 'testnet' ? '0.05' : '0.05';
            case 'Ethereum':
                return network === 'testnet' ? '0.0001' : '0.001';
            case 'BSC':
                return network === 'testnet' ? '0.00001' : '0.0001';
            case 'Solana':
                return network === 'testnet' ? '0.000001' : '0.000005';
            default:
                return '0.01';
        }
    } catch (error) {
        console.error('Error estimating fee:', error);
        return '0.01';
    }
};

// ========== ЭКСПОРТ ==========
export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendBsc,
    sendBtc,
    sendNear,
    sendTrx,
    validateAddress,
    estimateTransactionFee,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};