import mongoose from 'mongoose';

const OpsLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['insert', 'delete'],
    required: true,
  },
  pos: {
    type: Number,
    required: true,
  },
  text: {
    type: String,
  },
  length: {
    type: Number,
  },
  clientId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    default: 'Unknown',
  },
  baseRevision: {
    type: Number,
    required: true,
  },
  appliedRevision: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const DocumentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'Untitled document',
    },
    content: {
      type: String,
      default: '',
    },
    revision: {
        type: Number,
        default: 0,
    },
    owner: {
      type: String,
      default: 'Unknown',
    },
    publicAccess: {
      type: String,
      enum: ['edit', 'view', 'none'],
      default: 'edit',
    },
    sharedUsers: [
      {
        username: { type: String, required: true },
        role: { type: String, enum: ['editor', 'viewer'], required: true },
      }
    ],
    opsLog: [OpsLogSchema],
  },
  { timestamps: true }
);

DocumentSchema.pre('save', function (next) {
    if (this.opsLog.length > 200) {
        this.opsLog = this.opsLog.slice(this.opsLog.length - 200);
    }
    next();
});

const Document = mongoose.model('Document', DocumentSchema);

export default Document;
