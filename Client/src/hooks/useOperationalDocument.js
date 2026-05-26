import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { applyOp, transformSequence, transformAgainst } from '../ot/operations';

// Helper to invert an operation
const invertOp = (op) => {
    if (op.type === 'insert') {
        return {
            type: 'delete',
            pos: op.pos,
            length: op.text.length,
            text: op.text
        };
    } else if (op.type === 'delete') {
        return {
            type: 'insert',
            pos: op.pos,
            text: op.text
        };
    }
    return null;
};

// Helper to transform an operation stack (undo/redo stack) against concurrent remote operations
const transformStack = (stack, remoteOp) => {
    return stack.map(op => {
        return transformAgainst(op, remoteOp);
    }).filter(Boolean);
};

// Check if the text contains space, newlines, or HTML block tags to start a new undo group
const isBreakableText = (text) => {
    if (!text) return false;
    return /\s/g.test(text) || 
           text.includes('&nbsp;') || 
           text.includes('<br>') || 
           text.includes('<p>') || 
           text.includes('</p>') || 
           text.includes('<div>') || 
           text.includes('</div>');
};

// String diff utility with delete text capture
const diff = (oldStr, newStr) => {
    let start = 0;
    while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
        start++;
    }
    let endOld = oldStr.length;
    let endNew = newStr.length;
    while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
        endOld--;
        endNew--;
    }
    if (endOld > start) return { type: 'delete', pos: start, length: endOld - start, text: oldStr.slice(start, endOld) };
    if (endNew > start) return { type: 'insert', pos: start, text: newStr.slice(start, endNew) };
    return null;
};

