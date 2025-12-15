// Services/ethereumService.js
import { ethers } from 'ethers';
import * as bip39 from 'bip39';

const ETHEREUM_RPC_URLS = [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://cloudflare-eth.com'
];

const getWalletFromUserData = async (userData) => {
    try {
        if (!userData?.seed_phrases) {
            throw new Error('Seed phrase not found in user data');
        }
        
        const seedPhrase = userData.seed_phrases;
        const seed = await bip39.mnemonicToSeed(seedPhrase);
        const hdNode = ethers.HDNodeWallet.fromSeed(seed);
        const wallet = hdNode.derivePath("m/44'/60'/0'/0/0");
        
        const provider = createProvider();
        const connectedWallet = wallet.connect(provider);
        
        return {
            wallet: connectedWallet,
            provider,
            address: wallet.address
        };
    } catch (error) {
        console.error('Error getting wallet from user data:', error);
        throw error;
    }
};

const createProvider = () => {
    for (const url of ETHEREUM_RPC_URLS) {
        try {
            return new ethers.JsonRpcProvider(url);
        } catch (error) {
            console.error(`Failed to connect to ${url}:`, error.message);
        }
    }
    throw new Error('All Ethereum RPC endpoints failed');
};

export const getEthBalance = async (userData) => {
    try {
        const { wallet, provider } = await getWalletFromUserData(userData);
        const balance = await provider.getBalance(wallet.address);
        const balanceInEth = ethers.formatEther(balance);
        console.log(`ETH balance: ${balanceInEth}`);
        return parseFloat(balanceInEth).toFixed(4);
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        return '0.0000';
    }
};

export const sendEth = async ({ toAddress, amount, data = '', userData }) => {
    try {
        console.log(`Sending ${amount} ETH to ${toAddress}`);
        
        if (!toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters');
        }

        if (!ethers.isAddress(toAddress)) {
            throw new Error('Invalid Ethereum address');
        }

        const { wallet, provider } = await getWalletFromUserData(userData);
        
        const balance = await provider.getBalance(wallet.address);
        const balanceInEth = parseFloat(ethers.formatEther(balance));
        
        console.log(`Current balance: ${balanceInEth} ETH`);
        
        if (parseFloat(amount) > balanceInEth) {
            throw new Error(`Insufficient balance. Available: ${balanceInEth} ETH`);
        }

        const feeData = await provider.getFeeData();
        
        const tx = {
            to: toAddress,
            value: ethers.parseEther(amount.toString()),
            gasLimit: 21000,
            gasPrice: feeData.gasPrice || await provider.getGasPrice(),
            chainId: 1,
            data: data
        };

        console.log('Signing and sending transaction...');
        
        const txResponse = await wallet.sendTransaction(tx);
        
        console.log(`Transaction sent. Hash: ${txResponse.hash}`);
        
        console.log('Waiting for confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        
        return {
            success: true,
            hash: txResponse.hash,
            message: `Successfully sent ${amount} ETH to ${toAddress}`,
            explorerUrl: `https://etherscan.io/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber
        };

    } catch (error) {
        console.error('Error sending ETH:', error);
        throw new Error(`Failed to send ETH: ${error.message}`);
    }
};

export const sendERC20 = async ({ contractAddress, toAddress, amount, decimals = 18, userData }) => {
    try {
        console.log(`Sending ${amount} ERC20 tokens to ${toAddress}`);
        
        if (!contractAddress || !toAddress || !amount || parseFloat(amount) <= 0 || !userData) {
            throw new Error('Invalid parameters');
        }

        if (!ethers.isAddress(contractAddress) || !ethers.isAddress(toAddress)) {
            throw new Error('Invalid Ethereum address');
        }

        const { wallet, provider } = await getWalletFromUserData(userData);
        
        const abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function transfer(address to, uint256 amount) returns (bool)',
            'function symbol() view returns (string)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const contractWithSigner = contract.connect(wallet);
        
        let tokenDecimals = decimals;
        try {
            tokenDecimals = await contract.decimals();
        } catch (error) {
            console.warn('Could not get token decimals, using default:', decimals);
        }
        
        const balance = await contract.balanceOf(wallet.address);
        const balanceInUnits = ethers.formatUnits(balance, tokenDecimals);
        
        console.log(`Current token balance: ${balanceInUnits}`);
        
        const amountInUnits = ethers.parseUnits(amount.toString(), tokenDecimals);
        
        if (balance < amountInUnits) {
            throw new Error(`Insufficient token balance. Available: ${balanceInUnits}`);
        }
        
        let tokenSymbol = 'TOKEN';
        try {
            tokenSymbol = await contract.symbol();
        } catch (error) {
            console.warn('Could not get token symbol');
        }
        
        const feeData = await provider.getFeeData();
        
        const gasEstimate = await contractWithSigner.transfer.estimateGas(
            toAddress, 
            amountInUnits
        );
        
        console.log('Signing and sending ERC20 transaction...');
        
        const txResponse = await contractWithSigner.transfer(toAddress, amountInUnits, {
            gasLimit: gasEstimate.mul(120).div(100),
            gasPrice: feeData.gasPrice || await provider.getGasPrice()
        });
        
        console.log(`Transaction sent. Hash: ${txResponse.hash}`);
        
        console.log('Waiting for confirmation...');
        const receipt = await txResponse.wait();
        
        console.log(`Transaction confirmed in block ${receipt?.blockNumber}`);
        
        return {
            success: true,
            hash: txResponse.hash,
            message: `Successfully sent ${amount} ${tokenSymbol} to ${toAddress}`,
            explorerUrl: `https://etherscan.io/tx/${txResponse.hash}`,
            timestamp: new Date().toISOString(),
            blockNumber: receipt?.blockNumber,
            tokenSymbol: tokenSymbol
        };

    } catch (error) {
        console.error('Error sending ERC20:', error);
        throw new Error(`Failed to send ERC20 tokens: ${error.message}`);
    }
};

export const getEthPrice = async () => {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        if (response.ok) {
            const data = await response.json();
            const price = data.ethereum?.usd;
            console.log(`Current ETH price: $${price}`);
            return price ? price.toString() : '3500.00';
        }
        
        return '3500.00';
    } catch (error) {
        console.error('Error getting ETH price:', error);
        return '3500.00';
    }
};

export const getERC20Balance = async (contractAddress, userData, decimals = 18) => {
    try {
        const { wallet, provider } = await getWalletFromUserData(userData);
        
        const abi = [
            'function balanceOf(address owner) view returns (uint256)',
            'function decimals() view returns (uint8)'
        ];
        
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        let tokenDecimals = decimals;
        try {
            tokenDecimals = await contract.decimals();
        } catch (error) {
            console.warn('Could not get token decimals, using default:', decimals);
        }
        
        const balance = await contract.balanceOf(wallet.address);
        const formattedBalance = ethers.formatUnits(balance, tokenDecimals);
        
        return formattedBalance;
    } catch (error) {
        console.error('Error getting ERC20 balance:', error);
        return '0';
    }
};

export const validateEthAddress = (address) => {
    return ethers.isAddress(address);
};

export default {
    getEthBalance,
    sendEth,
    sendERC20,
    getEthPrice,
    getERC20Balance,
    validateEthAddress
};