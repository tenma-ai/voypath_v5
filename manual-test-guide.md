# Google Places Integration Manual Test Guide

## Test Environment
- **Application URL**: http://localhost:5174/
- **Test Date**: Current
- **Integration**: Google Places API through Supabase proxy

## Pre-Test Setup ✅

1. **API Integration Status**: ✅ WORKING
   - Google Places proxy function is deployed and functional
   - Text search, geocoding, and nearby search all working
   - API returns proper data with ratings, addresses, and place details

2. **Environment Variables**: ✅ CONFIGURED
   - VITE_SUPABASE_URL: Set correctly
   - VITE_SUPABASE_ANON_KEY: Set correctly
   - VITE_GOOGLE_MAPS_API_KEY: Set correctly

## Manual Testing Steps

### Test 1: Navigation to Add Place
1. Navigate to http://localhost:5174/
2. Look for "Add Place" button or link
3. Click to navigate to the Add Place page
4. **Expected**: Should reach `/add-place` or similar route

### Test 2: Place Search Functionality
1. On the Add Place page, locate the search input field
2. Enter a search query like "coffee shop" or "restaurant"
3. Wait for search results to appear (should be debounced ~300ms)
4. **Expected**: 
   - Loading indicator should appear briefly
   - Search results should populate with real places
   - Each result should show name, address, rating

### Test 3: Place Selection
1. From the search results, click on a place
2. **Expected**: 
   - Place should be selected and search results should close
   - Place details should appear in a form
   - Form should show place name, address, rating

### Test 4: Place Form Submission
1. With a place selected, fill out the form:
   - Visit Priority (star rating)
   - Duration (slider)
   - Visit Date
   - Budget Level
   - Preferred Time
   - Notes (optional)
2. Click "Add to My Places" button
3. **Expected**:
   - Loading state should appear
   - Success message should show
   - Should navigate to My Places page

### Test 5: Console Error Check
1. Open browser developer tools (F12)
2. Go to Console tab
3. Perform the above tests
4. **Expected**: No errors related to Google Places API calls

## Common Issues to Check

### ❌ If Search Returns No Results
- Check browser console for network errors
- Verify Supabase proxy is accessible
- Check if API key has proper permissions

### ❌ If Search Doesn't Trigger
- Check if input field has proper event handlers
- Verify debouncing is working (search should only trigger after ~300ms)
- Check if GooglePlacesService is imported correctly

### ❌ If Place Selection Fails
- Check if place objects have required fields
- Verify category inference function is working
- Check console for JavaScript errors

### ❌ If Form Submission Fails
- Check if place data conversion is working
- Verify Supabase function calls are successful
- Check user authentication state

## Integration Health Indicators

### ✅ Healthy Integration
- Search results appear within 2-3 seconds
- Results include real place names and addresses
- Place ratings and review counts display correctly
- No console errors during API calls
- Form submission creates places successfully

### ⚠️ Degraded Integration
- Slow search responses (>5 seconds)
- Some missing data fields (ratings, photos)
- Occasional timeout errors
- Rate limiting warnings

### ❌ Broken Integration
- No search results
- Network errors in console
- "API key not found" or permission errors
- Proxy function returning error responses

## Expected Results Summary

Based on our testing, the Google Places integration should be **FULLY FUNCTIONAL**:

1. ✅ **API Proxy**: Working correctly, returning real place data
2. ✅ **Search Service**: GooglePlacesService implemented and functional  
3. ✅ **UI Integration**: AddPlacePage uses the service correctly
4. ✅ **Data Flow**: Places can be searched, selected, and added to trips
5. ✅ **Error Handling**: Proper error messages and fallbacks in place

## Test Results Location

- Browser test results: Open `test-browser-integration.html` in browser
- API test results: Run `node test-frontend-integration.js`
- Manual testing: Follow steps above on live application

## Troubleshooting

If you encounter issues:

1. **Check server logs**: Supabase function logs for proxy errors
2. **Verify API limits**: Google Places API quota and billing
3. **Test connectivity**: Direct API calls vs proxy calls
4. **Review code**: AddPlacePage implementation and GooglePlacesService
5. **Browser compatibility**: Test in different browsers