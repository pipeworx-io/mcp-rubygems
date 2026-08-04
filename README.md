# mcp-rubygems

RubyGems MCP — wraps the RubyGems.org public API (free, no auth)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `get_gem` | Get full metadata for a published Ruby gem by name. Returns latest version, authors, license, descriptions, download counts, and project/source URLs. Use for "what is gem X?", "tell me about Ruby gem Y", or before calling get_versions/get_dependencies. |
| `search_gems` | Search RubyGems by keyword in name/description. Returns matching gems sorted by relevance with name, version, downloads, and info text. |
| `get_versions` | Get full version history for a Ruby gem. Returns every published version with release date, download count, Ruby version compatibility, and licenses. Use for "what versions of X exist?" or "when did Y release version Z?". |
| `get_dependencies` | Get the runtime and development dependencies for a specific version of a Ruby gem. Returns each dependency with its version requirement string. Omit version to get the latest. |
| `get_reverse_dependencies` | List gems that depend on this gem. Useful for understanding ecosystem impact ("what depends on Rack?") or risk surface ("how many gems would break if this one had a vulnerability?"). API caps at 50 names per request. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "rubygems": {
      "url": "https://gateway.pipeworx.io/rubygems/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Rubygems data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
