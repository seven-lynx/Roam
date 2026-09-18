# Roam Web Testing Guide

This checklist covers the current web surface: onboarding, auth, profile, settings, password reset, privacy/terms, and admin moderation.

## 1. Authentication

### 1.1 Google OAuth
- [ ] Navigate to `http://localhost:3000/join` (or staging URL)
- [ ] Click the Google sign-in button
- [ ] Complete the OAuth flow
- [ ] Return to Roam without errors
- [ ] Confirm the session persists after refresh

### 1.2 Email/password sign-up
- [ ] Open the sign-up tab on `/join`
- [ ] Create a unique email account
- [ ] Confirm the password and submit
- [ ] Verify the inbox flow or auto-confirm flow works as configured
- [ ] Confirm the new account lands on the profile or onboarding flow

### 1.3 Email/password sign-in
- [ ] Sign out
- [ ] Sign back in with the same credentials
- [ ] Confirm the session persists after refresh
- [ ] Verify invalid credentials show a clear inline error

## 2. Profile and Settings

### 2.1 Profile view and edit
- [ ] Open `/profile`
- [ ] Verify profile details render correctly
- [ ] Update a profile field and save
- [ ] Confirm the change persists after reload

### 2.2 Settings
- [ ] Open `/settings`
- [ ] Verify auth, privacy, and account controls render correctly
- [ ] Toggle a non-destructive preference and confirm it persists
- [ ] Confirm sign-out returns to `/join`

## 3. Password Reset

- [ ] Open `/forgot-password`
- [ ] Request a reset email
- [ ] Follow the reset link to `/auth/reset-password`
- [ ] Set a new password
- [ ] Confirm the new password works on sign-in

## 4. Admin Moderation

- [ ] Sign in as an admin user
- [ ] Open `/admin`
- [ ] Confirm the moderation queue loads
- [ ] Open a submission detail row
- [ ] Approve or reject a submission
- [ ] Confirm the queue updates without a full page reload

## 5. Public Pages

- [ ] Open `/privacy`
- [ ] Open `/terms`
- [ ] Confirm both pages render without auth
- [ ] Confirm the header/footer links are correct

## Notes

- Use the staging environment for release verification.
- Capture screenshots for regressions in onboarding, sign-in, profile, and admin moderation.
- Add any platform-specific edge cases discovered during beta testing.
