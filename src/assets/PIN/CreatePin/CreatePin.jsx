import React, { useState, useEffect } from 'react';
import './CreatePin.css';

const CreatePin = ({ userData, onPinCreated }) => {
    const [pin, setPin] = useState(['', '', '', '']);
    const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
    const [activeInput, setActiveInput] = useState(0);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [shouldShake, setShouldShake] = useState(false);

    useEffect(() => {
        if (activeInput < 4) {
            const input = document.getElementById(`pin-input-${activeInput}`);
            if (input) input.focus();
        }
    }, [activeInput]);

    const handleNumberClick = (num) => {
        if (isLoading) return;
        
        if (isConfirming) {
            const newConfirmPin = [...confirmPin];
            if (newConfirmPin[activeInput] === '') {
                newConfirmPin[activeInput] = num;
                setConfirmPin(newConfirmPin);
                
                if (activeInput < 3) {
                    setActiveInput(activeInput + 1);
                } else {
                    verifyPins();
                }
            }
        } else {
            const newPin = [...pin];
            if (newPin[activeInput] === '') {
                newPin[activeInput] = num;
                setPin(newPin);
                
                if (activeInput < 3) {
                    setActiveInput(activeInput + 1);
                } else {
                    setIsConfirming(true);
                    setActiveInput(0);
                }
            }
        }
    };

    const verifyPins = () => {
        const pinStr = pin.join('');
        const confirmPinStr = confirmPin.join('');
        
        if (pinStr.length !== 4) {
            triggerShake();
            setError('PIN must be 4 digits');
            return;
        }
        
        if (pinStr !== confirmPinStr) {
            triggerShake();
            setError('PINs do not match');
            setTimeout(() => {
                setConfirmPin(['', '', '', '']);
                setActiveInput(0);
            }, 500);
            return;
        }
        
        savePin(pinStr);
    };

    const triggerShake = () => {
        setShouldShake(true);
        setTimeout(() => {
            setShouldShake(false);
        }, 500);
    };

    const savePin = async (pinStr) => {
        if (!userData || !userData.telegram_user_id) {
            triggerShake();
            setError('User data not loaded. Please refresh.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            const response = await fetch('https://star-wallet-backend.netlify.app/.netlify/functions/set-pin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    pin_code: pinStr
                }),
            });

            const data = await response.json();
            
            if (data.success) {
                localStorage.setItem('user_pin', pinStr);
                localStorage.setItem('pin_verified', 'true');
                onPinCreated();
            } else {
                triggerShake();
                setError(data.error || 'Failed to save PIN');
            }
        } catch (error) {
            triggerShake();
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        if (isConfirming) {
            setConfirmPin(['', '', '', '']);
            setActiveInput(0);
        } else {
            setPin(['', '', '', '']);
            setActiveInput(0);
        }
        setError('');
    };

    return (
        <div className="pin-page">
            <div className="page-content">
                <div className="pin-header">
                    <h1>{isConfirming ? 'Confirm your PIN' : 'Create your PIN'}</h1>
                </div>

                <div className="pin-display-container">
                    <div className={`pin-dots ${shouldShake ? 'shake' : ''} ${isLoading ? 'loading' : ''}`}>
                        {(isConfirming ? confirmPin : pin).map((digit, index) => (
                            <div 
                                key={index} 
                                className={`pin-dot ${digit ? 'filled' : ''} ${shouldShake ? 'error' : ''}`}
                            />
                        ))}
                    </div>
                    {error && <div className="pin-error">{error}</div>}
                </div>

                <div className="pin-keypad">
                    <div className="keypad-center">
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('1')} disabled={isLoading}>1</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('2')} disabled={isLoading}>2</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('3')} disabled={isLoading}>3</button>
                        </div>
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('4')} disabled={isLoading}>4</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('5')} disabled={isLoading}>5</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('6')} disabled={isLoading}>6</button>
                        </div>
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('7')} disabled={isLoading}>7</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('8')} disabled={isLoading}>8</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('9')} disabled={isLoading}>9</button>
                        </div>
                        <div className="keypad-row centered">
                            <button className="keypad-btn zero-btn" onClick={() => handleNumberClick('0')} disabled={isLoading}>0</button>
                        </div>
                    </div>

                    <div className="keypad-footer">
                        <div className="footer-left">
                            <button className="forgot-pin-btn" disabled={isLoading}>
                                Forgot PIN?
                            </button>
                        </div>
                        <div className="footer-right">
                            <button className="clear-btn" onClick={handleClear} disabled={isLoading}>
                                Clear
                            </button>
                        </div>
                    </div>
                </div>

                {isLoading && (
                    <div className="loading-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreatePin;