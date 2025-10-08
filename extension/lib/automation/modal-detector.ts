/**
 * Modal Detection Service
 *
 * Detects modals, popups, overlays, and dialogs using multiple strategies:
 * - ARIA roles and attributes
 * - DOM structure patterns
 * - CSS class heuristics
 * - Z-index analysis
 * - Visual positioning
 */

// ============================================================================
// Types
// ============================================================================

export type ModalType =
  | 'cookie-consent'
  | 'newsletter'
  | 'age-verification'
  | 'gdpr'
  | 'paywall'
  | 'generic'
  | 'unknown';

export interface ModalInfo {
  element: HTMLElement;
  type: ModalType;
  dismissButton: HTMLElement | null;
  acceptButton: HTMLElement | null; // For GDPR/cookie modals - "Accept All" button
  confidence: number; // 0-1
  backdrop: HTMLElement | null;
  zIndex: number;
  metadata: {
    hasAriaModal?: boolean;
    hasRoleDialog?: boolean;
    detectionMethod: string;
    isFirstVisit?: boolean; // For GDPR/cookie detection
  };
}

export interface ModalDetectionOptions {
  minZIndex?: number;
  includeHidden?: boolean;
  maxResults?: number;
}

// ============================================================================
// Constants
// ============================================================================

// Common modal class patterns
const MODAL_CLASS_PATTERNS = [
  /modal/i,
  /popup/i,
  /dialog/i,
  /overlay/i,
  /lightbox/i,
  /cookie[-_]?consent/i,
  /cookie[-_]?banner/i,
  /newsletter/i,
  /subscribe/i,
  /gdpr/i,
];

// Common backdrop class patterns
const BACKDROP_CLASS_PATTERNS = [
  /backdrop/i,
  /overlay/i,
  /mask/i,
  /dimmer/i,
  /modal[-_]?background/i,
];

// Common dismiss button patterns
const DISMISS_BUTTON_PATTERNS = {
  // Text content
  text: [
    /^close$/i,
    /^dismiss$/i,
    /^no\s*thanks?$/i,
    /^decline$/i,
    /^reject\s*all$/i,
    /^×$/,
    /^✕$/,
    /^✖$/,
    /^✗$/,
    /^⨯$/,
  ],
  // ARIA labels
  aria: [
    /close/i,
    /dismiss/i,
    /cancel/i,
  ],
  // Class names
  classes: [
    /close/i,
    /dismiss/i,
    /cancel/i,
  ],
};

// Cookie/GDPR "Accept All" button patterns (prioritized for GDPR modals)
const ACCEPT_ALL_BUTTON_PATTERNS = {
  // Text content - order matters, more specific first
  text: [
    /^accept\s*all$/i,
    /^allow\s*all$/i,
    /^agree\s*(?:and\s*)?(?:to\s*)?all$/i,
    /^accept$/i,
    /^allow$/i,
    /^agree$/i,
    /^ok$/i,
    /^got\s*it$/i,
    /^understand$/i,
    /^consent$/i,
    /^continue$/i,
  ],
  // ARIA labels
  aria: [
    /accept.*all/i,
    /allow.*all/i,
    /agree.*all/i,
    /accept/i,
    /allow/i,
    /consent/i,
  ],
  // Class/ID names
  classes: [
    /accept.*all/i,
    /allow.*all/i,
    /consent.*all/i,
    /accept/i,
    /allow/i,
    /consent/i,
    /agree/i,
  ],
};

// Specific modal type identifiers
const MODAL_TYPE_PATTERNS: Record<Exclude<ModalType, 'generic' | 'unknown'>, RegExp[]> = {
  'cookie-consent': [
    /cookie/i,
    /consent/i,
    /privacy/i,
  ],
  'newsletter': [
    /newsletter/i,
    /subscribe/i,
    /sign[-_]?up/i,
    /email/i,
  ],
  'age-verification': [
    /age/i,
    /verify/i,
    /21\+/,
    /18\+/,
  ],
  'gdpr': [
    /gdpr/i,
    /data\s*protection/i,
    /privacy\s*policy/i,
  ],
  'paywall': [
    /paywall/i,
    /subscribe/i,
    /premium/i,
    /unlock/i,
  ],
};

