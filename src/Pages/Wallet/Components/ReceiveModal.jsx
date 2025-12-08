import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './ReceiveModal.css';

const ReceiveModal = ({ isOpen, onClose, wallet }) => {
    if (!isOpen || !wallet) return null;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(wallet.address);
        alert('Адрес скопирован в буфер обмена!');
    };

    return (
        <div className="receive-modal-overlay">
            <div className="receive-modal">
                <h3>Получить {wallet.symbol}</h3>
                <div className="qr-code-container">
                    <QRCodeSVG value={wallet.address} size={220} />
                </div>
                <p className="address-display">{wallet.address}</p>
                <button onClick={copyToClipboard} className="copy-button">
                    📋 Копировать адрес
                </button>
                <button onClick={onClose} className="close-button">
                    Закрыть
                </button>
                <p className="network-note">Сеть: {wallet.blockchain} Mainnet</p>
            </div>
        </div>
    );
};

export default ReceiveModal;