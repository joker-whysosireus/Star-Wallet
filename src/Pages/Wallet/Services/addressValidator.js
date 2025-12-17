// Services/addressValidator.js
import { ethers } from 'ethers';
import { PublicKey, Connection } from '@solana/web3.js';

const API_KEYS = {
    TON: { API_KEY: 'ВАШ_КЛЮЧ' },
    ETHEREUM: { RPC_URL: 'https://mainnet.infura.io/v3/YOUR_KEY' },
    SOLANA: { RPC_URL: 'https://ВАШ_API_KEY.mainnet.rpc.helius.xyz' }
};

export const validateTonAddress = (address) => {
    try {
        const tonRegex = /^(?:0Q[A-Za-z0-9_-]{48}|0:[A-Fa-f0-9]{64}|E[A-Za-z0-9_-]{48})$/;
        return tonRegex.test(address);
    } catch (error) {
        return false;
    }
};

export const validateEthAddress = (address) => {
    try {
        return ethers.isAddress(address);
    } catch (error) {
        return false;
    }
};

export const validateSolanaAddress = (address) => {
    try {
        const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (!solanaRegex.test(address)) return false;
        
        new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
};

export const validateTronAddress = (address) => {
    try {
        const tronRegex = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
        return tronRegex.test(address);
    } catch (error) {
        return false;
    }
};

export const validateAddress = (address, blockchain) => {
    switch(blockchain) {
        case 'TON': return validateTonAddress(address);
        case 'Ethereum': return validateEthAddress(address);
        case 'Solana': return validateSolanaAddress(address);
        case 'Tron': return validateTronAddress(address);
        default: return true;
    }
};

export const checkAddressExists = async (address, blockchain) => {
    try {
        switch(blockchain) {
            case 'Ethereum': {
                const provider = new ethers.JsonRpcProvider(API_KEYS.ETHEREUM.RPC_URL);
                const [balance, code] = await Promise.all([
                    provider.getBalance(address),
                    provider.getCode(address)
                ]);
                return balance > 0 || code !== '0x';
            }
            
            case 'TON': {
                const response = await fetch('https://toncenter.com/api/v2/getAddressInformation', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-API-Key': API_KEYS.TON.API_KEY 
                    },
                    body: JSON.stringify({ address: address })
                });
                
                const data = await response.json();
                return data.ok === true;
            }
            
            case 'Solana': {
                const connection = new Connection(API_KEYS.SOLANA.RPC_URL);
                const publicKey = new PublicKey(address);
                const accountInfo = await connection.getAccountInfo(publicKey);
                return accountInfo !== null;
            }
            
            default:
                return true;
        }
    } catch (error) {
        console.error(`Error checking ${blockchain} address:`, error);
        return false;
    }
};