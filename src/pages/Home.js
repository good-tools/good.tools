import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { tools } from '../tools';
import ToolCard from '../components/ToolCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import { CATEGORIES, getToolsByCategory } from '../lib/categories';
import { Logo } from '../components/Logo';
import { ModeToggle } from '../components/ModeToggle';

function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORIES.ALL);

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    let filtered = getToolsByCategory(tools, activeCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tool => 
        tool.title.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query) ||
        tool.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [searchQuery, activeCategory]);

  return (
    <>
      <Helmet>
        <title>good.tools · Purpose built online tools</title>
        <meta name="description" content={"Purpose built, online, free-to-use tools"} />
      </Helmet>
      
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
        {/* Top Navigation */}
        <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="container mx-auto px-4 py-4 max-w-6xl">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2">
                <Logo className="h-6" />
              </Link>
              <ModeToggle />
            </div>
          </div>
        </div>

        {/* Header Section */}
        <div className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="container mx-auto px-4 py-12 md:py-16 max-w-6xl">
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 text-zinc-900 dark:text-white">
                Purpose-built tools for <span className="text-blue-600 dark:text-blue-500">developers</span>
              </h1>
              <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto px-4">
                A collection of free, fast, and privacy-focused tools that run entirely in your browser.
                No data leaves your device.
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="mb-6 md:mb-8">
              <SearchBar 
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={() => setSearchQuery('')}
              />
            </div>

            {/* Category Filters */}
            <CategoryFilter 
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-6xl">
          {filteredTools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredTools.map((tool, idx) => (
                <ToolCard key={`tool-${idx}`} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mx-auto mb-4 text-zinc-400 dark:text-zinc-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="text-zinc-600 dark:text-zinc-400 text-lg mb-2">
                No tools found matching your search.
              </p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory(CATEGORIES.ALL);
                }}
                className="text-blue-600 dark:text-blue-500 hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 mt-16">
          <div className="container mx-auto px-4 py-8 max-w-6xl">
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              © {new Date().getFullYear()} good.tools · All tools run locally in your browser
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

export default Home;
