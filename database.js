// database.js - PostgreSQL version with auto-creation
const { Pool, Client } = require('pg');

class Database {
    constructor() {
        this.pool = null;
       // this.init();
    }

     async initialize() {
        try {
            // First, ensure the database exists
            await this.ensureDatabaseExists();
            
            // Then initialize tables
            await this.initTables();
            
            console.log('✅ PostgreSQL database ready');
            return this;
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
    }

   async ensureDatabaseExists() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
        throw new Error('DATABASE_URL not found in .env file');
    }

    console.log('📦 DATABASE_URL:', connectionString.replace(/:[^:@]{1,100}@/, ':****@'));
    
    // Parse the connection string manually
    // Format: postgresql://username:password@host:port/database
    const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
    const matches = connectionString.match(regex);
    
    if (!matches) {
        console.error('Could not parse DATABASE_URL. Expected format: postgresql://user:pass@host:port/database');
        console.error('Got:', connectionString);
        throw new Error('Invalid DATABASE_URL format');
    }
    
    const [, user, password, host, port, database] = matches;
    
    console.log(`📦 Parsed connection: ${user}@${host}:${port}, database: ${database}`);
    
    // Connect to default 'postgres' database to check/create our database
    const client = new Client({
        host: host,
        port: parseInt(port),
        user: user,
        password: password,
        database: 'postgres'
    });

    try {
        console.log('📦 Connecting to default "postgres" database...');
        await client.connect();
        console.log('✅ Connected to PostgreSQL server');
        
        // Check if our target database exists
        const checkResult = await client.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [database]
        );
        
        if (checkResult.rows.length === 0) {
            console.log(`📦 Database "${database}" doesn't exist, creating it...`);
            await client.query(`CREATE DATABASE ${database}`);
            console.log(`✅ Database "${database}" created successfully`);
        } else {
            console.log(`✅ Database "${database}" already exists`);
        }
        
        await client.end();
        
        // Now create the main connection pool with our database
        console.log('📦 Creating main connection pool...');
        this.pool = new Pool({
            host: host,
            port: parseInt(port),
            user: user,
            password: password,
            database: database,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
        
        // Test the connection
        await this.pool.query('SELECT 1');
        console.log('✅ Successfully connected to target database');
        
    } catch (error) {
        console.error('❌ Error in ensureDatabaseExists:');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n📌 PostgreSQL is not running!');
            console.error('Start PostgreSQL:');
            console.error('1. Open "Services" (Win + R, type "services.msc")');
            console.error('2. Find "postgresql" service');
            console.error('3. Right-click and click "Start"');
        } else if (error.code === '28P01') {
            console.error('\n📌 Wrong password!');
            console.error('The password in DATABASE_URL is incorrect');
            console.error('Current password: ' + password.replace(/./g, '*'));
        }
        
        throw error;
    }
}

    getDatabaseNameFromUrl(url) {
    // Extract database name from URL
    // Format: postgresql://user:pass@host:port/database
    try {
        // Simple approach - split by '/' and take the last part
        const parts = url.split('/');
        const lastPart = parts[parts.length - 1];
        // Remove any query parameters
        const dbName = lastPart.split('?')[0];
        return dbName;
    } catch (error) {
        console.error('Error parsing database name:', error);
        return 'rosterdb';
    }
}

