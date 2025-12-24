const isFirefoxUserAgent = typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
const isOptimizationDisabled = typeof localStorage !== 'undefined' && localStorage.getItem('spotify_scrobbler_disable_optimization') === 'true';

// We only report "isFirefox" (which triggers optimizations) if:
// 1. It IS Firefox
// 2. The user has NOT explicitly disabled optimizations
export const isFirefox = isFirefoxUserAgent && !isOptimizationDisabled;

export const isActualFirefox = isFirefoxUserAgent;
