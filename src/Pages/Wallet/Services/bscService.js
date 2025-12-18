import { ethers } from 'ethers';
import * as bip39 from 'bip39';

// BSC Mainnet конфигурация
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org/';
const BSC_CHAIN_ID = 56;
const BSCSCAN_API_KEY = '8X9S7Q8J4T5V3C2W1B5N6M7P8Q9R0T1U2V3W4X5Y6Z7A8B9C0D1E2F3G4H5';

/**
 * Получение кошелька BSC из приватного ключа
 */
const getBSCWalletFromPrivateKey = (privateKey) => {
    try {
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, {
            chainId: BSC_CHAIN_ID,
            name: 'bsc'
        });
        
        const wallet = new ethers.Wallet(privateKey, provider);
        return { wallet, provider };
    } catch (error) {
        console.error('Error getting BSC wallet from private key:', error);
        throw error;
    }
};

/**
 * Получение кошелька BSC из seed фразы
 */
const getBSCWalletFromSeedPhrase = (seedPhrase) => {
    try {
        const seed = bip39.mnemonicToSeedSync(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, {
            chainId: BSC_CHAIN_ID,
            name: 'bsc'
        });
        
        const connectedWallet = wallet.connect(provider);
        return { wallet: connectedWallet, provider };
    } catch (error) {
        console.error('Error getting BSC wallet from seed phrase:', error);
        throw error;
    }
};

/**
 * Реальная отправка BNB на mainnet
 */
export const sendBNBReal = async ({ toAddress, amount, privateKey }) => {
    try {
        console.log(`[BSC MAINNET] Sending ${amount} BNB to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !privateKey) {
            throw new Error('Invalid parameters for mainnet');
        }

        if (!ethers.isAddress(toAddress)) {
            throw new Error('Invalid BSC address for mainnet');
        }

        const { wallet, provider } = getBSCWalletFromPrivateKey(privateKey);
        
        // Проверяем баланс
        const balance = await provider.getBalance(wallet.address);
        const balanceInBNB = parseFloat(ethers.formatEther(balance));
        
        console.log(`Mainnet current balance: ${balanceInBNB} BNB`);
        
        if (parseFloat(amount) > balanceInBNB) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInBNB} BNB`);
        }

        // Получаем данные о газе
        const feeData = await provider.getFeeData();
        
        // Создаем транзакцию
        const tx = {
            to: toAddress,
            value: ethers.parseEther(amount.toString()),
            gasLimit: 21000,
            gasPrice: feeData.gasPrice || await provider.getGasPrice(),
            chainId: BSC_CHAIN_ID,
        };

        console.log('Signing and sending mainnet transaction...');
        
        // Подписываем и отправляем транзакцию
        const txResponse = await wallet.sendTransaction(tx);
        
        console.log(`Mainnet transaction sent. Hash: ${txResponse.hash}`);
        
        console.log('Waiting for mainnet confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(`Mainnet transaction confirmed in block ${receipt?.blockNumber}`);
        
        return {
            success: true,
            hash: txResponse.hash,
            message: `Successfully sent ${amount} BNB to ${toAddress} on mainnet`,
            explorerUrl: `https://bscscan.com/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber,
            gasUsed: receipt?.gasUsed?.toString(),
            status: receipt?.status === 1 ? 'success' : 'failed'
        };

    } catch (error) {
        console.error('[BSC MAINNET ERROR]:', error);
        throw new Error(`BNB mainnet send failed: ${error.message}`);
    }
};

/**
 * Реальная отправка BEP20 токена на mainnet
 */
export const sendBEP20Real = async ({ contractAddress, toAddress, amount, privateKey }) => {
    try {
        console.log(`[BSC MAINNET] Sending ${amount} BEP20 to ${toAddress}`);
        
        if (!contractAddress || !toAddress || !amount || parseFloat(amount) <= 0 || !privateKey) {
            throw new Error('Invalid parameters for mainnet');
        }

        if (!ethers.isAddress(contractAddress) || !ethers.isAddress(toAddress)) {
            throw new Error('Invalid BSC address for mainnet');
        }

        const { wallet, provider } = getBSCWalletFromPrivateKey(privateKey);
        
        // ABI BEP20 токена
        const abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function symbol() view returns (string)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const contractWithSigner = contract.connect(wallet);
        
        // Получаем decimals токена
        let tokenDecimals = 18;
        try {
            tokenDecimals = await contract.decimals();
        } catch (error) {
            console.warn('Could not get token decimals, using default:', tokenDecimals);
        }
        
        // Проверяем баланс
        const balance = await contract.balanceOf(wallet.address);
        const balanceInUnits = ethers.formatUnits(balance, tokenDecimals);
        
        console.log(`Mainnet token balance: ${balanceInUnits}`);
        
        const amountInUnits = ethers.parseUnits(amount.toString(), tokenDecimals);
        
        if (balance < amountInUnits) {
            throw new Error(`Insufficient token balance on mainnet. Available: ${balanceInUnits}`);
        }
        
        // Получаем символ токена
        let tokenSymbol = 'BEP20';
        try {
            tokenSymbol = await contract.symbol();
        } catch (error) {
            console.warn('Could not get token symbol');
        }
        
        // Получаем данные о газе
        const feeData = await provider.getFeeData();
        
        // Оцениваем газ
        const gasEstimate = await contractWithSigner.transfer.estimateGas(
            toAddress, 
            amountInUnits
        );
        
        console.log('Signing and sending mainnet BEP20 transaction...');
        
        // Отправляем транзакцию
        const txResponse = await contractWithSigner.transfer(toAddress, amountInUnits, {
            gasLimit: gasEstimate.mul(120).div(100),
            gasPrice: feeData.gasPrice || await provider.getGasPrice()
        });
        
        console.log(`Mainnet BEP20 transaction sent. Hash: ${txResponse.hash}`);
        
        console.log('Waiting for mainnet confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(`Mainnet BEP20 transaction confirmed in block ${receipt?.blockNumber}`);
        
        return {
            success: true,
            hash: txResponse.hash,
            message: `Successfully sent ${amount} ${tokenSymbol} to ${toAddress} on mainnet`,
            explorerUrl: `https://bscscan.com/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber,
            tokenSymbol: tokenSymbol
        };

    } catch (error) {
        console.error('[BSC MAINNET BEP20 ERROR]:', error);
        throw new Error(`BEP20 mainnet send failed: ${error.message}`);
    }
};

