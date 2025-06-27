// Voypath Authentication Check and Redirect
(function() {
  // Check if user is logged in
  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const supabaseAuth = localStorage.getItem('supabase.auth.token');
    
    if (token || supabaseAuth) {
      // Redirect to main app if logged in
      window.location.href = 'https://voypath.app';
    }
  };
  
  // Run check on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
  
  // Update all CTA buttons to point to Voypath app
  document.addEventListener('DOMContentLoaded', function() {
    // Find all buttons and links
    const buttons = document.querySelectorAll('a[data-framer-name*="Button"], .framer-1yvmtw8, .framer-1xd6uv3');
    buttons.forEach(button => {
      button.href = 'https://voypath.app';
      button.target = '_self';
    });
  });
})();