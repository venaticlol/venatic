# 🔧 Troubleshooting Guide

## Error: Firestore API Not Enabled

### What it means
The Firestore API hasn't been enabled in Google Cloud Console. This is required even if you've created a Firestore database in Firebase Console.

### Solution

1. **Click this direct link**: https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=recon-cord
2. **Click "Enable"** button
3. **Wait 1-2 minutes** for the API to activate
4. **Refresh** the Recon-Cord page
5. **Try again**

### Alternative Method

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/library?project=recon-cord)
2. Search for "Cloud Firestore API"
3. Click on it
4. Click "Enable"
5. Wait 1-2 minutes, then refresh

## Error: ERR_BLOCKED_BY_CLIENT

### What it means
Your browser is blocking Firestore requests. This is usually caused by:
- **Ad blockers** (uBlock Origin, AdBlock Plus, etc.)
- **Privacy extensions** (Privacy Badger, Ghostery, etc.)
- **Browser privacy settings**

### Solution

#### Option 1: Disable Ad Blocker for This Site (Recommended)
1. Click on your ad blocker extension icon
2. Click "Disable on this site" or "Allow on this page"
3. Refresh the page

#### Option 2: Add Firebase to Whitelist
**For uBlock Origin:**
1. Click uBlock icon → Settings
2. Go to "My filters" tab
3. Add these lines:
   ```
   @@||firestore.googleapis.com^
   @@||firebase.googleapis.com^
   @@||googleapis.com^
   ```
4. Click "Apply changes"
5. Refresh the page

**For AdBlock Plus:**
1. Click AdBlock icon → Settings
2. Go to "Advanced" → "Edit Filters"
3. Add exception rules:
   ```
   @@||firestore.googleapis.com
   @@||firebase.googleapis.com
   @@||googleapis.com
   ```

#### Option 3: Use Different Browser
Try opening Recon-Cord in:
- Chrome/Edge (Incognito mode with extensions disabled)
- Firefox (Private window)
- Or temporarily disable all extensions

#### Option 4: Check Browser Privacy Settings
- **Chrome/Edge**: Settings → Privacy and security → Site settings → Additional permissions
- **Firefox**: Settings → Privacy & Security → Enhanced Tracking Protection

### Verify It's Fixed
After making changes:
1. **Hard refresh** the page (Ctrl+F5 or Cmd+Shift+R)
2. Try registering/login again
3. Check browser console (F12) - errors should be gone

## Other Common Issues

### Firestore Permission Denied
- Make sure Firestore security rules are published
- Check that you're authenticated
- Verify rules in Firebase Console

### Authentication Not Working
- Enable Anonymous Authentication in Firebase Console
- Check browser console for specific error codes
- Try clearing browser cache

### CORS Errors
- Make sure Firebase project is configured correctly
- Check that your domain is authorized in Firebase Console
- Verify API keys are correct

## Still Having Issues?

1. **Check Browser Console** (F12) for specific error messages
2. **Check Network Tab** to see which requests are failing
3. **Try Incognito/Private Mode** to test without extensions
4. **Clear Browser Cache** and cookies for the site
5. **Check Firebase Console** to ensure all services are enabled

## Quick Test

Open browser console (F12) and run:
```javascript
fetch('https://firestore.googleapis.com')
  .then(() => console.log('✅ Firestore accessible'))
  .catch(() => console.error('❌ Firestore blocked'))
```

If it shows blocked, your ad blocker is interfering.

