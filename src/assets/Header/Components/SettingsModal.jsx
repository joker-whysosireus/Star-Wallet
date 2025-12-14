import React from 'react';
import { FaUser, FaSignOutAlt, FaShieldAlt, FaQuestionCircle } from 'react-icons/fa';
import './SettingsModal.css';

const SettingsModal = ({ userData, isOpen, onClose, onLogout, onPrivacy, onFAQ }) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Затемняющий фон */}
            <div 
                className="modal-overlay"
                onClick={onClose}
            />
            
            {/* Само модальное окно */}
            <div className="settings-modal">
                <div className="modal-header">
                    <div className="modal-user-info">
                        <div className="modal-avatar">
                            <FaUser />
                        </div>
                        <div className="modal-username">
                            {userData?.username || 'User'}
                        </div>
                    </div>
                </div>
                
                <div className="modal-divider" />
                
                <div className="modal-content">
                    {/* Пустой блок для заполнения пространства */}
                    <div className="modal-spacer" />
                    
                    {/* Кнопки внизу */}
                    <div className="modal-buttons-container">
                        <button 
                            className="modal-button"
                            onClick={onLogout}
                        >
                            <FaSignOutAlt className="modal-button-icon" />
                            <span className="modal-button-text">Log out</span>
                        </button>
                        
                        <button 
                            className="modal-button"
                            onClick={onPrivacy}
                        >
                            <FaShieldAlt className="modal-button-icon" />
                            <span className="modal-button-text">Privacy Policy</span>
                        </button>
                        
                        <button 
                            className="modal-button"
                            onClick={onFAQ}
                        >
                            <FaQuestionCircle className="modal-button-icon" />
                            <span className="modal-button-text">FAQ</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SettingsModal;