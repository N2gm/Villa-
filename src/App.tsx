import AppShell from "@/site/AppShell"
import About from "@/site/pages/About"
import Careers from "@/site/pages/Careers"
import ClientArea from "@/site/pages/ClientArea"
import Contact from "@/site/pages/Contact"
import Home from "@/site/pages/Home"
import NotFound from "@/site/pages/NotFound"
import Portfolio from "@/site/pages/Portfolio"
import Quote from "@/site/pages/Quote"
import { ServicesPage } from "@/site/pages/Simple"
import { useLocation } from "@/site/router"

const routes: Record<string, React.ComponentType> = {
  "/": Home,
  "/about": About,
  "/careers": Careers,
  "/client-area": ClientArea,
  "/contact": Contact,
  "/get-a-quote": Quote,
  "/portfolio": Portfolio,
  "/services": ServicesPage,
}

export default function App() {
  const { pathname } = useLocation()
  const Page = routes[pathname.replace(/\/+$/, "") || "/"] ?? NotFound

  return (
    <AppShell>
      <Page />
    </AppShell>
  )
}
