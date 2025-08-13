import { ModelSelector } from './model-selector.js';
import { OpenAIAdapter } from '../adapters/openai-adapter.js';
import { GoogleAdapter } from '../adapters/google-adapter.js';
import { AnthropicAdapter } from '../adapters/anthropic-adapter.js';
import { RateLimiter } from '../security/rate-limiter.js';
import { MetricsCollector } from '../utils/metrics.js';
import { Logger } from '../utils/logger.js';

/**
 * Main model router for handling query routing and execution
 */
export class ModelRouter {
  constructor(config) {
    this.config = config;
    this.logger = new Logger('ModelRouter');
    
    // Prepare config for ModelSelector with available models list
    const selectorConfig = {
      ...config,
      available_models: Object.keys(config.models || {}),
      default_model: config.routing?.default_model || 'o3-mini'
    };
    
    this.selector = new ModelSelector(selectorConfig);
    this.rateLimiter = new RateLimiter(config.rate_limits || {});
    this.metrics = new MetricsCollector();
    
    // Initialize adapters
    this.adapters = new Map();
    this.initializeAdapters();
  }

  /**
   * Initialize model adapters based on configuration
   */
  initializeAdapters() {
    const models = this.config.models || {};
    
    for (const [modelId, modelConfig] of Object.entries(models)) {
      try {
        // Skip disabled models
        if (modelConfig.enabled === false) {
          this.logger.info(`Skipping disabled model: ${modelId}`);
          continue;
        }
        
        let adapter;
        
        switch (modelConfig.provider) {
          case 'openai':
            adapter = new OpenAIAdapter(modelConfig);
            break;
          case 'google':
            adapter = new GoogleAdapter(modelConfig);
            break;
          case 'anthropic':
            adapter = new AnthropicAdapter(modelConfig);
            break;
          default:
            this.logger.warn(`Unknown provider: ${modelConfig.provider} for model ${modelId}`);
            continue;
        }
        
        this.adapters.set(modelId, adapter);
        this.logger.info(`Initialized ${modelId} adapter (${modelConfig.provider})`);
      } catch (error) {
        this.logger.error(`Failed to initialize ${modelId} adapter:`, error);
      }
    }

    this.logger.info(`Initialized ${this.adapters.size} model adapters`);
  }

  /**
   * Route a query to the best model or specified model
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Response from the model
   */
  async routeQuery(args) {
    const startTime = Date.now();
    
    try {
      // Check rate limits
      await this.rateLimiter.checkLimit(this.getClientIdentifier(args));
      
      // Select model (explicit or automatic)
      const modelId = args.model || await this.selector.selectBestModel(
        args.query, 
        args.context,
        args.preferences
      );
      
      this.logger.info(`Routing query to model: ${modelId}`);
      
      // Execute query
      const result = await this.callModel(modelId, args);
      
      // Record metrics
      const duration = Date.now() - startTime;
      await this.recordMetrics(modelId, result, duration, true);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.recordMetrics(args.model || 'unknown', null, duration, false);
      
      this.logger.error('Query routing failed:', error);
      throw error;
    }
  }

