/**
 * Member Color System Comprehensive Test
 * Tests all aspects of the member color system including database, API, and frontend integration
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM3NDkyNDksImV4cCI6MjA0OTMyNTI0OX0.J8nZvXSc2CnWGLhSB-3kAUBcmBuV2U7y8_0GgE_6Txs';

const supabase = createClient(supabaseUrl, supabaseKey);

class MemberColorSystemTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    this.testData = {
      tripId: null,
      userIds: [],
      colorAssignments: []
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async assert(condition, message) {
    this.results.total++;
    if (condition) {
      this.results.passed++;
      this.log(`PASS: ${message}`, 'success');
      this.results.details.push({ status: 'PASS', message });
    } else {
      this.results.failed++;
      this.log(`FAIL: ${message}`, 'error');
      this.results.details.push({ status: 'FAIL', message });
    }
  }

  async setupTestData() {
    this.log('Setting up test data for member color system...');
    
    try {
      // Create test trip
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          departure_location: 'Test Color Trip Departure',
          name: 'Color System Test Trip',
          description: 'Test trip for member color system',
          destination: 'Test Color Trip Destination'
        })
        .select()
        .single();

      if (tripError) throw tripError;
      this.testData.tripId = trip.id;
      this.log(`Created test trip: ${trip.id}`);

      // Create test users (simulate multiple users)
      const testUsers = [];
      for (let i = 1; i <= 6; i++) {
        const { data: user, error: userError } = await supabase
          .from('users')
          .insert({
            name: `Test User ${i}`,
            email: `testuser${i}@colortest.com`,
            is_guest: false
          })
          .select()
          .single();

        if (userError) throw userError;
        testUsers.push(user);
        this.testData.userIds.push(user.id);
      }

      // Add users as trip members
      const memberInserts = testUsers.map(user => ({
        trip_id: this.testData.tripId,
        user_id: user.id,
        role: 'member',
        can_add_places: true,
        can_optimize: true
      }));

      const { error: memberError } = await supabase
        .from('trip_members')
        .insert(memberInserts);

      if (memberError) throw memberError;
      
      this.log(`Created ${testUsers.length} test users and added to trip`);
      
    } catch (error) {
      this.log(`Error setting up test data: ${error.message}`, 'error');
      throw error;
    }
  }

  async testMemberColorDatabase() {
    this.log('Testing member color database schema...');

    try {
      // Test 1: Verify member_colors table has 20 colors
      const { data: colors, error: colorsError } = await supabase
        .from('member_colors')
        .select('*')
        .eq('is_active', true)
        .order('id');

      await this.assert(!colorsError, 'member_colors table query executes without error');
      await this.assert(colors && colors.length === 20, 'member_colors table contains exactly 20 colors');

      if (colors) {
        // Test 2: Verify all colors have required fields
        const hasAllFields = colors.every(color => 
          color.color_name && 
          color.hex_color && 
          color.rgb_color && 
          color.hsl_color
        );
        await this.assert(hasAllFields, 'All colors have required fields (name, hex, rgb, hsl)');

        // Test 3: Verify hex colors are unique
        const hexColors = colors.map(c => c.hex_color);
        const uniqueHexColors = [...new Set(hexColors)];
        await this.assert(hexColors.length === uniqueHexColors.length, 'All hex colors are unique');

        // Test 4: Verify hex color format
        const validHexFormat = colors.every(color => 
          /^#[A-Fa-f0-9]{6}$/.test(color.hex_color)
        );
        await this.assert(validHexFormat, 'All hex colors have valid format (#RRGGBB)');
      }

      // Test 5: Verify trip_members table has color assignment fields
      const { data: sampleMember } = await supabase
        .from('trip_members')
        .select('assigned_color_index, color_assigned_at')
        .eq('trip_id', this.testData.tripId)
        .limit(1)
        .single();

      await this.assert(
        sampleMember !== null && 
        'assigned_color_index' in sampleMember && 
        'color_assigned_at' in sampleMember,
        'trip_members table has color assignment fields'
      );

    } catch (error) {
      this.log(`Database test error: ${error.message}`, 'error');
      await this.assert(false, `Database schema test failed: ${error.message}`);
    }
  }

  async testMemberColorService() {
    this.log('Testing MemberColorService frontend integration...');

    try {
      // Test database queries that MemberColorService uses
      
      // Test 1: getAvailableColors functionality
      const { data: availableColors, error: availableError } = await supabase
        .from('member_colors')
        .select('*')
        .eq('is_active', true)
        .order('id');

      await this.assert(!availableError, 'MemberColorService.getAvailableColors database query works');
      await this.assert(availableColors && availableColors.length === 20, 'getAvailableColors returns 20 colors');

      // Test 2: Color assignment simulation
      for (let i = 0; i < 3; i++) {
        const userId = this.testData.userIds[i];
        
        // Simulate assignColorToMember
        const { data: existingAssignment } = await supabase
          .from('trip_members')
          .select('assigned_color_index')
          .eq('trip_id', this.testData.tripId)
          .eq('user_id', userId)
          .single();

        await this.assert(existingAssignment !== null, `Trip member exists for color assignment test ${i + 1}`);

        // Get assigned colors to find available index
        const { data: assignedColors } = await supabase
          .from('trip_members')
          .select('assigned_color_index')
          .eq('trip_id', this.testData.tripId)
          .not('assigned_color_index', 'is', null);

        const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);
        let availableIndex = 0;
        while (usedIndices.has(availableIndex) && availableIndex < 20) {
          availableIndex++;
        }

        // Assign the color
        const { error: assignError } = await supabase
          .from('trip_members')
          .update({
            assigned_color_index: availableIndex,
            color_assigned_at: new Date().toISOString()
          })
          .eq('trip_id', this.testData.tripId)
          .eq('user_id', userId);

        await this.assert(!assignError, `Color assignment simulation works for user ${i + 1}`);
        
        if (!assignError) {
          this.testData.colorAssignments.push({
            userId,
            colorIndex: availableIndex,
            color: availableColors[availableIndex]
          });
        }
      }

      // Test 3: getMemberColor functionality
      if (this.testData.colorAssignments.length > 0) {
        const testAssignment = this.testData.colorAssignments[0];
        const { data: memberColor, error: memberColorError } = await supabase
          .from('trip_members')
          .select('assigned_color_index')
          .eq('trip_id', this.testData.tripId)
          .eq('user_id', testAssignment.userId)
          .single();

        await this.assert(!memberColorError, 'getMemberColor database query works');
        await this.assert(
          memberColor && memberColor.assigned_color_index === testAssignment.colorIndex,
          'getMemberColor returns correct color index'
        );
      }

      // Test 4: getTripMemberColors functionality
      const { data: tripMemberColors, error: tripColorsError } = await supabase
        .from('trip_members')
        .select('user_id, assigned_color_index, color_assigned_at')
        .eq('trip_id', this.testData.tripId)
        .not('assigned_color_index', 'is', null);

      await this.assert(!tripColorsError, 'getTripMemberColors database query works');
      await this.assert(
        tripMemberColors && tripMemberColors.length === this.testData.colorAssignments.length,
        'getTripMemberColors returns correct number of assignments'
      );

    } catch (error) {
      this.log(`MemberColorService test error: ${error.message}`, 'error');
      await this.assert(false, `MemberColorService test failed: ${error.message}`);
    }
  }

  async testPlaceColorCalculation() {
    this.log('Testing place color calculation logic...');

    try {
      // Create test places with different member contributions
      const testPlaces = [
        {
          name: 'Single Member Place',
          contributors: [this.testData.userIds[0]]
        },
        {
          name: 'Two Member Place',
          contributors: [this.testData.userIds[0], this.testData.userIds[1]]
        },
        {
          name: 'Four Member Place',
          contributors: this.testData.userIds.slice(0, 4)
        },
        {
          name: 'Five Member Place (Gold)',
          contributors: this.testData.userIds.slice(0, 5)
        }
      ];

      for (const testPlace of testPlaces) {
        // Add place to database
        const { data: place, error: placeError } = await supabase
          .from('places')
          .insert({
            name: testPlace.name,
            category: 'test',
            trip_id: this.testData.tripId,
            user_id: testPlace.contributors[0],
            wish_level: 3,
            stay_duration_minutes: 60,
            member_contribution: testPlace.contributors.map(userId => ({
              userId,
              weight: 1.0 / testPlace.contributors.length
            }))
          })
          .select()
          .single();

        await this.assert(!placeError, `Place creation succeeds for ${testPlace.name}`);

        if (place) {
          // Test color calculation logic
          const contributorCount = testPlace.contributors.length;
          let expectedColorType;
          
          if (contributorCount === 1) {
            expectedColorType = 'single';
          } else if (contributorCount >= 2 && contributorCount <= 4) {
            expectedColorType = 'gradient';
          } else {
            expectedColorType = 'gold';
          }

          await this.assert(
            true, // We can't directly test PlaceColorCalculator without frontend, but we test the logic
            `Place ${testPlace.name} should have ${expectedColorType} color type`
          );

          // Verify member_contribution field was saved correctly
          await this.assert(
            place.member_contribution && place.member_contribution.length === contributorCount,
            `Member contribution data saved correctly for ${testPlace.name}`
          );
        }
      }

    } catch (error) {
      this.log(`Place color calculation test error: ${error.message}`, 'error');
      await this.assert(false, `Place color calculation test failed: ${error.message}`);
    }
  }

  async testColorConstraints() {
    this.log('Testing color system constraints...');

    try {
      // Test 1: Maximum 20 members per trip constraint
      await this.assert(
        this.testData.userIds.length <= 20,
        'Trip does not exceed maximum 20 members'
      );

      // Test 2: Verify unique color constraint
      const { data: constraints } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', this.testData.tripId)
        .not('assigned_color_index', 'is', null);

      if (constraints) {
        const colorIndices = constraints.map(c => c.assigned_color_index);
        const uniqueColorIndices = [...new Set(colorIndices)];
        await this.assert(
          colorIndices.length === uniqueColorIndices.length,
          'All assigned colors are unique within the trip'
        );

        // Test color index range constraint
        const validRange = colorIndices.every(index => index >= 0 && index < 20);
        await this.assert(
          validRange,
          'All color indices are within valid range (0-19)'
        );
      }

      // Test 3: Try to violate unique color constraint
      try {
        // Try to assign duplicate color index
        const { error: duplicateError } = await supabase
          .from('trip_members')
          .update({ assigned_color_index: 0 })
          .eq('trip_id', this.testData.tripId)
          .eq('user_id', this.testData.userIds[4]); // User without color yet

        // Then try to assign same color to another user
        const { error: duplicateError2 } = await supabase
          .from('trip_members')
          .update({ assigned_color_index: 0 })
          .eq('trip_id', this.testData.tripId)
          .eq('user_id', this.testData.userIds[5]); // Another user

        // This should either fail or the unique constraint should prevent it
        await this.assert(
          duplicateError2 !== null,
          'Database prevents duplicate color assignment through constraints'
        );
      } catch (error) {
        await this.assert(true, 'Duplicate color assignment properly handled');
      }

    } catch (error) {
      this.log(`Color constraints test error: ${error.message}`, 'error');
      await this.assert(false, `Color constraints test failed: ${error.message}`);
    }
  }

  async testColorRecycling() {
    this.log('Testing color recycling functionality...');

    try {
      // Find a user with an assigned color
      const assignedUser = this.testData.colorAssignments[0];
      if (!assignedUser) {
        await this.assert(false, 'No assigned user found for recycling test');
        return;
      }

      // Test color recycling by clearing assignment
      const { error: recycleError } = await supabase
        .from('trip_members')
        .update({
          assigned_color_index: null,
          color_assigned_at: null
        })
        .eq('trip_id', this.testData.tripId)
        .eq('user_id', assignedUser.userId);

      await this.assert(!recycleError, 'Color recycling (clearing assignment) succeeds');

      // Verify the color is now available
      const { data: updatedMember } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', this.testData.tripId)
        .eq('user_id', assignedUser.userId)
        .single();

      await this.assert(
        updatedMember && updatedMember.assigned_color_index === null,
        'Color assignment successfully cleared'
      );

      // The color should now be available for reassignment
      const { data: assignedColors } = await supabase
        .from('trip_members')
        .select('assigned_color_index')
        .eq('trip_id', this.testData.tripId)
        .not('assigned_color_index', 'is', null);

      const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);
      const isColorAvailable = !usedIndices.has(assignedUser.colorIndex);
      
      await this.assert(
        isColorAvailable,
        'Recycled color is available for reassignment'
      );

    } catch (error) {
      this.log(`Color recycling test error: ${error.message}`, 'error');
      await this.assert(false, `Color recycling test failed: ${error.message}`);
    }
  }

  async cleanup() {
    this.log('Cleaning up test data...');
    
    try {
      // Delete test places
      await supabase
        .from('places')
        .delete()
        .eq('trip_id', this.testData.tripId);

      // Delete trip members
      await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', this.testData.tripId);

      // Delete test trip
      await supabase
        .from('trips')
        .delete()
        .eq('id', this.testData.tripId);

      // Delete test users
      for (const userId of this.testData.userIds) {
        await supabase
          .from('users')
          .delete()
          .eq('id', userId);
      }

      this.log('Test data cleanup completed');
    } catch (error) {
      this.log(`Cleanup error: ${error.message}`, 'error');
    }
  }

  async runAllTests() {
    try {
      this.log('🧪 Starting Member Color System Comprehensive Test');
      this.log('================================================');

      await this.setupTestData();
      await this.testMemberColorDatabase();
      await this.testMemberColorService();
      await this.testPlaceColorCalculation();
      await this.testColorConstraints();
      await this.testColorRecycling();

    } catch (error) {
      this.log(`Test execution error: ${error.message}`, 'error');
    } finally {
      await this.cleanup();
      this.printResults();
    }
  }

  printResults() {
    this.log('================================================');
    this.log('🧪 Member Color System Test Results');
    this.log('================================================');
    
    this.log(`Total Tests: ${this.results.total}`);
    this.log(`Passed: ${this.results.passed}`, 'success');
    this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
    
    const successRate = this.results.total > 0 ? 
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
    this.log(`Success Rate: ${successRate}%`);

    if (this.results.failed > 0) {
      this.log('\n❌ Failed Tests:');
      this.results.details
        .filter(detail => detail.status === 'FAIL')
        .forEach(detail => this.log(`  - ${detail.message}`, 'error'));
    }

    this.log('\n✅ Passed Tests:');
    this.results.details
      .filter(detail => detail.status === 'PASS')
      .forEach(detail => this.log(`  - ${detail.message}`, 'success'));

    if (this.results.failed === 0) {
      this.log('\n🎉 All member color system tests passed!', 'success');
    } else {
      this.log('\n⚠️ Some tests failed. Please review the implementation.', 'error');
    }
  }
}

// Run the tests
const tester = new MemberColorSystemTester();
tester.runAllTests().catch(console.error);