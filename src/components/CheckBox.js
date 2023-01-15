import clsx from "clsx";
import { useId } from "react";

function CheckBox({ className, title, ...props }) {
  const id = useId();
  className = clsx(
    'relative flex items-start',
    className
  )
  return (
    <div className={className}>
      <div className="flex h-6 items-center">
        <input
          id={id}
          name={id}
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-zinc-600 focus:ring-zinc-500"
          {...props}
        />
      </div>
      <div className="ml-3 text-sm">
        <label htmlFor={id} className="text-zinc-700 dark:text-zinc-300">
          {title}
        </label>
      </div>
    </div>
  )
}

export default CheckBox;