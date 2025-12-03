import Database from 'better-sqlite3';

export interface Asset {
  id?: number;
  name: string;
  description?: string;
  filePath: string;
  fileSize: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  folderId?: number;
  isDeleted?: boolean;
}

export interface WatchedFolder {
  id?: number;
  path: string;
  enabled: boolean;
  lastScanned?: string;
  assetCount?: number;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        filePath TEXT UNIQUE NOT NULL,
        fileSize INTEGER NOT NULL,
        tags TEXT,
        folderId INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        isDeleted INTEGER DEFAULT 0,
        FOREIGN KEY (folderId) REFERENCES watched_folders(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS thumbnails (
        assetId INTEGER PRIMARY KEY,
        data BLOB NOT NULL,
        FOREIGN KEY (assetId) REFERENCES assets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS watched_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        enabled INTEGER DEFAULT 1,
        lastScanned TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
      CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets(tags);
      CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(folderId);
    `);

    // Migration: Add isDeleted column if it doesn't exist (for existing databases)
    try {
      const columns = this.db.pragma('table_info(assets)') as Array<{ name: string }>;
      const hasIsDeleted = columns.some((col) => col.name === 'isDeleted');
      if (!hasIsDeleted) {
        this.db.exec('ALTER TABLE assets ADD COLUMN isDeleted INTEGER DEFAULT 0');
      }
    } catch (error) {
      // Column might already exist or table doesn't exist yet
    }

    // Create index for isDeleted (after migration ensures column exists)
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_assets_deleted ON assets(isDeleted)');
  }

  // Asset operations

  getAllAssets(): Asset[] {
    const stmt = this.db.prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM thumbnails t WHERE t.assetId = a.id) as hasThumbnail
      FROM assets a
      WHERE a.isDeleted = 0
      ORDER BY a.updatedAt DESC
    `);
    const rows = stmt.all();
    return rows.map(this.rowToAsset);
  }

  getAsset(id: number): Asset | null {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE id = ? AND isDeleted = 0');
    const row = stmt.get(id);
    return row ? this.rowToAsset(row) : null;
  }

  getAssetByPath(filePath: string): Asset | null {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE filePath = ? AND isDeleted = 0');
    const row = stmt.get(filePath);
    return row ? this.rowToAsset(row) : null;
  }

  searchAssets(query: string): Asset[] {
    const stmt = this.db.prepare(`
      SELECT * FROM assets
      WHERE (name LIKE ? OR description LIKE ? OR tags LIKE ?)
        AND isDeleted = 0
      ORDER BY updatedAt DESC
    `);
    const searchPattern = `%${query}%`;
    const rows = stmt.all(searchPattern, searchPattern, searchPattern);
    return rows.map(this.rowToAsset);
  }

  getAssetsByTag(tag: string): Asset[] {
    const stmt = this.db.prepare(`
      SELECT * FROM assets
      WHERE tags LIKE ? AND isDeleted = 0
      ORDER BY updatedAt DESC
    `);
    const rows = stmt.all(`%${tag}%`);
    return rows.map(this.rowToAsset);
  }

  getAssetsByFolder(folderId: number): Asset[] {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE folderId = ? AND isDeleted = 0 ORDER BY name');
    const rows = stmt.all(folderId);
    return rows.map(this.rowToAsset);
  }

