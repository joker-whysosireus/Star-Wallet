import React, { useState } from 'react';
import { FaUser, FaCog } from 'react-icons/fa';
import SettingsModal from './Components/SettingsModal';
import './Header.css';

const Header = ({ userData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const openModal = () => {
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const handleLogout = () => {
        // Очищаем localStorage и перенаправляем на страницу логина
        localStorage.clear();
        window.location.href = '/'; // или редирект на страницу авторизации
    };

    const handlePrivacy = () => {
        // Открываем страницу с политикой конфиденциальности
        window.open('https://telegram.org/privacy', '_blank');
    };

    const handleFAQ = () => {
        // Открываем страницу с FAQ
        window.open('https://t.me/your_support', '_blank');
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