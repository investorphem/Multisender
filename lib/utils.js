export function cn(...args) {
  return args.filter(Boolean).join(' ');
}

export function shorten(addr = '') {
  if (!addr) return '';
  if (addr.length < 10) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}