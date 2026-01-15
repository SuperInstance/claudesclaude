/**
 * High-Performance Workspace File Manager
 *
 * Provides efficient file operations for workspace management with
 * caching, batch operations, and optimized file system interactions
 * for orchestration systems.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// File operation cache
const FILE_CACHE = new Map<string, {
  content: Buffer | string;
  timestamp: number;
  size: number;
}>();

// File operation stats
const STATS = {
  hits: 0,
  misses: 0,
  reads: 0,
  writes: 0,
  errors: 0
};

// Cache configuration
const CACHE_CONFIG = {
  maxSize: 1000, // Maximum cached files
  maxMemory: 50 * 1024 * 1024, // 50MB cache limit
  ttl: 300000, // 5 minutes TTL
};

export interface FileOperationOptions {
  encoding?: BufferEncoding;
  createDirectory?: boolean;
  overwrite?: boolean;
  cache?: boolean;
}

export interface WorkspaceInfo {
  path: string;
  size: number;
  fileCount: number;
  lastModified: Date;
  subdirectories: string[];
}

export interface BatchOperation {
  operation: 'read' | 'write' | 'delete' | 'move' | 'copy';
  path: string;
  content?: string | Buffer;
  options?: FileOperationOptions;
}

/**
 * High-performance workspace file manager
 */
export class WorkspaceManager {
  private workspacePath: string;
  private tempDirectory: string;

  constructor(workspacePath: string) {
    this.workspacePath = path.resolve(workspacePath);
    this.tempDirectory = path.join(this.workspacePath, '.temp');
    this.ensureDirectories();
  }