switchDatabase(url, newDbName) {
    // Replace the database name in the URL
    // Find the last '/' and replace everything after it
    try {
        const lastSlashIndex = url.lastIndexOf('/');
        if (lastSlashIndex === -1) return url;
        
        // Get everything before the last slash
        const baseUrl = url.substring(0, lastSlashIndex + 1);
        // Check if there are query parameters
        const hasQuery = url.includes('?');
        if (hasQuery) {
            const queryPart = url.substring(url.indexOf('?'));
            return baseUrl + newDbName + queryPart;
        }
        return baseUrl + newDbName;
    } catch (error) {
        console.error('Error switching database:', error);
        return url;
    }
}

    async initTables() {
        try {
            // Create branches table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS branches (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    emoji TEXT DEFAULT '📋',
                    display_order INTEGER DEFAULT 0,
                    message_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create ranks table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS ranks (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(branch_id, name)
                )
            `);

            // Create sub_branches table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS sub_branches (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(branch_id, name)
                )
            `);

            // Create characters table
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS characters (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    rank_id INTEGER NOT NULL REFERENCES ranks(id) ON DELETE CASCADE,
                    sub_branch_id INTEGER REFERENCES sub_branches(id) ON DELETE SET NULL,
                    name TEXT NOT NULL,
                    alt TEXT,
                    title TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('✅ All tables created/verified');
        } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
        }
    }

    // ========== BRANCH OPERATIONS ==========
    
    async getAllBranches() {
        const result = await this.pool.query(
            'SELECT * FROM branches ORDER BY display_order, name'
        );
        return result.rows;
    }

    async getBranch(id) {
        const result = await this.pool.query(
            'SELECT * FROM branches WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async getBranchByName(name) {
        const result = await this.pool.query(
            'SELECT * FROM branches WHERE name = $1',
            [name]
        );
        return result.rows[0];
    }

    async addBranch(name, emoji = '📋', displayOrder = 0) {
        const result = await this.pool.query(
            'INSERT INTO branches (name, emoji, display_order) VALUES ($1, $2, $3) RETURNING id',
            [name, emoji, displayOrder]
        );
        return result.rows[0].id;
    }

    async updateBranch(id, { name, emoji, displayOrder }) {
        await this.pool.query(
            'UPDATE branches SET name = $1, emoji = $2, display_order = $3 WHERE id = $4',
            [name, emoji, displayOrder, id]
        );
    }

    async deleteBranch(id) {
        await this.pool.query('DELETE FROM branches WHERE id = $1', [id]);
    }

    async updateBranchMessageId(branchId, messageId) {
        await this.pool.query(
            'UPDATE branches SET message_id = $1 WHERE id = $2',
            [messageId, branchId]
        );
    }

    // ========== RANK OPERATIONS ==========

    async getRanksByBranch(branchId) {
        const result = await this.pool.query(
            'SELECT * FROM ranks WHERE branch_id = $1 ORDER BY display_order, name',
            [branchId]
        );
        return result.rows;
    }

    async getRank(id) {
        const result = await this.pool.query(
            'SELECT * FROM ranks WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async addRank(branchId, name, displayOrder = 0) {
        const result = await this.pool.query(
            'INSERT INTO ranks (branch_id, name, display_order) VALUES ($1, $2, $3) RETURNING id',
            [branchId, name, displayOrder]
        );
        return result.rows[0].id;
    }

    async updateRank(id, { name, displayOrder }) {
        await this.pool.query(
            'UPDATE ranks SET name = $1, display_order = $2 WHERE id = $3',
            [name, displayOrder, id]
        );
    }

    async deleteRank(id) {
        await this.pool.query('DELETE FROM ranks WHERE id = $1', [id]);
    }

    // ========== SUB-BRANCH OPERATIONS ==========

    async getSubBranchesByBranch(branchId) {
        const result = await this.pool.query(
            'SELECT * FROM sub_branches WHERE branch_id = $1 ORDER BY display_order, name',
            [branchId]
        );
        return result.rows;
    }

    async addSubBranch(branchId, name, displayOrder = 0) {
        const result = await this.pool.query(
            'INSERT INTO sub_branches (branch_id, name, display_order) VALUES ($1, $2, $3) RETURNING id',
            [branchId, name, displayOrder]
        );
        return result.rows[0].id;
    }

    async deleteSubBranch(id) {
        await this.pool.query('DELETE FROM sub_branches WHERE id = $1', [id]);
    }

    // ========== CHARACTER OPERATIONS ==========

    async getCharactersByBranch(branchId) {
        const result = await this.pool.query(`
            SELECT 
                c.*,
                r.name as rank_name,
                sb.name as sub_branch_name
            FROM characters c
            JOIN ranks r ON c.rank_id = r.id
            LEFT JOIN sub_branches sb ON c.sub_branch_id = sb.id
            WHERE c.branch_id = $1
            ORDER BY 
                CASE WHEN sb.name IS NULL THEN 0 ELSE 1 END,
                sb.name,
                r.display_order,
                r.name,
                c.name
        `, [branchId]);
        return result.rows;
    }

    async getAllCharacters() {
        const result = await this.pool.query(`
            SELECT 
                c.*,
                b.name as branch_name,
                b.emoji as branch_emoji,
                r.name as rank_name,
                sb.name as sub_branch_name
            FROM characters c
            JOIN branches b ON c.branch_id = b.id
            JOIN ranks r ON c.rank_id = r.id
            LEFT JOIN sub_branches sb ON c.sub_branch_id = sb.id
            ORDER BY b.display_order, b.name, r.display_order, r.name, c.name
        `);
        return result.rows;
    }

    async addCharacter(branchId, rankId, name, alt = '', title = '', subBranchId = null) {
        const result = await this.pool.query(
            `INSERT INTO characters (branch_id, rank_id, sub_branch_id, name, alt, title) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [branchId, rankId, subBranchId, name, alt, title]
        );
        return result.rows[0].id;
    }

    async removeCharacter(name) {
        const result = await this.pool.query(
            'DELETE FROM characters WHERE name = $1',
            [name]
        );
        return result.rowCount;
    }

    async removeCharacterById(id) {
        const result = await this.pool.query(
            'DELETE FROM characters WHERE id = $1',
            [id]
        );
        return result.rowCount;
    }

    async getBranchForDisplay(branchId) {
        const branch = await this.getBranch(branchId);
        if (!branch) return null;
        
        const characters = await this.getCharactersByBranch(branchId);
        
        // Special handling for specific branches
        if (branch.name === 'IMPERIAL NAVY') {
            // Navy: Separate Talon Squadron from regular members
            const regularMembers = [];
            const talonMembers = [];
            
            characters.forEach(char => {
                if (char.sub_branch_name === 'Talon Squadron') {
                    talonMembers.push(char);
                } else {
                    regularMembers.push(char);
                }
            });
            
            // Group regular members by rank
            const byRank = {};
            regularMembers.forEach(char => {
                if (!byRank[char.rank_name]) {
                    byRank[char.rank_name] = [];
                }
                
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - ${char.title}`;
                
                byRank[char.rank_name].push(displayText);
            });
            
            // Group Talon members by rank
            const talonByRank = {};
            talonMembers.forEach(char => {
                if (!talonByRank[char.rank_name]) {
                    talonByRank[char.rank_name] = [];
                }
                
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - ${char.title}`;
                
                talonByRank[char.rank_name].push(displayText);
            });

            return {
                ...branch,
                type: 'navy',
                byRank: byRank,
                specialSection: {
                    name: 'Talon Squadron',
                    byRank: talonByRank
                }
            };
        }
        else {
            // For all other branches: Group by sub-branch first, then by rank
            const bySubBranch = {};
            
            characters.forEach(char => {
                const subKey = char.sub_branch_name || 'MAIN';
                
                if (!bySubBranch[subKey]) {
                    bySubBranch[subKey] = {
                        name: char.sub_branch_name,
                        byRank: {}
                    };
                }
                
                // Group by rank within this sub-branch
                if (!bySubBranch[subKey].byRank[char.rank_name]) {
                    bySubBranch[subKey].byRank[char.rank_name] = [];
                }
                
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - ${char.title}`;
                
                bySubBranch[subKey].byRank[char.rank_name].push(displayText);
            });

            return {
                ...branch,
                type: 'standard',
                bySubBranch: bySubBranch
            };
        }
    }

    async clearAllData() {
        await this.pool.query('DELETE FROM characters');
        await this.pool.query('DELETE FROM ranks');
        await this.pool.query('DELETE FROM sub_branches');
        await this.pool.query('DELETE FROM branches');
        console.log('✅ All data cleared');
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

module.exports = Database;