// ============================================================================
// Modal Detector Class
// ============================================================================

export class ModalDetector {
  private options: Required<ModalDetectionOptions>;

  constructor(options: ModalDetectionOptions = {}) {
    this.options = {
      minZIndex: options.minZIndex ?? 100,
      includeHidden: options.includeHidden ?? false,
      maxResults: options.maxResults ?? 5,
    };
  }

  /**
   * Detect all visible modals on the page
   */
  public detectAll(): ModalInfo[] {
    const candidates = this.findModalCandidates();
    const modals: ModalInfo[] = [];

    for (const candidate of candidates) {
      const modalInfo = this.analyzeCandidate(candidate);
      if (modalInfo && modalInfo.confidence > 0.3) {
        modals.push(modalInfo);
      }

      if (modals.length >= this.options.maxResults) {
        break;
      }
    }

    // Sort by confidence (highest first)
    return modals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect the most likely modal on the page
   */
  public detectPrimary(): ModalInfo | null {
    const modals = this.detectAll();
    return modals.length > 0 ? modals[0] : null;
  }

  /**
   * Find modal candidate elements using multiple strategies
   */
  private findModalCandidates(): HTMLElement[] {
    const candidates = new Set<HTMLElement>();

    // Strategy 1: ARIA role="dialog" or aria-modal="true"
    const ariaDialogs = document.querySelectorAll<HTMLElement>(
      '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
    );
    ariaDialogs.forEach(el => candidates.add(el));

    // Strategy 2: Common modal class patterns
    for (const pattern of MODAL_CLASS_PATTERNS) {
      const elements = this.findByClassPattern(pattern);
      elements.forEach(el => candidates.add(el));
    }

    // Strategy 3: High z-index elements with overlay-like behavior
    const highZIndexElements = this.findHighZIndexElements();
    highZIndexElements.forEach(el => candidates.add(el));

    // Strategy 4: Fixed/absolute positioned elements that cover significant screen area
    const coveringElements = this.findCoveringElements();
    coveringElements.forEach(el => candidates.add(el));

    return Array.from(candidates).filter(el => {
      if (!this.options.includeHidden && !this.isVisible(el)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Find elements matching class pattern
   */
  private findByClassPattern(pattern: RegExp): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const all = document.querySelectorAll<HTMLElement>('[class]');

    for (const el of all) {
      if (pattern.test(el.className)) {
        elements.push(el);
      }
    }

    return elements;
  }

  /**
   * Find elements with high z-index
   */
  private findHighZIndexElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const all = document.querySelectorAll<HTMLElement>('*');

    for (const el of all) {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);

      if (!isNaN(zIndex) && zIndex >= this.options.minZIndex) {
        const position = style.position;
        if (position === 'fixed' || position === 'absolute') {
          elements.push(el);
        }
      }
    }

    return elements;
  }

  /**
   * Find elements that cover significant screen area
   */
  private findCoveringElements(): HTMLElement[] {
    const elements: HTMLElement[] = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const minCoverage = 0.5; // 50% of viewport

    const all = document.querySelectorAll<HTMLElement>('*');

    for (const el of all) {
      const style = window.getComputedStyle(el);
      const position = style.position;

      if (position !== 'fixed' && position !== 'absolute') {
        continue;
      }

      const rect = el.getBoundingClientRect();
      const coverage = (rect.width * rect.height) / (viewportWidth * viewportHeight);

      if (coverage >= minCoverage) {
        elements.push(el);
      }
    }

    return elements;
  }

  /**
   * Analyze a candidate element and extract modal information
   */
  private analyzeCandidate(element: HTMLElement): ModalInfo | null {
    let confidence = 0;
    let detectionMethods: string[] = [];
    const metadata: ModalInfo['metadata'] = {
      detectionMethod: '',
    };

    // Check ARIA attributes
    const hasRoleDialog = element.getAttribute('role') === 'dialog' ||
      element.getAttribute('role') === 'alertdialog';
    const hasAriaModal = element.getAttribute('aria-modal') === 'true';

    if (hasRoleDialog) {
      confidence += 0.4;
      detectionMethods.push('aria-role');
      metadata.hasRoleDialog = true;
    }

    if (hasAriaModal) {
      confidence += 0.3;
      detectionMethods.push('aria-modal');
      metadata.hasAriaModal = true;
    }

    // Check class names
    const className = element.className;
    for (const pattern of MODAL_CLASS_PATTERNS) {
      if (pattern.test(className)) {
        confidence += 0.2;
        detectionMethods.push('class-pattern');
        break;
      }
    }

    // Check z-index
    const style = window.getComputedStyle(element);
    const zIndex = parseInt(style.zIndex, 10);
    if (!isNaN(zIndex) && zIndex >= this.options.minZIndex) {
      confidence += 0.1;
      detectionMethods.push('z-index');
    }

    // Check position and coverage
    const position = style.position;
    if (position === 'fixed' || position === 'absolute') {
      confidence += 0.1;
      detectionMethods.push('positioning');
    }

    // Minimum confidence threshold
    if (confidence < 0.3) {
      return null;
    }

    // Find dismiss button
    const dismissButton = this.findDismissButton(element);

    // Find backdrop
    const backdrop = this.findBackdrop(element);

    // Determine modal type
    const type = this.determineModalType(element);

    // Find accept button for GDPR/cookie modals
    const acceptButton = (type === 'cookie-consent' || type === 'gdpr')
      ? this.findAcceptButton(element)
      : null;

    // Check if this is likely a first visit (for GDPR/cookie detection)
    if (type === 'cookie-consent' || type === 'gdpr') {
      metadata.isFirstVisit = this.isLikelyFirstVisit();
    }

    metadata.detectionMethod = detectionMethods.join(', ');

    return {
      element,
      type,
      dismissButton,
      acceptButton,
      confidence: Math.min(confidence, 1.0),
      backdrop,
      zIndex: zIndex || 0,
      metadata,
    };
  }

  /**
   * Find dismiss button within modal
   */
  private findDismissButton(modal: HTMLElement): HTMLElement | null {
    // Strategy 1: Look for buttons with dismiss-related text
    const buttons = modal.querySelectorAll<HTMLElement>('button, [role="button"], a');

    for (const button of buttons) {
      const text = button.textContent?.trim() || '';
      const ariaLabel = button.getAttribute('aria-label') || '';
      const className = button.className;

      // Check text content
      for (const pattern of DISMISS_BUTTON_PATTERNS.text) {
        if (pattern.test(text)) {
          return button;
        }
      }

      // Check ARIA label
      for (const pattern of DISMISS_BUTTON_PATTERNS.aria) {
        if (pattern.test(ariaLabel)) {
          return button;
        }
      }

      // Check class name
      for (const pattern of DISMISS_BUTTON_PATTERNS.classes) {
        if (pattern.test(className)) {
          return button;
        }
      }
    }

    // Strategy 2: Look for close icon (often an X or × character)
    const closeIcons = modal.querySelectorAll<HTMLElement>('[class*="close"], [class*="dismiss"]');
    if (closeIcons.length > 0) {
      return closeIcons[0];
    }

    return null;
  }

  /**
   * Find "Accept All" button for GDPR/cookie modals
   */
  private findAcceptButton(modal: HTMLElement): HTMLElement | null {
    const buttons = modal.querySelectorAll<HTMLElement>('button, [role="button"], a, input[type="button"], input[type="submit"]');

    // Sort by specificity - "Accept All" is better than just "Accept"
    const matches: Array<{ button: HTMLElement; score: number }> = [];

    for (const button of buttons) {
      const text = button.textContent?.trim() || '';
      const ariaLabel = button.getAttribute('aria-label') || '';
      const className = button.className;
      const id = button.id;

      let score = 0;

      // Check text content (highest priority)
      for (let i = 0; i < ACCEPT_ALL_BUTTON_PATTERNS.text.length; i++) {
        if (ACCEPT_ALL_BUTTON_PATTERNS.text[i].test(text)) {
          score = 100 - i; // Earlier patterns = higher score
          break;
        }
      }

      // Check ARIA label
      if (score === 0) {
        for (let i = 0; i < ACCEPT_ALL_BUTTON_PATTERNS.aria.length; i++) {
          if (ACCEPT_ALL_BUTTON_PATTERNS.aria[i].test(ariaLabel)) {
            score = 50 - i;
            break;
          }
        }
      }

      // Check class/id names
      if (score === 0) {
        for (let i = 0; i < ACCEPT_ALL_BUTTON_PATTERNS.classes.length; i++) {
          if (ACCEPT_ALL_BUTTON_PATTERNS.classes[i].test(className) ||
              ACCEPT_ALL_BUTTON_PATTERNS.classes[i].test(id)) {
            score = 25 - i;
            break;
          }
        }
      }

      if (score > 0) {
        matches.push({ button, score });
      }
    }

    // Return highest scoring button
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      return matches[0].button;
    }

    return null;
  }

  /**
   * Find backdrop element associated with modal
   */
  private findBackdrop(modal: HTMLElement): HTMLElement | null {
    // Check siblings
    const parent = modal.parentElement;
    if (!parent) return null;

    for (const sibling of Array.from(parent.children)) {
      if (sibling === modal) continue;

      const className = (sibling as HTMLElement).className;
      for (const pattern of BACKDROP_CLASS_PATTERNS) {
        if (pattern.test(className)) {
          return sibling as HTMLElement;
        }
      }
    }

    // Check parent
    const parentClass = parent.className;
    for (const pattern of BACKDROP_CLASS_PATTERNS) {
      if (pattern.test(parentClass)) {
        return parent;
      }
    }

    return null;
  }

  /**
   * Determine the type of modal
   */
  private determineModalType(element: HTMLElement): ModalType {
    const text = element.textContent?.toLowerCase() || '';
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    const combined = `${text} ${className} ${id}`;

    for (const [type, patterns] of Object.entries(MODAL_TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return type as ModalType;
        }
      }
    }

    // If it has typical modal attributes but we can't determine type
    if (element.getAttribute('role') === 'dialog') {
      return 'generic';
    }

    return 'unknown';
  }

