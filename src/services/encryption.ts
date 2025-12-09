import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'encryption' });

/**
 * Encryption Service
 * Handles encryption/decryption of sensitive audit data
 */

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  tag: string;
  algorithm: string;
}

export interface AccessControl {
  owner: string;
  allowedUsers: string[];
  allowedRoles: string[];
  createdAt: string;
  expiresAt?: string;
}

export interface SecureAuditReport {
  jobId: string;
  encrypted: boolean;
  encryptedData?: EncryptedData;
  accessControl: AccessControl;
  metadata: {
    size: number;
    checksum: string;
    encryptedAt?: string;
  };
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  saltLength: 64,
  iterations: 100000
};

export class EncryptionService {
  private config: EncryptionConfig;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      this.config.iterations,
      this.config.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  async encrypt(data: string, password: string): Promise<EncryptedData> {
    try {
      // Generate random salt and IV
      const salt = crypto.randomBytes(this.config.saltLength);
      const iv = crypto.randomBytes(this.config.ivLength);

      // Derive key from password
      const key = this.deriveKey(password, salt);

      // Create cipher
      const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);

      // Encrypt data
      let ciphertext = cipher.update(data, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get authentication tag
      const tag = cipher.getAuthTag();

      log.info('Data encrypted successfully');

      return {
        ciphertext,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.config.algorithm
      };
    } catch (error: any) {
      log.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  async decrypt(encryptedData: EncryptedData, password: string): Promise<string> {
    try {
      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      // Derive key from password
      const key = this.deriveKey(password, salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        encryptedData.algorithm,
        key,
        iv
      );
      decipher.setAuthTag(tag);

      // Decrypt data
      let plaintext = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      log.info('Data decrypted successfully');

      return plaintext;
    } catch (error: any) {
      log.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Calculate SHA-256 checksum
   */
  calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Encrypt audit report
   */
  async encryptAuditReport(
    reportPath: string,
    password: string,
    accessControl: AccessControl
  ): Promise<SecureAuditReport> {
    try {
      log.info(`Encrypting audit report: ${reportPath}`);

      // Read report
      const reportData = await fs.readFile(reportPath, 'utf-8');

      // Calculate checksum before encryption
      const checksum = this.calculateChecksum(reportData);

      // Encrypt
      const encryptedData = await this.encrypt(reportData, password);

      // Create secure report metadata
      const secureReport: SecureAuditReport = {
        jobId: path.basename(reportPath, '.json'),
        encrypted: true,
        encryptedData,
        accessControl,
        metadata: {
          size: reportData.length,
          checksum,
          encryptedAt: new Date().toISOString()
        }
      };

      // Save encrypted report
      const encryptedPath = reportPath.replace('.json', '.encrypted.json');
      await fs.writeFile(
        encryptedPath,
        JSON.stringify(secureReport, null, 2),
        'utf-8'
      );

      log.info(`✅ Encrypted report saved: ${encryptedPath}`);

      return secureReport;
    } catch (error: any) {
      log.error('Failed to encrypt audit report:', error);
      throw error;
    }
  }

  /**
   * Decrypt audit report
   */
  async decryptAuditReport(
    encryptedPath: string,
    password: string,
    requestingUser: string
  ): Promise<string> {
    try {
      log.info(`Decrypting audit report: ${encryptedPath}`);

      // Read encrypted report
      const content = await fs.readFile(encryptedPath, 'utf-8');
      const secureReport: SecureAuditReport = JSON.parse(content);

      // Check access control
      if (!this.hasAccess(secureReport.accessControl, requestingUser)) {
        throw new Error(`Access denied for user: ${requestingUser}`);
      }

      // Check expiration
      if (
        secureReport.accessControl.expiresAt &&
        new Date(secureReport.accessControl.expiresAt) < new Date()
      ) {
        throw new Error('Access expired');
      }

      // Decrypt
      if (!secureReport.encryptedData) {
        throw new Error('No encrypted data found');
      }

      const decryptedData = await this.decrypt(
        secureReport.encryptedData,
        password
      );

      // Verify checksum
      const checksum = this.calculateChecksum(decryptedData);
      if (checksum !== secureReport.metadata.checksum) {
        throw new Error('Checksum verification failed - data may be corrupted');
      }

      log.info('✅ Report decrypted and verified successfully');

      return decryptedData;
    } catch (error: any) {
      log.error('Failed to decrypt audit report:', error);
      throw error;
    }
  }

  /**
   * Check if user has access
   */
  private hasAccess(accessControl: AccessControl, user: string): boolean {
    // Owner always has access
    if (accessControl.owner === user) {
      return true;
    }

    // Check allowed users
    if (accessControl.allowedUsers.includes(user)) {
      return true;
    }

    // TODO: Check roles when RBAC is implemented
    // For now, just check user list

    return false;
  }

  /**
   * Update access control
   */
  async updateAccessControl(
    encryptedPath: string,
    newAccessControl: Partial<AccessControl>,
    requestingUser: string
  ): Promise<void> {
    try {
      log.info(`Updating access control: ${encryptedPath}`);

      // Read encrypted report
      const content = await fs.readFile(encryptedPath, 'utf-8');
      const secureReport: SecureAuditReport = JSON.parse(content);

      // Only owner can update access control
      if (secureReport.accessControl.owner !== requestingUser) {
        throw new Error('Only owner can update access control');
      }

      // Update access control
      secureReport.accessControl = {
        ...secureReport.accessControl,
        ...newAccessControl
      };

      // Save updated report
      await fs.writeFile(
        encryptedPath,
        JSON.stringify(secureReport, null, 2),
        'utf-8'
      );

      log.info('✅ Access control updated');
    } catch (error: any) {
      log.error('Failed to update access control:', error);
      throw error;
    }
  }

  /**
   * Grant access to user
   */
  async grantAccess(
    encryptedPath: string,
    targetUser: string,
    requestingUser: string
  ): Promise<void> {
    try {
      const content = await fs.readFile(encryptedPath, 'utf-8');
      const secureReport: SecureAuditReport = JSON.parse(content);

      if (secureReport.accessControl.owner !== requestingUser) {
        throw new Error('Only owner can grant access');
      }

      if (!secureReport.accessControl.allowedUsers.includes(targetUser)) {
        secureReport.accessControl.allowedUsers.push(targetUser);

        await fs.writeFile(
          encryptedPath,
          JSON.stringify(secureReport, null, 2),
          'utf-8'
        );

        log.info(`✅ Access granted to ${targetUser}`);
      }
    } catch (error: any) {
      log.error('Failed to grant access:', error);
      throw error;
    }
  }

  /**
   * Revoke access from user
   */
  async revokeAccess(
    encryptedPath: string,
    targetUser: string,
    requestingUser: string
  ): Promise<void> {
    try {
      const content = await fs.readFile(encryptedPath, 'utf-8');
      const secureReport: SecureAuditReport = JSON.parse(content);

      if (secureReport.accessControl.owner !== requestingUser) {
        throw new Error('Only owner can revoke access');
      }

      secureReport.accessControl.allowedUsers =
        secureReport.accessControl.allowedUsers.filter(u => u !== targetUser);

      await fs.writeFile(
        encryptedPath,
        JSON.stringify(secureReport, null, 2),
        'utf-8'
      );

      log.info(`✅ Access revoked from ${targetUser}`);
    } catch (error: any) {
      log.error('Failed to revoke access:', error);
      throw error;
    }
  }

  /**
   * List users with access
   */
  async listAccessUsers(encryptedPath: string): Promise<{
    owner: string;
    allowedUsers: string[];
  }> {
    try {
      const content = await fs.readFile(encryptedPath, 'utf-8');
      const secureReport: SecureAuditReport = JSON.parse(content);

      return {
        owner: secureReport.accessControl.owner,
        allowedUsers: secureReport.accessControl.allowedUsers
      };
    } catch (error: any) {
      log.error('Failed to list access users:', error);
      throw error;
    }
  }
}

// Singleton instance
let encryptionService: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionService) {
    encryptionService = new EncryptionService();
  }
  return encryptionService;
}

export function resetEncryptionService(): void {
  encryptionService = null;
}
