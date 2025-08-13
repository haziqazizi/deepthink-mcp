#!/usr/bin/env node

/**
 * Isolated test script for DeepThink MCP Server
 * Tests core functionality without external dependencies
 */

import { ModelRouter } from './src/router/index.js';
import { loadConfig } from './src/utils/config.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('Test-Isolated');

async function testConfigLoading() {
  logger.info('🧪 Testing configuration loading...');
  
  try {
    const config = await loadConfig();
    console.log('✅ Configuration loaded successfully');
    console.log('   Available models:', Object.keys(config.models || {}));
    return config;
  } catch (error) {
    console.error('❌ Configuration loading failed:', error.message);
    return null;
  }
}

async function testModelRouter(config) {
  if (!config) return false;
  
  logger.info('🧪 Testing model router initialization...');
  
  try {
    const router = new ModelRouter(config);
    console.log('✅ Model router initialized successfully');
    return router;
  } catch (error) {
    console.error('❌ Model router initialization failed:', error.message);
    return null;
  }
}

async function testModelListing(router) {
  if (!router) return false;
  
  logger.info('🧪 Testing model listing...');
  
  try {
    const result = await router.listModels();
    
    // Parse the JSON response
    const models = JSON.parse(result.response);
    
    console.log('✅ Model listing successful');
    console.log('   Models:', models.models?.map(m => m.id) || []);
    return true;
  } catch (error) {
    console.error('❌ Model listing failed:', error.message);
    return false;
  }
}

async function testHealthCheck(router) {
  if (!router) return false;
  
  logger.info('🧪 Testing health check...');
  
  try {
    const result = await router.healthCheck();
    
    // Parse the JSON response
    const health = JSON.parse(result.response);
    
    console.log('✅ Health check successful');
    console.log('   Overall status:', health.overall_status);
    console.log('   Model statuses:', Object.keys(health.models || {}));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testModelRecommendations(router) {
  if (!router) return false;
  
  logger.info('🧪 Testing model recommendations...');
  
  try {
    const result = await router.getModelRecommendations({
      query: 'What is the meaning of life?',
      context: 'Philosophy discussion'
    });
    
    // Parse the JSON response
    const response = JSON.parse(result.response);
    
    console.log('✅ Model recommendations successful');
    console.log('   Recommendations:', response.recommendations?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ Model recommendations failed:', error.message);
    return false;
  }
}

async function testSimpleQuery(router) {
  if (!router) return false;
  
  logger.info('🧪 Testing simple query routing...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Skipping actual API test (no OpenAI API key)');
    return true;
  }
  
  try {
    const result = await router.routeQuery({
      query: 'What is 2+2?',
      model: 'o3-pro'
    });
    
    console.log('✅ Query routing successful');
    console.log('   Response:', result.response?.substring(0, 100) + '...');
    console.log('   Model used:', result.model);
    console.log('   Tokens used:', result.usage?.total_tokens);
    console.log('   Cost:', result.cost);
    return true;
  } catch (error) {
    console.error('❌ Query routing failed:', error.message);
    return false;
  }
}

async function testStats(router) {
  if (!router) return false;
  
  logger.info('🧪 Testing statistics...');
  
  try {
    const result = await router.getStats();
    
    // Parse the JSON response
    const stats = JSON.parse(result.response);
    
    console.log('✅ Statistics retrieval successful');
    console.log('   Total queries:', stats.total_queries);
    console.log('   Success rate:', stats.success_rate);
    return true;
  } catch (error) {
    console.error('❌ Statistics retrieval failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting DeepThink MCP isolated tests...\n');
  
  const results = {
    config: false,
    router: false,
    listing: false,
    health: false,
    recommendations: false,
    query: false,
    stats: false
  };
  
  // Test configuration
  const config = await testConfigLoading();
  results.config = !!config;
  
  // Test router initialization  
  const router = await testModelRouter(config);
  results.router = !!router;
  
  // Test core functionality
  if (router) {
    results.listing = await testModelListing(router);
    results.health = await testHealthCheck(router);
    results.recommendations = await testModelRecommendations(router);
    results.query = await testSimpleQuery(router);
    results.stats = await testStats(router);
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const name = test.charAt(0).toUpperCase() + test.slice(1);
    console.log(`${status} ${name}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = (passedTests / totalTests * 100).toFixed(1);
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed (${successRate}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Server is ready for integration.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above for details.');
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Run the tests
runAllTests().catch(console.error);
