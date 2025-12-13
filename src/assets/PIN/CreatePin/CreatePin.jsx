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
        // Auto focus first input
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
                    // All digits entered
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
                    // All digits entered, move to confirmation
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
            return;
        }
        
        if (pinStr !== confirmPinStr) {
            // PINs don't match, trigger shake animation
            triggerShake();
            // Reset confirmation after shake
            setTimeout(() => {
                setConfirmPin(['', '', '', '']);
                setActiveInput(0);
            }, 500);
            return;
        }
        
        // Save PIN to backend
        savePin(pinStr);
    };

    const triggerShake = () => {
        setShouldShake(true);
        setTimeout(() => {
            setShouldShake(false);
        }, 500);
    };

    const savePin = async (pinStr) => {
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
                // Store PIN in localStorage for quick access (temporary)
                localStorage.setItem('user_pin', pinStr);
                onPinCreated();
            } else {
                triggerShake();
            }
        } catch (error) {
            console.error('Error saving PIN:', error);
            triggerShake();
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
                    <h1>{isConfirming ? 'Enter your PIN' : 'Create your PIN'}</h1>
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
                </div>

                <div className="pin-keypad">
                    <div className="keypad-center">
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('1')}>1</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('2')}>2</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('3')}>3</button>
                        </div>
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('4')}>4</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('5')}>5</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('6')}>6</button>
                        </div>
                        <div className="keypad-row">
                            <button className="keypad-btn" onClick={() => handleNumberClick('7')}>7</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('8')}>8</button>
                            <button className="keypad-btn" onClick={() => handleNumberClick('9')}>9</button>
                        </div>
                        <div className="keypad-row centered">
                            <button className="keypad-btn zero-btn" onClick={() => handleNumberClick('0')}>0</button>
                        </div>
                    </div>

                    <div className="keypad-footer">
                        <div className="footer-left">
                            <button className="forgot-pin-btn">
                                Forgot PIN?
                            </button>
                        </div>
                        <div className="footer-right">
                            <button className="clear-btn" onClick={handleClear}>
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