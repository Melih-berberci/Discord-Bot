const { EmbedBuilder } = require('discord.js');
const UserLevel = require('../models/UserLevel');

// Cooldown cache
const cooldowns = new Map();

/**
 * Mesaj işle - XP ver
 */
async function handleMessage(message, settings) {
  try {
    const cfg = settings.leveling;
    
    // İgnore kanallar
    if (cfg.ignoredChannels?.includes(message.channel.id)) return;
    
    // Cooldown kontrolü
    const key = `${message.guild.id}-${message.author.id}`;
    const lastMsg = cooldowns.get(key);
    const now = Date.now();
    
    if (lastMsg && now - lastMsg < (cfg.xpCooldown || 60) * 1000) return;
    cooldowns.set(key, now);
    
    // XP hesapla (±20% rastgele)
    let xp = cfg.xpPerMessage || 15;
    xp = Math.floor(xp * (0.8 + Math.random() * 0.4));
    
    // Kullanıcı verisi
    let user = await UserLevel.findOne({
      guildId: message.guild.id,
      oduserId: message.author.id,
    });
    
    if (!user) {
      user = new UserLevel({
        guildId: message.guild.id,
        oduserId: message.author.id,
        username: message.author.username,
      });
    }
    
    user.username = message.author.username;
    user.avatar = message.author.avatar;
    
    // XP ekle
    const result = await user.addXp(xp);
    
    // Seviye atladıysa
    if (result.leveledUp) {
      await sendLevelUp(message, user, result, cfg);
    }
  } catch (error) {
    console.error('[Leveling Error]', error.message);
  }
}

/**
 * Seviye atlama mesajı
 */
async function sendLevelUp(message, user, result, cfg) {
  try {
    const text = (cfg.levelUpMessage || '🎉 Tebrikler {user}! **{level}** seviyesine ulaştın!')
      .replace(/{user}/g, message.author.toString())
      .replace(/{username}/g, message.author.username)
      .replace(/{level}/g, result.newLevel.toString());
    
    const channel = cfg.channelId 
      ? message.guild.channels.cache.get(cfg.channelId) 
      : message.channel;
    
    if (!channel) return;
    
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setDescription(text)
      .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
      .setFooter({ text: `XP: ${result.currentXp}/${result.requiredXp}` });
    
    await channel.send({ embeds: [embed] });
    
    // Rol ödülleri
    if (cfg.roleRewards?.length) {
      const reward = cfg.roleRewards.find(r => r.level === result.newLevel);
      if (reward?.roleId) {
        const role = message.guild.roles.cache.get(reward.roleId);
        if (role && role.position < message.guild.members.me.roles.highest.position) {
          await message.member.roles.add(role, `Seviye ${result.newLevel} ödülü`);
        }
      }
    }
  } catch (error) {
    console.error('[LevelUp Error]', error.message);
  }
}

/**
 * Leaderboard getir
 */
async function getLeaderboard(guildId, limit = 10) {
  const users = await UserLevel.getLeaderboard(guildId, limit);
  return users.map((u, i) => ({ ...u, rank: i + 1 }));
}

/**
 * Kullanıcı seviye bilgisi
 */
async function getUserStats(guildId, userId) {
  const user = await UserLevel.findOne({ guildId, oduserId: userId });
  if (!user) {
    return { level: 0, xp: 0, totalXp: 0, rank: 0 };
  }
  
  const rank = await UserLevel.countDocuments({
    guildId,
    totalXp: { $gt: user.totalXp },
  }) + 1;
  
  return {
    level: user.level,
    xp: user.xp,
    totalXp: user.totalXp,
    requiredXp: UserLevel.xpForLevel(user.level),
    messageCount: user.messageCount,
    rank,
  };
}

// Cooldown temizleme
setInterval(() => {
  const now = Date.now();
  for (const [key, time] of cooldowns.entries()) {
    if (now - time > 300000) cooldowns.delete(key);
  }
}, 60000);

module.exports = { handleMessage, getLeaderboard, getUserStats };
