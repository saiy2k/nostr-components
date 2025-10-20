# DialogComponent

A reusable base dialog component for creating modal dialogs with consistent behavior and styling.

## Features

- Header with customizable title (via `header` attribute)
- Built-in close button (×)
- Three close mechanisms: ESC key, click outside, close button
- Automatic cleanup on close
- Theme support via CSS variables

## Usage

```typescript
// Import for side effects to register custom element
import '../base/dialog-component/dialog-component';
import type { DialogComponent } from '../base/dialog-component/dialog-component';

// Create and show dialog
export const showMyDialog = async (): Promise<void> => {
  if (!customElements.get('dialog-component')) {
    await customElements.whenDefined('dialog-component');
  }
  
  const dialogComponent = document.createElement('dialog-component') as DialogComponent;
  dialogComponent.setAttribute('header', 'Dialog Title');
  
  dialogComponent.innerHTML = `
    <div class="my-dialog-content">
      <p>Your content goes here</p>
    </div>
  `;
  
  dialogComponent.showModal();
};
```

## API

### Attributes
- `header` (string) - Text displayed in dialog header (default: "Dialog")
- `data-theme` (string) - Theme variant ('light' or 'dark')

### Methods
- `showModal()` - Opens dialog as modal
- `close()` - Closes dialog and triggers cleanup

## Styling

### Base Styles (Provided)
- `.nostr-base-dialog` - Main dialog wrapper
- `.dialog-header` - Header container
- `.dialog-close-btn` - Close button

### Content Styles (Your Responsibility)
Create a separate style file for your dialog content:

```typescript
export const getMyDialogStyles = (): string => {
  return `
    .my-dialog-content {
      /* Your styles */
    }
  `;
};
```

## Best Practices

✅ **Do:**
- Import for side effects to register the element
- Use type-only import for TypeScript
- Create unique class names for your content
- Keep content styles in separate files

❌ **Don't:**
- Don't append DialogComponent to DOM manually
- Don't create close button or header manually
- Don't duplicate base dialog styles

