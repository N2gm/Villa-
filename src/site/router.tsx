import {
  useCallback,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react"

const NAVIGATION_EVENT = "bonyan:navigate"

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(NAVIGATION_EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(NAVIGATION_EVENT, callback)
  }
}

const getPathname = () => window.location.pathname
const getServerPathname = () => "/"

export function useLocation() {
  const pathname = useSyncExternalStore(subscribe, getPathname, getServerPathname)
  return { pathname }
}

export function useNavigate() {
  return useCallback((path: string) => {
    window.history.pushState({}, "", path)
    window.dispatchEvent(new Event(NAVIGATION_EVENT))
  }, [])
}

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "style" | "children">

export function Link({
  to,
  children,
  ref,
  onClick,
  ...rest
}: AnchorProps & {
  to: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
  ref?: Ref<HTMLAnchorElement>
}) {
  const navigate = useNavigate()
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === "_blank" ||
      to.startsWith("http") ||
      to.startsWith("mailto:") ||
      to.startsWith("tel:")
    ) {
      return
    }
    event.preventDefault()
    navigate(to)
  }

  return (
    <a href={to} ref={ref} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

type NavState = { isActive: boolean }

export function NavLink({
  to,
  end = false,
  className,
  style,
  children,
  ...rest
}: AnchorProps & {
  to: string
  end?: boolean
  className?: string | ((state: NavState) => string)
  style?: CSSProperties | ((state: NavState) => CSSProperties)
  children?: ReactNode | ((state: NavState) => ReactNode)
}) {
  const { pathname } = useLocation()
  const isActive = end || to === "/" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  const state = { isActive }

  return (
    <Link
      to={to}
      aria-current={isActive ? "page" : undefined}
      className={typeof className === "function" ? className(state) : className}
      style={typeof style === "function" ? style(state) : style}
      {...rest}
    >
      {typeof children === "function" ? children(state) : children}
    </Link>
  )
}

export function useSearchParams() {
  const { pathname } = useLocation()
  return [new URLSearchParams(window.location.search), pathname] as const
}
