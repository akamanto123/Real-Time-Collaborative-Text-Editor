import React, { useState, useEffect, useCallback, useRef } from 'react';

let _addToast = null;

export const toast = {
    success: (msg, opts = {}) => _addToast?.({ type: 'success', msg, ...opts }),
    error:   (msg, opts = {}) => _addToast?.({ type: 'error',   msg, ...opts }),
    info:    (msg, opts = {}) => _addToast?.({ type: 'info',    msg, ...opts }),
    warn:    (msg, opts = {}) => _addToast?.({ type: 'warn',    msg, ...opts }),
};

const ICONS = {
    success: '✅',
    error:   '❌',
    info:    'ℹ️',
    warn:    '⚠️',
};

let nextId = 0;

const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
    }, []);

    const addToast = useCallback(({ type = 'info', msg, duration = 3500 }) => {
        const id = ++nextId;
        setToasts(prev => [...prev.slice(-4), { id, type, msg, exiting: false }]);
        timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }, [removeToast]);

    useEffect(() => {
        _addToast = addToast;
        return () => { _addToast = null; };
    }, [addToast]);

    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast toast-${t.type} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
                    onClick={() => removeToast(t.id)}
                    title="Click để đóng"
                >
                    <span className="toast-icon">{ICONS[t.type]}</span>
                    <span className="toast-msg">{t.msg}</span>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
