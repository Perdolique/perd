export default function useAppState() {
  const isSidebarCollapsed = useCookie<boolean>('isSidebarCollapsed', {
    default: () => false
  })

  const isSidebarShown = useState('isSidebarShown', () => false)

  function hideSidebar() {
    isSidebarShown.value = false
  }

  function toggleSidebarMobile() {
    isSidebarShown.value = !isSidebarShown.value
  }

  function toggleSidebarDesktop() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  return {
    hideSidebar,
    isSidebarCollapsed,
    isSidebarShown,
    toggleSidebarDesktop,
    toggleSidebarMobile
  }
}
