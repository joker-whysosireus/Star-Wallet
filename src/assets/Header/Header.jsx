import React from 'react';
import { FaUser, FaCog } from 'react-icons/fa';
import './Header.css';

const Header = ({ userData }) => {
    return (
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
                    <button className="icon-button settings-button" title="Settings">
                        <FaCog className="settings-icon" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;