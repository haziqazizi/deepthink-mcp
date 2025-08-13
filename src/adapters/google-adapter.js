import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAdapter } from './base-adapter.js';

/**
 * Google Gemini adapter
 */
export class GoogleAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Default parameters from config
    this.defaultParams = {
      temperature: 0.2,
      maxOutputTokens: 4000,
      ...config.default_params
    };
  }

  async call(args) {
    this.validateArgs(args);
    this.startTimer();

    try {
      const model = this.genAI.getGenerativeModel({ 
        model: this.modelName,
        generationConfig: {
          temperature: args.temperature ?? this.defaultParams.temperature,
          maxOutputTokens: args.max_tokens || this.defaultParams.maxOutputTokens,
        }
      });

      // Build the prompt
      let prompt = args.query;
      if (args.context) {
        prompt = `Context: ${args.context}\n\nQuery: ${args.query}`;
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      // Google doesn't provide detailed token usage in the same format
      // We'll estimate or leave it empty
      const usage = {
        input_tokens: this.estimateTokens(prompt),
        output_tokens: this.estimateTokens(responseText),
        total_tokens: this.estimateTokens(prompt) + this.estimateTokens(responseText)
      };

      return this.formatResponse(
        responseText,
        usage,
        this.modelName
      );
    } catch (error) {
      this.handleError(error, 'API call');
    }
  }

  async checkAvailability() {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });
      await model.generateContent('test');
      
      return { available: true, message: 'OK' };
    } catch (error) {
      return { 
        available: false, 
        message: `Error checking availability: ${error.message}` 
      };
    }
  }

  /**
   * Estimate token count (rough approximation)
   * Google doesn't provide exact token counts in responses
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getModelInfo() {
    return {
      ...this.getCapabilities(),
      supports_reasoning: true,
      supports_multimodal: true,
      api_type: 'generate_content',
      context_window: this.getContextWindow()
    };
  }

  getContextWindow() {
    const contextWindows = {
      'gemini-pro': 32000,
      'gemini-1.5-pro': 1000000,
      'gemini-1.5-flash': 1000000,
    };

    for (const [model, window] of Object.entries(contextWindows)) {
      if (this.modelName.includes(model)) {
        return window;
      }
    }

    return 32000; // Default
  }
}
