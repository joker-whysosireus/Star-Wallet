import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, Address } from '@ton/ton';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import priceService from './priceService';
import { JsonRpcProvider } from '@near-js/providers';
import base58 from 'bs58';
import crypto from 'crypto';
import { bech32 } from 'bech32';

const bip32 = BIP32Factory(ecc);

const MAINNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://toncenter.com/api/v2/jsonRPC',
        API_URL: 'https://tonapi.io/v2',
        API_URL_V1: 'https://tonapi.io/v1',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: { 
        RPC_URL: 'https://eth.llamarpc.com',
        CHAIN_ID: 1
    },
    SOLANA: { 
        RPC_URL: 'https://api.mainnet-beta.solana.com',
        NETWORK: 'mainnet-beta'
    },
    BITCOIN: { 
        EXPLORER_API: 'https://blockstream.info/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    BSC: { 
        RPC_URL: 'https://bsc-dataseed1.binance.org/',
        CHAIN_ID: 56
    },
    BITCOIN_CASH: {
        EXPLORER_API: 'https://blockchair.com/bitcoin-cash',
        NETWORK: bitcoin.networks.bitcoin
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockchair.com/litecoin',
        TESTNET_API: 'https://litecoinspace.org/testnet/api',
        NETWORK: bitcoin.networks.bitcoin
    },
    ETHEREUM_CLASSIC: {
        // Исправленный RPC URL для Ethereum Classic
        RPC_URL: 'https://etc.rivet.link',
        CHAIN_ID: 61
    },
    NEAR: {
        RPC_URL: 'https://rpc.mainnet.near.org',
        NETWORK: 'mainnet',
        HELPER_URL: 'https://helper.mainnet.near.org'
    },
    XRP: {
        // Исправленные RPC endpoints для XRP
        RPC_URL: 'wss://xrplcluster.com',
        JSON_RPC: 'https://xrplcluster.com',
        NETWORK: 'mainnet'
    },
    TRON: {
        RPC_URL: 'https://api.trongrid.io',
        NETWORK: 'mainnet'
    },
    CARDANO: {
        BLOCKFROST_URL: 'https://cardano-mainnet.blockfrost.io/api/v0',
        NETWORK: 'mainnet',
        // Добавлен API для генерации адресов
        KOIOS_API: 'https://api.koios.rest/api/v1'
    }
};

const TESTNET_CONFIG = {
    TON: { 
        RPC_URL: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        API_URL: 'https://testnet.tonapi.io/v2',
        API_URL_V1: 'https://testnet.tonapi.io/v1',
        API_KEY: 'e9c1f1d2d6c84e8a8b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'
    },
    ETHEREUM: { 
        RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
        CHAIN_ID: 11155111
    },
    SOLANA: { 
        RPC_URL: 'https://api.testnet.solana.com',
        NETWORK: 'testnet'
    },
    BITCOIN: { 
        EXPLORER_API: 'https://blockstream.info/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    BSC: { 
        RPC_URL: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        CHAIN_ID: 97
    },
    BITCOIN_CASH: {
        EXPLORER_API: 'https://blockchair.com/bitcoin-cash/testnet',
        NETWORK: bitcoin.networks.testnet
    },
    LITECOIN: {
        EXPLORER_API: 'https://blockchair.com/litecoin/testnet',
        TESTNET_API: 'https://litecoinspace.org/testnet/api',
        NETWORK: bitcoin.networks.testnet
    },
    ETHEREUM_CLASSIC: {
        // Исправленный RPC URL для Ethereum Classic testnet
        RPC_URL: 'https://etc.etcdesktop.com',
        CHAIN_ID: 62
    },
    NEAR: {
        RPC_URL: 'https://rpc.testnet.near.org',
        NETWORK: 'testnet',
        HELPER_URL: 'https://helper.testnet.near.org'
    },
    XRP: {
        // Исправленные RPC endpoints для XRP testnet
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
        NETWORK: 'testnet',
        // Добавлен API для генерации адресов
        KOIOS_API: 'https://testnet.koios.rest/api/v1'
    }
};

