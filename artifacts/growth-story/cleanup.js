import fs from 'fs';
import path from 'path';

const SRC_PAGES = path.join(process.cwd(), 'src/pages');

function fixFiles(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            fixFiles(filepath);
        } else if (filepath.endsWith('.tsx')) {
            let content = fs.readFileSync(filepath, 'utf8');

            // Remove weight="bold", weight="regular", weight="fill"
            content = content.replace(/weight="[^"]*"/g, '');
            
            // Remove searchParams prop from pages
            content = content.replace(/\{ searchParams \}: \{ searchParams: Promise<any> \}/g, '()');
            content = content.replace(/\{ searchParams \}: \{ searchParams: Promise<[^>]*> \}/g, '()');
            content = content.replace(/\{ searchParams \}: Props/g, '()');
            content = content.replace(/interface Props \{[\s\S]*?\}/g, '');
            
            // Fix dayOfMonth error in Timeline
            content = content.replace(/\{day\.dayOfMonth\}/g, "{day.dateKey.split('-')[2].replace(/^0/,'')}");

            fs.writeFileSync(filepath, content);
        }
    });
}
fixFiles(SRC_PAGES);

// Remove backend files
const libsToRemove = [
    'auth.ts', 'competition-goal-service.ts', 'daily-log-service.ts', 
    'member-access.ts', 'password-reset-service.ts', 'password.ts', 
    'prisma.ts', 'rate-limit.ts', 'registration-service.ts', 
    'request.ts', 'story-service.ts', 'record-query.ts'
];

libsToRemove.forEach(f => {
    const p = path.join(process.cwd(), 'src/lib', f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
});

// Rename Not-found.tsx to not-found.tsx to resolve case-sensitivity conflict
if (fs.existsSync(path.join(SRC_PAGES, 'Not-found.tsx'))) {
    fs.unlinkSync(path.join(SRC_PAGES, 'Not-found.tsx'));
}

console.log('Cleanup finished.');
