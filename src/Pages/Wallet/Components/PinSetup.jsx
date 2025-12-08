import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../../assets/Header/Header';
import Menu from '../../../assets/Menus/Menu/Menu';
import './PinSetup.css';

function PinSetup({ userData }) {
    const [pin, setPin] = useState(['', '', '', '']);
    const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    const inputRefs = useRef([]);
    const confirmInputRefs = useRef([]);

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
                if (step === 1) {
                    navigate('/wallet');
                } else {
                    setStep(1);
                    setConfirmPin(['', '', '', '']);
                }
            });

            return () => {
                webApp.BackButton.offClick();
                webApp.BackButton.hide();
            };
        }
    }, [navigate, step]);

    const handlePinChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newPin = [...pin];
            newPin[index] = value;
            setPin(newPin);
            setError('');

            if (value && index < 3) {
                inputRefs.current[index + 1]?.focus();
            }
        }
    };

    const handleConfirmPinChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newConfirmPin = [...confirmPin];
            newConfirmPin[index] = value;
            setConfirmPin(newConfirmPin);
            setError('');

            if (value && index < 3) {
                confirmInputRefs.current[index + 1]?.focus();
            }
        }
    };

    const handleSetPin = () => {
        if (pin.some(digit => digit === '')) {
            setError('Please enter 4-digit PIN');
            return;
        }

        setStep(2);
        setTimeout(() => {
            confirmInputRefs.current[0]?.focus();
        }, 100);
    };

    const handleConfirmPin = () => {
        if (confirmPin.some(digit => digit === '')) {
            setError('Please confirm your 4-digit PIN');
            return;
        }

        const enteredPin = pin.join('');
        const confirmedPin = confirmPin.join('');

        if (enteredPin !== confirmedPin) {
            setError('PIN codes do not match');
            return;
        }

        try {
            localStorage.setItem('wallet_pin', enteredPin);
            localStorage.setItem('wallet_pin_set', 'true');
            
            navigate('/wallet/show-seed');
        } catch (error) {
            console.error('Error saving PIN:', error);
            setError('Failed to save PIN');
        }
    };

    const handleKeyDown = (e, index, isConfirm = false) => {
        if (e.key === 'Backspace' && !isConfirm && pin[index] === '' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Backspace' && isConfirm && confirmPin[index] === '' && index > 0) {
            confirmInputRefs.current[index - 1]?.focus();
        }
    };

    return (
        <div className="page-container">
            <Header userData={userData} />
            
            <div className="page-content">
                {step === 1 ? (
                    <>
                        <div className="pin-header">
                            <h1>Set up PIN code</h1>
                            <p className="pin-subtitle">Create a 4-digit PIN to protect your wallet</p>
                        </div>

                        <div className="pin-input-container">
                            {pin.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => inputRefs.current[index] = el}
                                    type="password"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handlePinChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, index)}
                                    className="pin-digit"
                                    autoFocus={index === 0}
                                />
                            ))}
                        </div>

                        {error && <p className="error-message">{error}</p>}

                        <button 
                            className="pin-continue-btn"
                            onClick={handleSetPin}
                            disabled={pin.some(digit => digit === '')}
                        >
                            Continue
                        </button>
                    </>
                ) : (
                    <>
                        <div className="pin-header">
                            <h1>Confirm PIN code</h1>
                            <p className="pin-subtitle">Enter your PIN again to confirm</p>
                        </div>

                        <div className="pin-input-container">
                            {confirmPin.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => confirmInputRefs.current[index] = el}
                                    type="password"
                                    maxLength="1"
                                    value={digit}
                                    onChange={(e) => handleConfirmPinChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, index, true)}
                                    className="pin-digit"
                                />
                            ))}
                        </div>

                        {error && <p className="error-message">{error}</p>}

                        <button 
                            className="pin-continue-btn"
                            onClick={handleConfirmPin}
                            disabled={confirmPin.some(digit => digit === '')}
                        >
                            Confirm
                        </button>
                    </>
                )}
            </div>

            <Menu />
        </div>
    );
}

export default PinSetup;