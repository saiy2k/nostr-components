// SPDX-License-Identifier: MIT

/**
 * Fast Switching Dynamic Stories Utility
 * =====================================
 * 
 * This file contains a shared utility for creating fast switching dynamic stories
 * that rapidly alternate between two different attributes with pause patterns.
 * 
 * Features:
 * - Fast updates with random delays (100-200ms)
 * - Alternating between two different attributes
 * - Pause pattern after specified number of updates
 * - Status display with current configuration
 * - Change logging with timestamps
 * - Automatic cleanup to prevent memory leaks
 * - Configurable update counts and pause duration
 */

export interface FastSwitchingConfig {
  componentName: string;
  attribute1: {
    name: string;
    values: Array<{ value: string; name: string }>;
  };
  attribute2: {
    name: string;
    values: Array<{ value: string; name: string }>;
  };
  maxFastUpdates?: number;
  pauseDuration?: number;
  fastDelayMin?: number;
  fastDelayMax?: number;
}

/**
 * Creates a fast switching dynamic story play function
 * 
 * @param config - Configuration object for the fast switching story
 * @returns A play function that can be used in Storybook stories
 */
export function createFastSwitchingPlay(config: FastSwitchingConfig) {
  const {
    componentName,
    attribute1,
    attribute2,
    maxFastUpdates = 10,
    pauseDuration = 15000,
    fastDelayMin = 100,
    fastDelayMax = 200
  } = config;

  return async ({ canvasElement }) => {
    // Wait for component to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = canvasElement.querySelector(componentName);
    if (!component) return;

    // Create status display container
    const statusContainer = document.createElement('div');
    statusContainer.style.cssText = `
      margin-top: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
    `;
    
    const statusHTML = `
      <h4 style="margin: 0 0 12px 0; color: #495057; font-size: 14px;">Current Configuration</h4>
      <div id="current-${attribute1.name}" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="current-${attribute2.name}" style="margin-bottom: 8px; font-family: monospace; font-size: 12px;"></div>
      <div id="change-log" style="font-size: 11px; color: #6c757d; height: 500px; max-height: 500px; overflow-y: auto;"></div>
    `;

    statusContainer.innerHTML = statusHTML;
    component.parentNode?.insertBefore(statusContainer, component.nextSibling);

    // Initialize state
    let attr1Index = 0;
    let attr2Index = 0;
    let changeCount = 0;
    let isFastMode = true;
    let fastUpdateCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    // Helper functions
    const updateStatus = (currentAttr1?: any, currentAttr2?: any) => {
      const attr1El = document.getElementById(`current-${attribute1.name}`);
      const attr2El = document.getElementById(`current-${attribute2.name}`);
      
      if (attr1El && currentAttr1) {
        const displayValue = currentAttr1.value.length > 20 
          ? `${currentAttr1.value.substring(0, 20)}...` 
          : currentAttr1.value;
        attr1El.innerHTML = `<strong>${attribute1.name}:</strong> ${currentAttr1.name} (${displayValue})`;
      }
      
      if (attr2El && currentAttr2) {
        const displayValue = currentAttr2.value.length > 20 
          ? `${currentAttr2.value.substring(0, 20)}...` 
          : currentAttr2.value;
        attr2El.innerHTML = `<strong>${attribute2.name}:</strong> ${currentAttr2.name} (${displayValue})`;
      }
    };

    const addLog = (message: string) => {
      const logEl = document.getElementById('change-log');
      if (logEl) {
        const timestamp = new Date().toLocaleTimeString();
        logEl.innerHTML = `${timestamp}: ${message}<br>` + logEl.innerHTML;
        const entries = logEl.innerHTML.split('<br>');
        if (entries.length > 40) {
          logEl.innerHTML = entries.slice(0, 40).join('<br>');
        }
      }
    };

    const updateAttribute1 = () => {
      const currentValue = attribute1.values[attr1Index];
      
      // Update attribute
      if (currentValue.value) {
        component.setAttribute(attribute1.name, currentValue.value);
      } else {
        component.removeAttribute(attribute1.name);
      }
      
      // Log and update display
      addLog(`${attribute1.name} changed to ${currentValue.name}`);
      console.log(`${attribute1.name} change ${++changeCount}:`, {
        [attribute1.name]: `${currentValue.name} (${currentValue.value})`
      });
      
      updateStatus(currentValue, null);
      
      // Move to next value
      attr1Index = (attr1Index + 1) % attribute1.values.length;
    };

    const updateAttribute2 = () => {
      const currentValue = attribute2.values[attr2Index];
      
      // Update attribute
      if (currentValue.value) {
        component.setAttribute(attribute2.name, currentValue.value);
      } else {
        component.removeAttribute(attribute2.name);
      }
      
      // Log and update display
      addLog(`${attribute2.name} changed to ${currentValue.name}`);
      console.log(`${attribute2.name} change ${++changeCount}:`, {
        [attribute2.name]: `${currentValue.name} (${currentValue.value})`
      });
      
      updateStatus(null, currentValue);
      
      // Move to next value
      attr2Index = (attr2Index + 1) % attribute2.values.length;
    };

    const performFastUpdate = () => {
      if (fastUpdateCount >= maxFastUpdates) {
        // Switch to pause mode
        isFastMode = false;
        fastUpdateCount = 0;
        addLog(`Pausing for ${pauseDuration}ms...`);
        console.log(`Switching to pause mode for ${pauseDuration}ms`);
        
        // Schedule next fast cycle after pause
        timeoutId = setTimeout(() => {
          isFastMode = true;
          addLog(`Resuming fast updates...`);
          console.log('Resuming fast updates');
          performFastUpdate();
        }, pauseDuration);
        return;
      }

      // Alternate between attribute updates
      if (fastUpdateCount % 2 === 0) {
        updateAttribute1();
      } else {
        updateAttribute2();
      }

      fastUpdateCount++;

      // Schedule next fast update with random delay
      const nextDelay = fastDelayMin + Math.random() * (fastDelayMax - fastDelayMin);
      timeoutId = setTimeout(performFastUpdate, nextDelay);
    };

    // Initial status update
    updateStatus(attribute1.values[attr1Index], attribute2.values[attr2Index]);

    // Start the fast update cycle
    addLog(`Starting fast update cycle...`);
    performFastUpdate();
    
    // Cleanup
    (component as any).__cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        console.log(`${componentName}: Timeout cleared`);
      }
    };
  };
}
