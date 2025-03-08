const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/app/api/debug/session/route.ts',
  'src/app/api/user/connected-accounts/route.ts',
  'src/app/api/user/update-ftp/route.ts',
  'src/app/api/garmin/sync/route.ts',
  'src/app/api/health/metrics/route.ts',
  'src/app/api/training/plans/route.ts',
  'src/app/api/garmin/connect/route.ts',
  'src/app/api/training/create-plan/route.ts'
];

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Replace the old import with the new one - handle more variations
  content = content.replace(
    /import\s+{\s*authOptions\s*}\s+from\s+['"]\.\.\/(\.\.\/)?auth\/\[\.\.\.\nextauth\]\/route['"];?/g,
    "import { authOptions } from '@/lib/auth';"
  );
  
  fs.writeFileSync(fullPath, content);
  console.log(`Updated: ${filePath}`);
});

console.log('All files updated successfully!'); 