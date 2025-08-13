import fs from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import { Logger } from './logger.js';

const logger = new Logger('Config');

/**
 * Load and parse configuration from YAML file
 */
export async function loadConfig() {
  const configPath = process.env.CONFIG_PATH || 'config/models.yaml';
  const environment = process.env.NODE_ENV || 'development';
  
  try {
    // Read the YAML configuration file
    const configFile = await fs.readFile(configPath, 'utf8');
    const config = yaml.load(configFile);
    
    // Apply environment-specific overrides
    if (config.environments && config.environments[environment]) {
      const envOverrides = config.environments[environment];
      
      // Deep merge environment overrides
      config.settings = mergeDeep(config.settings || {}, envOverrides);
      logger.info(`Applied ${environment} environment overrides`);
    }
    
    // Apply environment variable overrides
    applyEnvOverrides(config);
    
    // Validate configuration
    validateConfig(config);
    
    logger.info(`Configuration loaded successfully from ${configPath}`);
    return config;
    
  } catch (error) {
    logger.error(`Failed to load configuration from ${configPath}:`, { error: error.message });
    
    // Return minimal default configuration
    return getDefaultConfig();
  }
}

/**
 * Apply environment variable overrides to configuration
 */
function applyEnvOverrides(config) {
  const envMappings = {
    'DEFAULT_MODEL': 'settings.default_model',
    'FALLBACK_MODEL': 'settings.fallback_model',
    'DAILY_COST_LIMIT': 'settings.budget_limits.daily_cost_limit',
    'REQUESTS_PER_MINUTE': 'settings.rate_limits.per_user_requests_per_minute',
    'BURST_LIMIT': 'settings.rate_limits.burst_limit'
  };

  for (const [envVar, configPath] of Object.entries(envMappings)) {
    const envValue = process.env[envVar];
    if (envValue) {
      setNestedValue(config, configPath, parseEnvValue(envValue));
      logger.debug(`Applied environment override: ${envVar} = ${envValue}`);
    }
  }
}

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue(value) {
  // Try to parse as number
  const numValue = Number(value);
  if (!isNaN(numValue)) {
    return numValue;
  }
  
  // Try to parse as boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  // Return as string
  return value;
}

/**
 * Set nested object value using dot notation path
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Deep merge two objects
 */
function mergeDeep(target, source) {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = mergeDeep(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
}

/**
 * Validate configuration structure and required fields
 */
function validateConfig(config) {
  const requiredFields = [
    'models',
    'settings.default_model',
    'settings.available_models'
  ];

  for (const field of requiredFields) {
    const value = getNestedValue(config, field);
    if (value === undefined || value === null) {
      throw new Error(`Missing required configuration field: ${field}`);
    }
  }

  // Validate that default_model exists in models
  if (!config.models[config.settings.default_model]) {
    throw new Error(`Default model '${config.settings.default_model}' not found in models configuration`);
  }

  // Validate that fallback_model exists in models (if specified)
  if (config.settings.fallback_model && !config.models[config.settings.fallback_model]) {
    throw new Error(`Fallback model '${config.settings.fallback_model}' not found in models configuration`);
  }

  // Validate available_models
  for (const modelId of config.settings.available_models) {
    if (!config.models[modelId]) {
      logger.warn(`Available model '${modelId}' not found in models configuration`);
    }
  }

  logger.debug('Configuration validation passed');
}

/**
 * Get nested object value using dot notation path
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Get default configuration as fallback
 */
function getDefaultConfig() {
  logger.warn('Using default configuration due to config load failure');
  
  return {
    models: {
      'o3': {
        provider: 'openai',
        model_name: 'o3',
        name: 'OpenAI O3',
        capabilities: ['reasoning', 'coding', 'analysis', 'math'],
        cost_per_1k_tokens: 0.060,
        default_params: {
          temperature: 0.1,
          max_tokens: 4000
        }
      },
      'claude-3-5-sonnet': {
        provider: 'anthropic',
        model_name: 'claude-3-5-sonnet-latest',
        name: 'Claude 3.5 Sonnet',
        capabilities: ['reasoning', 'coding', 'analysis', 'creative'],
        cost_per_1k_tokens: 0.015,
        default_params: {
          temperature: 0.3,
          max_tokens: 4000
        }
      }
    },
    settings: {
      default_model: 'o3',
      fallback_model: 'claude-3-5-sonnet',
      available_models: ['o3', 'claude-3-5-sonnet'],
      budget_limits: {
        daily_cost_limit: 10.00
      },
      rate_limits: {
        per_user_requests_per_minute: 50,
        burst_limit: 10
      }
    }
  };
}

/**
 * Reload configuration (useful for hot reloading)
 */
export async function reloadConfig() {
  logger.info('Reloading configuration...');
  return await loadConfig();
}
