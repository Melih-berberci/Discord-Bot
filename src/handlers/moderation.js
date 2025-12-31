const { EmbedBuilder } = require('discord.js');

// Spam cache
const spamCache = new Map();

/**
 * Moderatör mü kontrol et
 */
function isMod(member, settings) {
  if (member.permissions.has('Administrator')) return true;
  if (member.permissions.has('ManageGuild')) return true;
  return settings.moderation?.modRoles?.some(r => member.roles.cache.has(r)) || false;
}

/**
 * Anti-spam kontrolü
 */
async function checkSpam(message, settings) {
  const cfg = settings.moderation?.antiSpam;
  if (!cfg?.enabled) return false;
  
  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();
  
  let data = spamCache.get(key) || { messages: [] };
  data.messages = data.messages.filter(t => now - t < cfg.interval);
  data.messages.push(now);
  spamCache.set(key, data);
  
  if (data.messages.length >= cfg.maxMessages) {
    await handleViolation(message, cfg.action, 'Spam');
    data.messages = [];
    return true;
  }
  
  return false;
}

/**
 * Anti-link kontrolü
 */
async function checkLinks(message, settings) {
  const cfg = settings.moderation?.antiLink;
  if (!cfg?.enabled) return false;
  
  // Whitelist rol kontrolü
  if (cfg.whitelistedRoles?.some(r => message.member.roles.cache.has(r))) return false;
  
  const linkRegex = /(https?:\/\/[^\s]+)/gi;
  const links = message.content.match(linkRegex);
  if (!links) return false;
  
  // İzinli domain kontrolü
  if (cfg.allowedDomains?.length) {
    const hasBlocked = links.some(link => {
      try {
        const url = new URL(link);
        return !cfg.allowedDomains.some(d => url.hostname.includes(d));
      } catch {
        return true;
      }
    });
    if (!hasBlocked) return false;
  }
  
  await handleViolation(message, cfg.action, 'Link');
  return true;
}

/**
 * Küfür kontrolü
 */
async function checkBadWords(message, settings) {
  const cfg = settings.moderation?.badWords;
  if (!cfg?.enabled || !cfg.words?.length) return false;
  
  const content = message.content.toLowerCase();
  const hasBadWord = cfg.words.some(w => content.includes(w.toLowerCase()));
  
  if (!hasBadWord) return false;
  
  await handleViolation(message, cfg.action, 'Yasak kelime');
  return true;
}

/**
 * İhlal işlemi
 */
async function handleViolation(message, action, reason) {
  try {
    // Mesajı sil
    await message.delete().catch(() => {});
    
    // Uyarı mesajı
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setDescription(`⚠️ ${message.author}, **${reason}** yasaktır!`);
    
    const warn = await message.channel.send({ embeds: [embed] });
    setTimeout(() => warn.delete().catch(() => {}), 5000);
    
    // Ek aksiyonlar
    if (action === 'mute') {
      await message.member.timeout(5 * 60 * 1000, reason).catch(() => {});
    } else if (action === 'kick') {
      await message.member.kick(reason).catch(() => {});
    }
  } catch (error) {
    console.error('[Moderation Error]', error.message);
  }
}

/**
 * Ana mesaj kontrol fonksiyonu
 */
async function checkMessage(message, settings) {
  // Moderatörleri atla
  if (isMod(message.member, settings)) return false;
  
  // Kontroller
  if (await checkBadWords(message, settings)) return true;
  if (await checkLinks(message, settings)) return true;
  if (await checkSpam(message, settings)) return true;
  
  return false;
}

// Cache temizleme
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of spamCache.entries()) {
    if (!data.messages.length || now - Math.max(...data.messages) > 60000) {
      spamCache.delete(key);
    }
  }
}, 60000);

module.exports = { checkMessage, isMod };
