/**
 * GitHub API Service
 * Fetch repository information like branches, commits, etc.
 * Uses authenticated backend endpoints with GitHub PAT from localStorage
 */

interface GitHubBranch {
    name: string
    protected: boolean
}

interface GitHubRepo {
    owner: string
    repo: string
}

/**
 * Fetch all branches for a GitHub repository using authenticated backend
 */
export async function fetchGitHubBranches(
    owner: string,
    repo: string
): Promise<string[]> {
    try {
        // Get GitHub PAT from localStorage (same as add source flow)
        const headers: HeadersInit = {}
        const pat = localStorage.getItem('github_pat')
        if (pat) {
            headers['X-GitHub-Token'] = pat
        }

        // Use plain fetch with GitHub PAT header (not authFetch which only sends JWT)
        const response = await fetch(
            `/github/branches?repo=${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
            { headers }
        )

        if (!response.ok) {
            console.error(`Failed to fetch branches for ${owner}/${repo}: ${response.status}`)
            return []
        }

        const branches: GitHubBranch[] = await response.json()
        return branches.map((branch) => branch.name)
    } catch (error) {
        console.error('Failed to fetch GitHub branches:', error)
        return []
    }
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): GitHubRepo | null {
    try {
        // Handle both HTTPS and SSH URLs
        // HTTPS: https://github.com/owner/repo.git
        // SSH: git@github.com:owner/repo.git

        let match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(?:\.git)?$/)

        if (match) {
            return {
                owner: match[1],
                repo: match[2],
            }
        }

        return null
    } catch (error) {
        console.error('Failed to parse GitHub URL:', error)
        return null
    }
}