  createAsset(asset: Asset): Asset {
    const stmt = this.db.prepare(`
      INSERT INTO assets (name, description, filePath, fileSize, tags, folderId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tagsJson = asset.tags ? JSON.stringify(asset.tags) : null;
    const result = stmt.run(
      asset.name,
      asset.description || null,
      asset.filePath,
      asset.fileSize,
      tagsJson,
      asset.folderId || null
    );

    return this.getAsset(result.lastInsertRowid as number)!;
  }

  updateAsset(id: number, data: Partial<Asset>): Asset | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(data.tags));
    }

    if (updates.length === 0) return this.getAsset(id);

    updates.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE assets SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.getAsset(id);
  }

  deleteAsset(id: number): boolean {
    const stmt = this.db.prepare('UPDATE assets SET isDeleted = 1 WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Permanently delete all assets (including soft-deleted ones) for a folder
   * Used during folder rescan to ensure clean state
   */
  hardDeleteAssetsForFolder(folderId: number): number {
    const stmt = this.db.prepare('DELETE FROM assets WHERE folderId = ?');
    const result = stmt.run(folderId);
    return result.changes;
  }

  getAllTags(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT tags FROM assets WHERE tags IS NOT NULL AND isDeleted = 0');
    const rows = stmt.all() as { tags: string }[];

    const tagSet = new Set<string>();
    rows.forEach(row => {
      if (row.tags) {
        const tags = JSON.parse(row.tags);
        tags.forEach((tag: string) => tagSet.add(tag));
      }
    });

    return Array.from(tagSet).sort();
  }

  // Thumbnail operations

  getThumbnail(assetId: number): Buffer | null {
    const stmt = this.db.prepare('SELECT data FROM thumbnails WHERE assetId = ?');
    const row = stmt.get(assetId) as { data: Buffer } | undefined;
    return row?.data || null;
  }

  saveThumbnail(assetId: number, data: Buffer): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO thumbnails (assetId, data) VALUES (?, ?)
    `);
    stmt.run(assetId, data);
  }

  deleteThumbnail(assetId: number): void {
    const stmt = this.db.prepare('DELETE FROM thumbnails WHERE assetId = ?');
    stmt.run(assetId);
  }

  clearAllThumbnails(): number {
    const stmt = this.db.prepare('DELETE FROM thumbnails');
    const result = stmt.run();
    return result.changes;
  }

  // Watched folder operations

  getWatchedFolders(): WatchedFolder[] {
    const stmt = this.db.prepare(`
      SELECT f.*, COUNT(CASE WHEN a.isDeleted = 0 THEN 1 END) as assetCount
      FROM watched_folders f
      LEFT JOIN assets a ON a.folderId = f.id
      GROUP BY f.id
      ORDER BY f.path
    `);
    const rows = stmt.all();
    return rows.map(this.rowToFolder);
  }

  getWatchedFolder(id: number): WatchedFolder | null {
    const stmt = this.db.prepare('SELECT * FROM watched_folders WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToFolder(row) : null;
  }

  getWatchedFolderByPath(folderPath: string): WatchedFolder | null {
    const stmt = this.db.prepare('SELECT * FROM watched_folders WHERE path = ?');
    const row = stmt.get(folderPath);
    return row ? this.rowToFolder(row) : null;
  }

  addWatchedFolder(folderPath: string): WatchedFolder {
    const stmt = this.db.prepare(`
      INSERT INTO watched_folders (path, enabled) VALUES (?, 1)
    `);
    const result = stmt.run(folderPath);
    return this.getWatchedFolder(result.lastInsertRowid as number)!;
  }

  updateWatchedFolder(id: number, data: Partial<WatchedFolder>): WatchedFolder | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.lastScanned !== undefined) {
      updates.push('lastScanned = ?');
      values.push(data.lastScanned);
    }

    if (updates.length === 0) return this.getWatchedFolder(id);

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE watched_folders SET ${updates.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);

    return this.getWatchedFolder(id);
  }

  removeWatchedFolder(id: number): boolean {
    // First, remove all assets from this folder
    const deleteAssets = this.db.prepare('DELETE FROM assets WHERE folderId = ?');
    deleteAssets.run(id);

    // Then remove the folder
    const stmt = this.db.prepare('DELETE FROM watched_folders WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  markFolderScanned(id: number): void {
    const stmt = this.db.prepare('UPDATE watched_folders SET lastScanned = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(id);
  }

  // Helper methods

  private rowToAsset(row: any): Asset {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      filePath: row.filePath,
      fileSize: row.fileSize,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      folderId: row.folderId,
      isDeleted: Boolean(row.isDeleted)
    };
  }

  private rowToFolder(row: any): WatchedFolder {
    return {
      id: row.id,
      path: row.path,
      enabled: Boolean(row.enabled),
      lastScanned: row.lastScanned,
      assetCount: row.assetCount || 0
    };
  }

  close(): void {
    this.db.close();
  }
}
