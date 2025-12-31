/**
 * Discord Bot - Ana Giriş Noktası
 * 
 * Bu bot 7/24 çalışır ve MongoDB'den ayarları okur.
 * Dashboard bu ayarları yazar, bot sadece okur ve uygular.
 */

const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

// Models
const GuildSettings = require('./models/GuildSettings');
const UserLevel = require('./models/UserLevel');

// Handlers
const welcomeHandler = require('./handlers/welcome');
const moderationHandler = require('./handlers/moderation');
const levelingHandler = require('./handlers/leveling');
const loggingHandler = require('./handlers/logging');
const commandHandler = require('./handlers/commands');

// Guild Isolation System
const { isGuildEnabled, invalidateCache } = require('./utils/guildIsolation');

// ==================== SETTINGS CACHE ====================
const settingsCache = new Map();
const CACHE_TTL = 60000; // 1 dakika

async function getSettings(guildId) {
  const cached = settingsCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.settings;
  }
  
  try {
    const settings = await GuildSettings.getSettings(guildId);
    settingsCache.set(guildId, { settings, timestamp: Date.now() });
    return settings;
  } catch (error) {
    console.error(`[Cache Error] ${guildId}:`, error.message);
    return null;
  }
}

function clearCache(guildId) {
  if (guildId) {
    settingsCache.delete(guildId);
  } else {
    settingsCache.clear();
  }
}

// ==================== DISCORD CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// ==================== BOT READY ====================
client.once(Events.ClientReady, async (c) => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🤖 BOT HAZIR                               ║
╠══════════════════════════════════════════════════════════════╣
║  Bot: ${c.user.tag.padEnd(52)}║
║  Sunucu: ${String(c.guilds.cache.size).padEnd(49)}║
║  Başlangıç: ${new Date().toLocaleString('tr-TR').padEnd(46)}║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  // Her sunucu için ayarları kontrol et/oluştur
  for (const [guildId, guild] of c.guilds.cache) {
    const settings = await getSettings(guildId);
    if (settings && !settings.guildName) {
      settings.guildName = guild.name;
      settings.guildIcon = guild.iconURL();
      settings.ownerId = guild.ownerId;
      await settings.save();
    }
  }
  
  // Status
  client.user.setActivity(`${c.guilds.cache.size} sunucu | /help`, { type: 3 });
});

// ==================== GUILD JOIN ====================
client.on(Events.GuildCreate, async (guild) => {
  console.log(`✅ Yeni sunucu: ${guild.name} (${guild.id})`);
  
  await GuildSettings.getSettings(guild.id);
  client.user.setActivity(`${client.guilds.cache.size} sunucu | /help`, { type: 3 });
});

// ==================== GUILD LEAVE ====================
client.on(Events.GuildDelete, (guild) => {
  console.log(`❌ Sunucudan ayrıldı: ${guild.name}`);
  clearCache(guild.id);
  client.user.setActivity(`${client.guilds.cache.size} sunucu | /help`, { type: 3 });
});

// ==================== MESSAGE ====================
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  
  // 🔒 Guild Isolation Check - tek satır kontrol
  if (!await isGuildEnabled(message.guild.id)) return;
  
  const settings = await getSettings(message.guild.id);
  if (!settings) return;
  
  // Moderasyon kontrolleri
  if (settings.moderation?.enabled) {
    const blocked = await moderationHandler.checkMessage(message, settings);
    if (blocked) return;
  }
  
  // Seviye sistemi
  if (settings.leveling?.enabled) {
    await levelingHandler.handleMessage(message, settings);
  }
  
  // Komutlar
  const prefix = settings.prefix || '!';
  if (message.content.startsWith(prefix)) {
    await commandHandler.handle(client, message, settings, prefix);
  }
});

// ==================== MEMBER JOIN ====================
client.on(Events.GuildMemberAdd, async (member) => {
  // 🔒 Guild Isolation Check
  if (!await isGuildEnabled(member.guild.id)) return;
  
  const settings = await getSettings(member.guild.id);
  if (!settings) return;
  
  // Hoşgeldin
  if (settings.welcome?.enabled) {
    await welcomeHandler.sendWelcome(member, settings);
  }
  
  // Oto-rol
  if (settings.autorole?.enabled) {
    await welcomeHandler.assignRoles(member, settings);
  }
  
  // Log
  if (settings.logging?.members?.enabled) {
    await loggingHandler.memberJoin(member, settings);
  }
});

// ==================== MEMBER LEAVE ====================
client.on(Events.GuildMemberRemove, async (member) => {
  // 🔒 Guild Isolation Check
  if (!await isGuildEnabled(member.guild.id)) return;
  
  const settings = await getSettings(member.guild.id);
  if (!settings) return;
  
  // Ayrılış mesajı
  if (settings.leave?.enabled) {
    await welcomeHandler.sendLeave(member, settings);
  }
  
  // Log
  if (settings.logging?.members?.enabled) {
    await loggingHandler.memberLeave(member, settings);
  }
});

// ==================== MESSAGE DELETE ====================
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild) return;
  
  // 🔒 Guild Isolation Check
  if (!await isGuildEnabled(message.guild.id)) return;
  
  const settings = await getSettings(message.guild.id);
  if (settings?.logging?.messages?.enabled) {
    await loggingHandler.messageDelete(message, settings);
  }
});

// ==================== MESSAGE UPDATE ====================
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!newMessage.guild || oldMessage.content === newMessage.content) return;
  if (newMessage.author?.bot) return;
  
  // 🔒 Guild Isolation Check
  if (!await isGuildEnabled(newMessage.guild.id)) return;
  
  const settings = await getSettings(newMessage.guild.id);
  
  if (settings?.logging?.messages?.enabled) {
    await loggingHandler.messageEdit(oldMessage, newMessage, settings);
  }
  
  // Moderasyon
  if (settings?.moderation?.enabled) {
    await moderationHandler.checkMessage(newMessage, settings);
  }
});

// ==================== VOICE STATE ====================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guildId = newState.guild?.id || oldState.guild?.id;
  if (!guildId) return;
  
  // 🔒 Guild Isolation Check
  if (!await isGuildEnabled(guildId)) return;
  
  const settings = await getSettings(guildId);
  if (settings?.logging?.voice?.enabled) {
    await loggingHandler.voiceUpdate(oldState, newState, settings);
  }
});

// ==================== ERROR HANDLING ====================
client.on(Events.Error, (error) => console.error('❌ Client Error:', error));
process.on('unhandledRejection', (error) => console.error('❌ Unhandled:', error));

// ==================== DATABASE & START ====================
async function start() {
  // MongoDB bağlantısı
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI bulunamadı!');
    process.exit(1);
  }
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB bağlantısı başarılı');
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    process.exit(1);
  }
  
  // Bot token kontrolü
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN bulunamadı!');
    process.exit(1);
  }
  
  // Bot'u başlat
  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
  } catch (error) {
    console.error('❌ Bot giriş hatası:', error.message);
    process.exit(1);
  }
}

start();

module.exports = { client, getSettings, clearCache };
