let mobileOverride: boolean | null = null;

export function isMobile(): boolean {
  if (mobileOverride !== null) return mobileOverride;
  const ua = navigator.userAgent;
  return /android|iphone|ipad|ipod/i.test(ua);
}

export function setMobileOverride(value: boolean) {
  mobileOverride = value;
}
