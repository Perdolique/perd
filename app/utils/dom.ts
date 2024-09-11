export function startViewTransition(callback: () => void) {
  if (document.startViewTransition === undefined) {
    callback()
  } else {
    document.startViewTransition(callback)
  }
}
