const { EmbedBuilder } = require('discord.js');
const GuildLog = require('../models/GuildLog');

/**
 * MongoDB'ye log kaydet
 */
async function saveLog(logData) {
  try {
    const log = new GuildLog(logData);
    await log.save();
  } catch (error) {
    console.error('[Log DB Error]', error.message);
  }
}

/**
 * Discord kanalina log gonder
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
 * Uye katildi
 */
async function memberJoin(member, settings) {
  // MongoDB'ye kaydet
  await saveLog({
    guildId: member.guild.id,
    type: 'member_join',
    userId: member.user.id,
    username: member.user.tag,
    userAvatar: member.user.displayAvatarURL({ size: 128 }),
    metadata: {
      accountAge: Math.floor((Date.now() - member.user.createdTimestamp) / 86400000),
      memberCount: member.guild.memberCount
    }
  });

  const cfg = settings.logging?.members;
  if (!cfg?.channelId) return;

  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  const embed = new EmbedBuilder()
    .setTitle('Uye Katildi')
    .setColor('#57F287')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Kullanici', value: member.user.tag + '\n' + member.toString(), inline: true },
      { name: 'Hesap Yasi', value: accountAge + ' gun', inline: true },
      { name: 'Uye Sayisi', value: member.guild.memberCount.toString(), inline: true },
    )
    .setFooter({ text: 'ID: ' + member.id })
    .setTimestamp();

  if (accountAge < 7) {
    embed.addFields({ name: 'Uyari', value: 'Yeni hesap!' });
  }

  await sendLog(member.guild, cfg.channelId, embed);
}

/**
 * Uye ayrildi
 */
async function memberLeave(member, settings) {
  // MongoDB'ye kaydet
  await saveLog({
    guildId: member.guild.id,
    type: 'member_leave',
    userId: member.user.id,
    username: member.user.tag,
    userAvatar: member.user.displayAvatarURL({ size: 128 }),
    metadata: {
      roles: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name)
    }
  });

  const cfg = settings.logging?.members;
  if (!cfg?.channelId) return;

  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id)
    .map(r => r.name)
    .join(', ') || 'Yok';

  const embed = new EmbedBuilder()
    .setTitle('Uye Ayrildi')
    .setColor('#ED4245')
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'Kullanici', value: member.user.tag, inline: true },
      { name: 'Rolleri', value: roles.substring(0, 1024) },
    )
    .setFooter({ text: 'ID: ' + member.id })
    .setTimestamp();

  await sendLog(member.guild, cfg.channelId, embed);
}

/**
 * Mesaj silindi
 */
async function messageDelete(message, settings) {
  if (!message.author) return;

  // MongoDB'ye kaydet
  await saveLog({
    guildId: message.guild.id,
    type: 'message_delete',
    userId: message.author?.id,
    username: message.author?.tag,
    channelId: message.channel.id,
    channelName: message.channel.name,
    content: message.content?.substring(0, 2000)
  });

  const cfg = settings.logging?.messages;
  if (!cfg?.channelId) return;

  const embed = new EmbedBuilder()
    .setTitle('Mesaj Silindi')
    .setColor('#ED4245')
    .addFields(
      { name: 'Kullanici', value: message.author?.tag || 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: message.channel.toString(), inline: true },
      { name: 'Icerik', value: message.content?.substring(0, 1024) || 'Alinamadi' },
    )
    .setFooter({ text: 'ID: ' + message.id })
    .setTimestamp();

  await sendLog(message.guild, cfg.channelId, embed);
}

/**
 * Mesaj duzenlendi
 */
async function messageEdit(oldMessage, newMessage, settings) {
  // MongoDB'ye kaydet
  await saveLog({
    guildId: newMessage.guild.id,
    type: 'message_edit',
    userId: newMessage.author?.id,
    username: newMessage.author?.tag,
    channelId: newMessage.channel.id,
    channelName: newMessage.channel.name,
    oldContent: oldMessage.content?.substring(0, 2000),
    newContent: newMessage.content?.substring(0, 2000)
  });

  const cfg = settings.logging?.messages;
  if (!cfg?.channelId) return;

  const embed = new EmbedBuilder()
    .setTitle('Mesaj Duzenlendi')
    .setColor('#FFA500')
    .addFields(
      { name: 'Kullanici', value: newMessage.author?.tag || 'Bilinmiyor', inline: true },
      { name: 'Kanal', value: newMessage.channel.toString(), inline: true },
      { name: 'Eski', value: oldMessage.content?.substring(0, 1024) || 'Alinamadi' },
      { name: 'Yeni', value: newMessage.content?.substring(0, 1024) || 'Alinamadi' },
    )
    .setFooter({ text: 'ID: ' + newMessage.id })
    .setTimestamp();

  await sendLog(newMessage.guild, cfg.channelId, embed);
}

/**
 * Ses durumu
 */
async function voiceUpdate(oldState, newState, settings) {
  const member = newState.member || oldState.member;
  if (!member) return;

  const guild = newState.guild || oldState.guild;
  let logType = null;
  let embed;

  // Katildi
  if (!oldState.channel && newState.channel) {
    logType = 'voice_join';
    await saveLog({
      guildId: guild.id,
      type: logType,
      userId: member.user.id,
      username: member.user.tag,
      channelId: newState.channel.id,
      channelName: newState.channel.name
    });

    embed = new EmbedBuilder()
      .setTitle('Ses Kanalina Katildi')
      .setColor('#57F287')
      .addFields(
        { name: 'Kullanici', value: member.user.tag, inline: true },
        { name: 'Kanal', value: newState.channel.name, inline: true },
      )
      .setTimestamp();
  }
  // Ayrildi
  else if (oldState.channel && !newState.channel) {
    logType = 'voice_leave';
    await saveLog({
      guildId: guild.id,
      type: logType,
      userId: member.user.id,
      username: member.user.tag,
      channelId: oldState.channel.id,
      channelName: oldState.channel.name
    });

    embed = new EmbedBuilder()
      .setTitle('Ses Kanalindan Ayrildi')
      .setColor('#ED4245')
      .addFields(
        { name: 'Kullanici', value: member.user.tag, inline: true },
        { name: 'Kanal', value: oldState.channel.name, inline: true },
      )
      .setTimestamp();
  }
  // Kanal degistirdi
  else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    logType = 'voice_move';
    await saveLog({
      guildId: guild.id,
      type: logType,
      userId: member.user.id,
      username: member.user.tag,
      channelId: newState.channel.id,
      channelName: newState.channel.name,
      metadata: {
        oldChannelId: oldState.channel.id,
        oldChannelName: oldState.channel.name
      }
    });

    embed = new EmbedBuilder()
      .setTitle('Ses Kanali Degisti')
      .setColor('#FFA500')
      .addFields(
        { name: 'Kullanici', value: member.user.tag, inline: true },
        { name: 'Eski', value: oldState.channel.name, inline: true },
        { name: 'Yeni', value: newState.channel.name, inline: true },
      )
      .setTimestamp();
  }

  const cfg = settings.logging?.voice;
  if (embed && cfg?.channelId) {
    await sendLog(guild, cfg.channelId, embed);
  }
}

module.exports = { memberJoin, memberLeave, messageDelete, messageEdit, voiceUpdate };
