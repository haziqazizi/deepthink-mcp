/**
 * Rate limiter for API requests
 */
export class RateLimiter {
  constructor(config = {}) {
    this.limits = {
      requests_per_minute: config.per_user_requests_per_minute || 50,
      burst_limit: config.burst_limit || 10,
      ...config
    };
    
    // Store usage data in memory (for production, consider using Redis)
    this.usage = new Map();
    this.burstUsage = new Map();
    
    // Clean up old entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if request is within rate limits
   * @param {string} identifier - Client identifier (user ID, API key, etc.)
   * @throws {Error} If rate limit exceeded
   */
  async checkLimit(identifier = 'anonymous') {
    const now = Date.now();
    
    // Check burst limit (short-term)
    await this.checkBurstLimit(identifier, now);
    
    // Check sustained rate limit
    await this.checkSustainedLimit(identifier, now);
  }

  /**
   * Check burst rate limit (prevents spam)
   * @param {string} identifier - Client identifier
   * @param {number} now - Current timestamp
   */
  async checkBurstLimit(identifier, now) {
    const burstWindow = 10000; // 10 seconds
    const burstKey = `${identifier}:burst`;
    
    let burstData = this.burstUsage.get(burstKey);
    if (!burstData) {
      burstData = { count: 0, resetTime: now + burstWindow };
      this.burstUsage.set(burstKey, burstData);
    }

    // Reset if window expired
    if (now > burstData.resetTime) {
      burstData.count = 0;
      burstData.resetTime = now + burstWindow;
    }

    // Check burst limit
    if (burstData.count >= this.limits.burst_limit) {
      const resetIn = Math.ceil((burstData.resetTime - now) / 1000);
      throw new Error(`Burst rate limit exceeded. Try again in ${resetIn} seconds.`);
    }

    burstData.count++;
  }

  /**
   * Check sustained rate limit (per minute)
   * @param {string} identifier - Client identifier
   * @param {number} now - Current timestamp
   */
  async checkSustainedLimit(identifier, now) {
    const minuteWindow = 60000; // 1 minute
    const usage = this.usage.get(identifier);
    
    let currentUsage;
    if (!usage) {
      currentUsage = { count: 0, resetTime: now + minuteWindow };
      this.usage.set(identifier, currentUsage);
    } else {
      currentUsage = usage;
    }

    // Reset if window expired
    if (now > currentUsage.resetTime) {
      currentUsage.count = 0;
      currentUsage.resetTime = now + minuteWindow;
    }

    // Check sustained limit
    if (currentUsage.count >= this.limits.requests_per_minute) {
      const resetIn = Math.ceil((currentUsage.resetTime - now) / 1000);
      const error = new Error(`Rate limit exceeded. Try again in ${resetIn} seconds.`);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.retryAfter = resetIn;
      throw error;
    }

    currentUsage.count++;
  }

  /**
   * Get current usage for an identifier
   * @param {string} identifier - Client identifier
   * @returns {Object} Current usage stats
   */
  getUsage(identifier) {
    const usage = this.usage.get(identifier);
    const burstUsage = this.burstUsage.get(`${identifier}:burst`);
    const now = Date.now();

    return {
      sustained: {
        count: usage?.count || 0,
        limit: this.limits.requests_per_minute,
        resetTime: usage?.resetTime || now + 60000,
        remaining: Math.max(0, this.limits.requests_per_minute - (usage?.count || 0))
      },
      burst: {
        count: burstUsage?.count || 0,
        limit: this.limits.burst_limit,
        resetTime: burstUsage?.resetTime || now + 10000,
        remaining: Math.max(0, this.limits.burst_limit - (burstUsage?.count || 0))
      }
    };
  }

  /**
   * Reset usage for an identifier (admin function)
   * @param {string} identifier - Client identifier
   */
  resetUsage(identifier) {
    this.usage.delete(identifier);
    this.burstUsage.delete(`${identifier}:burst`);
  }

  /**
   * Get all current usage stats (admin function)
   * @returns {Object} All usage statistics
   */
  getAllUsage() {
    const stats = {
      total_clients: this.usage.size,
      clients: {}
    };

    for (const [identifier, usage] of this.usage.entries()) {
      if (!identifier.includes(':burst')) {
        stats.clients[identifier] = this.getUsage(identifier);
      }
    }

    return stats;
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    
    // Clean up sustained rate limit entries
    for (const [key, usage] of this.usage.entries()) {
      if (now > usage.resetTime + 60000) { // Give extra buffer
        this.usage.delete(key);
      }
    }
    
    // Clean up burst rate limit entries
    for (const [key, usage] of this.burstUsage.entries()) {
      if (now > usage.resetTime + 10000) { // Give extra buffer
        this.burstUsage.delete(key);
      }
    }
  }

  /**
   * Update rate limits configuration
   * @param {Object} newLimits - New limits configuration
   */
  updateLimits(newLimits) {
    this.limits = { ...this.limits, ...newLimits };
  }

  /**
   * Destroy rate limiter and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.usage.clear();
    this.burstUsage.clear();
  }
}
