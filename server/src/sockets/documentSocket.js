import mongoose from 'mongoose';
import { loadDocument, appendOperation } from '../utils/documentStore.js';
import { applyOp, transformSequence, validateOp } from '../ot/operations.js';
import Document from '../models/Document.js';
import { getRole } from '../controllers/documentController.js';

const registerDocumentSocket = (io) => {
  // Màu ngẫu nhiên cho mỗi user
  const USER_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#e91e63'
  ];
  let colorIndex = 0;

  const getActiveUsers = async (documentId) => {
    const sockets = await io.in(documentId).fetchSockets();
    return sockets
      .filter(s => s.data && s.data.documentId === documentId)
      .map(s => ({
        socketId: s.id,
        username: s.data.username,
        color: s.data.color,
        role: s.data.role
      }));
  };

  io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Khởi tạo socket.data mặc định
    socket.data = {};

    // Client gửi thêm username khi join
    socket.on('join-document', async ({ documentId, username }) => {
      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        socket.emit('error', { message: 'Invalid document ID' });
        return;
      }

      const doc = await Document.findById(documentId);
      if (!doc) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }

      const finalUsername = username || `User_${Math.floor(Math.random() * 9000) + 1000}`;
      const role = getRole(doc, finalUsername);
      if (!role) {
        socket.emit('error', { message: 'Bạn không có quyền truy cập tài liệu này.' });
        return;
      }

      const color = USER_COLORS[colorIndex % USER_COLORS.length];
      colorIndex++;

      socket.data = {
        documentId,
        username: finalUsername,
        color,
        role,
      };

      socket.join(documentId);

      if (doc.revision === undefined || doc.revision === null) {
        doc.revision = 0;
        await doc.save();
      }

      socket.emit('document-state', {
        title: doc.title,
        content: doc.content,
        revision: doc.revision,
        ops: [],
        role,
      });

      // Broadcast danh sách users mới nhất cho tất cả trong phòng
      const activeUsers = await getActiveUsers(documentId);
      io.to(documentId).emit('active-users', activeUsers);
    });

    socket.on('submit-operation', async ({ documentId, op, clientId, baseRevision }) => {
      if (!mongoose.Types.ObjectId.isValid(documentId) || !validateOp(op)) {
        socket.emit('operation-error', { message: 'Invalid operation' });
        return;
      }

      // Kiểm tra quyền ghi trước khi áp dụng
      const socketUser = socket.data;
      if (!socketUser || socketUser.documentId !== documentId) {
        socket.emit('operation-error', { message: 'Không tìm thấy thông tin phiên làm việc.' });
        return;
      }

      if (socketUser.role === 'viewer') {
        socket.emit('operation-error', { message: 'Bạn không có quyền chỉnh sửa tài liệu này.' });
        return;
      }

      const docData = await loadDocument(documentId);
      if (!docData) {
        socket.emit('operation-error', { message: 'Document not found' });
        return;
      }

      let { doc, content, revision } = docData;

      // Kiểm tra lại quyền từ database đề phòng cập nhật nóng
      const currentRole = getRole(doc, socketUser.username);
      if (currentRole === 'viewer') {
        socket.data.role = 'viewer'; // Cập nhật local cache của socket
        socket.emit('role-update', { role: 'viewer' }); // Thông báo cho client
        socket.emit('operation-error', { message: 'Quyền hạn của bạn đã bị thay đổi thành Viewer.' });
        return;
      }

      const concurrentOps = doc.opsLog.filter(o => o.appliedRevision > baseRevision);
      const transformedOp = transformSequence(op, concurrentOps);

      content = applyOp(content, transformedOp);
      const newRevision = revision + 1;

      const opToLog = {
        ...transformedOp,
        clientId,
        username: socketUser.username,
        baseRevision,
        appliedRevision: newRevision,
        createdAt: new Date()
      };
      await appendOperation(documentId, opToLog, newRevision);
      await Document.findByIdAndUpdate(documentId, { content });

      socket.emit('operation-ack', { appliedRevision: newRevision, op: transformedOp });
      socket.to(documentId).emit('document-operation', { op: transformedOp, appliedRevision: newRevision, clientId });
    });

    socket.on('request-resync', async ({ documentId }) => {
      const doc = await Document.findById(documentId);
      if (doc) {
        const socketUser = socket.data;
        const role = socketUser ? socketUser.role : 'viewer';
        socket.emit('document-state', { title: doc.title, content: doc.content, revision: doc.revision, ops: [], role });
      }
    });

    socket.on('send-chat-message', ({ documentId, text }) => {
      const info = socket.data;
      if (!info || info.documentId !== documentId || !text.trim()) return;

      io.to(documentId).emit('chat-message', {
        socketId: socket.id,
        username: info.username,
        color: info.color,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    // Cursor position tracking
    socket.on('cursor-move', ({ documentId, selStart, selEnd }) => {
      const info = socket.data;
      if (!info || info.documentId !== documentId) return;

      socket.to(documentId).emit('remote-cursor', {
        socketId: socket.id,
        username: info.username,
        color: info.color,
        selStart,
        selEnd,
      });
    });

    socket.on('leave-document', async ({ documentId }) => {
      socket.to(documentId).emit('cursor-clear', { socketId: socket.id });
      socket.leave(documentId);
      delete socket.data.documentId;
      const activeUsers = await getActiveUsers(documentId);
      io.to(documentId).emit('active-users', activeUsers);
    });

    socket.on('disconnect', async () => {
      const { documentId } = socket.data;
      if (documentId) {
        socket.to(documentId).emit('cursor-clear', { socketId: socket.id });
        // Xoá khỏi phòng socket
        socket.leave(documentId);
        const activeUsers = await getActiveUsers(documentId);
        io.to(documentId).emit('active-users', activeUsers);
      }
      console.log('user disconnected:', socket.id);
    });
  });
};

export default registerDocumentSocket;

