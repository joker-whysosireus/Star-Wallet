import React, { useState, useEffect } from 'react';
import './EnterPin.css';

const EnterPin = ({ userData, onPinVerified }) => {
    const [pin, setPin] = useState(['', '', '', '']);
    const [activeInput, setActiveInput] = useState(0);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [lockTime, setLockTime] = useState(0);
    const [shouldShake, setShouldShake] = useState(false);

    useEffect(() => {
        // Auto focus first input
        if (activeInput < 4 && !isLocked) {
            const input = document.getElementById(`pin-input-${activeInput}`);
            if (input) input.focus();
        }
    }, [activeInput, isLocked]);

    useEffect(() => {
        // Handle lock timer
        if (isLocked && lockTime > 0) {
            const timer = setTimeout(() => {
                setLockTime(lockTime - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (isLocked && lockTime === 0) {
            setIsLocked(false);
            setAttempts(0);
            setError('');
        }
    }, [isLocked, lockTime]);

    const handleNumberClick = (num) => {
        if (isLocked || isLoading) return;
        
        const newPin = [...pin];
        if (newPin[activeInput] === '') {
            newPin[activeInput] = num;
            setPin(newPin);
            
            if (activeInput < 3) {
                setActiveInput(activeInput + 1);
            } else {
                // All digits entered, verify PIN
                verifyPin(newPin.join(''));
            }
        }
    };

    const handleClear = () => {
        if (isLocked || isLoading) return;
        
        setPin(['', '', '', '']);
        setActiveInput(0);
        setError('');
    };

    const triggerShake = () => {
        setShouldShake(true);
        setTimeout(() => {
            setShouldShake(false);
            // Clear PIN after shake
            setPin(['', '', '', '']);
            setActiveInput(0);
        }, 500);
    };

    const verifyPin = async (pinStr) => {
        if (isLocked) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            console.log('EnterPin: Verifying PIN for user:', userData.telegram_user_id);
            console.log('EnterPin: PIN to verify:', pinStr);
            
            const response = await fetch('https://star-wallet-backend.netlify.app/.netlify/functions/verify-pin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    pin_code: pinStr
                }),
            });

            console.log('EnterPin: Response status:', response.status);
            
            const data = await response.json();
            console.log('EnterPin: Response data:', data);
            
            if (data.success) {
                console.log('EnterPin: PIN verified successfully');
                // Store PIN verification in localStorage (temporary)
                localStorage.setItem('pin_verified', 'true');
                onPinVerified();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                
                if (newAttempts >= 3) {
                    // Lock for 30 seconds
                    setIsLocked(true);
                    setLockTime(30);
                    setError('Too many attempts. Wallet locked for 30 seconds.');
                } else {
                    // Trigger shake animation for incorrect PIN
                    triggerShake();
                    setError(`Incorrect PIN. ${3 - newAttempts} attempts remaining.`);
                }
            }
        } catch (error) {
            console.error('EnterPin: Error verifying PIN:', error);
            triggerShake();
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="pin-page">
            <div className="page-content">
                <div className="pin-header">
                    <h1>Enter your PIN</h1>
                </div>

                <div className="pin-display-container">
                    <div className={`pin-dots ${shouldShake ? 'shake' : ''} ${isLoading ? 'loading' : ''}`}>
                        {pin.map((digit, index) => (
                            <div 
                                key={index} 
                                className={`pin-dot ${digit ? 'filled' : ''} ${shouldShake ? 'error' : ''}`}
                            />
                        ))}
                    </div>
                    {error && <div className="pin-error">{error}</div>}
                </div>

                {isLocked ? (
                    <div className="lock-timer">
                        <p>Wallet locked for {lockTime} seconds</p>
                    </div>
                ) : !isLoading && (
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
                )}

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

export default EnterPin;