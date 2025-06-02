import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EncryptionKeyService } from '../services/EncryptionKeyService.js';

// Mock node-notifier
let notificationCallback: any = null;

vi.mock('node-notifier', () => ({
  default: {
    notify: vi.fn((options: any, callback: any) => {
      // Store the callback to simulate notification response later
      if (typeof callback === 'function') {
        notificationCallback = callback;
      }
      // Simulate successful notification display
      return {
        on: vi.fn()
      };
    })
  }
}));

vi.mock('readline', () => {
  return {
    createInterface: vi.fn().mockReturnValue({
      question: vi.fn((_prompt: string, callback: (answer: string) => void) => {
        // Simulate user input
        process.nextTick(() => callback('test-key'));
      }),
      close: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn()
    })
  };
});

// Mock process.stdout to prevent test output
vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

describe('EncryptionKeyService', () => {
  let service: EncryptionKeyService;
  
  beforeEach(() => {
    // Reset the singleton instance before each test
    (EncryptionKeyService as any).instance = null;
    service = EncryptionKeyService.getInstance();
    
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setKey', () => {
    it('should set the encryption key', () => {
      const key = 'test-key-123';
      service.setKey(key);
      expect(service.getKey()).toBe(key);
    });

    it('should throw an error for empty key', () => {
      expect(() => service.setKey('')).toThrow('Encryption key must be at least 6 characters long');
      expect(() => service.setKey('   ')).toThrow('Encryption key must be at least 6 characters long');
    });
  });

  describe('ensureKeyIsAvailable', () => {
    it('should resolve immediately if key is already set', async () => {
      const key = 'test-key-123';
      service.setKey(key);
      await expect(service.ensureKeyIsAvailable()).resolves.toBe(key);
    });

    it('should handle concurrent ensureKeyIsAvailable calls', async () => {
      // Reset the service to ensure no key is set
      (EncryptionKeyService as any).instance = null;
      const newService = EncryptionKeyService.getInstance();
      
      const promptSpy = vi.spyOn(newService as any, 'promptForEncryptionKey');
      
      // Make multiple concurrent calls
      const promises = [
        newService.ensureKeyIsAvailable(),
        newService.ensureKeyIsAvailable(),
        newService.ensureKeyIsAvailable()
      ];
      
      // Simulate the notification response after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate user responding to the notification
      if (notificationCallback) {
        notificationCallback(null, 'replied', { response: 'test-key' });
      }
      
      await Promise.all(promises);
      
      expect(newService.getKey()).toBe('test-key');
      
      // Verify that promptForEncryptionKey was only called once despite multiple concurrent calls
      expect(promptSpy).toHaveBeenCalledTimes(1);
    }, 10000); // Increase timeout for this test
  });
});
