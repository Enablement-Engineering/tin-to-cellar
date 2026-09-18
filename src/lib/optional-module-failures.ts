const failures = new WeakSet<object>()
export function markOptionalModuleFailure(error: unknown) {
  if (error !== null && typeof error === 'object') failures.add(error)
}
export function isOptionalModuleFailure(error: unknown) {
  return error !== null && typeof error === 'object' && failures.has(error)
}
