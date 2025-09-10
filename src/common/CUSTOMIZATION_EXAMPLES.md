# Nostr Components Customization Examples

This document shows how developers can customize the appearance of Nostr components using the centralized design token system.

## Quick Start

### 1. Global Theme Customization

Override design tokens globally to customize all components:

```css
:root {
  /* Custom color scheme */
  --nostrc-color-background-light: #f8f9fa;
  --nostrc-color-background-dark: #0d1117;
  --nostrc-color-text-primary-light: #212529;
  --nostrc-color-text-primary-dark: #f0f6fc;
  --nostrc-color-accent: #007bff;
  
  /* Custom spacing */
  --nostrc-spacing-lg: 20px;
  --nostrc-spacing-xl: 24px;
  
  /* Custom typography */
  --nostrc-font-family-primary: 'Roboto', sans-serif;
  --nostrc-font-weight-bold: 600;
  
  /* Custom borders */
  --nostrc-border-radius-md: 12px;
  --nostrc-border-width: 2px;
}
```

### 2. Component-Specific Customization

Override tokens for specific components:

```css
/* Customize profile badge only */
nostr-profile-badge {
  --nostrc-color-background-light: #ffffff;
  --nostrc-spacing-lg: 24px;
  --nostrc-border-radius-md: 16px;
}

/* Customize follow button only */
nostr-follow-button {
  --nostrc-color-accent: #28a745;
  --nostrc-spacing-lg: 12px;
}
```

## Complete Examples

### Example 1: Corporate Brand Theme

```css
:root {
  /* Corporate blue theme */
  --nostrc-color-background-light: #ffffff;
  --nostrc-color-background-dark: #1e1e1e;
  --nostrc-color-text-primary-light: #1a1a1a;
  --nostrc-color-text-primary-dark: #ffffff;
  --nostrc-color-text-secondary-light: #4a4a4a;
  --nostrc-color-text-secondary-dark: #e0e0e0;
  --nostrc-color-text-muted-light: #8a8a8a;
  --nostrc-color-text-muted-dark: #a0a0a0;
  --nostrc-color-border-light: #e1e5e9;
  --nostrc-color-border-dark: #2d2d2d;
  --nostrc-color-accent: #0066cc;
  
  /* Corporate typography */
  --nostrc-font-family-primary: 'Segoe UI', 'Helvetica Neue', sans-serif;
  --nostrc-font-weight-medium: 500;
  --nostrc-font-weight-bold: 600;
  
  /* Corporate spacing */
  --nostrc-spacing-sm: 6px;
  --nostrc-spacing-md: 10px;
  --nostrc-spacing-lg: 16px;
  --nostrc-spacing-xl: 20px;
  
  /* Corporate borders */
  --nostrc-border-radius-sm: 3px;
  --nostrc-border-radius-md: 6px;
  --nostrc-border-radius-lg: 8px;
}
```

### Example 2: Minimalist Theme

```css
:root {
  /* Minimalist theme */
  --nostrc-color-background-light: #fafafa;
  --nostrc-color-background-dark: #111111;
  --nostrc-color-text-primary-light: #000000;
  --nostrc-color-text-primary-dark: #ffffff;
  --nostrc-color-text-secondary-light: #333333;
  --nostrc-color-text-secondary-dark: #cccccc;
  --nostrc-color-text-muted-light: #666666;
  --nostrc-color-text-muted-dark: #999999;
  --nostrc-color-border-light: #e0e0e0;
  --nostrc-color-border-dark: #333333;
  --nostrc-color-accent: #000000;
  
  /* Minimalist typography */
  --nostrc-font-family-primary: 'Inter', 'system-ui', sans-serif;
  --nostrc-font-weight-normal: 400;
  --nostrc-font-weight-medium: 500;
  --nostrc-font-weight-bold: 600;
  
  /* Minimalist spacing */
  --nostrc-spacing-xs: 2px;
  --nostrc-spacing-sm: 4px;
  --nostrc-spacing-md: 8px;
  --nostrc-spacing-lg: 12px;
  --nostrc-spacing-xl: 16px;
  
  /* Minimalist borders */
  --nostrc-border-radius-sm: 2px;
  --nostrc-border-radius-md: 4px;
  --nostrc-border-radius-lg: 6px;
  --nostrc-border-width: 1px;
}
```

### Example 3: High Contrast Accessibility Theme

```css
:root {
  /* High contrast theme for accessibility */
  --nostrc-color-background-light: #ffffff;
  --nostrc-color-background-dark: #000000;
  --nostrc-color-text-primary-light: #000000;
  --nostrc-color-text-primary-dark: #ffffff;
  --nostrc-color-text-secondary-light: #000000;
  --nostrc-color-text-secondary-dark: #ffffff;
  --nostrc-color-text-muted-light: #000000;
  --nostrc-color-text-muted-dark: #ffffff;
  --nostrc-color-border-light: #000000;
  --nostrc-color-border-dark: #ffffff;
  --nostrc-color-accent: #0000ff;
  
  /* High contrast typography */
  --nostrc-font-family-primary: 'Arial', sans-serif;
  --nostrc-font-weight-bold: 700;
  
  /* High contrast spacing */
  --nostrc-spacing-lg: 20px;
  --nostrc-spacing-xl: 24px;
  
  /* High contrast borders */
  --nostrc-border-width: 2px;
}
```

## Advanced Customization

### Custom Component Variants

Create different variants of components:

