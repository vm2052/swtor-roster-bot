const sqlite3 = require('sqlite3').verbose();

class Database {
    constructor(dbPath = './roster.db') {
        this.db = new sqlite3.Database(dbPath);
        this.init();
    }

    init() {
        this.db.serialize(() => {
            this.db.run(`CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                emoji TEXT DEFAULT '📋',
                display_order INTEGER DEFAULT 0,
                message_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS ranks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                UNIQUE(branch_id, name)
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS sub_branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                UNIQUE(branch_id, name)
            )`);

            this.db.run(`CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                branch_id INTEGER NOT NULL,
                rank_id INTEGER NOT NULL,
                sub_branch_id INTEGER,
                name TEXT NOT NULL,
                alt TEXT,
                title TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
                FOREIGN KEY (rank_id) REFERENCES ranks(id) ON DELETE CASCADE,
                FOREIGN KEY (sub_branch_id) REFERENCES sub_branches(id) ON DELETE SET NULL
            )`);

            console.log('✅ Database initialized');
        });
    }

    // ========== BRANCH OPERATIONS ==========
    
    getAllBranches() {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM branches ORDER BY display_order, name`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getBranch(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM branches WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    getBranchByName(name) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM branches WHERE name = ?`, [name], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addBranch(name, emoji = '📋', displayOrder = 0) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO branches (name, emoji, display_order) VALUES (?, ?, ?)`,
                [name, emoji, displayOrder],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    updateBranch(id, { name, emoji, displayOrder }) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE branches SET name = ?, emoji = ?, display_order = ? WHERE id = ?`,
                [name, emoji, displayOrder, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    deleteBranch(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM branches WHERE id = ?`, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    updateBranchMessageId(branchId, messageId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE branches SET message_id = ? WHERE id = ?`,
                [messageId, branchId],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // ========== RANK OPERATIONS ==========

    getRanksByBranch(branchId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM ranks WHERE branch_id = ? ORDER BY display_order, name`,
                [branchId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    getRank(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT * FROM ranks WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    addRank(branchId, name, displayOrder = 0) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO ranks (branch_id, name, display_order) VALUES (?, ?, ?)`,
                [branchId, name, displayOrder],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    updateRank(id, { name, displayOrder }) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE ranks SET name = ?, display_order = ? WHERE id = ?`,
                [name, displayOrder, id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    deleteRank(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM ranks WHERE id = ?`, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // ========== SUB-BRANCH OPERATIONS ==========

    getSubBranchesByBranch(branchId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM sub_branches WHERE branch_id = ? ORDER BY display_order, name`,
                [branchId],
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    addSubBranch(branchId, name, displayOrder = 0) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO sub_branches (branch_id, name, display_order) VALUES (?, ?, ?)`,
                [branchId, name, displayOrder],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    deleteSubBranch(id) {
        return new Promise((resolve, reject) => {
            this.db.run(`DELETE FROM sub_branches WHERE id = ?`, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // ========== CHARACTER OPERATIONS ==========

    getCharactersByBranch(branchId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT 
                    c.*,
                    r.name as rank_name,
                    sb.name as sub_branch_name
                FROM characters c
                JOIN ranks r ON c.rank_id = r.id
                LEFT JOIN sub_branches sb ON c.sub_branch_id = sb.id
                WHERE c.branch_id = ?
                ORDER BY r.display_order, r.name, c.name
            `, [branchId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    getAllCharacters() {
        return new Promise((resolve, reject) => {
            this.db.all(`
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
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    addCharacter(branchId, rankId, name, alt = '', title = '', subBranchId = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO characters (branch_id, rank_id, sub_branch_id, name, alt, title) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [branchId, rankId, subBranchId, name, alt, title],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    removeCharacter(name) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM characters WHERE name = ?`,
                [name],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    removeCharacterById(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `DELETE FROM characters WHERE id = ?`,
                [id],
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // Get branch data for display
async getBranchForDisplay(branchId) {
    try {
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
    } catch (error) {
        console.error('Error in getBranchForDisplay:', error);
        return null;
    }
}

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = Database;