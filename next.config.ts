import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // `next dev` otherwise appends a generated block to AGENTS.md on every start.
  // That file is maintained by hand and excluded from the repository.
  agentRules: false,
}

export default nextConfig
