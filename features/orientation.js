// Force landscape orientation
export async function lockLandscape() {
  try {
    // Try Screen Orientation API (works on Android Chrome)
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
      console.log('✓ Landscape locked via Screen Orientation API');
    }
  } catch (err) {
    console.warn('Screen Orientation API not supported or failed:', err.message);
    // On iOS and some browsers, we can't lock orientation programmatically
    // User must rotate device manually
  }
}

// Show warning if in portrait mode
export function checkOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  const warning = document.getElementById('orientation-warning');
  
  if (warning) {
    if (isPortrait) {
      warning.style.display = 'flex';
    } else {
      warning.style.display = 'none';
    }
  }
}

// Monitor orientation changes
export function initOrientation() {
  // Try to lock on load
  lockLandscape();
  
  // Check initial orientation
  checkOrientation();
  
  // Listen for orientation changes
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', () => {
    setTimeout(checkOrientation, 100);
  });
}

