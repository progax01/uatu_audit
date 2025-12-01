import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, FileCode, Check, Loader2 } from 'lucide-react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  children?: FileNode[]
}

interface FileSelectorProps {
  repoFullName: string
  branch: string
  selectedFiles: Set<string>
  onSelectionChange: (files: Set<string>) => void
}

// Smart defaults: auto-select these folders
const AUTO_SELECT_FOLDERS = ['contracts', 'src']
// Exclude these by default
const AUTO_EXCLUDE_FOLDERS = ['test', 'tests', 'mocks', 'mock', 'node_modules', 'interfaces', 'lib', 'script', 'scripts']
// File extensions to show
const AUDIT_EXTENSIONS = ['.sol', '.rs', '.ts', '.js', '.move']

export default function FileSelector({ repoFullName, branch, selectedFiles, onSelectionChange }: FileSelectorProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Fetch files from GitHub API
  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/github/files?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(branch)}`)
        if (!response.ok) {
          throw new Error('Failed to fetch files')
        }
        const data = await response.json()
        setFiles(data.files || [])

        // Auto-expand top-level folders
        const topFolders = (data.files || [])
          .filter((f: FileNode) => f.type === 'dir')
          .map((f: FileNode) => f.path)
        setExpandedFolders(new Set(topFolders))

        // Apply smart defaults if no files selected yet
        if (selectedFiles.size === 0) {
          const smartSelection = getSmartSelection(data.files || [])
          onSelectionChange(smartSelection)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load files')
      } finally {
        setLoading(false)
      }
    }

    if (repoFullName && branch) {
      fetchFiles()
    }
  }, [repoFullName, branch])

  // Get smart selection based on folder names
  const getSmartSelection = (fileTree: FileNode[]): Set<string> => {
    const selected = new Set<string>()

    const processNode = (node: FileNode, parentIncluded: boolean) => {
      const folderName = node.name.toLowerCase()

      if (node.type === 'dir') {
        // Check if this folder should be auto-included
        const shouldInclude = parentIncluded || AUTO_SELECT_FOLDERS.includes(folderName)
        const shouldExclude = AUTO_EXCLUDE_FOLDERS.includes(folderName)

        if (shouldInclude && !shouldExclude && node.children) {
          node.children.forEach(child => processNode(child, true))
        } else if (node.children) {
          node.children.forEach(child => processNode(child, false))
        }
      } else if (node.type === 'file' && parentIncluded) {
        // Only select auditable files
        const ext = node.name.substring(node.name.lastIndexOf('.'))
        if (AUDIT_EXTENSIONS.includes(ext)) {
          selected.add(node.path)
        }
      }
    }

    fileTree.forEach(node => processNode(node, false))
    return selected
  }

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  // Toggle file/folder selection
  const toggleSelection = (node: FileNode) => {
    const newSelection = new Set(selectedFiles)

    if (node.type === 'file') {
      if (newSelection.has(node.path)) {
        newSelection.delete(node.path)
      } else {
        newSelection.add(node.path)
      }
    } else if (node.type === 'dir' && node.children) {
      // For directories, toggle all auditable children
      const childFiles = getAllFiles(node)
      const allSelected = childFiles.every(f => newSelection.has(f))

      if (allSelected) {
        childFiles.forEach(f => newSelection.delete(f))
      } else {
        childFiles.forEach(f => newSelection.add(f))
      }
    }

    onSelectionChange(newSelection)
  }

  // Get all file paths from a node (recursive)
  const getAllFiles = (node: FileNode): string[] => {
    if (node.type === 'file') {
      const ext = node.name.substring(node.name.lastIndexOf('.'))
      return AUDIT_EXTENSIONS.includes(ext) ? [node.path] : []
    }
    return (node.children || []).flatMap(getAllFiles)
  }

  // Check if a folder is fully/partially selected
  const getFolderState = (node: FileNode): 'none' | 'partial' | 'all' => {
    if (node.type !== 'dir') return 'none'
    const childFiles = getAllFiles(node)
    if (childFiles.length === 0) return 'none'
    const selectedCount = childFiles.filter(f => selectedFiles.has(f)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === childFiles.length) return 'all'
    return 'partial'
  }

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Calculate total selected size
  const totalStats = useMemo(() => {
    let count = 0
    let size = 0

    const countNode = (node: FileNode) => {
      if (node.type === 'file' && selectedFiles.has(node.path)) {
        count++
        size += node.size || 0
      }
      node.children?.forEach(countNode)
    }

    files.forEach(countNode)
    return { count, size }
  }, [files, selectedFiles])

  // Render a single node
  const renderNode = (node: FileNode, depth: number = 0) => {
    const isFile = node.type === 'file'
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = isFile ? selectedFiles.has(node.path) : false
    const folderState = !isFile ? getFolderState(node) : 'none'

    // Filter to show only auditable files
    if (isFile) {
      const ext = node.name.substring(node.name.lastIndexOf('.'))
      if (!AUDIT_EXTENSIONS.includes(ext)) return null
    }

    // Check if folder has any auditable files
    if (!isFile) {
      const auditableFiles = getAllFiles(node)
      if (auditableFiles.length === 0) return null
    }

    return (
      <div key={node.path}>
        <div
          className={`
            flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer
            hover:bg-[#00ffff]/10 transition-colors
            ${isSelected ? 'bg-[#00ffff]/20' : ''}
          `}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => isFile ? toggleSelection(node) : toggleFolder(node.path)}
        >
          {/* Expand/Collapse for folders */}
          {!isFile && (
            <button
              className="p-0.5 hover:bg-[#00ffff]/20 rounded"
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(node.path)
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </button>
          )}

          {/* Checkbox */}
          <button
            className={`
              w-5 h-5 rounded border-2 flex items-center justify-center transition-all
              ${isFile ? (
                isSelected
                  ? 'border-[#00ffff] bg-[#00ffff]'
                  : 'border-gray-500 hover:border-gray-400'
              ) : (
                folderState === 'all'
                  ? 'border-[#00ffff] bg-[#00ffff]'
                  : folderState === 'partial'
                    ? 'border-[#00ffff] bg-[#00ffff]/50'
                    : 'border-gray-500 hover:border-gray-400'
              )}
            `}
            onClick={(e) => {
              e.stopPropagation()
              toggleSelection(node)
            }}
          >
            {(isSelected || folderState !== 'none') && (
              <Check className="w-3 h-3 text-[#0a0f1f]" />
            )}
          </button>

          {/* Icon */}
          {isFile ? (
            <FileCode className="w-4 h-4 text-[#00ffff]" />
          ) : (
            <Folder className={`w-4 h-4 ${isExpanded ? 'text-[#00ffff]' : 'text-gray-400'}`} />
          )}

          {/* Name */}
          <span className={`flex-1 text-sm ${isSelected || folderState !== 'none' ? 'text-white' : 'text-gray-300'}`}>
            {node.name}
          </span>

          {/* File size */}
          {isFile && node.size && (
            <span className="text-xs text-gray-500">{formatSize(node.size)}</span>
          )}
        </div>

        {/* Children */}
        {!isFile && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Quick actions
  const selectAll = () => {
    const allFiles = new Set<string>()
    const addFiles = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.type === 'file') {
          const ext = node.name.substring(node.name.lastIndexOf('.'))
          if (AUDIT_EXTENSIONS.includes(ext)) {
            allFiles.add(node.path)
          }
        }
        if (node.children) addFiles(node.children)
      })
    }
    addFiles(files)
    onSelectionChange(allFiles)
  }

  const selectNone = () => {
    onSelectionChange(new Set())
  }

  const smartSelect = () => {
    const smartSelection = getSmartSelection(files)
    onSelectionChange(smartSelection)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#00ffff] animate-spin" />
        <span className="ml-3 text-gray-400">Loading repository files...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
        <p className="text-red-400">{error}</p>
        <p className="text-gray-400 text-sm mt-2">
          Make sure the repository is accessible and try again.
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Folder className="w-6 h-6 text-[#00ffff]" />
          Select Files to Audit
        </h2>
        <div className="text-sm text-gray-400">
          <span className="text-[#00ffff] font-semibold">{totalStats.count}</span> files selected
          {totalStats.size > 0 && (
            <span className="ml-2">({formatSize(totalStats.size)})</span>
          )}
        </div>
      </div>

      {/* File tree */}
      <div className="bg-[#0a0f1f]/60 rounded-xl border border-[#00ffff]/20 max-h-[400px] overflow-y-auto">
        <div className="p-4">
          {files.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No auditable files found</p>
          ) : (
            files.map(node => renderNode(node, 0))
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={selectAll}
          className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-[#00ffff]/50 hover:text-white transition-colors"
        >
          Select All
        </button>
        <button
          onClick={selectNone}
          className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-[#00ffff]/50 hover:text-white transition-colors"
        >
          Select None
        </button>
        <button
          onClick={smartSelect}
          className="px-4 py-2 text-sm border border-[#00ffff]/50 text-[#00ffff] rounded-lg hover:bg-[#00ffff]/10 transition-colors"
        >
          Smart Select: Production Contracts
        </button>
      </div>
    </div>
  )
}
