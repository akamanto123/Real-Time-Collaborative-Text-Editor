import express from 'express';
import {
  getDocuments,
  createDocument,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getDocumentHistory,
  getDocumentSnapshots,
  getSnapshotContent,
  restoreSnapshot,
} from '../controllers/documentController.js';

const router = express.Router();

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id/history', getDocumentHistory);
router.get('/:id/snapshots', getDocumentSnapshots);
router.get('/:id/snapshots/:snapshotId', getSnapshotContent);
router.post('/:id/restore/:snapshotId', restoreSnapshot);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router;
