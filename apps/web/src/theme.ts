const themes = ['violeta', 'cobalto', 'menta'] as const;

export function applyTheme(name: string | null | undefined): typeof themes[number] {
  const theme = themes.find(value => value === name) ?? 'violeta';
  document.documentElement.dataset.theme = theme;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  return theme;
}
