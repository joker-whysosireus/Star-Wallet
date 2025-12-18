import { ethers } from 'ethers';
import * as bip39 from 'bip39';

// Mainnet конфигурация с реальными ключами
const ETHEREUM_MAINNET_RPC = 'https://mainnet.infura.io/v3/BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6';
const ETHERSCAN_API_KEY = 'BYUSWS2J41VG9BGWPE6FFYYEMXWQ9AS3I6';

/**
 * Реальная отправка ETH на mainnet
 */
export const sendEthReal = async ({ toAddress, amount, privateKey }) => {
    try {
        console.log(`[ETHEREUM MAINNET] Sending ${amount} ETH to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !privateKey) {
            throw new Error('Invalid parameters for mainnet');
        }

        if (!ethers.isAddress(toAddress)) {
            throw new Error('Invalid Ethereum address for mainnet');
        }

        const provider = new ethers.JsonRpcProvider(ETHEREUM_MAINNET_RPC);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // Проверяем баланс
        const balance = await provider.getBalance(wallet.address);
        const balanceInEth = parseFloat(ethers.formatEther(balance));
        
        console.log(`Mainnet current balance: ${balanceInEth} ETH`);
        
        if (parseFloat(amount) > balanceInEth) {
            throw new Error(`Insufficient balance on mainnet. Available: ${balanceInEth} ETH`);
        }

        // Получаем данные о газе
        const feeData = await provider.getFeeData();
        
        // Создаем транзакцию
        const tx = {
            to: toAddress,
            value: ethers.parseEther(amount.toString()),
            gasLimit: 21000,
            gasPrice: feeData.gasPrice || await provider.getGasPrice(),
            chainId: 1, // Mainnet chain ID
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
            message: `Successfully sent ${amount} ETH to ${toAddress} on mainnet`,
            explorerUrl: `https://etherscan.io/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber,
            gasUsed: receipt?.gasUsed?.toString(),
            status: receipt?.status === 1 ? 'success' : 'failed'
        };

    } catch (error) {
        console.error('[ETHEREUM MAINNET ERROR]:', error);
        throw new Error(`ETH mainnet send failed: ${error.message}`);
    }
};

/**
 * Реальная отправка ERC20 на mainnet
 */
export const sendERC20Real = async ({ contractAddress, toAddress, amount, privateKey }) => {
    try {
        console.log(`[ETHEREUM MAINNET] Sending ${amount} ERC20 to ${toAddress}`);
        
        if (!contractAddress || !toAddress || !amount || parseFloat(amount) <= 0 || !privateKey) {
            throw new Error('Invalid parameters for mainnet');
        }

        if (!ethers.isAddress(contractAddress) || !ethers.isAddress(toAddress)) {
            throw new Error('Invalid Ethereum address for mainnet');
        }

        const provider = new ethers.JsonRpcProvider(ETHEREUM_MAINNET_RPC);
        const wallet = new ethers.Wallet(privateKey, provider);
        
        // ABI ERC20 токена
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
        let tokenSymbol = 'TOKEN';
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
        
        console.log('Signing and sending mainnet ERC20 transaction...');
        
        // Отправляем транзакцию
        const txResponse = await contractWithSigner.transfer(toAddress, amountInUnits, {
            gasLimit: gasEstimate.mul(120).div(100),
            gasPrice: feeData.gasPrice || await provider.getGasPrice()
        });
        
        console.log(`Mainnet ERC20 transaction sent. Hash: ${txResponse.hash}`);
        
        console.log('Waiting for mainnet confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(`Mainnet ERC20 transaction confirmed in block ${receipt?.blockNumber}`);
        
        return {
            success: true,
            hash: txResponse.hash,
            message: `Successfully sent ${amount} ${tokenSymbol} to ${toAddress} on mainnet`,
            explorerUrl: `https://etherscan.io/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber,
            tokenSymbol: tokenSymbol
        };

    } catch (error) {
        console.error('[ETHEREUM MAINNET ERC20 ERROR]:', error);
        throw new Error(`ERC20 mainnet send failed: ${error.message}`);
    }
};

/**
 * Получение баланса ETH
 */
export const getEthBalance = async (address) => {
    try {
        if (!address) {
            throw new Error('Address is required');
        }

        const provider = new ethers.JsonRpcProvider(ETHEREUM_MAINNET_RPC);
        const balance = await provider.getBalance(address);
        const balanceInEth = ethers.formatEther(balance);
        
        console.log(`ETH balance for ${address}: ${balanceInEth}`);
        return parseFloat(balanceInEth).toFixed(6);
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        return '0.000000';
    }
};

/**
 * Получение цены ETH
 */
export const getEthPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            return data.ethereum?.usd || '3500.00';
        }
        return '3500.00';
    } catch (error) {
        console.error('Error getting ETH price:', error);
        return '3500.00';
    }
};

/**
 * Получение баланса ERC20 токена
 */
export const getERC20Balance = async (address, contractAddress) => {
    try {
        const provider = new ethers.JsonRpcProvider(ETHEREUM_MAINNET_RPC);
        
        const abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error getting ERC20 balance:', error);
        return '0';
    }
};

/**
 * Валидация Ethereum адреса
 */
export const validateEthAddress = (address) => {
    return ethers.isAddress(address);
};

export default {
    getEthBalance,
    sendEthReal,
    sendERC20Real,
    getEthPrice,
    getERC20Balance,
    validateEthAddress
};