import React, { useState } from 'react';
import { FaUser, FaCog } from 'react-icons/fa';
import SettingsModal from './Components/SettingsModal';
import './Header.css';

const Header = ({ 
    userData, 
    onNetworkChange, 
    currentNetwork = 'mainnet', 
    disableNetworkSwitch = false,
    showFilters = false,
    selectedFilter = 'all',
    setSelectedFilter,
    handleRefresh,
    isLoading = false
}) => {
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

    const handleNetworkSelectChange = (e) => {
        const selectedNetwork = e.target.value;
        if (onNetworkChange) {
            onNetworkChange(selectedNetwork);
        }
    };

    return (
        <>
            <header className="app-header">
                <div className="header-top">
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
                            {!disableNetworkSwitch && (
                                <select 
                                    value={currentNetwork}
                                    onChange={handleNetworkSelectChange}
                                    className="network-select"
                                >
                                    <option value="mainnet">MAINNET</option>
                                    <option value="testnet">TESTNET</option>
                                </select>
                            )}
                            
                            <button 
                                className="icon-button settings-button" 
                                title="Settings"
                                onClick={openModal}
                            >
                                <FaCog className="settings-icon" />
                            </button>
                        </div>
                    </div>
                </div>

                {showFilters && (
                    <div className="header-filters-container">
                        <div className="header-filters">
                            <button 
                                className={`header-filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('all')}
                            >
                                All
                            </button>
                            <button 
                                className={`header-filter-btn ${selectedFilter === 'sent' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('sent')}
                            >
                                Sent
                            </button>
                            <button 
                                className={`header-filter-btn ${selectedFilter === 'received' ? 'active' : ''}`}
                                onClick={() => setSelectedFilter('received')}
                            >
                                Received
                            </button>
                            <button 
                                className="header-refresh-button-small"
                                onClick={handleRefresh}
                                disabled={isLoading}
                            >
                                {isLoading ? '⟳' : '↻'}
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <SettingsModal 
                userData={userData}
                isOpen={isModalOpen}
                onClose={closeModal}
                onLogout={handleLogout}
                onPrivacy={handlePrivacy}
                onFAQ={handleFAQ}
                currentNetwork={currentNetwork}
            />
        </>
    );
};

export default Header;