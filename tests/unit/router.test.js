import { jest } from '@jest/globals';
import { ModelRouter } from '../../src/router/index.js';
import { ModelSelector } from '../../src/router/model-selector.js';

// Mock adapters
const mockAdapters = {
  'o3-mini': {
    generateResponse: jest.fn(),
    checkHealth: jest.fn(),
    calculateCost: jest.fn()
  },
  'gemini-pro': {
    generateResponse: jest.fn(),
    checkHealth: jest.fn(),
    calculateCost: jest.fn()
  },
  'claude-3-5-sonnet': {
    generateResponse: jest.fn(),
    checkHealth: jest.fn(),
    calculateCost: jest.fn()
  }
};

jest.mock('../../src/adapters/openai-adapter.js', () => ({
  OpenAIAdapter: jest.fn(() => mockAdapters['o3-mini'])
}));

jest.mock('../../src/adapters/google-adapter.js', () => ({
  GoogleAdapter: jest.fn(() => mockAdapters['gemini-pro'])
}));

jest.mock('../../src/adapters/anthropic-adapter.js', () => ({
  AnthropicAdapter: jest.fn(() => mockAdapters['claude-3-5-sonnet'])
}));

describe('ModelRouter', () => {
  let router;
  let config;

  beforeEach(() => {
    config = {
      models: {
        openai: {
          'o3-mini': {
            apiKey: 'test-key',
            enabled: true
          }
        },
        google: {
          'gemini-pro': {
            projectId: 'test-project',
            enabled: true
          }
        },
        anthropic: {
          'claude-3-5-sonnet': {
            apiKey: 'test-key',
            enabled: true
          }
        }
      },
      routing: {
        default_model: 'o3-mini',
        fallback_models: ['gemini-pro', 'claude-3-5-sonnet']
      }
    };

    router = new ModelRouter(config);
    
    // Reset all mocks
    Object.values(mockAdapters).forEach(adapter => {
      Object.values(adapter).forEach(method => method.mockReset());
    });
  });

  test('should initialize with correct configuration', () => {
    expect(router.config).toEqual(config);
    expect(router.adapters).toHaveProperty('o3-mini');
    expect(router.adapters).toHaveProperty('gemini-pro');
    expect(router.adapters).toHaveProperty('claude-3-5-sonnet');
  });

  test('should route query to appropriate model', async () => {
    const mockResponse = {
      response: 'Test response',
      model: 'o3-mini',
      usage: { total_tokens: 100 },
      cost: 0.01
    };

    mockAdapters['o3-mini'].generateResponse.mockResolvedValue(mockResponse);

    const result = await router.routeQuery({
      query: 'What is 2+2?',
      model: 'o3-mini'
    });

    expect(result).toEqual(mockResponse);
    expect(mockAdapters['o3-mini'].generateResponse).toHaveBeenCalledWith(
      'What is 2+2?',
      expect.any(Object)
    );
  });

  test('should auto-select model when not specified', async () => {
    const mockResponse = {
      response: 'Auto-selected response',
      model: 'o3-mini',
      usage: { total_tokens: 150 },
      cost: 0.015
    };

    mockAdapters['o3-mini'].generateResponse.mockResolvedValue(mockResponse);

    const result = await router.routeQuery({
      query: 'Complex reasoning task that requires deep analysis'
    });

    expect(result).toEqual(mockResponse);
    expect(mockAdapters['o3-mini'].generateResponse).toHaveBeenCalled();
  });

  test('should fallback to secondary model on failure', async () => {
    const primaryError = new Error('Primary model unavailable');
    const fallbackResponse = {
      response: 'Fallback response',
      model: 'gemini-pro',
      usage: { total_tokens: 120 },
      cost: 0.012
    };

    mockAdapters['o3-mini'].generateResponse.mockRejectedValue(primaryError);
    mockAdapters['gemini-pro'].generateResponse.mockResolvedValue(fallbackResponse);

    const result = await router.routeQuery({
      query: 'Test query',
      model: 'o3-mini'
    });

    expect(result).toEqual(fallbackResponse);
    expect(mockAdapters['o3-mini'].generateResponse).toHaveBeenCalled();
    expect(mockAdapters['gemini-pro'].generateResponse).toHaveBeenCalled();
  });

  test('should get model recommendations', async () => {
    const recommendations = await router.getModelRecommendations({
      query: 'Analyze complex data patterns',
      context: 'Research analysis'
    });

    expect(recommendations).toHaveProperty('recommendations');
    expect(Array.isArray(recommendations.recommendations)).toBe(true);
    expect(recommendations.recommendations.length).toBeGreaterThan(0);
  });

  test('should list available models', async () => {
    const models = await router.listModels();
    
    expect(models).toHaveProperty('models');
    expect(models.models).toHaveProperty('o3-mini');
    expect(models.models).toHaveProperty('gemini-pro');
    expect(models.models).toHaveProperty('claude-3-5-sonnet');
  });

  test('should perform health check on all models', async () => {
    mockAdapters['o3-mini'].checkHealth.mockResolvedValue({ status: 'healthy', latency: 100 });
    mockAdapters['gemini-pro'].checkHealth.mockResolvedValue({ status: 'healthy', latency: 150 });
    mockAdapters['claude-3-5-sonnet'].checkHealth.mockResolvedValue({ status: 'healthy', latency: 120 });

    const health = await router.healthCheck();

    expect(health).toHaveProperty('overall_status');
    expect(health).toHaveProperty('models');
    expect(health.models).toHaveProperty('o3-mini');
    expect(health.models).toHaveProperty('gemini-pro');
    expect(health.models).toHaveProperty('claude-3-5-sonnet');
  });

  test('should get usage statistics', async () => {
    const stats = await router.getStats();

    expect(stats).toHaveProperty('total_queries');
    expect(stats).toHaveProperty('total_tokens');
    expect(stats).toHaveProperty('total_cost');
    expect(stats).toHaveProperty('model_usage');
    expect(stats).toHaveProperty('success_rate');
  });

  test('should handle invalid model requests', async () => {
    await expect(
      router.routeQuery({ query: 'test', model: 'invalid-model' })
    ).rejects.toThrow('Model not available: invalid-model');
  });

  test('should validate query parameters', async () => {
    await expect(
      router.routeQuery({})
    ).rejects.toThrow('Query is required');

    await expect(
      router.routeQuery({ query: '' })
    ).rejects.toThrow('Query cannot be empty');
  });
});

describe('ModelSelector', () => {
  test('should select appropriate model for different query types', () => {
    const selector = new ModelSelector({
      available_models: ['o3-mini', 'o3', 'gemini-pro', 'claude-3-5-sonnet']
    });

    // Test reasoning-heavy query
    expect(selector.selectModel('Solve this complex mathematical proof')).toBe('o3');

    // Test creative query
    expect(selector.selectModel('Write a creative story about space')).toBe('claude-3-5-sonnet');

    // Test multimodal query
    expect(selector.selectModel('Analyze this image and explain what you see')).toBe('gemini-pro');

    // Test general query
    expect(selector.selectModel('What is the weather like?')).toBe('o3-mini');
  });

  test('should handle context-based selection', () => {
    const selector = new ModelSelector({
      available_models: ['o3', 'gemini-pro', 'claude-3-5-sonnet']
    });

    const selection = selector.selectModel(
      'Help me debug this code',
      'Programming and software development'
    );

    expect(['o3', 'claude-3-5-sonnet']).toContain(selection);
  });
});
