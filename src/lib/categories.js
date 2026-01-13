import { Layers, Code, Binary, Shield, KeyRound } from 'lucide-react';

// Category definitions with icons
export const categories = [
  { name: "All", icon: Layers },
  { name: "Development", icon: Code },
  { name: "Encoding", icon: Binary },
  { name: "Security", icon: Shield },
  { name: "General", icon: KeyRound },
];

// Legacy CATEGORIES object for backward compatibility
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

// Map tools to Lucide React icon names
export function getToolIcon(tool) {
  const tags = tool.tags || [];
  
  // Check tags for specific icon mappings
  if (tags.includes('base64')) return 'FileText';
  if (tags.includes('json')) return 'Braces';
  if (tags.includes('xml')) return 'Code2';
  if (tags.includes('url')) return 'Link';
  if (tags.includes('diff')) return 'GitCompare';
  if (tags.includes('certificate')) return 'FileKey';
  if (tags.includes('protobuf')) return 'Package';
  if (tags.includes('java')) return 'Coffee';
  if (tags.includes('docker')) return 'Container';
  if (tags.includes('whois')) return 'Search';
  if (tags.includes('dns')) return 'Globe';
  if (tags.includes('hash')) return 'Hash';
  if (tags.includes('packet') || tags.includes('wireshark')) return 'Radio';
  if (tags.includes('ip') || tags.includes('location')) return 'MapPin';
  
  // Default icon
  return 'Wrench';
}

export function getCategoryIcon(category) {
  const categoryObj = categories.find(cat => cat.name === category);
  return categoryObj ? categoryObj.icon : Layers;
}

