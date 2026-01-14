import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onCtrlEnter?: () => void;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, onCtrlEnter = () => {}, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "bg-white dark:bg-zinc-800 block w-full p-2 rounded-md border-gray-300 dark:border-gray-500 shadow-sm dark:focus:border-gray-400 dark:focus:ring-gray-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm",
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            onCtrlEnter();
          }
        }}
        {...props}
      />
    );
  },
);
TextArea.displayName = "TextArea";

export default TextArea;