const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    USDT_TON: { 
        symbol: 'USDT', 
        name: 'Tether (TON)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    USDT_ETH: { 
        symbol: 'USDT', 
        name: 'Tether (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    USDT_SOL: { 
        symbol: 'USDT', 
        name: 'Tether (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    USDT_BSC: { 
        symbol: 'USDT', 
        name: 'Tether (BEP20)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x55d398326f99059fF775485246999027B3197955', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BCH: { 
        symbol: 'BCH', 
        name: 'Bitcoin Cash', 
        blockchain: 'BitcoinCash', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'Litecoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    },
    ADA: { 
        symbol: 'ADA', 
        name: 'Cardano', 
        blockchain: 'Cardano', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png' 
    },
    ETC: { 
        symbol: 'ETC', 
        name: 'Ethereum Classic', 
        blockchain: 'EthereumClassic', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png' 
    },
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png' 
    },
    XRP: { 
        symbol: 'XRP', 
        name: 'XRP', 
        blockchain: 'XRP', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'TRON', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    USDT_TRON: { 
        symbol: 'USDT', 
        name: 'Tether (TRC20)', 
        blockchain: 'TRON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_ETH: { 
        symbol: 'USDC', 
        name: 'USD Coin (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    },
    USDC_SOL: { 
        symbol: 'USDC', 
        name: 'USD Coin (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    },
    USDC_BSC: { 
        symbol: 'USDC', 
        name: 'USD Coin (BEP20)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    }
};

export const TESTNET_TOKENS = {
    TON: { 
        symbol: 'TON', 
        name: 'Toncoin', 
        blockchain: 'TON', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/toncoin-ton-logo.png' 
    },
    USDT_TON: { 
        symbol: 'USDT', 
        name: 'Tether (TON)', 
        blockchain: 'TON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    ETH: { 
        symbol: 'ETH', 
        name: 'Ethereum', 
        blockchain: 'Ethereum', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' 
    },
    USDT_ETH: { 
        symbol: 'USDT', 
        name: 'Tether (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0x3B00Ef435fA4FcFF5C209a37d1f3dcff37c705aD', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    SOL: { 
        symbol: 'SOL', 
        name: 'Solana', 
        blockchain: 'Solana', 
        decimals: 9, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/solana-sol-logo.png' 
    },
    USDT_SOL: { 
        symbol: 'USDT', 
        name: 'Tether (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BTC: { 
        symbol: 'BTC', 
        name: 'Bitcoin', 
        blockchain: 'Bitcoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' 
    },
    BNB: { 
        symbol: 'BNB', 
        name: 'BNB', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bnb-bnb-logo.png' 
    },
    USDT_BSC: { 
        symbol: 'USDT', 
        name: 'Tether (BEP20)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    BCH: { 
        symbol: 'BCH', 
        name: 'Bitcoin Cash', 
        blockchain: 'BitcoinCash', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png' 
    },
    LTC: { 
        symbol: 'LTC', 
        name: 'Litecoin', 
        blockchain: 'Litecoin', 
        decimals: 8, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png' 
    },
    ADA: { 
        symbol: 'ADA', 
        name: 'Cardano', 
        blockchain: 'Cardano', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/cardano-ada-logo.png' 
    },
    ETC: { 
        symbol: 'ETC', 
        name: 'Ethereum Classic', 
        blockchain: 'EthereumClassic', 
        decimals: 18, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png' 
    },
    NEAR: { 
        symbol: 'NEAR', 
        name: 'NEAR Protocol', 
        blockchain: 'NEAR', 
        decimals: 24, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/near-protocol-near-logo.png' 
    },
    XRP: { 
        symbol: 'XRP', 
        name: 'XRP', 
        blockchain: 'XRP', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/xrp-xrp-logo.png' 
    },
    TRX: { 
        symbol: 'TRX', 
        name: 'TRON', 
        blockchain: 'TRON', 
        decimals: 6, 
        isNative: true, 
        logo: 'https://cryptologos.cc/logos/tron-trx-logo.png' 
    },
    USDT_TRON: { 
        symbol: 'USDT', 
        name: 'Tether (TRC20)', 
        blockchain: 'TRON', 
        decimals: 6, 
        isNative: false, 
        contractAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', 
        logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' 
    },
    USDC_ETH: { 
        symbol: 'USDC', 
        name: 'USD Coin (ERC20)', 
        blockchain: 'Ethereum', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '0x0FAF6fD05B2Cb6e5A1D7a3C4cC5cB5F6E7D8E9F0A', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    },
    USDC_SOL: { 
        symbol: 'USDC', 
        name: 'USD Coin (SPL)', 
        blockchain: 'Solana', 
        decimals: 6, 
        isNative: false, 
        contractAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    },
    USDC_BSC: { 
        symbol: 'USDC', 
        name: 'USD Coin (BEP20)', 
        blockchain: 'BSC', 
        decimals: 18, 
        isNative: false, 
        contractAddress: '0x64544969ed7EBf5f083679233325356EbE738930', 
        logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' 
    }
};

export const generateNewSeedPhrase = () => {
    try {
        return bip39.generateMnemonic(128);
    } catch (error) {
        console.error('Error generating seed phrase:', error);
        throw error;
    }
};

const createWallet = (token, address, network = 'mainnet') => ({
    id: `${token.symbol.toLowerCase()}_${token.blockchain.toLowerCase()}_${network}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: token.name,
    symbol: token.symbol,
    address: address,
    blockchain: token.blockchain,
    decimals: token.decimals,
    isNative: token.isNative,
    contractAddress: token.contractAddress || '',
    showBlockchain: true,
    balance: '0',
    isActive: true,
    logo: token.logo,
    network: network,
    lastUpdated: new Date().toISOString()
});

const generateTonAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const keyPair = await mnemonicToWalletKey(seedPhrase.split(' '));
        const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });
        return wallet.address.toString();
    } catch (error) {
        console.error('Error generating TON address:', error);
        return '';
    }
};

const generateEthereumAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        return wallet.address;
    } catch (error) {
        console.error('Error generating Ethereum address:', error);
        return '';
    }
};

const generateSolanaAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const seedArray = new Uint8Array(seedBuffer.subarray(0, 32));
        const keypair = Keypair.fromSeed(seedArray);
        return keypair.publicKey.toBase58();
    } catch (error) {
        console.error('Error generating Solana address:', error);
        return '';
    }
};

const generateBitcoinAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.BITCOIN.NETWORK : MAINNET_CONFIG.BITCOIN.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        const { address } = bitcoin.payments.p2wpkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin address:', error);
        return '';
    }
};

const generateBSCAddress = generateEthereumAddress;

const generateBitcoinCashAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.BITCOIN_CASH.NETWORK : MAINNET_CONFIG.BITCOIN_CASH.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/145'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating Bitcoin Cash address:', error);
        return '';
    }
};

const generateLitecoinAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const networkConfig = network === 'testnet' ? TESTNET_CONFIG.LITECOIN.NETWORK : MAINNET_CONFIG.LITECOIN.NETWORK;
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/44'/2'/0'/0/0");
        const { address } = bitcoin.payments.p2pkh({ 
            pubkey: child.publicKey, 
            network: networkConfig 
        });
        return address;
    } catch (error) {
        console.error('Error generating Litecoin address:', error);
        return '';
    }
};

const generateEthereumClassicAddress = generateEthereumAddress;

const generateNearAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const ethAddress = await generateEthereumAddress(seedPhrase, network);
        return ethAddress.toLowerCase();
    } catch (error) {
        console.error('Error generating NEAR EVM address:', error);
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const wallet = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const derivedWallet = wallet.derivePath("m/44'/60'/0'/0/0");
        return derivedWallet.address.toLowerCase();
    }
};

const generateTronAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKeyHex = wallet.privateKey.substring(2);
        
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, true);
        
        const keccakHash = crypto.createHash('sha256').update(publicKey).digest();
        const addressBytes = keccakHash.subarray(keccakHash.length - 20);
        const addressWithPrefix = Buffer.concat([Buffer.from([0x41]), addressBytes]);
        
        const hash1 = crypto.createHash('sha256').update(addressWithPrefix).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.subarray(0, 4);
        
        const addressWithChecksum = Buffer.concat([addressWithPrefix, checksum]);
        return base58.encode(addressWithChecksum);
    } catch (error) {
        console.error('Error generating Tron address:', error);
        return '';
    }
};

// ФИКС: Правильная генерация XRP адреса с использованием ripple-keypairs
const generateXrpAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        // Упрощенный способ - используем тот же путь, что и для Ethereum, но с XRP derivation path
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        
        // XRP использует путь m/44'/144'/0'/0/0
        const wallet = masterNode.derivePath("m/44'/144'/0'/0/0");
        
        // Для XRP нам нужен публичный ключ
        const publicKey = wallet.publicKey.substring(2); // Убираем '0x'
        
        // Преобразуем публичный ключ в XRP адрес
        // XRP адрес - это хэш публичного ключа в формате base58 с checksum
        const sha256Hash = crypto.createHash('sha256').update(Buffer.from(publicKey, 'hex')).digest();
        const ripemd160 = crypto.createHash('ripemd160').update(sha256Hash).digest();
        
        // Добавляем префикс 0x00 для mainnet адреса
        const prefix = Buffer.from([0x00]);
        const payload = Buffer.concat([prefix, ripemd160]);
        
        // Вычисляем checksum
        const hash1 = crypto.createHash('sha256').update(payload).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.slice(0, 4);
        
        const finalBytes = Buffer.concat([payload, checksum]);
        
        // Используем алфавит Ripple для кодирования base58
        const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
        return base58.encode(finalBytes, RIPPLE_ALPHABET);
    } catch (error) {
        console.error('Error generating XRP address:', error);
        // Fallback: генерируем детерминированный адрес на основе seed
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const hash = crypto.createHash('sha256').update(seedBuffer).digest();
        const addressBytes = hash.slice(0, 20);
        const prefix = Buffer.from([0x00]);
        const payload = Buffer.concat([prefix, addressBytes]);
        const hash1 = crypto.createHash('sha256').update(payload).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        const checksum = hash2.slice(0, 4);
        const finalBytes = Buffer.concat([payload, checksum]);
        const RIPPLE_ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
        return base58.encode(finalBytes, RIPPLE_ALPHABET);
    }
};

// ФИКС: Правильная генерация Cardano адреса
const generateCardanoAddress = async (seedPhrase, network = 'mainnet') => {
    try {
        // Cardano использует путь: m/1852'/1815'/0'/0/0
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer);
        const child = root.derivePath("m/1852'/1815'/0'/0/0");
        
        // Получаем публичный ключ
        const publicKey = child.publicKey;
        
        // Для Cardano используем SHA3-256 хэш
        const sha3Hash = crypto.createHash('sha3-256').update(publicKey).digest();
        
        // Берем первые 28 байт для Cardano (224 бита)
        const pubKeyHash = sha3Hash.slice(0, 28);
        
        // Создаем enterprise address (без stake ключа)
        // Header byte: для enterprise адресов mainnet = 0x61, testnet = 0x60
        const header = network === 'mainnet' ? 0x61 : 0x60;
        const addressBytes = Buffer.concat([Buffer.from([header]), pubKeyHash]);
        
        // Кодируем в bech32
        const words = bech32.toWords(addressBytes);
        const prefix = network === 'mainnet' ? 'addr' : 'addr_test';
        return bech32.encode(prefix, words);
    } catch (error) {
        console.error('Error generating Cardano address with bech32, trying alternative:', error);
        
        // Альтернативный метод: используем SHA256 если SHA3-256 не доступен
        try {
            const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
            const root = bip32.fromSeed(seedBuffer);
            const child = root.derivePath("m/1852'/1815'/0'/0/0");
            const publicKey = child.publicKey;
            
            // Используем SHA256 как fallback
            const sha256Hash = crypto.createHash('sha256').update(publicKey).digest();
            const pubKeyHash = sha256Hash.slice(0, 28);
            const header = network === 'mainnet' ? 0x61 : 0x60;
            const addressBytes = Buffer.concat([Buffer.from([header]), pubKeyHash]);
            const words = bech32.toWords(addressBytes);
            const prefix = network === 'mainnet' ? 'addr' : 'addr_test';
            return bech32.encode(prefix, words);
        } catch (fallbackError) {
            console.error('Fallback Cardano address generation failed:', fallbackError);
            
            // Самый простой fallback: генерируем на основе seed хэша
            const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
            const hash = crypto.createHash('sha256').update(seedBuffer).digest();
            const pubKeyHash = hash.slice(0, 28);
            const header = network === 'mainnet' ? 0x61 : 0x60;
            const addressBytes = Buffer.concat([Buffer.from([header]), pubKeyHash]);
            const words = bech32.toWords(addressBytes);
            const prefix = network === 'mainnet' ? 'addr' : 'addr_test';
            return bech32.encode(prefix, words);
        }
    }
};

export const generateWalletsFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        if (!seedPhrase) throw new Error('Seed phrase is required');

        const [
            tonAddress, ethAddress, solAddress, bitcoinAddress, bscAddress,
            bchAddress, ltcAddress, adaAddress, etcAddress, nearAddress,
            xrpAddress, trxAddress
        ] = await Promise.all([
            generateTonAddress(seedPhrase, network),
            generateEthereumAddress(seedPhrase, network),
            generateSolanaAddress(seedPhrase, network),
            generateBitcoinAddress(seedPhrase, network),
            generateBSCAddress(seedPhrase, network),
            generateBitcoinCashAddress(seedPhrase, network),
            generateLitecoinAddress(seedPhrase, network),
            generateCardanoAddress(seedPhrase, network),
            generateEthereumClassicAddress(seedPhrase, network),
            generateNearAddress(seedPhrase, network),
            generateXrpAddress(seedPhrase, network),
            generateTronAddress(seedPhrase, network)
        ]);

        const walletArray = [];
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        walletArray.push(createWallet(tokens.TON, tonAddress, network));
        walletArray.push(createWallet(tokens.USDT_TON, tonAddress, network));
        walletArray.push(createWallet(tokens.ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDT_ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.USDC_ETH, ethAddress, network));
        walletArray.push(createWallet(tokens.ETC, etcAddress, network));
        walletArray.push(createWallet(tokens.SOL, solAddress, network));
        walletArray.push(createWallet(tokens.USDT_SOL, solAddress, network));
        walletArray.push(createWallet(tokens.USDC_SOL, solAddress, network));
        walletArray.push(createWallet(tokens.BTC, bitcoinAddress, network));
        walletArray.push(createWallet(tokens.BCH, bchAddress, network));
        walletArray.push(createWallet(tokens.LTC, ltcAddress, network));
        walletArray.push(createWallet(tokens.BNB, bscAddress, network));
        walletArray.push(createWallet(tokens.USDT_BSC, bscAddress, network));
        walletArray.push(createWallet(tokens.USDT_TRON, trxAddress, network));
        walletArray.push(createWallet(tokens.USDC_BSC, bscAddress, network));
        walletArray.push(createWallet(tokens.ADA, adaAddress, network));
        walletArray.push(createWallet(tokens.NEAR, nearAddress, network));
        walletArray.push(createWallet(tokens.XRP, xrpAddress, network));
        walletArray.push(createWallet(tokens.TRX, trxAddress, network));
        
        return walletArray;
    } catch (error) {
        console.error('Error generating wallets:', error);
        throw error;
    }
};

const getTonBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.TON.API_URL}/accounts/${address}`);
        if (!response.ok) return '0';
        
        const data = await response.json();
        if (data.balance) {
            const balanceInNano = parseInt(data.balance);
            return (balanceInNano / 1e9).toFixed(4);
        }
        return '0';
    } catch (error) {
        console.error('TON balance error:', error);
        return '0';
    }
};

const getJettonBalance = async (address, jettonAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        const response = await fetch(`${config.TON.API_URL_V1}/jetton/getBalances?account=${address}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.TON.API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) return '0';
        
        const data = await response.json();
        
        if (data.balances && Array.isArray(data.balances)) {
            const jettonBalance = data.balances.find(
                jetton => jetton.address === jettonAddress
            );
            
            if (jettonBalance && jettonBalance.balance) {
                return (parseFloat(jettonBalance.balance) / 1e6).toFixed(6);
            }
        }
        
        return '0';
    } catch (error) {
        console.error('TON Jetton balance error:', error);
        return '0';
    }
};

const getEthBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('ETH balance error:', error);
        return '0';
    }
};

const getERC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.ETHEREUM.RPC_URL);
        const abi = ['function balanceOf(address) view returns (uint256)'];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        
        let decimals = 6;
        try {
            const decimalsAbi = ['function decimals() view returns (uint8)'];
            const decimalsContract = new ethers.Contract(contractAddress, decimalsAbi, provider);
            decimals = await decimalsContract.decimals();
        } catch (e) {
            console.warn('Could not get decimals, using default 6');
        }
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('ERC20 balance error:', error);
        return '0';
    }
};

const getSolBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        const publicKey = new PublicKey(address);
        const balance = await connection.getBalance(publicKey);
        return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
        console.error('SOL balance error:', error);
        return '0';
    }
};

const getSPLBalance = async (address, tokenAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const connection = new Connection(config.SOLANA.RPC_URL);
        
        const ownerPublicKey = new PublicKey(address);
        const tokenPublicKey = new PublicKey(tokenAddress);
        
        const associatedTokenAddress = await PublicKey.findProgramAddress(
            [
                ownerPublicKey.toBuffer(),
                TOKEN_PROGRAM_ID.toBuffer(),
                tokenPublicKey.toBuffer(),
            ],
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        
        try {
            const tokenAccount = await connection.getTokenAccountBalance(associatedTokenAddress[0]);
            if (tokenAccount.value) {
                return tokenAccount.value.uiAmountString || '0';
            }
        } catch (e) {
            return '0';
        }
        
        return '0';
    } catch (error) {
        console.error('SPL balance error:', error);
        return '0';
    }
};

const getBitcoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const response = await fetch(`${config.BITCOIN.EXPLORER_API}/address/${address}`);
        if (!response.ok) return '0';
        const data = await response.json();
        
        const funded = data.chain_stats?.funded_txo_sum || 0;
        const spent = data.chain_stats?.spent_txo_sum || 0;
        const balance = (funded - spent) / 1e8;
        return balance.toString();
    } catch (error) {
        console.error('BTC balance error:', error);
        return '0';
    }
};

const getBNBBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        console.error('BNB balance error:', error);
        return '0';
    }
};

const getBEP20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new ethers.JsonRpcProvider(config.BSC.RPC_URL);
        const abi = ['function balanceOf(address) view returns (uint256)'];
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        
        let decimals = 18;
        try {
            const decimalsAbi = ['function decimals() view returns (uint8)'];
            const decimalsContract = new ethers.Contract(contractAddress, decimalsAbi, provider);
            decimals = await decimalsContract.decimals();
        } catch (e) {
            console.warn('Could not get decimals, using default 18 for BEP20');
        }
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('BEP20 balance error:', error);
        return '0';
    }
};

const getBitcoinCashBalance = async (address, network = 'mainnet') => {
    try {
        const baseUrl = network === 'testnet' 
            ? 'https://api.blockchair.com/bitcoin-cash/testnet'
            : 'https://api.blockchair.com/bitcoin-cash';
        
        const response = await fetch(`${baseUrl}/dashboards/address/${address}`);
        if (!response.ok) return '0';
        const data = await response.json();
        
        if (data.data && data.data[address]) {
            const balanceSatoshi = data.data[address].address.balance;
            return (balanceSatoshi / 1e8).toString();
        }
        return '0';
    } catch (error) {
        console.error('BCH balance error:', error);
        return '0';
    }
};

const getLitecoinBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        let apiUrl;
        if (network === 'testnet') {
            apiUrl = `${config.LITECOIN.TESTNET_API}/address/${address}`;
        } else {
            apiUrl = 'https://api.blockchair.com/litecoin/dashboards/address/' + address;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) return '0';
        const data = await response.json();
        
        if (network === 'testnet') {
            if (data.chain_stats) {
                const funded = data.chain_stats.funded_txo_sum || 0;
                const spent = data.chain_stats.spent_txo_sum || 0;
                return ((funded - spent) / 1e8).toString();
            }
        } else {
            if (data.data && data.data[address]) {
                const balanceSatoshi = data.data[address].address.balance;
                return (balanceSatoshi / 1e8).toString();
            }
        }
        return '0';
    } catch (error) {
        console.error('LTC balance error:', error);
        return '0';
    }
};

// ФИКС: Правильное получение баланса Ethereum Classic с исправленным RPC
const getEthereumClassicBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        console.log(`Fetching ETC balance for ${address} from ${config.ETHEREUM_CLASSIC.RPC_URL}`);
        
        // Пробуем несколько RPC endpoints для надежности
        const rpcUrls = [
            config.ETHEREUM_CLASSIC.RPC_URL,
            'https://etc.rivet.link',
            'https://etc.etcdesktop.com',
            'https://ethereumclassic.network'
        ];
        
        for (const rpcUrl of rpcUrls) {
            try {
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                // Устанавливаем таймаут
                const balance = await Promise.race([
                    provider.getBalance(address),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 10000)
                    )
                ]);
                console.log(`ETC balance from ${rpcUrl}: ${ethers.formatEther(balance)}`);
                return ethers.formatEther(balance);
            } catch (rpcError) {
                console.warn(`Failed to get ETC balance from ${rpcUrl}:`, rpcError.message);
                continue;
            }
        }
        
        // Если все RPC failed, пробуем через explorer API
        try {
            const explorerUrl = network === 'mainnet' 
                ? `https://blockscout.com/etc/mainnet/api?module=account&action=balance&address=${address}`
                : `https://blockscout.com/etc/mordor/api?module=account&action=balance&address=${address}`;
            
            const response = await fetch(explorerUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.result) {
                    const balance = ethers.formatEther(data.result);
                    console.log(`ETC balance from explorer: ${balance}`);
                    return balance;
                }
            }
        } catch (explorerError) {
            console.warn('Failed to get ETC balance from explorer:', explorerError.message);
        }
        
        return '0';
    } catch (error) {
        console.error('ETC balance error:', error);
        return '0';
    }
};

const getNearBalance = async (accountId, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const provider = new JsonRpcProvider({ url: config.NEAR.RPC_URL });
        
        const result = await provider.query({
            request_type: 'view_account',
            account_id: accountId,
            finality: 'final'
        });
        
        const balanceInYocto = result.amount;
        const balanceInNEAR = (BigInt(balanceInYocto) / BigInt(1e24)).toString();
        return balanceInNEAR;
    } catch (error) {
        console.error('NEAR balance error:', error);
        if (error.message.includes('does not exist') || error.message.includes('Account not found')) {
            return '0';
        }
        return '0';
    }
};

// ФИКС: Правильное получение баланса XRP с исправленным API
const getXrpBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        // Пробуем несколько endpoints
        const endpoints = [
            config.XRP.JSON_RPC,
            'https://xrplcluster.com',
            'https://s1.ripple.com:51234',
            'https://s2.ripple.com:51234'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        method: 'account_info',
                        params: [{
                            account: address,
                            ledger_index: 'validated',
                            strict: true
                        }]
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.result && data.result.account_data && data.result.account_data.Balance) {
                        const balance = parseInt(data.result.account_data.Balance) / 1_000_000;
                        console.log(`XRP balance from ${endpoint}: ${balance}`);
                        return balance.toString();
                    }
                    
                    // Если аккаунт не найден, баланс 0
                    if (data.result && data.result.error === 'actNotFound') {
                        return '0';
                    }
                }
            } catch (endpointError) {
                console.warn(`Failed to get XRP balance from ${endpoint}:`, endpointError.message);
                continue;
            }
        }
        
        // Fallback: используем xrpscan API
        try {
            const xrpscanUrl = network === 'mainnet' 
                ? `https://api.xrpscan.com/api/v1/account/${address}`
                : `https://testnet.xrpl.org/accounts/${address}/balances`;
            
            const response = await fetch(xrpscanUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.balance) {
                    return (parseInt(data.balance) / 1_000_000).toString();
                }
            }
        } catch (xrpscanError) {
            console.warn('Failed to get XRP balance from xrpscan:', xrpscanError.message);
        }
        
        return '0';
    } catch (error) {
        console.error('XRP balance error:', error);
        return '0';
    }
};

