import React, { useState } from 'react';
import './SendForm.css';

const SendForm = ({ wallet, isOpen, onClose, onSuccess }) => {
    const [toAddress, setToAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen || !wallet) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Здесь будет логика отправки
        alert(`Функция отправки ${wallet.symbol} в разработке`);
        onClose();
    };

    return (
        <div className="send-form-overlay">
            <div className="send-form">
                <h3>Отправить {wallet.symbol}</h3>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        placeholder="Адрес получателя"
                        value={toAddress}
                        onChange={(e) => setToAddress(e.target.value)}
                    />
                    <input 
                        type="number"
                        step="any"
                        placeholder={`Сумма ${wallet.symbol}`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Отправка...' : 'Отправить'}
                    </button>
                    <button type="button" onClick={onClose}>
                        Отмена
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SendForm;