import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Search } from "lucide-react";
import { tools } from "@/config/tools.config";
import ToolCard from "@/components/ToolCard";
import SearchBar from "@/components/SearchBar";
import CategoryFilter from "@/components/CategoryFilter";
import {
  CATEGORIES,
  getToolsByCategory,
  type CategoryName,
} from "@/lib/categories";

function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryName>(
    CATEGORIES.ALL,
  );

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    let filtered = getToolsByCategory(tools, activeCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tool) =>
          tool.title.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [searchQuery, activeCategory]);

  return (
    <>
      <Helmet>
        <title>good.tools · Purpose built online tools</title>
        <meta
          name="description"
          content={"Purpose built, online, free-to-use tools"}
        />
      </Helmet>

      {/* Hero Section */}
      <section
        className="mb-16 text-center animate-fade-in"
        style={{ animationDuration: "0.3s" }}
      >
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Purpose-built tools for
          <span className="gradient-text"> developers</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          A collection of free, fast, and privacy-focused tools that run
          entirely in your browser. No data leaves your device.
        </p>
      </section>

      {/* Search Bar */}
      <div
        className="mb-8 animate-slide-up"
        style={{ animationDelay: "0s", animationDuration: "0.3s" }}
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClear={() => setSearchQuery("")}
        />
      </div>

      {/* Category Filters */}
      <div
        className="mb-8 flex flex-wrap gap-2 animate-slide-up"
        style={{ animationDelay: "0s", animationDuration: "0.3s" }}
      >
        <CategoryFilter
          activeCategory={activeCategory}
          onCategoryChange={(category) =>
            setActiveCategory(category as CategoryName)
          }
        />
      </div>

      {/* Tools Grid */}
      <div
        className="animate-slide-up"
        style={{ animationDelay: "0s", animationDuration: "0.3s" }}
      >
        {filteredTools.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in">
            {filteredTools.map((tool, idx) => (
              <ToolCard key={`tool-${idx}`} tool={tool} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 animate-in">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground text-lg mb-2">
              No tools found matching your search.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory(CATEGORIES.ALL);
              }}
              className="text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default Home;
