import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getDocument, updateDocument } from '../api/documentService';
import { socket } from '../api/socketService';
import useOperationalDocument from '../hooks/useOperationalDocument';
import ActiveUsers from './ActiveUsers';
import HistoryPanel from './HistoryPanel';
import { useCursorTracking, CursorOverlay, getSelectionCharacterOffsetsWithin, setSelectionCharacterOffsetsWithin } from './CursorTracker';
import ShareModal from './ShareModal';
import OutlineSidebar from './OutlineSidebar';
import ChatSidebar from './ChatSidebar';

// Tạo username ngẫu nhiên cho mỗi tab riêng (dùng sessionStorage)
const getSessionUsername = () => {
    let name = sessionStorage.getItem('collab-username');
    if (!name) {
        name = `User${Math.floor(Math.random() * 9000) + 1000}`;
        sessionStorage.setItem('collab-username', name);
    }
    return name;
};

const DocumentEditor = ({ documentId, onBack }) => {
    const [initialData, setInitialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeUsers, setActiveUsers] = useState([]);
    const username = useRef(getSessionUsername());

    useEffect(() => {
        if (!documentId) return;

        let joined = false;

        const joinDocument = () => {
            if (!joined) {
                joined = true;
                socket.emit('join-document', { documentId, username: username.current });
            }
        };

        // Lắng nghe danh sách người dùng online
        socket.on('active-users', (users) => {
            setActiveUsers(users);
        });

        // Nếu socket đã connected → join ngay
        // Nếu chưa → đợi event 'connect' rồi mới join
        if (socket.connected) {
            joinDocument();
        } else {
            socket.once('connect', joinDocument);
            socket.connect();
        }

        getDocument(documentId).then(doc => {
            setInitialData(doc);
            setLoading(false);
        });

        return () => {
            socket.emit('leave-document', { documentId });
            socket.off('active-users');
            socket.off('connect', joinDocument);
            socket.disconnect();
            joined = false;
        };
    }, [documentId]);


    if (loading) {
        return <div className="loading">Đang tải tài liệu...</div>;
    }

    return (
        <Editor
            initialData={initialData}
            onBack={onBack}
            documentId={documentId}
            activeUsers={activeUsers}
            currentUsername={username.current}
        />
    );
};

