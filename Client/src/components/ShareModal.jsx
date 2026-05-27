import React, { useState, useEffect } from 'react';
import { updateDocument } from '../api/documentService';

const ShareModal = ({ documentData, onClose, onUpdate }) => {
    const [publicAccess, setPublicAccess] = useState(documentData.publicAccess || 'edit');
    const [sharedUsers, setSharedUsers] = useState(documentData.sharedUsers || []);
    const [newUsername, setNewUsername] = useState('');
    const [newRole, setNewRole] = useState('editor');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const documentUrl = window.location.href;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(documentUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddUser = (e) => {
        e.preventDefault();
        const trimmedName = newUsername.trim();
        if (!trimmedName) return;

        // Tránh trùng lặp username
        if (trimmedName === documentData.owner) {
            setError('Người dùng này đã là chủ sở hữu.');
            return;
        }

        if (sharedUsers.some(u => u.username.toLowerCase() === trimmedName.toLowerCase())) {
            setError('Người dùng này đã có tên trong danh sách chia sẻ.');
            return;
        }

        setSharedUsers([...sharedUsers, { username: trimmedName, role: newRole }]);
        setNewUsername('');
        setError('');
    };

    const handleRemoveUser = (usernameToRemove) => {
        setSharedUsers(sharedUsers.filter(u => u.username !== usernameToRemove));
    };

    const handleChangeUserRole = (username, role) => {
        setSharedUsers(sharedUsers.map(u => u.username === username ? { ...u, role } : u));
    };

    const handleSave = () => {
        setLoading(true);
        setError('');

        updateDocument(documentData._id, {
            publicAccess,
            sharedUsers
        })
        .then(updatedDoc => {
            setLoading(false);
            onUpdate(updatedDoc);
            onClose();
        })
        .catch(err => {
            setLoading(false);
            setError(err.message || 'Lỗi khi cập nhật chia sẻ.');
        });
    };

    return (
        <div className="share-modal-backdrop" onClick={onClose}>
            <div className="share-modal" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h3>👥 Chia sẻ "{documentData.title}"</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="share-modal-body">
                    {error && <div className="share-error-message">⚠️ {error}</div>}

                    {/* Link chia sẻ */}
                    <div className="share-section link-share-section">
                        <h4>Liên kết tài liệu</h4>
                        <div className="link-input-group">
                            <input type="text" readOnly value={documentUrl} className="share-link-input" />
                            <button className={`btn ${copied ? 'btn-success' : 'btn-primary'}`} onClick={handleCopyLink}>
                                {copied ? '✓ Đã sao chép' : '📋 Sao chép'}
                            </button>
                        </div>
                    </div>

                    {/* Thêm người dùng mới */}
                    <div className="share-section add-user-section">
                        <h4>Thêm người dùng</h4>
                        <form onSubmit={handleAddUser} className="add-user-form">
                            <input
                                type="text"
                                placeholder="Nhập tên hoặc email (Username/Email)..."
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                className="add-username-input"
                            />
                            <select
                                value={newRole}
                                onChange={e => setNewRole(e.target.value)}
                                className="add-role-select"
                            >
                                <option value="editor">✍️ Người chỉnh sửa (Editor)</option>
                                <option value="viewer">👁️ Người xem (Viewer)</option>
                            </select>
                            <button type="submit" className="btn btn-secondary">Thêm</button>
                        </form>
                    </div>

                    {/* Quyền truy cập chung */}
                    <div className="share-section public-access-section">
                        <h4>Quyền truy cập chung</h4>
                        <div className="public-access-row">
                            <div className="public-access-icon">
                                {publicAccess === 'none' ? '🔒' : publicAccess === 'view' ? '👁️' : '✍️'}
                            </div>
                            <div className="public-access-details">
                                <select
                                    value={publicAccess}
                                    onChange={e => setPublicAccess(e.target.value)}
                                    className="public-access-select"
                                >
                                    <option value="none">Hạn chế (Chỉ những người được thêm mới có quyền truy cập)</option>
                                    <option value="view">Người xem có liên kết (Bất kỳ ai có liên kết đều có thể xem)</option>
                                    <option value="edit">Người chỉnh sửa có liên kết (Bất kỳ ai có liên kết đều có thể chỉnh sửa)</option>
                                </select>
                                <p className="public-access-hint">
                                    {publicAccess === 'none' && 'Chỉ chủ sở hữu và những người dùng được thêm cụ thể bên dưới mới được phép mở tài liệu.'}
                                    {publicAccess === 'view' && 'Bất kỳ ai biết liên kết này đều có quyền xem (Read-Only), không thể chỉnh sửa.'}
                                    {publicAccess === 'edit' && 'Bất kỳ ai biết liên kết này đều có quyền xem và chỉnh sửa đồng thời.'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách người có quyền truy cập */}
                    <div className="share-section users-list-section">
                        <h4>Những người có quyền truy cập</h4>
                        <div className="share-users-list">
                            {/* Chủ sở hữu */}
                            <div className="share-user-item owner-item">
                                <div className="user-avatar" style={{ backgroundColor: '#9b59b6' }}>
                                    {documentData.owner?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="user-info">
                                    <span className="user-name">{documentData.owner} (Bạn)</span>
                                    <span className="user-role-label">Chủ sở hữu</span>
                                </div>
                                <span className="owner-badge">👑 Chủ sở hữu</span>
                            </div>

                            {/* Danh sách được chia sẻ */}
                            {sharedUsers.map((user, idx) => (
                                <div key={idx} className="share-user-item">
                                    <div className="user-avatar" style={{ backgroundColor: '#3498db' }}>
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="user-info">
                                        <span className="user-name">{user.username}</span>
                                    </div>
                                    <div className="user-actions">
                                        <select
                                            value={user.role}
                                            onChange={e => handleChangeUserRole(user.username, e.target.value)}
                                            className="user-role-select"
                                        >
                                            <option value="editor">Người chỉnh sửa</option>
                                            <option value="viewer">Người xem</option>
                                        </select>
                                        <button
                                            className="remove-user-btn"
                                            onClick={() => handleRemoveUser(user.username)}
                                            title="Xóa quyền truy cập"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="share-modal-footer">
                    <button className="btn btn-cancel" onClick={onClose} disabled={loading}>
                        Hủy
                    </button>
                    <button className="btn btn-save" onClick={handleSave} disabled={loading}>
                        {loading ? 'Đang lưu...' : 'Xong'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
