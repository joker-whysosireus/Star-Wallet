import React, { useEffect, useRef } from 'react';
import './QRScannerModal.css';

const QRScannerModal = ({ isOpen, onClose, onScan }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const modalRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            startCamera();
            // Добавляем обработчик клика вне модалки
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            stopCamera();
        }

        return () => {
            stopCamera();
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
                videoRef.current.play();
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
                </div>
            </div>
        </div>
    );
};

export default QRScannerModal;