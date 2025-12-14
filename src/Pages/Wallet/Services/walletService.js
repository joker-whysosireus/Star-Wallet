import { 
    generateNewSeedPhrase, 
    generateWalletsFromSeed,
    saveSeedPhrase,
    saveAddresses,
    createWalletsFromAddresses
} from './storageService';

// Инициализация кошельков пользователя
export const initializeUserWallets = async (userData) => {
    try {
        console.log("walletService: Initializing user wallets for:", userData.telegram_user_id);
        
        if (!userData || !userData.telegram_user_id) {
            throw new Error("Invalid user data");
        }

        let seedPhrase = userData.seed_phrases;
        let walletAddresses = userData.wallet_addresses;
        
        // Если нет сид-фразы, генерируем новую и сохраняем в базу
        if (!seedPhrase) {
            console.log("walletService: No seed phrase found, generating new one...");
            seedPhrase = await generateNewSeedPhrase();
            console.log("walletService: New seed phrase generated");
            
            // Сохраняем сид-фразу в базу
            console.log("walletService: Saving seed phrase to database...");
            try {
                await saveSeedPhrase(userData.telegram_user_id, seedPhrase);
                console.log("walletService: Seed phrase saved to database");
            } catch (error) {
                console.error("walletService: Failed to save seed phrase:", error);
                // Продолжаем работу даже если не удалось сохранить
            }
        } else {
            console.log("walletService: Existing seed phrase found");
        }

        let wallets = [];
        
        // Если нет адресов кошельков, генерируем их из сид-фразы
        if (!walletAddresses || Object.keys(walletAddresses).length === 0) {
            console.log("walletService: No wallet addresses found, generating from seed...");
            
            // Генерируем кошельки из сид-фразы
            wallets = await generateWalletsFromSeed(seedPhrase);
            
            // Формируем структуру адресов для базы данных
            walletAddresses = {};
            
            // Извлекаем адреса из сгенерированных кошельков
            const tonWallet = wallets.find(w => w.symbol === 'TON');
            const solWallet = wallets.find(w => w.symbol === 'SOL');
            const ethWallet = wallets.find(w => w.symbol === 'ETH');
            
            if (tonWallet && tonWallet.address) {
                walletAddresses.TON = {
                    address: tonWallet.address,
                    network: 'mainnet',
                    symbol: 'TON'
                };
            }
            
            if (solWallet && solWallet.address) {
                walletAddresses.Solana = {
                    address: solWallet.address,
                    network: 'mainnet',
                    symbol: 'SOL'
                };
            }
            
            if (ethWallet && ethWallet.address) {
                walletAddresses.Ethereum = {
                    address: ethWallet.address,
                    network: 'mainnet',
                    symbol: 'ETH'
                };
            }

            // Сохраняем адреса в базу
            console.log("walletService: Saving addresses to database...");
            try {
                await saveAddresses(userData.telegram_user_id, walletAddresses);
                console.log("walletService: Addresses saved to database");
            } catch (error) {
                console.error("walletService: Failed to save addresses:", error);
                // Продолжаем работу даже если не удалось сохранить
            }
        } else {
            console.log("walletService: Existing wallet addresses found");
            
            // Создаем кошельки из существующих адресов
            wallets = createWalletsFromAddresses(walletAddresses);
        }

        // Обновляем данные пользователя
        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: walletAddresses,
            wallets: wallets
        };

        console.log("walletService: User wallets initialized successfully");
        return updatedUserData;

    } catch (error) {
        console.error("walletService: Error initializing user wallets:", error);
        
        // Возвращаем исходные данные пользователя в случае ошибки
        return {
            ...userData,
            wallets: []
        };
    }
};

export default {
    initializeUserWallets
};