  /**
   * Call a specific model
   * @param {string} modelId - Model identifier
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Response from the model
   */
  async callModel(modelId, args) {
    const adapter = this.adapters.get(modelId);
    if (!adapter) {
      const availableModels = Array.from(this.adapters.keys());
      throw new Error(`Model not available: ${modelId}. Available models: ${availableModels.join(', ')}`);
    }

    this.logger.debug(`Calling model ${modelId} with query: ${args.query?.substring(0, 100)}...`);
    
    try {
      const result = await adapter.call(args);
      
      this.logger.info(`Model ${modelId} responded successfully`, {
        tokens: result.usage?.total_tokens,
        cost: result.cost,
        duration: result.duration
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Model ${modelId} call failed:`, error);
      
      // Try fallback model if configured and error suggests model unavailability
      if (this.shouldUseFallback(error) && this.config.fallback_model && modelId !== this.config.fallback_model) {
        this.logger.warn(`Attempting fallback to ${this.config.fallback_model}`);
        return await this.callModel(this.config.fallback_model, args);
      }
      
      throw error;
    }
  }

  /**
   * List available models and their information
   * @returns {Promise<Object>} Model information
   */
  async listModels() {
    const models = [];
    const healthChecks = [];
    
    for (const [id, adapter] of this.adapters) {
      try {
        const [capabilities, availability] = await Promise.all([
          Promise.resolve(adapter.getModelInfo ? adapter.getModelInfo() : adapter.getCapabilities()),
          adapter.checkAvailability()
        ]);
        
        models.push({
          id,
          ...capabilities,
          available: availability.available,
          status: availability.message,
          last_checked: new Date().toISOString()
        });
      } catch (error) {
        models.push({
          id,
          available: false,
          status: `Error: ${error.message}`,
          last_checked: new Date().toISOString()
        });
      }
    }

    const summary = {
      total_models: models.length,
      available_models: models.filter(m => m.available).length,
      providers: [...new Set(models.map(m => m.provider))],
      models: models.sort((a, b) => a.id.localeCompare(b.id))
    };

    return {
      response: JSON.stringify(summary, null, 2),
      model: 'system',
      usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      cost: 0,
      duration: 0
    };
  }

  /**
   * Get model recommendations for a query
   * @param {Object} args - Query arguments
   * @returns {Promise<Object>} Model recommendations
   */
  async getModelRecommendations(args) {
    try {
      const recommendations = await this.selector.getModelRecommendations(
        args.query,
        args.context,
        args.limit || 3
      );

      const response = {
        query: args.query,
        recommendations: recommendations,
        timestamp: new Date().toISOString()
      };

      return {
        response: JSON.stringify(response, null, 2),
        model: 'system',
        usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
        cost: 0,
        duration: 0
      };
    } catch (error) {
      this.logger.error('Failed to get model recommendations:', error);
      throw error;
    }
  }

  /**
   * Get router statistics
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
   * Record metrics for a query
   * @param {string} modelId - Model used
   * @param {Object} result - Query result
   * @param {number} duration - Duration in ms
   * @param {boolean} success - Whether the query succeeded
   */
  async recordMetrics(modelId, result, duration, success) {
    try {
      await this.metrics.record({
        model: modelId,
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
   * Determine if fallback should be used based on error
   * @param {Error} error - The error that occurred
   * @returns {boolean} Whether to use fallback
   */
  shouldUseFallback(error) {
    const fallbackCodes = [
      'MODEL_NOT_AVAILABLE',
      'RATE_LIMIT_EXCEEDED',
      'QUOTA_EXCEEDED',
      'TIMEOUT'
    ];
    
    return fallbackCodes.includes(error.code) || 
           error.message?.includes('not available') ||
           error.message?.includes('rate limit') ||
           error.message?.includes('quota');
  }

  /**
   * Get client identifier for rate limiting
   * @param {Object} args - Query arguments
   * @returns {string} Client identifier
   */
  getClientIdentifier(args) {
    return args.client_id || args.user_id || 'anonymous';
  }

  /**
   * Health check for all adapters
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      models: {},
      timestamp: new Date().toISOString()
    };

    for (const [id, adapter] of this.adapters) {
      try {
        const availability = await adapter.checkAvailability();
        health.models[id] = {
          status: availability.available ? 'healthy' : 'unhealthy',
          message: availability.message
        };
        
        if (!availability.available) {
          health.status = 'degraded';
        }
      } catch (error) {
        health.models[id] = {
          status: 'error',
          message: error.message
        };
        health.status = 'degraded';
      }
    }

    return {
      response: JSON.stringify(health, null, 2),
      model: 'system',
      usage: { total_tokens: 0, input_tokens: 0, output_tokens: 0 },
      cost: 0,
      duration: 0
    };
  }
}
