interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * RubyGems MCP — wraps the RubyGems.org public API (free, no auth)
 *
 * API: https://guides.rubygems.org/rubygems-org-api/
 *
 * Tools:
 * - get_gem:        metadata for a gem (latest version + URLs + downloads)
 * - search_gems:    keyword search across all published gems
 * - get_versions:   full version history for a gem
 * - get_dependencies: runtime + development dependencies for a specific version
 * - get_reverse_dependencies: which other gems depend on this one
 */


const BASE_URL = 'https://rubygems.org/api/v1';

// ── Raw API types ────────────────────────────────────────────────────

interface RawGem {
  name: string;
  version: string;
  version_created_at?: string;
  authors?: string;
  info?: string;
  licenses?: string[] | null;
  metadata?: Record<string, string>;
  sha?: string;
  project_uri?: string;
  gem_uri?: string;
  homepage_uri?: string | null;
  wiki_uri?: string | null;
  documentation_uri?: string | null;
  mailing_list_uri?: string | null;
  source_code_uri?: string | null;
  bug_tracker_uri?: string | null;
  changelog_uri?: string | null;
  funding_uri?: string | null;
  downloads?: number;
  version_downloads?: number;
}

interface RawVersion {
  number: string;
  authors?: string;
  built_at?: string;
  created_at?: string;
  description?: string;
  downloads_count?: number;
  summary?: string;
  platform?: string;
  ruby_version?: string;
  rubygems_version?: string;
  prerelease?: boolean;
  licenses?: string[] | null;
  metadata?: Record<string, string>;
}

interface RawDependency {
  name: string;
  requirements: string;
}

interface RawDependencies {
  development?: RawDependency[];
  runtime?: RawDependency[];
}

interface RawReverseDep {
  name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing or empty. Pass a string like ${example}.`);
  }
  return v;
}

async function rgFetch<T>(path: string): Promise<T | { error: string; status: number }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'User-Agent': 'Pipeworx/1.0 (pipeworx.io)' },
  });
  if (res.status === 404) return { error: 'not_found', status: 404 };
  if (!res.ok) throw new Error(`RubyGems API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function formatGem(g: RawGem) {
  return {
    name: g.name,
    latest_version: g.version,
    version_created_at: g.version_created_at ?? null,
    authors: g.authors ?? null,
    info: g.info ?? null,
    licenses: g.licenses ?? null,
    downloads_total: g.downloads ?? null,
    downloads_latest_version: g.version_downloads ?? null,
    project_uri: g.project_uri ?? null,
    gem_uri: g.gem_uri ?? null,
    homepage: g.homepage_uri ?? null,
    documentation: g.documentation_uri ?? null,
    source_code: g.source_code_uri ?? null,
    bug_tracker: g.bug_tracker_uri ?? null,
    changelog: g.changelog_uri ?? null,
  };
}

function formatVersion(v: RawVersion) {
  return {
    number: v.number,
    prerelease: v.prerelease ?? false,
    platform: v.platform ?? null,
    created_at: v.created_at ?? null,
    downloads: v.downloads_count ?? null,
    ruby_version: v.ruby_version ?? null,
    licenses: v.licenses ?? null,
    summary: v.summary ?? null,
  };
}

// ── Tool definitions ─────────────────────────────────────────────────

const tools: McpToolExport['tools'] = [
  {
    name: 'get_gem',
    description:
      'Get full metadata for a published Ruby gem by name. Returns latest version, authors, license, descriptions, download counts, and project/source URLs. Use for "what is gem X?", "tell me about Ruby gem Y", or before calling get_versions/get_dependencies.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gem name (e.g., "rails", "devise", "rspec")' },
      },
      required: ['name'],
    },
  },
  {
    name: 'search_gems',
    description:
      'Search RubyGems by keyword in name/description. Returns matching gems sorted by relevance with name, version, downloads, and info text.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword(s) to search for (e.g., "authentication", "json parser")' },
        limit: { type: 'number', description: 'Max results to return (1–30, default 10). API caps at 30/page.' },
        page: { type: 'number', description: 'Page number (1-based, default 1).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_versions',
    description:
      'Get full version history for a Ruby gem. Returns every published version with release date, download count, Ruby version compatibility, and licenses. Use for "what versions of X exist?" or "when did Y release version Z?".',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gem name (e.g., "rails")' },
        limit: { type: 'number', description: 'Max versions to return (default 25, max 200). Latest first.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_dependencies',
    description:
      'Get the runtime and development dependencies for a specific version of a Ruby gem. Returns each dependency with its version requirement string. Omit version to get the latest.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gem name (e.g., "devise")' },
        version: { type: 'string', description: 'Version string (e.g., "5.0.4"). Omit for latest.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_reverse_dependencies',
    description:
      'List gems that depend on this gem. Useful for understanding ecosystem impact ("what depends on Rack?") or risk surface ("how many gems would break if this one had a vulnerability?"). API caps at 50 names per request.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Gem name (e.g., "rack")' },
      },
      required: ['name'],
    },
  },
];