const Editor = ({ initialData, onBack, documentId, activeUsers, currentUsername }) => {
    const { content, title, handleContentChange, connected, isSaving, error, role, setRole, undo, redo, canUndo, canRedo } = useOperationalDocument(
        documentId,
        initialData.title,
        initialData.content,
        initialData.revision,
        initialData.role || 'viewer',
        socket
    );
    const [showHistory, setShowHistory] = useState(false);
    const [showOutline, setShowOutline] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [docData, setDocData] = useState(initialData);
    const editorRef = useRef(null);
    const lastContentRef = useRef('');
    const { remoteCursors, emitCursor } = useCursorTracking(documentId, editorRef, content);

    const handleTitleChange = (newTitle) => {
        updateDocument(documentId, { title: newTitle });
    };

    const handleShareUpdate = (updatedDoc) => {
        setDocData(updatedDoc);
        if (updatedDoc.role) {
            setRole(updatedDoc.role);
        }
    };

    // Đổi hiển thị role thành tiếng Việt thân thiện
    const getRoleLabel = (r) => {
        if (r === 'owner') return '👑 Chủ sở hữu';
        if (r === 'editor') return '✍️ Người chỉnh sửa';
        return '👁️ Người xem';
    };

    const isViewer = role === 'viewer';

    // Initialize content once initialData is loaded
    useEffect(() => {
        if (editorRef.current && initialData) {
            editorRef.current.innerHTML = initialData.content || '';
            lastContentRef.current = initialData.content || '';
        }
    }, [initialData]);

    // Handle remote content updates
    useEffect(() => {
        if (!editorRef.current) return;

        if (content !== editorRef.current.innerHTML) {
            const offsets = getSelectionCharacterOffsetsWithin(editorRef.current);
            editorRef.current.innerHTML = content || '';
            lastContentRef.current = content || '';
            setSelectionCharacterOffsetsWithin(editorRef.current, offsets.start, offsets.end);
        }
    }, [content]);

    // Tính toán số từ và ký tự từ plain text
    const stats = useMemo(() => {
        const plainText = content ? new DOMParser().parseFromString(content, 'text/html').body.textContent || '' : '';
        const charCount = plainText.length;
        const words = plainText.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const readingTime = Math.ceil(wordCount / 200); // Tốc độ đọc trung bình 200 từ/phút
        return { charCount, wordCount, readingTime };
    }, [content]);

    // Xử lý phím tắt đặc biệt bao gồm hoàn tác/làm lại cộng tác
    const handleKeyDown = (e) => {
        if (isViewer) {
            e.preventDefault();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        }
        emitCursor();
    };

    // Xử lý thay đổi nội dung cục bộ (nhập chữ)
    const handleInput = (e) => {
        const newHTML = e.target.innerHTML;
        lastContentRef.current = newHTML;
        handleContentChange(newHTML);
        emitCursor();
    };

    // Áp dụng định dạng Rich Text bằng execCommand
    const handleFormat = (command, value = null) => {
        if (isViewer) return;
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        document.execCommand(command, false, value);

        const newHTML = editor.innerHTML;
        lastContentRef.current = newHTML;
        handleContentChange(newHTML);
        emitCursor();
    };

    return (
        <div className="document-editor google-docs-theme">
            {/* ─── GOOGLE DOCS TOP BAR ─── */}
            <div className="google-docs-top-bar">
                <div className="logo-and-title">
                    <div className="docs-logo-wrapper" onClick={onBack} title="Quay lại Màn hình chính">
                        <div className="docs-logo-icon">📝</div>
                    </div>
                    <div className="title-and-menu">
                        <div className="title-row">
                            <input
                                type="text"
                                defaultValue={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Tài liệu không có tiêu đề"
                                className="docs-title-input"
                                disabled={isViewer}
                            />
                            <span className="star-icon" title="Thêm vào thư mục gắn sao">⭐</span>
                            <div className="autosave-status">
                                {!connected ? (
                                    <span className="save-status-offline" style={{ color: '#d93025', fontWeight: 'bold' }} title="Mất kết nối. Các chỉnh sửa sẽ được lưu tạm ngoại tuyến và tự động đồng bộ khi kết nối lại.">
                                        ⚠️ Ngoại tuyến (Lưu tạm)
                                    </span>
                                ) : isSaving ? (
                                    <span className="save-status-loading" title="Đang lưu thay đổi tự động...">
                                        🔄 Đang lưu...
                                    </span>
                                ) : (
                                    <span className="save-status-success" title="Mọi thay đổi đã được tự động lưu vào đám mây">
                                        ☁️ Đã lưu
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="editor-top-actions">
                    {role === 'owner' && (
                        <button
                            className="btn btn-docs-share"
                            onClick={() => setShowShareModal(true)}
                            title="Chia sẻ tài liệu"
                        >
                            👥 Chia sẻ
                        </button>
                    )}

                    <div className="docs-user-profiles">
                        <span className={`role-badge role-${role}`}>
                            {getRoleLabel(role)}
                        </span>
                        <ActiveUsers users={activeUsers} />
                    </div>
                </div>
            </div>

            {/* ─── GOOGLE DOCS TOOLBAR ─── */}
            <div className="google-docs-toolbar">
                                {/* Undo Button */}
                                <button 
                                    className="toolbar-btn notranslate"
                                    translate="no"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        if (canUndo && !isViewer) undo();
                                    }}
                                    disabled={!canUndo || isViewer}
                                    title="Hoàn tác (Ctrl+Z)"
                                    style={{ opacity: (canUndo && !isViewer) ? 1 : 0.4 }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
                                </button>

                                {/* Redo Button */}
                                <button 
                                    className="toolbar-btn notranslate"
                                    translate="no"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        if (canRedo && !isViewer) redo();
                                    }}
                                    disabled={!canRedo || isViewer}
                                    title="Làm lại (Ctrl+Y)"
                                    style={{ opacity: (canRedo && !isViewer) ? 1 : 0.4 }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
                                </button>

                                <div className="toolbar-separator" />

                                <button className="toolbar-btn" onClick={() => window.print()} title="In tài liệu (Ctrl+P)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                                </button>
                                <div className="toolbar-separator" />
                
                {/* Outline Toggle */}
                <button
                    className={`toolbar-btn ${showOutline ? 'active' : ''}`}
                    onClick={() => setShowOutline(v => !v)}
                    title="Hiển thị Dàn ý (Outline)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>

                {/* History Toggle */}
                <button
                    className={`toolbar-btn ${showHistory ? 'active' : ''}`}
                    onClick={() => {
                        setShowHistory(v => !v);
                        if (!showHistory) setShowChat(false); // Đóng chat nếu mở history
                    }}
                    title="Lịch sử chỉnh sửa"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M12 2a10 10 0 0 0-10 10"/></svg>
                </button>

                {/* Chat Toggle */}
                <button
                    className={`toolbar-btn ${showChat ? 'active' : ''}`}
                    onClick={() => {
                        setShowChat(v => !v);
                        if (!showChat) setShowHistory(false); // Đóng history nếu mở chat
                    }}
                    title="Trò chuyện nhóm (Real-time Chat)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </button>
                <div className="toolbar-separator" />

                {/* Dropdown Định dạng Heading */}
                <select
                    className="toolbar-select font-style-select notranslate"
                    translate="no"
                    onChange={(e) => handleFormat('formatBlock', e.target.value)}
                    defaultValue="<p>"
                    disabled={isViewer}
                    title="Định dạng Văn bản (Heading)"
                >
                    <option value="<p>">Văn bản thường</option>
                    <option value="<h1>">Tiêu đề 1</option>
                    <option value="<h2>">Tiêu đề 2</option>
                    <option value="<h3>">Tiêu đề 3</option>
                </select>

                <div className="toolbar-separator" />

                {/* Dropdown Phông chữ */}
                <select
                    className="toolbar-select font-family-select notranslate"
                    translate="no"
                    onChange={(e) => handleFormat('fontName', e.target.value)}
                    defaultValue="Arial"
                    disabled={isViewer}
                    title="Phông chữ"
                    style={{ width: '100px' }}
                >
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                </select>

                {/* Dropdown Cỡ chữ */}
                <select
                    className="toolbar-select font-size-select notranslate"
                    translate="no"
                    onChange={(e) => handleFormat('fontSize', e.target.value)}
                    defaultValue="3"
                    disabled={isViewer}
                    title="Cỡ chữ"
                    style={{ width: '60px' }}
                >
                    <option value="1">10px</option>
                    <option value="2">13px</option>
                    <option value="3">15px</option>
                    <option value="4">18px</option>
                    <option value="5">24px</option>
                    <option value="6">32px</option>
                    <option value="7">48px</option>
                </select>

                <div className="toolbar-separator" />

                {/* Định dạng Rich Text */}
                <button
                    className="toolbar-btn bold-btn notranslate"
                    translate="no"
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('bold'); }}
                    disabled={isViewer}
                    title="In đậm (Ctrl+B)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                </button>
                <button
                    className="toolbar-btn italic-btn notranslate"
                    translate="no"
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('italic'); }}
                    disabled={isViewer}
                    title="In nghiêng (Ctrl+I)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                </button>
                <button
                    className="toolbar-btn underline-btn notranslate"
                    translate="no"
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('underline'); }}
                    disabled={isViewer}
                    title="Gạch chân (Ctrl+U)"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                </button>
                <button
                    className="toolbar-btn strikethrough-btn notranslate"
                    translate="no"
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('strikeThrough'); }}
                    disabled={isViewer}
                    title="Gạch ngang"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a4 4 0 0 0-4 4 4 4 0 0 0 4 4h6a4 4 0 0 1 4 4 4 4 0 0 1-4 4H7"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
                </button>

                <div className="toolbar-separator" />

                {/* Màu chữ (Color Picker) */}
                <label 
                    className="toolbar-btn text-color-btn notranslate" 
                    translate="no"
                    title="Màu chữ"
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 20h16" strokeWidth="3" stroke="currentColor" />
                        <path d="M7 16l5-12 5 12" strokeWidth="2"/>
                        <path d="M9 12h6" strokeWidth="2"/>
                    </svg>
                    <input 
                        type="color" 
                        onChange={(e) => handleFormat('foreColor', e.target.value)}
                        disabled={isViewer}
                        style={{ width: 0, height: 0, opacity: 0, position: 'absolute', pointerEvents: 'none' }} 
                    />
                </label>

                <div className="toolbar-separator" />

                {/* Căn lề */}
                <button 
                    className="toolbar-btn" 
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyLeft'); }}
                    disabled={isViewer} 
                    title="Căn lề trái"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                </button>
                <button 
                    className="toolbar-btn" 
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyCenter'); }}
                    disabled={isViewer} 
                    title="Căn giữa"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
                </button>
                <button 
                    className="toolbar-btn" 
                    onMouseDown={(e) => { e.preventDefault(); handleFormat('justifyRight'); }}
                    disabled={isViewer} 
                    title="Căn lề phải"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
                </button>
            </div>

            {error && <div className="error-bar">⚠️ {error}</div>}

            {/* ─── EDITOR BODY & WORKSPACE ─── */}
            <div className="editor-layout-body">
                {/* Trái: Outline */}
                {showOutline && (
                    <OutlineSidebar
                        content={content}
                        textareaRef={editorRef}
                        onHeadingClick={emitCursor}
                    />
                )}

                {/* Giữa: Vùng soạn thảo trang giấy A4 */}
                <div className="editor-workspace">
                    <div className="paper-page">
                        <div className="textarea-wrapper">
                            <div
                                ref={editorRef}
                                contentEditable={!isViewer}
                                onInput={handleInput}
                                onKeyUp={emitCursor}
                                onKeyDown={handleKeyDown}
                                onClick={emitCursor}
                                onMouseUp={emitCursor}
                                onSelect={emitCursor}
                                placeholder={isViewer ? "Bạn chỉ có quyền xem tài liệu này..." : "Nhập nội dung văn bản tại đây (Dùng thanh công cụ để định dạng)..."}
                                className="content-textarea paper-textarea"
                                style={{ minHeight: '800px', outline: 'none' }}
                            />
                            <CursorOverlay
                                editorRef={editorRef}
                                remoteCursors={remoteCursors}
                                content={content}
                            />
                        </div>
                    </div>
                </div>

                {/* Phải: Chat Sidebar hoặc History Panel */}
                {showChat && (
                    <ChatSidebar
                        documentId={documentId}
                        socket={socket}
                        currentUsername={currentUsername}
                    />
                )}

                {showHistory && (
                    <HistoryPanel
                        documentId={documentId}
                        onClose={() => setShowHistory(false)}
                    />
                )}
            </div>

            {/* ─── FOOTER ─── */}
            <div className="editor-footer docs-footer">
                <span className="current-user">
                    👤 Tên: <strong>{currentUsername}</strong>
                </span>
                <span className="docs-stats">
                    Số từ: <strong>{stats.wordCount}</strong> | Số ký tự: <strong>{stats.charCount}</strong> | Khoảng <strong>{stats.readingTime}</strong> phút đọc
                </span>
            </div>

            {showShareModal && (
                <ShareModal
                    documentData={{ ...docData, title }} // Cập nhật tiêu đề mới nhất vào modal
                    onClose={() => setShowShareModal(false)}
                    onUpdate={handleShareUpdate}
                />
            )}
        </div>
    );
};

export default DocumentEditor;






