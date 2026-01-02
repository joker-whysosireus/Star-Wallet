import { mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4, TonClient, toNano, internal, beginCell } from '@ton/ton';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { ethers } from 'ethers';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';
import base58 from 'bs58';

const bip32 = BIP32Factory(ecc);

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getConfig = (network) => network === 'testnet' ? TESTNET_CONFIG : MAINNET_CONFIG;

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

const createJettonTransferBody = (toAddress, amount, responseAddress, forwardAmount = toNano('0.05'), comment = '') => {
    const forwardPayload = comment ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell() : new Cell();
    
    return beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(amount)
        .storeAddress(toAddress)
        .storeAddress(responseAddress)
        .storeBit(0)
        .storeCoins(forwardAmount)
        .storeBit(1)
        .storeRef(forwardPayload)
        .endCell();
};

export const sendTon = async ({ toAddress, amount, seedPhrase, comment = '', contractAddress = null, network = 'mainnet' }) => {
    try {
        console.log(`[TON ${network}] Sending ${amount} ${contractAddress ? 'USDT' : 'TON'} to ${toAddress}`);
        
        const { wallet, keyPair, client } = await getTonWalletFromSeed(seedPhrase, network);
        
        const seqno = await wallet.getSeqno();
        const amountInNano = toNano(amount);

        let transfer;
        
        if (contractAddress) {
            const config = getConfig(network);
            
            try {
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
                
                const jettonTransferBody = createJettonTransferBody(
                    toAddress,
                    amountInNano,
                    wallet.address,
                    toNano('0.05'),
                    comment
                );
                
                transfer = wallet.createTransfer({
                    seqno,
                    secretKey: keyPair.secretKey,
                    messages: [
                        internal({
                            to: jettonWalletAddress,
                            value: toNano('0.2'),
                            body: jettonTransferBody
                        })
                    ]
                });
            } catch (apiError) {
                console.warn('API error, trying alternative method:', apiError);
                throw new Error(`Failed to prepare jetton transfer: ${apiError.message}`);
            }
        } else {
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

        await wallet.send(transfer);

        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            await delay(2000);
            attempts++;
            
            try {
                const currentSeqno = await wallet.getSeqno();
                if (currentSeqno > seqno) {
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

const getTronWalletFromSeed = async (seedPhrase, network = 'mainnet') => {
    try {
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/195'/0'/0/0");
        const privateKey = wallet.privateKey.slice(2);
        
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

const signTronTransaction = (transaction, privateKeyHex) => {
    try {
        const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
        
        if (!transaction.raw_data_hex) {
            throw new Error('Missing raw_data_hex in transaction');
        }
        
        const rawDataBuffer = Buffer.from(transaction.raw_data_hex, 'hex');
        const hash = crypto.createHash('sha256').update(rawDataBuffer).digest();
        
        const signature = ecc.sign(hash, privateKeyBuffer);
        
        return {
            ...transaction,
            signature: [Buffer.from(signature).toString('hex')]
        };
    } catch (error) {
        console.error('Error signing TRON transaction:', error);
        throw error;
    }
};

export const sendTron = async ({ toAddress, amount, seedPhrase, contractAddress = null, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const { privateKey, address } = await getTronWalletFromSeed(seedPhrase, network);
        
        const amountInSun = Math.floor(amount * 1_000_000);
        
        if (contractAddress) {
            const toAddressHex = toAddress.startsWith('T') 
                ? base58.decode(toAddress).slice(1, 21).toString('hex')
                : toAddress.slice(2);
            
            const parameter = toAddressHex.padStart(64, '0') + amountInSun.toString(16).padStart(64, '0');
            
            const createResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/triggersmartcontract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_address: address,
                    contract_address: contractAddress,
                    function_selector: 'transfer(address,uint256)',
                    parameter: parameter,
                    fee_limit: 100_000_000,
                    call_value: 0,
                    visible: true
                })
            });
            
            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`Failed to create TRC20 transaction: ${errorText}`);
            }
            
            let transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            if (!transaction.raw_data_hex && transaction.raw_data) {
                transaction.raw_data_hex = Buffer.from(JSON.stringify(transaction.raw_data)).toString('hex');
            }
            
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            if (!broadcastResponse.ok) {
                const errorText = await broadcastResponse.text();
                throw new Error(`Failed to broadcast transaction: ${errorText}`);
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
                const errorText = await createResponse.text();
                throw new Error(`Failed to create TRX transaction: ${errorText}`);
            }
            
            let transaction = await createResponse.json();
            
            if (transaction.Error) {
                throw new Error(transaction.Error);
            }
            
            if (!transaction.raw_data_hex && transaction.raw_data) {
                transaction.raw_data_hex = Buffer.from(JSON.stringify(transaction.raw_data)).toString('hex');
            }
            
            const signedTransaction = signTronTransaction(transaction, privateKey);
            
            const broadcastResponse = await fetch(`${config.TRON.FULL_NODE}/wallet/broadcasttransaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signedTransaction)
            });
            
            if (!broadcastResponse.ok) {
                const errorText = await broadcastResponse.text();
                throw new Error(`Failed to broadcast transaction: ${errorText}`);
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

export const sendBitcoin = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        const networkConfig = config.BITCOIN.NETWORK;
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const root = bip32.fromSeed(seedBuffer, networkConfig);
        const child = root.derivePath("m/84'/0'/0'/0/0");
        
        const { address: fromAddress } = bitcoin.payments.p2wpkh({
            pubkey: child.publicKey,
            network: networkConfig
        });
        
        const response = await fetch(`${config.BITCOIN.EXPLORER_URL}/address/${fromAddress}/utxo`);
        if (!response.ok) throw new Error('Failed to fetch UTXOs');
        
        const utxos = await response.json();
        if (utxos.length === 0) throw new Error('No UTXOs found for address');
        
        const psbt = new bitcoin.Psbt({ network: networkConfig });
        
        let totalInput = 0;
        const selectedUtxos = [];
        
        for (const utxo of utxos) {
            if (totalInput >= amount * 1e8 * 1.2) break;
            selectedUtxos.push(utxo);
            totalInput += utxo.value;
        }
        
        if (selectedUtxos.length === 0) {
            throw new Error('No suitable UTXOs found');
        }
        
        const amountInSatoshi = Math.floor(amount * 1e8);
        const estimatedSize = (selectedUtxos.length * 68) + 31 + 4 + 34;
        const feeRate = 2;
        const fee = estimatedSize * feeRate;
        
        if (totalInput < amountInSatoshi + fee) {
            throw new Error(`Insufficient balance. Need: ${(amountInSatoshi + fee) / 1e8} BTC, Have: ${totalInput / 1e8} BTC`);
        }
        
        const change = totalInput - amountInSatoshi - fee;
        
        for (const utxo of selectedUtxos) {
            const script = bitcoin.address.toOutputScript(fromAddress, networkConfig);
            
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                witnessUtxo: {
                    script: script,
                    value: utxo.value
                }
            });
        }
        
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
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            psbt.signInput(i, child);
        }
        
        for (let i = 0; i < selectedUtxos.length; i++) {
            if (!psbt.validateSignaturesOfInput(i)) {
                throw new Error(`Invalid signature for input ${i}`);
            }
        }
        
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        const rawTx = tx.toHex();
        
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

export const sendNear = async ({ toAddress, amount, seedPhrase, network = 'mainnet' }) => {
    try {
        const config = getConfig(network);
        
        const seedBuffer = await bip39.mnemonicToSeed(seedPhrase);
        const masterNode = ethers.HDNodeWallet.fromSeed(seedBuffer);
        const wallet = masterNode.derivePath("m/44'/60'/0'/0/0");
        const senderAddress = wallet.address.toLowerCase();
        
        throw new Error(`Account ${senderAddress}.${network === 'testnet' ? 'testnet' : 'near'} does not exist. Please fund it first with NEAR tokens.`);
        
    } catch (error) {
        console.error(`[NEAR ${network} ERROR]:`, error);
        throw error;
    }
};

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