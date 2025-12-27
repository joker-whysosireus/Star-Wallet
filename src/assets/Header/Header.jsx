import React, { useState } from 'react';
import { FaUser, FaCog } from 'react-icons/fa';
import SettingsModal from './Components/SettingsModal';
import './Header.css';

const Header = ({ userData, onNetworkChange, currentNetwork = 'mainnet' }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const handleNetworkChange = (e) => {
        const selectedNetwork = e.target.value;
        if (onNetworkChange) {
            onNetworkChange(selectedNetwork);
        }
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
                        <select 
                            value={currentNetwork}
                            onChange={handleNetworkChange}
                            style={{
                                background: 'transparent',
                                color: '#FFD700',
                                border: '1px solid rgba(255, 215, 0, 0.3)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '600',
                                outline: 'none'
                            }}
                        >
                            <option value="mainnet">MAINNET</option>
                            <option value="testnet">TESTNET</option>
                        </select>
                        
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