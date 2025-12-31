const mongoose = require('mongoose');

/**
 * Guild Settings Schema
 * ÖNEMLİ: Bu schema Dashboard ile AYNI olmalı!
 * Dashboard YAZAR, Bot OKUR
 */
const schema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true, index: true },
  guildName: { type: String, default: '' },
  guildIcon: { type: String, default: null },
  ownerId: { type: String, default: null },
  
  // Genel
  prefix: { type: String, default: '!' },
  language: { type: String, default: 'tr' },
  botEnabled: { type: Boolean, default: true },
  
  // Hoşgeldin
  welcome: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    message: { type: String, default: '🎉 Hoşgeldin {user}! Sunucumuza katıldığın için teşekkürler.' },
    embedEnabled: { type: Boolean, default: true },
    embedColor: { type: String, default: '#5865F2' },
    embedTitle: { type: String, default: 'Hoşgeldin!' },
    dmEnabled: { type: Boolean, default: false },
    dmMessage: { type: String, default: '' },
  },
  
  // Ayrılış
  leave: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    message: { type: String, default: '👋 {user} sunucudan ayrıldı.' },
    embedEnabled: { type: Boolean, default: false },
    embedColor: { type: String, default: '#ED4245' },
  },
  
  // Oto-rol
  autorole: {
    enabled: { type: Boolean, default: false },
    roles: [{ type: String }],
    delay: { type: Number, default: 0 },
  },
  
  // Moderasyon
  moderation: {
    enabled: { type: Boolean, default: false },
    logChannelId: { type: String, default: '' },
    modRoles: [{ type: String }],
    antiSpam: {
      enabled: { type: Boolean, default: false },
      maxMessages: { type: Number, default: 5 },
      interval: { type: Number, default: 5000 },
      action: { type: String, default: 'warn' },
    },
    antiLink: {
      enabled: { type: Boolean, default: false },
      allowedDomains: [{ type: String }],
      whitelistedRoles: [{ type: String }],
      action: { type: String, default: 'delete' },
    },
    badWords: {
      enabled: { type: Boolean, default: false },
      words: [{ type: String }],
      action: { type: String, default: 'delete' },
    },
  },
  
  // Seviye
  leveling: {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    xpPerMessage: { type: Number, default: 15 },
    xpCooldown: { type: Number, default: 60 },
    levelUpMessage: { type: String, default: '🎉 Tebrikler {user}! **{level}** seviyesine ulaştın!' },
    roleRewards: [{
      level: { type: Number },
      roleId: { type: String },
    }],
    ignoredChannels: [{ type: String }],
  },
  
  // Ticket
  tickets: {
    enabled: { type: Boolean, default: false },
    categoryId: { type: String, default: '' },
    logChannelId: { type: String, default: '' },
    supportRoles: [{ type: String }],
    maxTicketsPerUser: { type: Number, default: 3 },
    welcomeMessage: { type: String, default: 'Merhaba {user}! Destek ekibimiz size yardımcı olacak.' },
  },
  
  // Logging
  logging: {
    enabled: { type: Boolean, default: false },
    messages: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
    },
    members: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
    },
    voice: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
    },
    server: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
    },
  },
  
  // Özel komutlar
  customCommands: [{
    name: { type: String },
    response: { type: String },
    enabled: { type: Boolean, default: true },
  }],
  
  disabledCommands: [{ type: String }],
  
}, { timestamps: true });

// Ayarları getir veya oluştur
schema.statics.getSettings = async function(guildId) {
  let settings = await this.findOne({ guildId });
  if (!settings) {
    settings = await this.create({ guildId });
  }
  return settings;
};

module.exports = mongoose.model('GuildSettings', schema);
