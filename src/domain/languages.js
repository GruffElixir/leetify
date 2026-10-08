export const LANGUAGES = Object.freeze({
  cpp: {
    label: 'C++',
    filename: 'solution.cpp',
    runner: 'c++',
    aliases: ['c++', 'cpp', 'g++', 'gnu++', 'cxx'],
    compiler: /(?:\bgnu\s*)?g\+\+|\bc\+\+/i,
    starter:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Write your solution here.\n    return 0;\n}\n',
  },
  python: {
    label: 'Python',
    filename: 'solution.py',
    runner: 'python',
    aliases: ['python', 'python3', 'py', 'pypy'],
    compiler: /python|pypy/i,
    starter:
      'import sys\n\ndef solve():\n    # Write your solution here.\n    pass\n\nif __name__ == "__main__":\n    solve()\n',
  },
  java: {
    label: 'Java',
    filename: 'Main.java',
    runner: 'java',
    aliases: ['java'],
    compiler: /^java(?:\s|$)/i,
    starter:
      'import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // Write your solution here.\n    }\n}\n',
  },
  javascript: {
    label: 'JavaScript',
    filename: 'solution.js',
    runner: 'javascript',
    aliases: ['javascript', 'js', 'node', 'node.js'],
    compiler: /javascript|node(?:\.js)?/i,
    starter:
      "'use strict';\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8');\n\n// Write your solution here.\nconsole.log(input.trim());\n",
  },
});
export const isLanguage = (value) => Object.hasOwn(LANGUAGES, value);
