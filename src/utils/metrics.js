/**
 * Metrics collector for tracking usage, performance, and costs
 */
export class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: [],
      totals: {
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
        successful_requests: 0,
        failed_requests: 0
      },
      models: {},
      daily: {},
      hourly: {}
    };
    
    // Clean up old metrics periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 3600000); // Clean up every hour
  }

  /**
   * Record a new metric entry
   * @param {Object} metric - Metric data
   */
  async record(metric) {
    const {
      model,
      tokens = 0,
      cost = 0,
      duration = 0,
      success = true,
      timestamp = new Date().toISOString()
    } = metric;

    const date = new Date(timestamp);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const hourKey = `${dateKey}T${date.getHours().toString().padStart(2, '0')}`;

    // Store individual request
    this.metrics.requests.push({
      model,
      tokens,
      cost,
      duration,
      success,
      timestamp
    });

    // Update totals
    this.metrics.totals.total_requests++;
    this.metrics.totals.total_tokens += tokens;
    this.metrics.totals.total_cost += cost;
    
    if (success) {
      this.metrics.totals.successful_requests++;
    } else {
      this.metrics.totals.failed_requests++;
    }

    // Update per-model metrics
    if (!this.metrics.models[model]) {
      this.metrics.models[model] = {
        requests: 0,
        tokens: 0,
        cost: 0,
        avg_duration: 0,
        success_rate: 0,
        total_duration: 0
      };
    }

    const modelMetrics = this.metrics.models[model];
    modelMetrics.requests++;
    modelMetrics.tokens += tokens;
    modelMetrics.cost += cost;
    modelMetrics.total_duration += duration;
    modelMetrics.avg_duration = modelMetrics.total_duration / modelMetrics.requests;
    
    // Update success rate
    const modelRequests = this.metrics.requests.filter(r => r.model === model);
    const successfulModelRequests = modelRequests.filter(r => r.success).length;
    modelMetrics.success_rate = (successfulModelRequests / modelRequests.length) * 100;

    // Update daily metrics
    if (!this.metrics.daily[dateKey]) {
      this.metrics.daily[dateKey] = {
        requests: 0,
        tokens: 0,
        cost: 0,
        models: {}
      };
    }

    this.metrics.daily[dateKey].requests++;
    this.metrics.daily[dateKey].tokens += tokens;
    this.metrics.daily[dateKey].cost += cost;

    if (!this.metrics.daily[dateKey].models[model]) {
      this.metrics.daily[dateKey].models[model] = { requests: 0, tokens: 0, cost: 0 };
    }
    this.metrics.daily[dateKey].models[model].requests++;
    this.metrics.daily[dateKey].models[model].tokens += tokens;
    this.metrics.daily[dateKey].models[model].cost += cost;

    // Update hourly metrics
    if (!this.metrics.hourly[hourKey]) {
      this.metrics.hourly[hourKey] = {
        requests: 0,
        tokens: 0,
        cost: 0,
        models: {}
      };
    }

    this.metrics.hourly[hourKey].requests++;
    this.metrics.hourly[hourKey].tokens += tokens;
    this.metrics.hourly[hourKey].cost += cost;

    if (!this.metrics.hourly[hourKey].models[model]) {
      this.metrics.hourly[hourKey].models[model] = { requests: 0, tokens: 0, cost: 0 };
    }
    this.metrics.hourly[hourKey].models[model].requests++;
    this.metrics.hourly[hourKey].models[model].tokens += tokens;
    this.metrics.hourly[hourKey].models[model].cost += cost;
  }

  /**
   * Get comprehensive statistics
   * @param {Object} options - Query options
   * @returns {Object} Statistics
   */
  async getStats(options = {}) {
    const { 
      period = 'all', // 'all', 'today', 'week', 'month'
      model = null 
    } = options;

    const now = new Date();
    let filteredRequests = this.metrics.requests;

    // Filter by time period
    if (period !== 'all') {
      const cutoffDate = new Date();
      
      switch (period) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(cutoffDate.getMonth() - 1);
          break;
      }
      
      filteredRequests = this.metrics.requests.filter(
        r => new Date(r.timestamp) >= cutoffDate
      );
    }

    // Filter by model if specified
    if (model) {
      filteredRequests = filteredRequests.filter(r => r.model === model);
    }

    // Calculate statistics
    const stats = {
      overview: {
        total_requests: filteredRequests.length,
        successful_requests: filteredRequests.filter(r => r.success).length,
        failed_requests: filteredRequests.filter(r => !r.success).length,
        success_rate: filteredRequests.length > 0 
          ? (filteredRequests.filter(r => r.success).length / filteredRequests.length * 100).toFixed(2)
          : 0,
        total_tokens: filteredRequests.reduce((sum, r) => sum + r.tokens, 0),
        total_cost: filteredRequests.reduce((sum, r) => sum + r.cost, 0).toFixed(4),
        avg_duration: filteredRequests.length > 0 
          ? (filteredRequests.reduce((sum, r) => sum + r.duration, 0) / filteredRequests.length).toFixed(2)
          : 0,
        period: period,
        timestamp: now.toISOString()
      },
      models: this.getModelStats(filteredRequests),
      recent_requests: this.getRecentRequests(5),
      daily_usage: this.getDailyUsage(7), // Last 7 days
      hourly_usage: this.getHourlyUsage(24), // Last 24 hours
      cost_breakdown: this.getCostBreakdown(filteredRequests)
    };

    return stats;
  }

  /**
   * Get per-model statistics
   * @param {Array} requests - Filtered requests
   * @returns {Object} Per-model stats
   */
  getModelStats(requests) {
    const modelStats = {};
    
    for (const request of requests) {
      if (!modelStats[request.model]) {
        modelStats[request.model] = {
          requests: 0,
          tokens: 0,
          cost: 0,
          avg_duration: 0,
          success_rate: 0,
          total_duration: 0
        };
      }
      
      const stats = modelStats[request.model];
      stats.requests++;
      stats.tokens += request.tokens;
      stats.cost += request.cost;
      stats.total_duration += request.duration;
    }

    // Calculate averages and success rates
    for (const [model, stats] of Object.entries(modelStats)) {
      const modelRequests = requests.filter(r => r.model === model);
      const successfulRequests = modelRequests.filter(r => r.success).length;
      
      stats.avg_duration = (stats.total_duration / stats.requests).toFixed(2);
      stats.success_rate = ((successfulRequests / modelRequests.length) * 100).toFixed(2);
      stats.cost = parseFloat(stats.cost.toFixed(4));
      
      delete stats.total_duration; // Remove internal field
    }

    return modelStats;
  }

  /**
   * Get recent requests
   * @param {number} limit - Number of recent requests
   * @returns {Array} Recent requests
   */
  getRecentRequests(limit = 10) {
    return this.metrics.requests
      .slice(-limit)
      .map(r => ({
        model: r.model,
        tokens: r.tokens,
        cost: parseFloat(r.cost.toFixed(4)),
        duration: r.duration,
        success: r.success,
        timestamp: r.timestamp
      }));
  }

  /**
   * Get daily usage for the last N days
   * @param {number} days - Number of days
   * @returns {Array} Daily usage data
   */
  getDailyUsage(days = 7) {
    const result = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      const dayData = this.metrics.daily[dateKey] || {
        requests: 0,
        tokens: 0,
        cost: 0
      };
      
      result.push({
        date: dateKey,
        requests: dayData.requests,
        tokens: dayData.tokens,
        cost: parseFloat(dayData.cost.toFixed(4))
      });
    }
    
    return result;
  }

  /**
   * Get hourly usage for the last N hours
   * @param {number} hours - Number of hours
   * @returns {Array} Hourly usage data
   */
  getHourlyUsage(hours = 24) {
    const result = [];
    const now = new Date();
    
    for (let i = hours - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setHours(date.getHours() - i);
      const hourKey = `${date.toISOString().split('T')[0]}T${date.getHours().toString().padStart(2, '0')}`;
      
      const hourData = this.metrics.hourly[hourKey] || {
        requests: 0,
        tokens: 0,
        cost: 0
      };
      
      result.push({
        hour: hourKey,
        requests: hourData.requests,
        tokens: hourData.tokens,
        cost: parseFloat(hourData.cost.toFixed(4))
      });
    }
    
    return result;
  }

  /**
   * Get cost breakdown analysis
   * @param {Array} requests - Filtered requests
   * @returns {Object} Cost breakdown
   */
  getCostBreakdown(requests) {
    const breakdown = {
      by_model: {},
      total: 0,
      avg_per_request: 0
    };

    for (const request of requests) {
      if (!breakdown.by_model[request.model]) {
        breakdown.by_model[request.model] = {
          cost: 0,
          requests: 0,
          percentage: 0
        };
      }
      
      breakdown.by_model[request.model].cost += request.cost;
      breakdown.by_model[request.model].requests++;
      breakdown.total += request.cost;
    }

    // Calculate percentages
    for (const stats of Object.values(breakdown.by_model)) {
      stats.percentage = breakdown.total > 0 
        ? ((stats.cost / breakdown.total) * 100).toFixed(2) 
        : 0;
      stats.cost = parseFloat(stats.cost.toFixed(4));
    }

    breakdown.total = parseFloat(breakdown.total.toFixed(4));
    breakdown.avg_per_request = requests.length > 0 
      ? parseFloat((breakdown.total / requests.length).toFixed(4))
      : 0;

    return breakdown;
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanup() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = new Date(Date.now() - maxAge);

    // Clean up individual requests
    this.metrics.requests = this.metrics.requests.filter(
      r => new Date(r.timestamp) > cutoff
    );

    // Clean up daily metrics older than 30 days
    const dailyCutoff = new Date();
    dailyCutoff.setDate(dailyCutoff.getDate() - 30);
    const dailyCutoffKey = dailyCutoff.toISOString().split('T')[0];
    
    for (const dateKey of Object.keys(this.metrics.daily)) {
      if (dateKey < dailyCutoffKey) {
        delete this.metrics.daily[dateKey];
      }
    }

    // Clean up hourly metrics older than 7 days
    const hourlyCutoff = new Date();
    hourlyCutoff.setDate(hourlyCutoff.getDate() - 7);
    const hourlyCutoffKey = `${hourlyCutoff.toISOString().split('T')[0]}T${hourlyCutoff.getHours().toString().padStart(2, '0')}`;
    
    for (const hourKey of Object.keys(this.metrics.hourly)) {
      if (hourKey < hourlyCutoffKey) {
        delete this.metrics.hourly[hourKey];
      }
    }
  }

  /**
   * Reset all metrics (admin function)
   */
  reset() {
    this.metrics = {
      requests: [],
      totals: {
        total_requests: 0,
        total_tokens: 0,
        total_cost: 0,
        successful_requests: 0,
        failed_requests: 0
      },
      models: {},
      daily: {},
      hourly: {}
    };
  }

  /**
   * Destroy metrics collector
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
