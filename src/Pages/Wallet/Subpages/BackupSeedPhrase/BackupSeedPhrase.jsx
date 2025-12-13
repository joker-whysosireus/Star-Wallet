import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import './BackupSeedPhrase.css';

function BackupSeedPhrase() {
    const location = useLocation();
    const navigate = useNavigate();
    const { userData } = location.state || {};
    
    const [copied, setCopied] = useState(false);
    const [seedPhrase, setSeedPhrase] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Инициализация для Telegram WebApp
    useEffect(() => {
        const isTelegramWebApp = () => {
            try {
                return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.BackButton;
            } catch (e) {
                return false;
            }
        };

        if (isTelegramWebApp()) {
            const webApp = window.Telegram.WebApp;
            
            // Показываем кнопку "Назад" в Telegram WebApp
            webApp.BackButton.show();
            webApp.BackButton.onClick(() => {
                navigate('/wallet');
            });
            
            return () => {
                webApp.BackButton.offClick();
            };
        }
    }, [navigate]);

    // Получаем seed phrase из разных возможных источников
    useEffect(() => {
        const fetchSeedPhrase = async () => {
            try {
                setLoading(true);
                console.log('Fetching seed phrase for user:', userData?.telegram_user_id);
                
                // Вариант 1: Проверяем, есть ли seed_phrase в userData
                if (userData?.seed_phrase) {
                    console.log('Found seed phrase in userData');
                    setSeedPhrase(userData.seed_phrase);
                    setLoading(false);
                    return;
                }
                
                // Вариант 2: Пытаемся получить из localStorage
                const storedSeed = localStorage.getItem('seed_phrase_' + userData?.telegram_user_id);
                if (storedSeed) {
                    console.log('Found seed phrase in localStorage');
                    setSeedPhrase(storedSeed);
                    setLoading(false);
                    return;
                }
                
                // Вариант 3: Запрашиваем с бэкенда
                if (userData?.telegram_user_id) {
                    console.log('Fetching seed phrase from backend');
                    try {
                        const response = await fetch('https://star-wallet-backend.netlify.app/.netlify/functions/get-seed', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ 
                                telegram_user_id: userData.telegram_user_id 
                            }),
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.seed_phrase) {
                                console.log('Retrieved seed phrase from backend');
                                setSeedPhrase(data.seed_phrase);
                                // Сохраняем в localStorage для будущего использования
                                localStorage.setItem('seed_phrase_' + userData.telegram_user_id, data.seed_phrase);
                            } else {
                                setError('Seed phrase not found in database');
                            }
                        } else {
                            setError('Failed to fetch seed phrase from server');
                        }
                    } catch (fetchError) {
                        console.error('Error fetching from backend:', fetchError);
                        // Fallback: пробуем получить из supabase или другого источника
                        await tryFallbackSources();
                    }
                } else {
                    setError('User ID not available');
                }
                
                setLoading(false);
                
            } catch (error) {
                console.error('Error fetching seed phrase:', error);
                setError('Failed to load seed phrase');
                setLoading(false);
            }
        };

        const tryFallbackSources = async () => {
            // Проверяем различные возможные места хранения
            const possibleKeys = [
                'user_seed_phrase',
                'wallet_seed',
                'recovery_phrase',
                'mnemonic',
                'backup_phrase'
            ];
            
            for (const key of possibleKeys) {
                const stored = localStorage.getItem(key);
                if (stored) {
                    console.log(`Found seed phrase in localStorage key: ${key}`);
                    setSeedPhrase(stored);
                    return;
                }
            }
            
            // Если все еще не нашли, проверяем в userData все возможные ключи
            if (userData) {
                const possibleUserDataKeys = [
                    'seedPhrase',
                    'seed',
                    'mnemonic',
                    'recoveryPhrase',
                    'backupPhrase',
                    'secret_phrase',
                    'recovery_seed'
                ];
                
                for (const key of possibleUserDataKeys) {
                    if (userData[key]) {
                        console.log(`Found seed phrase in userData key: ${key}`);
                        setSeedPhrase(userData[key]);
                        return;
                    }
                }
            }
            
            setError('Seed phrase not found in any storage location');
        };

        if (userData) {
            fetchSeedPhrase();
        } else {
            setError('User data not available');
            setLoading(false);
        }
    }, [userData]);

    const handleCopySeedPhrase = () => {
        if (seedPhrase) {
            navigator.clipboard.writeText(seedPhrase)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        }
    };

    const words = seedPhrase.split(' ').filter(word => word.trim() !== '');

    if (loading) {
        return (
            <div className="wallet-page">
                <Header userData={userData} />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading seed phrase...</p>
                </div>
                <Menu />
            </div>
        );
    }

    if (error || !seedPhrase) {
        return (
            <div className="wallet-page">
                <Header userData={userData} />
                <div className="page-content">
                    <div className="receive-header">
                        <h2>Seed Phrase</h2>
                        <p>Your secret recovery phrase</p>
                    </div>
                    
                    <div className="receive-content">
                        <div className="error-message">
                            <div className="error-icon">⚠️</div>
                            <h3>Seed Phrase Not Available</h3>
                            <p>{error || 'Unable to retrieve seed phrase. Please contact support.'}</p>
                        </div>
                    </div>
                    
                    <button 
                        className="copy-address-btn"
                        onClick={() => navigate('/wallet')}
                    >
                        Back to Wallet
                    </button>
                </div>
                <Menu />
            </div>
        );
    }

    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="receive-header">
                    <h2>Seed Phrase</h2>
                    <p>Your secret 12-word recovery phrase</p>
                </div>

                <div className="receive-content">
                    {/* Seed Phrase Grid */}
                    <div className="seed-phrase-grid-container">
                        <div className="seed-grid-header">
                            <span className="seed-grid-label">{words.length} words</span>
                        </div>
                        
                        <div className="seed-grid-large">
                            {words.map((word, index) => (
                                <div key={index} className="seed-word-large">
                                    <div className="word-number-large">{index + 1}</div>
                                    <div className="word-text-large">{word}</div>
                                </div>
                            ))}
                        </div>
                        
                        <p className="receive-info">
                            Write down these {words.length} words in order and store them securely
                        </p>
                        
                        {/* Warning Banner под блоком со словами */}
                        <div className="warning-banner">
                            The seed phrase is the only way to recover your account.
                        </div>
                    </div>
                </div>
                
                <button 
                    className="copy-address-btn"
                    onClick={handleCopySeedPhrase}
                    disabled={!seedPhrase}
                >
                    {copied ? 'Copied!' : 'Copy Seed Phrase'}
                </button>
            </div>
            
            <Menu />
        </div>
    );
}

export default BackupSeedPhrase;