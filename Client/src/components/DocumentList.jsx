import React, { useState, useEffect, useMemo } from 'react';
import { getDocuments, createDocument, deleteDocument } from '../api/documentService';
import TemplateGallery from './TemplateGallery';

const DocumentList = ({ onSelectDocument, onLogout, currentUser }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGallery, setShowGallery] = useState(false);
  const [creating, setCreating] = useState(false);

  // Tabs: 'my-docs', 'shared', 'recent', 'starred'
  const [activeTab, setActiveTab] = useState('my-docs');
  // View: 'grid', 'list'
  const [viewType, setViewType] = useState('grid');
  
  // Filters
  const [ownerFilter, setOwnerFilter] = useState('any'); // 'any', 'me', 'others'
  const [sortFilter, setSortFilter] = useState('updated'); // 'updated', 'title'

  // Starred docs storage key
  const username = currentUser?.name || 'Unknown';
  const starredKey = `starred_docs_${username}`;
  const lastOpenedKey = `last_opened_${username}`;

  const [starredIds, setStarredIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(starredKey) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    fetchDocuments();
  }, [currentUser]);

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

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài liệu này?')) return;
    deleteDocument(id)
      .then(() => fetchDocuments())
      .catch(err => setError(err.message));
  };

  const toggleStar = (e, id) => {
    e.stopPropagation();
    let updated;
    if (starredIds.includes(id)) {
      updated = starredIds.filter(item => item !== id);
    } else {
      updated = [...starredIds, id];
    }
    setStarredIds(updated);
    localStorage.setItem(starredKey, JSON.stringify(updated));
  };

  // User initials for profile badge
  const getUserInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Helper formatting opened times
  const getOpenedTimeString = (docId, updatedAt) => {
    try {
      const openedData = JSON.parse(localStorage.getItem(lastOpenedKey) || '{}');
      const timeStr = openedData[docId] || updatedAt;
      const date = new Date(timeStr);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `lúc ${hours}:${minutes} ${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  // Filtered and Sorted Docs computation
  const processedDocs = useMemo(() => {
    let result = [...documents];

    // 1. Sidebar tab filter
    if (activeTab === 'my-docs') {
      result = result.filter(d => d.owner === username);
    } else if (activeTab === 'shared') {
      result = result.filter(d => d.owner !== username);
    } else if (activeTab === 'starred') {
      result = result.filter(d => starredIds.includes(d._id));
    } else if (activeTab === 'recent') {
      // Sort by last opened time first, if not opened, fall back to updatedAt
      const openedData = JSON.parse(localStorage.getItem(lastOpenedKey) || '{}');
      result.sort((a, b) => {
        const timeA = new Date(openedData[a._id] || a.updatedAt).getTime();
        const timeB = new Date(openedData[b._id] || b.updatedAt).getTime();
        return timeB - timeA;
      });
      // slice top 10 recent
      result = result.slice(0, 10);
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(d => d.title.toLowerCase().includes(q));
    }

    // 3. User owner dropdown filter (only applied if not strictly tab-locked)
    if (activeTab !== 'my-docs' && activeTab !== 'shared') {
      if (ownerFilter === 'me') {
        result = result.filter(d => d.owner === username);
      } else if (ownerFilter === 'others') {
        result = result.filter(d => d.owner !== username);
      }
    }

    // 4. Sort dropdown filter (applies if tab is not 'recent')
    if (activeTab !== 'recent') {
      if (sortFilter === 'title') {
        result.sort((a, b) => a.title.localeCompare(b.title));
      } else {
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }
    }

    return result;
  }, [documents, activeTab, searchQuery, ownerFilter, sortFilter, starredIds, username]);

  const getHeaderTitle = () => {
    if (searchQuery.trim()) return 'KẾT QUẢ TÌM KIẾM';
    switch (activeTab) {
      case 'my-docs': return 'TÀI LIỆU CỦA TÔI';
      case 'shared': return 'ĐƯỢC CHIA SẺ VỚI TÔI';
      case 'recent': return 'GẦN ĐÂY';
      case 'starred': return 'CÓ GẮN DẤU SAO';
      default: return 'DANH SÁCH TÀI LIỆU';
    }
  };

  return (
    <div className="collab-dashboard">
      {/* ── TOP BAR ── */}
      <header className="collab-top-bar">
        <div className="top-bar-left">
          <span className="collab-logo-red">TextEditor</span>
        </div>
        <div className="top-bar-center">
          <div className="search-wrapper">
            <span className="search-icon-svg">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="top-bar-search-input"
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </div>
        <div className="top-bar-right">
          <span className="profile-display-name">{currentUser?.name || 'Người dùng'}</span>
          <div className="profile-avatar-circle" title={currentUser?.email}>
            {getUserInitials(currentUser?.name)}
          </div>
        </div>
      </header>

      <div className="dashboard-body">
        {/* ── SIDEBAR ── */}
        <aside className="collab-sidebar">
          <nav className="sidebar-nav">
            <button
              className={`sidebar-nav-item ${activeTab === 'my-docs' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-docs')}
            >
              <span className="nav-item-icon">📄</span> Tài liệu của tôi
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'shared' ? 'active' : ''}`}
              onClick={() => setActiveTab('shared')}
            >
              <span className="nav-item-icon">👥</span> Được chia sẻ với tôi
            </button>
            <button
              className={`sidebar-nav-item notranslate ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              <span className="nav-item-icon">🕒</span> Gần đây
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'starred' ? 'active' : ''}`}
              onClick={() => setActiveTab('starred')}
            >
              <span className="nav-item-icon">⭐</span> Có gắn dấu sao
            </button>
          </nav>
          <div className="sidebar-footer">
            <button className="btn-logout" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ── */}
        <main className="collab-main-content">
          {error && <div className="error-bar mb-4">⚠️ {error}</div>}

          {/* Sub Header */}
          <div className="content-subheader">
            <h2 className="section-title">{getHeaderTitle()}</h2>
            
            <div className="subheader-actions">
              <button
                className="btn btn-create-orange"
                onClick={() => setShowGallery(true)}
                disabled={creating}
              >
                {creating ? '⏳ Đang tạo...' : '+ Tạo mới'}
              </button>

              <div className="view-toggle-buttons">
                <button
                  className={`view-toggle-btn ${viewType === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewType('grid')}
                  title="Xem dạng lưới"
                >
                  田
                </button>
                <button
                  className={`view-toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                  onClick={() => setViewType('list')}
                  title="Xem dạng danh sách"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="filters-bar">
            {activeTab !== 'my-docs' && activeTab !== 'shared' && (
              <div className="filter-dropdown-group">
                <label>Người</label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="any">Bất kỳ ai</option>
                  <option value="me">Tôi là chủ sở hữu</option>
                  <option value="others">Không phải tôi làm chủ</option>
                </select>
              </div>
            )}

            {activeTab !== 'recent' && (
              <div className="filter-dropdown-group">
                <label>Sắp xếp theo</label>
                <select
                  value={sortFilter}
                  onChange={(e) => setSortFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="updated">Lần sửa đổi gần đây nhất</option>
                  <option value="title">Tên tài liệu (A-Z)</option>
                </select>
              </div>
            )}
          </div>

          {/* Document list render */}
          <div className="documents-container">
            {loading ? (
              <div className="list-loading">Đang tải danh sách tài liệu...</div>
            ) : processedDocs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📂</span>
                <p>Không có tài liệu nào hiển thị ở đây.</p>
                <button className="btn btn-primary" onClick={() => setShowGallery(true)}>
                  Tạo tài liệu mới
                </button>
              </div>
            ) : (
              <div className={viewType === 'grid' ? 'collab-grid-layout' : 'collab-list-layout'}>
                {processedDocs.map(doc => {
                  const isOwner = doc.owner === username;
                  const isStarred = starredIds.includes(doc._id);
                  return (
                    <div
                      key={doc._id}
                      className="collab-doc-card"
                      onClick={() => onSelectDocument(doc._id)}
                    >
                      {viewType === 'grid' && (
                        <div className="card-thumbnail-area">
                          <span className="thumbnail-doc-icon">📄</span>
                        </div>
                      )}
                      
                      <div className="card-details-area">
                        <div className="card-details-top">
                          <h4 className="doc-card-title" title={doc.title}>{doc.title}</h4>
                          <button
                            className={`star-toggle-icon-btn ${isStarred ? 'starred' : ''}`}
                            onClick={(e) => toggleStar(e, doc._id)}
                            title={isStarred ? 'Bỏ gắn dấu sao' : 'Gắn dấu sao'}
                          >
                            ★
                          </button>
                        </div>
                        <div className="card-details-bottom">
                          <span className="doc-owner-name">
                            {isOwner ? 'Tôi' : doc.owner}
                          </span>
                          <span className="opened-time-span">
                            - Bạn đã mở {getOpenedTimeString(doc._id, doc.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Card actions menu/delete */}
                      {isOwner && (
                        <button
                          className="doc-card-delete-btn"
                          onClick={(e) => handleDelete(e, doc._id)}
                          title="Xóa tài liệu này"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
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