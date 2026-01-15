interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Logo(props: LogoProps) {
  return (
    <div {...props}>
      <span className="text-zinc-900 dark:text-white">
        <strong className="text-blue-500">good</strong>.tools
      </span>
    </div>
  );
}
