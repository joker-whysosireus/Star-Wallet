import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Welcome.css';

const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

function Welcome({ isActive, userData }) {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [pin, setPin] = useState(['', '', '', '']);
    const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
    const [currentInput, setCurrentInput] = useState(0);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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
            webApp.BackButton.hide();
        }
    }, []);

    const savePinToAPI = async (pinString) => {
        const telegramUserId = userData?.telegram_user_id;
        
        if (!telegramUserId) {
            throw new Error('User ID not found');
        }
        
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/save-pin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              telegram_user_id: telegramUserId,
              pin_code: pinString
            }),
        });
        
        if (!response.ok) {
            throw new Error('API error');
        }
        
        return await response.json();
    };

    const handleNumberClick = async (number) => {
        if (step === 1) {
            const newPin = [...pin];
            if (currentInput < 4) {
                newPin[currentInput] = number;
                setPin(newPin);
                
                if (currentInput === 3) {
                    setTimeout(() => {
                        setStep(2);
                        setCurrentInput(0);
                    }, 300);
                } else {
                    setCurrentInput(currentInput + 1);
                }
            }
        } else if (step === 2) {
            const newConfirmPin = [...confirmPin];
            if (currentInput < 4) {
                newConfirmPin[currentInput] = number;
                setConfirmPin(newConfirmPin);
                
                if (currentInput === 3) {
                    const pinString = pin.join('');
                    const confirmPinString = newConfirmPin.join('');
                    
                    if (pinString === confirmPinString) {
                        setIsSaving(true);
                        
                        try {
                            localStorage.setItem('wallet_pin', pinString);
                            localStorage.setItem('wallet_pin_set', 'true');
                            
                            if (userData?.telegram_user_id) {
                                await savePinToAPI(pinString);
                            }
                            
                            setStep(3);
                        } catch (error) {
                            setError('Error saving PIN');
                            setTimeout(() => {
                                setPin(['', '', '', '']);
                                setConfirmPin(['', '', '', '']);
                                setCurrentInput(0);
                                setStep(1);
                                setError('');
                            }, 2000);
                        } finally {
                            setIsSaving(false);
                        }
                    } else {
                        setError('PIN codes do not match');
                        setTimeout(() => {
                            setPin(['', '', '', '']);
                            setConfirmPin(['', '', '', '']);
                            setCurrentInput(0);
                            setStep(1);
                            setError('');
                        }, 2000);
                    }
                } else {
                    setCurrentInput(currentInput + 1);
                }
            }
        }
    };

    const handleDelete = () => {
        if (step === 1) {
            const newPin = [...pin];
            if (currentInput > 0) {
                newPin[currentInput - 1] = '';
                setPin(newPin);
                setCurrentInput(currentInput - 1);
            }
        } else if (step === 2) {
            const newConfirmPin = [...confirmPin];
            if (currentInput > 0) {
                newConfirmPin[currentInput - 1] = '';
                setConfirmPin(newConfirmPin);
                setCurrentInput(currentInput - 1);
            }
        }
    };

    const handleCreateWallet = async () => {
        try {
            const storageService = await import('../../Services/storageService');
            const seedPhrase = await storageService.generateNewSeedPhrase();
            
            storageService.saveSeedPhrase(seedPhrase);
            
            if (userData?.telegram_user_id) {
                try {
                    await storageService.saveSeedPhraseToAPI(userData.telegram_user_id, seedPhrase);
                } catch (error) {
                }
            }
            
            await storageService.generateWalletsFromSeed(seedPhrase);
            
            navigate('/wallet');
        } catch (error) {
            setError('Error creating wallet');
        }
    };

    const renderPinDots = () => {
        if (step === 1) {
            return (
                <div className="pin-dots">
                    {pin.map((digit, index) => (
                        <div 
                            key={index} 
                            className={`pin-dot ${index < currentInput ? 'filled' : ''}`}
                        />
                    ))}
                </div>
            );
        } else {
            return (
                <div className="pin-dots">
                    {confirmPin.map((digit, index) => (
                        <div 
                            key={index} 
                            className={`pin-dot ${index < currentInput ? 'filled' : ''}`}
                        />
                    ))}
                </div>
            );
        }
    };

    return (
        <div className="welcome-page">

            <div className="welcome-content">
                {step === 1 && (
                    <div className="welcome-step">
                        <div className="welcome-icon">🔐</div>
                        <h1>Create PIN Code</h1>
                        <p className="welcome-subtitle">
                            Create a 4-digit PIN code to secure your wallet
                        </p>
                        {renderPinDots()}
                        <p className="pin-instruction">
                            Enter your new PIN code
                        </p>
                        {error && <p className="error-message">{error}</p>}
                    </div>
                )}

                {step === 2 && (
                    <div className="welcome-step">
                        <div className="welcome-icon">🔐</div>
                        <h1>Confirm PIN Code</h1>
                        <p className="welcome-subtitle">
                            Please re-enter your PIN code for confirmation
                        </p>
                        {renderPinDots()}
                        {error && <p className="error-message">{error}</p>}
                        {isSaving && <p className="saving-message">Saving PIN...</p>}
                        <p className="pin-instruction">
                            Confirm your PIN code
                        </p>
                    </div>
                )}

                {step === 3 && (
                    <div className="welcome-step">
                        <div className="welcome-icon">🎉</div>
                        <h1>Welcome!</h1>
                        <p className="welcome-subtitle">
                            Your PIN code has been set successfully!
                        </p>
                        <div className="success-message">
                            <p>Now let's create your crypto wallet</p>
                            <p className="small-text">We'll generate a secure seed phrase for you</p>
                        </div>
                        <button 
                            className="create-wallet-btn"
                            onClick={handleCreateWallet}
                        >
                            Create My Wallet
                        </button>
                    </div>
                )}

                <div className="pin-keyboard">
                    <div className="keyboard-row">
                        {[1, 2, 3].map(num => (
                            <button 
                                key={num}
                                className="number-btn"
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={isSaving || step === 3}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="keyboard-row">
                        {[4, 5, 6].map(num => (
                            <button 
                                key={num}
                                className="number-btn"
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={isSaving || step === 3}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="keyboard-row">
                        {[7, 8, 9].map(num => (
                            <button 
                                key={num}
                                className="number-btn"
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={isSaving || step === 3}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="keyboard-row">
                        <button 
                            className="number-btn empty"
                            disabled={true}
                        >
                            &nbsp;
                        </button>
                        <button 
                            className="number-btn"
                            onClick={() => handleNumberClick('0')}
                            disabled={isSaving || step === 3}
                        >
                            0
                        </button>
                        <button 
                            className="number-btn delete-btn"
                            onClick={handleDelete}
                            disabled={isSaving || step === 3}
                        >
                            ⌫
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Welcome;