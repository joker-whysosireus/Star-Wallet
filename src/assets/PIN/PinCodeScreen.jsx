import React, { useState, useEffect, useCallback } from 'react';
import './PinCodeScreen.css';

const PinCodeScreen = ({ 
    userData, 
    onPinVerified, 
    onPinCreated,
    mode = 'verify'
}) => {
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [step, setStep] = useState(1);
    const [errorState, setErrorState] = useState(false);

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
            setTitle('');
            setSubtitle('');
        }
    }, [mode, step]);

    const handleNumberClick = useCallback((number) => {
        if (pin.length < 4) {
            setPin(prev => prev + number);
            setErrorState(false);
        }
    }, [pin.length]);

    const handleDelete = useCallback(() => {
        setPin(prev => prev.slice(0, -1));
        setErrorState(false);
    }, []);

    const handleClear = useCallback(() => {
        setPin('');
        setErrorState(false);
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
            return;
        }

        setLoading(true);
        setErrorState(false);

        try {
            if (mode === 'create') {
                if (step === 1) {
                    setConfirmPin(pin);
                    setPin('');
                    setStep(2);
                } else {
                    if (pin !== confirmPin) {
                        setErrorState(true);
                        setTimeout(() => {
                            setStep(1);
                            setPin('');
                            setConfirmPin('');
                            setErrorState(false);
                        }, 500);
                    } else {
                        const result = await savePin(pin);
                        if (result.success) {
                            onPinCreated(pin);
                        } else {
                            setErrorState(true);
                            setTimeout(() => {
                                setPin('');
                                setErrorState(false);
                            }, 500);
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
                    setErrorState(true);
                    setTimeout(() => {
                        setPin('');
                        setErrorState(false);
                    }, 500);
                }
            }
        } catch (error) {
            setErrorState(true);
            setTimeout(() => {
                setPin('');
                setErrorState(false);
            }, 500);
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
                        className={`pin-circle ${i <= pin.length ? 'filled' : ''} ${loading ? 'bounce' : ''} ${errorState ? 'error' : ''}`}
                        style={{ animationDelay: loading ? `${(i-1)*0.1}s` : '0s' }}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="pin-screen">
            <div className="pin-container">
                <div className="pin-header">
                    <h1 className="pin-title">{title}</h1>
                    {subtitle && <p className="pin-subtitle">{subtitle}</p>}
                </div>

                <div className="pin-content">
                    {renderPinCircles()}
                </div>

                <div className="pin-keypad">
                    <div className="keypad-row">
                        {[1, 2, 3].map(num => (
                            <button
                                key={num}
                                className="pin-key"
                                onClick={() => handleNumberClick(num.toString())}
                                disabled={loading || errorState}
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
                                disabled={loading || errorState}
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
                                disabled={loading || errorState}
                            >
                                {num}
                            </button>
                        ))}
                    </div>
                    <div className="keypad-row">
                        <button 
                            className="pin-key clear-key"
                            onClick={handleClear}
                            disabled={loading || errorState}
                        >
                            Clear
                        </button>
                        <button
                            className="pin-key"
                            onClick={() => handleNumberClick('0')}
                            disabled={loading || errorState}
                        >
                            0
                        </button>
                        <button 
                            className="pin-key delete-key"
                            onClick={handleDelete}
                            disabled={loading || errorState || pin.length === 0}
                        >
                            ←
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PinCodeScreen;