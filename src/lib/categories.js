// Auto-categorization logic based on tool tags
export const CATEGORIES = {
  ALL: 'All',
  DEVELOPMENT: 'Development',
  ENCODING: 'Encoding',
  SECURITY: 'Security',
  GENERAL: 'General'
};

const categoryKeywords = {
  [CATEGORIES.DEVELOPMENT]: ['diff', 'json', 'xml', 'formatter', 'docker', 'packet', 'dissector'],
  [CATEGORIES.ENCODING]: ['base64', 'url', 'encoder', 'decoder', 'protobuf'],
  [CATEGORIES.SECURITY]: ['certificate', 'ssl', 'hash', 'java', 'deserializer', 'security'],
  [CATEGORIES.GENERAL]: ['whats', 'my', 'ip', 'whois', 'dns', 'location']
};

export function getToolCategory(tool) {
  const tags = tool.tags || [];
  
  // Check each category for matching keywords
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (tags.some(tag => keywords.some(keyword => tag.toLowerCase().includes(keyword)))) {
      return category;
    }
  }
  
  // Default to General if no match
  return CATEGORIES.GENERAL;
}

export function getToolsByCategory(tools, category) {
  if (category === CATEGORIES.ALL) {
    return tools;
  }
  return tools.filter(tool => getToolCategory(tool) === category);
}

export function getCategoryIcon(category) {
  const icons = {
    [CATEGORIES.ALL]: '☰',
    [CATEGORIES.DEVELOPMENT]: '</>', 
    [CATEGORIES.ENCODING]: '#',
    [CATEGORIES.SECURITY]: '🔒',
    [CATEGORIES.GENERAL]: '🔧'
  };
  return icons[category] || icons[CATEGORIES.ALL];
}

