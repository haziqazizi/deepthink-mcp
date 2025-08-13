import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { ModelRouter } from '../../src/router/index.js';

describe('Performance Tests', () => {
  let router;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = {
      generateResponse: jest.fn(),
      checkHealth: jest.fn(),
      calculateCost: jest.fn()
    };

    const config = {
      models: {
        openai: {
          'o3-mini': {
            apiKey: 'test-key',
            enabled: true
          }
        }
      },
      routing: {
        default_model: 'o3-mini',
        fallback_models: []
      }
    };

    // Mock the adapter creation
    jest.doMock('../../src/adapters/openai-adapter.js', () => ({
      OpenAIAdapter: jest.fn(() => mockAdapter)
    }));

    router = new ModelRouter(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 50;
    const mockResponse = {
      response: 'Test response',
      model: 'o3-mini',
      usage: { total_tokens: 100 },
      cost: 0.01,
      timestamp: new Date().toISOString(),
      duration: 150
    };

    mockAdapter.generateResponse.mockResolvedValue(mockResponse);

    const startTime = performance.now();
    
    const promises = Array(concurrentRequests).fill().map((_, i) =>
      router.routeQuery({
        query: `Test query ${i}`,
        model: 'o3-mini'
      })
    );

    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Assertions
    expect(results).toHaveLength(concurrentRequests);
    expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    expect(mockAdapter.generateResponse).toHaveBeenCalledTimes(concurrentRequests);
    
    // Check that all requests completed successfully
    results.forEach((result, i) => {
      expect(result).toHaveProperty('response', 'Test response');
      expect(result).toHaveProperty('model', 'o3-mini');
    });

    console.log(`Completed ${concurrentRequests} concurrent requests in ${totalTime.toFixed(2)}ms`);
    console.log(`Average response time: ${(totalTime / concurrentRequests).toFixed(2)}ms`);
  }, 10000);

  test('should maintain performance under high load', async () => {
    const iterations = 100;
    const mockResponse = {
      response: 'Load test response',
      model: 'o3-mini',
      usage: { total_tokens: 50 },
      cost: 0.005,
      timestamp: new Date().toISOString(),
      duration: 100
    };

    mockAdapter.generateResponse.mockResolvedValue(mockResponse);

    const responseTimes = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      await router.routeQuery({
        query: `Load test query ${i}`,
        model: 'o3-mini'
      });
      
      const endTime = performance.now();
      responseTimes.push(endTime - startTime);
    }

    // Calculate statistics
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    // Performance assertions
    expect(avgResponseTime).toBeLessThan(200); // Average should be under 200ms
    expect(maxResponseTime).toBeLessThan(1000); // Max should be under 1 second
    expect(minResponseTime).toBeGreaterThan(0);
    
    console.log(`Load test completed ${iterations} iterations:`);
    console.log(`Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`Min: ${minResponseTime.toFixed(2)}ms`);
    console.log(`Max: ${maxResponseTime.toFixed(2)}ms`);
  }, 30000);

  test('should handle memory efficiently with large responses', async () => {
    const largeResponse = 'x'.repeat(10000); // 10KB response
    const mockResponse = {
      response: largeResponse,
      model: 'o3-mini',
      usage: { total_tokens: 2500 },
      cost: 0.025,
      timestamp: new Date().toISOString(),
      duration: 300
    };

    mockAdapter.generateResponse.mockResolvedValue(mockResponse);

    const initialMemory = process.memoryUsage();
    
    // Process multiple large responses
    const promises = Array(20).fill().map((_, i) =>
      router.routeQuery({
        query: `Large response query ${i}`,
        model: 'o3-mini'
      })
    );

    await Promise.all(promises);
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Memory should not increase excessively (allow for 50MB increase)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  }, 15000);

  test('should handle error scenarios efficiently', async () => {
    const errorScenarios = [
      new Error('Network timeout'),
      new Error('Rate limit exceeded'),
      new Error('Invalid API key'),
      new Error('Model not available')
    ];

    let errorCount = 0;
    mockAdapter.generateResponse.mockImplementation(() => {
      const error = errorScenarios[errorCount % errorScenarios.length];
      errorCount++;
      return Promise.reject(error);
    });

    const startTime = performance.now();
    
    const promises = Array(20).fill().map((_, i) =>
      router.routeQuery({
        query: `Error test query ${i}`,
        model: 'o3-mini'
      }).catch(error => ({ error: error.message }))
    );

    const results = await Promise.all(promises);
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // All requests should complete (even with errors) within reasonable time
    expect(totalTime).toBeLessThan(3000); // 3 seconds max
    expect(results).toHaveLength(20);
    
    // Check that errors were handled properly
    const errorResults = results.filter(result => result.error);
    expect(errorResults.length).toBe(20); // All should have errors
    
    console.log(`Handled ${errorResults.length} errors in ${totalTime.toFixed(2)}ms`);
  }, 10000);

  test('should maintain stable performance over time', async () => {
    const testDuration = 5000; // 5 seconds
    const mockResponse = {
      response: 'Stability test response',
      model: 'o3-mini',
      usage: { total_tokens: 75 },
      cost: 0.0075,
      timestamp: new Date().toISOString(),
      duration: 120
    };

    mockAdapter.generateResponse.mockResolvedValue(mockResponse);

    const startTime = performance.now();
    let requestCount = 0;
    const responseTimes = [];

    while (performance.now() - startTime < testDuration) {
      const requestStart = performance.now();
      
      await router.routeQuery({
        query: `Stability test ${requestCount}`,
        model: 'o3-mini'
      });
      
      const requestEnd = performance.now();
      responseTimes.push(requestEnd - requestStart);
      requestCount++;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const actualDuration = performance.now() - startTime;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const requestsPerSecond = (requestCount / actualDuration) * 1000;

    // Performance should be stable
    expect(requestCount).toBeGreaterThan(10); // Should process reasonable number of requests
    expect(avgResponseTime).toBeLessThan(500); // Average response time should be reasonable
    expect(requestsPerSecond).toBeGreaterThan(1); // At least 1 request per second

    console.log(`Stability test: ${requestCount} requests in ${actualDuration.toFixed(0)}ms`);
    console.log(`Requests per second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
  }, 10000);
});
