const { EmbedBuilder } = require('discord.js');

/**
 * Değişkenleri değiştir
 */
function replaceVars(text, member) {
  return text
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{usertag}/g, member.user.tag)
    .replace(/{userid}/g, member.user.id)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, member.guild.memberCount.toString());
}

/**
 * Hoşgeldin mesajı gönder
 */
async function sendWelcome(member, settings) {
  try {
    const { welcome } = settings;
    if (!welcome.channelId) return;
    
    const channel = member.guild.channels.cache.get(welcome.channelId);
    if (!channel) return;
    
    const message = replaceVars(welcome.message, member);
    
    if (welcome.embedEnabled) {
      const embed = new EmbedBuilder()
        .setTitle(welcome.embedTitle || 'Hoşgeldin!')
        .setDescription(message)
        .setColor(welcome.embedColor || '#5865F2')
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(message);
    }
    
    // DM
    if (welcome.dmEnabled && welcome.dmMessage) {
      try {
        await member.send(replaceVars(welcome.dmMessage, member));
      } catch (e) {
        // DM kapalı olabilir
      }
    }
  } catch (error) {
    console.error('[Welcome Error]', error.message);
  }
}

/**
 * Ayrılış mesajı gönder
 */
async function sendLeave(member, settings) {
  try {
    const { leave } = settings;
    if (!leave.channelId) return;
    
    const channel = member.guild.channels.cache.get(leave.channelId);
    if (!channel) return;
    
    const message = replaceVars(leave.message, member);
    
    if (leave.embedEnabled) {
      const embed = new EmbedBuilder()
        .setDescription(message)
        .setColor(leave.embedColor || '#ED4245')
        .setTimestamp();
      
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(message);
    }
  } catch (error) {
    console.error('[Leave Error]', error.message);
  }
}

/**
 * Oto-rol ata
 */
async function assignRoles(member, settings) {
  try {
    const { autorole } = settings;
    if (!autorole.roles?.length) return;
    
    // Gecikme
    if (autorole.delay > 0) {
      await new Promise(r => setTimeout(r, autorole.delay * 1000));
    }
    
    // Üye hala var mı kontrol et
    const freshMember = await member.guild.members.fetch(member.id).catch(() => null);
    if (!freshMember) return;
    
    // Bot'un atabileceği rolleri filtrele
    const validRoles = autorole.roles.filter(roleId => {
      const role = member.guild.roles.cache.get(roleId);
      return role && role.position < member.guild.members.me.roles.highest.position;
    });
    
    if (validRoles.length > 0) {
      await freshMember.roles.add(validRoles, 'Oto-rol');
    }
  } catch (error) {
    console.error('[AutoRole Error]', error.message);
  }
}

module.exports = { sendWelcome, sendLeave, assignRoles, replaceVars };
