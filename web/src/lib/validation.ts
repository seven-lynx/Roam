/**
 * Validation utilities for form fields
 */

/**
 * Validate email format
 * Returns: { valid: boolean, error?: string }
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' };
  }
  
  // RFC 5322 simplified email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  
  return { valid: true };
}

/**
 * Validate password strength
 * Returns: { valid: boolean, error?: string, strength: 'weak' | 'fair' | 'good' | 'strong' }
 */
export function validatePassword(password: string): {
  valid: boolean;
  error?: string;
  strength: 'weak' | 'fair' | 'good' | 'strong';
} {
  if (!password) {
    return { valid: false, error: 'Password is required', strength: 'weak' };
  }
  
  if (password.length < 8) {
    return {
      valid: false,
      error: `Password must be at least 8 characters (${password.length}/8)`,
      strength: 'weak',
    };
  }
  
  // Calculate strength based on character types
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const strengthScore = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(
    Boolean
  ).length;
  
  let strength: 'weak' | 'fair' | 'good' | 'strong';
  if (strengthScore <= 1) {
    strength = 'weak';
  } else if (strengthScore === 2) {
    strength = 'fair';
  } else if (strengthScore === 3) {
    strength = 'good';
  } else {
    strength = 'strong';
  }
  
  return { valid: true, strength };
}

/**
 * Validate passwords match
 */
export function validatePasswordsMatch(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password' };
  }
  
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  
  return { valid: true };
}

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(
  strength: 'weak' | 'fair' | 'good' | 'strong'
): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'fair':
      return 'bg-orange-500';
    case 'good':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
}

/**
 * Get password strength label for UI
 */
export function getPasswordStrengthLabel(
  strength: 'weak' | 'fair' | 'good' | 'strong'
): string {
  switch (strength) {
    case 'weak':
      return 'Weak';
    case 'fair':
      return 'Fair';
    case 'good':
      return 'Good';
    case 'strong':
      return 'Strong';
    default:
      return 'Unknown';
  }
}
