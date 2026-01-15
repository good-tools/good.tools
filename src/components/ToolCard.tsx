import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { getToolCategory, getToolIcon } from "@/lib/categories";
import type { Tool } from "@/types";

interface ToolCardProps {
  tool: Tool;
}

function ToolCard({ tool }: ToolCardProps) {
  const category = getToolCategory(tool);
  const iconName = getToolIcon(tool);
  const IconComponent =
    ((Icons as any)[iconName] as Icons.LucideIcon | undefined) || Icons.Wrench;

  return (
    <Link to={tool.href} className="tool-card group block">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
          <IconComponent className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {category}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {tool.title}
      </h3>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {tool.description}
      </p>

      {tool.online && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
          <Icons.AlertTriangle className="h-3.5 w-3.5" />
          <span>Online tool</span>
        </div>
      )}
    </Link>
  );
}

export default ToolCard;
