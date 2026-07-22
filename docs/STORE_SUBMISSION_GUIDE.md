# Store Submission Guide

## Overview

This guide provides step-by-step instructions for submitting Roam to app and extension stores:

1. **Chrome Web Store** (browser extension) — 🟡 $5 one-time fee
2. **Firefox Add-ons (AMO)** (browser extension) — ✅ Free
3. **Google Play Store** (Android app) — 🟡 $25 one-time account fee

**Timeline:** 
- Chrome Web Store: 1-3 days review
- Firefox AMO: 1-7 days review (varies)
- Google Play: 24 hours to 7 days review

---

## Part 1: Chrome Web Store

### 1.1 Prerequisites

- [ ] Chrome developer account created: https://chrome.google.com/webstore/developer/dashboard
- [ ] Payment method on file ($5 fee)
- [ ] Extension built and tested: `npm run build` (in `/extension`)
- [ ] Icon/screenshots prepared (see 1.2)

### 1.2 Required Assets

**📋 See [extension/ASSET_SPECIFICATIONS.md](extension/ASSET_SPECIFICATIONS.md) for detailed asset guide**

**Icon:**
- 128×128px (required, displayed in store)
- Location: `extension/icons/icon-128.png`

**Screenshots (Required: At least 1, Max 5):**
- Dimensions: 1280×800 or 640×400 pixels
- Format: JPEG or 24-bit PNG (NO alpha channel)
- Location: `extension/assets/screenshots/`
- Show key features (search, rate, collect)
- Landscape orientation recommended
- No heavy text overlays

**Small Promo Tile:**
- Dimensions: 440×280 pixels
- Format: JPEG or 24-bit PNG (NO alpha channel)
- Location: `extension/assets/promo-tile-small.png`

**Marquee Promo Tile (Optional):**
- Dimensions: 1400×560 pixels
- Format: JPEG or 24-bit PNG (NO alpha channel)
- Location: `extension/assets/promo-tile-marquee.png`

**Critical Requirement:** All PNG images must be 24-bit (no alpha/transparency). Use JPEG if unsure.

**Store Listing Text:**
- **Name:** "Roam - Discover & Rate Web Content" (or shorter if needed)
- **Short Description:** (132 characters max)
  - "Browse curated web content, rate URLs, and build personal collections with AI-powered recommendations."
- **Full Description:** (4000 characters max)
  ```
  Roam is a collaborative web discovery platform that helps you find, rate, and curate your favorite content.

  Features:
  • Discover curated collections across categories (News, Research, Learning, Entertainment)
  • Rate and review URLs to improve recommendations
  • Create and share personal collections
  • Build your profile with interests and preferences
  • Follow other users to see their discoveries
  • Cross-platform sync (web app, Android, browser extension)
  • Dark mode support
  • Private by default, share what you want

  How it works:
  1. Create an account (email or Google OAuth)
  2. Browse featured collections or search
  3. Rate URLs to help others find great content
  4. Create collections to organize your favorites
  5. Share with friends or keep private

  Why Roam?
  • Community-driven: Real people curating real content
  • Smart recommendations: Algorithm learns your preferences
  • No algorithmic feeds: Transparent, human-curated content
  • Privacy-first: Your data, your control
  • Free: No ads, no paywalls

  Website: https://roamtheweb.app
  Privacy Policy: https://roamtheweb.app/privacy
  Terms: https://roamtheweb.app/terms
  ```

- **Category:** Productivity (or Shopping if applicable)
- **Language:** English
- **Website:** https://roamtheweb.app
- **Support Email:** support@roamtheweb.app
- **Privacy Policy URL:** https://roamtheweb.app/privacy

### 1.3 Build Extension for Chrome

```bash
cd extension

# Install dependencies
npm install

# Build production
npm run build

# Output: dist/ folder (ready for upload)
ls -la dist/
```

**Expected Files in `dist/`:**
```
dist/
├── manifest.json
├── background.js
├── callback.html
├── callback.js
├── popup.html
├── popup.js
├── popup.css
└── (assets, images, etc.)
```

### 1.4 Submit to Chrome Web Store

