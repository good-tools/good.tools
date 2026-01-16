import { categories } from '@/lib/categories'

interface CategoryFilterProps {
  activeCategory: string
  onCategoryChange: (category: string) => void
}

function CategoryFilter({ activeCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <>
      {categories.map((category) => {
        const Icon = category.icon
        return (
          <button
            key={category.name}
            onClick={() => onCategoryChange(category.name)}
            className={`
              inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
              ${
                activeCategory === category.name
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }
            `}
          >
            <Icon className='h-4 w-4' />
            {category.name}
          </button>
        )
      })}
    </>
  )
}

export default CategoryFilter
