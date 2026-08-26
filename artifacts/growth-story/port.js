import fs from 'fs';
import path from 'path';

const SRC_APP = path.join(process.cwd(), 'src/app');
const OUT_PAGES = path.join(process.cwd(), 'src/pages');

// Simple function to ensure directory exists
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Ensure pages dir exists
ensureDir(OUT_PAGES);

// File tree walker
function walkSync(dir, filelist = []) {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            if (file === 'api' || file === 'fonts') return;
            filelist = walkSync(filepath, filelist);
        } else {
            if (filepath.endsWith('.tsx')) {
                filelist.push(filepath);
            }
        }
    });
    return filelist;
}

const files = walkSync(SRC_APP);

const iconMap = {
    'ArrowsClockwiseIcon': 'RefreshCw',
    'BedIcon': 'Bed',
    'CalendarBlankIcon': 'Calendar',
    'CaretDownIcon': 'ChevronDown',
    'CheckCircleIcon': 'CheckCircle',
    'FlagIcon': 'Flag',
    'FloppyDiskIcon': 'Save',
    'MedalIcon': 'Medal',
    'PersonSimpleSwimIcon': 'Waves',
    'TargetIcon': 'Target',
    'ArchiveIcon': 'Archive',
    'ClockCountdownIcon': 'Clock',
    'FlagCheckeredIcon': 'Flag',
    'PlusIcon': 'Plus',
    'TrashIcon': 'Trash',
    'BookOpenTextIcon': 'BookOpenText',
    'CalendarDotsIcon': 'CalendarDays',
    'HouseIcon': 'Home',
    'NotePencilIcon': 'PenLine',
    'SignOutIcon': 'LogOut',
    'CaretLeftIcon': 'ChevronLeft',
    'CaretRightIcon': 'ChevronRight',
    'ListBulletsIcon': 'List',
    'EyeIcon': 'Eye',
    'EyeClosedIcon': 'EyeOff',
    'LockKeyIcon': 'Lock',
    'EnvelopeSimpleIcon': 'Mail',
    'UserIcon': 'User'
};

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Remove 'use client'
    content = content.replace(/'use client';?\n?/g, '');
    content = content.replace(/"use client";?\n?/g, '');

    // Replace next/link
    content = content.replace(/import Link from 'next\/link';/g, "import { Link } from 'wouter';");
    content = content.replace(/import Link from "next\/link";/g, 'import { Link } from "wouter";');

    // Replace next/image
    content = content.replace(/import Image from 'next\/image';/g, '');
    content = content.replace(/<Image[^>]*src=\{?([^}>]+)\}?[^>]*>/g, '<img src={$1} alt="" />');
    content = content.replace(/<Image([^>]*)>/g, '<img $1 />');

    // Replace useRouter and useSearchParams
    content = content.replace(/import \{.*?useRouter.*?\} from 'next\/navigation';/g, 
        "import { useLocation, useSearch } from 'wouter';");
    content = content.replace(/const router = useRouter\(\);/g, "const [, setLocation] = useLocation();");
    content = content.replace(/const searchParams = useSearchParams\(\);/g, "const searchString = useSearch();\n    const searchParams = new URLSearchParams(searchString);");
    content = content.replace(/router\.replace\((.*?)\)/g, "setLocation($1)");
    content = content.replace(/router\.push\((.*?)\)/g, "setLocation($1)");
    content = content.replace(/router\.refresh\(\)/g, "window.location.reload()");

    // Phosphor to Lucide
    let lucideImports = new Set();
    Object.keys(iconMap).forEach(phIcon => {
        const regex = new RegExp(`import { ${phIcon} } from '@phosphor-icons/react.*';`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, '');
            lucideImports.add(iconMap[phIcon]);
            // Replace usages
            const tagRegex = new RegExp(`<${phIcon}`, 'g');
            content = content.replace(tagRegex, `<${iconMap[phIcon]}`);
            const arrayRegex = new RegExp(`Icon: ${phIcon}`, 'g');
            content = content.replace(arrayRegex, `Icon: ${iconMap[phIcon]}`);
        }
    });
    if (lucideImports.size > 0) {
        content = `import { ${Array.from(lucideImports).join(', ')} } from 'lucide-react';\n` + content;
    }
    
    // Replace Server Component dynamic fetching metadata
    content = content.replace(/export const metadata.*?=.*?;/gs, '');

    // Replace metadata imports
    content = content.replace(/import type \{ Metadata \} from 'next';/g, '');

    // Determine output file path
    let relPath = path.relative(SRC_APP, file);
    // e.g. admin/users/page.tsx -> AdminUsers.tsx
    let outName = relPath.replace(/\/page\.tsx$/, '.tsx');
    if (outName === 'page.tsx') outName = 'Home.tsx';
    outName = outName.split('/').map(part => {
        if (part.startsWith('[')) {
            return part.replace(/\[(.*?)\]/, '$1').charAt(0).toUpperCase() + part.replace(/\[(.*?)\]/, '$1').slice(1);
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join('');

    if (outName.endsWith('.tsx') && !outName.includes('Layout.tsx')) {
        const outPath = path.join(OUT_PAGES, outName);
        fs.writeFileSync(outPath, content);
    }
});

console.log('Conversion script finished.');