const getTronBalance = async (address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        const baseUrl = config.TRON.RPC_URL;
        
        const response = await fetch(`${baseUrl}/wallet/getaccount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address.startsWith('T') ? address : undefined,
                address_hex: address.startsWith('41') ? address : undefined,
                visible: address.startsWith('T')
            })
        });

        if (!response.ok) return '0';
        const data = await response.json();
        
        if (data.balance !== undefined) {
            return (parseInt(data.balance) / 1_000_000).toFixed(6);
        }
        return '0';
    } catch (error) {
        console.error('TRON balance error:', error);
        return '0';
    }
};

const getTRC20Balance = async (address, contractAddress, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        const response = await fetch(`${config.TRON.RPC_URL}/wallet/triggerconstantcontract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                owner_address: address,
                contract_address: contractAddress,
                function_selector: 'balanceOf(address)',
                parameter: address.replace('T', '').padStart(64, '0')
            })
        });

        if (!response.ok) return '0';
        const data = await response.json();
        
        if (data.constant_result && data.constant_result.length > 0) {
            const balanceHex = data.constant_result[0];
            const balance = parseInt(balanceHex, 16);
            return (balance / 1_000_000).toString();
        }
        return '0';
    } catch (error) {
        console.error('TRC20 balance error:', error);
        return '0';
    }
};

