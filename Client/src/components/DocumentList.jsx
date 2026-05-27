import React, { useState, useEffect, useMemo } from 'react';
import { getDocuments, createDocument, deleteDocument } from '../api/documentService';
import TemplateGallery from './TemplateGallery';

const getInitialUsername = () => {
    let name = sessionStorage.getItem('collab-username');
    if (!name) {
        name = `User${Math.floor(Math.random() * 9000) + 1000}`;
        sessionStorage.setItem('collab-username', name);
    }
    return name;
};

const DocumentList = ({ onSelectDocument }) => {
  const [documents, setDocuments]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [username, setUsername]       = useState(getInitialUsername());
  const [searchQuery, setSearchQuery] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [creating, setCreating]       = useState(false);

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
    fetchDocuments();
  };

  // Tạo tài liệu từ template đã chọn
  const handleTemplateSelect = (template) => {
    setShowGallery(false);
    setCreating(true);
    const title = template.id === 'blank' ? 'Tài liệu không có tiêu đề' : template.name;
    createDocument({ title, content: template.content })
      .then(newDoc => {
        setCreating(false);
        fetchDocuments();
        onSelectDocument(newDoc._id);
      })
      .catch(err => {
        setCreating(false);
        setError(err.message);
      });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;
    deleteDocument(id)
      .then(() => fetchDocuments())
      .catch(err => setError(err.message));
  };

  const getAccessBadge = (access, isOwner) => {
    if (isOwner) return <span className="access-badge badge-owner">👑 Chủ sở hữu</span>;
    if (access === 'none') return <span className="access-badge badge-private">🔒 Riêng tư</span>;
    if (access === 'view') return <span className="access-badge badge-view">👁️ Chỉ xem</span>;
    return <span className="access-badge badge-edit">✍️ Chỉnh sửa</span>;
  };

  // Filter theo search query
  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.trim().toLowerCase();
    return documents.filter(d => d.title.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  return (
    <div className="document-list-container">
      {/* Header */}
      <div className="list-top-bar">
        <div className="user-profile-section">
          <span className="profile-icon">👤</span>
          <div className="profile-details">
            <label>Tên của bạn:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="Nhập tên người dùng..."
              className="list-username-input"
            />
          </div>
        </div>
        <button
          className="btn btn-create"
          onClick={() => setShowGallery(true)}
          disabled={creating}
        >
          {creating ? '⏳ Đang tạo...' : '➕ Tạo tài liệu mới'}
        </button>
      </div>

      {/* Search bar */}
      <div className="list-search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm tài liệu..."
          className="list-search-input"
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')} title="Xóa tìm kiếm">✕</button>
        )}
      </div>

      {error && <div className="error-bar">⚠️ {error}</div>}

      <div className="documents-grid">
        {loading ? (
          <div className="list-loading">Đang tải danh sách tài liệu...</div>
        ) : filteredDocs.length === 0 && documents.length > 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>Không tìm thấy tài liệu nào khớp với "<strong>{searchQuery}</strong>".</p>
            <button className="btn btn-primary" onClick={() => setSearchQuery('')}>Xóa bộ lọc</button>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📂</span>
            <p>Chưa có tài liệu nào khả dụng cho bạn.</p>
            <button className="btn btn-primary" onClick={() => setShowGallery(true)}>
               Tạo ngay tài liệu đầu tiên
            </button>
          </div>
        ) : (
          <div className="doc-cards">
            {filteredDocs.map(doc => {
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
                        Cập nhật: {new Date(doc.updatedAt).toLocaleDateString('vi-VN')}
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

      {/* Template Gallery Modal */}
      {showGallery && (
        <TemplateGallery
          onSelect={handleTemplateSelect}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
};

export default DocumentList;