// SPDX-License-Identifier: MIT

/**
 * Primary Attribute Changes Utility
 * ================================
 * 
 * This file contains a shared utility for creating play functions that cycle through
 * primary attributes (npub/nip05/pubkey or eventid/noteid/hex) in dynamic stories.
 * 
 * Features:
 * - Automatic cleanup of intervals to prevent memory leaks
 * - Configurable update intervals
 * - Console logging for debugging
 * - Component-specific cleanup functions
 */

/**
 * Creates a play function for primary attribute changes
 * 
 * @param componentName - The component selector (e.g., 'nostr-post', 'nostr-follow-button')
 * @param inputAttributes - Array of input attributes to clear (e.g., ['noteid', 'hex', 'eventid'])
 * @param testInputs - Array of test inputs with type, value, and name
 * @param updateInterval - Interval in milliseconds between updates (default: 8000)
 * @returns A play function that can be used in Storybook stories
 */
export function createPrimaryAttributeChangesPlay(
  componentName: string,
  inputAttributes: string[],
  testInputs: Array<{ type: string; value: string; name: string }>,
  updateInterval: number = 8000
) {
  return async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector(componentName);
    if (!component) return;

    let currentIndex = 0;
    let intervalId: NodeJS.Timeout;
    
    const updateInput = () => {
      currentIndex = (currentIndex + 1) % testInputs.length;
      const input = testInputs[currentIndex];
      
      // Clear all input attributes first
      inputAttributes.forEach(attr => component.removeAttribute(attr));
      
      // Set the new input attribute
      component.setAttribute(input.type, input.value);
      
      console.log(`Updated ${input.type} to: ${input.name}`);
    };

    // Start the interval
    intervalId = setInterval(updateInput, updateInterval);
    
    // Store cleanup function on the component for potential cleanup
    (component as any).__cleanup = () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log(`${componentName}: Interval cleared`);
      }
    };
  };
}
