import { Tab } from "@headlessui/react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabButtonProps {
  children: ReactNode;
  className?: string;
}

function TabButton({ children, className }: TabButtonProps) {
  return (
    <Tab
      className={({ selected }) =>
        cn(
          selected
            ? "bg-blue-100 text-blue-700 dark:text-blue-100 dark:bg-blue-700"
            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
          "px-3 py-2 font-medium text-sm rounded-md",
          className,
        )
      }
    >
      {children}
    </Tab>
  );
}

export default TabButton;
