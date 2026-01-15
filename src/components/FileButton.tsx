import { useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface FileButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