/**
 * Получение баланса BNB
 */
export const getBNBBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, {
            chainId: BSC_CHAIN_ID,
            name: 'bsc'
        });
        
        const balance = await provider.getBalance(address);
        const balanceInBNB = ethers.formatEther(balance);
        
        console.log(`BNB balance for ${address}: ${balanceInBNB}`);
        return parseFloat(balanceInBNB).toFixed(6);
    } catch (error) {
        console.error('Error getting BNB balance:', error);
        return '0.000000';
    }
};

/**
 * Получение баланса BEP20 токена
 */
export const getBEP20Balance = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(BSC_RPC_URL, {
            chainId: BSC_CHAIN_ID,
            name: 'bsc'
        });
        
        const abi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error getting BEP20 balance:', error);
        return '0';
    }
};

/**
 * Валидация BSC адреса
 */
export const validateBSCAddress = (address) => {
    return ethers.isAddress(address);
};

/**
 * Получение истории транзакций BSC
 */
export const getBSCTransactionHistory = async (address, symbol, contractAddress = null) => {
    try {
        let url;
        
        if (symbol === 'BNB') {
            url = `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${BSCSCAN_API_KEY}`;
        } else if (contractAddress) {
            url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${contractAddress}&address=${address}&page=1&offset=10&sort=desc&apikey=${BSCSCAN_API_KEY}`;
        } else {
            return [];
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1' && data.result) {
            return data.result.map(tx => ({
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp) * 1000,
                type: tx.to.toLowerCase() === address.toLowerCase() ? 'incoming' : 'outgoing',
                amount: (parseFloat(tx.value) / Math.pow(10, 18)).toString(),
                symbol: symbol,
                address: tx.from === address ? tx.to : tx.from,
                status: 'confirmed',
                explorerUrl: `https://bscscan.com/tx/${tx.hash}`
            }));
        }
        return [];
    } catch (error) {
        console.error('Error fetching BSC transaction history:', error);
        return [];
    }
};

/**
 * Получение текущего курса BNB
 */
export const getBNBPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data.binancecoin?.usd || '600.00';
        }
        return '600.00';
    } catch (error) {
        console.error('Error getting BNB price:', error);
        return '600.00';
    }
};

export default {
    sendBNBReal,
    sendBEP20Real,
    getBNBBalance,
    getBEP20Balance,
    validateBSCAddress,
    getBSCTransactionHistory,
    getBNBPrice
};