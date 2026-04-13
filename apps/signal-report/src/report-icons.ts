// lucide-static is tree-shakable (sideEffects: false), so these named
// imports bundle down to just the 10 SVG strings we reference.
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Eye,
  MousePointerClick,
  Smartphone,
  TrendingUp,
  Users,
  Zap
} from 'lucide-static';

export type IconName =
  | 'alertCircle'
  | 'alertTriangle'
  | 'arrowRight'
  | 'checkCircle'
  | 'eye'
  | 'mousePointerClick'
  | 'smartphone'
  | 'trendingUp'
  | 'users'
  | 'zap';

const ICONS: Record<IconName, string> = {
  alertCircle: AlertCircle,
  alertTriangle: AlertTriangle,
  arrowRight: ArrowRight,
  checkCircle: CheckCircle,
  eye: Eye,
  mousePointerClick: MousePointerClick,
  smartphone: Smartphone,
  trendingUp: TrendingUp,
  users: Users,
  zap: Zap
};

/**
 * Render a Lucide icon as an inline SVG string. Each Lucide icon comes as a
 * raw SVG with `stroke="currentColor"`, so icons automatically inherit the
 * tier / mood colour from their context. The helper injects a caller-supplied
 * class plus `aria-hidden="true"` so the SVG is decorative to screen readers
 * (accessible labels live on the surrounding text, not the icon itself).
 */
export function renderIcon(name: IconName, className = 'sr-icon'): string {
  const svg = ICONS[name];
  if (!svg) return '';
  // Lucide strings start with a fresh line and `<svg`. Replace the opening
  // tag so we can inject our own class + aria-hidden without stripping the
  // existing lucide-* identifier class (keeps devtools recognisable).
  return svg.replace('<svg\n  class="lucide', `<svg aria-hidden="true"\n  class="${className} lucide`);
}