**Step 1: Sign In**
1. Go to https://chrome.google.com/webstore/developer/dashboard
2. Sign in with Google account
3. Accept developer terms (if first time)

**Step 2: Create Item**
1. Click "Create new item"
2. Select "Upload a package" (.zip file)
3. Create zip from `dist/`:
   ```bash
   cd extension
   zip -r roam-extension.zip dist/
   ```
4. Upload `roam-extension.zip`
5. Click "Upload"

**Step 3: Fill Store Listing**

1. **Name:** "Roam - Discover & Rate Web Content"
2. **Short description:** (132 chars) Copy from 1.2
3. **Full description:** (4000 chars) Copy from 1.2
4. **Category:** Productivity
5. **Language:** English
6. **Icon:** Upload 128×128px icon
7. **Screenshots:** Upload 1280×800px screenshots (2-5 recommended)
   - Feature 1: "Browse curated collections"
   - Feature 2: "Rate and get recommendations"
   - Feature 3: "Create personal collections"
8. **Support URL:** https://roamtheweb.app/support (or GitHub issues)

**Step 4: Payment**
1. Click "Pay"
2. Enter payment method ($5 USD)
3. Confirm payment

**Step 5: Submit for Review**
1. Review all details one more time
2. Ensure manifest.json has:
   ```json
   "name": "Roam - Discover & Rate Web Content",
   "version": "1.0.0",
   "manifest_version": 3,
   "permissions": ["tabs", "activeTab"],
   "host_permissions": ["https://roamtheweb.app/*"]
   ```
3. Click "Submit for review"
4. Extension moves to "In review" status

**Step 6: Monitor Review**
- Check dashboard daily
- Review typically completes in 1-3 days
- You'll receive email when approved or if rejected
- If rejected, fix issues and resubmit

**Step 7: After Approval**
- Extension appears in Chrome Web Store
- URL format: https://chrome.google.com/webstore/detail/roam-discover-rate-web-co/[EXTENSION_ID]
- Share link on website and social media

---

## Part 2: Firefox Add-ons (AMO)

### 2.1 Prerequisites

- [ ] Firefox Developer Account created: https://addons.mozilla.org
- [ ] Email verified
- [ ] Extension built: `npm run build`
- [ ] Icon and screenshots prepared (same as Chrome, but Firefox-specific sizes acceptable)

### 2.2 Required Assets

**Icon:**
- 48×48px (minimum)
- 128×128px (recommended)
- Save as: `extension/icons/icon-firefox.png`

**Screenshots:**
- 1280×800px or 1920×1080px (PNG/JPG)
- Max 5 screenshots
- Include captions/descriptions

**Store Listing (Firefox-specific):**
- **Name:** "Roam - Discover & Rate Web Content"
- **Summary:** (255 chars)
  - "Browse curated web collections, rate URLs, and get AI recommendations. Private, collaborative discovery."
- **Description:** (10,000 chars)
  - Use same text as Chrome, but can be longer
- **Category:** Productivity
- **Website:** https://roamtheweb.app
- **Support Email:** support@roamtheweb.app

### 2.3 Build Extension for Firefox

```bash
cd extension

# Build for Firefox (if using manifest-firefox.json)
npm run build:firefox

# Output: dist-firefox/ folder
# Or reuse dist/ if compatible
```

**Firefox Manifest Requirements:**
- `manifest_version`: 2 or 3 (3 preferred)
- Permissions match Chrome (or more restrictive)
- No license required for store

### 2.4 Submit to Firefox Add-ons (AMO)

**Step 1: Sign In**
1. Go to https://addons.mozilla.org
2. Click "Sign In" (top right)
3. Create account or sign in with Firefox/Mozilla account

**Step 2: Submit Add-on**
1. Click profile icon → "Dashboard"
2. Click "Submit a new add-on"
3. Choose "On this website" (Firefox only)

**Step 3: Upload**
1. Drag & drop .zip file or browse
2. Create zip from `dist/` or `dist-firefox/`:
   ```bash
   cd extension
   zip -r roam-firefox.zip dist/
   ```
