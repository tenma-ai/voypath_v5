const { createClient } = require('@supabase/supabase-js')

// Test business metrics functionality
async function testBusinessMetrics() {
  console.log('🔄 Testing Business Metrics System...')
  
  // Initialize Supabase client (use environment variables in real implementation)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'your-supabase-url',
    process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'
  )

  // Test data
  const testMetrics = [
    {
      event_type: 'feature_usage',
      feature_name: 'trip_planning',
      metric_name: 'create_trip',
      metric_value: 1,
      metadata: { source: 'test', timestamp: new Date().toISOString() }
    },
    {
      event_type: 'user_engagement',
      feature_name: 'engagement',
      metric_name: 'session_duration',
      metric_value: 300000, // 5 minutes in ms
      metadata: { test_session: true }
    },
    {
      event_type: 'conversion',
      feature_name: 'business',
      metric_name: 'premium_signup',
      metric_value: 1,
      metadata: { plan: 'monthly', test: true }
    },
    {
      event_type: 'time_tracking',
      feature_name: 'place_search',
      metric_name: 'time_spent',
      metric_value: 45000, // 45 seconds
      metadata: { search_query: 'restaurant', test: true }
    }
  ]

  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  }

  try {
    // Test 1: Check if business_metrics table exists
    console.log('\n📋 Test 1: Checking business_metrics table...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('*')
        .limit(1)
      
      if (error && error.code === '42P01') {
        console.log('❌ business_metrics table does not exist')
        testResults.tests.push({
          name: 'Table Existence',
          status: 'failed',
          error: 'business_metrics table not found'
        })
        testResults.failed++
      } else {
        console.log('✅ business_metrics table exists')
        testResults.tests.push({
          name: 'Table Existence',
          status: 'passed'
        })
        testResults.passed++
      }
    } catch (tableError) {
      console.log('❌ Error checking table:', tableError.message)
      testResults.tests.push({
        name: 'Table Existence',
        status: 'failed',
        error: tableError.message
      })
      testResults.failed++
    }

    // Test 2: Insert test metrics
    console.log('\n📝 Test 2: Inserting test metrics...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .insert(testMetrics)
        .select()

      if (error) {
        console.log('❌ Failed to insert metrics:', error.message)
        testResults.tests.push({
          name: 'Metric Insertion',
          status: 'failed',
          error: error.message
        })
        testResults.failed++
      } else {
        console.log(`✅ Successfully inserted ${data.length} metrics`)
        testResults.tests.push({
          name: 'Metric Insertion',
          status: 'passed',
          data: `Inserted ${data.length} metrics`
        })
        testResults.passed++
      }
    } catch (insertError) {
      console.log('❌ Error inserting metrics:', insertError.message)
      testResults.tests.push({
        name: 'Metric Insertion',
        status: 'failed',
        error: insertError.message
      })
      testResults.failed++
    }

    // Test 3: Query feature usage metrics
    console.log('\n📊 Test 3: Querying feature usage metrics...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('feature_name, metric_name, metric_value')
        .eq('event_type', 'feature_usage')

      if (error) {
        console.log('❌ Failed to query feature usage:', error.message)
        testResults.tests.push({
          name: 'Feature Usage Query',
          status: 'failed',
          error: error.message
        })
        testResults.failed++
      } else {
        console.log(`✅ Retrieved ${data.length} feature usage metrics`)
        testResults.tests.push({
          name: 'Feature Usage Query',
          status: 'passed',
          data: `Retrieved ${data.length} metrics`
        })
        testResults.passed++
      }
    } catch (queryError) {
      console.log('❌ Error querying metrics:', queryError.message)
      testResults.tests.push({
        name: 'Feature Usage Query',
        status: 'failed',
        error: queryError.message
      })
      testResults.failed++
    }

    // Test 4: Query engagement metrics
    console.log('\n👥 Test 4: Querying engagement metrics...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('metric_name, metric_value, metadata')
        .eq('event_type', 'user_engagement')

      if (error) {
        console.log('❌ Failed to query engagement metrics:', error.message)
        testResults.tests.push({
          name: 'Engagement Query',
          status: 'failed',
          error: error.message
        })
        testResults.failed++
      } else {
        console.log(`✅ Retrieved ${data.length} engagement metrics`)
        testResults.tests.push({
          name: 'Engagement Query',
          status: 'passed',
          data: `Retrieved ${data.length} metrics`
        })
        testResults.passed++
      }
    } catch (engagementError) {
      console.log('❌ Error querying engagement:', engagementError.message)
      testResults.tests.push({
        name: 'Engagement Query',
        status: 'failed',
        error: engagementError.message
      })
      testResults.failed++
    }

    // Test 5: Query conversion metrics
    console.log('\n💰 Test 5: Querying conversion metrics...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('metric_name, metric_value, metadata')
        .eq('event_type', 'conversion')

      if (error) {
        console.log('❌ Failed to query conversion metrics:', error.message)
        testResults.tests.push({
          name: 'Conversion Query',
          status: 'failed',
          error: error.message
        })
        testResults.failed++
      } else {
        console.log(`✅ Retrieved ${data.length} conversion metrics`)
        testResults.tests.push({
          name: 'Conversion Query',
          status: 'passed',
          data: `Retrieved ${data.length} metrics`
        })
        testResults.passed++
      }
    } catch (conversionError) {
      console.log('❌ Error querying conversions:', conversionError.message)
      testResults.tests.push({
        name: 'Conversion Query',
        status: 'failed',
        error: conversionError.message
      })
      testResults.failed++
    }

    // Test 6: Aggregation query test
    console.log('\n📈 Test 6: Testing metric aggregation...')
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('event_type, feature_name, metric_value')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours

      if (error) {
        console.log('❌ Failed to query for aggregation:', error.message)
        testResults.tests.push({
          name: 'Aggregation Query',
          status: 'failed',
          error: error.message
        })
        testResults.failed++
      } else {
        // Simulate aggregation
        const aggregated = data.reduce((acc, metric) => {
          const key = `${metric.event_type}_${metric.feature_name}`
          acc[key] = (acc[key] || 0) + metric.metric_value
          return acc
        }, {})

        console.log(`✅ Aggregated ${Object.keys(aggregated).length} metric types`)
        testResults.tests.push({
          name: 'Aggregation Query',
          status: 'passed',
          data: `Aggregated ${Object.keys(aggregated).length} types`
        })
        testResults.passed++
      }
    } catch (aggregationError) {
      console.log('❌ Error in aggregation test:', aggregationError.message)
      testResults.tests.push({
        name: 'Aggregation Query',
        status: 'failed',
        error: aggregationError.message
      })
      testResults.failed++
    }

    // Test 7: Cleanup test data
    console.log('\n🧹 Test 7: Cleaning up test data...')
    try {
      const { error } = await supabase
        .from('business_metrics')
        .delete()
        .contains('metadata', { test: true })

      if (error) {
        console.log('⚠️ Could not clean up test data:', error.message)
        testResults.tests.push({
          name: 'Test Cleanup',
          status: 'warning',
          error: error.message
        })
      } else {
        console.log('✅ Test data cleaned up successfully')
        testResults.tests.push({
          name: 'Test Cleanup',
          status: 'passed'
        })
        testResults.passed++
      }
    } catch (cleanupError) {
      console.log('⚠️ Error cleaning up:', cleanupError.message)
      testResults.tests.push({
        name: 'Test Cleanup',
        status: 'warning',
        error: cleanupError.message
      })
    }

  } catch (error) {
    console.error('💥 Critical error during testing:', error)
    testResults.tests.push({
      name: 'Critical Error',
      status: 'failed',
      error: error.message
    })
    testResults.failed++
  }

  // Print final results
  console.log('\n' + '='.repeat(50))
  console.log('📊 BUSINESS METRICS TEST RESULTS')
  console.log('='.repeat(50))
  console.log(`✅ Passed: ${testResults.passed}`)
  console.log(`❌ Failed: ${testResults.failed}`)
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`)
  console.log('')

  testResults.tests.forEach((test, index) => {
    const statusIcon = test.status === 'passed' ? '✅' : 
                      test.status === 'failed' ? '❌' : '⚠️'
    console.log(`${index + 1}. ${statusIcon} ${test.name}`)
    if (test.error) {
      console.log(`   Error: ${test.error}`)
    }
    if (test.data) {
      console.log(`   Result: ${test.data}`)
    }
  })

  console.log('\n' + '='.repeat(50))
  
  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! Business metrics system is working correctly.')
    return true
  } else {
    console.log('⚠️ Some tests failed. Please check the database schema and configuration.')
    return false
  }
}

// Additional function to check database schema
async function checkDatabaseSchema() {
  console.log('\n🔍 Checking Database Schema Requirements...')
  
  const requiredSchema = {
    table_name: 'business_metrics',
    columns: [
      { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      { name: 'user_id', type: 'uuid', nullable: true },
      { name: 'session_id', type: 'text', nullable: true },
      { name: 'event_type', type: 'text', nullable: false },
      { name: 'feature_name', type: 'text', nullable: false },
      { name: 'metric_name', type: 'text', nullable: false },
      { name: 'metric_value', type: 'numeric', nullable: false },
      { name: 'metadata', type: 'jsonb', nullable: true },
      { name: 'timestamp', type: 'timestamptz', nullable: false, default: 'now()' },
      { name: 'created_at', type: 'timestamptz', nullable: false, default: 'now()' }
    ]
  }

  console.log('\n📋 Required Schema for business_metrics table:')
  console.log(JSON.stringify(requiredSchema, null, 2))
  
  console.log('\n📝 SQL to create the table (if needed):')
  console.log(`
CREATE TABLE IF NOT EXISTS business_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_business_metrics_user_id ON business_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_event_type ON business_metrics(event_type);
CREATE INDEX IF NOT EXISTS idx_business_metrics_feature_name ON business_metrics(feature_name);
CREATE INDEX IF NOT EXISTS idx_business_metrics_timestamp ON business_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_business_metrics_session_id ON business_metrics(session_id);

-- Enable RLS
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies (basic examples - adjust based on your security requirements)
CREATE POLICY "Users can view their own metrics" ON business_metrics
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own metrics" ON business_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  `)
}

// Run the tests
if (require.main === module) {
  testBusinessMetrics()
    .then(success => {
      if (!success) {
        checkDatabaseSchema()
      }
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Test execution failed:', error)
      process.exit(1)
    })
}

module.exports = { testBusinessMetrics, checkDatabaseSchema }