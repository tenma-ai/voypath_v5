// Quick test to check if server is running and accessible
const { spawn } = require('child_process');

console.log('🧪 Testing My Places functionality...');

// Check if server is responding
const testUrl = 'http://localhost:3010';

async function testServer() {
  try {
    // Use curl to test server response
    const curlProcess = spawn('curl', ['-I', testUrl], { stdio: 'pipe' });
    
    curlProcess.stdout.on('data', (data) => {
      console.log('✅ Server responding:', data.toString().split('\n')[0]);
    });
    
    curlProcess.stderr.on('data', (data) => {
      console.log('❌ Server error:', data.toString());
    });
    
    curlProcess.on('close', (code) => {
      if (code === 0) {
        console.log('🎉 Server is accessible on', testUrl);
        console.log('');
        console.log('🧪 Test manually by:');
        console.log('1. Go to', testUrl);
        console.log('2. Create a trip');
        console.log('3. Navigate to My Places');
        console.log('4. Add a place and verify automation');
      } else {
        console.log('❌ Server not accessible');
      }
    });
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testServer();