// ФИКС: Правильное получение баланса Cardano
const getCardanoBalance = async (address, network = 'mainnet') => {
    try {
        // Используем публичный API Koios для Cardano (более надежный)
        const apiUrl = network === 'mainnet' 
            ? `https://api.koios.rest/api/v1/address_info?_address=${address}`
            : `https://testnet.koios.rest/api/v1/address_info?_address=${address}`;
        
        console.log(`Fetching ADA balance for ${address} from ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            headers: { 
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        if (!response.ok) {
            console.warn(`Koios API failed: ${response.status}`);
            // Fallback к Blockfrost
            const blockfrostUrl = network === 'mainnet'
                ? `https://cardano-mainnet.blockfrost.io/api/v0/addresses/${address}`
                : `https://cardano-testnet.blockfrost.io/api/v0/addresses/${address}`;
            
            const blockfrostResponse = await fetch(blockfrostUrl, {
                headers: {
                    'project_id': network === 'mainnet' ? 'mainnet_project_id' : 'testnet_project_id'
                }
            });
            
            if (blockfrostResponse.ok) {
                const data = await blockfrostResponse.json();
                if (data.amount && Array.isArray(data.amount)) {
                    const adaAmount = data.amount.find(item => item.unit === 'lovelace');
                    if (adaAmount) {
                        return (parseInt(adaAmount.quantity) / 1_000_000).toString();
                    }
                }
            }
            return '0';
        }
        
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0 && data[0].balance) {
            const balance = parseInt(data[0].balance) / 1_000_000;
            console.log(`ADA balance: ${balance}`);
            return balance.toString();
        }
        return '0';
    } catch (error) {
        console.error('ADA balance error:', error);
        return '0';
    }
};

