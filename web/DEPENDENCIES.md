# NodeFleet Dashboard - Dependencies & Setup

## Required Dependencies for package.json

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^2.0.2",
    "tailwindcss": "^3.3.6",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.6"
  }
}
```

## Tailwind Configuration (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0ea5e9',
        'primary-dark': '#0284c7',
        'primary-light': '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
    },
  },
  plugins: [],
}
export default config
```

## PostCSS Configuration (postcss.config.js)

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## tsconfig.json Path Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Optional Enhancements

### For Charts (Telemetry Tab)
```bash
npm install recharts
```

Then update `/app/(dashboard)/devices/[id]/page.tsx` to import and render charts.

### For Maps (GPS Tab)
```bash
npm install leaflet react-leaflet
# OR
npm install mapbox-gl react-map-gl
```

Then create a new component `/components/dashboard/map-viewer.tsx` with map rendering.

### For Authentication
```bash
npm install next-auth
# For database sessions/users (PostgreSQL example):
npm install @next-auth/prisma-adapter
npm install @prisma/client
```

### For File Upload
```bash
npm install react-dropzone
# For S3 storage:
npm install @aws-sdk/client-s3
```

### For Email
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

## File Structure Overview

```
web/src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Overview
│   │   ├── devices/
│   │   │   ├── page.tsx                # Device list
│   │   │   └── [id]/page.tsx           # Device detail
│   │   ├── content/page.tsx            # Content library
│   │   ├── schedules/page.tsx          # Schedule manager
│   │   ├── map/page.tsx                # GPS tracking
│   │   └── settings/
│   │       ├── page.tsx                # Account settings
│   │       └── billing/page.tsx        # Billing & plans
│   ├── globals.css
│   ├── layout.tsx                      # Root layout
│   └── page.tsx                        # Landing page
├── components/
│   ├── dashboard/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── device-status-badge.tsx
│   │   └── stats-card.tsx
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── badge.tsx
│       ├── dialog.tsx
│       ├── tabs.tsx
│       ├── select.tsx
│       ├── table.tsx
│       └── toast.tsx
└── lib/
    └── (utilities - to be created)
```

## Starting the Project

```bash
# Install dependencies
npm install

# Create .env.local (if using authentication/external services)
cp .env.example .env.local

# Run development server
npm run dev

# Navigate to http://localhost:3000
```

## Color Scheme

| Color | Tailwind | Use Case |
|-------|----------|----------|
| Primary | `#0ea5e9` | Buttons, active states, highlights |
| Success | `#10b981` | Online devices, successful operations |
| Warning | `#f59e0b` | Low battery, pairing states |
| Error | `#ef4444` | Offline devices, failed operations |
| Background | `#030712` | Page background |
| Surface | `#0f172a` | Card/section background |
| Muted | `#64748b` | Disabled states, muted text |

## Icons

All icons from `lucide-react`:
- Activity, Battery, Signal, Thermometer, Zap (telemetry)
- MapPin, Navigation (GPS)
- Camera, Video, Music, FileText (content)
- Plus, Copy, Check, Trash2, Download, Upload (actions)
- Grid, List (view modes)
- Settings, Clock, Menu, X, ChevronDown, etc.

## Notes

- All components are "use client" where needed for interactivity
- Mock data is provided for demonstration
- API endpoints are referenced but not implemented (to be created in backend)
- Dark theme is default throughout
- Responsive design works from mobile (320px) to desktop (1920px+)
- Tailwind CSS purges unused styles automatically
