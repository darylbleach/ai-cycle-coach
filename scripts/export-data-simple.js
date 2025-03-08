// Simplified export script using direct database connection
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Create export directory
const exportDir = path.join(process.cwd(), 'data-export');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

// Connect to the database
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function exportData() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Get schema information and tables
    console.log('Getting schema information...');
    const tableQuery = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = tableQuery.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables:`, tables);

    // Export each table
    for (const table of tables) {
      console.log(`Exporting table: ${table}...`);
      try {
        const result = await client.query(`SELECT * FROM "${table}"`);
        
        fs.writeFileSync(
          path.join(exportDir, `${table.toLowerCase()}.json`),
          JSON.stringify(result.rows, null, 2)
        );
        
        console.log(`Exported ${result.rows.length} rows from ${table}`);
      } catch (error) {
        console.error(`Error exporting table ${table}:`, error.message);
      }
    }

    console.log('Export completed successfully!');
    console.log(`All data exported to: ${exportDir}`);

  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    await client.end();
  }
}

exportData(); 