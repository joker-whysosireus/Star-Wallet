import React, { useState, useEffect, useCallback } from 'react';
import './PinCodeScreen.css';

const PinCodeScreen = ({ 
    userData, 
    onPinVerified, 
    onPinCreated,
    mode = 'verify'
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (mode === 'create') {
            if (step === 1) {
                setTitle('Create PIN Code');
                setSubtitle('Enter a 4-digit PIN to secure your wallet');
            } else {
                setTitle('Confirm PIN Code');
                setSubtitle('Re-enter your PIN to confirm');
            }
        } else {
            setTitle('Enter PIN Code');
            setSubtitle('Enter your 4-digit PIN to continue');
        }
    }, [mode, step]);

    const handleNumberClick = useCallback((number) => {
        if (pin.length < 4) {
            setPin(prev => prev + number);
            setError('');
        }
    }, [pin.length]);

    const handleDelete = useCallback(() => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    }, []);

    const handleClear = useCallback(() => {
        setPin('');
        setError('');
    }, []);

    const PIN_API_URL = 'https://star-wallet-backend.netlify.app/.netlify/functions';

    const verifyPin = async (pinCode) => {
        try {
            const response = await fetch(`${PIN_API_URL}/verify-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    pin_code: pinCode
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error verifying PIN:', error);
            throw error;
        }
    };

    const savePin = async (pinCode) => {
        try {
            const response = await fetch(`${PIN_API_URL}/save-pin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_user_id: userData.telegram_user_id,
                    pin_code: pinCode
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving PIN:', error);
            throw error;
        }
    };

    const handleSubmit = useCallback(async () => {
        if (pin.length !== 4) {
            setError('Please enter 4 digits');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (mode === 'create') {
                if (step === 1) {
                    setConfirmPin(pin);
                    setPin('');
                    setStep(2);
                } else {
                    if (pin !== confirmPin) {
                        setError('PIN codes do not match. Try again.');
                        setStep(1);
                        setPin('');
                        setConfirmPin('');
                    } else {
                        const result = await savePin(pin);
                        if (result.success) {
                            onPinCreated(pin);
                        } else {
                            setError('Failed to save PIN code. Please try again.');
                        }
                    }
                }
            } else {
                const result = await verifyPin(pin);
                if (result.isValid) {
                    onPinVerified(pin);
                } else if (result.pinNotSet) {
                    setTitle('Create PIN Code');
                    setSubtitle('Set up a 4-digit PIN to secure your wallet');
                    setPin('');
                } else {
                    setError('Invalid PIN code. Try again.');
                    setPin('');
                }
            }
        } catch (error) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [pin, mode, step, confirmPin, userData, onPinVerified, onPinCreated]);

    useEffect(() => {
        if (pin.length === 4) {
            handleSubmit();
        }
    }, [pin, handleSubmit]);

    const renderPinCircles = () => {
        return (
            <div className="pin-circles-container">
                {[1, 2, 3, 4].map((i) => (
                    <div 
                        key={i} 
                        className={`pin-circle ${i <= pin.length ? 'filled' : ''}`}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="pin-screen">
            <div className="pin-header">
                <h1 className="pin-title">{title}</h1>
                <p className="pin-subtitle">{subtitle}</p>
            </div>

            <div className="pin-content">
                {renderPinCircles()}
                
                {error && (
                    <div className="pin-error">
                        <span className="error-icon">!</span>
                        <span className="error-text">{error}</span>
                    </div>
                )}

                {loading && (
                    <div className="pin-loading">
                        <div className="loading-spinner"></div>
                        <span className="loading-text">Verifying...</span>
                    </div>
                )}
            </div>

            <div className="pin-keypad">
                <div className="keypad-row">
                    {[1, 2, 3].map(num => (
                        <button
                            key={num}
                            className="pin-key"
                            onClick={() => handleNumberClick(num.toString())}
                            disabled={loading}
                        >
                            {num}
                        </button>
                    ))}
                </div>
                <div className="keypad-row">
                    {[4, 5, 6].map(num => (
                        <button
                            key={num}
                            className="pin-key"
                            onClick={() => handleNumberClick(num.toString())}
                            disabled={loading}
                        >
                            {num}
                        </button>
                    ))}
                </div>
                <div className="keypad-row">
                    {[7, 8, 9].map(num => (
                        <button
                            key={num}
                            className="pin-key"
                            onClick={() => handleNumberClick(num.toString())}
                            disabled={loading}
                        >
                            {num}
                        </button>
                    ))}
                </div>
                <div className="keypad-row">
                    <button 
                        className="pin-key clear-key"
                        onClick={handleClear}
                        disabled={loading}
                    >
                        Clear
                    </button>
                    <button
                        className="pin-key"
                        onClick={() => handleNumberClick('0')}
                        disabled={loading}
                    >
                        0
                    </button>
                    <button 
                        className="pin-key delete-key"
                        onClick={handleDelete}
                        disabled={loading || pin.length === 0}
                    >
                        ←
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PinCodeScreen;