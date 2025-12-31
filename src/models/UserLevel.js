const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, index: true },
  oduserId: { type: String, required: true, index: true },
  username: { type: String, default: '' },
  avatar: { type: String, default: null },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  totalXp: { type: Number, default: 0 },
  messageCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ guildId: 1, oduserId: 1 }, { unique: true });
schema.index({ guildId: 1, totalXp: -1 });

// Seviye için gereken XP: 5 * level² + 50 * level + 100
schema.statics.xpForLevel = (level) => 5 * Math.pow(level, 2) + 50 * level + 100;

// XP ekle ve seviye kontrolü yap
schema.methods.addXp = async function(amount) {
  const oldLevel = this.level;
  this.xp += amount;
  this.totalXp += amount;
  this.messageCount += 1;
  this.lastMessageAt = new Date();
  
  // Seviye atlama kontrolü
  let requiredXp = this.constructor.xpForLevel(this.level);
  while (this.xp >= requiredXp) {
    this.xp -= requiredXp;
    this.level += 1;
    requiredXp = this.constructor.xpForLevel(this.level);
  }
  
  await this.save();
  
  return {
    leveledUp: this.level > oldLevel,
    oldLevel,
    newLevel: this.level,
    currentXp: this.xp,
    requiredXp: this.constructor.xpForLevel(this.level),
  };
};

// Leaderboard
schema.statics.getLeaderboard = async function(guildId, limit = 10) {
  return this.find({ guildId })
    .sort({ totalXp: -1 })
    .limit(limit)
    .lean();
};

// Kullanıcı verisi getir veya oluştur
schema.statics.getUser = async function(guildId, userId, username = '') {
  let user = await this.findOne({ guildId, oduserId: userId });
  if (!user) {
    user = await this.create({ guildId, oduserId: userId, username });
  }
  return user;
};

module.exports = mongoose.model('UserLevel', schema);
