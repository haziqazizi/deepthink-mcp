import { describe, it, expect } from '@jest/globals';

describe('Basic Tests', () => {
  it('should run a basic test', () => {
    expect(2 + 2).toBe(4);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });

  it('should validate environment setup', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });
});
