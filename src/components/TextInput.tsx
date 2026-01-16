import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onEnter?: () => void;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, onEnter = () => {}, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "bg-white dark:bg-zinc-800 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm",
          className
        )}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onEnter();
          }
        }}
        {...props}
      />
    );
  }
);
TextInput.displayName = "TextInput";

export default TextInput;
