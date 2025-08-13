import OpenAI from 'openai';
import { BaseAdapter } from './base-adapter.js';

/**
 * OpenAI adapter for O3 and other OpenAI models
 */
export class OpenAIAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in environment variables');
    }
    
    this.client = new OpenAI({
      apiKey: apiKey,
      timeout: config.timeout_ms || 30000,
    });
    
    // Default parameters from config
    this.defaultParams = {
      temperature: 0.1,
      max_tokens: 4000,
      top_p: 1.0,
      ...config.default_params
    };
  }

  async call(args) {
    this.validateArgs(args);
    this.startTimer();

    try {
      // Prepare the messages array
      const messages = this.buildMessages(args);
      
      // Prepare request parameters
      const requestParams = {
        model: this.modelName,
        messages: messages,
        max_tokens: args.max_tokens || this.defaultParams.max_tokens,
        top_p: this.defaultParams.top_p,
      };

      // Only add temperature for models that support it (O3 models don't)
      if (!this.modelName.startsWith('o3')) {
        requestParams.temperature = args.temperature ?? this.defaultParams.temperature;
      }

      // Add O3-specific reasoning parameters if applicable
      if (this.supportsReasoning() && args.reasoning_level) {
        requestParams.reasoning = {
          effort: this.mapReasoningLevel(args.reasoning_level),
          summary: 'auto'
        };
      }

      // Make the API call
      let completion;
      
      if (this.isReasoningModel()) {
        // Use Responses API for reasoning models like O3
        completion = await this.client.responses.create({
          model: this.modelName,
          input: this.formatInputForResponses(messages),
          ...this.buildResponsesParams(requestParams, args)
        });
        
        return this.formatResponsesAPIResponse(completion);
      } else {
        // Use Chat Completions API for standard models
        completion = await this.client.chat.completions.create(requestParams);
        
        return this.formatResponse(
          completion.choices[0].message.content,
          completion.usage,
          completion.model
        );
      }
    } catch (error) {
      this.handleError(error, 'API call');
    }
  }

  async checkAvailability() {
    try {
      const models = await this.client.models.list();
      const available = models.data.some(m => 
        m.id === this.modelName || 
        m.id.includes('o3') || 
        m.id.includes('gpt-4')
      );
      
      return { 
        available, 
        message: available ? 'OK' : `Model ${this.modelName} not available`,
        models_found: models.data.map(m => m.id).filter(id => 
          id.includes('o3') || id.includes('gpt-4')
        )
      };
    } catch (error) {
      return { 
        available: false, 
        message: `Error checking availability: ${error.message}` 
      };
    }
  }

  /**
   * Build messages array from arguments
   */
  buildMessages(args) {
    const messages = [];
    
    // Add system message if context provided
    if (args.context) {
      messages.push({
        role: 'system',
        content: args.context
      });
    } else {
      // Default system message
      messages.push({
        role: 'system',
        content: 'You are a helpful AI assistant. Provide accurate, detailed, and well-reasoned responses.'
      });
    }
    
    // Add user query
    messages.push({
      role: 'user',
      content: args.query
    });
    
    return messages;
  }

  /**
   * Check if this model supports reasoning
   */
  supportsReasoning() {
    return this.modelName.includes('o3') || 
           this.modelName.includes('o1') ||
           this.capabilities.includes('reasoning');
  }

  /**
   * Check if this is a reasoning model that uses Responses API
   */
  isReasoningModel() {
    return this.modelName.includes('o3') || this.modelName.includes('o1');
  }

  /**
   * Map reasoning level to OpenAI's effort levels
   */
  mapReasoningLevel(level) {
    const levelMap = {
      'standard': 'medium',
      'deep': 'high',
      'quick': 'low',
      'low': 'low',
      'medium': 'medium',
      'high': 'high'
    };
    
    return levelMap[level] || 'medium';
  }

  /**
   * Format input for Responses API
   */
  formatInputForResponses(messages) {
    // For Responses API, we typically send the user's query as input
    const userMessage = messages.find(msg => msg.role === 'user');
    return userMessage ? userMessage.content : messages[messages.length - 1].content;
  }

  /**
   * Build parameters for Responses API
   */
  buildResponsesParams(chatParams, args) {
    const params = {
      max_output_tokens: chatParams.max_tokens,
      temperature: chatParams.temperature,
    };

    // Add reasoning configuration
    if (args.reasoning_level) {
      params.reasoning = {
        effort: this.mapReasoningLevel(args.reasoning_level),
        summary: 'auto'
      };
    }

    return params;
  }

  /**
   * Format Responses API response
   */
  formatResponsesAPIResponse(response) {
    // Extract the text content from the response
    let responseText = '';
    
    if (response.output && Array.isArray(response.output)) {
      const messageOutput = response.output.find(item => item.type === 'message');
      if (messageOutput && messageOutput.content) {
        const textContent = messageOutput.content.find(item => item.type === 'output_text');
        if (textContent) {
          responseText = textContent.text;
        }
      }
    }

    // If no structured output found, try to extract from response directly
    if (!responseText && response.content) {
      responseText = response.content;
    }

    return this.formatResponse(
      responseText || 'No response generated',
      response.usage || {},
      response.model || this.modelName
    );
  }

  /**
   * Get model-specific information
   */
  getModelInfo() {
    return {
      ...this.getCapabilities(),
      supports_reasoning: this.supportsReasoning(),
      api_type: this.isReasoningModel() ? 'responses' : 'chat_completions',
      reasoning_levels: ['low', 'medium', 'high'],
      context_window: this.getContextWindow()
    };
  }

  /**
   * Get context window size for the model
   */
  getContextWindow() {
    const contextWindows = {
      'o3': 200000,
      'o3-pro': 200000,
      'o3-mini': 128000,
      'gpt-4': 128000,
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 16000
    };

    for (const [model, window] of Object.entries(contextWindows)) {
      if (this.modelName.includes(model)) {
        return window;
      }
    }

    return 128000; // Default
  }
}
