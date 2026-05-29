const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. replace `grid-cols-12 gap-8` with `max-w-3xl mx-auto` for form-tab
code = code.replace(
  'className="grid grid-cols-1 lg:grid-cols-12 gap-8"',
  'className="max-w-3xl mx-auto"'
);

// 2. remove `lg:col-span-7`
code = code.replace(
  '<div className="lg:col-span-7">',
  '<div className="w-full">'
);

// 3. Extract the lg:col-span-5 block (from `              {/* الجدول والقائمة واللوحة الجانبية للبيانات */}` down to just before `            </motion.div>`)
const match = code.match(/(\s*\{\/\* الجدول والقائمة واللوحة الجانبية للبيانات \*\/\}[\s\S]*?)(\s*<\/motion\.div>\s*\)\s*:\s*\(\s*<motion\.div\s*key="code-tab")/);

if (match) {
  const colSpan5Block = match[1];
  
  // modify colSpan5Block slightly (remove button link)
  let newCol5 = colSpan5Block.replace(/<div className="mt-5 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">[\s\S]*?<\/div>/, '');

  // remove it from the original location
  code = code.replace(colSpan5Block, '');
  
  // change code-tab to admin-tab
  code = code.replace('key="code-tab"', 'key="admin-tab"');
  
  // place it inside the second motion div
  const adminLayout = `
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
\${newCol5}
              <div className="lg:col-span-7 space-y-6">
  `;
  code = code.replace(
    /<motion\.div\s*key="admin-tab"[\s\S]*?className="space-y-6"\s*>/,
    adminLayout
  );
  
  // close the lg:col-span-7 div at the end of the admin tab
  code = code.replace(
    /\s*<\/motion\.div>\s*\}\s*<\/AnimatePresence>/,
    '\n              </div>\n            </motion.div>\n          }\n        </AnimatePresence>'
  );

  fs.writeFileSync('src/App.tsx', code);
  console.log("Success");
} else {
  console.log("Match failed!");
}
