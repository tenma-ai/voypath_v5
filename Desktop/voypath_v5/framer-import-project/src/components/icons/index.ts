// Icon exports
export { default as CheckIcon } from './CheckIcon';
export { default as AppStoreIcon } from './AppStoreIcon';
export { default as GooglePlayIcon } from './GooglePlayIcon';
export { default as SecurityIcon } from './SecurityIcon';
export { default as ClockIcon } from './ClockIcon';
export { default as InfoIcon } from './InfoIcon';
export { default as Logo } from '../Logo';

// Emoji icons (as constants)
export const EMOJI_ICONS = {
  MAP: '🗺️',
  PEOPLE: '👥',
  PIN: '📍',
  SPARKLES: '✨',
} as const;

// Icon sizes (common sizes)
export const ICON_SIZES = {
  XS: 16,
  SM: 20,
  MD: 24,
  LG: 28,
  XL: 32,
} as const;

// Icon types for TypeScript
export type IconProps = {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
};

export type EmojiIcon = typeof EMOJI_ICONS[keyof typeof EMOJI_ICONS];
export type IconSize = typeof ICON_SIZES[keyof typeof ICON_SIZES];