  /**
   * Check if element is visible
   */
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      parseFloat(style.opacity) > 0
    );
  }

  /**
   * Check if this is likely a first visit (no cookies for current origin)
   * GDPR/cookie modals typically only show on:
   * 1. First visit (no cookies)
   * 2. Root path or first page in browsing session
   */
  private isLikelyFirstVisit(): boolean {
    try {
      // Check if there are any cookies for this origin
      const hasCookies = document.cookie.length > 0;

      // Check if we're on a root or landing page
      const isRootPath = window.location.pathname === '/' ||
                        window.location.pathname === '' ||
                        window.location.pathname.match(/^\/index\.(html|php|htm)$/i);

      // Check if this is a fresh navigation (no referrer or different origin)
      const isNewSession = !document.referrer ||
                          new URL(document.referrer).origin !== window.location.origin;

      // Likely first visit if: no cookies AND (root path OR new session)
      return !hasCookies && (isRootPath || isNewSession);
    } catch (error) {
      console.warn('[Modal Detector] Error checking first visit status:', error);
      return false;
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Detect the primary modal on the page
 */
export function detectModal(options?: ModalDetectionOptions): ModalInfo | null {
  const detector = new ModalDetector(options);
  return detector.detectPrimary();
}

/**
 * Detect all modals on the page
 */
export function detectAllModals(options?: ModalDetectionOptions): ModalInfo[] {
  const detector = new ModalDetector(options);
  return detector.detectAll();
}