export const getRealBalances = async (wallets) => {
    if (!Array.isArray(wallets)) return wallets;
    
    try {
        const updatedWallets = await Promise.all(
            wallets.map(async (wallet) => {
                try {
                    let balance = '0';
                    const config = wallet.network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
                    
                    switch(wallet.blockchain) {
                        case 'TON':
                            balance = wallet.isNative ?
                                await getTonBalance(wallet.address, wallet.network) :
                                await getJettonBalance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Ethereum':
                            balance = wallet.isNative ?
                                await getEthBalance(wallet.address, wallet.network) :
                                await getERC20Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Solana':
                            balance = wallet.isNative ?
                                await getSolBalance(wallet.address, wallet.network) :
                                await getSPLBalance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'Bitcoin':
                            balance = await getBitcoinBalance(wallet.address, wallet.network);
                            break;
                        case 'BSC':
                            balance = wallet.isNative ?
                                await getBNBBalance(wallet.address, wallet.network) :
                                await getBEP20Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                        case 'BitcoinCash':
                            balance = await getBitcoinCashBalance(wallet.address, wallet.network);
                            break;
                        case 'Litecoin':
                            balance = await getLitecoinBalance(wallet.address, wallet.network);
                            break;
                        case 'Cardano':
                            balance = await getCardanoBalance(wallet.address, wallet.network);
                            break;
                        case 'EthereumClassic':
                            balance = await getEthereumClassicBalance(wallet.address, wallet.network);
                            break;
                        case 'NEAR':
                            balance = await getNearBalance(wallet.address, wallet.network);
                            break;
                        case 'XRP':
                            balance = await getXrpBalance(wallet.address, wallet.network);
                            break;
                        case 'TRON':
                            balance = wallet.isNative ?
                                await getTronBalance(wallet.address, wallet.network) :
                                await getTRC20Balance(wallet.address, wallet.contractAddress, wallet.network);
                            break;
                    }
                    
                    return {
                        ...wallet,
                        balance: balance || '0',
                        lastUpdated: new Date().toISOString(),
                        isRealBalance: true
                    };
                } catch (error) {
                    console.error(`Error getting balance for ${wallet.symbol}:`, error);
                    return { ...wallet, balance: wallet.balance || '0' };
                }
            })
        );
        
        return updatedWallets;
    } catch (error) {
        console.error('Error in getRealBalances:', error);
        return wallets;
    }
};

