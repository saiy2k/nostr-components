import { FUNDRAISER_PARAMETERS as PARAMETERS } from './parameters';
import { generateArgTypes } from '../common/utils';
import {
  BUNDLE_SCRIPT,
  generateBundleScript,
  generateCode as generateCodeShared,
  generateCodeWithScript as generateCodeWithScriptShared,
  type CodeGeneratorConfig,
} from '../common/code-generator';
import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
import { renderFundraiser, type RenderFundraiserOptions } from '../../src/nostr-fundraiser/render';
import type { ParsedFundraiserEvent } from '../../src/nostr-fundraiser/fundraiser-utils';
import { getFundraiserStyles } from '../../src/nostr-fundraiser/style';

export const COMPONENT_CONFIG: CodeGeneratorConfig = {
  componentName: 'nostr-fundraiser',
  defaultWidth: 760,
  eventHandlers: [],
  gridColumns: 'minmax(760px, 1fr)',
};

export const DEFAULT_WIDTH = COMPONENT_CONFIG.defaultWidth;
export { BUNDLE_SCRIPT, generateBundleScript };

export const getArgTypes = () => generateArgTypes(PARAMETERS, []);

const PREVIEW_HOST_CLASS = 'nostr-fundraiser-story-preview';

const PREVIEW_AUTHOR: NDKUserProfile = {
  displayName: 'Open Source Builder',
};

const PREVIEW_FUNDRAISER: ParsedFundraiserEvent = {
  content: 'Help fund the next round of extension work for like and zap buttons on mainstream apps.',
  title: 'Support browser extension work',
  description: 'Help fund the next round of extension work for like and zap buttons on mainstream apps.',
  summary: 'Support browser extension work',
  targetAmountMsats: 21_000_000,
  targetAmountSats: 21_000,
  relays: ['wss://relay.damus.io', 'wss://nos.lol'],
  resourceUrl: 'https://github.com/saiy2k/nostr-components/issues/11',
  beneficiaryZapTags: [],
};

function getPreviewStyles(): string {
  return getFundraiserStyles()
    .replace(/:host\(([^)]+)\)/g, `.${PREVIEW_HOST_CLASS}$1`)
    .replace(/:host/g, `.${PREVIEW_HOST_CLASS}`);
}

export function hasFundraiserIdentifier(args: any = {}): boolean {
  return Boolean(args.hex || args.noteid || args.eventid);
}

export const generateCode = (args: any, forCodeGen = false) => {
  return generateCodeShared({
    args,
    config: COMPONENT_CONFIG,
    cssVariables: [],
    forCodeGen,
  });
};

export const generateCodeWithScript = (args: any) => {
  return generateCodeWithScriptShared({
    args,
    config: COMPONENT_CONFIG,
    cssVariables: [],
  });
};

export const generatePreviewHTML = (
  args: any = {},
  overrides: Partial<RenderFundraiserOptions> = {}
) => {
  const width = args.width ?? DEFAULT_WIDTH;
  const actionLabel = args.text || 'Zap fundraiser';
  const previewOptions: RenderFundraiserOptions = {
    isLoading: false,
    isError: false,
    errorMessage: '',
    author: PREVIEW_AUTHOR,
    parsedFundraiser: PREVIEW_FUNDRAISER,
    totalRaised: 12_600,
    donorCount: 18,
    percentRaised: 60,
    remainingAmount: 8_400,
    isClosed: false,
    isDonationsLoading: false,
    actionLabel,
    createdAtLabel: 'Preview fixture',
    ...overrides,
  };

  return `
    <div class="${PREVIEW_HOST_CLASS}" style="width: ${width}px;">
      ${getPreviewStyles()}
      ${renderFundraiser(previewOptions)}
    </div>
  `.trim();
};

export const generateManualInputHTML = (args: any = {}) => {
  return hasFundraiserIdentifier(args)
    ? generateCode(args)
    : generatePreviewHTML(args, {
        createdAtLabel: 'Preview until identifier is pasted',
      });
};
