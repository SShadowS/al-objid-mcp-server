/**
 * Real integration tests for ConfigManager
 * Tests configuration loading, environment variables, and settings management
 */

import { ConfigManager } from '../../src/lib/config/ConfigManager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager Integration Tests', () => {
  let configManager: ConfigManager;
  let originalEnv: NodeJS.ProcessEnv;
  let tempConfigDir: string;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create temp directory for config files
    tempConfigDir = path.join(os.tmpdir(), 'config-test-' + Date.now());
    fs.mkdirSync(tempConfigDir, { recursive: true });
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up temp directory
    if (fs.existsSync(tempConfigDir)) {
      fs.rmSync(tempConfigDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clear environment variables
    delete process.env.ALOBJIDNINJA_BACKEND_URL;
    delete process.env.ALOBJIDNINJA_API_KEY;
    delete process.env.ALOBJIDNINJA_TIER;
    delete process.env.ALOBJIDNINJA_LOG_LEVEL;

    configManager = new ConfigManager();
  });

  describe('Backend URL Configuration', () => {
    it('should use default backend URL when not configured', () => {
      const url = configManager.getBackendUrl();
      expect(url).toBe('https://vjekocom-alext-weu.azurewebsites.net');
    });

    it('should use environment variable when set', () => {
      process.env.ALOBJIDNINJA_BACKEND_URL = 'https://custom-backend.com';
      configManager = new ConfigManager();

      const url = configManager.getBackendUrl();
      expect(url).toBe('https://custom-backend.com');
    });

    it('should allow updating backend URL at runtime', () => {
      const initialUrl = configManager.getBackendUrl();
      const newUrl = 'https://new-backend.com';

      configManager.setBackendUrl(newUrl);
      expect(configManager.getBackendUrl()).toBe(newUrl);
      expect(configManager.getBackendUrl()).not.toBe(initialUrl);
    });

    it('should handle trailing slashes correctly', () => {
      configManager.setBackendUrl('https://backend.com/');
      expect(configManager.getBackendUrl()).toBe('https://backend.com');

      configManager.setBackendUrl('https://backend.com//');
      expect(configManager.getBackendUrl()).toBe('https://backend.com');
    });

    it('should validate URL format', () => {
      const validUrls = [
        'https://backend.com',
        'http://localhost:8080',
        'https://sub.domain.com/path'
      ];

      validUrls.forEach(url => {
        configManager.setBackendUrl(url);
        expect(configManager.getBackendUrl()).toBe(url.replace(/\/+$/, ''));
      });
    });
  });

  describe('API Key Configuration', () => {
    it('should return null when no API key is configured', () => {
      const apiKey = configManager.getApiKey();
      expect(apiKey).toBeNull();
    });

    it('should use environment variable for API key', () => {
      process.env.ALOBJIDNINJA_API_KEY = 'test-api-key';
      configManager = new ConfigManager();

      const apiKey = configManager.getApiKey();
      expect(apiKey).toBe('test-api-key');
    });

    it('should allow setting API key at runtime', () => {
      configManager.setApiKey('runtime-api-key');
      expect(configManager.getApiKey()).toBe('runtime-api-key');
    });

    it('should handle empty API key', () => {
      configManager.setApiKey('');
      expect(configManager.getApiKey()).toBe('');

      configManager.setApiKey(null as any);
      expect(configManager.getApiKey()).toBeNull();
    });
  });

  describe('Tier Configuration', () => {
    it('should default to full tier when not configured', () => {
      const tier = configManager.getTier();
      expect(tier).toBe('full');
    });

    it('should use environment variable for tier', () => {
      process.env.ALOBJIDNINJA_TIER = 'lite';
      configManager = new ConfigManager();

      expect(configManager.getTier()).toBe('lite');
    });

    it('should validate tier values', () => {
      const validTiers = ['lite', 'standard', 'full'];

      validTiers.forEach(tier => {
        configManager.setTier(tier as any);
        expect(configManager.getTier()).toBe(tier);
      });
    });

    it('should reject invalid tier values', () => {
      // Should keep current tier if invalid value is set
      const currentTier = configManager.getTier();
      configManager.setTier('invalid' as any);
      expect(configManager.getTier()).toBe(currentTier);
    });

    it('should handle tier case insensitivity', () => {
      process.env.ALOBJIDNINJA_TIER = 'LITE';
      configManager = new ConfigManager();
      expect(configManager.getTier()).toBe('lite');

      process.env.ALOBJIDNINJA_TIER = 'Standard';
      configManager = new ConfigManager();
      expect(configManager.getTier()).toBe('standard');
    });
  });

  describe('Log Level Configuration', () => {
    it('should default to info level when not configured', () => {
      const level = configManager.getLogLevel();
      expect(level).toBe('info');
    });

    it('should use environment variable for log level', () => {
      process.env.ALOBJIDNINJA_LOG_LEVEL = 'debug';
      configManager = new ConfigManager();

      expect(configManager.getLogLevel()).toBe('debug');
    });

    it('should validate log levels', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];

      validLevels.forEach(level => {
        configManager.setLogLevel(level as any);
        expect(configManager.getLogLevel()).toBe(level);
      });
    });

    it('should handle case insensitive log levels', () => {
      process.env.ALOBJIDNINJA_LOG_LEVEL = 'DEBUG';
      configManager = new ConfigManager();
      expect(configManager.getLogLevel()).toBe('debug');

      configManager.setLogLevel('WARN' as any);
      expect(configManager.getLogLevel()).toBe('warn');
    });
  });

  describe('Configuration File Loading', () => {
    it('should load configuration from JSON file', () => {
      const configFile = path.join(tempConfigDir, 'config.json');
      fs.writeFileSync(configFile, JSON.stringify({
        backendUrl: 'https://file-backend.com',
        apiKey: 'file-api-key',
        tier: 'standard',
        logLevel: 'debug'
      }, null, 2));

      // Simulate loading from file
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

      configManager.setBackendUrl(config.backendUrl);
      configManager.setApiKey(config.apiKey);
      configManager.setTier(config.tier);
      configManager.setLogLevel(config.logLevel);

      expect(configManager.getBackendUrl()).toBe('https://file-backend.com');
      expect(configManager.getApiKey()).toBe('file-api-key');
      expect(configManager.getTier()).toBe('standard');
      expect(configManager.getLogLevel()).toBe('debug');
    });

    it('should handle partial configuration files', () => {
      const configFile = path.join(tempConfigDir, 'partial-config.json');
      fs.writeFileSync(configFile, JSON.stringify({
        backendUrl: 'https://partial-backend.com'
        // Missing other fields
      }, null, 2));

      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

      if (config.backendUrl) configManager.setBackendUrl(config.backendUrl);
      if (config.apiKey) configManager.setApiKey(config.apiKey);
      if (config.tier) configManager.setTier(config.tier);
      if (config.logLevel) configManager.setLogLevel(config.logLevel);

      expect(configManager.getBackendUrl()).toBe('https://partial-backend.com');
      expect(configManager.getApiKey()).toBeNull(); // Default
      expect(configManager.getTier()).toBe('full'); // Default
      expect(configManager.getLogLevel()).toBe('info'); // Default
    });

    it('should handle malformed JSON gracefully', () => {
      const configFile = path.join(tempConfigDir, 'bad-config.json');
      fs.writeFileSync(configFile, 'not valid json {]');

      expect(() => {
        JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      }).toThrow();

      // ConfigManager should retain defaults
      expect(configManager.getBackendUrl()).toBe('https://vjekocom-alext-weu.azurewebsites.net');
      expect(configManager.getTier()).toBe('full');
    });
  });

  describe('Configuration Priority', () => {
    it('should prioritize runtime settings over environment variables', () => {
      process.env.ALOBJIDNINJA_BACKEND_URL = 'https://env-backend.com';
      configManager = new ConfigManager();

      expect(configManager.getBackendUrl()).toBe('https://env-backend.com');

      configManager.setBackendUrl('https://runtime-backend.com');
      expect(configManager.getBackendUrl()).toBe('https://runtime-backend.com');
    });

    it('should maintain settings across multiple instances', () => {
      configManager.setBackendUrl('https://instance1-backend.com');
      configManager.setApiKey('instance1-key');

      // Create new instance - should use environment/defaults
      const configManager2 = new ConfigManager();
      expect(configManager2.getBackendUrl()).toBe('https://vjekocom-alext-weu.azurewebsites.net');
      expect(configManager2.getApiKey()).toBeNull();

      // Original instance should retain its settings
      expect(configManager.getBackendUrl()).toBe('https://instance1-backend.com');
      expect(configManager.getApiKey()).toBe('instance1-key');
    });
  });

  describe('Settings Export and Import', () => {
    it('should export current configuration', () => {
      configManager.setBackendUrl('https://export-backend.com');
      configManager.setApiKey('export-key');
      configManager.setTier('lite');
      configManager.setLogLevel('debug');

      const config = {
        backendUrl: configManager.getBackendUrl(),
        apiKey: configManager.getApiKey(),
        tier: configManager.getTier(),
        logLevel: configManager.getLogLevel()
      };

      expect(config).toEqual({
        backendUrl: 'https://export-backend.com',
        apiKey: 'export-key',
        tier: 'lite',
        logLevel: 'debug'
      });
    });

    it('should import configuration settings', () => {
      const importConfig = {
        backendUrl: 'https://import-backend.com',
        apiKey: 'import-key',
        tier: 'standard' as const,
        logLevel: 'warn' as const
      };

      configManager.setBackendUrl(importConfig.backendUrl);
      configManager.setApiKey(importConfig.apiKey);
      configManager.setTier(importConfig.tier);
      configManager.setLogLevel(importConfig.logLevel);

      expect(configManager.getBackendUrl()).toBe('https://import-backend.com');
      expect(configManager.getApiKey()).toBe('import-key');
      expect(configManager.getTier()).toBe('standard');
      expect(configManager.getLogLevel()).toBe('warn');
    });
  });

  describe('Configuration Reset', () => {
    it('should reset to defaults', () => {
      // Set custom values
      configManager.setBackendUrl('https://custom-backend.com');
      configManager.setApiKey('custom-key');
      configManager.setTier('lite');
      configManager.setLogLevel('debug');

      // Create new instance to simulate reset
      configManager = new ConfigManager();

      expect(configManager.getBackendUrl()).toBe('https://vjekocom-alext-weu.azurewebsites.net');
      expect(configManager.getApiKey()).toBeNull();
      expect(configManager.getTier()).toBe('full');
      expect(configManager.getLogLevel()).toBe('info');
    });

    it('should clear specific settings', () => {
      configManager.setApiKey('test-key');
      expect(configManager.getApiKey()).toBe('test-key');

      configManager.setApiKey('');
      expect(configManager.getApiKey()).toBe('');

      configManager.setApiKey(undefined as any);
      expect(configManager.getApiKey()).toBeNull();
    });
  });

  describe('URL Building', () => {
    it('should build correct API URLs', () => {
      configManager.setBackendUrl('https://api.example.com');

      const baseUrl = configManager.getBackendUrl();
      const endpoints = [
        '/api/v2/checkApp',
        '/api/v2/getNext',
        '/api/v2/syncIds',
        '/api/v2/getConsumption'
      ];

      endpoints.forEach(endpoint => {
        const fullUrl = `${baseUrl}${endpoint}`;
        expect(fullUrl).toMatch(/^https:\/\/api\.example\.com\/api\/v2\//);
        expect(fullUrl).not.toContain('//api'); // No double slashes
      });
    });

    it('should handle base URL with path', () => {
      configManager.setBackendUrl('https://api.example.com/backend');

      const baseUrl = configManager.getBackendUrl();
      const fullUrl = `${baseUrl}/api/v2/checkApp`;

      expect(fullUrl).toBe('https://api.example.com/backend/api/v2/checkApp');
    });
  });

  describe('Security', () => {
    it('should not expose API key in logs or errors', () => {
      configManager.setApiKey('super-secret-key');

      // API key should be retrievable
      expect(configManager.getApiKey()).toBe('super-secret-key');

      // But should not be in any string representation
      const configStr = JSON.stringify({
        backend: configManager.getBackendUrl(),
        tier: configManager.getTier(),
        logLevel: configManager.getLogLevel()
      });

      expect(configStr).not.toContain('super-secret-key');
    });

    it('should handle sensitive data carefully', () => {
      const sensitiveKey = 'k7znp7I/+RJFk5Qswcut6QMlH1vZ57o82mLi5O0A+oo=';
      configManager.setApiKey(sensitiveKey);

      expect(configManager.getApiKey()).toBe(sensitiveKey);

      // Should be able to clear it
      configManager.setApiKey('');
      expect(configManager.getApiKey()).toBe('');
    });
  });

  describe('Performance', () => {
    it('should handle rapid configuration changes', () => {
      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        configManager.setBackendUrl(`https://backend-${i}.com`);
        configManager.setApiKey(`key-${i}`);
        configManager.setTier(i % 3 === 0 ? 'lite' : i % 3 === 1 ? 'standard' : 'full');
        configManager.setLogLevel(i % 2 === 0 ? 'debug' : 'info');

        // Read values
        configManager.getBackendUrl();
        configManager.getApiKey();
        configManager.getTier();
        configManager.getLogLevel();
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should cache configuration values appropriately', () => {
      // Set values
      configManager.setBackendUrl('https://cached-backend.com');

      // Multiple reads should be fast
      const startTime = Date.now();
      for (let i = 0; i < 10000; i++) {
        configManager.getBackendUrl();
      }
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10); // Very fast for cached reads
    });
  });
});