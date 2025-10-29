# HWID Reset Feature - Troubleshooting

## Current Issue

The error "The value inputted for type paramater was not found" when clicking "Reset HWID" indicates that the KeyAuth API endpoint is not available on your account.

## Possible Causes

1. **Feature Not Enabled**: The HWID reset feature may not be enabled in your KeyAuth dashboard
2. **API Version**: Your KeyAuth account might be using an older API version that doesn't support this endpoint
3. **Plan Restrictions**: Some KeyAuth plans may not include HWID reset functionality
4. **Browser Limitations**: Browser-based clients may not have access to this endpoint

## Solutions

### Option 1: Enable in KeyAuth Dashboard

1. Log into your KeyAuth dashboard
2. Go to your application settings
3. Look for "Hardware ID Reset" or "HWID Reset" feature
4. Enable the feature
5. Save settings

### Option 2: Use Server-Side Implementation

For better security and compatibility, implement HWID reset on your server:

```javascript
// Server-side endpoint (Node.js/Express example)
app.post('/api/reset-hwid', async (req, res) => {
    const { licenseKey } = req.body;
    
    // Verify the license first
    const isVerified = await verifyLicenseKey(licenseKey);
    
    if (!isVerified) {
        return res.status(401).json({ error: 'Invalid license key' });
    }
    
    // Call KeyAuth HWID reset from server
    const response = await fetch('https://keyauth.win/api/1.3/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            type: 'resethwid',
            name: 'Your_App_Name',
            ownerid: 'Your_Owner_ID',
            key: licenseKey
        })
    });
    
    const data = await response.json();
    res.json(data);
});
```

### Option 3: Disable the Feature

If HWID reset is not needed, you can hide/disable the button by removing or commenting out the button in `index.html`:

```html
<!-- Remove or hide this button -->
<button class="reset-hwid-btn" id="resetHwidBtn" style="display: none;">
    <svg>...</svg>
    Reset HWID
</button>
```

## Checking Your KeyAuth API Version

The endpoint type "resethwid" is the correct parameter for KeyAuth API v1.3. If you're using an older version, you may need to upgrade your account or use an alternative method.

## Contact Support

If the feature should be enabled but isn't working:
1. Contact KeyAuth support
2. Provide your account details
3. Mention that the "resethwid" endpoint returns "not found" error