3. Upload and wait for validation
4. If validation errors, fix and reupload

**Step 4: Fill Listing Details**

1. **Add-on Details Tab:**
   - Name: "Roam - Discover & Rate Web Content"
   - Summary (255 chars): From 2.2
   - Description: From 2.2
   - Support email: support@roamtheweb.app
   - Website: https://roamtheweb.app
   - Category: Productivity

2. **Compatibility Tab:**
   - Minimum Firefox version: 100 (or lower if tested)
   - Android compatible: Yes (if tested)

3. **Graphics Tab:**
   - Icon (128×128): Upload
   - Screenshots: Upload 2-5 (1280×800 minimum)
   - Category previews: Generated automatically

4. **Permissions Tab:**
   - Review requested permissions
   - Provide justification for each:
     - "tabs" — needed to submit current tab URL
     - "activeTab" — access current page context

5. **Abuse & Licensing:**
   - License: Mozilla Public License (MPL-2.0)
   - Content rating: Answer questions
   - No restricted content checkboxes: All unchecked

**Step 5: Submit for Review**
1. Click "Submit for review"
2. Add version notes:
   ```
   Version 1.0.0 - Initial release
   - Browse curated web collections
   - Rate URLs for recommendations
   - Create personal collections
   - Cross-platform sync with web app
   ```
3. Agree to policies
4. Click "Submit"

**Step 6: Monitor Review**
- Dashboard shows status: "Awaiting Review" → "Approved" or "Rejected"
- Review typically 1-7 days
- Email notification on approval/rejection
- If issues, fix and resubmit via dashboard

**Step 7: After Approval**
- Add-on appears on https://addons.mozilla.org
- URL format: https://addons.mozilla.org/en-US/firefox/addon/roam-discover-rate-web-content/
- Auto-updates for users (no action needed)

---

## Part 3: Google Play Store (Android)

### 3.1 Prerequisites

- [ ] Google Play Developer Account created: https://play.google.com/console
- [ ] Account fee paid ($25 USD)
- [ ] Android app built: `./gradlew bundleRelease`
- [ ] App signing certificate configured
- [ ] Screenshots & assets prepared (see 3.2)

### 3.2 Required Assets

**App Icon:**
- 512×512px PNG (high-res icon for store)
- Create at: `android/app/src/main/ic_launcher/`
- Also need launcher icon in app itself

**Screenshots:**
- Phone screenshots: 1080×1920px (min 2, max 8)
  - Landscape and portrait both accepted
  - Show key features: signup, discover, rate, collect
- Tablet screenshots: 1440×2560px (optional but recommended)
- No marketing overlays (text/graphics okay)

**Store Listing Text:**
- **App name:** "Roam - Discover & Rate Web Content" (50 chars max)
- **Short description:** (80 chars max)
  - "Discover curated content, rate URLs, build collections."
- **Full description:** (4000 chars max)
  ```
  Roam is a collaborative web discovery platform. Find great content, rate URLs, 
  and build personal collections with friends.

  FEATURES:
  ✓ Discover curated collections across categories
  ✓ Rate and review URLs to get personalized recommendations  
  ✓ Create and share personal collections
  ✓ Build your profile with interests
  ✓ Follow users to see their discoveries
  ✓ Sync across Android app, browser extension, and web
  ✓ Dark mode support
  ✓ Privacy-first: Your data stays yours

  HOW IT WORKS:
  1. Sign up with email or Google
  2. Browse featured collections
  3. Rate content to build recommendations
  4. Create collections of your favorites
  5. Share with friends or keep private

  WHY ROAM?
  • Human-curated: Real people finding real content
  • Smart recommendations: Algorithm learns your taste
  • No feeds: Browse at your own pace
  • Privacy respected: Transparent data control
  • Free: No ads, no subscriptions

  Website: https://roamtheweb.app
  Privacy Policy: https://roamtheweb.app/privacy
  Terms: https://roamtheweb.app/terms
  Support: support@roamtheweb.app
  ```
- **Category:** Lifestyle or Social
- **Content rating:** 12+ (or lower if appropriate)
- **Category (secondary):** Travel (if applicable) or skip

