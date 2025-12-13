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
    
    const seedPhrase = userData?.seed_phrase || '';
    const words = seedPhrase.split(' ').filter(word => word.trim() !== '');

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

    const handleCopySeedPhrase = () => {
        navigator.clipboard.writeText(seedPhrase)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
            });
    };

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
                            <span className="seed-grid-label">12 words</span>
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
                            Write down these 12 words in order and store them securely
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
                >
                    {copied ? 'Copied!' : 'Copy Seed Phrase'}
                </button>
            </div>
            
            <Menu />
        </div>
    );
}

export default BackupSeedPhrase;