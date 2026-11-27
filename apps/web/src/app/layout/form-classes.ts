// Plain elements, because the spartan native-select and checkbox need @ng-icons, which the npm registry does not serve.
export const selectClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 h-8 w-full min-w-0 rounded-lg border bg-transparent px-2 py-1 text-sm outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50';

export const checkboxClass =
  'accent-primary focus-visible:ring-ring/50 size-4 shrink-0 cursor-pointer outline-none focus-visible:ring-3';