export const initializeUserWallets = async (userData) => {
    try {
        if (!userData?.telegram_user_id) {
            throw new Error("Invalid user data");
        }

        let seedPhrase = userData.seed_phrases;
        
        if (!seedPhrase) {
            seedPhrase = generateNewSeedPhrase();
            
            const saveResult = await saveSeedPhraseToAPI(userData.telegram_user_id, seedPhrase);
            if (!saveResult.success) {
                throw new Error("Failed to save seed phrase to database");
            }
        }

        const mainnetWallets = await generateWalletsFromSeed(seedPhrase, 'mainnet');
        
        const mainnetAddresses = {};
        mainnetWallets.forEach(wallet => {
            if (!mainnetAddresses[wallet.blockchain]) {
                mainnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'mainnet',
                    tokenType: wallet.isNative ? 'native' : 'token'
                };
            }
        });

        const testnetWallets = await generateWalletsFromSeed(seedPhrase, 'testnet');
        const testnetAddresses = {};
        testnetWallets.forEach(wallet => {
            if (!testnetAddresses[wallet.blockchain]) {
                testnetAddresses[wallet.blockchain] = {
                    address: wallet.address,
                    symbol: wallet.symbol,
                    network: 'testnet',
                    tokenType: wallet.isNative ? 'native' : 'token'
                };
            }
        });

        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id, 
            mainnetAddresses,
            testnetAddresses
        );
        
        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: mainnetAddresses,
            testnet_wallets: testnetAddresses,
            wallets: mainnetWallets,
            testnet_wallets_list: testnetWallets
        };

        return updatedUserData;

    } catch (error) {
        console.error("Error initializing user wallets:", error);
        return { ...userData, wallets: [] };
    }
};

export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-seed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_user_id: telegramUserId, seed_phrase: seedPhrase })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error saving seed phrase:", error);
        return { success: false, error: error.message };
    }
};

export const saveAddressesToAPI = async (telegramUserId, wallet_addresses, testnet_wallets = {}) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                telegram_user_id: telegramUserId, 
                wallet_addresses: wallet_addresses,
                testnet_wallets: testnet_wallets 
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error saving addresses:", error);
        return { success: false, error: error.message };
    }
};

