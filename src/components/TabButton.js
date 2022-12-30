import { Tab } from "@headlessui/react"
import clsx from "clsx"

function TabButton({ children }) {
  return (
    <Tab className={({ selected }) => clsx(
      selected ? 'bg-blue-100 text-blue-700 dark:text-blue-100 dark:bg-blue-700' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
      'px-3 py-2 font-medium text-sm rounded-md'
    )}>
      {children}
    </Tab>
  )
}

export default TabButton