import { Link } from 'react-router-dom';
import { getToolCategory } from '../lib/categories';

function ToolCard({ tool }) {
  const category = getToolCategory(tool);
  
  // Icon mapping based on tool type
  const getIcon = () => {
    if (tool.tags.includes('base64')) return '📝';
    if (tool.tags.includes('json')) return '{ }';
    if (tool.tags.includes('xml')) return '</>';
    if (tool.tags.includes('url')) return '🔗';
    if (tool.tags.includes('diff')) return '⚖️';
    if (tool.tags.includes('certificate')) return '📜';
    if (tool.tags.includes('protobuf')) return '📦';
    if (tool.tags.includes('java')) return '☕';
    if (tool.tags.includes('docker')) return '🐳';
    if (tool.tags.includes('whois')) return '🔍';
    if (tool.tags.includes('dns')) return '🌐';
    if (tool.tags.includes('hash')) return '#';
    if (tool.tags.includes('packet')) return '📡';
    if (tool.tags.includes('ip')) return '🌍';
    return '🛠️';
  };

  return (
    <Link
      to={tool.href}
      className="group block p-6 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
    >
      <div className="flex items-start space-x-4">
        <div className="text-3xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
              {tool.title}
            </h3>
            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded flex-shrink-0">
              {category}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {tool.description}
          </p>
          {tool.online && (
            <div className="mt-3 flex items-center text-xs text-amber-600 dark:text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Online tool
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default ToolCard;

