import { useEffect, useState } from 'preact/hooks';

/** Hash routes (#/profile, #/s/abc/2) so the static Pages build needs no rewrites. */
export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = `${location.pathname}${location.search}#${path}`;
  if (opts.replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Navigate with a short fade: the current screen fades out, then the next one
 * fades in (every .screen plays an enter animation when it mounts).
 */
export function go(path: string, opts: { replace?: boolean } = {}) {
  const root = document.documentElement;
  if (reducedMotion() || root.classList.contains('leaving')) return navigate(path, opts);
  root.classList.add('leaving');
  setTimeout(() => {
    navigate(path, opts);
    // Let the next screen render before lifting the fade-out.
    setTimeout(() => root.classList.remove('leaving'), 0);
  }, 170);
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return path;
}

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const s = path.split('/');
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