// ── Tool implementations ─────────────────────────────────────────────

async function getGem(args: Record<string, unknown>) {
  const name = reqStr(args, 'name', '"rails"');
  const data = await rgFetch<RawGem>(`/gems/${encodeURIComponent(name)}.json`);
  if ('error' in data) return { found: false, name, hint: 'Gem not found on rubygems.org.' };
  return { found: true, ...formatGem(data) };
}

async function searchGems(args: Record<string, unknown>) {
  const query = reqStr(args, 'query', '"authentication"');
  const limit = Math.min(30, Math.max(1, (args.limit as number | undefined) ?? 10));
  const page = (args.page as number | undefined) ?? 1;
  const params = new URLSearchParams({ query, page: String(page) });

  const data = await rgFetch<RawGem[]>(`/search.json?${params}`);
  if ('error' in data) return { query, count: 0, gems: [] };
  const limited = data.slice(0, limit);
  return {
    query,
    page,
    count: limited.length,
    gems: limited.map(formatGem),
  };
}

async function getVersions(args: Record<string, unknown>) {
  const name = reqStr(args, 'name', '"rails"');
  const limit = Math.min(200, Math.max(1, (args.limit as number | undefined) ?? 25));
  const data = await rgFetch<RawVersion[]>(`/versions/${encodeURIComponent(name)}.json`);
  if ('error' in data) return { found: false, name, hint: 'Gem not found.' };
  return {
    found: true,
    name,
    total_versions: data.length,
    returned: Math.min(limit, data.length),
    versions: data.slice(0, limit).map(formatVersion),
  };
}

async function getDependencies(args: Record<string, unknown>) {
  const name = reqStr(args, 'name', '"devise"');
  const version = args.version as string | undefined;
  // Get all versions, pick the requested or the latest non-prerelease
  const versions = await rgFetch<RawVersion[]>(`/versions/${encodeURIComponent(name)}.json`);
  if ('error' in versions) return { found: false, name, hint: 'Gem not found.' };

  const targetVersion = version
    ? versions.find((v) => v.number === version)
    : versions.find((v) => !v.prerelease) ?? versions[0];
  if (!targetVersion) {
    return { found: false, name, version, hint: 'Version not found. Use get_versions to list available versions.' };
  }

  const deps = await rgFetch<RawGem & { dependencies?: RawDependencies }>(
    `/versions/${encodeURIComponent(name)}/${encodeURIComponent(targetVersion.number)}.json`,
  );
  if ('error' in deps) return { found: false, name, version: targetVersion.number };
  return {
    found: true,
    name,
    version: targetVersion.number,
    runtime: deps.dependencies?.runtime ?? [],
    development: deps.dependencies?.development ?? [],
  };
}

async function getReverseDependencies(args: Record<string, unknown>) {
  const name = reqStr(args, 'name', '"rack"');
  // The reverse_dependencies endpoint returns just a list of names
  const data = await rgFetch<string[]>(`/gems/${encodeURIComponent(name)}/reverse_dependencies.json`);
  if ('error' in data) return { found: false, name, hint: 'Gem not found.' };
  return {
    found: true,
    name,
    count: data.length,
    dependents: data.slice(0, 50), // API caps at 50 per request
    has_more: data.length > 50,
  };
}

// ── callTool router ──────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'get_gem':                   return getGem(args);
    case 'search_gems':               return searchGems(args);
    case 'get_versions':              return getVersions(args);
    case 'get_dependencies':          return getDependencies(args);
    case 'get_reverse_dependencies':  return getReverseDependencies(args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
