const { EmbedBuilder } = require('discord.js');
const leveling = require('./leveling');

/**
 * Komut işleyici
 */
async function handle(client, message, settings, prefix) {
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  
  // Devre dışı komut kontrolü
  if (settings.disabledCommands?.includes(cmd)) return;
  
  // Özel komutlar
  const custom = settings.customCommands?.find(c => c.enabled && c.name === cmd);
  if (custom) {
    const response = custom.response
      .replace(/{user}/g, message.author.toString())
      .replace(/{username}/g, message.author.username)
      .replace(/{server}/g, message.guild.name);
    return message.channel.send(response);
  }
  
  // Yerleşik komutlar
  switch (cmd) {
    case 'help':
      return helpCmd(message, prefix);
    case 'ping':
      return pingCmd(client, message);
    case 'serverinfo':
      return serverInfoCmd(message);
    case 'userinfo':
      return userInfoCmd(message, args);
    case 'rank':
    case 'level':
      return rankCmd(message, args, settings);
    case 'leaderboard':
    case 'lb':
    case 'top':
      return leaderboardCmd(message, settings);
  }
}

// ==================== KOMUTLAR ====================

async function helpCmd(message, prefix) {
  const embed = new EmbedBuilder()
    .setTitle('📚 Komutlar')
    .setColor('#5865F2')
    .setDescription(`Prefix: \`${prefix}\``)
    .addFields(
      { name: '📊 Seviye', value: '`rank`, `leaderboard`', inline: true },
      { name: '🔧 Genel', value: '`help`, `ping`, `serverinfo`, `userinfo`', inline: true },
    );
  
  await message.reply({ embeds: [embed] });
}

async function pingCmd(client, message) {
  const sent = await message.reply('🏓 Pinging...');
  const latency = sent.createdTimestamp - message.createdTimestamp;
  await sent.edit(`🏓 Pong! Gecikme: **${latency}ms** | API: **${client.ws.ping}ms**`);
}

async function serverInfoCmd(message) {
  const { guild } = message;
  
  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setColor('#5865F2')
    .addFields(
      { name: 'Sahibi', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Üye', value: guild.memberCount.toString(), inline: true },
      { name: 'Kanal', value: guild.channels.cache.size.toString(), inline: true },
      { name: 'Rol', value: guild.roles.cache.size.toString(), inline: true },
      { name: 'Boost', value: `Seviye ${guild.premiumTier}`, inline: true },
      { name: 'Oluşturulma', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setFooter({ text: `ID: ${guild.id}` });
  
  await message.reply({ embeds: [embed] });
}

async function userInfoCmd(message, args) {
  const user = message.mentions.users.first() || message.author;
  const member = message.guild.members.cache.get(user.id);
  
  const embed = new EmbedBuilder()
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setColor(member?.displayHexColor || '#5865F2')
    .addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Hesap', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    );
  
  if (member) {
    embed.addFields(
      { name: 'Katılım', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: 'Roller', value: member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(' ') || 'Yok' },
    );
  }
  
  await message.reply({ embeds: [embed] });
}

async function rankCmd(message, args, settings) {
  if (!settings.leveling?.enabled) {
    return message.reply('❌ Seviye sistemi aktif değil.');
  }
  
  const user = message.mentions.users.first() || message.author;
  const stats = await leveling.getUserStats(message.guild.id, user.id);
  
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .setColor('#FFD700')
    .addFields(
      { name: 'Seviye', value: stats.level.toString(), inline: true },
      { name: 'Sıralama', value: `#${stats.rank}`, inline: true },
      { name: 'XP', value: `${stats.xp}/${stats.requiredXp || 100}`, inline: true },
      { name: 'Toplam XP', value: stats.totalXp.toString(), inline: true },
    );
  
  await message.reply({ embeds: [embed] });
}

async function leaderboardCmd(message, settings) {
  if (!settings.leveling?.enabled) {
    return message.reply('❌ Seviye sistemi aktif değil.');
  }
  
  const users = await leveling.getLeaderboard(message.guild.id, 10);
  
  if (!users.length) {
    return message.reply('📊 Henüz sıralamada kimse yok.');
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${message.guild.name} - Sıralama`)
    .setColor('#FFD700')
    .setDescription(
      users.map((u, i) => 
        `**${i + 1}.** <@${u.oduserId}> - Seviye ${u.level} (${u.totalXp} XP)`
      ).join('\n')
    );
  
  await message.reply({ embeds: [embed] });
}

module.exports = { handle };
