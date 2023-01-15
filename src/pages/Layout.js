import { motion } from 'framer-motion'

import { Link, Outlet, useLocation } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Header } from '../components/Header'
import { Navigation } from '../components/Navigation'

import { useMobileNavigationStore } from '../components/MobileNavigation'
import { useEffect } from "react";

export function Layout() {
  let location = useLocation();

  useEffect(() => {
    useMobileNavigationStore.getState().close()
  }, [location])

  return (
    <div className="lg:ml-72 xl:ml-80">
      <motion.header
        layoutScroll
        className="fixed inset-y-0 left-0 z-40 contents w-72 overflow-y-auto border-r border-zinc-900/10 px-6 pt-4 pb-8 dark:border-white/10 lg:block xl:w-80"
      >
        <div className="hidden lg:flex">
          <Link to="/" aria-label="Home">
            <Logo className="h-6" />
          </Link>
        </div>
        <Header />
        <Navigation className="hidden lg:mt-10 lg:block" />
      </motion.header>
      <div className="relative px-4 pt-14 sm:px-6 lg:px-8">
        <main className="py-4 text-zinc-900 dark:text-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
