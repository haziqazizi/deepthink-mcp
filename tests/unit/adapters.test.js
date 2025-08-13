import { jest } from '@jest/globals';
import { OpenAIAdapter } from '../../src/adapters/openai-adapter.js';
import { GoogleAdapter } from '../../src/adapters/google-adapter.js';
import { AnthropicAdapter } from '../../src/adapters/anthropic-adapter.js';

// Mock external dependencies
jest.mock('openai');
jest.mock('@google-cloud/aiplatform');
jest.mock('@anthropic-ai/sdk');

describe('AI Model Adapters', () => {
  describe('OpenAIAdapter', () => {
    let adapter;
    let mockOpenAI;

    beforeEach(async () => {
      mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
          }
        }
      };
      
      const { OpenAI } = await import('openai');
      OpenAI.mockImplementation(() => mockOpenAI);
      
      adapter = new OpenAIAdapter({
        model: 'o3-mini',
        apiKey: 'test-key'
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should initialize correctly', () => {
      expect(adapter.config.model).toBe('o3-mini');
      expect(adapter.config.apiKey).toBe('test-key');
    });

    test('should generate response successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Test response'
          }
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
          completion_tokens_details: {
            reasoning_tokens: 5
          }
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await adapter.generateResponse('Test query', {
        reasoning_level: 'medium',
        temperature: 0.1
      });

      expect(result).toEqual({
        response: 'Test response',
        model: 'o3-mini',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          reasoning_tokens: 5
        },
        cost: expect.any(Number),
        timestamp: expect.any(String),
        duration: expect.any(Number)
      });
    });

    test('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      await expect(
        adapter.generateResponse('Test query')
      ).rejects.toThrow('API rate limit exceeded');
    });

    test('should validate query input', async () => {
      await expect(
        adapter.generateResponse('')
      ).rejects.toThrow('Query cannot be empty');

      await expect(
        adapter.generateResponse(null)
      ).rejects.toThrow('Query must be a string');
    });

    test('should calculate O3 pricing correctly', () => {
      const usage = {
        input_tokens: 1000,
        output_tokens: 500,
        reasoning_tokens: 200
      };
      
      const cost = adapter.calculateCost(usage, 'o3-mini');
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('GoogleAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new GoogleAdapter({
        model: 'gemini-pro',
        projectId: 'test-project',
        location: 'us-central1'
      });
    });

    test('should initialize correctly', () => {
      expect(adapter.config.model).toBe('gemini-pro');
      expect(adapter.config.projectId).toBe('test-project');
    });

    test('should check health status', async () => {
      const health = await adapter.checkHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latency');
      expect(health).toHaveProperty('timestamp');
    });
  });

  describe('AnthropicAdapter', () => {
    let adapter;

    beforeEach(() => {
      adapter = new AnthropicAdapter({
        model: 'claude-3-5-sonnet',
        apiKey: 'test-key'
      });
    });

    test('should initialize correctly', () => {
      expect(adapter.config.model).toBe('claude-3-5-sonnet');
      expect(adapter.config.apiKey).toBe('test-key');
    });

    test('should validate configuration', () => {
      expect(() => new AnthropicAdapter({})).toThrow('API key is required');
    });
  });
});
