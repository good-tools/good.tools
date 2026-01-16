import { useRef, ReactNode } from "react";
import { Button, ButtonProps } from "@/components/ui/button";

export interface FileButtonProps extends Omit<
  ButtonProps,
  "onClick" | "asChild"
> {
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

function FileButton({ onFileSelected, children, ...props }: FileButtonProps) {
  const hiddenFileInput = useRef<HTMLInputElement>(null);

  const loadFile = () => {
    hiddenFileInput.current?.click();
  };

  return (
    <>
      <input
        ref={hiddenFileInput}
        className="hidden"
        onChange={onFileSelected}
        type="file"
      />
      <Button {...props} onClick={loadFile}>
        {children}
      </Button>
    </>
  );
}

export default FileButton;