  /**
   * Initialize workspace directories
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.workspacePath, { recursive: true });
      await fs.mkdir(this.tempDirectory, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Read file with caching
   */
  async readFile(filePath: string, options: FileOperationOptions = {}): Promise<Buffer | string> {
    const resolvedPath = path.join(this.workspacePath, filePath);
    const fullOptions: Required<FileOperationOptions> = {
      encoding: 'utf8',
      createDirectory: false,
      overwrite: false,
      cache: true,
      ...options
    };

    // Check cache first
    if (fullOptions.cache) {
      const cached = this.getCachedFile(resolvedPath);
      if (cached) {
        STATS.hits++;
        return cached.content;
      }
      STATS.misses++;
    }

    STATS.reads++;

    try {
      // Ensure directory exists if requested
      if (fullOptions.createDirectory) {
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      const content = await fs.readFile(resolvedPath, {
        encoding: fullOptions.encoding === 'buffer' ? undefined : fullOptions.encoding
      });

      // Cache the result
      if (fullOptions.cache) {
        this.setCachedFile(resolvedPath, content);
      }

      return content;
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write file with caching
   */
  async writeFile(
    filePath: string,
    content: string | Buffer,
    options: FileOperationOptions = {}
  ): Promise<void> {
    const resolvedPath = path.join(this.workspacePath, filePath);
    const fullOptions: Required<FileOperationOptions> = {
      encoding: 'utf8',
      createDirectory: true,
      overwrite: true,
      cache: true,
      ...options
    };

    STATS.writes++;

    try {
      // Ensure directory exists
      if (fullOptions.createDirectory) {
        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Check if file exists and handle overwrite
      if (!fullOptions.overwrite) {
        try {
          await fs.access(resolvedPath);
          throw new Error(`File already exists: ${filePath}`);
        } catch {
          // File doesn't exist, continue
        }
      }

      await fs.writeFile(resolvedPath, content, {
        encoding: fullOptions.encoding === 'buffer' ? undefined : fullOptions.encoding
      });

      // Update cache
      if (fullOptions.cache) {
        this.setCachedFile(resolvedPath, content);
      }
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Delete file with cache invalidation
   */
  async deleteFile(filePath: string): Promise<void> {
    const resolvedPath = path.join(this.workspacePath, filePath);

    try {
      await fs.unlink(resolvedPath);
      // Invalidate cache
      this.invalidateCachedFile(resolvedPath);
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Move/rename file
   */
  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    const resolvedSource = path.join(this.workspacePath, sourcePath);
    const resolvedDestination = path.join(this.workspacePath, destinationPath);

    try {
      await fs.rename(resolvedSource, resolvedDestination);
      // Invalidate old cache, update new cache if exists
      this.invalidateCachedFile(resolvedSource);
      this.invalidateCachedFile(resolvedDestination);
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to move file from ${sourcePath} to ${destinationPath}: ${error.message}`);
    }
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    const resolvedSource = path.join(this.workspacePath, sourcePath);
    const resolvedDestination = path.join(this.workspacePath, destinationPath);

    try {
      await fs.copyFile(resolvedSource, resolvedDestination);
      // Cache the copied file if source is cached
      const cached = this.getCachedFile(resolvedSource);
      if (cached) {
        this.setCachedFile(resolvedDestination, cached.content);
      }
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to copy file from ${sourcePath} to ${destinationPath}: ${error.message}`);
    }
  }

  /**
   * List files in directory with optional filtering
   */
  async listFiles(directory: string = '', options: {
    recursive?: boolean;
    extensions?: string[];
    pattern?: RegExp;
  } = {}): Promise<string[]> {
    const resolvedDir = path.join(this.workspacePath, directory);
    const {
      recursive = false,
      extensions = [],
      pattern
    } = options;

    try {
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(resolvedDir, entry.name);

        if (entry.isFile()) {
          const relativePath = path.relative(this.workspacePath, fullPath);

          // Apply filters
          if (extensions.length > 0) {
            const ext = path.extname(entry.name);
            if (!extensions.includes(ext)) continue;
          }

          if (pattern && !pattern.test(entry.name)) continue;

          files.push(relativePath);
        } else if (entry.isDirectory() && recursive) {
          const subFiles = await this.listFiles(path.join(directory, entry.name), options);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to list files in ${directory}: ${error.message}`);
    }
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    try {
      const stats = await fs.stat(this.workspacePath);
      const files = await this.listFiles('', { recursive: true });
      const subdirs = this.getSubdirectories();

      return {
        path: this.workspacePath,
        size: stats.size,
        fileCount: files.length,
        lastModified: stats.mtime,
        subdirectories: subdirs
      };
    } catch (error) {
      STATS.errors++;
      throw new Error(`Failed to get workspace info: ${error.message}`);
    }
  }

  /**
   * Clean up workspace
   */
  async cleanup(options: {
    olderThan?: number; // milliseconds
    patterns?: RegExp[];
    dryRun?: boolean;
  } = {}): Promise<{ deleted: string[]; totalSize: number }> {
    const {
      olderThan = 0,
      patterns = [],
      dryRun = false
    } = options;

    const deleted: string[] = [];
    let totalSize = 0;

    const files = await this.listFiles('', { recursive: true });

    for (const file of files) {
      const filePath = path.join(this.workspacePath, file);

      try {
        const stats = await fs.stat(filePath);

        // Apply filters
        if (olderThan > 0 && Date.now() - stats.mtime.getTime() < olderThan) {
          continue;
        }

        if (patterns.length > 0) {
          const matches = patterns.some(pattern => pattern.test(file));
          if (!matches) continue;
        }

        if (!dryRun) {
          await fs.unlink(filePath);
          this.invalidateCachedFile(filePath);
        }

        deleted.push(file);
        totalSize += stats.size;
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    return { deleted, totalSize };
  }

  /**
   * Create backup of workspace
   */
  async createBackup(backupPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = backupPath || path.join(this.workspacePath, 'backups', `backup-${timestamp}`);

    await fs.mkdir(backupDir, { recursive: true });

    const files = await this.listFiles('', { recursive: true });

    for (const file of files) {
      const sourcePath = path.join(this.workspacePath, file);
      const destPath = path.join(backupDir, file);

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(sourcePath, destPath);
    }

    return backupDir;
  }

  /**
   * Batch file operations
   */
  async batchOperations(operations: BatchOperation[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const operation of operations) {
      try {
        switch (operation.operation) {
          case 'read':
            await this.readFile(operation.path, operation.options);
            break;
          case 'write':
            await this.writeFile(operation.path, operation.content || '', operation.options);
            break;
          case 'delete':
            await this.deleteFile(operation.path);
            break;
          case 'move':
            if (!operation.content) {
              throw new Error('Destination path is required for move operation');
            }
            await this.moveFile(operation.path, operation.content);
            break;
          case 'copy':
            if (!operation.content) {
              throw new Error('Destination path is required for copy operation');
            }
            await this.copyFile(operation.path, operation.content);
            break;
        }
        success++;
      } catch (error) {
        failed++;
        errors.push(`${operation.operation} ${operation.path}: ${error.message}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Generate file hash for integrity checking
   */
  async generateFileHash(filePath: string, algorithm = 'sha256'): Promise<string> {
    const resolvedPath = path.join(this.workspacePath, filePath);

    try {
      const content = await this.readFile(resolvedPath, { encoding: 'buffer', cache: false });
      const hash = crypto.createHash(algorithm);
      hash.update(content);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to generate hash for ${filePath}: ${error.message}`);
    }
  }

  // Private cache methods
  private getCachedFile(filePath: string): { content: Buffer | string; timestamp: number; size: number } | null {
    const cached = FILE_CACHE.get(filePath);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > CACHE_CONFIG.ttl) {
      FILE_CACHE.delete(filePath);
      return null;
    }

    return cached;
  }

  private setCachedFile(filePath: string, content: Buffer | string): void {
    // Check cache limits
    if (FILE_CACHE.size >= CACHE_CONFIG.maxSize) {
      this.evictOldestCache();
    }

    // Check memory limit
    let size: number;
    if (Buffer.isBuffer(content)) {
      size = content.length;
    } else {
      size = Buffer.byteLength(content, 'utf8');
    }

    if (this.getCacheSize() + size > CACHE_CONFIG.maxMemory) {
      this.evictOldestCache();
    }

    FILE_CACHE.set(filePath, {
      content,
      timestamp: Date.now(),
      size
    });
  }

  private invalidateCachedFile(filePath: string): void {
    FILE_CACHE.delete(filePath);
  }

  private getCacheSize(): number {
    let total = 0;
    for (const item of FILE_CACHE.values()) {
      total += item.size;
    }
    return total;
  }

  private evictOldestCache(): void {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, value] of FILE_CACHE.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      FILE_CACHE.delete(oldestKey);
    }
  }

  private getSubdirectories(): string[] {
    const subdirs: string[] = [];
    const queue = [this.workspacePath];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const entries = fs.readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.temp') {
          const fullPath = path.join(current, entry.name);
          const relativePath = path.relative(this.workspacePath, fullPath);
          subdirs.push(relativePath);
          queue.push(fullPath);
        }
      }
    }

    return subdirs;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    readHits: number;
    cacheSize: number;
    cachedFiles: number;
  } {
    return {
      hits: STATS.hits,
      misses: STATS.misses,
      readHits: STATS.hits,
      cacheSize: this.getCacheSize(),
      cachedFiles: FILE_CACHE.size
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    FILE_CACHE.clear();
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.clearCache();
    if (fs.existsSync(this.tempDirectory)) {
      await fs.rm(this.tempDirectory, { recursive: true, force: true });
    }
  }
}

// Factory function
export function createWorkspaceManager(workspacePath: string): WorkspaceManager {
  return new WorkspaceManager(workspacePath);
}

// Convenience functions
export const createWM = createWorkspaceManager;