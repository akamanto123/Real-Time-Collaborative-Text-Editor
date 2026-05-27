import mongoose from 'mongoose';

const SnapshotSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Untitled document',
    },
    content: {
      type: String,
      default: '',
    },
    revision: {
      type: Number,
      required: true,
    },
    savedBy: {
      type: String,
      default: 'Unknown',
    },
    // Nhãn tuỳ chọn – chỉ có owner/editor đặt tên được (feature nâng cao)
    label: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const Snapshot = mongoose.model('Snapshot', SnapshotSchema);

export default Snapshot;
