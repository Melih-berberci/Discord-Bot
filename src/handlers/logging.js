const { EmbedBuilder } = require('discord.js');

/**
 * Log gönder
 */
async function sendLog(guild, channelId, embed) {
  if (!channelId) return;
  try {
    const channel = guild.channels.cache.get(channelId);
    if (channel) await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[Log Error]', error.message);
  }
}

/**
 * Üye katıldı
 */
async function memberJoin(member, settings) {
  const cfg = settings.logging?.members;
  if (!cfg?.channelId) return;
  
  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  
  const embed = new EmbedBuilder()
    .setTitle('📥 Üye Katıldı')
    .setColor('#57F287')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Kullanıcı', value: `${member.user.tag}\n${member.toString()}`, inline: true },
      { name: 'Hesap Yaşı', value: `${accountAge} gün`, inline: true },
      { name: 'Üye Sayısı', value: member.guild.memberCount.toString(), inline: true },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();
  
  if (accountAge < 7) {
    embed.addFields({ name: '⚠️ Uyarı', value: 'Yeni hesap!' });
  }
  
  await sendLog(member.guild, cfg.channelId, embed);
}

/**
 * Üye ayrıldı
 */
async function memberLeave(member, settings) {
  const cfg = settings.logging?.members;
  if (!cfg?.channelId) return;
  
  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id)
    .map(r => r.name)
    .join(', ') || 'Yok';
  
  const embed = new EmbedBuilder()
    .setTitle('📤 Üye Ayrıldı')
    .setColor('#ED4245')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Kullanıcı', value: member.user.tag, inline: true },
      { name: 'Rolleri', value: roles.substring(0, 1024) },
    )
    .setFooter({ text: `ID: ${member.id}` })
    .setTimestamp();
  
  await sendLog(member.guild, cfg.channelId, embed);
}

/**
 * Mesaj silindi
 */
async function messageDelete(message, settings) {
  const cfg = settings.logging?.messages;
  if (!cfg?.channelId) return;
  if (!message.author) return;
  
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mesaj Silindi')
    .setColor('#ED4245')
    .addFields(
      { name: 'Kullanıcı', value: message.author?.tag || 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: message.channel.toString(), inline: true },
      { name: 'İçerik', value: message.content?.substring(0, 1024) || 'Alınamadı' },
    )
    .setFooter({ text: `ID: ${message.id}` })
    .setTimestamp();
  
  await sendLog(message.guild, cfg.channelId, embed);
}

/**
 * Mesaj düzenlendi
 */
async function messageEdit(oldMessage, newMessage, settings) {
  const cfg = settings.logging?.messages;
  if (!cfg?.channelId) return;
  
  const embed = new EmbedBuilder()
    .setTitle('✏️ Mesaj Düzenlendi')
    .setColor('#FFA500')
    .addFields(
      { name: 'Kullanıcı', value: newMessage.author?.tag || 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: newMessage.channel.toString(), inline: true },
      { name: 'Eski', value: oldMessage.content?.substring(0, 1024) || 'Alınamadı' },
      { name: 'Yeni', value: newMessage.content?.substring(0, 1024) || 'Alınamadı' },
    )
    .setFooter({ text: `ID: ${newMessage.id}` })
    .setTimestamp();
  
  await sendLog(newMessage.guild, cfg.channelId, embed);
}

/**
 * Ses durumu
 */
async function voiceUpdate(oldState, newState, settings) {
  const cfg = settings.logging?.voice;
  if (!cfg?.channelId) return;
  
  const member = newState.member || oldState.member;
  if (!member) return;
  
  const guild = newState.guild || oldState.guild;
  let embed;
  
  // Katıldı
  if (!oldState.channel && newState.channel) {
    embed = new EmbedBuilder()
      .setTitle('🔊 Ses Kanalına Katıldı')
      .setColor('#57F287')
      .addFields(
        { name: 'Kullanıcı', value: member.user.tag, inline: true },
        { name: 'Kanal', value: newState.channel.name, inline: true },
      )
      .setTimestamp();
  }
  // Ayrıldı
  else if (oldState.channel && !newState.channel) {
    embed = new EmbedBuilder()
      .setTitle('🔇 Ses Kanalından Ayrıldı')
      .setColor('#ED4245')
      .addFields(
        { name: 'Kullanıcı', value: member.user.tag, inline: true },
        { name: 'Kanal', value: oldState.channel.name, inline: true },
      )
      .setTimestamp();
  }
  // Kanal değiştirdi
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    embed = new EmbedBuilder()
      .setTitle('🔀 Ses Kanalı Değişti')
      .setColor('#FFA500')
      .addFields(
        { name: 'Kullanıcı', value: member.user.tag, inline: true },
        { name: 'Eski', value: oldState.channel.name, inline: true },
        { name: 'Yeni', value: newState.channel.name, inline: true },
      )
      .setTimestamp();
  }
  
  if (embed) {
    await sendLog(guild, cfg.channelId, embed);
  }
}

module.exports = { memberJoin, memberLeave, messageDelete, messageEdit, voiceUpdate };
