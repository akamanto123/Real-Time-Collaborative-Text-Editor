import Document from '../models/Document.js';
import mongoose from 'mongoose';

// Helper tính vai trò của người dùng đối với tài liệu
export const getRole = (doc, username) => {
  if (!username) return 'viewer'; // mặc định
  if (doc.owner === username) return 'owner';

  const share = doc.sharedUsers?.find(s => s.username === username);
  if (share) return share.role;

  if (doc.publicAccess === 'edit') return 'editor';
  if (doc.publicAccess === 'view') return 'viewer';

  return null; // Không có quyền truy cập
};

export const getDocuments = async (req, res) => {
  try {
    const username = req.headers['x-username'] || 'Unknown';
    // Tìm tài liệu: công khai hoặc người dùng là owner/được chia sẻ
    const documents = await Document.find({
      $or: [
        { publicAccess: { $ne: 'none' } },
        { owner: username },
        { 'sharedUsers.username': username }
      ]
    }).sort({ updatedAt: -1 }).select('_id title updatedAt owner publicAccess sharedUsers');

    const docsWithRole = documents.map(doc => {
      const role = getRole(doc, username);
      return {
        _id: doc._id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        publicAccess: doc.publicAccess,
        role
      };
    });

    res.json(docsWithRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createDocument = async (req, res) => {
  try {
    const username = req.headers['x-username'] || 'Unknown';
    const { title, content } = req.body;
    const newDocument = new Document({
      title,
      content,
      owner: username,
    });
    const savedDocument = await newDocument.save();
    res.status(201).json(savedDocument);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getDocumentById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: 'Document not found' });
    }
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const username = req.headers['x-username'] || 'Unknown';
    const role = getRole(document, username);
    if (!role) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập tài liệu này.' });
    }

    if (document.revision === undefined || document.revision === null) {
        document.revision = 0;
    }

    const docObj = document.toObject();
    docObj.role = role;

    res.json(docObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateDocument = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(404).json({ message: 'Document not found' });
    }
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const username = req.headers['x-username'] || 'Unknown';
    const role = getRole(document, username);
    if (!role) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập tài liệu này.' });
    }

    const { title, publicAccess, sharedUsers } = req.body;

    // Thay đổi quyền truy cập: Chỉ Owner mới được phép
    let permissionsChanged = false;
    if (publicAccess !== undefined || sharedUsers !== undefined) {
      if (role !== 'owner') {
        return res.status(403).json({ message: 'Chỉ chủ sở hữu mới có quyền thay đổi cài đặt chia sẻ.' });
      }
      if (publicAccess !== undefined) {
        document.publicAccess = publicAccess;
        permissionsChanged = true;
      }
      if (sharedUsers !== undefined) {
        document.sharedUsers = sharedUsers;
        permissionsChanged = true;
      }
    }

    // Thay đổi tiêu đề: Owner hoặc Editor mới được phép
    if (title !== undefined) {
      if (role !== 'owner' && role !== 'editor') {
        return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa tiêu đề tài liệu này.' });
      }
      document.title = title;
    }

    document.updatedAt = Date.now();
    const updatedDocument = await document.save();

    // Đồng bộ quyền hạn qua socket thời gian thực nếu có thay đổi
    if (permissionsChanged) {
      const io = req.app.get('io');
      if (io) {
        const sockets = await io.in(req.params.id).fetchSockets();
        for (const s of sockets) {
          if (s.data && s.data.username) {
            const newRole = getRole(updatedDocument, s.data.username);
            s.data.role = newRole;
            s.emit('role-update', { role: newRole });
            if (!newRole) {
              s.emit('error', { message: 'Bạn đã bị thu hồi quyền truy cập tài liệu này.' });
              s.disconnect();
            }
          }
        }
        
        // Phát lại danh sách user online mới
        const activeUsers = sockets
          .filter(s => s.connected && s.data && s.data.role)
          .map(s => ({
            socketId: s.id,
            username: s.data.username,
            color: s.data.color,
            role: s.data.role
          }));
        io.to(req.params.id).emit('active-users', activeUsers);
      }
    }

    const docObj = updatedDocument.toObject();
    docObj.role = role;

    res.json(docObj);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteDocument = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Document not found' });
        }
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const username = req.headers['x-username'] || 'Unknown';
        const role = getRole(document, username);
        if (role !== 'owner') {
            return res.status(403).json({ message: 'Chỉ chủ sở hữu mới có quyền xóa tài liệu này.' });
        }

        await Document.findByIdAndDelete(req.params.id);
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getDocumentHistory = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Document not found' });
        }
        const document = await Document.findById(req.params.id).select('opsLog title content owner publicAccess sharedUsers');
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        const username = req.headers['x-username'] || 'Unknown';
        const role = getRole(document, username);
        if (!role) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập tài liệu này.' });
        }

        const ops = [...document.opsLog].sort((a, b) => a.appliedRevision - b.appliedRevision);

        if (ops.length === 0) {
            return res.json({ title: document.title, sessions: [] });
        }

        // Gom nhóm các ops trong vòng 5 phút của cùng 1 clientId thành 1 "phiên"
        const SESSION_GAP_MS = 5 * 60 * 1000; // 5 phút
        const sessions = [];
        let currentSession = null;

        for (const op of ops) {
            const opTime = new Date(op.createdAt).getTime();
            const sameUser = currentSession && currentSession.clientId === op.clientId;
            const withinGap = currentSession && (opTime - currentSession.lastTime) < SESSION_GAP_MS;

            if (sameUser && withinGap) {
                // Gộp vào phiên hiện tại
                if (op.type === 'insert') {
                    currentSession.charsAdded += (op.text || '').length;
                } else if (op.type === 'delete') {
                    currentSession.charsRemoved += (op.length || 0);
                }
                currentSession.lastTime = opTime;
                currentSession.endRevision = op.appliedRevision;
            } else {
                // Tạo phiên mới
                currentSession = {
                    clientId: op.clientId,
                    username: op.username || 'Unknown',
                    startTime: op.createdAt,
                    lastTime: opTime,
                    startRevision: op.appliedRevision,
                    endRevision: op.appliedRevision,
                    charsAdded: op.type === 'insert' ? (op.text || '').length : 0,
                    charsRemoved: op.type === 'delete' ? (op.length || 0) : 0,
                };
                sessions.push(currentSession);
            }
        }

        // Đảo ngược để mới nhất lên đầu (như Google Docs)
        sessions.reverse();

        res.json({ title: document.title, sessions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

