# UatuAudit Modern UI

## Overview

This is the new modern React-based UI for UatuAudit, built with Vite, React, TypeScript, and Tailwind CSS.

## Architecture

### Tech Stack
- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite 5.4
- **Styling**: Tailwind CSS 4.1
- **State Management**: React Hooks
- **Backend**: Existing Node.js daemon (no changes required)

### Directory Structure
```
ui/
├── index.html                 # Entry point
├── src/
│   ├── main.tsx              # React root
│   ├── App.tsx               # Main app with 3-step wizard
│   ├── components/
│   │   ├── Stepper.tsx       # Progress stepper (1-2-3)
│   │   └── JobHistory.tsx    # Job history table
│   ├── pages/
│   │   ├── StepOne.tsx       # GitHub connection & repo selection
│   │   ├── StepTwo.tsx       # Audit configuration
│   │   └── StepThree.tsx     # Review, run, and monitor
│   ├── hooks/
│   │   └── useAuditProgress.ts  # Real-time progress polling
│   └── styles/
│       └── globals.css       # Tailwind + custom styles
```

## Getting Started

### Prerequisites
- Node.js 18+ (Note: Vite 5.4 supports Node 18, but Vite 7+ requires Node 20+)
- npm or pnpm

### Installation
Dependencies are already installed via the main package.json.

### Development

**Start the UI development server:**
```bash
npm run dev:ui
```
This starts Vite on **http://localhost:3000**

**Start the backend daemon** (in a separate terminal):
```bash
npm run daemon
```
This starts the API server on **http://localhost:9090**

The Vite dev server proxies all API requests to the daemon automatically.

### Production Build

**Build the UI:**
```bash
npm run build:ui
```
Output directory: `dist-ui/`

**Preview production build:**
```bash
npm run preview:ui
```

## Features

### Step 1: GitHub Connection
- OAuth integration with GitHub
- Repository and branch selection
- Project slug configuration
- Validation and error handling

### Step 2: Configure Audit
- Ecosystem selection (Foundry, Hardhat, Anchor, Soroban, Node.js)
- Test style selection (Behavioral, STRIDE Threats)
- Configuration preview
- Form validation

### Step 3: Review & Run
- Configuration summary
- One-click audit trigger
- Real-time progress monitoring:
  - Overall progress bar
  - Individual execution steps (Bootstrap, Inventory, Analysis, Test Generation, Execution)
  - Live JSON progress feed
  - Console output with formatted logs
- Completion notification
- Report download buttons (HTML/PDF)

### Job History
- Filterable job list (All, Completed, Failed, Running, Pending)
- Status badges with colors
- Job details (repo, branch, timestamps)
- Quick access to reports
- Auto-refresh every 10 seconds

## API Integration

The UI communicates with the existing backend daemon via these endpoints:

### Authentication
- `GET /auth/github/login` - Initiate OAuth
- `GET /auth/github/callback` - OAuth callback
- `GET /auth/github/me` - Check auth status
- `POST /auth/github/logout` - Logout

### GitHub Operations
- `GET /github/repos` - List repositories
- `GET /github/branches?repo=owner/name` - List branches

### Audit Operations
- `POST /enqueue` - Queue new audit
- `GET /progress?project=X&branch=Y` - Get progress
- `GET /logs?project=X&branch=Y&tail=N` - Get logs
- `GET /report?project=X&branch=Y&format=html|pdf` - Download report
- `GET /jobs` - List all jobs

## Design System

### Colors
Preserved from the original UI:
- **Accent**: `#0a7cff` (blue)
- **Background**: `#0b1020` (dark blue)
- **Card**: `#121a33` (dark blue-gray)
- **Text**: `#eaf0ff` (light)
- **Muted**: `#9fb0e3` (gray-blue)

Status colors:
- **Success**: `#10B981` (green)
- **Error**: `#EF4444` (red)
- **Warning**: `#F59E0B` (yellow)
- **Pending**: `#6B7280` (gray)

### Border Radius
- Cards: 16px
- Inputs/Buttons: 10px
- Badges: 6px

### Typography
System UI font stack for native OS appearance.

## Development Tips

### Hot Reload
Vite provides instant hot module replacement (HMR). Changes to `.tsx` and `.css` files reflect immediately.

### Proxy Configuration
API requests are proxied to `localhost:9090` in `vite.config.ts`. Adjust if your daemon runs on a different port.

### Tailwind Classes
Common patterns:
- `card` - Card container
- `btn-primary` - Primary button (blue)
- `btn-secondary` - Secondary button (gray)
- `input` / `select` - Form inputs

### Adding New Components
1. Create `.tsx` file in `ui/src/components/`
2. Export as default
3. Import in `App.tsx` or page component

## Troubleshooting

### Port 3000 Already in Use
Change the port in `vite.config.ts`:
```typescript
server: {
  port: 3001,
  // ...
}
```

### API Calls Failing
Ensure the daemon is running on port 9090:
```bash
npm run daemon
```

### Build Errors
Clear node_modules and reinstall:
```bash
rm -rf node_modules
npm install
```

### Styling Not Applied
Ensure Tailwind is processing files correctly. Check `tailwind.config.js` content paths:
```javascript
content: [
  "./ui/index.html",
  "./ui/src/**/*.{js,ts,jsx,tsx}",
],
```

## Deployment

### Static Hosting
The built UI (`dist-ui/`) is a static site. Deploy to:
- Vercel
- Netlify
- GitHub Pages
- Any static host

Configure the API base URL via environment variable if needed.

### Docker Integration
To serve the new UI from the Docker container:
1. Build the UI: `npm run build:ui`
2. Update `daemon.ts` to serve from `dist-ui/` instead of `index.html`
3. Rebuild Docker image

## Future Enhancements

- [ ] Toast notifications for actions
- [ ] Modal dialogs for confirmations
- [ ] Search/filter in job history
- [ ] Pagination for large job lists
- [ ] Dark/light theme toggle
- [ ] Mobile responsive improvements
- [ ] Keyboard shortcuts
- [ ] Accessibility (ARIA labels)

## Migration from Old UI

The old UI (`index.html` in root) is preserved and still works. To switch:

**Use New UI**: Visit `http://localhost:3000` (Vite dev server)
**Use Old UI**: Visit `http://localhost:9090` (daemon serves old `index.html`)

Both UIs use the same backend, so no data migration is needed.

## Support

For issues or questions:
1. Check [ui-upgrade.md](ui-upgrade.md) for task progress
2. Review Vite documentation: https://vitejs.dev
3. Review React documentation: https://react.dev
4. Review Tailwind documentation: https://tailwindcss.com

## License

MIT
