import { ReactNode } from "react";

/**
 * Button variants
 */
export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

/**
 * Button sizes
 */
export type ButtonSize = "default" | "sm" | "lg" | "icon";

/**
 * Common button props
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

/**
 * Text input props
 */
export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onEnter?: () => void;
}

/**
 * Text area props
 */
export interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onCtrlEnter?: () => void;
}

/**
 * File button props
 */
export interface FileButtonProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Checkbox props
 */
export interface CheckBoxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

/**
 * Badge props
 */
export interface BadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  children: ReactNode;
}

/**
 * Code block props
 */
export interface CodeProps {
  children: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}
