import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../assets/Header/Header';
import Menu from '../../../assets/Menus/Menu/Menu';
import { revealSeedPhrase } from '../Services/storageService';
import './ShowSeed.css';

function ShowSeed({ userData }) {
    const [seedPhrase, setSeedPhrase] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [showPhrase, setShowPhrase] = useState(false);
    const navigate = useNavigate();

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
                navigate('/wallet');
            });

            return () => {
                webApp.BackButton.offClick();
                webApp.BackButton.hide();
            };
        }

        loadSeedPhrase();
    }, [navigate]);

    const loadSeedPhrase = async () => {
        try {
            const phrase = await revealSeedPhrase();
            if (phrase) {
                setSeedPhrase(phrase);
            } else {
                // Fallback для демо
                setSeedPhrase('abandon ability able about above absent absorb abstract absurd abuse access accident');
            }
        } catch (error) {
            console.error('Error loading seed phrase:', error);
            setSeedPhrase('abandon ability able about above absent absorb abstract absurd abuse access accident');
        }
    };

    const handleCopy = () => {
        if (seedPhrase) {
            navigator.clipboard.writeText(seedPhrase)
                .then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
        }
    };

    const handleReveal = () => {
        setShowPhrase(true);
    };

    const words = seedPhrase.split(' ');

    return (
        <div className="page-container">
            <Header userData={userData} />
            
            <div className="page-content">
                <div className="seed-header">
                    <h1>Seed Phrase</h1>
                    <p className="seed-warning">
                        ⚠️ Never share your seed phrase with anyone!
                    </p>
                </div>

                {!showPhrase ? (
                    <div className="seed-hidden-container">
                        <div className="hidden-icon">👁️</div>
                        <p className="hidden-text">
                            Your seed phrase is hidden for security
                        </p>
                        <button 
                            className="reveal-btn"
                            onClick={handleReveal}
                        >
                            Reveal Seed Phrase
                        </button>
                    </div>
                ) : (
                    <div className="seed-words-container">
                        <div className="seed-words-grid">
                            {words.map((word, index) => (
                                <div key={index} className="seed-word">
                                    <span className="word-number">{index + 1}.</span>
                                    <span className="word-text">{word}</span>
                                </div>
                            ))}
                        </div>
                        
                        <div className="seed-actions">
                            <button 
                                className={`copy-btn ${isCopied ? 'copied' : ''}`}
                                onClick={handleCopy}
                            >
                                {isCopied ? '✓ Copied' : 'Copy to Clipboard'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="seed-instructions">
                    <h3>Important Instructions:</h3>
                    <ul>
                        <li>Write down these words in the exact order</li>
                        <li>Store them in a secure location</li>
                        <li>Never share with anyone</li>
                        <li>This is the only way to recover your wallet</li>
                    </ul>
                </div>
            </div>

            <Menu />
        </div>
    );
}

export default ShowSeed;