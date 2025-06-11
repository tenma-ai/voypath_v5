// Check actual Supabase database schema
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lb2VnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking actual Supabase database schema...\n');

  // Get all tables in the public schema
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (tablesError) {
    console.error('❌ Error fetching tables:', tablesError);
    
    // Try alternative approach - check what tables we can access
    console.log('\n🔄 Trying alternative approach - checking accessible tables...\n');
    
    const testTables = ['users', 'trips', 'places', 'trip_members', 'messages', 'optimization_results', 'member_colors'];
    
    for (const tableName of testTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table "${tableName}": NOT FOUND or NO ACCESS`);
          console.log(`   Error: ${error.message}\n`);
        } else {
          console.log(`✅ Table "${tableName}": EXISTS`);
          if (data && data.length > 0) {
            console.log(`   Sample columns:`, Object.keys(data[0]));
          } else {
            console.log(`   Table exists but is empty`);
          }
          console.log('');
        }
      } catch (err) {
        console.log(`❌ Table "${tableName}": ERROR - ${err.message}\n`);
      }
    }
    return;
  }

  console.log('📋 Available tables in public schema:');
  console.log(tables?.map(t => `  - ${t.table_name}`).join('\n'));
  console.log('');

  // Check specific table structures
  const tablesToCheck = ['users', 'trips', 'places', 'trip_members'];
  
  for (const tableName of tablesToCheck) {
    console.log(`\n🔍 Checking table: ${tableName}`);
    console.log('='.repeat(50));
    
    try {
      // Get column information
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);

      if (columnsError) {
        console.log(`❌ Could not fetch column info: ${columnsError.message}`);
        
        // Try to get sample data to see structure
        const { data: sampleData, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (sampleError) {
          console.log(`❌ Could not fetch sample data: ${sampleError.message}`);
        } else {
          console.log(`✅ Sample structure from data:`, sampleData && sampleData.length > 0 ? Object.keys(sampleData[0]) : 'Empty table');
        }
      } else {
        console.log('📋 Columns:');
        columns?.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'}`);
        });
      }
      
    } catch (err) {
      console.log(`❌ Error checking table ${tableName}: ${err.message}`);
    }
  }
}

// Run the check
checkDatabaseSchema().catch(console.error); 