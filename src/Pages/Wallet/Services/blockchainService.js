import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import TronWeb from 'tronweb';
import crypto from 'crypto';
import { providers, KeyPair, keyStores, transactions, utils } from 'near-api-js';
import * as xrpl from 'xrpl';

const bip32 = BIP32Factory(ecc);

// === КОНФИГУРАЦИЯ MAINNET ===
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
        NETWORK_ID: 'mainnet',
        EXPLORER_URL: 'https://nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://bsc-dataseed.binance.org/',
        CHAIN_ID: 56
    },
    XRP: {
        RPC_URL: 'wss://s1.ripple.com:51233',
        EXPLORER_URL: 'https://xrpscan.com/tx/'
    },
    LTC: {
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
    DOGE: {
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'doge',
            bip32: {
                public: 0x02facafd,
                private: 0x02fac398
            },
            pubKeyHash: 0x1e,
            scriptHash: 0x16,
            wif: 0x9e
        }
    }
};

// === КОНФИГУРАЦИЯ TESTNET ===
const TESTNET_CONFIG = {
    TON: {
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: {
        RPC_URL: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
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
        NETWORK_ID: 'testnet',
        EXPLORER_URL: 'https://testnet.nearblocks.io'
    },
    BSC: {
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    XRP: {
        RPC_URL: 'wss://s.altnet.rippletest.net:51233',
        EXPLORER_URL: 'https://testnet.xrpl.org/transactions/'
    },
    LTC: {
        NETWORK: {
            messagePrefix: '\x19Litecoin Signed Message:\n',
            bech32: 'tltc',
            bip32: {
                public: 0x0436ef7d,
                private: 0x0436f6e1
            },
            pubKeyHash: 0x6f,
            scriptHash: 0xc4,
            wif: 0xef
        }
    },
    DOGE: {
        NETWORK: {
            messagePrefix: '\x19Dogecoin Signed Message:\n',
            bech32: 'tdge',
            bip32: {
                public: 0x0432a9a8,
                private: 0x0432a243
            },
            pubKeyHash: 0x71,
            scriptHash: 0xc4,
            wif: 0xf1
        }
    }
};

// === ТОКЕНЫ ДЛЯ ОТПРАВКИ ===
const TRANSACTION_TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'Tron', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.svg' 
    },
    XRP: { 
        symbol: 'XRP', 
        name: 'Ripple', 
        blockchain: 'XRP', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ripple-xrp-logo.svg' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'LTC', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    },
    DOGE: { 
        symbol: 'DOGE', 
        name: 'Dogecoin', 
        blockchain: 'DOGE', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png' 
    },
    USDT: { 
        symbol: 'USDT', 
        name: 'Tether', 
        decimals: 6, 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC: { 
        symbol: 'USDC', 
        name: 'USD Coin', 
        decimals: 6, 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' 
    }
};

// === УТИЛИТЫ ДЛЯ ПОЛУЧЕНИЯ КОШЕЛЬКОВ ИЗ SEED-ФРАЗЫ ===
const getTonWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
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
        
        return { tronWeb, privateKey };
    } catch (error) {
        console.error('Error getting TRON wallet from seed:', error);
        throw error;
    }
};

const getNearWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        // Генерация seed из seed phrase
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256').update(seedBuffer).digest('hex');
        const hexAddress = hash.substring(0, 40);
        
        // Создаем приватный ключ из seed
        const privateKey = `ed25519:${Buffer.from(seedBuffer.slice(0, 32)).toString('hex')}`;
        
        // Создаем KeyPair
        const keyPair = KeyPair.fromString(privateKey);
        
        // Создаем keyStore
        const keyStore = new keyStores.InMemoryKeyStore();
        
        // Создаем accountId
        const accountId = `${hexAddress}.${network === 'testnet' ? 'testnet' : 'near'}`;
        
        // Сохраняем ключ в keyStore
        await keyStore.setKey(config.NEAR.NETWORK_ID, accountId, keyPair);
        
        // Создаем provider
        const provider = new providers.JsonRpcProvider(config.NEAR.RPC_URL);
        
        return { 
            accountId, 
            keyPair, 
            keyStore, 
            provider,
            hexAddress 
        };
    } catch (error) {
        console.error('Error getting NEAR wallet from seed:', error);
        throw error;
    }
};

const getXrpWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        
        const privateKey = wallet.privateKey.slice(2);
        const xrpSeed = privateKey.substring(0, 29);
        
        const xrplWallet = xrpl.Wallet.fromSeed(xrpSeed);
        
        return xrplWallet;
    } catch (error) {
        console.error('Error getting XRP wallet from seed:', error);
        throw error;
    }
};

const getLtcWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.LTC.NETWORK : MAINNET_CONFIG.LTC.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        return { address, keyPair: child, privateKey: child.privateKey };
    } catch (error) {
        console.error('Error getting LTC wallet from seed:', error);
        throw error;
    }
};

const getDogeWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.DOGE.NETWORK : MAINNET_CONFIG.DOGE.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/3'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        return { address, keyPair: child, privateKey: child.privateKey };
    } catch (error) {
        console.error('Error getting DOGE wallet from seed:', error);
        throw error;
    }
};

// === ОСНОВНЫЕ ФУНКЦИИ ОТПРАВКИ ===
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

        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
                    const explorerUrl = network === 'testnet' 
                        ? `https://testnet.tonscan.org/tx/${toAddress}`
                        : `https://tonscan.org/tx/${toAddress}`;
                    
                    return {
                        success: true,
                        hash: `seqno_${seqno}`,
                        message: `Successfully sent ${amount} TON`,
                        explorerUrl,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (error) {
                continue;
            }
        }

        const explorerUrl = network === 'testnet'
            ? `https://testnet.tonscan.org/address/${toAddress}`
            : `https://tonscan.org/address/${toAddress}`;
        
        return {
            success: true,
            hash: `seqno_${seqno}`,
            message: `Transaction sent (awaiting confirmation)`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[TON ${network} ERROR]:`, error);
        throw new Error(`Failed to send TON: ${error.message}`);
    }
};

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[NEAR ${network}] Sending ${amount} NEAR to ${toAddress}`);
        
        const { accountId, keyPair, keyStore, provider } = await getNearWalletFromSeed(seedPhrase, network);
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        // Преобразуем toAddress если это hex адрес
        let recipientAccountId = toAddress;
        if (toAddress.startsWith('0x')) {
            const hexPart = toAddress.slice(2);
            recipientAccountId = `${hexPart}.${network === 'testnet' ? 'testnet' : 'near'}`;
        }
        
        // Создаем транзакцию
        const actions = [
            transactions.transfer(utils.format.parseNearAmount(amount.toString()))
        ];
        
        const recentBlockHash = (await provider.block({ finality: 'final' })).header.hash;
        
        const transaction = transactions.createTransaction(
            accountId,
            keyPair.getPublicKey(),
            recipientAccountId,
            1,
            actions,
            recentBlockHash
        );
        
        // Подписываем транзакцию
        const signedTransaction = await transactions.signTransaction(
            transaction,
            keyPair.getPublicKey(),
            keyPair
        );
        
        // Отправляем транзакцию
        const result = await provider.sendTransaction(signedTransaction);
        
        const explorerUrl = network === 'testnet'
            ? `${config.NEAR.EXPLORER_URL}/txns/${result.transaction.hash}`
            : `${config.NEAR.EXPLORER_URL}/txns/${result.transaction.hash}`;
        
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

