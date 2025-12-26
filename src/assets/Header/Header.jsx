import React, { useState } from 'react';
import { FaUser, FaCog } from 'react-icons/fa';
import SettingsModal from './Components/SettingsModal';
import './Header.css';

const Header = ({ userData, onNetworkChange, currentNetwork = 'mainnet' }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/';
    };

    const handlePrivacy = () => {
        window.open('https://telegram.org/privacy', '_blank');
    };

    const handleFAQ = () => {
        window.open('https://t.me/your_support', '_blank');
    };

    const handleNetworkSelect = (network) => {
        if (onNetworkChange) {
            onNetworkChange(network);
        }
        setShowNetworkDropdown(false);
    };

    return (
        <>
            <header className="app-header">
                <div className="header-content">
                    <div className="header-left">
                        <div className="avatar-square">
                            <FaUser className="user-icon" />
                        </div>
                        <div className="user-info">
                            <span className="username">
                                {userData?.username || 'User'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <div className="network-selector">
                            <button 
                                className="network-button"
                                onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
                            >
                                <span className="network-text">
                                    {currentNetwork === 'mainnet' ? 'MAINNET' : 'TESTNET'}
                                </span>
                            </button>
                            
                            {showNetworkDropdown && (
                                <div className="network-dropdown">
                                    <button 
                                        className={`network-option ${currentNetwork === 'mainnet' ? 'active' : ''}`}
                                        onClick={() => handleNetworkSelect('mainnet')}
                                    >
                                        <span className="network-option-text">MAINNET</span>
                                    </button>
                                    <button 
                                        className={`network-option ${currentNetwork === 'testnet' ? 'active' : ''}`}
                                        onClick={() => handleNetworkSelect('testnet')}
                                    >
                                        <span className="network-option-text">TESTNET</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <button 
                            className="icon-button settings-button" 
                            title="Settings"
                            onClick={openModal}
                        >
                            <FaCog className="settings-icon" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Импортированное модальное окно */}
            <SettingsModal 
                userData={userData}
                isOpen={isModalOpen}
                onClose={closeModal}
                onLogout={handleLogout}
                onPrivacy={handlePrivacy}
                onFAQ={handleFAQ}
            />
        </>
    );
};

export default Header;