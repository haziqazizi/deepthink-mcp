import Anthropic from '@anthropic-ai/sdk';
import { BaseAdapter } from './base-adapter.js';

/**
 * Anthropic Claude adapter
 */
export class AnthropicAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found in environment variables');
    }
    
    this.client = new Anthropic({
      apiKey: apiKey,
      timeout: config.timeout_ms || 30000,
    });
    
    // Default parameters from config
    this.defaultParams = {
      temperature: 0.3,
      max_tokens: 4000,
      ...config.default_params
    };
  }

  async call(args) {
    this.validateArgs(args);
    this.startTimer();

    try {
      const messages = this.buildMessages(args);
      
      const requestParams = {
        model: this.modelName,
        messages: messages,
        max_tokens: args.max_tokens || this.defaultParams.max_tokens,
        temperature: args.temperature ?? this.defaultParams.temperature,
      };

      const completion = await this.client.messages.create(requestParams);
      
      const responseText = completion.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');

      return this.formatResponse(
        responseText,
        completion.usage,
        completion.model
      );
    } catch (error) {
      this.handleError(error, 'API call');
    }
  }

  async checkAvailability() {
    try {
      // Anthropic doesn't have a models list endpoint, so we'll try a simple call
      await this.client.messages.create({
        model: this.modelName,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      return { available: true, message: 'OK' };
    } catch (error) {
      if (error.status === 400 && error.message?.includes('model')) {
        return { available: false, message: `Model ${this.modelName} not available` };
      }
      return { available: false, message: error.message };
    }
  }

  buildMessages(args) {
    const messages = [];
    
    // Anthropic uses system parameter separately, not in messages array
    // So we'll include the system message as context in the user message if needed
    let userContent = args.query;
    
    if (args.context) {
      userContent = `Context: ${args.context}\n\nQuery: ${args.query}`;
    }
    
    messages.push({
      role: 'user',
      content: userContent
    });
    
    return messages;
  }

  getModelInfo() {
    return {
      ...this.getCapabilities(),
      supports_reasoning: true, // Claude models are good at reasoning
      api_type: 'messages',
      context_window: this.getContextWindow()
    };
  }

  getContextWindow() {
    const contextWindows = {
      'claude-3-5-sonnet': 200000,
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
    };

    for (const [model, window] of Object.entries(contextWindows)) {
      if (this.modelName.includes(model)) {
        return window;
      }
    }

    return 200000; // Default for Claude models
  }
}