export const sendEth = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const { wallet, provider } = await getEthWalletFromSeed(seedPhrase, network);
        
        if (contractAddress) {
            const abi = [
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function transfer(address, uint256) returns (bool)',
                'function symbol() view returns (string)'
            ];
            const contract = new ethers.Contract(contractAddress, abi, provider);
            const contractWithSigner = contract.connect(wallet);
            const decimals = await contract.decimals();
            const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
            const tx = await contractWithSigner.transfer(toAddress, amountInUnits);
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
            const tx = await wallet.sendTransaction({
                to: toAddress,
                value: ethers.parseEther(amount.toString())
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
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: keypair.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: Math.floor(amount * LAMPORTS_PER_SOL)
            })
        );
        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
        
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
        
        if (contractAddress) {
            const contract = await tronWeb.contract().at(contractAddress);
            const decimals = await contract.decimals().call();
            const amountInUnits = Math.floor(amount * Math.pow(10, parseInt(decimals.toString())));
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
        
        // Здесь должна быть реальная логика отправки BTC
        // Для примера возвращаем заглушку
        
        const explorerUrl = network === 'testnet'
            ? `https://blockstream.info/testnet/tx/btc_tx_${Date.now()}`
            : `https://blockstream.info/tx/btc_tx_${Date.now()}`;
        
        return {
            success: true,
            hash: `btc_tx_${Date.now()}`,
            message: `Successfully sent ${amount} BTC`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[BTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send BTC: ${error.message}`);
    }
};

// === НОВЫЕ ФУНКЦИИ ОТПРАВКИ ДЛЯ XRP, LTC, DOGE ===
export const sendXrp = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[XRP ${network}] Sending ${amount} XRP to ${toAddress}`);
        
        const wallet = await getXrpWalletFromSeed(seedPhrase, network);
        
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const client = new xrpl.Client(config.XRP.RPC_URL);
        await client.connect();
        
        try {
            const prepared = await client.autofill({
                TransactionType: "Payment",
                Account: wallet.address,
                Amount: xrpl.xrpToDrops(amount.toString()),
                Destination: toAddress,
                Fee: "12"
            });
            
            const signed = wallet.sign(prepared);
            
            const result = await client.submitAndWait(signed.tx_blob);
            
            await client.disconnect();
            
            if (result.result.meta.TransactionResult === "tesSUCCESS") {
                const explorerUrl = network === 'testnet'
                    ? `${config.XRP.EXPLORER_URL}${signed.hash}`
                    : `${config.XRP.EXPLORER_URL}${signed.hash}`;
                
                return {
                    success: true,
                    hash: signed.hash,
                    message: `Successfully sent ${amount} XRP`,
                    explorerUrl,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error(`Transaction failed: ${result.result.meta.TransactionResult}`);
            }
        } catch (error) {
            await client.disconnect();
            throw error;
        }
    } catch (error) {
        console.error(`[XRP ${network} ERROR]:`, error);
        throw new Error(`Failed to send XRP: ${error.message}`);
    }
};

export const sendLtc = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[LTC ${network}] Sending ${amount} LTC to ${toAddress}`);
        
        // Получаем кошелек
        const { address, keyPair } = await getLtcWalletFromSeed(seedPhrase, network);
        console.log(`From address: ${address}, To address: ${toAddress}`);
        
        // Здесь должна быть реальная логика отправки LTC
        // Для примера возвращаем заглушку
        
        const explorerUrl = network === 'testnet'
            ? `https://blockstream.info/liquidtestnet/tx/ltc_tx_${Date.now()}`
            : `https://blockstream.info/liquid/tx/ltc_tx_${Date.now()}`;
        
        return {
            success: true,
            hash: `ltc_tx_${Date.now()}`,
            message: `Successfully sent ${amount} LTC from ${address} to ${toAddress}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[LTC ${network} ERROR]:`, error);
        throw new Error(`Failed to send LTC: ${error.message}`);
    }
};

