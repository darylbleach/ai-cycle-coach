// Simplified import script using direct database connection
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.supabase') });

// Import directory
const importDir = path.join(process.cwd(), 'data-export');
if (!fs.existsSync(importDir)) {
  console.error(`Import directory not found: ${importDir}`);
  process.exit(1);
}

// Connect to the database
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function importData() {
  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected successfully!');

    // Get all JSON files from the import directory
    const files = fs.readdirSync(importDir)
      .filter(file => file.endsWith('.json'));
    
    console.log(`Found ${files.length} JSON files to import`);

    // Get schema information and tables in Supabase
    console.log('Getting schema information from Supabase...');
    const tableQuery = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = tableQuery.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables in Supabase:`, tables);

    // Process each file
    for (const file of files) {
      const tableName = file.replace('.json', '').toLowerCase();
      console.log(`Processing file: ${file} for table: ${tableName}`);

      // Find matching table (case insensitive)
      const matchingTable = tables.find(t => t.toLowerCase() === tableName);
      
      if (!matchingTable) {
        console.warn(`No matching table found for ${file}, skipping...`);
        continue;
      }

      // Load data
      const data = JSON.parse(fs.readFileSync(path.join(importDir, file), 'utf8'));
      console.log(`Importing ${data.length} rows into ${matchingTable}...`);

      if (data.length === 0) {
        console.log(`No data to import for ${matchingTable}, skipping...`);
        continue;
      }

      // Get column information
      const columnQuery = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = $1 AND table_schema = 'public'
      `, [matchingTable]);
      
      const columns = columnQuery.rows.map(row => row.column_name);
      console.log(`Table ${matchingTable} has columns:`, columns);

      // Import data one row at a time
      for (const row of data) {
        try {
          // Build dynamic insert query based on available columns
          const availableColumns = Object.keys(row).filter(key => columns.includes(key));
          
          if (availableColumns.length === 0) {
            console.warn(`No matching columns found for row in ${matchingTable}, skipping...`);
            continue;
          }
          
          const columnNames = availableColumns.map(col => `"${col}"`).join(', ');
          const placeholders = availableColumns.map((_, i) => `$${i + 1}`).join(', ');
          const values = availableColumns.map(col => row[col]);
          
          // Generate update clause for ON CONFLICT
          const updateClauses = availableColumns
            .filter(col => col !== 'id') // Don't update primary key
            .map((col, i) => `"${col}" = $${i + 1}`)
            .join(', ');
          
          let query;
          if (matchingTable.toLowerCase() === 'account') {
            // For Account table use provider_providerAccountId as conflict key
            query = `
              INSERT INTO "${matchingTable}" (${columnNames})
              VALUES (${placeholders})
              ON CONFLICT (provider, "providerAccountId") 
              DO UPDATE SET ${updateClauses || 'id = EXCLUDED.id'}
            `;
          } else {
            // For other tables use id as conflict key
            query = `
              INSERT INTO "${matchingTable}" (${columnNames})
              VALUES (${placeholders})
              ON CONFLICT (id) 
              DO UPDATE SET ${updateClauses || 'id = EXCLUDED.id'}
            `;
          }
          
          await client.query(query, values);
        } catch (error) {
          console.error(`Error importing row into ${matchingTable}:`, error.message);
        }
      }
      
      console.log(`Data imported successfully for ${matchingTable}`);
    }

    console.log('Import completed successfully!');

  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    await client.end();
  }
}

importData(); 