import React, { useState, useEffect, useCallback } from 'react';
import { getDocumentHistory, getDocumentSnapshots, getSnapshotContent, restoreSnapshot } from '../api/documentService';
import SnapshotPreviewModal from './SnapshotPreviewModal';

const HistoryPanel = ({ documentId, onClose, role, onRestored }) => {
    const [activeTab, setActiveTab] = useState('snapshots'); // 'snapshots' | 'activity'

    // ── Snapshots tab state ────────────────────────────────────────────────────
    const [snapshots, setSnapshots] = useState([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [snapshotsError, setSnapshotsError] = useState(null);

    // ── Preview modal state ────────────────────────────────────────────────────
    const [previewSnapshot, setPreviewSnapshot] = useState(null); // full snapshot với content
    const [previewLoading, setPreviewLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // ── Activity tab state ─────────────────────────────────────────────────────
    const [sessions, setSessions] = useState([]);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activityError, setActivityError] = useState(null);

    // Tải snapshots khi mở tab snapshots
    const loadSnapshots = useCallback(() => {
        if (!documentId) return;
        setSnapshotsLoading(true);
        setSnapshotsError(null);
        getDocumentSnapshots(documentId)
            .then(data => {
                setSnapshots(data.snapshots || []);
                setSnapshotsLoading(false);
            })
            .catch(err => {
                setSnapshotsError(err.message);
                setSnapshotsLoading(false);
            });
    }, [documentId]);

    // Tải activity log khi chuyển sang tab activity
    const loadActivity = useCallback(() => {
        if (!documentId) return;
        setActivityLoading(true);
        setActivityError(null);
        getDocumentHistory(documentId)
            .then(data => {
                setSessions(data.sessions || []);
                setActivityLoading(false);
            })
            .catch(err => {
                setActivityError(err.message);
                setActivityLoading(false);
            });
    }, [documentId]);

    // Load data khi mount hoặc đổi tab
    useEffect(() => {
        if (activeTab === 'snapshots') loadSnapshots();
        else loadActivity();
    }, [activeTab, loadSnapshots, loadActivity]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handlePreview = async (snapshot) => {
        setPreviewLoading(true);
        try {
            const fullSnapshot = await getSnapshotContent(documentId, snapshot._id);
            setPreviewSnapshot(fullSnapshot);
        } catch (err) {
            alert('Không thể tải nội dung phiên bản: ' + err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRestore = async () => {
        if (!previewSnapshot) return;
        const confirmed = window.confirm(
            `Bạn có chắc muốn khôi phục tài liệu về phiên bản:\n"${previewSnapshot.label || `Rev.${previewSnapshot.revision}`}"?\n\nPhiên bản hiện tại sẽ được tự động sao lưu.`
        );
        if (!confirmed) return;

        setIsRestoring(true);
        try {
            await restoreSnapshot(documentId, previewSnapshot._id);
            setPreviewSnapshot(null);
            onRestored && onRestored();
            onClose();
        } catch (err) {
            alert('Khôi phục thất bại: ' + err.message);
        } finally {
            setIsRestoring(false);
        }
    };

    // ── Render helpers ─────────────────────────────────────────────────────────

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

    const getInitial = (username) => (username || '?').charAt(0).toUpperCase();

    const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#e91e63'];
    const getColor = (str) => {
        if (!str) return '#888';
        let hash = 0;
        for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
        return COLORS[Math.abs(hash) % COLORS.length];
    };

    const canRestore = role === 'owner' || role === 'editor';

    return (
        <>
            <div className="history-panel">
                {/* Header */}
                <div className="history-header">
                    <h3>📜 Lịch sử tài liệu</h3>
                    <button className="history-close" onClick={onClose} title="Đóng">✕</button>
                </div>

                {/* Tabs */}
                <div className="history-tabs">
                    <button
                        className={`history-tab ${activeTab === 'snapshots' ? 'active' : ''}`}
                        onClick={() => setActiveTab('snapshots')}
                    >
                        🗂️ Phiên bản
                    </button>
                    <button
                        className={`history-tab ${activeTab === 'activity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('activity')}
                    >
                        📊 Hoạt động
                    </button>
                </div>

                {/* ── TAB: Snapshots ── */}
                {activeTab === 'snapshots' && (
                    <div className="history-tab-content">
                        <div className="history-tab-subtitle">
                            Hệ thống tự động lưu phiên bản mỗi 30 giây khi có thay đổi.
                        </div>

                        {snapshotsLoading && <div className="history-loading">⏳ Đang tải danh sách phiên bản...</div>}
                        {snapshotsError && <div className="history-error">❌ Lỗi: {snapshotsError}</div>}

                        {!snapshotsLoading && !snapshotsError && snapshots.length === 0 && (
                            <div className="history-empty">
                                <div style={{ fontSize: '2.5em', marginBottom: 8 }}>🗄️</div>
                                Chưa có phiên bản nào được lưu.<br />
                                <small>Hãy bắt đầu soạn thảo – phiên bản đầu tiên sẽ được lưu sau 30 giây.</small>
                            </div>
                        )}

                        {!snapshotsLoading && !snapshotsError && snapshots.length > 0 && (
                            <div className="history-list">
                                {snapshots.map((snap, idx) => {
                                    const color = getColor(snap.savedBy);
                                    const isAutoBackup = snap.label && snap.label.startsWith('Tự động lưu trước');
                                    return (
                                        <div key={snap._id} className={`snapshot-item ${isAutoBackup ? 'snapshot-item-backup' : ''}`}>
                                            <div className="snapshot-item-left">
                                                <div
                                                    className="history-avatar"
                                                    style={{ backgroundColor: color }}
                                                    title={snap.savedBy}
                                                >
                                                    {getInitial(snap.savedBy)}
                                                </div>
                                                <div className="snapshot-item-info">
                                                    <span className="snapshot-item-label">
                                                        {isAutoBackup
                                                            ? <span className="snapshot-backup-tag">🔒 Backup</span>
                                                            : <span className="snapshot-rev-tag">Rev.{snap.revision}</span>
                                                        }
                                                        {snap.label && !isAutoBackup && (
                                                            <span className="snapshot-custom-label"> · {snap.label}</span>
                                                        )}
                                                    </span>
                                                    <span className="snapshot-item-meta">
                                                        {snap.savedBy} · {formatTime(snap.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="snapshot-item-actions">
                                                <button
                                                    className="btn btn-snapshot-preview"
                                                    onClick={() => handlePreview(snap)}
                                                    disabled={previewLoading}
                                                    title="Xem trước nội dung phiên bản này"
                                                >
                                                    {previewLoading ? '⏳' : '👁️ Xem'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Nút Làm mới */}
                        {!snapshotsLoading && (
                            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color, #e0e0e0)' }}>
                                <button className="btn-refresh-snapshots" onClick={loadSnapshots}>
                                    🔄 Làm mới danh sách
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: Activity ── */}
                {activeTab === 'activity' && (
                    <div className="history-tab-content">
                        <div className="history-tab-subtitle">
                            Các phiên chỉnh sửa được gộp nhóm theo thời gian (5 phút/nhóm).
                        </div>

                        {activityLoading && <div className="history-loading">⏳ Đang tải lịch sử hoạt động...</div>}
                        {activityError && <div className="history-error">❌ Lỗi: {activityError}</div>}

                        {!activityLoading && !activityError && sessions.length === 0 && (
                            <div className="history-empty">
                                <div style={{ fontSize: '2em', marginBottom: 8 }}>📄</div>
                                Chưa có lịch sử chỉnh sửa nào.<br />
                                <small>Hãy bắt đầu soạn thảo tài liệu!</small>
                            </div>
                        )}

                        {!activityLoading && !activityError && sessions.length > 0 && (
                            <div className="history-list">
                                {sessions.map((session, idx) => {
                                    const color = getColor(session.clientId);
                                    return (
                                        <div key={idx} className="history-session">
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
                )}
            </div>

            {/* Modal xem trước snapshot */}
            {previewSnapshot && (
                <SnapshotPreviewModal
                    snapshot={previewSnapshot}
                    onClose={() => setPreviewSnapshot(null)}
                    onRestore={handleRestore}
                    isRestoring={isRestoring}
                    canRestore={canRestore}
                />
            )}
        </>
    );
};

export default HistoryPanel;