**Contact Details:**
- Support email: support@roamtheweb.app
- Support website: https://roamtheweb.app/support
- Privacy Policy: https://roamtheweb.app/privacy

### 3.3 Build Android App Release

**Step 1: Configure Signing**

In `android/build.gradle.kts` or `local.properties`:
```kotlin
signingConfigs {
    release {
        storeFile = file("path/to/roam.keystore")
        storePassword = "your-keystore-password"
        keyAlias = "roam-key"
        keyPassword = "your-key-password"
    }
}

buildTypes {
    release {
        signingConfig = signingConfigs.release
    }
}
```

**Step 2: Create Signing Certificate** (if not exist)

```bash
cd android

# Generate keystore (one-time)
keytool -genkey -v -keystore roam.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias roam-key

# You'll be prompted for passwords and details:
# - Keystore password: Choose strong password
# - Key password: Same as keystore
# - CN (name): Your name or company
# - OU, O, L, ST, C: Your details

# Keep roam.keystore SAFE — it's needed for all future updates
```

**Step 3: Build Release Bundle (AAB)**

```bash
cd android

# Build App Bundle (AAB) for Google Play
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab
# This is what you upload to Play Store

# If building APK for testing:
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

**Step 4: Test Release Build**

```bash
# Install APK on device for final testing
adb install -r app/build/outputs/apk/release/app-release.apk

# Or use bundle analyzer:
bundletool build-apks --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks --ks=roam.keystore --ks-pass=pass:yourpassword

