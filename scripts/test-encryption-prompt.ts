#!/usr/bin/env node

import { EncryptionKeyService } from '../src/services/EncryptionKeyService.js';

async function testEncryptionPrompt() {
  console.log('Testing EncryptionKeyService prompt...');
  
  // Get the singleton instance
  const service = EncryptionKeyService.getInstance();
  
  try {
    console.log('Ensuring encryption key is available...');
    await service.ensureKeyIsAvailable();
    
    const key = service.getKey();
    console.log(`Success! Encryption key is set: ${key ? '***' + key.slice(-4) : 'not set'}`);
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  } finally {
    // Close any open resources
    process.exit(0);
  }
}

// Run the test
testEncryptionPrompt().catch(console.error);
