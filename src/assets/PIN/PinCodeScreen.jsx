import React, { useState, useEffect, useRef } from 'react';
import './PinCodeScreen.css';

const PinCodeScreen = ({ 
    mode = 'enter',
    title = 'Enter Passcode',
    message = '',
    onComplete,
    onCancel,
    showForgotButton = true
}) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [currentMode, setCurrentMode] = useState(mode);
    const [currentTitle, setCurrentTitle] = useState(title);
    const [currentMessage, setCurrentMessage] = useState(message);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const pinDotsRef = useRef([]);

    // Добавляем шрифт в head
    useEffect(() => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        return () => {
            document.head.removeChild(link);
        };
    }, []);

    useEffect(() => {
        setPin('');
        setConfirmPin('');
        setError('');
        setCurrentTitle(title);
        setCurrentMessage(message);
    }, [mode, title, message]);

    const handleNumberClick = (number) => {
        setError('');
        
        if (currentMode === 'create' && pin.length < 4) {
            const newPin = pin + number;
            setPin(newPin);
            updatePinDots(newPin.length);
            
            if (newPin.length === 4) {
                setTimeout(() => {
                    setCurrentMode('confirm');
                    setCurrentTitle('Confirm Passcode');
                    setCurrentMessage('Enter your passcode again to confirm');
                    setPin('');
                    resetPinDots();
                }, 300);
            }
        } else if (currentMode === 'confirm' && confirmPin.length < 4) {
            const newConfirmPin = confirmPin + number;
            setConfirmPin(newConfirmPin);
            updatePinDots(newConfirmPin.length);
            
            if (newConfirmPin.length === 4) {
                if (pin === newConfirmPin) {
                    handleComplete(newConfirmPin);
                } else {
                    setError('Passcodes do not match');
                    setCurrentMode('create');
                    setCurrentTitle('Create Passcode');
                    setCurrentMessage('');
                    setPin('');
                    setConfirmPin('');
                    resetPinDots();
                }
            }
        } else if (currentMode === 'enter' && pin.length < 4) {
            const newPin = pin + number;
            setPin(newPin);
            updatePinDots(newPin.length);
            
            if (newPin.length === 4) {
                handleComplete(newPin);
            }
        }
    };

    const handleDelete = () => {
        setError('');
        
        if (currentMode === 'create' && pin.length > 0) {
            const newPin = pin.slice(0, -1);
            setPin(newPin);
            updatePinDots(newPin.length);
        } else if (currentMode === 'confirm' && confirmPin.length > 0) {
            const newConfirmPin = confirmPin.slice(0, -1);
            setConfirmPin(newConfirmPin);
            updatePinDots(newConfirmPin.length);
        } else if (currentMode === 'enter' && pin.length > 0) {
            const newPin = pin.slice(0, -1);
            setPin(newPin);
            updatePinDots(newPin.length);
        }
    };

    const handleComplete = async (completedPin) => {
        setIsLoading(true);
        
        try {
            await onComplete(completedPin);
        } catch (error) {
            setError(error.message || 'An error occurred');
            setPin('');
            setConfirmPin('');
            resetPinDots();
            
            pinDotsRef.current.forEach(dot => {
                if (dot) {
                    dot.classList.add('error');
                    setTimeout(() => {
                        dot.classList.remove('error');
                    }, 500);
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    const updatePinDots = (filledCount) => {
        pinDotsRef.current.forEach((dot, index) => {
            if (dot) {
                if (index < filledCount) {
                    dot.classList.add('filled');
                } else {
                    dot.classList.remove('filled');
                }
                dot.classList.remove('error');
            }
        });
    };

    const resetPinDots = () => {
        pinDotsRef.current.forEach(dot => {
            if (dot) {
                dot.classList.remove('filled', 'error');
            }
        });
    };

    const renderPinDots = () => {
        const length = currentMode === 'confirm' ? confirmPin.length : pin.length;
        
        return (
            <div className="pin-dots-container">
                <div className="pin-dots">
                    {[0, 1, 2, 3].map((index) => (
                        <div 
                            key={index}
                            ref={el => pinDotsRef.current[index] = el}
                            className={`pin-dot ${index < length ? 'filled' : ''}`}
                        />
                    ))}
                </div>
            </div>
        );
    };

    const renderKeypad = () => {
        const numbers = [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
            [0, 'delete']
        ];

        return (
            <div className="keypad">
                {numbers.map((row, rowIndex) => (
                    <div key={rowIndex} className="keypad-row">
                        {row.map((item) => {
                            if (item === 'delete') {
                                return (
                                    <button
                                        key="delete"
                                        className="keypad-button delete-button"
                                        onClick={handleDelete}
                                        disabled={isLoading || ((currentMode === 'create' || currentMode === 'enter') && pin.length === 0) || (currentMode === 'confirm' && confirmPin.length === 0)}
                                    >
                                        ⌫
                                    </button>
                                );
                            }
                            
                            return (
                                <button
                                    key={item}
                                    className="keypad-button"
                                    onClick={() => handleNumberClick(item.toString())}
                                    disabled={isLoading}
                                >
                                    {item}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="pin-code-screen">
            <div className="pin-code-container">
                <div className="pin-header">
                    <h1 className="pin-title">{currentTitle}</h1>
                    {currentMessage && <p className="pin-message">{currentMessage}</p>}
                    {error && <p className="pin-error">{error}</p>}
                </div>
                
                <div className="pin-input-area">
                    {renderPinDots()}
                </div>
                
                <div className="pin-keypad-area">
                    {renderKeypad()}
                </div>
                
                <div className="pin-footer">
                    {showForgotButton && currentMode === 'enter' && (
                        <button 
                            className="forgot-pin-button"
                            onClick={() => {
                                setCurrentMessage('Please contact support to reset your passcode.');
                            }}
                            disabled={isLoading}
                        >
                            Forgot Passcode?
                        </button>
                    )}
                    
                    {onCancel && (
                        <button 
                            className="cancel-button"
                            onClick={onCancel}
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                    )}
                </div>
                
                {isLoading && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PinCodeScreen;