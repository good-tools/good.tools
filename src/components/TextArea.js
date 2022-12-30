import clsx from "clsx"

function TextArea({ className, innerRef, onCtrlEnter = () => {}, ...props }) {
  className = clsx(
    'bg-white dark:bg-zinc-800 block w-full p-2 rounded-md border-gray-300 dark:border-gray-500 shadow-sm dark:focus:border-gray-400 dark:focus:ring-gray-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm',
    className
  )

  return (
    <textarea
      ref={innerRef}
      className={className}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          onCtrlEnter()
        }
      }}
      {...props}
    />
  )
}

export default TextArea