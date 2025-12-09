import React from 'react';
import './Loader.css';

const Loader = () => {
    return (
        <div className="loader-container">
            <div className="loader-wrapper">
                <div className="loader"></div>
                <p className="loader-text">Loading...</p>
            </div>
        </div>
    );
};

export default Loader;