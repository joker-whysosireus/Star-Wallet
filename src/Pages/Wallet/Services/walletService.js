// Services/walletService.js
import { generateNewSeedPhrase, generateWalletsFromSeed } from './storageService';

const WALLET_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

// Инициализация кошельков пользователя
export const initializeUserWallets = async (userData) => {
    try {
        console.log("walletService: Initializing user wallets for:", userData.telegram_user_id);
        
        if (!userData || !userData.telegram_user_id) {
            throw new Error("Invalid user data");
        }

        // Проверяем, есть ли уже сид-фраза у пользователя
        let seedPhrase = userData.seed_phrases;
        
        if (!seedPhrase) {
            console.log("walletService: No seed phrase found, generating new one...");
            
            // Генерируем новую сид-фразу
            seedPhrase = await generateNewSeedPhrase();
            console.log("walletService: New seed phrase generated");
            
            // Сохраняем сид-фразу в базу данных
            const saveSeedResult = await saveSeedPhraseToAPI(
                userData.telegram_user_id,
                seedPhrase
            );
            
            if (!saveSeedResult.success) {
                throw new Error("Failed to save seed phrase to database");
            }
            
            console.log("walletService: Seed phrase saved to database");
        } else {
            console.log("walletService: Existing seed phrase found");
        }

        // Генерируем кошельки из сид-фразы
        console.log("walletService: Generating wallets from seed...");
        const wallets = await generateWalletsFromSeed(seedPhrase);
        
        // Формируем структуру адресов для базы данных
        const addresses = {};
        wallets.forEach(wallet => {
            addresses[wallet.blockchain] = {
                address: wallet.address,
                symbol: wallet.symbol,
                network: 'mainnet'
            };
        });

        // Сохраняем адреса в базу данных
        console.log("walletService: Saving addresses to database...");
        const saveAddressesResult = await saveAddressesToAPI(
            userData.telegram_user_id,
            addresses
        );

        if (!saveAddressesResult.success) {
            throw new Error("Failed to save addresses to database");
        }

        console.log("walletService: Addresses saved to database");

        // Обновляем данные пользователя
        const updatedUserData = {
            ...userData,
            seed_phrases: seedPhrase,
            wallet_addresses: addresses,
            wallets: wallets
        };

        // Сохраняем в localStorage для быстрого доступа
        localStorage.setItem('user_wallets', JSON.stringify(wallets));
        localStorage.setItem('user_seed_phrase', seedPhrase);
        localStorage.setItem('user_data', JSON.stringify(updatedUserData));

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

// Сохранение сид-фразы в базу данных
export const saveSeedPhraseToAPI = async (telegramUserId, seedPhrase) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-seed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                seed_phrase: seedPhrase
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error saving seed phrase:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Сохранение адресов в базу данных
export const saveAddressesToAPI = async (telegramUserId, addresses) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/save-addresses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                wallet_addresses: addresses
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error saving addresses:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Получение кошельков пользователя
export const getUserWallets = async (telegramUserId) => {
    try {
        // Сначала пробуем получить из localStorage
        const cachedWallets = localStorage.getItem('user_wallets');
        if (cachedWallets) {
            return JSON.parse(cachedWallets);
        }

        // Если нет в localStorage, получаем из базы данных
        const response = await fetch(`${WALLET_API_URL}/get-wallets?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.wallets) {
            // Сохраняем в localStorage для будущего использования
            localStorage.setItem('user_wallets', JSON.stringify(data.wallets));
            return data.wallets;
        }

        return [];
    } catch (error) {
        console.error("Error getting user wallets:", error);
        return [];
    }
};

// Получение сид-фразы пользователя
export const getUserSeedPhrase = async (telegramUserId) => {
    try {
        // Сначала пробуем получить из localStorage
        const cachedSeedPhrase = localStorage.getItem('user_seed_phrase');
        if (cachedSeedPhrase) {
            return cachedSeedPhrase;
        }

        // Если нет в localStorage, получаем из базы данных
        const response = await fetch(`${WALLET_API_URL}/get-seed?telegram_user_id=${telegramUserId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.seed_phrase) {
            // Сохраняем в localStorage для будущего использования
            localStorage.setItem('user_seed_phrase', data.seed_phrase);
            return data.seed_phrase;
        }

        return null;
    } catch (error) {
        console.error("Error getting user seed phrase:", error);
        return null;
    }
};

// Обновление балансов токенов
export const updateTokenBalances = async (telegramUserId, balances) => {
    try {
        const response = await fetch(`${WALLET_API_URL}/update-balances`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_user_id: telegramUserId,
                token_balances: balances
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("Error updating token balances:", error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Очистка данных пользователя
export const clearUserData = () => {
    localStorage.removeItem('user_wallets');
    localStorage.removeItem('user_seed_phrase');
    localStorage.removeItem('user_data');
    localStorage.removeItem('wallets');
    localStorage.removeItem('wallet_seed_phrase');
    
    console.log("User data cleared from localStorage");
};

export default {
    initializeUserWallets,
    saveSeedPhraseToAPI,
    saveAddressesToAPI,
    getUserWallets,
    getUserSeedPhrase,
    updateTokenBalances,
    clearUserData
};