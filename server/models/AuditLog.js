const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    targetType: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'system',
      index: true,
    },
    targetId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    targetLabel: {
      type: String,
      trim: true,
      maxlength: 220,
      default: '',
    },
    details: {
      type: Object,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
