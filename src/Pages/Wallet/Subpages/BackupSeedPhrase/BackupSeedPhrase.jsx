import React, { useState, useEffect } from 'react';
import Header from '../../../../assets/Header/Header';
import Menu from '../../../../assets/Menus/Menu/Menu';
import './BackupSeedPhrase.css';

function BackupSeedPhrase({ userData, onBack }) {
    const [copied, setCopied] = useState(false);
    const [copiedLogin, setCopiedLogin] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);
    const [seedPhrase, setSeedPhrase] = useState('');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');

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
            
            webApp.BackButton.show();
            webApp.BackButton.onClick(() => {
                if (onBack) {
                    onBack();
                }
            });
            
            return () => {
                webApp.BackButton.offClick();
            };
        }
    }, [onBack]);

    useEffect(() => {
        if (userData) {
            // Получаем данные из userData
            setSeedPhrase(userData.seed_phrases || '');
            
            // Получаем логин и пароль из БД
            setLogin(userData.login || '');
            setPassword(userData.password || '');
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

    const handleCopyLogin = () => {
        if (login) {
            navigator.clipboard.writeText(login)
                .then(() => {
                    setCopiedLogin(true);
                    setTimeout(() => setCopiedLogin(false), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy login:', err);
                });
        }
    };

    const handleCopyPassword = () => {
        if (password) {
            navigator.clipboard.writeText(password)
                .then(() => {
                    setCopiedPassword(true);
                    setTimeout(() => setCopiedPassword(false), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy password:', err);
                });
        }
    };

    const words = seedPhrase.split(' ').filter(word => word.trim() !== '');

    return (
        <div className="wallet-page">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="receive-header">
                    <h2>Backup Your Account</h2>
                    <p>Save your credentials securely</p>
                </div>

                {/* Упрощённый блок логина и пароля */}
                <div className="credentials-section-simple">
                    <div className="credential-line">
                        <span className="credential-label-simple">Login:</span>
                        <span className="credential-value-simple">{login}</span>
                        <button 
                            className="copy-btn-small"
                            onClick={handleCopyLogin}
                        >
                            {copiedLogin ? '✓' : 'Copy'}
                        </button>
                    </div>
                    
                    <div className="credential-line">
                        <span className="credential-label-simple">Password:</span>
                        <span className="credential-value-simple">{password}</span>
                        <button 
                            className="copy-btn-small"
                            onClick={handleCopyPassword}
                        >
                            {copiedPassword ? '✓' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="receive-content">
                    {/* Seed Phrase Grid */}
                    <div className="seed-phrase-grid-container">
                        <div className="seed-grid-header">
                            <span className="seed-grid-label">Seed Phrase ({words.length} words)</span>
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
                            Write down these {words.length} words in order and store them securely. Never share your seed phrase!
                        </p>
                        
                        {/* Warning Banner под блоком со словами */}
                        <div className="warning-banner">
                            ⚠️ The seed phrase is the only way to recover your account. Store it in a safe place!
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