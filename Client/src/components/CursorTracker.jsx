import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../api/socketService';

// Helper to create a DOM Range at specific character offsets within a contenteditable element
function createRangeAtOffsets(element, start, end) {
    const doc = element.ownerDocument || document;
    const range = doc.createRange();

    let currentOffset = 0;
    const nodeStack = [element];
    let startNode = null;
    let startNodeOffset = 0;
    let endNode = null;
    let endNodeOffset = 0;

    while (nodeStack.length > 0) {
        const node = nodeStack.pop();
        if (node.nodeType === Node.TEXT_NODE) {
            const nextOffset = currentOffset + node.length;
            if (!startNode && start >= currentOffset && start <= nextOffset) {
                startNode = node;
                startNodeOffset = start - currentOffset;
            }
            if (!endNode && end >= currentOffset && end <= nextOffset) {
                endNode = node;
                endNodeOffset = end - currentOffset;
            }
            currentOffset = nextOffset;
        } else {
            // Push children in reverse order to traverse in forward order
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }

    if (!startNode) {
        startNode = element;
        startNodeOffset = element.childNodes.length;
    }
    if (!endNode) {
        endNode = element;
        endNodeOffset = element.childNodes.length;
    }

    try {
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        return range;
    } catch (e) {
        console.error("Error setting range:", e);
        return null;
    }
}

// Helper to compute caret viewport coordinates
function getCaretRect(element, offset) {
    const textLen = element.textContent.length;
    if (textLen === 0) {
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        const paddingLeft = parseFloat(computed.paddingLeft) || 0;
        const paddingTop = parseFloat(computed.paddingTop) || 0;
        return {
            left: rect.left + paddingLeft,
            top: rect.top + paddingTop,
            height: parseFloat(computed.fontSize) || 16
        };
    }

    let range;
    let useRight = false;
    const clampedOffset = Math.max(0, Math.min(offset, textLen));

    if (clampedOffset < textLen) {
        range = createRangeAtOffsets(element, clampedOffset, clampedOffset + 1);
    } else {
        range = createRangeAtOffsets(element, clampedOffset - 1, clampedOffset);
        useRight = true;
    }

    if (range) {
        const rects = range.getClientRects();
        if (rects.length > 0) {
            const rect = rects[0];
            return {
                left: useRight ? rect.right : rect.left,
                top: rect.top,
                height: rect.height
            };
        }
    }

    const rangePoint = createRangeAtOffsets(element, clampedOffset, clampedOffset);
    if (rangePoint) {
        const rect = rangePoint.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
            return {
                left: rect.left,
                top: rect.top,
                height: rect.height || 16
            };
        }
    }

    return null;
}

// ─── Exported Caret Save/Restore Helpers ─────────────────────────────────────

export const getSelectionCharacterOffsetsWithin = (element) => {
    const doc = element.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (sel.rangeCount === 0) {
        return { start: 0, end: 0 };
    }
    const range = sel.getRangeAt(0);

    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) {
        return { start: 0, end: 0 };
    }

    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;

    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const end = preCaretRange.toString().length;

    return { start, end };
};

