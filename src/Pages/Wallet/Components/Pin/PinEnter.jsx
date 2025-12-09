import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PinEnter.css';

const NETLIFY_FUNCTIONS_URL = 'https://ton-jacket-backend.netlify.app/.netlify/functions';

function PinEnter({ isActive, userData }) {
    const [pin, setPin] = useState(['', '', '', '']);
    const [currentInput, setCurrentInput] = useState(0);
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [isVerifying, setIsVerifying] = useState(false);
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

    const verifyPinWithAPI = async (pinString) => {
        const telegramUserId = userData?.telegram_user_id;
        
        if (!telegramUserId) {
            throw new Error('User ID not found');
        }
        
        const response = await fetch(`${NETLIFY_FUNCTIONS_URL}/verify-pin`, {
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
        
        const data = await response.json();
        return data.isValid;
    };

    const handleNumberClick = async (number) => {
        if (currentInput < 4) {
            const newPin = [...pin];
            newPin[currentInput] = number;
            setPin(newPin);
            
            if (currentInput === 3) {
                const pinString = newPin.join('');
                
                try {
                    setIsVerifying(true);
                    const isValid = await verifyPinWithAPI(pinString);
                    
                    if (isValid) {
                        setTimeout(() => {
                            navigate('/wallet/show-seed');
                        }, 300);
                    } else {
                        setError('Invalid PIN code');
                        setAttempts(attempts + 1);
                        
                        setTimeout(() => {
                            setPin(['', '', '', '']);
                            setCurrentInput(0);
                            setError('');
                        }, 1000);
                        
                        if (attempts >= 2) {
                            setTimeout(() => {
                                alert('Too many failed attempts');
                                navigate('/wallet');
                            }, 1500);
                        }
                    }
                } catch (error) {
                    setError('Error verifying PIN');
                    setTimeout(() => {
                        setPin(['', '', '', '']);
                        setCurrentInput(0);
                        setError('');
                    }, 1000);
                } finally {
                    setIsVerifying(false);
                }
            } else {
                setCurrentInput(currentInput + 1);
            }
        }
    };

    const handleDelete = () => {
        if (currentInput > 0) {
            const newPin = [...pin];
            newPin[currentInput - 1] = '';
            setPin(newPin);
            setCurrentInput(currentInput - 1);
        }
    };

    const handleForgotPin = () => {
        if (window.confirm('If you forgot your PIN, you will need to restore your wallet using seed phrase. Continue?')) {
            navigate('/wallet/show-seed');
        }
    };

    return (
        <div className="pin-enter-page">

            <div className="pin-enter-content">
                <div className="pin-header">
                    <div className="pin-icon">🔐</div>
                    <h1>Enter PIN Code</h1>
                    <p className="pin-subtitle">
                        Enter your 4-digit PIN code to view seed phrase
                    </p>
                </div>

                <div className="pin-dots-container">
                    <div className="pin-dots">
                        {pin.map((digit, index) => (
                            <div 
                                key={index} 
                                className={`pin-dot ${index < currentInput ? 'filled' : ''} ${error ? 'error' : ''}`}
                            />
                        ))}
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    {isVerifying && <p className="verifying-message">Verifying PIN...</p>}
                </div>

                <div className="pin-keyboard">
                    <div className="keyboard-row">
                        {[1, 2, 3].map(num => (
                            <button 
                                key={num}
                                className="number-btn"
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={isVerifying}
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
                                disabled={isVerifying}
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
                                disabled={isVerifying}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="keyboard-row">
                        <button 
                            className="action-btn"
                            onClick={handleForgotPin}
                            disabled={isVerifying}
                        >
                            Forgot?
                        </button>
                        <button 
                            className="number-btn"
                            onClick={() => handleNumberClick('0')}
                            disabled={isVerifying}
                        >
                            0
                        </button>
                        <button 
                            className="action-btn delete-btn"
                            onClick={handleDelete}
                            disabled={isVerifying}
                        >
                            ⌫
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PinEnter;