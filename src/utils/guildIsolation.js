/**
 * Guild Isolation System
 * 
 * Production-grade guild bazlı izolasyon sistemi.
 * Her guild bağımsız çalışır - bir guild'in pasif olması diğerlerini ETKİLEMEZ.
 * 
 * Özellikler:
 * - Memory cache ile yüksek performans
 * - Global flag YOK - sadece guild bazlı kontrol
 * - Tek satırlık event kontrolü
 * - Cache invalidation desteği
 */

const GuildSettings = require('../models/GuildSettings');

// ==================== MEMORY CACHE ====================
// Guild enabled durumları için hızlı cache
const enabledCache = new Map();

// Cache ayarları
const CACHE_TTL = 30000; // 30 saniye (daha kısa TTL = daha hızlı güncelleme)
const CACHE_CLEANUP_INTERVAL = 60000; // 1 dakikada bir temizlik

/**
 * Guild'in aktif olup olmadığını kontrol et
 * Bu fonksiyon her event'in EN BAŞINDA çağrılacak
 * 
 * @param {string} guildId - Discord Guild ID
 * @returns {Promise<boolean>} - true: aktif, false: pasif
 * 
 * Kullanım:
 * if (!await isGuildEnabled(guildId)) return;
 */
async function isGuildEnabled(guildId) {
  if (!guildId) return false;
  
  // 1. Cache'e bak
  const cached = enabledCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.enabled;
  }
  
  // 2. Cache miss - DB'den çek
  try {
    const settings = await GuildSettings.findOne(
      { guildId }, 
      { botEnabled: 1 } // Sadece gerekli field'ı çek
    ).lean(); // Plain object döndür (daha hızlı)
    
    const enabled = settings?.botEnabled !== false; // default true
    
    // Cache'e kaydet
    enabledCache.set(guildId, { 
      enabled, 
      timestamp: Date.now() 
    });
    
    return enabled;
  } catch (error) {
    console.error(`[Isolation] DB error for ${guildId}:`, error.message);
    // Hata durumunda güvenli tarafta kal - enabled kabul et
    return true;
  }
}

/**
 * Senkron cache kontrolü (async olmadan)
 * Sadece cache'de varsa döner, yoksa null
 * Ultra-hızlı kontrol için
 * 
 * @param {string} guildId 
 * @returns {boolean|null} - true/false veya null (cache miss)
 */
function isGuildEnabledSync(guildId) {
  if (!guildId) return false;
  
  const cached = enabledCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.enabled;
  }
  
  return null; // Cache miss
}

/**
 * Guild cache'ini invalidate et
 * Dashboard'dan güncelleme yapıldığında çağrılır
 * 
 * @param {string} guildId - null ise tüm cache temizlenir
 */
function invalidateCache(guildId = null) {
  if (guildId) {
    enabledCache.delete(guildId);
    console.log(`[Isolation] Cache invalidated for ${guildId}`);
  } else {
    enabledCache.clear();
    console.log('[Isolation] All cache cleared');
  }
}

/**
 * Guild'i aktif/pasif yap
 * Dashboard'dan çağrılacak
 * 
 * @param {string} guildId 
 * @param {boolean} enabled 
 * @returns {Promise<boolean>} - başarılı mı
 */
async function setGuildEnabled(guildId, enabled) {
  if (!guildId) return false;
  
  try {
    await GuildSettings.updateOne(
      { guildId },
      { $set: { botEnabled: enabled } },
      { upsert: true }
    );
    
    // Cache'i güncelle (invalidate değil, direkt güncelle)
    enabledCache.set(guildId, { 
      enabled, 
      timestamp: Date.now() 
    });
    
    console.log(`[Isolation] Guild ${guildId} set to ${enabled ? 'ENABLED' : 'DISABLED'}`);
    return true;
  } catch (error) {
    console.error(`[Isolation] Failed to set guild ${guildId}:`, error.message);
    return false;
  }
}

/**
 * Toplu guild durumu getir (dashboard için)
 * 
 * @param {string[]} guildIds 
 * @returns {Promise<Map<string, boolean>>}
 */
async function getGuildsStatus(guildIds) {
  const result = new Map();
  
  if (!guildIds?.length) return result;
  
  try {
    const settings = await GuildSettings.find(
      { guildId: { $in: guildIds } },
      { guildId: 1, botEnabled: 1 }
    ).lean();
    
    // Bulunanları ekle
    for (const s of settings) {
      result.set(s.guildId, s.botEnabled !== false);
    }
    
    // Bulunamayanlar default enabled
    for (const id of guildIds) {
      if (!result.has(id)) {
        result.set(id, true);
      }
    }
  } catch (error) {
    console.error('[Isolation] Bulk status error:', error.message);
    // Hata durumunda hepsini enabled kabul et
    for (const id of guildIds) {
      result.set(id, true);
    }
  }
  
  return result;
}

/**
 * Cache istatistikleri (monitoring için)
 */
function getCacheStats() {
  return {
    size: enabledCache.size,
    entries: Array.from(enabledCache.entries()).map(([id, data]) => ({
      guildId: id,
      enabled: data.enabled,
      age: Date.now() - data.timestamp
    }))
  };
}

// ==================== CACHE CLEANUP ====================
// Expired cache entry'lerini periyodik temizle
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [guildId, data] of enabledCache.entries()) {
    if (now - data.timestamp > CACHE_TTL * 2) {
      enabledCache.delete(guildId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Isolation] Cleaned ${cleaned} expired cache entries`);
  }
}, CACHE_CLEANUP_INTERVAL);

// ==================== EXPORTS ====================
module.exports = {
  isGuildEnabled,
  isGuildEnabledSync,
  invalidateCache,
  setGuildEnabled,
  getGuildsStatus,
  getCacheStats,
  
  // Constants (dışarıdan erişim için)
  CACHE_TTL,
};
