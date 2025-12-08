import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PinSetup.css';

function PinEnter({ userData }) {
    const [pin, setPin] = useState(['', '', '', '']);
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const navigate = useNavigate();
    
    const inputRefs = useRef([]);

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
                navigate('/wallet');
            });

            return () => {
                webApp.BackButton.offClick();
                webApp.BackButton.hide();
            };
        }
    }, [navigate]);

    const handlePinChange = (index, value) => {
        if (value.length <= 1 && /^\d*$/.test(value)) {
            const newPin = [...pin];
            newPin[index] = value;
            setPin(newPin);
            setError('');

            if (value && index < 3) {
                inputRefs.current[index + 1]?.focus();
            }

            if (index === 3 && value) {
                checkPin([...newPin]);
            }
        }
    };

    const checkPin = (pinArray) => {
        const enteredPin = pinArray.join('');
        const savedPin = localStorage.getItem('wallet_pin');

        if (enteredPin === savedPin) {
            navigate('/wallet/show-seed');
        } else {
            setError('Incorrect PIN code');
            setPin(['', '', '', '']);
            setAttempts(prev => prev + 1);
            
            if (attempts >= 2) {
                setError('Too many attempts. Try again later.');
                setTimeout(() => {
                    navigate('/wallet');
                }, 2000);
            } else {
                setTimeout(() => {
                    inputRefs.current[0]?.focus();
                }, 100);
            }
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && pin[index] === '' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    return (
        <div className="pin-setup-page">
            
            <div className="page-content">
                <div className="pin-header">
                    <h1>Enter PIN code</h1>
                    <p className="pin-subtitle">Enter your 4-digit PIN to view seed phrase</p>
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

                <p className="pin-hint">
                    {attempts > 0 && `Attempts: ${attempts}/3`}
                </p>
            </div>

        </div>
    );
}

export default PinEnter;