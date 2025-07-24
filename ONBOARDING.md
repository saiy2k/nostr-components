# 🚀 Enhanced Nostr Onboarding System

A comprehensive authentication system for nostr-components with 6 different authentication methods, secure key storage, and modern UX.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Authentication Methods](#authentication-methods)
- [Architecture](#architecture)
- [Usage](#usage)
- [Security](#security)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Migration Guide](#migration-guide)

## 🎯 Overview

The enhanced onboarding system provides a complete authentication solution for Nostr applications, built entirely with `nostr-tools` and `@nostr-dev-kit/ndk` without external authentication libraries.

### Key Benefits

- **6 Authentication Methods** - Browser extensions, QR codes, NIP-46 bunkers, OTP/DM, secure storage, key generation
- **Secure by Default** - Encrypted key storage with PBKDF2 + AES-GCM
- **Modern UX** - Multi-screen modal flow with loading states and error handling
- **Extensible** - Easy to integrate with any component requiring authentication
- **Mobile-Friendly** - QR codes and OTP support for mobile workflows

## ✨ Features

### 🔐 Authentication Methods
- ✅ **Browser Extension Detection** - Auto-detects Alby, nos2x, Horse, Flamingo, Blockcore
- ✅ **QR Code Authentication** - Connection strings with QR codes for mobile apps
- ✅ **NIP-46 Bunker Support** - Full bunker URL support (nsec.app, Amber, etc.)
- ✅ **OTP/DM Authentication** - Verification codes via Nostr DMs
- ✅ **Secure Key Storage** - Encrypted localStorage with password protection
- ✅ **Local Key Generation** - Generate new keypairs with secure storage

### 🛡️ Security Features
- ✅ **PBKDF2 Key Derivation** - 100,000 iterations with random salt
- ✅ **AES-GCM Encryption** - Industry-standard authenticated encryption
- ✅ **Secure Random Generation** - Crypto.getRandomValues for all secrets
- ✅ **Legacy Key Migration** - Safe upgrade from old unencrypted storage
- ✅ **Password Requirements** - Enforced minimum security standards

### 🎨 UX Features
- ✅ **Multi-Screen Flow** - Intuitive progression through authentication
- ✅ **Loading States** - Visual feedback during async operations
- ✅ **Error Handling** - Clear error messages with retry options
- ✅ **Responsive Design** - Works on mobile and desktop
- ✅ **Accessibility** - Keyboard navigation and screen reader support

## 🔐 Authentication Methods

### 1. Browser Extension Authentication

Automatically detects and manages Nostr browser extensions.

**Supported Extensions:**
- Alby
- nos2x
- Horse
- Flamingo
- Blockcore

**Features:**
- Auto-detection with polling
- Extension switching
- Connection testing
- Fallback handling

```javascript
// Extension service usage
const extensionService = ExtensionService.getInstance();
const extensions = extensionService.getExtensions();
const current = extensionService.getCurrentExtension();
```

### 2. QR Code Authentication

Generates connection strings with QR codes for mobile app authentication.

**Features:**
- Connection string generation
- QR code rendering
- App metadata inclusion
- Mobile app compatibility

```javascript
// Generate QR code
const appMetadata = {
  name: 'My Nostr App',
  url: 'https://myapp.com',
  description: 'My awesome Nostr application'
};

const { connectionString, secret, pubkey } = 
  ConnectionStringService.generateConnectionString(appMetadata);
```

### 3. NIP-46 Bunker Support

Full implementation of NIP-46 for remote signing.

**Supported Signers:**
- nsec.app
- Amber (Android)
- Any NIP-46 compatible signer

**Features:**
- Bunker URL parsing
- Relay communication
- Request/response handling
- Connection management

```javascript
// Connect to bunker
const nip46Service = new Nip46Service();
const success = await nip46Service.connectToBunker(bunkerUrl);
const pubkey = await nip46Service.getPublicKey();
```

### 4. OTP/DM Authentication

Send verification codes via Nostr direct messages.

**Features:**
- NIP-05 resolution
- Username lookup
- DM encryption (NIP-04)
- Session management

```javascript
// Send OTP
const otpService = new OTPService();
const pubkey = await otpService.resolveToPubkey('user@domain.com');
const sessionId = await otpService.sendOTP(pubkey);
```

### 5. Secure Key Storage

Encrypted localStorage with password protection.

**Features:**
- PBKDF2 key derivation
- AES-GCM encryption
- Multiple key support
- Legacy migration

```javascript
// Store key securely
await SecureStorage.storeKey(nsec, password);

// Retrieve key
const nsec = await SecureStorage.retrieveKey(pubkey, password);
```

### 6. Local Key Generation

Generate new keypairs locally with secure storage.

**Features:**
- Cryptographically secure generation
- Automatic secure storage
- Password protection
- Key backup display

```javascript
// Generate new key
const { pubkey, nsec } = await SecureStorage.generateAndStoreKey(password);
```

## 🏗️ Architecture

### Core Services

```
┌─────────────────────────────────────────────────────────────┐
│                    NostrOnboardingModal                     │
│                   (Main UI Component)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ ExtensionService│ SecureStorage   │ConnectionString │   Nip46Service  │
│                 │                 │    Service      │                 │
│ • Auto-detect   │ • PBKDF2+AES   │ • QR generation │ • NIP-46 impl  │
│ • Switching     │ • Multi-key    │ • Connection    │ • Relay comm   │
│ • Testing       │ • Migration    │   strings       │ • Signing      │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   OTPService    │
                    │                 │
                    │ • NIP-05 resolve│
                    │ • DM sending    │
                    │ • Code verify   │
                    └─────────────────┘
```

### File Structure

```
src/onboarding/
├── onboarding-modal.ts      # Main modal component
├── extension-service.ts     # Browser extension management
├── secure-storage.ts        # Encrypted key storage
├── connection-string.ts     # QR code & connection strings
├── nip46-service.ts        # NIP-46 bunker implementation
└── otp-service.ts          # OTP/DM authentication
```

## 🚀 Usage

### Basic Integration

The onboarding modal automatically integrates with existing components:

```html
<!-- Follow button with automatic onboarding -->
<nostr-follow-button npub="npub1..."></nostr-follow-button>
```

### Manual Trigger

```javascript
// Trigger onboarding manually
const modal = document.createElement('nostr-onboarding-modal');
document.body.appendChild(modal);

modal.setPendingAction('like this post', () => {
  console.log('User authenticated, performing action...');
  // Your action here
});
```

### Component Integration

```javascript
// In your component
private async requireAuthentication(action: string, callback: () => void) {
  // Check if user is already authenticated
  if (this.isAuthenticated()) {
    callback();
    return;
  }

  // Show onboarding modal
  const modal = document.createElement('nostr-onboarding-modal');
  document.body.appendChild(modal);
  modal.setPendingAction(action, callback);
}
```

### Screen Navigation

```javascript
// Navigate to specific authentication method
modal.setPendingAction('sign event', callback);

// Navigate to specific screen after modal opens
setTimeout(() => {
  modal.setScreen('extension'); // or 'qr', 'bunker', 'otp', etc.
}, 100);
```

## 🛡️ Security

### Encryption Details

**Key Derivation:**
- Algorithm: PBKDF2
- Iterations: 100,000
- Hash: SHA-256
- Salt: 16 random bytes

**Encryption:**
- Algorithm: AES-GCM
- Key Size: 256 bits
- IV: 12 random bytes
- Authentication: Built-in with GCM

**Random Generation:**
- Source: `crypto.getRandomValues()`
- Used for: salts, IVs, secrets, keypairs

### Storage Security

```javascript
// Stored key format
interface StoredKey {
  pubkey: string;      // Public key (unencrypted)
  encrypted: string;   // Encrypted private key (base64)
  salt: string;        // PBKDF2 salt (base64)
  iv: string;          // AES-GCM IV (base64)
}
```

### Best Practices

1. **Password Requirements:** Minimum 8 characters for generated keys
2. **Key Rotation:** Support for multiple stored keys
3. **Legacy Migration:** Safe upgrade from unencrypted storage
4. **Error Handling:** No sensitive data in error messages
5. **Memory Management:** Clear sensitive data after use

## 📚 API Reference

### NostrOnboardingModal

Main modal component for authentication flow.

```typescript
class NostrOnboardingModal extends HTMLElement {
  // Set the action that triggered onboarding
  setPendingAction(description: string, retryCallback?: () => void): void;
  
  // Navigate to specific screen
  setScreen(screen: Screen): void;
  
  // Close modal
  close(retry?: boolean): void;
}
```

### ExtensionService

Manages browser extension detection and switching.

```typescript
class ExtensionService {
  static getInstance(): ExtensionService;
  
  getExtensions(): DetectedExtension[];
  getCurrentExtension(): DetectedExtension | null;
  setCurrentExtension(extension: DetectedExtension | null): void;
  
  onExtensionsChanged(callback: (extensions: DetectedExtension[]) => void): void;
  testExtension(extension: DetectedExtension): Promise<boolean>;
}
```

### SecureStorage

Encrypted key storage with password protection.

```typescript
class SecureStorage {
  // Generate and store new key
  static generateAndStoreKey(password: string): Promise<{pubkey: string, nsec: string}>;
  
  // Store existing key
  static storeKey(nsec: string, password: string): Promise<void>;
  
  // Retrieve stored key
  static retrieveKey(pubkey: string, password: string): Promise<string | null>;
  
  // Get all stored keys
  static getStoredKeys(): StoredKey[];
  
  // Legacy key migration
  static migrateLegacyKey(password: string): Promise<boolean>;
}
```

### ConnectionStringService

QR code and connection string generation.

```typescript
class ConnectionStringService {
  // Generate connection string with QR
  static generateConnectionString(
    appMetadata: AppMetadata,
    relays?: string[],
    permissions?: string[]
  ): {connectionString: string, secret: string, pubkey: string};
  
  // Generate QR code
  static generateQRCode(text: string, size?: number): Promise<string>;
  
  // Parse connection string
  static parseConnectionString(connectionString: string): ConnectionStringParams | null;
  
  // Bunker URL support
  static generateBunkerUrl(pubkey: string, relays?: string[], secret?: string): string;
  static parseBunkerUrl(bunkerUrl: string): {pubkey: string, relays: string[], secret?: string} | null;
}
```

### Nip46Service

NIP-46 bunker implementation.

```typescript
class Nip46Service {
  // Connect to bunker
  connectToBunker(bunkerUrl: string): Promise<boolean>;
  
  // Send request to bunker
  sendRequest(method: string, params?: any[]): Promise<any>;
  
  // Authentication methods
  getPublicKey(): Promise<string>;
  signEvent(event: any): Promise<any>;
  getRelays(): Promise<Record<string, {read: boolean, write: boolean}>>;
  
  // Encryption methods
  nip04Encrypt(pubkey: string, plaintext: string): Promise<string>;
  nip04Decrypt(pubkey: string, ciphertext: string): Promise<string>;
  nip44Encrypt(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt(pubkey: string, ciphertext: string): Promise<string>;
}
```

### OTPService

OTP/DM authentication service.

```typescript
class OTPService {
  // Initialize service
  initialize(): Promise<void>;
  
  // Send OTP code
  sendOTP(userPubkey: string): Promise<string>;
  
  // Verify OTP code
  verifyOTP(sessionId: string, code: string): Promise<{success: boolean, pubkey?: string}>;
  
  // Resolve identifier to pubkey
  resolveToPubkey(identifier: string): Promise<string | null>;
}
```

## 💡 Examples

### Complete Integration Example

```javascript
class MyNostrComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async handleLikePost() {
    // Check if authenticated
    if (!this.hasActiveSigner()) {
      await this.showOnboarding('like this post');
      return;
    }

    // Proceed with action
    await this.likePost();
  }

  async showOnboarding(action) {
    return new Promise((resolve) => {
      const modal = document.createElement('nostr-onboarding-modal');
      document.body.appendChild(modal);
      
      modal.setPendingAction(action, () => {
        resolve();
        this.handleLikePost(); // Retry action
      });
    });
  }

  hasActiveSigner() {
    // Check for extension
    if (window.nostr) return true;
    
    // Check for stored keys
    const storedKeys = SecureStorage.getStoredKeys();
    const currentKey = SecureStorage.getCurrentKeyPubkey();
    
    return storedKeys.length > 0 && currentKey;
  }
}
```

### Custom Authentication Flow

```javascript
// Custom authentication with specific method
async function authenticateWithExtension() {
  const modal = document.createElement('nostr-onboarding-modal');
  document.body.appendChild(modal);
  
  modal.setPendingAction('sign message', () => {
    console.log('Extension authentication successful');
  });
  
  // Navigate directly to extension screen
  setTimeout(() => modal.setScreen('extension'), 100);
}

// Custom authentication with bunker
async function authenticateWithBunker(bunkerUrl) {
  const nip46Service = new Nip46Service();
  
  try {
    const success = await nip46Service.connectToBunker(bunkerUrl);
    if (success) {
      const pubkey = await nip46Service.getPublicKey();
      console.log('Bunker authentication successful:', pubkey);
      return nip46Service.createSigner();
    }
  } catch (error) {
    console.error('Bunker authentication failed:', error);
  }
  
  return null;
}
```

### Secure Key Management

```javascript
// Store multiple keys securely
async function storeMultipleKeys(keys, password) {
  for (const nsec of keys) {
    try {
      await SecureStorage.storeKey(nsec, password);
      console.log('Key stored successfully');
    } catch (error) {
      console.error('Failed to store key:', error);
    }
  }
}

// Retrieve and use stored key
async function useStoredKey(pubkey, password) {
  try {
    const nsec = await SecureStorage.retrieveKey(pubkey, password);
    if (nsec) {
      SecureStorage.setCurrentKey(pubkey);
      console.log('Using stored key:', pubkey);
      return nsec;
    }
  } catch (error) {
    console.error('Failed to retrieve key:', error);
  }
  
  return null;
}
```

## 🔄 Migration Guide

### From Legacy Storage

The system automatically detects and helps migrate legacy unencrypted keys:

```javascript
// Check for legacy key
const legacyKey = SecureStorage.getLegacyKey();
if (legacyKey) {
  console.log('Legacy key detected, migration recommended');
  
  // Migrate to secure storage
  const password = prompt('Enter password for encryption:');
  const success = await SecureStorage.migrateLegacyKey(password);
  
  if (success) {
    console.log('Migration successful');
  }
}
```

### From Basic to Enhanced Onboarding

1. **Replace old modal imports:**
   ```javascript
   // Old
   import './onboarding/onboarding-modal.ts';
   
   // New (same import, enhanced functionality)
   import './onboarding/onboarding-modal.ts';
   ```

2. **Update trigger calls:**
   ```javascript
   // Old
   modal.setPendingAction('follow', callback);
   
   // New (same API, more features)
   modal.setPendingAction('follow', callback);
   ```

3. **Add new authentication methods:**
   ```javascript
   // New capabilities available
   modal.setScreen('qr');        // QR code auth
   modal.setScreen('bunker');    // NIP-46 bunker
   modal.setScreen('otp');       // OTP/DM auth
   modal.setScreen('secure-key'); // Secure storage
   ```

### Component Integration

Update existing components to use enhanced onboarding:

```javascript
// Before
private async showOnboardingModal() {
  const modal = document.createElement('nostr-onboarding-modal');
  document.body.appendChild(modal);
  modal.setPendingAction('follow', () => this.handleFollowClick());
}

// After (same code, enhanced features automatically available)
private async showOnboardingModal() {
  const modal = document.createElement('nostr-onboarding-modal');
  document.body.appendChild(modal);
  modal.setPendingAction('follow', () => this.handleFollowClick());
  // Now supports all 6 authentication methods!
}
```

## 🧪 Testing

### Demo Page

Run the demo to test all features:

```bash
# Build the components
npm run build

# Open the demo page
open onboarding-demo.html
```

### Manual Testing

1. **Extension Testing:** Install Alby or nos2x and test detection
2. **QR Code Testing:** Generate QR codes and test with mobile apps
3. **Bunker Testing:** Test with nsec.app or Amber bunker URLs
4. **OTP Testing:** Test DM sending and verification
5. **Storage Testing:** Test key encryption and retrieval
6. **Migration Testing:** Test legacy key migration

### Automated Testing

```javascript
// Test all services
async function testAllServices() {
  const extensionService = ExtensionService.getInstance();
  const extensions = extensionService.getExtensions();
  console.log('Extensions:', extensions);
  
  const connectionString = ConnectionStringService.generateConnectionString({
    name: 'Test App'
  });
  console.log('Connection string:', connectionString);
  
  const storedKeys = SecureStorage.getStoredKeys();
  console.log('Stored keys:', storedKeys.length);
}
```

## 🤝 Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build components: `npm run build`
4. Open demo: `open onboarding-demo.html`

### Adding New Authentication Methods

1. Create service in `src/onboarding/`
2. Add screen to `onboarding-modal.ts`
3. Implement UI and handlers
4. Add to demo and documentation
5. Test thoroughly

### Security Considerations

- Always use `crypto.getRandomValues()` for random generation
- Implement proper key derivation (PBKDF2 minimum)
- Use authenticated encryption (AES-GCM)
- Clear sensitive data from memory
- Validate all inputs
- Handle errors securely

## 📄 License

This enhanced onboarding system is part of the nostr-components library and follows the same license terms.

---

**Built with ❤️ for the Nostr ecosystem**