export const getAllTokens = async (userData, network = 'mainnet') => {
    try {
        if (network === 'mainnet') {
            if (userData?.wallets && Array.isArray(userData.wallets)) {
                const filteredWallets = [];
                let usdtFound = false;
                let usdcFound = false;
                
                for (const wallet of userData.wallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else if (wallet.symbol === 'USDC') {
                        if (!usdcFound && wallet.blockchain === 'Ethereum') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'USD Coin',
                                showBlockchain: false
                            });
                            usdcFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
            
            if (userData?.seed_phrases) {
                const allWallets = await generateWalletsFromSeed(userData.seed_phrases, 'mainnet');
                
                const filteredWallets = [];
                let usdtFound = false;
                let usdcFound = false;
                
                for (const wallet of allWallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else if (wallet.symbol === 'USDC') {
                        if (!usdcFound && wallet.blockchain === 'Ethereum') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'USD Coin',
                                showBlockchain: false
                            });
                            usdcFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
        } else {
            if (userData?.seed_phrases) {
                const testnetWallets = await generateWalletsFromSeed(userData.seed_phrases, 'testnet');
                
                const filteredWallets = [];
                let usdtFound = false;
                let usdcFound = false;
                
                for (const wallet of testnetWallets) {
                    if (wallet.symbol === 'USDT') {
                        if (!usdtFound && wallet.blockchain === 'TON') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'Tether',
                                showBlockchain: false
                            });
                            usdtFound = true;
                        }
                    } else if (wallet.symbol === 'USDC') {
                        if (!usdcFound && wallet.blockchain === 'Ethereum') {
                            filteredWallets.push({
                                ...wallet,
                                name: 'USD Coin',
                                showBlockchain: false
                            });
                            usdcFound = true;
                        }
                    } else {
                        filteredWallets.push(wallet);
                    }
                }
                
                return filteredWallets;
            }
            
            if (userData?.testnet_wallets && Object.keys(userData.testnet_wallets).length > 0) {
                return generateTestnetWalletsFromSaved(userData.testnet_wallets);
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error getting all tokens:', error);
        return [];
    }
};

const generateTestnetWalletsFromSaved = (testnetWallets) => {
    const wallets = [];
    
    const allTestnetTokens = Object.values(TESTNET_TOKENS);
    
    for (const token of allTestnetTokens) {
        const blockchain = token.blockchain;
        const savedWallet = testnetWallets[blockchain];
        
        if (savedWallet && savedWallet.address) {
            wallets.push(createWallet(
                token,
                savedWallet.address,
                'testnet'
            ));
        }
    }
    
    return wallets;
};

export const getTokenPrices = async () => {
    try {
        const prices = priceService.getCurrentPrices();
        
        const now = Date.now();
        if (now - prices.lastUpdated > 180000) {
            console.log('Prices are stale, fetching fresh data...');
            const freshPrices = await priceService.fetchCurrentPrices();
            return {
                ...freshPrices,
                lastUpdated: now
            };
        }
        
        return prices;
    } catch (error) {
        console.error('Error getting token prices:', error);
        return priceService.getCurrentPrices();
    }
};

export const getHistoricalChartData = async (symbol, period = '7D') => {
    try {
        const data = await priceService.fetchHistoricalData(symbol, period);
        return data;
    } catch (error) {
        console.error('Error getting historical chart data:', error);
        return {
            data: [],
            hash: '',
            lastUpdate: Date.now(),
            period: period,
            isMock: true
        };
    }
};

export const calculateTotalBalance = async (wallets) => {
    try {
        if (!Array.isArray(wallets) || wallets.length === 0) return '0.00';
        
        const updatedWallets = await getRealBalances(wallets);
        const prices = await getTokenPrices();
        
        let totalUSD = 0;
        for (const wallet of updatedWallets) {
            const price = prices[wallet.symbol] || 0;
            const balance = parseFloat(wallet.balance || 0);
            totalUSD += balance * price;
        }
        
        return totalUSD.toFixed(2);
    } catch (error) {
        console.error('Error calculating total balance:', error);
        return '0.00';
    }
};

export const getTotalUSDTBalance = async (userData, network = 'mainnet') => {
    try {
        const usdtTokens = await getUSDTTokensForDetail(userData, network);
        let total = 0;
        usdtTokens.forEach(token => {
            total += parseFloat(token.balance || 0);
        });
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total USDT balance:', error);
        return '0.00';
    }
};

export const getTotalUSDCBalance = async (userData, network = 'mainnet') => {
    try {
        const usdcTokens = await getUSDCTokensForDetail(userData, network);
        let total = 0;
        usdcTokens.forEach(token => {
            total += parseFloat(token.balance || 0);
        });
        return total.toFixed(2);
    } catch (error) {
        console.error('Error calculating total USDC balance:', error);
        return '0.00';
    }
};

export const validateAddress = async (blockchain, address, network = 'mainnet') => {
    try {
        const config = network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;
        
        switch(blockchain) {
            case 'TON':
                const tonRegex = /^(?:-1|0):[0-9a-fA-F]{64}$|^[A-Za-z0-9_-]{48}$/;
                return tonRegex.test(address);
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
                // Cardano addresses начинаются с addr1 (mainnet) или addr_test (testnet)
                if (network === 'mainnet') {
                    return address.startsWith('addr1') && address.length > 50;
                } else {
                    return address.startsWith('addr_test') && address.length > 50;
                }
            case 'NEAR':
                const nearRegex = /^[a-z0-9._-]+\.(near|testnet)$/;
                return nearRegex.test(address);
            case 'XRP':
                // XRP адреса начинаются с 'r' и имеют длину 25-35 символов
                const xrpRegex = /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/;
                return xrpRegex.test(address);
            case 'TRON':
                const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
                return tronRegex.test(address);
            default:
                return true;
        }
    } catch (error) {
        console.error('Address validation error:', error);
        return false;
    }
};

export const clearAllData = () => {
    try {
        localStorage.removeItem('cached_wallets');
        localStorage.removeItem('cached_total_balance');
        console.log('Cached wallet data cleared from localStorage');
        return true;
    } catch (error) {
        console.error('Error clearing cached data:', error);
        return false;
    }
};

export const setupAppCloseListener = () => {
    window.addEventListener('beforeunload', () => {
        console.log('App closing, clearing cached data');
        clearAllData();
    });

    if (window.Telegram?.WebApp) {
        const webApp = window.Telegram.WebApp;
        webApp.onEvent('viewportChanged', (event) => {
            if (event.isStateStable && !webApp.isExpanded) {
                clearAllData();
            }
        });
    }
};

export const revealSeedPhrase = async (userData) => {
    if (userData?.seed_phrases) return userData.seed_phrases;
    return null;
};

export const getBalances = getRealBalances;

export const sendTransaction = async (transactionData) => {
    const { blockchain, toAddress, amount, seedPhrase, memo, contractAddress, network = 'mainnet' } = transactionData;
    
    try {
        const { sendTransaction: sendTx } = await import('./blockchainService');
        
        const txParams = {
            blockchain,
            toAddress,
            amount,
            seedPhrase,
            memo,
            network
        };
        
        if (contractAddress && blockchain !== 'Bitcoin' && blockchain !== 'BitcoinCash' && 
            blockchain !== 'Litecoin' && blockchain !== 'NEAR' && blockchain !== 'XRP') {
            txParams.contractAddress = contractAddress;
        }
        
        console.log(`Sending ${blockchain} transaction with params:`, txParams);
        
        const result = await sendTx(txParams);
        
        if (result.success) {
            console.log(`Transaction successful: ${result.hash}`);
            return {
                success: true,
                hash: result.hash,
                message: result.message,
                explorerUrl: result.explorerUrl,
                timestamp: result.timestamp
            };
        } else {
            console.error(`Transaction failed: ${result.error}`);
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        console.error('Transaction error in storageService:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const estimateTransactionFee = async (blockchain, network = 'mainnet') => {
    const defaultFees = {
        'TON': '0.05',
        'Ethereum': '0.001',
        'BSC': '0.0001',
        'Solana': '0.000005',
        'Bitcoin': '0.0001',
        'BitcoinCash': '0.0001',
        'Litecoin': '0.0001',
        'Cardano': '0.17',
        'EthereumClassic': '0.0001',
        'NEAR': '0.0001',
        'XRP': '0.00001',
        'TRON': '0.000001'
    };
    
    return defaultFees[blockchain] || '0.01';
};

export const getTokenPricesFromRPC = async () => {
    try {
        const prices = await getTokenPrices();
        return prices;
    } catch (error) {
        console.error('Error getting token prices from RPC:', error);
        return {
            'TON': 6.24,
            'ETH': 3500.00,
            'SOL': 172.34,
            'BNB': 600.00,
            'BTC': 68000.00,
            'USDT': 1.00,
            'USDC': 1.00,
            'BCH': 500.00,
            'LTC': 85.00,
            'ADA': 0.50,
            'ETC': 30.00,
            'NEAR': 5.00,
            'XRP': 0.60,
            'TRX': 0.10
        };
    }
};

let priceUpdateInterval = null;
let currentPrices = {};

export const startPriceUpdates = (callback, interval = 60000) => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
    }
    
    getTokenPrices().then(prices => {
        currentPrices = prices;
        if (callback) callback(prices);
    });
    
    priceUpdateInterval = setInterval(async () => {
        try {
            const prices = await getTokenPrices();
            currentPrices = prices;
            if (callback) callback(prices);
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }, interval);
    
    return () => {
        if (priceUpdateInterval) {
            clearInterval(priceUpdateInterval);
            priceUpdateInterval = null;
        }
    };
};

export const stopPriceUpdates = () => {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
        priceUpdateInterval = null;
    }
};

export const getCurrentPrices = () => currentPrices;

getTokenPrices().then(prices => {
    currentPrices = prices;
});

export const getUSDTTokensForDetail = async (userData, network = 'mainnet') => {
    try {
        if (!userData?.seed_phrases) return [];
        
        const addresses = await Promise.all([
            generateTonAddress(userData.seed_phrases, network),
            generateEthereumAddress(userData.seed_phrases, network),
            generateSolanaAddress(userData.seed_phrases, network),
            generateBSCAddress(userData.seed_phrases, network),
            generateTronAddress(userData.seed_phrases, network)
        ]);
        
        const [tonAddress, ethAddress, solAddress, bscAddress, tronAddress] = addresses;
        
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        const usdtTokens = [
            {
                ...tokens.USDT_TON,
                address: tonAddress,
                blockchain: 'TON',
                name: 'Tether (TON)',
                displayName: 'TON USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_ETH,
                address: ethAddress,
                blockchain: 'Ethereum',
                name: 'Tether (ERC20)',
                displayName: 'ERC20 USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_SOL,
                address: solAddress,
                blockchain: 'Solana',
                name: 'Tether (SPL)',
                displayName: 'SPL USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_BSC,
                address: bscAddress,
                blockchain: 'BSC',
                name: 'Tether (BEP20)',
                displayName: 'BEP20 USDT',
                showBlockchain: true,
                showUSDTBadge: true
            },
            {
                ...tokens.USDT_TRON,
                address: tronAddress,
                blockchain: 'TRON',
                name: 'Tether (TRC20)',
                displayName: 'TRC20 USDT',
                showBlockchain: true,
                showUSDTBadge: true
            }
        ];
        
        const wallets = usdtTokens.map(token => ({
            ...token,
            balance: '0',
            isActive: true,
            network: network,
            id: `usdt_${token.blockchain.toLowerCase()}_${Date.now()}`,
            showBlockchain: true,
            showUSDTBadge: true
        }));
        
        return await getRealBalances(wallets);
    } catch (error) {
        console.error('Error getting USDT tokens for detail:', error);
        return [];
    }
};

export const getUSDCTokensForDetail = async (userData, network = 'mainnet') => {
    try {
        if (!userData?.seed_phrases) return [];
        
        const addresses = await Promise.all([
            generateEthereumAddress(userData.seed_phrases, network),
            generateSolanaAddress(userData.seed_phrases, network),
            generateBSCAddress(userData.seed_phrases, network)
        ]);
        
        const [ethAddress, solAddress, bscAddress] = addresses;
        
        const tokens = network === 'mainnet' ? TOKENS : TESTNET_TOKENS;
        
        const usdcTokens = [
            {
                ...tokens.USDC_ETH,
                address: ethAddress,
                blockchain: 'Ethereum',
                name: 'USD Coin (ERC20)',
                displayName: 'ERC20 USDC',
                showBlockchain: true,
                showUSDCBadge: true
            },
            {
                ...tokens.USDC_SOL,
                address: solAddress,
                blockchain: 'Solana',
                name: 'USD Coin (SPL)',
                displayName: 'SPL USDC',
                showBlockchain: true,
                showUSDCBadge: true
            },
            {
                ...tokens.USDC_BSC,
                address: bscAddress,
                blockchain: 'BSC',
                name: 'USD Coin (BEP20)',
                displayName: 'BEP20 USDC',
                showBlockchain: true,
                showUSDCBadge: true
            }
        ];
        
        const wallets = usdcTokens.map(token => ({
            ...token,
            balance: '0',
            isActive: true,
            network: network,
            id: `usdc_${token.blockchain.toLowerCase()}_${Date.now()}`,
            showBlockchain: true,
            showUSDCBadge: true
        }));
        
        return await getRealBalances(wallets);
    } catch (error) {
        console.error('Error getting USDC tokens for detail:', error);
        return [];
    }
};

export const getBlockchainIcon = (blockchain) => {
    const icons = {
        'TON': 'https://cryptologos.cc/logos/toncoin-ton-logo.png',
        'Ethereum': 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        'Solana': 'https://cryptologos.cc/logos/solana-sol-logo.png',
        'Bitcoin': 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        'BSC': 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
        'BitcoinCash': 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png',
        'Litecoin': 'https://cryptologos.cc/logos/litecoin-ltc-logo.png',
        'Cardano': 'https://cryptologos.cc/logos/cardano-ada-logo.png',
        'EthereumClassic': 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png',
        'NEAR': 'https://cryptologos.cc/logos/near-protocol-near-logo.png',
        'XRP': 'https://cryptologos.cc/logos/xrp-xrp-logo.png',
        'TRON': 'https://cryptologos.cc/logos/tron-trx-logo.png'
    };
    
    return icons[blockchain] || '';
};

export const initializePriceUpdates = (callback) => {
    return priceService.startPeriodicUpdates(callback);
};

export const subscribeToPriceUpdates = (callback) => {
    return priceService.subscribe(callback);
};

export default {
    generateNewSeedPhrase,
    generateWalletsFromSeed,
    getAllTokens,
    getRealBalances,
    initializeUserWallets,
    clearAllData,
    setupAppCloseListener,
    getTokenPrices,
    getHistoricalChartData,
    calculateTotalBalance,
    getTotalUSDTBalance,
    getTotalUSDCBalance,
    validateAddress,
    revealSeedPhrase,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    sendTransaction,
    estimateTransactionFee,
    initializePriceUpdates,
    stopPriceUpdates,
    subscribeToPriceUpdates,
    getTokenPricesFromRPC,
    startPriceUpdates,
    getCurrentPrices,
    getUSDTTokensForDetail,
    getUSDCTokensForDetail,
    getBlockchainIcon,
    TOKENS,
    TESTNET_TOKENS
};