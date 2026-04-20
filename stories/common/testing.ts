// SPDX-License-Identifier: MIT

export interface TestingParametersOptions {
  disableSnapshot?: boolean;
}

export const DYNAMIC_TEST_TAGS = ['test', 'dynamic'] as const;

export const createTestingParameters = (
  element: string,
  options: TestingParametersOptions = {}
) => {
  const { disableSnapshot = false } = options;

  return {
    test: {
      enabled: true,
      a11y: {
        element,
        config: {
          rules: {
            'color-contrast': { enabled: true },
          },
        },
      },
    },
    ...(disableSnapshot ? {
      chromatic: {
        disableSnapshot: true,
      },
    } : {}),
  };
};
