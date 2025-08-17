import { OpenAIAdapter } from './adapters/openai-adapter.js';
import { RateLimiter } from './security/rate-limiter.js';
import { MetricsCollector } from './utils/metrics.js';
import { Logger } from './utils/logger.js';

/**
 * Simplified O3-Pro direct service
 * No routing complexity - just direct O3-Pro calls with essential features
 */
export class O3ProService {
  constructor(config, fileTools = null) {
    this.config = config;
    this.logger = new Logger('O3ProService');
    this.fileTools = fileTools;
    
    // Initialize O3-Pro adapter
    const o3ProConfig = config.models?.['o3-pro'] || {
      provider: 'openai',
      model_name: 'o3-pro',
      name: 'OpenAI O3 Pro',
      enabled: true,
      capabilities: ["reasoning", "coding", "analysis", "math", "function_calling"],
      default_params: {
        temperature: null,
        max_tokens: 100000,
        reasoning_effort: "high"
      },
      rate_limit: {
        requests_per_minute: 50,
        requests_per_day: 1000
      },
      timeout_ms: 60000
    };
    
    this.adapter = new OpenAIAdapter(o3ProConfig);
    this.rateLimiter = new RateLimiter(config.rate_limits || {});
    this.metrics = new MetricsCollector();
    
    this.logger.info('O3-Pro service initialized');
  }

  /**
   * Query O3-Pro directly
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Response from O3-Pro
   */
  async query(args) {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      await this.rateLimiter.checkLimit(this.getClientIdentifier(args));
      
      this.logger.info('Sending query to O3-Pro');
      
      // Execute query with function calling support
      const result = await this.callO3ProWithFunctions(args);
      
      // Record metrics
      const duration = Date.now() - startTime;
      await this.recordMetrics(result, duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordMetrics(null, duration, false);
      
      this.logger.error('O3-Pro query failed:', error);
      throw error;
    }
  }

  /**
   * Call O3-Pro with function calling support for file operations
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Response from O3-Pro
   */
  async callO3ProWithFunctions(args) {
    this.logger.debug('Calling O3-Pro with function calling support');
    
    try {
      // Enable function calling for file operations
      args.enable_functions = true;
      args.fileTools = this.fileTools;
      
      const result = await this.adapter.call(args);
      
      this.logger.info('O3-Pro responded successfully', {
        tokens: result.usage?.total_tokens,
        cost: result.cost,
        duration: result.duration
      });
      
      return result;
    } catch (error) {
      this.logger.error('O3-Pro call failed:', error);
      throw error;
    }
  }

  /**
   * Get O3-Pro model information
   * @returns {Promise<Object>} Model information
   */
  async getModelInfo() {
    try {
      const [capabilities, availability] = await Promise.all([
        Promise.resolve(this.adapter.getModelInfo ? this.adapter.getModelInfo() : this.adapter.getCapabilities()),
        this.adapter.checkAvailability()
      ]);
      
      const modelInfo = {
        id: 'o3-pro',
        ...capabilities,
        available: availability.available,
        status: availability.message,
        last_checked: new Date().toISOString()
      };

      return {
        response: JSON.stringify(modelInfo, null, 2),
        model: 'system',
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
        cost: 0,
        duration: 0
      };
    } catch (error) {
      const errorInfo = {
        id: 'o3-pro',
        available: false,
        status: `Error: ${error.message}`,
        last_checked: new Date().toISOString()
      };

      return {
        response: JSON.stringify(errorInfo, null, 2),
        model: 'system',
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
        cost: 0,
        duration: 0
      };
    }
  }

  /**
   * Get service statistics
   * @returns {Promise<Object>} Usage statistics
   */
  async getStats() {
    const stats = await this.metrics.getStats();
    
    return {
      response: JSON.stringify(stats, null, 2),
      model: 'system',
      usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      cost: 0,
      duration: 0
    };
  }

  /**
   * Health check for O3-Pro
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      service: 'o3-pro-direct',
      timestamp: new Date().toISOString()
    };

    try {
      const availability = await this.adapter.checkAvailability();
      health.status = availability.available ? 'healthy' : 'unhealthy';
      health.message = availability.message;
      health.o3_pro = {
        status: availability.available ? 'healthy' : 'unhealthy',
        message: availability.message
      };
    } catch (error) {
      health.status = 'error';
      health.message = error.message;
      health.o3_pro = {
        status: 'error',
        message: error.message
      };
    }

    return {
      response: JSON.stringify(health, null, 2),
      model: 'system',
      usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      cost: 0,
      duration: 0
    };
  }

  /**
   * Record metrics for a query
   * @param {Object} result - Query result
   * @param {number} duration - Duration in ms
   * @param {boolean} success - Whether the query succeeded
   */
  async recordMetrics(result, duration, success) {
    try {
      await this.metrics.record({
        model: 'o3-pro',
        tokens: result?.usage?.total_tokens || 0,
        cost: result?.cost || 0,
        duration: duration,
        success: success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.warn('Failed to record metrics:', error);
    }
  }

  /**
   * Get client identifier for rate limiting
   * @param {Object} args - Query arguments
   * @returns {string} Client identifier
   */
  getClientIdentifier(args) {
    return args.client_id || args.user_id || 'anonymous';
  }
}
