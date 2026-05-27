import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isRegister && !username.trim()) {
      setError('Vui lòng nhập tên hiển thị.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Mật khẩu phải chứa ít nhất 6 ký tự.');
      return;
    }

    setLoading(false);
    try {
      setLoading(true);
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister 
        ? { username: username.trim(), email: email.trim(), password }
        : { email: email.trim(), password };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Đã có lỗi xảy ra.');
      }

      // Success - Pass user details back to parent App
      onLogin({ name: data.username, email: data.email });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo-icon">📝</span>
          <h2 className="login-title">TextEditor</h2>
          <p className="login-subtitle">
            {isRegister 
              ? 'Đăng ký tài khoản mới' 
              : 'Đăng nhập vào hệ thống soạn thảo cộng tác'}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">⚠️ {error}</div>}
          
          {isRegister && (
            <div className="form-group">
              <label htmlFor="username-input">Tên hiển thị (Username)</label>
              <input
                id="username-input"
                type="text"
                placeholder="Nhập tên hiển thị của bạn..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input"
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email-input">Địa chỉ Email</label>
            <input
              id="email-input"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="login-input"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password-input">Mật khẩu</label>
            <input
              id="password-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-login" disabled={loading}>
            {loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </form>

        <div className="login-toggle-state" style={{ marginTop: '20px', fontSize: '0.9rem' }}>
          {isRegister ? (
            <p>
              Đã có tài khoản?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegister(false); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#1a73e8', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
              >
                Đăng nhập ngay
              </button>
            </p>
          ) : (
            <p>
              Chưa có tài khoản?{' '}
              <button 
                type="button" 
                onClick={() => { setIsRegister(true); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#1a73e8', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
              >
                Đăng ký ngay
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