adb install-multiple app-release.apks
```

### 3.4 Submit to Google Play Store

**Step 1: Sign In**
1. Go to https://play.google.com/console
2. Sign in with Google account
3. Navigate to dashboard

**Step 2: Create App**
1. Click "Create app"
2. App name: "Roam - Discover & Rate Web Content"
3. Default language: English
4. App category: Lifestyle (or Social)
5. App type: Applications (not game)
6. Accept policies
7. Click "Create"

**Step 3: Store Listing**

1. **Listing Details:**
   - Title: "Roam - Discover & Rate Web Content" (50 chars)
   - Short description: From 3.2 (80 chars)
   - Full description: From 3.2
   - Category: Lifestyle
   - Content rating: 12+ or unrated

2. **Graphics:**
   - App icon: 512×512px PNG
   - Feature graphic: 1024×500px PNG (header)
   - Screenshots: 1080×1920px PNGs (2-8)
     - Best practices:
       - Show main feature first
       - Include text overlay (optional)
       - Landscape or portrait (mix okay)
     - Example set:
       1. "Discover curated content"
       2. "Rate URLs for recommendations"
       3. "Build personal collections"

3. **Content Rating:**
   - Go to "Content rating" section
   - Fill questionnaire:
     - Violence: None
     - Content: No inappropriate content
     - Ads: None
   - Get rating (usually auto)

4. **App Access:**
   - Default: Full access
   - Or restrict if needed

5. **Video:** (optional)
   - Promotional video URL (YouTube)
   - Skip if not available

**Step 4: Release Management**

1. Click "Releases" (left sidebar)
2. Click "Create new release"
3. Choose "Production" (or "Internal testing" first)

**Internal Testing (Recommended First):**
1. Click "Internal testing" → "Create release"
2. Upload AAB: `app/build/outputs/bundle/release/app-release.aab`
3. Click "Review release" → "Start rollout to Internal testing"
4. Share test link with team
5. Collect feedback for 1-2 days
6. Fix any issues
7. Then move to production

**Production Release:**
1. Click "Production" → "Create release"
2. Upload AAB: `app/build/outputs/bundle/release/app-release.aab`
3. Release name: "1.0.0" (matches app versionName)
4. Release notes (optional):
   ```
   Version 1.0.0
   - Initial public release
   - Browse curated web collections
   - Rate URLs for personalized recommendations
   - Create and share collections
   - Cross-platform sync with web and browser
   ```
5. Click "Review release"
6. Check for warnings/errors
7. Click "Start rollout to Production"

**Step 5: Monitor Review**

- Status changes: "In review" → "Ready for review" → "Live"
- Review typically 24 hours to 7 days
- Check "Release notes" section for approval status
- Email notification when approved/rejected

**If Rejected:**
1. Review rejection reason (usually content or policy)
2. Fix issue (e.g., update privacy policy, remove ad)
3. Create new release with fix
4. Resubmit

**Step 6: After Approval**

- App live on Play Store
- URL format: https://play.google.com/store/apps/details?id=com.sevenLynx.roam
- Users can install directly
- Auto-updates when new versions released

---

## Submission Checklist

### Chrome Web Store

- [ ] Extension builds: `npm run build`
- [ ] manifest.json valid
- [ ] Icons prepared (128×128)
- [ ] Screenshots ready (1280×800, 2-5 recommended)
- [ ] Store listing text complete
- [ ] Privacy policy available
- [ ] $5 payment method ready
- [ ] Submitted to review
- [ ] Monitoring review status

### Firefox Add-ons

- [ ] Extension builds: `npm run build`
- [ ] Firefox manifest compatible
- [ ] Icons prepared (128×128)
- [ ] Screenshots ready
- [ ] Store listing text complete
- [ ] Privacy policy available
- [ ] Permissions justified
- [ ] Submitted to review
- [ ] Monitoring review status

### Google Play Store

- [ ] App builds: `./gradlew bundleRelease`
- [ ] Signing certificate configured
- [ ] Version code incremented
- [ ] App icons prepared (512×512)
- [ ] Screenshots ready (1080×1920, 2-8)
- [ ] Store listing complete
- [ ] Content rating done
- [ ] Privacy policy updated
- [ ] Terms of Service available
- [ ] Internal testing completed
- [ ] Production release ready
- [ ] Submitted to review
- [ ] Monitoring review status

---

## Post-Submission Tracking

| Store | Date Submitted | Expected Approval | Status | URL |
|-------|---|---|---|---|
| Chrome Web Store | | | | |
| Firefox AMO | | | | |
| Google Play | | | | |

---

## Marketing After Launch

**Once Approved:**

1. **Update Website**
   - Add store links to homepage
   - Create "Get Started" button linking to stores
   - Add app download badges

2. **Social Media**
   - Post announcement
   - Share store links
   - Screenshot carousel

3. **Community**
   - Notify users
   - Post on subreddits (r/webdev, r/productivity, etc.)
   - Submit to Product Hunt (if applicable)

4. **PR (Optional)**
   - Write press release
   - Pitch to tech blogs
   - Contact influencers

---

## Troubleshooting Rejections

### Chrome Web Store

| Issue | Solution |
|-------|----------|
| "Functionality vague" | Add more detail to description |
| "Privacy policy missing" | Update manifest and listing with URL |
| "Permissions not justified" | Explain why each permission needed |
| "Icon too small" | Use 128×128 PNG |

### Firefox AMO

| Issue | Solution |
|-------|----------|
| "Slow review" | This is normal, can take 1-7 days |
| "Content policy violation" | Remove any inappropriate content |
| "Permissions over-reaching" | Remove unnecessary permissions |

### Google Play

| Issue | Solution |
|-------|----------|
| "Non-functional app" | Ensure OAuth works, backend reachable |
| "Ad-heavy content" | Should be minimal/none |
| "Crashes on startup" | Test on multiple devices, check logs |
| "Privacy policy required" | Update listing with URL |
| "Deceptive content" | Ensure description matches functionality |

---

## Useful Links

**Chrome Web Store:**
- Developer Dashboard: https://chrome.google.com/webstore/developer/dashboard
- Publish Guide: https://developer.chrome.com/docs/webstore/
- Policy Center: https://support.google.com/chrome/a/answer/2657289

**Firefox Add-ons:**
- AMO Site: https://addons.mozilla.org
- Developer Hub: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
- Review Guide: https://extensionworkshop.com/documentation/publish/

**Google Play:**
- Play Console: https://play.google.com/console
- Publish Guide: https://developer.android.com/distribute
- Policy Center: https://play.google.com/about/gpp/index.html

