export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLinkedMessage(target: HTMLElement, label: string, url: string): void {
  target.textContent = '';

  const labelElement = document.createElement('span');
  labelElement.className = 'label';
  labelElement.textContent = label;

  const spacer = document.createTextNode(' ');
  const link = document.createElement('a');
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
    }
    link.href = parsed.toString();
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = parsed.toString();
  } catch {
    link.removeAttribute('href');
    link.textContent = url;
  }

  target.append(labelElement, spacer, link);
}

export function renderIssueList(
  target: HTMLElement,
  issues: string[],
  heading = 'Fix these issues before continuing:'
): void {
  target.textContent = '';
  if (issues.length === 0) return;

  const headingElement = document.createElement('p');
  headingElement.className = 'error-heading';
  headingElement.textContent = heading;

  const list = document.createElement('ul');
  list.className = 'error-list';
  for (const issue of issues) {
    const item = document.createElement('li');
    item.textContent = issue;
    list.append(item);
  }

  target.append(headingElement, list);
}
