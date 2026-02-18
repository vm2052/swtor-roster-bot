const { Client } = require('pg');

async function createDatabase() {
    // Connect to default 'postgres' database
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres', // Change this to your PostgreSQL password
        database: 'postgres'
    });

    try {
        console.log('Connecting to PostgreSQL...');
        await client.connect();
        console.log('✅ Connected to PostgreSQL');
        
        // Check if database exists
        const checkDb = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'rosterdb'"
        );
        
        if (checkDb.rows.length === 0) {
            // Create the database
            await client.query('CREATE DATABASE rosterdb');
            console.log('✅ Database "rosterdb" created successfully!');
        } else {
            console.log('✅ Database "rosterdb" already exists');
        }
        
        await client.end();
    } catch (error) {
        console.error('❌ Connection failed. Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n📌 PostgreSQL is not running!');
            console.log('To start PostgreSQL:');
            console.log('1. Open "Services" (Win + R, type "services.msc")');
            console.log('2. Find "postgresql" service');
            console.log('3. Right-click and click "Start"');
        } else if (error.code === '28P01') {
            console.log('\n📌 Wrong password!');
            console.log('Update the password in this script to match your PostgreSQL installation');
        }
    }
}

createDatabase();