import React, { useState, useEffect } from 'react';
import { getDocuments, createDocument, deleteDocument } from '../api/documentService';

const getInitialUsername = () => {
    let name = sessionStorage.getItem('collab-username');
    if (!name) {
        name = `User${Math.floor(Math.random() * 9000) + 1000}`;
        sessionStorage.setItem('collab-username', name);
    }
    return name;
};

const DocumentList = ({ onSelectDocument }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [username, setUsername] = useState(getInitialUsername());

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = () => {
    setLoading(true);
    setError(null);
    getDocuments()
      .then(docs => {
        setDocuments(docs);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  const handleUsernameChange = (val) => {
    setUsername(val);
    sessionStorage.setItem('collab-username', val);
    // Tải lại danh sách tài liệu sau khi thay đổi username để áp dụng quyền truy cập mới
    fetchDocuments();
  };

  const handleNewDocument = () => {
    createDocument({ title: 'Untitled document' })
      .then(newDoc => {
        fetchDocuments();
        onSelectDocument(newDoc._id);
      })
      .catch(err => {
        setError(err.message);
      });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;

    deleteDocument(id)
      .then(() => {
        fetchDocuments();
      })
      .catch(err => {
        setError(err.message);
      });
  };

  const getAccessBadge = (access, isOwner) => {
      if (isOwner) return <span className="access-badge badge-owner">👑 Chủ sở hữu</span>;
      if (access === 'none') return <span className="access-badge badge-private">🔒 Riêng tư</span>;
      if (access === 'view') return <span className="access-badge badge-view">👁️ Chỉ xem</span>;
      return <span className="access-badge badge-edit">✍️ Chỉnh sửa</span>;
  };

  return (
    <div className="document-list-container">
      <div className="list-top-bar">
        <div className="user-profile-section">
          <span className="profile-icon">👤</span>
          <div className="profile-details">
            <label>Tên của bạn (Username):</label>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Nhập tên người dùng..."
              className="list-username-input"
            />
          </div>
        </div>
        <button className="btn btn-create" onClick={handleNewDocument}>
          ➕ Tạo tài liệu mới
        </button>
      </div>

      {error && <div className="error-bar">⚠️ {error}</div>}

      <div className="documents-grid">
        {loading ? (
          <div className="list-loading">Đang tải danh sách tài liệu...</div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📂</span>
            <p>Chưa có tài liệu nào khả dụng cho bạn.</p>
            <button className="btn btn-primary" onClick={handleNewDocument}>
               Tạo ngay tài liệu đầu tiên
            </button>
          </div>
        ) : (
          <div className="doc-cards">
            {documents.map(doc => {
              const isOwner = doc.owner === username;
              return (
                <div key={doc._id} className="doc-card">
                  <div className="card-click-area" onClick={() => onSelectDocument(doc._id)}>
                    <div className="card-header">
                      <span className="doc-icon">📄</span>
                      <h4 className="doc-title">{doc.title}</h4>
                    </div>
                    <div className="card-meta">
                      <span className="meta-owner">
                        Chủ: <strong>{isOwner ? 'Tôi' : doc.owner}</strong>
                      </span>
                      <small className="meta-time">
                        Cập nhật: {new Date(doc.updatedAt).toLocaleDateString()}
                      </small>
                    </div>
                  </div>
                  <div className="card-footer">
                    {getAccessBadge(doc.publicAccess, isOwner)}
                    {isOwner ? (
                      <button className="doc-delete-btn" onClick={() => handleDelete(doc._id)} title="Xóa tài liệu">
                        🗑️ Xóa
                      </button>
                    ) : (
                      <span className="no-delete-badge" title="Chỉ chủ sở hữu mới được xóa">🔒 Khóa</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentList;