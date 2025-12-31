const mongoose = require('mongoose');

const guildLogSchema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ['member_join', 'member_leave', 'message_delete', 'message_edit', 'voice_join', 'voice_leave', 'voice_move', 'ban', 'unban', 'kick', 'mute', 'warn'],
    required: true 
  },
  userId: { type: String },
  username: { type: String },
  userAvatar: { type: String },
  targetId: { type: String },
  targetUsername: { type: String },
  channelId: { type: String },
  channelName: { type: String },
  content: { type: String },
  oldContent: { type: String },
  newContent: { type: String },
  reason: { type: String },
  moderatorId: { type: String },
  moderatorUsername: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

guildLogSchema.index({ guildId: 1, timestamp: -1 });

module.exports = mongoose.models.GuildLog || mongoose.model('GuildLog', guildLogSchema);
