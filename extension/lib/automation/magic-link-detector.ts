/**
 * Magic Link Detector
 *
 * Detects form submissions and triggers magic link automation
 * - Monitors signup/signin forms
 * - Validates email matches configured provider
 * - Triggers inbox automation when magic link is sent
 */

// ============================================================================
// Types
// ============================================================================

export interface FormSubmission {
  email: string;
  formType: 'signin' | 'signup' | 'unknown';
  formElement: HTMLFormElement;
  timestamp: number;
}

export interface MagicLinkDetection {
  detected: boolean;
  email: string;
  formType: 'signin' | 'signup';
  message?: string;
}

// ============================================================================
// Form Detection Patterns
// ============================================================================

const SIGNIN_PATTERNS = [
  /sign\s*in/i,
  /log\s*in/i,
  /login/i,
  /authenticate/i,
  /access/i,
];

const SIGNUP_PATTERNS = [
  /sign\s*up/i,
  /register/i,
  /create\s*account/i,
  /join/i,
  /get\s*started/i,
];

const MAGIC_LINK_INDICATORS = [
  /magic\s*link/i,
  /email.*link/i,
  /send.*link/i,
  /check.*email/i,
  /sent.*email/i,
  /verify.*email/i,
  /confirmation.*email/i,
  /passwordless/i,
];

// ============================================================================
// Form Type Detection
// ============================================================================

function detectFormType(form: HTMLFormElement): 'signin' | 'signup' | 'unknown' {
  // Check form action, id, class, and nearby text
  const formText = [
    form.action,
    form.id,
    form.className,
    form.textContent || '',
    form.querySelector('button[type="submit"]')?.textContent || '',
    form.querySelector('input[type="submit"]')?.value || '',
  ].join(' ').toLowerCase();

  // Check for signup patterns first (more specific)
  for (const pattern of SIGNUP_PATTERNS) {
    if (pattern.test(formText)) {
      return 'signup';
    }
  }

  // Then check signin patterns
  for (const pattern of SIGNIN_PATTERNS) {
    if (pattern.test(formText)) {
      return 'signin';
    }
  }

  return 'unknown';
}

// ============================================================================
// Email Extraction
// ============================================================================

export function extractEmailFromForm(form: HTMLFormElement): string | null {
  // Find email input field
  const emailInput = form.querySelector<HTMLInputElement>('input[type="email"]');
  if (emailInput?.value) {
    return emailInput.value.trim().toLowerCase();
  }

  // Fallback: look for input with email-like name
  const emailLikeInput = form.querySelector<HTMLInputElement>(
    'input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]'
  );
  if (emailLikeInput?.value) {
    return emailLikeInput.value.trim().toLowerCase();
  }

  return null;
}

// ============================================================================
// Magic Link Message Detection
// ============================================================================

export function detectMagicLinkMessage(): boolean {
  // Check page content for magic link indicators
  const pageText = document.body.textContent || '';

  for (const pattern of MAGIC_LINK_INDICATORS) {
    if (pattern.test(pageText)) {
      console.log('[MagicLink] Detected magic link message:', pattern);
      return true;
    }
  }

  // Check for newly appeared messages (last 5 seconds)
  const recentMessages = document.querySelectorAll<HTMLElement>(
    '[role="alert"], .alert, .message, .notification, .toast'
  );

  for (const msg of recentMessages) {
    const text = msg.textContent || '';
    for (const pattern of MAGIC_LINK_INDICATORS) {
      if (pattern.test(text)) {
        console.log('[MagicLink] Detected magic link in notification:', text);
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Form Submission Monitor
// ============================================================================

export class MagicLinkDetector {
  private configuredEmail: string | null = null;
  private lastSubmission: FormSubmission | null = null;
  private onDetectionCallback: ((detection: MagicLinkDetection) => void) | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Load configured email
    const stored = await chrome.storage.local.get('emailProviderConfig');
    if (stored.emailProviderConfig?.email) {
      this.configuredEmail = stored.emailProviderConfig.email.toLowerCase();
      console.log('[MagicLink] Initialized with email:', this.configuredEmail);
    } else {
      console.log('[MagicLink] No email configured, magic link detection disabled');
    }
  }

  /**
   * Start monitoring forms on the page
   */
  public startMonitoring() {
    if (!this.configuredEmail) {
      console.log('[MagicLink] Cannot start monitoring: no email configured');
      return;
    }

    console.log('[MagicLink] Starting form monitoring...');

    // Monitor form submissions
    document.addEventListener('submit', this.handleFormSubmit.bind(this), true);

    // Monitor for magic link messages appearing
    const observer = new MutationObserver(() => {
      if (this.lastSubmission && detectMagicLinkMessage()) {
        this.triggerDetection();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[MagicLink] Monitoring active');
  }

  /**
   * Handle form submission
   */
  private handleFormSubmit(event: Event) {
    const form = event.target as HTMLFormElement;
    if (!form || form.tagName !== 'FORM') return;

    const email = extractEmailFromForm(form);
    if (!email) {
      console.log('[MagicLink] Form submitted without email field');
      return;
    }

    const formType = detectFormType(form);
    console.log('[MagicLink] Form submitted:', { email, formType });

    // Only proceed if email matches configured email
    if (email !== this.configuredEmail) {
      console.log('[MagicLink] Email mismatch:', {
        submitted: email,
        configured: this.configuredEmail,
      });
      return;
    }

    // Store submission details
    this.lastSubmission = {
      email,
      formType,
      formElement: form,
      timestamp: Date.now(),
    };

    console.log('[MagicLink] Matching email submitted, watching for magic link...');

    // Wait a bit and check for magic link message
    setTimeout(() => {
      if (detectMagicLinkMessage()) {
        this.triggerDetection();
      }
    }, 1000);
  }

  /**
   * Trigger magic link detection callback
   */
  private triggerDetection() {
    if (!this.lastSubmission) return;

    // Don't trigger if submission is too old (> 30 seconds)
    if (Date.now() - this.lastSubmission.timestamp > 30000) {
      console.log('[MagicLink] Submission too old, ignoring');
      return;
    }

    const detection: MagicLinkDetection = {
      detected: true,
      email: this.lastSubmission.email,
      formType: this.lastSubmission.formType,
      message: 'Magic link email detected',
    };

    console.log('[MagicLink] Magic link detected!', detection);

    if (this.onDetectionCallback) {
      this.onDetectionCallback(detection);
    }

    // Clear last submission after detection
    this.lastSubmission = null;
  }

  /**
   * Set callback for when magic link is detected
   */
  public onDetection(callback: (detection: MagicLinkDetection) => void) {
    this.onDetectionCallback = callback;
  }

  /**
   * Update configured email (when user completes setup)
   */
  public async updateConfiguredEmail() {
    const stored = await chrome.storage.local.get('emailProviderConfig');
    if (stored.emailProviderConfig?.email) {
      this.configuredEmail = stored.emailProviderConfig.email.toLowerCase();
      console.log('[MagicLink] Email updated:', this.configuredEmail);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let detector: MagicLinkDetector | null = null;

export function getMagicLinkDetector(): MagicLinkDetector {
  if (!detector) {
    detector = new MagicLinkDetector();
  }
  return detector;
}
