import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomePage.css';

const WelcomePage = ({ userData, onContinue }) => {
    const [hasCopied, setHasCopied] = useState({
        seed: false,
        login: false,
        password: false,
        pin: false
    });

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            setHasCopied(prev => ({ ...prev, [type]: true }));
            setTimeout(() => {
                setHasCopied(prev => ({ ...prev, [type]: false }));
            }, 2000);
        });
    };

    const handleContinue = () => {
        if (onContinue) {
            onContinue();
        }
    };

    // Получаем данные из userData
    const seedPhrase = userData?.seed_phrases || '';
    const login = userData?.login || '';
    const password = userData?.password || '';
    const pinCode = userData?.pin_code || '';

    return (
        <div className="welcome-container">
            <div className="welcome-content">
                <div className="welcome-header">
                    <h1 className="welcome-title">Welcome to Star Wallet</h1>
                    <p className="welcome-subtitle">
                        Save this information in a secure place. You'll need it to access your wallet.
                    </p>
                </div>

                {/* Seed Phrase Section */}
                <div className="info-section seed-phrase-section">
                    <div className="section-header">
                        <h2 className="section-title">Seed Phrase</h2>
                        <div className="section-badge">IMPORTANT</div>
                    </div>
                    <div className="seed-phrase-container">
                        <div className="seed-phrase-grid">
                            {seedPhrase.split(' ').map((word, index) => (
                                <div key={index} className="seed-word">
                                    <span className="word-number">{index + 1}.</span>
                                    <span className="word-text">{word}</span>
                                </div>
                            ))}
                        </div>
                        <button 
                            className={`copy-button ${hasCopied.seed ? 'copied' : ''}`}
                            onClick={() => copyToClipboard(seedPhrase, 'seed')}
                        >
                            {hasCopied.seed ? 'Copied!' : 'Copy Seed Phrase'}
                        </button>
                    </div>
                    <p className="section-warning">
                        ⚠️ Never share your seed phrase. Anyone with this phrase can access your funds.
                    </p>
                </div>

                {/* Credentials Section */}
                <div className="info-section credentials-section">
                    <div className="section-header">
                        <h2 className="section-title">Your Credentials</h2>
                        <div className="section-badge">SECURE</div>
                    </div>

                    {/* Login */}
                    <div className="credential-box">
                        <div className="credential-header">
                            <h3 className="credential-title">Login</h3>
                            <div className="credential-tag">For web access</div>
                        </div>
                        <div className="credential-value-container">
                            <div className="credential-value">{login}</div>
                            <button 
                                className={`copy-icon-button ${hasCopied.login ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(login, 'login')}
                            >
                                {hasCopied.login ? '✓' : '📋'}
                            </button>
                        </div>
                    </div>

                    {/* Password */}
                    <div className="credential-box">
                        <div className="credential-header">
                            <h3 className="credential-title">Password</h3>
                            <div className="credential-tag">For web access</div>
                        </div>
                        <div className="credential-value-container">
                            <div className="credential-value password-value">{password}</div>
                            <button 
                                className={`copy-icon-button ${hasCopied.password ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(password, 'password')}
                            >
                                {hasCopied.password ? '✓' : '📋'}
                            </button>
                        </div>
                    </div>

                    {/* PIN Code */}
                    <div className="credential-box">
                        <div className="credential-header">
                            <h3 className="credential-title">PIN Code</h3>
                            <div className="credential-tag">For app access</div>
                        </div>
                        <div className="credential-value-container">
                            <div className="credential-value pin-value">{pinCode}</div>
                            <button 
                                className={`copy-icon-button ${hasCopied.pin ? 'copied' : ''}`}
                                onClick={() => copyToClipboard(pinCode, 'pin')}
                            >
                                {hasCopied.pin ? '✓' : '📋'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Continue Button */}
                <div className="continue-section">
                    <button className="continue-button" onClick={handleContinue}>
                        Continue to Wallet
                    </button>
                    <p className="continue-note">
                        Make sure you've saved all information before continuing.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;