export const setSelectionCharacterOffsetsWithin = (element, start, end) => {
    if (start < 0) start = 0;
    if (end < 0) end = 0;

    const doc = element.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();

    const range = doc.createRange();
    range.selectNodeContents(element);

    let currentOffset = 0;
    const nodeStack = [element];
    let startNode = null;
    let startNodeOffset = 0;
    let endNode = null;
    let endNodeOffset = 0;

    while (nodeStack.length > 0) {
        const node = nodeStack.pop();
        if (node.nodeType === Node.TEXT_NODE) {
            const nextOffset = currentOffset + node.length;
            if (!startNode && start >= currentOffset && start <= nextOffset) {
                startNode = node;
                startNodeOffset = start - currentOffset;
            }
            if (!endNode && end >= currentOffset && end <= nextOffset) {
                endNode = node;
                endNodeOffset = end - currentOffset;
            }
            currentOffset = nextOffset;
        } else {
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }

    if (!startNode) {
        startNode = element;
        startNodeOffset = element.childNodes.length;
    }
    if (!endNode) {
        endNode = element;
        endNodeOffset = element.childNodes.length;
    }

    try {
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (e) {
        console.error("Error setting selection range:", e);
    }
};

// ─── Hook: Track & Receive Remote Cursors ────────────────────────────────────

export const useCursorTracking = (documentId, editorRef, content) => {
    const [remoteCursors, setRemoteCursors] = useState({});
    const throttleTimer = useRef(null);

    useEffect(() => {
        if (!documentId) return;

        const onRemoteCursor = ({ socketId, username, color, selStart, selEnd }) => {
            setRemoteCursors(prev => ({
                ...prev,
                [socketId]: { username, color, selStart, selEnd },
            }));
        };

        const onCursorClear = ({ socketId }) => {
            setRemoteCursors(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
        };

        socket.on('remote-cursor', onRemoteCursor);
        socket.on('cursor-clear', onCursorClear);
        return () => {
            socket.off('remote-cursor', onRemoteCursor);
            socket.off('cursor-clear', onCursorClear);
        };
    }, [documentId]);

    const emitCursor = useCallback(() => {
        if (!editorRef.current || !documentId) return;
        if (throttleTimer.current) return;
        throttleTimer.current = setTimeout(() => {
            throttleTimer.current = null;
            const editor = editorRef.current;
            if (!editor) return;
            const { start, end } = getSelectionCharacterOffsetsWithin(editor);
            socket.emit('cursor-move', {
                documentId,
                selStart: start,
                selEnd: end,
            });
        }, 80);
    }, [documentId, editorRef]);

    return { remoteCursors, emitCursor };
};

// ─── Component: Overlay to render remote cursors ──────────────────────────────

export const CursorOverlay = ({ editorRef, remoteCursors, content }) => {
    const [positions, setPositions] = useState({});

    const recalculate = useCallback(() => {
        const editor = editorRef.current;
        if (!editor || Object.keys(remoteCursors).length === 0) {
            setPositions({});
            return;
        }

        const editorRect = editor.getBoundingClientRect();
        const newPos = {};

        Object.entries(remoteCursors).forEach(([socketId, cursor]) => {
            const { selStart, selEnd, color, username } = cursor;

            const caretCoord = getCaretRect(editor, selStart);
            if (!caretCoord) return;

            const caretLeft = caretCoord.left - editorRect.left + editor.scrollLeft;
            const caretTop = caretCoord.top - editorRect.top + editor.scrollTop;
            const lineH = caretCoord.height || 20;

            const selRects = [];
            if (selEnd > selStart) {
                const range = createRangeAtOffsets(editor, selStart, selEnd);
                if (range) {
                    const rects = range.getClientRects();
                    for (let i = 0; i < rects.length; i++) {
                        const r = rects[i];
                        selRects.push({
                            left: r.left - editorRect.left + editor.scrollLeft,
                            top: r.top - editorRect.top + editor.scrollTop,
                            width: r.width,
                            height: r.height,
                        });
                    }
                }
            }

            newPos[socketId] = { caretTop, caretLeft, lineH, selRects, color, username };
        });

        setPositions(newPos);
    }, [remoteCursors, content, editorRef]);

    useEffect(() => { recalculate(); }, [recalculate]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const workspace = editor.closest('.editor-workspace') || editor;

        workspace.addEventListener('scroll', recalculate);
        window.addEventListener('resize', recalculate);

        return () => {
            workspace.removeEventListener('scroll', recalculate);
            window.removeEventListener('resize', recalculate);
        };
    }, [editorRef, recalculate]);

    if (Object.keys(positions).length === 0) return null;

    return (
        <div className="cursor-overlay">
            {Object.entries(positions).map(([socketId, pos]) => (
                <RemoteCursorItem key={socketId} pos={pos} />
            ))}
        </div>
    );
};

const RemoteCursorItem = ({ pos }) => {
    const [showLabel, setShowLabel] = useState(true);
    const timeoutRef = useRef(null);

    useEffect(() => {
        setShowLabel(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setShowLabel(false);
        }, 3000);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [pos.caretTop, pos.caretLeft]);

    const handleMouseEnter = () => {
        setShowLabel(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShowLabel(false);
        }, 1500);
    };

    return (
        <>
            {pos.selRects.map((rect, i) => (
                <div
                    key={i}
                    className="cursor-selection"
                    style={{
                        top:             rect.top,
                        left:            rect.left,
                        width:           rect.width,
                        height:          rect.height,
                        backgroundColor: pos.color + '25',
                        borderBottom:    `1px solid ${pos.color}`,
                    }}
                />
            ))}

            <div
                className="cursor-caret"
                style={{
                    top:             pos.caretTop,
                    left:            pos.caretLeft,
                    height:          pos.lineH,
                    backgroundColor: pos.color,
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className={`cursor-label ${showLabel ? 'visible' : ''}`}
                    style={{ backgroundColor: pos.color }}
                >
                    {pos.username}
                </div>
            </div>
        </>
    );
};

export default CursorOverlay;
