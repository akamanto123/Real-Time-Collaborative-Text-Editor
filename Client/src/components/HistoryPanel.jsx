import React, { useState, useEffect } from 'react';
import { getDocumentHistory } from '../api/documentService';

const HistoryPanel = ({ documentId, onClose }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!documentId) return;
        setLoading(true);
        getDocumentHistory(documentId)
            .then(data => {
                setSessions(data.sessions || []);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [documentId]);

    const formatTime = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();

        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (isToday) return `Hôm nay lúc ${time}`;
        if (isYesterday) return `Hôm qua lúc ${time}`;
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' }) + ` lúc ${time}`;
    };

    const getSummary = (session) => {
        const parts = [];
        if (session.charsAdded > 0) parts.push(`+${session.charsAdded} ký tự`);
        if (session.charsRemoved > 0) parts.push(`-${session.charsRemoved} ký tự`);
        return parts.length > 0 ? parts.join(', ') : 'Không có thay đổi';
    };

    const getInitial = (username) => (username || '?').charAt(0).toUpperCase();

    // Tạo màu nhất quán từ clientId
    const COLORS = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];
    const getColor = (clientId) => {
        if (!clientId) return '#888';
        let hash = 0;
        for (const c of clientId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
        return COLORS[Math.abs(hash) % COLORS.length];
    };

    return (
        <div className="history-panel">
            <div className="history-header">
                <h3>📜 Lịch sử phiên bản</h3>
                <button className="history-close" onClick={onClose} title="Đóng">✕</button>
            </div>

            {loading && <div className="history-loading">⏳ Đang tải lịch sử...</div>}
            {error && <div className="history-error">❌ Lỗi: {error}</div>}

            {!loading && !error && sessions.length === 0 && (
                <div className="history-empty">
                    <div style={{ fontSize: '2em', marginBottom: 8 }}>📄</div>
                    Chưa có lịch sử chỉnh sửa nào.<br />
                    <small>Hãy bắt đầu soạn thảo tài liệu!</small>
                </div>
            )}

            {!loading && !error && sessions.length > 0 && (
                <div className="history-list">
                    {sessions.map((session, idx) => {
                        const color = getColor(session.clientId);
                        return (
                            <div key={idx} className="history-session">
                                {/* Avatar + tên */}
                                <div className="history-session-user">
                                    <div
                                        className="history-avatar"
                                        style={{ backgroundColor: color }}
                                        title={session.username}
                                    >
                                        {getInitial(session.username)}
                                    </div>
                                    <div className="history-session-info">
                                        <span className="history-username">{session.username}</span>
                                        <span className="history-time">{formatTime(session.startTime)}</span>
                                    </div>
                                </div>

                                {/* Thống kê thay đổi */}
                                <div className="history-session-stats">
                                    {session.charsAdded > 0 && (
                                        <span className="stat-added">+{session.charsAdded}</span>
                                    )}
                                    {session.charsRemoved > 0 && (
                                        <span className="stat-removed">-{session.charsRemoved}</span>
                                    )}
                                    <span className="stat-revision">
                                        Rev {session.startRevision}
                                        {session.endRevision !== session.startRevision && `–${session.endRevision}`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HistoryPanel;
