import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ShowSeed.css';

const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

function ShowSeed({ isActive, userData }) {
    const [seedPhrase, setSeedPhrase] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCopied, setIsCopied] = useState(false);
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
                navigate(-1);
            });

            return () => {
                webApp.BackButton.offClick();
            };
        }
    }, [navigate]);

    useEffect(() => {
        loadSeedPhrase();
    }, []);

    const loadSeedPhrase = async () => {
        const telegramUserId = userData?.telegram_user_id;
        
        if (telegramUserId) {
            try {
                const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/get-seed`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      telegram_user_id: telegramUserId
                    }),
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.seed_phrase) {
                        setSeedPhrase(data.seed_phrase);
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (apiError) {
            }
        }
        
        const localSeed = localStorage.getItem('wallet_seed_phrase');
        if (localSeed) {
            setSeedPhrase(localSeed);
        } else {
            setError('Seed phrase not found');
        }
        
        setIsLoading(false);
    };

    const handleCopySeed = () => {
        if (seedPhrase) {
            navigator.clipboard.writeText(seedPhrase)
                .then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                });
        }
    };

    const handleBackupComplete = () => {
        if (window.confirm('Have you securely backed up your seed phrase?')) {
            navigate('/wallet');
        }
    };

    if (isLoading) {
        return (
            <div className="show-seed-page">
                <Header userData={userData} />
                <div className="loading-container">
                    <div className="loader"></div>
                    <p>Loading seed phrase...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="show-seed-page">

            <div className="show-seed-content">
                <div className="seed-header">
                    <div className="seed-icon">🔐</div>
                    <h1>Your Seed Phrase</h1>
                    <p className="seed-warning">
                        This is your wallet recovery phrase. Write it down and store it in a safe place.
                        Never share it with anyone!
                    </p>
                </div>

                {error ? (
                    <div className="error-container">
                        <p className="error-text">{error}</p>
                        <button 
                            className="back-button"
                            onClick={() => navigate('/wallet')}
                        >
                            Back to Wallet
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="seed-phrase-container">
                            <div className="seed-phrase-grid">
                                {seedPhrase.split(' ').map((word, index) => (
                                    <div key={index} className="seed-word">
                                        <span className="word-number">{index + 1}.</span>
                                        <span className="word-text">{word}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="security-warning">
                            <div className="warning-icon">⚠️</div>
                            <div className="warning-text">
                                <p><strong>Security Warning:</strong></p>
                                <p>• Never share your seed phrase with anyone</p>
                                <p>• Store it offline in a secure location</p>
                                <p>• Anyone with your seed phrase can access your funds</p>
                            </div>
                        </div>

                        <div className="action-buttons">
                            <button 
                                className={`copy-button ${isCopied ? 'copied' : ''}`}
                                onClick={handleCopySeed}
                            >
                                {isCopied ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                            <button 
                                className="backup-complete-button"
                                onClick={handleBackupComplete}
                            >
                                I've Backed Up My Seed Phrase
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ShowSeed;