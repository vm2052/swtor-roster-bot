const { neon } = require('@neondatabase/serverless');

class Database {
    constructor() {
        this.sql = null;
        this.connectionString = process.env.DATABASE_URL;
        this.retryCount = 0;
        this.maxRetries = 5;
        
        if (!this.connectionString) {
            throw new Error('DATABASE_URL not found in .env file');
        }
    }

    async getSql() {
        if (!this.sql) {
            console.log('📦 Creating new database connection...');
            
            // Create a new connection with better options
            this.sql = neon(this.connectionString, {
                fetchOptions: {
                    timeout: 30000, // 30 second timeout
                    keepalive: true,
                },
                maxRetries: 3,
                retryInterval: 2000,
                // Don't keep connection open
                pool: false,
            });
            
            // Test the connection with retry
            let connected = false;
            let attempts = 0;
            
            while (!connected && attempts < 3) {
                try {
                    await this.sql`SELECT 1`;
                    connected = true;
                    console.log('✅ Database connection established');
                    this.retryCount = 0; // Reset retry count on success
                } catch (error) {
                    attempts++;
                    console.log(`⏳ Connection attempt ${attempts} failed:`, error.message);
                    
                    if (attempts >= 3) {
                        this.sql = null;
                        throw new Error(`Failed to connect after ${attempts} attempts`);
                    }
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        return this.sql;
    }

    async executeWithRetry(operation) {
        let lastError;
        
        for (let i = 0; i < 3; i++) {
            try {
                const sql = await this.getSql();
                return await operation(sql);
            } catch (error) {
                lastError = error;
                console.log(`⚠️ Database operation failed (attempt ${i + 1}/3):`, error.message);
                
                // Reset connection on error
                this.sql = null;
                
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
        
        throw lastError;
    }

    async initialize() {
        try {
            await this.ensureDatabaseExists();
            await this.initTables();
            console.log('✅ Database ready for operations');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    async ensureDatabaseExists() {
        try {
            const sql = await this.getSql();
            await sql`SELECT 1`;
            console.log('✅ Connected to Neon database');
        } catch (error) {
            console.error('❌ Failed to connect to Neon:', error.message);
            throw error;
        }
    }

    async initTables() {
        return this.executeWithRetry(async (sql) => {
            // Create branches table
            await sql`
                CREATE TABLE IF NOT EXISTS branches (
                    id SERIAL PRIMARY KEY,
                    name TEXT UNIQUE NOT NULL,
                    emoji TEXT DEFAULT '📋',
                    display_order INTEGER DEFAULT 0,
                    message_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            // Create ranks table
            await sql`
                CREATE TABLE IF NOT EXISTS ranks (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(branch_id, name)
                )
            `;

            // Create sub_branches table
            await sql`
                CREATE TABLE IF NOT EXISTS sub_branches (
                    id SERIAL PRIMARY KEY,
                    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    display_order INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(branch_id, name)
                )
            `;

            // Create characters table
            await sql`
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
            `;

            console.log('✅ Tables created/verified');
        });
    }

    // ========== BRANCH OPERATIONS ==========
    
    async getAllBranches() {
        return this.executeWithRetry(async (sql) => {
            return await sql`SELECT * FROM branches ORDER BY display_order, name`;
        });
    }

    async getBranch(id) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`SELECT * FROM branches WHERE id = ${id}`;
            return result[0];
        });
    }

    async addBranch(name, emoji = '📋', displayOrder = 0) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`
                INSERT INTO branches (name, emoji, display_order) 
                VALUES (${name}, ${emoji}, ${displayOrder}) 
                RETURNING id
            `;
            return result[0].id;
        });
    }

    async getRanksByBranch(branchId) {
        return this.executeWithRetry(async (sql) => {
            return await sql`
                SELECT * FROM ranks 
                WHERE branch_id = ${branchId} 
                ORDER BY display_order, name
            `;
        });
    }

    async addRank(branchId, name, displayOrder = 0) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`
                INSERT INTO ranks (branch_id, name, display_order) 
                VALUES (${branchId}, ${name}, ${displayOrder}) 
                RETURNING id
            `;
            return result[0].id;
        });
    }

    async getSubBranchesByBranch(branchId) {
        return this.executeWithRetry(async (sql) => {
            return await sql`
                SELECT * FROM sub_branches 
                WHERE branch_id = ${branchId} 
                ORDER BY display_order, name
            `;
        });
    }

    async addSubBranch(branchId, name, displayOrder = 0) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`
                INSERT INTO sub_branches (branch_id, name, display_order) 
                VALUES (${branchId}, ${name}, ${displayOrder}) 
                RETURNING id
            `;
            return result[0].id;
        });
    }

    async getCharactersByBranch(branchId) {
        return this.executeWithRetry(async (sql) => {
            return await sql`
                SELECT 
                    c.*,
                    r.name as rank_name,
                    sb.name as sub_branch_name
                FROM characters c
                JOIN ranks r ON c.rank_id = r.id
                LEFT JOIN sub_branches sb ON c.sub_branch_id = sb.id
                WHERE c.branch_id = ${branchId}
                ORDER BY 
                    CASE WHEN sb.name IS NULL THEN 0 ELSE 1 END,
                    sb.name,
                    r.display_order,
                    r.name,
                    c.name
            `;
        });
    }

    async getAllCharacters() {
        return this.executeWithRetry(async (sql) => {
            return await sql`
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
            `;
        });
    }

    async addCharacter(branchId, rankId, name, alt = '', title = '', subBranchId = null) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`
                INSERT INTO characters (branch_id, rank_id, sub_branch_id, name, alt, title) 
                VALUES (${branchId}, ${rankId}, ${subBranchId}, ${name}, ${alt}, ${title}) 
                RETURNING id
            `;
            return result[0].id;
        });
    }

    async removeCharacter(name) {
    return this.executeWithRetry(async (sql) => {
        try {
            // First, check if the character exists and get its ID
            const check = await sql`SELECT id, name FROM characters WHERE name = ${name}`;
            
            if (check.length === 0) {
                console.log(`Character "${name}" not found in database`);
                return 0;
            }
            
            console.log(`Found character: ${check[0].name} with ID: ${check[0].id}, attempting to delete...`);
            
            // Delete the character
            const result = await sql`DELETE FROM characters WHERE name = ${name}`;
            
            console.log(`Delete result type:`, typeof result);
            console.log(`Delete result value:`, result);
            console.log(`Delete result length:`, result?.length);
            console.log(`Delete result count:`, result?.count);
            
            // Handle different return types from Neon
            if (result === null || result === undefined) {
                console.log('Result is null/undefined, checking if character was actually deleted...');
                // Verify deletion by trying to find it again
                const verify = await sql`SELECT id FROM characters WHERE name = ${name}`;
                return verify.length === 0 ? 1 : 0;
            }
            
            // If result is an array (empty or otherwise)
            if (Array.isArray(result)) {
                console.log('Result is an array');
                // For DELETE operations, an empty array usually means success
                // But let's verify by checking if the character still exists
                const verify = await sql`SELECT id FROM characters WHERE name = ${name}`;
                const deleted = verify.length === 0;
                console.log(`Verification - character still exists: ${!deleted}`);
                return deleted ? 1 : 0;
            }
            
            // If result is an object with count or rowCount
            if (result && typeof result === 'object') {
                if (result.count !== undefined) {
                    console.log(`Result has count: ${result.count}`);
                    return result.count;
                }
                if (result.rowCount !== undefined) {
                    console.log(`Result has rowCount: ${result.rowCount}`);
                    return result.rowCount;
                }
            }
            
            // If result is a number
            if (typeof result === 'number') {
                console.log(`Result is a number: ${result}`);
                return result;
            }
            
            // Default: check if character still exists
            console.log('Unknown result format, verifying deletion...');
            const verify = await sql`SELECT id FROM characters WHERE name = ${name}`;
            return verify.length === 0 ? 1 : 0;
            
        } catch (error) {
            console.error('Error in removeCharacter:', error);
            throw error;
        }
    });
}
    async updateBranch(id, { name, emoji, displayOrder }) {
        return this.executeWithRetry(async (sql) => {
            await sql`
                UPDATE branches 
                SET name = ${name}, 
                    emoji = ${emoji}, 
                    display_order = ${displayOrder !== undefined ? displayOrder : 0}
                WHERE id = ${id}
            `;
        });
    }
    async updateBranchMessageId(branchId, messageId) {
        return this.executeWithRetry(async (sql) => {
            await sql`
                UPDATE branches 
                SET message_id = ${messageId} 
                WHERE id = ${branchId}
            `;
        });
    }

    async getRank(id) {
        return this.executeWithRetry(async (sql) => {
            const result = await sql`SELECT * FROM ranks WHERE id = ${id}`;
            return result[0];
        });
    }

    async updateRank(id, { name, displayOrder }) {
        return this.executeWithRetry(async (sql) => {
            await sql`
                UPDATE ranks 
                SET name = ${name}, display_order = ${displayOrder} 
                WHERE id = ${id}
            `;
        });
    }

    async deleteRank(id) {
        return this.executeWithRetry(async (sql) => {
            await sql`DELETE FROM ranks WHERE id = ${id}`;
        });
    }
    async deleteBranch(id) {
    return this.executeWithRetry(async (sql) => {
 
        await sql`DELETE FROM characters WHERE branch_id = ${id}`;
        
 
        await sql`DELETE FROM branches WHERE id = ${id}`;
        
        console.log(`✅ Deleted branch ID: ${id}`);
    });
}
    async deleteSubBranch(id) {
        return this.executeWithRetry(async (sql) => {
            await sql`DELETE FROM sub_branches WHERE id = ${id}`;
        });
    }

    async getBranchForDisplay(branchId) {
        const branch = await this.getBranch(branchId);
        if (!branch) return null;
        
        const characters = await this.getCharactersByBranch(branchId);
        
        // Special handling for specific branches
        if (branch.name === 'IMPERIAL NAVY') {
            const regularMembers = [];
            const talonMembers = [];
            
            characters.forEach(char => {
                if (char.sub_branch_name === 'Talon Squadron') {
                    talonMembers.push(char);
                } else {
                    regularMembers.push(char);
                }
            });
            
            const byRank = {};
            regularMembers.forEach(char => {
                if (!byRank[char.rank_name]) byRank[char.rank_name] = [];
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - *${char.title}*`;
                byRank[char.rank_name].push(displayText);
            });
            
            const talonByRank = {};
            talonMembers.forEach(char => {
                if (!talonByRank[char.rank_name]) talonByRank[char.rank_name] = [];
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - *${char.title}*`;
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
        } else {
            const bySubBranch = {};
            
            characters.forEach(char => {
                const subKey = char.sub_branch_name || 'MAIN';
                if (!bySubBranch[subKey]) {
                    bySubBranch[subKey] = {
                        name: char.sub_branch_name,
                        byRank: {}
                    };
                }
                if (!bySubBranch[subKey].byRank[char.rank_name]) {
                    bySubBranch[subKey].byRank[char.rank_name] = [];
                }
                let displayText = `• ${char.name}`;
                if (char.alt) displayText += ` (${char.alt})`;
                if (char.title) displayText += ` - *${char.title}*`;
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
        return this.executeWithRetry(async (sql) => {
            await sql`DELETE FROM characters`;
            await sql`DELETE FROM ranks`;
            await sql`DELETE FROM sub_branches`;
            await sql`DELETE FROM branches`;
            console.log('✅ All data cleared');
        });
    }

    async close() {
        this.sql = null;
        console.log('✅ Database connection closed');
    }
}

module.exports = Database;