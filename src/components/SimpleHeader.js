import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { ModeToggle } from './ModeToggle';

function SimpleHeader() {
  return (
    <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Logo className="h-6" />
          </Link>
          <div className="flex items-center space-x-4">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export default SimpleHeader;

