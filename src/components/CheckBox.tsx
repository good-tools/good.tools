import { useId } from "react";
import { cn } from "@/lib/utils";

interface CheckBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  title?: string;
  description?: string;
}

function CheckBox({ className, title, description, ...props }: CheckBoxProps) {
  const id = useId();

  return (
    <div className={cn("relative flex items-start", className)}>
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
        <label
          htmlFor={id}
          title={description}
          className="text-zinc-700 dark:text-zinc-300"
        >
          {title}
        </label>
      </div>
    </div>
  );
}

export default CheckBox;
