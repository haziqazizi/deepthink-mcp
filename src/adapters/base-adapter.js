/**
 * Base adapter interface for AI model integrations
 */
export class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.name = config.name;
    this.provider = config.provider;
    this.modelName = config.model_name;
    this.capabilities = config.capabilities || [];
    this.costPer1kTokens = config.cost_per_1k_tokens || 0;
    this.rateLimits = config.rate_limit || {};
    this.startTime = null;
  }

  /**
   * Execute a query against the model
   * @param {Object} args - Query arguments
   * @param {string} args.query - The main query text
   * @param {string} [args.context] - Additional context
   * @param {number} [args.max_tokens] - Maximum tokens to generate
   * @param {number} [args.temperature] - Temperature for generation
   * @param {string} [args.reasoning_level] - Level of reasoning (if supported)
   * @returns {Promise<Object>} Formatted response
   */
  async call(args) {
    throw new Error('call() method must be implemented by subclass');
  }

  /**
   * Check if the model/service is currently available
   * @returns {Promise<Object>} Availability status
   */
  async checkAvailability() {
    throw new Error('checkAvailability() method must be implemented by subclass');
  }

  /**
   * Get model capabilities and metadata
   * @returns {Object} Model capabilities
   */
  getCapabilities() {
    return {
      id: this.modelName,
      name: this.name,
      provider: this.provider,
      capabilities: this.capabilities,
      cost_per_1k_tokens: this.costPer1kTokens,
      rate_limits: this.rateLimits
    };
  }

  /**
   * Format response in standard format
   * @param {string} response - The response text
   * @param {Object} usage - Token usage information
   * @param {string} model - Model identifier used
   * @returns {Object} Formatted response
   */
  formatResponse(response, usage = {}, model = null) {
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    
    return {
      response: response,
      model: model || this.modelName,
      usage: {
        input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
        output_tokens: usage.completion_tokens || usage.output_tokens || 0,
        total_tokens: usage.total_tokens || 0,
        reasoning_tokens: usage.reasoning_tokens || 0
      },
      cost: this.calculateCost(usage),
      duration: duration,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate cost based on token usage
   * @param {Object} usage - Token usage object
   * @returns {number} Cost in USD
   */
  calculateCost(usage) {
    if (!usage || !this.costPer1kTokens) return 0;
    
    const totalTokens = usage.total_tokens || 
                       (usage.input_tokens || usage.prompt_tokens || 0) + 
                       (usage.output_tokens || usage.completion_tokens || 0);
    
    return (totalTokens / 1000) * this.costPer1kTokens;
  }

  /**
   * Validate required arguments
   * @param {Object} args - Arguments to validate
   * @param {string[]} requiredFields - Required field names
   * @throws {Error} If required fields are missing
   */
  validateArgs(args, requiredFields = ['query']) {
    for (const field of requiredFields) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Handle API errors with user-friendly messages
   * @param {Error} error - The original error
   * @param {string} context - Context where error occurred
   * @throws {Error} User-friendly formatted error
   */
  handleError(error, context = 'API call') {
    const userMessage = this.createUserFriendlyError(error);
    
    // Preserve original error properties for logging
    const formattedError = new Error(userMessage);
    formattedError.provider = this.provider;
    formattedError.model = this.modelName;
    formattedError.originalError = error;
    
    // Add specific error codes for common issues
    if (error.message?.includes('rate limit')) {
      formattedError.code = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message?.includes('authentication') || error.message?.includes('unauthorized')) {
      formattedError.code = 'AUTHENTICATION_FAILED';
    } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
      formattedError.code = 'QUOTA_EXCEEDED';
    } else if (error.message?.includes('timeout')) {
      formattedError.code = 'TIMEOUT';
    } else {
      formattedError.code = 'API_ERROR';
    }
    
    throw formattedError;
  }

  /**
   * Create user-friendly error messages based on the error type
   * @param {Error} error - The original error
   * @returns {string} User-friendly error message
   */
  createUserFriendlyError(error) {
    const message = error.message || '';
    const status = error.status || error.statusCode;

    // Handle common API key issues
    if (status === 401 || message.includes('invalid_api_key') || message.includes('Incorrect API key') || message.includes('authentication')) {
      return '🔑 Invalid OpenAI API key. Please check your API key in the .env file:\n\n1. Make sure OPENAI_API_KEY is set correctly\n2. Verify your key at https://platform.openai.com/api-keys\n3. Restart Claude Code after updating the key';
    }
    
    if (message.includes('insufficient_quota') || message.includes('exceeded your current quota')) {
      return '💳 OpenAI API quota exceeded. Please:\n\n1. Check your usage at https://platform.openai.com/usage\n2. Add billing information if needed\n3. Wait for quota to reset or upgrade your plan';
    }
    
    if (status === 429 || message.includes('rate_limit_exceeded') || message.includes('Rate limit')) {
      return '⏱️ Rate limit exceeded. Please wait a moment and try again.\n\nO3 models have strict rate limits. Consider using "medium" or "low" reasoning level for faster requests.';
    }
    
    if (message.includes('model_not_found') || message.includes('does not exist')) {
      return '🤖 O3-Pro model not available. Please:\n\n1. Check if your OpenAI account has access to O3 models\n2. Verify you\'re using the latest API\n3. Contact OpenAI support if needed';
    }
    
    if (message.includes('service_unavailable') || message.includes('temporarily overloaded') || message.includes('502') || message.includes('503')) {
      return '🔧 OpenAI service temporarily unavailable. This is usually temporary - please try again in a few minutes.';
    }
    
    if (message.includes('timeout') || message.includes('ECONNRESET') || message.includes('network') || message.includes('ENOTFOUND')) {
      return '🌐 Network connection issue. Please:\n\n1. Check your internet connection\n2. Try again in a moment\n3. If using a VPN, try without it';
    }

    if (message.includes('Unsupported parameter')) {
      return '⚙️ Invalid parameter for O3 model. This has been automatically handled - please try your request again.';
    }

    // Generic fallback with helpful context
    return `❌ DeepThink encountered an issue: ${message}\n\nIf this persists:\n1. Check your OpenAI API key and account status\n2. Try again in a few minutes\n3. Consider using a simpler query`;
  }

  /**
   * Start timing for performance measurement
   */
  startTimer() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since timer started
   * @returns {number} Elapsed time in milliseconds
   */
  getElapsedTime() {
    return this.startTime ? Date.now() - this.startTime : 0;
  }
}