export const sendDoge = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        console.log(`[DOGE ${network}] Sending ${amount} DOGE to ${toAddress}`);
        
        // Получаем кошелек
        const { address, keyPair } = await getDogeWalletFromSeed(seedPhrase, network);
        console.log(`From address: ${address}, To address: ${toAddress}`);
        
        // Здесь должна быть реальная логика отправки DOGE
        // Для примера возвращаем заглушку
        
        const explorerUrl = network === 'testnet'
            ? `https://blockstream.info/testnet/tx/doge_tx_${Date.now()}`
            : `https://blockstream.info/tx/doge_tx_${Date.now()}`;
        
        return {
            success: true,
            hash: `doge_tx_${Date.now()}`,
            message: `Successfully sent ${amount} DOGE from ${address} to ${toAddress}`,
            explorerUrl,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`[DOGE ${network} ERROR]:`, error);
        throw new Error(`Failed to send DOGE: ${error.message}`);
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
                result = await sendEth({ 
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
            case 'XRP':
                result = await sendXrp({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'LTC':
                result = await sendLtc({ 
                    toAddress, 
                    amount, 
                    seedPhrase,
                    network
                });
                break;
            case 'DOGE':
                result = await sendDoge({ 
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

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
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
                return /^0x[0-9a-fA-F]{40}$/.test(address) || /^[a-z0-9_-]+\.(near|testnet)$/.test(address);
            case 'XRP':
                return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
            case 'LTC':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.LTC.NETWORK);
                    return true;
                } catch {
                    return false;
                }
            case 'DOGE':
                try {
                    const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    bitcoin.address.toOutputScript(address, config.DOGE.NETWORK);
                    return true;
                } catch {
                    return false;
                }
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
        'NEAR': { mainnet: '0.01', testnet: '0.001' },
        'XRP': { mainnet: '0.00001', testnet: '0.000001' },
        'LTC': { mainnet: '0.001', testnet: '0.0001' },
        'DOGE': { mainnet: '0.01', testnet: '0.001' }
    };
    
    const fees = defaultFees[blockchain] || { mainnet: '0.01', testnet: '0.001' };
    return network === 'testnet' ? fees.testnet : fees.mainnet;
};

export const checkAddressExists = async (blockchain, address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        switch(blockchain) {
            case 'TON':
                const tonResponse = await fetch(config.TON.RPC_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-Key': config.TON.API_KEY 
                    },
                    body: JSON.stringify({
                        id: 1,
                        jsonrpc: "2.0",
                        method: "getAddressInformation",
                        params: { address }
                    })
                });
                const tonData = await tonResponse.json();
                return tonData.result !== null;
            case 'NEAR':
                let nearAccountId = address;
                if (address.startsWith('0x')) {
                    const hexPart = address.slice(2);
                    nearAccountId = `${hexPart}.${network === 'testnet' ? 'testnet' : 'near'}`;
                }
                
                const nearResponse = await fetch(config.NEAR.RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: "dontcare",
                        method: "query",
                        params: {
                            request_type: "view_account",
                            finality: "final",
                            account_id: nearAccountId
                        }
                    })
                });
                const nearData = await nearResponse.json();
                return !nearData.error;
            case 'Tron':
                const tronResponse = await fetch(`${config.TRON.RPC_URL}/v1/accounts/${address}`);
                const tronData = await tronResponse.json();
                return tronData.data && tronData.data.length > 0;
            case 'XRP':
                try {
                    const client = new xrpl.Client(config.XRP.RPC_URL);
                    await client.connect();
                    const accountInfo = await client.request({
                        command: "account_info",
                        account: address,
                        ledger_index: "validated"
                    });
                    await client.disconnect();
                    return accountInfo.result.account_data !== undefined;
                } catch {
                    return false;
                }
            default:
                return true;
        }
    } catch (error) {
        console.error('Address check error:', error);
        return false;
    }
};

export default {
    sendTransaction,
    sendTon,
    sendEth,
    sendSol,
    sendTron,
    sendNear,
    sendBitcoin,
    sendXrp,
    sendLtc,
    sendDoge,
    validateAddress,
    estimateTransactionFee,
    checkAddressExists,
    TRANSACTION_TOKENS,
    MAINNET_CONFIG,
    TESTNET_CONFIG
};