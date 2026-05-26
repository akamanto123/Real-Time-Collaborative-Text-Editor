import React, { useMemo } from 'react';
import { setSelectionCharacterOffsetsWithin } from './CursorTracker';

const OutlineSidebar = ({ content, textareaRef, onHeadingClick }) => {
    // Phân tích content để lấy danh sách tiêu đề từ các thẻ H1-H6 hoặc markdown
    const headings = useMemo(() => {
        const list = [];
        if (!content) return list;

        const isHtml = /<[a-z][\s\S]*>/i.test(content);

        if (isHtml) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                const nodes = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
                
                nodes.forEach((node, index) => {
                    const level = parseInt(node.tagName.substring(1), 10);
                    list.push({
                        type: 'html',
                        level,
                        text: node.textContent || '',
                        index
                    });
                });
            } catch (e) {
                console.error("Error parsing outline HTML:", e);
            }
        } else {
            // Hỗ trợ ngược cho tài liệu dạng Markdown trơn cũ
            const lines = content.split('\n');
            let charAccumulator = 0;

            lines.forEach((line) => {
                const match = line.match(/^(#{1,6})\s+(.+)$/);
                if (match) {
                    const level = match[1].length;
                    const text = match[2].trim();
                    list.push({
                        type: 'markdown',
                        level,
                        text,
                        charIndex: charAccumulator,
                        length: match[0].length
                    });
                }
                charAccumulator += line.length + 1;
            });
        }

        return list;
    }, [content]);

    const handleJump = (h) => {
        const editor = textareaRef.current;
        if (!editor) return;

        editor.focus();

        if (h.type === 'html') {
            const nodes = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const targetNode = nodes[h.index];
            if (targetNode) {
                targetNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                // Bôi đen tiêu đề hoặc đưa con trỏ vào đầu tiêu đề
                const range = document.createRange();
                range.selectNodeContents(targetNode);
                range.collapse(true);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        } else {
            // Cho tài liệu trơn: dùng setSelectionCharacterOffsetsWithin
            setSelectionCharacterOffsetsWithin(editor, h.charIndex, h.charIndex + h.length);
        }

        if (onHeadingClick) {
            onHeadingClick();
        }
    };

    return (
        <div className="outline-sidebar">
            <div className="sidebar-title">
                <h4>📑 Các thẻ trong tài liệu</h4>
            </div>
            <div className="outline-content">
                {headings.length === 0 ? (
                    <div className="outline-empty">
                        <small>Các tiêu đề bắt đầu bằng tiêu đề (Heading) bạn thêm vào tài liệu sẽ xuất hiện ở đây.</small>
                        <div className="outline-tip">
                            Ví dụ:<br/>
                            Sử dụng hộp chọn Tiêu đề trên thanh công cụ để tạo tiêu đề.
                        </div>
                    </div>
                ) : (
                    <ul className="outline-list">
                        {headings.map((h, i) => (
                            <li
                                key={i}
                                className={`outline-item outline-level-${h.level}`}
                                onClick={() => handleJump(h)}
                            >
                                <span className="outline-bullet">•</span>
                                <span className="outline-text" title={h.text}>{h.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default OutlineSidebar;
