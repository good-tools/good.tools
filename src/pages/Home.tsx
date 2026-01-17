import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search } from 'lucide-react'
import { filteredTools as availableTools } from '@/config/tools.config'
import ToolCard from '@/components/ToolCard'
import SearchBar from '@/components/SearchBar'
import CategoryFilter from '@/components/CategoryFilter'
import { getToolsByCategory, type CategoryName } from '@/lib/categories'

function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryName | 'All'>('All')

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    let filtered = getToolsByCategory(availableTools, activeCategory)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (tool) =>
          tool.title.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.searchTags.some((tag) => tag.toLowerCase().includes(query)),
      )
    }

    return filtered
  }, [searchQuery, activeCategory])

  return (
    <div className='p-4 md:p-6 max-w-6xl mx-auto'>
      <Helmet>
        <title>good.tools · Purpose built online tools</title>
        <meta name='description' content={'Purpose built, online, free-to-use tools'} />
      </Helmet>

      {/* Hero Section */}
      <section className='mb-12 text-center'>
        <h1 className='mb-3 text-3xl font-semibold tracking-tight sm:text-4xl'>
          Purpose-built tools for
          <span className='gradient-text'> developers</span>
        </h1>
        <p className='mx-auto max-w-2xl text-sm text-muted-foreground'>
          A collection of free, fast, and privacy-focused tools that run entirely in your browser.
        </p>
      </section>

      {/* Search Bar */}
      <div className='mb-6'>
        <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} />
      </div>

      {/* Category Filters */}
      <div className='mb-6 flex flex-wrap gap-2'>
        <CategoryFilter
          activeCategory={activeCategory}
          onCategoryChange={(category) => setActiveCategory(category as CategoryName | 'All')}
        />
      </div>

      {/* Tools Grid */}
      <div>
        {filteredTools.length > 0 ? (
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
            {filteredTools.map((tool, idx) => (
              <ToolCard key={`tool-${idx}`} tool={tool} />
            ))}
          </div>
        ) : (
          <div className='text-center py-12'>
            <Search className='w-12 h-12 mx-auto mb-4 text-muted-foreground/50' />
            <p className='text-muted-foreground mb-2'>No tools found matching your search.</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveCategory('All')
              }}
              className='text-primary hover:underline text-sm'
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
