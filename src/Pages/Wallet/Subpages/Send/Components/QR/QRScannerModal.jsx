import React, { useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import './QRScannerModal.css';

const QRScannerModal = ({ isOpen, onClose, onScan }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const modalRef = useRef(null);
    const animationFrameRef = useRef(null);
    const isScanningRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            startCamera();
            // Добавляем обработчик клика вне модалки
            document.addEventListener('mousedown', handleClickOutside);
            // Запускаем сканирование через 500мс после старта камеры
            setTimeout(() => {
                if (isOpen) {
                    startQRScanning();
                }
            }, 500);
        } else {
            stopCamera();
            stopQRScanning();
        }

        return () => {
            stopCamera();
            stopQRScanning();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const startCamera = async () => {
        try {
            if (!('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices)) {
                alert('Camera not supported');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });

            streamRef.current = stream;
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch (err) {
            console.error('Camera error:', err);
            alert('Cannot access camera');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const startQRScanning = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        
        isScanningRef.current = true;
        
        const scanFrame = () => {
            if (!isScanningRef.current || !video.videoWidth || !video.videoHeight) {
                if (isScanningRef.current) {
                    animationFrameRef.current = requestAnimationFrame(scanFrame);
                }
                return;
            }

            // Устанавливаем размер canvas такой же как у video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Рисуем текущий кадр видео на canvas
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Получаем данные изображения
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            
            // Сканируем QR-код
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
            });

            if (code) {
                // QR-код найден!
                console.log('QR Code detected:', code.data);
                
                // Останавливаем сканирование
                stopQRScanning();
                
                // Останавливаем камеру
                stopCamera();
                
                // Очищаем и валидируем отсканированные данные
                const cleanedData = cleanQRData(code.data);
                
                // Передаем очищенные данные родителю
                onScan(cleanedData);
                
                // Закрываем модальное окно с небольшой задержкой
                setTimeout(() => {
                    onClose();
                }, 300);
                
                return;
            }

            // Продолжаем сканирование
            if (isScanningRef.current) {
                animationFrameRef.current = requestAnimationFrame(scanFrame);
            }
        };

        animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    const stopQRScanning = () => {
        isScanningRef.current = false;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    };

    const cleanQRData = (data) => {
        if (!data) return '';
        
        let cleaned = data.trim();
        
        // Извлекаем адрес из различных форматов
        const patterns = [
            // TON: ton://transfer/EQ... или ton://address/EQ...
            /ton:\/\/(?:transfer|address)\/([A-Za-z0-9_-]{48})/i,
            // Ethereum: ethereum:0x... или eth:0x...
            /(?:ethereum|eth):(0x[a-fA-F0-9]{40})/i,
            // Solana: solana:... или sol:...
            /(?:solana|sol):([1-9A-HJ-NP-Za-km-z]{32,44})/i,
            // TRON: tron:T... или trx:T...
            /(?:tron|trx):(T[1-9A-HJ-NP-Za-km-z]{33})/i,
            // Bitcoin: bitcoin:... или btc:...
            /(?:bitcoin|btc):([13][a-km-zA-HJ-NP-Z1-9]{25,34})/i,
            // BSC: bsc:0x...
            /bsc:(0x[a-fA-F0-9]{40})/i,
            // XRP: ripple:... или xrp:...
            /(?:ripple|xrp):(r[1-9A-HJ-NP-Za-km-z]{24,34})/i,
            // NEAR: near:...
            /near:([a-z0-9_-]+\.near)/i,
            // LTC: litecoin:... или ltc:...
            /(?:litecoin|ltc):([LM][a-km-zA-HJ-NP-Z1-9]{26,33})/i,
            // DOGE: dogecoin:... или doge:...
            /(?:dogecoin|doge):(D[1-9A-HJ-NP-Za-km-z]{33})/i,
            // Общий случай: protocol://address
            /^[a-z]+:\/\/([A-Za-z0-9]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = cleaned.match(pattern);
            if (match && match[1]) {
                cleaned = match[1];
                break;
            }
        }
        
        // Удаляем query параметры если есть
        if (cleaned.includes('?')) {
            cleaned = cleaned.split('?')[0];
        }
        
        // Удаляем слэши в конце
        cleaned = cleaned.replace(/\/+$/, '');
        
        return cleaned;
    };

    const handleClickOutside = (event) => {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="qr-scanner-overlay">
            <div className="qr-scanner-container" ref={modalRef}>
                <div className="qr-scanner-video-container">
                    <video 
                        ref={videoRef}
                        className="qr-scanner-video"
                        playsInline
                        muted
                    />
                    <div className="qr-scanner-frame"></div>
                    {/* Скрытый canvas для обработки изображения */}
                    <canvas 
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;