```css
/* Compact variant */
nostr-profile-badge.compact {
  --nostrc-spacing-lg: 8px;
  --nostrc-spacing-md: 4px;
  --nostrc-font-size-small: 0.7em;
}

/* Large variant */
nostr-profile-badge.large {
  --nostrc-spacing-lg: 32px;
  --nostrc-spacing-md: 16px;
  --nostrc-font-size-base: 1.2em;
}

/* Rounded variant */
nostr-profile-badge.rounded {
  --nostrc-border-radius-md: 24px;
  --nostrc-border-radius-lg: 32px;
}
```

### Responsive Customization

Customize components based on screen size:

```css
/* Mobile customization */
@media (max-width: 768px) {
  :root {
    --nostrc-spacing-lg: 12px;
    --nostrc-font-size-base: 0.9em;
  }
  
  nostr-profile-badge {
    --nostrc-spacing-lg: 8px;
  }
}

/* Desktop customization */
@media (min-width: 1200px) {
  :root {
    --nostrc-spacing-lg: 24px;
    --nostrc-font-size-base: 1.1em;
  }
}
```

### Dark Mode with System Preference

```css
/* Light mode (default) */
:root {
  --nostrc-color-background-light: #ffffff;
  --nostrc-color-background-dark: #1a1a1a;
  --nostrc-color-text-primary-light: #111111;
  --nostrc-color-text-primary-dark: #ffffff;
}

/* Dark mode override */
@media (prefers-color-scheme: dark) {
  :root {
    --nostrc-color-background-dark: #0d1117;
    --nostrc-color-text-primary-dark: #f0f6fc;
    --nostrc-color-border-dark: #30363d;
  }
}

/* Force dark mode */
[data-theme="dark"] {
  --nostrc-color-background: var(--nostrc-color-background-dark);
  --nostrc-color-text-primary: var(--nostrc-color-text-primary-dark);
  --nostrc-color-border: var(--nostrc-color-border-dark);
}
```

## Integration Examples

### With CSS Frameworks

#### Tailwind CSS Integration
```css
:root {
  /* Use Tailwind colors */
  --nostrc-color-background-light: theme('colors.white');
  --nostrc-color-background-dark: theme('colors.gray.900');
  --nostrc-color-text-primary-light: theme('colors.gray.900');
  --nostrc-color-text-primary-dark: theme('colors.white');
  --nostrc-color-accent: theme('colors.blue.500');
  
  /* Use Tailwind spacing */
  --nostrc-spacing-sm: theme('spacing.2');
  --nostrc-spacing-md: theme('spacing.3');
  --nostrc-spacing-lg: theme('spacing.4');
  --nostrc-spacing-xl: theme('spacing.5');
}
```

#### Bootstrap Integration
```css
:root {
  /* Use Bootstrap colors */
  --nostrc-color-background-light: var(--bs-white);
  --nostrc-color-background-dark: var(--bs-dark);
  --nostrc-color-text-primary-light: var(--bs-dark);
  --nostrc-color-text-primary-dark: var(--bs-light);
  --nostrc-color-accent: var(--bs-primary);
  
  /* Use Bootstrap spacing */
  --nostrc-spacing-sm: var(--bs-spacer-1);
  --nostrc-spacing-md: var(--bs-spacer-2);
  --nostrc-spacing-lg: var(--bs-spacer-3);
  --nostrc-spacing-xl: var(--bs-spacer-4);
}
```

### With Design Systems

#### Material Design Integration
```css
:root {
  /* Use Material Design colors */
  --nostrc-color-background-light: #fafafa;
  --nostrc-color-background-dark: #121212;
  --nostrc-color-text-primary-light: rgba(0, 0, 0, 0.87);
  --nostrc-color-text-primary-dark: rgba(255, 255, 255, 0.87);
  --nostrc-color-accent: #6200ea;
  
  /* Use Material Design spacing */
  --nostrc-spacing-sm: 8px;
  --nostrc-spacing-md: 16px;
  --nostrc-spacing-lg: 24px;
  --nostrc-spacing-xl: 32px;
  
  /* Use Material Design borders */
  --nostrc-border-radius-sm: 4px;
  --nostrc-border-radius-md: 8px;
  --nostrc-border-radius-lg: 16px;
}
```

## Best Practices

### 1. Consistent Naming
Use consistent naming for your custom tokens:
```css
:root {
  /* Good: Follow the nstrc- prefix pattern */
  --nostrc-color-accent: #your-brand-color;
  --nostrc-spacing-lg: 20px;
  
  /* Avoid: Custom prefixes */
  --my-custom-color: #color;
}
```

### 2. Semantic Values
Use semantic values that make sense:
```css
:root {
  /* Good: Semantic spacing */
  --nostrc-spacing-lg: 20px;
  
  /* Avoid: Arbitrary values */
  --nostrc-spacing-lg: 17px;
}
```

### 3. Test Both Themes
Always test your customizations with both light and dark themes:
```css
:root {
  /* Define both light and dark values */
  --nostrc-color-background-light: #ffffff;
  --nostrc-color-background-dark: #1a1a1a;
}
```

### 4. Document Your Customizations
Document your customizations for your team:
```css
/* 
 * Corporate Brand Theme
 * 
 * Colors: Corporate blue (#0066cc) with neutral grays
 * Typography: Segoe UI for modern corporate look
 * Spacing: Generous spacing for readability
 * Borders: Subtle rounded corners
 */
:root {
  --nostrc-color-accent: #0066cc;
  --nostrc-font-family-primary: 'Segoe UI', sans-serif;
  --nostrc-spacing-lg: 20px;
  --nostrc-border-radius-md: 8px;
}
```

This customization system gives you complete control over the appearance of Nostr components while maintaining consistency and ease of maintenance!
