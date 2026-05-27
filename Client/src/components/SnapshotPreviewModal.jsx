import React, { useEffect, useRef } from 'react';

/**
 * Modal hiển thị nội dung tài liệu tại thời điểm của một snapshot (read-only preview).
 */
const SnapshotPreviewModal = ({ snapshot, onClose, onRestore, isRestoring, canRestore }) => {
    const backdropRef = useRef(null);

    // Đóng modal khi nhấn phím Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const formatDateTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const handleBackdropClick = (e) => {
        if (e.target === backdropRef.current) onClose();
    };

    return (
        <div className="snapshot-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
            <div className="snapshot-modal">
                {/* Header */}
                <div className="snapshot-modal-header">
                    <div className="snapshot-modal-title-area">
                        <span className="snapshot-modal-icon">📄</span>
                        <div>
                            <h3 className="snapshot-modal-title">
                                {snapshot.label || `Phiên bản Rev.${snapshot.revision}`}
                            </h3>
                            <p className="snapshot-modal-meta">
                                Lưu bởi <strong>{snapshot.savedBy}</strong> · {formatDateTime(snapshot.createdAt)}
                            </p>
                        </div>
                    </div>
                    <button className="snapshot-modal-close" onClick={onClose} title="Đóng (Esc)">✕</button>
                </div>

                {/* Badge "Chỉ xem" */}
                <div className="snapshot-readonly-badge">
                    <span>👁️ Chế độ xem trước – Chỉ đọc</span>
                </div>

                {/* Nội dung xem trước */}
                <div className="snapshot-modal-body">
                    <div className="snapshot-paper">
                        <div
                            className="snapshot-content"
                            dangerouslySetInnerHTML={{ __html: snapshot.content || '<p style="color:#999;font-style:italic">Tài liệu trống</p>' }}
                        />
                    </div>
                </div>

                {/* Footer với nút Khôi phục */}
                <div className="snapshot-modal-footer">
                    <button className="btn btn-cancel-snapshot" onClick={onClose} disabled={isRestoring}>
                        Đóng
                    </button>
                    {canRestore && (
                        <button
                            className="btn btn-restore-snapshot"
                            onClick={onRestore}
                            disabled={isRestoring}
                            title="Khôi phục tài liệu về phiên bản này"
                        >
                            {isRestoring ? (
                                <>⏳ Đang khôi phục...</>
                            ) : (
                                <>🔄 Khôi phục phiên bản này</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SnapshotPreviewModal;