const useOperationalDocument = (documentId, initialTitle, initialContent, initialRevision, initialRole, socket) => {
    const [content, setContent] = useState(initialContent);
    const [title, setTitle] = useState(initialTitle);
    const [revision, setRevision] = useState(initialRevision);
    const [role, setRole] = useState(initialRole);
    const [connected, setConnected] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const clientId = useRef(uuidv4());

    // OT state refs (Uncontrolled Single-In-Flight architecture)
    const contentRef = useRef(initialContent);
    const revisionRef = useRef(initialRevision);
    const lastAckContentRef = useRef(initialContent);
    const inFlightRef = useRef(false);
    const inFlightOpRef = useRef(null);

    // Distributed local undo/redo stacks
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const lastOpTimeRef = useRef(0);
    const isPerformingUndoRedoRef = useRef(false);

    // State sync helpers
    const updateContent = (val) => { contentRef.current = val; setContent(val); };
    const updateRevision = (val) => { revisionRef.current = val; setRevision(val); };

    // Function to check and send the next accumulated operation to the server
    const sendNextOpIfPending = useCallback(() => {
        if (inFlightRef.current || role === 'viewer') return;

        const currentContent = contentRef.current;
        const ackContent = lastAckContentRef.current;

        if (currentContent !== ackContent) {
            const op = diff(ackContent, currentContent);
            if (op) {
                inFlightRef.current = true;
                inFlightOpRef.current = op;
                setIsSaving(true);

                const opWithMeta = {
                    ...op,
                    baseRevision: revisionRef.current,
                    clientId: clientId.current
                };

                // Push inverse to undo stack for local undo support (only if not triggered by undo/redo)
                if (!isPerformingUndoRedoRef.current) {
                    const inv = invertOp(op);
                    if (inv) {
                        let merged = false;
                        if (undoStackRef.current.length > 0) {
                            const top = undoStackRef.current[undoStackRef.current.length - 1];
                            const timeDiff = Date.now() - lastOpTimeRef.current;
                            
                            if (timeDiff < 1200 && 
                                !isBreakableText(top.text) && 
                                !isBreakableText(inv.text) && 
                                top.type === inv.type) {
                                
                                let mergedOp = null;
                                if (top.type === 'delete') {
                                    if (top.pos + top.length === inv.pos) {
                                        mergedOp = {
                                            type: 'delete',
                                            pos: top.pos,
                                            length: top.length + inv.length,
                                            text: top.text + inv.text
                                        };
                                    }
                                } else if (top.type === 'insert') {
                                    if (inv.pos + inv.text.length === top.pos) {
                                        mergedOp = {
                                            type: 'insert',
                                            pos: inv.pos,
                                            text: inv.text + top.text
                                        };
                                    } else if (top.pos === inv.pos) {
                                        mergedOp = {
                                            type: 'insert',
                                            pos: top.pos,
                                            text: top.text + inv.text
                                        };
                                    }
                                }
                                
                                if (mergedOp) {
                                    undoStackRef.current[undoStackRef.current.length - 1] = mergedOp;
                                    merged = true;
                                }
                            }
                        }
                        
                        if (!merged) {
                            undoStackRef.current.push(inv);
                        }
                        redoStackRef.current = []; // Clear redo stack on new edits
                        lastOpTimeRef.current = Date.now();
                    }
                } else {
                    isPerformingUndoRedoRef.current = false;
                }

                socket.emit('submit-operation', { documentId, op: opWithMeta });
            }
        } else {
            setIsSaving(false);
        }
    }, [documentId, role, socket]);

    useEffect(() => {
        if (!socket) return;

        const onConnect = () => {
            setConnected(true);
            // Re-sync with server is initiated when server sends document-state (room join)
        };
        const onDisconnect = () => setConnected(false);

        const onDocumentState = (doc) => {
            const serverContent = doc.content || '';
            const serverRevision = doc.revision || 0;

            const currentContent = contentRef.current;
            const ackContent = lastAckContentRef.current;

            // Reconnection Sync / Merge logic
            if (currentContent !== ackContent && serverContent !== currentContent) {
                const offlineOp = diff(ackContent, currentContent);
                const serverEditsOp = diff(ackContent, serverContent);

                if (offlineOp && serverEditsOp) {
                    // Transform offline local edits against concurrent server edits
                    const transformedOfflineOp = transformAgainst(offlineOp, serverEditsOp);
                    const mergedContent = applyOp(serverContent, transformedOfflineOp);

                    updateContent(mergedContent);
                    lastAckContentRef.current = serverContent;
                    updateRevision(serverRevision);

                    // Submit transformed offline edits under new base revision
                    inFlightRef.current = true;
                    inFlightOpRef.current = transformedOfflineOp;
                    setIsSaving(true);

                    const opWithMeta = {
                        ...transformedOfflineOp,
                        baseRevision: serverRevision,
                        clientId: clientId.current
                    };

                    const inv = invertOp(transformedOfflineOp);
                    if (inv) {
                        undoStackRef.current.push(inv);
                        redoStackRef.current = [];
                        lastOpTimeRef.current = Date.now();
                    }

                    socket.emit('submit-operation', { documentId, op: opWithMeta });
                } else if (offlineOp) {
                    // No concurrent server edits, just submit our pending offline edits
                    lastAckContentRef.current = serverContent;
                    updateRevision(serverRevision);

                    inFlightRef.current = true;
                    inFlightOpRef.current = offlineOp;
                    setIsSaving(true);

                    const opWithMeta = {
                        ...offlineOp,
                        baseRevision: serverRevision,
                        clientId: clientId.current
                    };

                    const inv = invertOp(offlineOp);
                    if (inv) {
                        undoStackRef.current.push(inv);
                        redoStackRef.current = [];
                        lastOpTimeRef.current = Date.now();
                    }

                    socket.emit('submit-operation', { documentId, op: opWithMeta });
                } else {
                    // Fallback
                    updateContent(serverContent);
                    lastAckContentRef.current = serverContent;
                    updateRevision(serverRevision);
                    inFlightRef.current = false;
                    inFlightOpRef.current = null;
                    setIsSaving(false);
                }
            } else {
                // Normal initial load or simple sync
                updateContent(serverContent);
                lastAckContentRef.current = serverContent;
                updateRevision(serverRevision);
                inFlightRef.current = false;
                inFlightOpRef.current = null;
                setIsSaving(false);
            }

            setTitle(doc.title);
            if (doc.role) setRole(doc.role);
        };

        const onOperationAck = ({ appliedRevision, op }) => {
            // Update last acknowledged content
            lastAckContentRef.current = applyOp(lastAckContentRef.current, op);

            inFlightRef.current = false;
            inFlightOpRef.current = null;
            updateRevision(appliedRevision);

            // Send next queued edit if any
            sendNextOpIfPending();
        };

        const onDocumentOperation = ({ op, appliedRevision, clientId: remoteClientId }) => {
            if (remoteClientId === clientId.current) return;

            let transformedOp = op;
            if (inFlightRef.current && inFlightOpRef.current) {
                // Transform incoming remote operation against our in-flight operation
                transformedOp = transformAgainst(op, inFlightOpRef.current);

                // Transform in-flight operation against incoming remote operation
                inFlightOpRef.current = transformAgainst(inFlightOpRef.current, op);
            }

            // Keep acknowledged content base up-to-date
            lastAckContentRef.current = applyOp(lastAckContentRef.current, op);

            // Apply transformed remote op to active local state
            const transformedContent = applyOp(contentRef.current, transformedOp);
            updateContent(transformedContent);
            updateRevision(appliedRevision);

            // Transform local undo/redo stacks against incoming remote operations
            undoStackRef.current = transformStack(undoStackRef.current, op);
            redoStackRef.current = transformStack(redoStackRef.current, op);
        };

        const onOperationError = (err) => {
            setError(err.message);
            socket.emit('request-resync', { documentId });
            setIsSaving(false);
        };

        const onRoleUpdate = ({ role: newRole }) => {
            setRole(newRole);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('document-state', onDocumentState);
        socket.on('operation-ack', onOperationAck);
        socket.on('document-operation', onDocumentOperation);
        socket.on('operation-error', onOperationError);
        socket.on('role-update', onRoleUpdate);

        // Set initial connection status
        setConnected(socket.connected);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('document-state', onDocumentState);
            socket.off('operation-ack', onOperationAck);
            socket.off('document-operation', onDocumentOperation);
            socket.off('operation-error', onOperationError);
            socket.off('role-update', onRoleUpdate);
        };
    }, [socket, documentId, sendNextOpIfPending]);

    const handleContentChange = useCallback((newContent) => {
        if (role === 'viewer') {
            setError('Bạn không có quyền chỉnh sửa tài liệu này.');
            return;
        }

        updateContent(newContent);

        // Trigger sync loop immediately if not waiting for an ACK
        if (!inFlightRef.current) {
            sendNextOpIfPending();
        }
    }, [role, sendNextOpIfPending]);

    // Collaborative undo handler
    const undo = useCallback(() => {
        if (role === 'viewer' || undoStackRef.current.length === 0) return;

        const op = undoStackRef.current.pop();
        if (!op) return;

        const currentContent = contentRef.current;
        const newContent = applyOp(currentContent, op);
        updateContent(newContent);

        // Push inverse to redo stack
        const inv = invertOp(op);
        if (inv) {
            redoStackRef.current.push(inv);
        }

        isPerformingUndoRedoRef.current = true;

        if (!inFlightRef.current) {
            sendNextOpIfPending();
        }
    }, [role, sendNextOpIfPending]);

    // Collaborative redo handler
    const redo = useCallback(() => {
        if (role === 'viewer' || redoStackRef.current.length === 0) return;

        const op = redoStackRef.current.pop();
        if (!op) return;

        const currentContent = contentRef.current;
        const newContent = applyOp(currentContent, op);
        updateContent(newContent);

        // Push inverse to undo stack
        const inv = invertOp(op);
        if (inv) {
            undoStackRef.current.push(inv);
        }

        isPerformingUndoRedoRef.current = true;

        if (!inFlightRef.current) {
            sendNextOpIfPending();
        }
    }, [role, sendNextOpIfPending]);

    return { 
        content, 
        title, 
        handleContentChange, 
        connected, 
        isSaving, 
        error, 
        role, 
        setRole, 
        setTitle,
        undo,
        redo,
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0
    };
};

export default useOperationalDocument;