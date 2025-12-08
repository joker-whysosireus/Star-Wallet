import React, { useState, useEffect } from 'react';
import './SeedPhraseInfo.css';

const SeedPhraseInfo = ({ onShowSeedPhrase }) => {
    const [showSeedModal, setShowSeedModal] = useState(false);
    const [showInstructionModal, setShowInstructionModal] = useState(false);
    const [tonSeed, setTonSeed] = useState('');
    const [solanaSeed, setSolanaSeed] = useState('');

    // Генерация или получение сид-фраз (примерная логика)
    const generateSeeds = () => {
        // В реальном приложении здесь нужно получать сид-фразы из хранилища
        // или генерировать их на основе мастер-сид-фразы
        const mockTonSeed = "bunker save hidden loyal bitter pattern vessel alert track burden apple orphan";
        const mockSolanaSeed = "crime paddle quiz vital violin siren average guard attend output welcome cancel";
        
        setTonSeed(mockTonSeed);
        setSolanaSeed(mockSolanaSeed);
    };

    const handleShowSeedClick = () => {
        generateSeeds();
        setShowSeedModal(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Сид-фраза скопирована');
    };

    const InstructionModal = () => (
        <div className="modal-overlay" onClick={() => setShowInstructionModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">📖 Инструкция по безопасности</h3>
                <div className="instruction-content">
                    <div className="instruction-item">
                        <span className="instruction-icon">🔒</span>
                        <p><strong>Никогда не делитесь сид-фразой</strong><br/>
                        Любой, у кого есть ваша сид-фраза, получит полный доступ к вашим средствам.</p>
                    </div>
                    <div className="instruction-item">
                        <span className="instruction-icon">💾</span>
                        <p><strong>Храните в надежном месте</strong><br/>
                        Запишите на бумаге или используйте аппаратный кошелек. Не храните в облаке.</p>
                    </div>
                    <div className="instruction-item">
                        <span className="instruction-icon">🔄</span>
                        <p><strong>Регулярно делайте резервные копии</strong><br/>
                        Обновляйте копии при создании новых адресов.</p>
                    </div>
                    <div className="instruction-item">
                        <span className="instruction-icon">⚠️</span>
                        <p><strong>Будьте осторожны с фишингом</strong><br/>
                        Никогда не вводите сид-фразу на подозрительных сайтах.</p>
                    </div>
                </div>
                <button className="modal-close-btn" onClick={() => setShowInstructionModal(false)}>
                    Понятно
                </button>
            </div>
        </div>
    );

    const SeedModal = () => (
        <div className={`seed-modal-overlay ${showSeedModal ? 'visible' : ''}`} onClick={() => setShowSeedModal(false)}>
            <div className="seed-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3 className="modal-title">🔐 Сид-фразы ваших кошельков</h3>
                <p className="modal-subtitle">Скопируйте и сохраните в безопасном месте</p>
                
                <div className="seed-blocks">
                    <div className="seed-block">
                        <div className="seed-block-header">
                            <div className="seed-icon-ton">💎</div>
                            <h4>TON Сид-фраза</h4>
                        </div>
                        <div className="seed-phrase-text">{tonSeed}</div>
                        <button className="copy-seed-btn" onClick={() => copyToClipboard(tonSeed)}>
                            📋 Скопировать TON сид-фразу
                        </button>
                    </div>
                    
                    <div className="seed-block">
                        <div className="seed-block-header">
                            <div className="seed-icon-sol">⚡</div>
                            <h4>Solana Сид-фраза</h4>
                        </div>
                        <div className="seed-phrase-text">{solanaSeed}</div>
                        <button className="copy-seed-btn" onClick={() => copyToClipboard(solanaSeed)}>
                            📋 Скопировать Solana сид-фразу
                        </button>
                    </div>
                </div>
                
                <div className="seed-warning">
                    <span className="warning-icon">⚠️</span>
                    <p><strong>Внимание:</strong> Никогда не делитесь этими фразами ни с кем!</p>
                </div>
                
                <button className="modal-close-btn" onClick={() => setShowSeedModal(false)}>
                    Закрыть
                </button>
            </div>
        </div>
    );

    return (
        <div className="seed-phrase-info">
            <div className="seed-header">
                <div className="seed-icon">🔐</div>
                <div className="seed-text-content">
                    <h3 className="seed-title">Ваша сид-фраза</h3>
                    <p className="seed-description">
                        Это ключ к вашим кошелькам TON и Solana. Сохраните её в безопасном месте.
                    </p>
                </div>
            </div>
            
            <div className="seed-actions">
                <button 
                    className="seed-btn show-seed-btn"
                    onClick={handleShowSeedClick}
                >
                    👁️ Показать сид-фразу
                </button>
                <button 
                    className="seed-btn instructions-btn"
                    onClick={() => setShowInstructionModal(true)}
                >
                    📖 Инструкция
                </button>
            </div>

            {showSeedModal && <SeedModal />}
            {showInstructionModal && <InstructionModal />}
        </div>
    );
};

export default SeedPhraseInfo;