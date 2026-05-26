import React from 'react';

const ActiveUsers = ({ users }) => {
  if (!users || users.length === 0) return null;

  return (
    <div className="active-users">
      <span className="active-users-label">Đang chỉnh sửa:</span>
      <div className="active-users-list">
        {users.map((user) => (
          <div
            key={user.socketId}
            className="user-avatar"
            title={user.username}
            style={{ backgroundColor: user.color }}
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="active-users-count">
        {users.length} người dùng
      </span>
    </div>
  );
};

export default ActiveUsers;
