/**
 * Leetify — Codeforces Split-Pane IDE
 * Content Script: Monokai highlighting, gutter, toolbar, utilities
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════
     EDITOR GEOMETRY (must match CSS --ed-* vars exactly)
  ════════════════════════════════════════════════════════════ */
  const ED = {
    fontSize:   13,   // px — matches --ed-font-size
    lineHeight: 21,   // px — matches --ed-line-height  (13 * 1.615)
    padTop:     12,   // px — matches --ed-pad-top
  };
  // Font size range
  const FONT_MIN = 11, FONT_MAX = 20;

  /* ════════════════════════════════════════════════════════════
     MONOKAI SYNTAX HIGHLIGHTER  (regex tokeniser, zero deps)
     Supports: C++, Python, Java, JavaScript
  ════════════════════════════════════════════════════════════ */
  const LANG = {
    cpp: {
      label: 'C++ 20 (GCC 13)',
      filename: 'solution.cpp',
      boilerplate:
`#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t;
    cin >> t;
    while (t--) {
        // your solution here
    }
    return 0;
}`,
      rules: [
        { cls: 'mk-comment',  re: /\/\/[^\n]*/g },
        { cls: 'mk-comment',  re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-macro',    re: /#\s*(?:include|define|ifdef|ifndef|endif|pragma|undef|if|else|elif)\b[^\n]*/g },
        { cls: 'mk-string',   re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword',  re: /\b(?:alignas|alignof|and|asm|auto|bool|break|case|catch|char|class|const|consteval|constexpr|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|nullptr|operator|or|private|protected|public|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/g },
        { cls: 'mk-type',     re: /\b(?:string|wstring|vector|map|set|unordered_map|unordered_set|pair|tuple|array|deque|queue|stack|priority_queue|list|multiset|multimap|bitset|optional|variant|unique_ptr|shared_ptr|weak_ptr|size_t|ptrdiff_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|ll|ull|cin|cout|cerr|endl|ios_base|istream|ostream|ifstream|ofstream|stringstream)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_]\w*)\s*(?=\()/g },
        { cls: 'mk-number',   re: /\b(?:0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[fFlLuU]*)\b/g },
      ],
    },

    python: {
      label: 'Python 3.12',
      filename: 'solution.py',
      boilerplate:
`import sys
input = sys.stdin.readline

def solve():
    # your solution here
    pass

t = int(input())
for _ in range(t):
    solve()`,
      rules: [
        { cls: 'mk-comment', re: /#[^\n]*/g },
        { cls: 'mk-string',  re: /"""[\s\S]*?"""|'''[\s\S]*?'''/g },
        { cls: 'mk-string',  re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-macro',   re: /@[a-zA-Z_]\w*/g },
        { cls: 'mk-keyword', re: /\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g },
        { cls: 'mk-builtin', re: /\b(?:abs|all|any|bin|bool|bytes|callable|chr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip|sys|os|math|collections|itertools|functools|defaultdict|Counter|deque|heapq|bisect)\b/g },
        { cls: 'mk-function',re: /\bdef\s+([a-zA-Z_]\w*)/g },
        { cls: 'mk-number',  re: /\b(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[jJ]?)\b/g },
      ],
    },

    java: {
      label: 'Java 21',
      filename: 'Solution.java',
      boilerplate:
`import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(
            new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(
            new BufferedWriter(new OutputStreamWriter(System.out)));
        int t = Integer.parseInt(br.readLine().trim());
        while (t-- > 0) {
            // your solution here
        }
        out.flush();
    }
}`,
      rules: [
        { cls: 'mk-comment',  re: /\/\/[^\n]*/g },
        { cls: 'mk-comment',  re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-macro',    re: /@[A-Z][a-zA-Z0-9_]*/g },
        { cls: 'mk-string',   re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword',  re: /\b(?:abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|var|void|volatile|while|true|false|null|record|sealed|permits|yield)\b/g },
        { cls: 'mk-type',     re: /\b(?:String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Number|Comparable|Iterable|Iterator|Collection|List|ArrayList|LinkedList|Map|HashMap|TreeMap|Set|HashSet|TreeSet|Queue|Deque|ArrayDeque|PriorityQueue|Stack|Scanner|BufferedReader|PrintWriter|StringBuilder|System|Math|Arrays|Collections|Optional)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_]\w*)\s*(?=\()/g },
        { cls: 'mk-number',   re: /\b(?:0[xX][0-9a-fA-F]+[lL]?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?[fFdDlL]?)\b/g },
      ],
    },

    javascript: {
      label: 'JavaScript (Node.js)',
      filename: 'solution.js',
      boilerplate:
`const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', l => lines.push(l.trim()));
rl.on('close', () => {
    let i = 0;
    const rd = () => lines[i++];
    const t = +rd();
    for (let q = 0; q < t; q++) {
        // your solution here
    }
});`,
      rules: [
        { cls: 'mk-comment',  re: /\/\/[^\n]*/g },
        { cls: 'mk-comment',  re: /\/\*[\s\S]*?\*\//g },
        { cls: 'mk-string',   re: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g },
        { cls: 'mk-keyword',  re: /\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|false|finally|for|from|function|if|import|in|instanceof|let|new|null|of|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|with|yield)\b/g },
        { cls: 'mk-builtin',  re: /\b(?:Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|Promise|Proxy|Reflect|RegExp|Set|Map|String|Symbol|WeakMap|WeakSet|BigInt|console|process|require|module|exports|setTimeout|clearTimeout|setInterval|clearInterval|parseInt|parseFloat|isNaN|isFinite|encodeURIComponent|decodeURIComponent|fetch|document|window|globalThis)\b/g },
        { cls: 'mk-function', re: /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g },
        { cls: 'mk-number',   re: /\b(?:0[xX][0-9a-fA-F]+n?|0[oO][0-7]+n?|0[bB][01]+n?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?n?)\b/g },
      ],
    },
  };

  /** Escape text for safe innerHTML injection */
  function escH(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /**
   * Tokenise `code` for `lang` and return highlighted HTML.
   * Algorithm: collect all regex match ranges, sort, deduplicate overlaps,
   * then walk source text wrapping matched regions in <span class="mk-*">.
   */
  function highlight(code, lang) {
    const def = LANG[lang];
    if (!def) return escH(code);

    const tokens = [];
    for (const rule of def.rules) {
      const re = new RegExp(rule.re.source,
        rule.re.flags.includes('g') ? rule.re.flags : rule.re.flags + 'g');
      let m;
      while ((m = re.exec(code)) !== null) {
        tokens.push({ s: m.index, e: m.index + m[0].length, cls: rule.cls });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
    tokens.sort((a, b) => a.s - b.s || b.e - a.e);

    let html = '', pos = 0;
    for (const t of tokens) {
      if (t.s < pos) continue;
      if (t.s > pos) html += escH(code.slice(pos, t.s));
      html += `<span class="${t.cls}">${escH(code.slice(t.s, t.e))}</span>`;
      pos = t.e;
    }
    if (pos < code.length) html += escH(code.slice(pos));
    return html;
  }

  /* ════════════════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════════════════ */
  let problemStatement = null;
  let originalParent   = null;
  let originalNextSib  = null;
  let splitContainer   = null;
  let activateBtn      = null;
  let currentLang      = 'cpp';
  let currentFontSize  = ED.fontSize;
  let wrapOn           = false;

  // Hot DOM refs (set after container is inserted)
  let codeInput      = null;
  let hlLayer        = null;
  let gutterInner    = null;
  let statusCursor   = null;
  let statusChars    = null;
  let statusLang     = null;

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  function init() {
    problemStatement = document.querySelector('.problem-statement');
    if (!problemStatement) return;
    originalParent  = problemStatement.parentNode;
    originalNextSib = problemStatement.nextSibling;
    createActivateBtn();
    activateSplit();
  }

  /* ════════════════════════════════════════════════════════════
     ACTIVATE / EXIT
  ════════════════════════════════════════════════════════════ */
  function createActivateBtn() {
    activateBtn = document.createElement('button');
    activateBtn.id = 'leetify-activate-btn';
    activateBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      Split View
    `;
    activateBtn.style.display = 'none';
    activateBtn.addEventListener('click', activateSplit);
    document.body.appendChild(activateBtn);
  }

  function activateSplit() {
    if (!splitContainer) buildSplitContainer();
    const lp = document.getElementById('leetify-left-pane');
    if (lp && problemStatement) lp.appendChild(problemStatement);
    splitContainer.style.display = 'flex';
    document.body.classList.add('leetify-active');
    if (activateBtn) activateBtn.style.display = 'none';
  }

  function exitSplit() {
    if (!problemStatement || !originalParent) return;
    if (originalNextSib) originalParent.insertBefore(problemStatement, originalNextSib);
    else originalParent.appendChild(problemStatement);
    if (splitContainer) splitContainer.style.display = 'none';
    document.body.classList.remove('leetify-active');
    if (activateBtn) activateBtn.style.display = 'flex';
  }

  /* ════════════════════════════════════════════════════════════
     BUILD SPLIT CONTAINER
  ════════════════════════════════════════════════════════════ */
  function buildSplitContainer() {
    splitContainer = document.createElement('div');
    splitContainer.id = 'leetify-split-container';
    splitContainer.appendChild(buildLeftPane());
    splitContainer.appendChild(buildResizer());
    splitContainer.appendChild(buildRightPane());
    document.body.insertBefore(splitContainer, document.body.firstChild);

    // Cache refs
    codeInput    = document.getElementById('leetify-code-input');
    hlLayer      = document.getElementById('leetify-highlight-layer');
    gutterInner  = document.getElementById('leetify-gutter-inner');
    statusCursor = document.getElementById('lsb-cursor');
    statusChars  = document.getElementById('lsb-chars');
    statusLang   = document.getElementById('lsb-lang');

    setupResizer(
      document.getElementById('leetify-resizer'),
      document.getElementById('leetify-left-pane')
    );
    setupEditor();
    bindToolbar();
  }

  /* ── Left pane ── */
  function buildLeftPane() {
    const pane = document.createElement('div');
    pane.id = 'leetify-left-pane';

    const exitBtn = document.createElement('button');
    exitBtn.id = 'leetify-toggle-back';
    exitBtn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Exit Split View
    `;
    exitBtn.addEventListener('click', exitSplit);
    pane.appendChild(exitBtn);
    return pane;
  }

  /* ── Resizer ── */
  function buildResizer() {
    const r = document.createElement('div');
    r.id = 'leetify-resizer';
    return r;
  }

  /* ── Right pane ── */
  function buildRightPane() {
    const pane = document.createElement('div');
    pane.id = 'leetify-right-pane';
    const def = LANG[currentLang];

    // Build language options
    const langOpts = Object.entries(LANG).map(([k, v]) =>
      `<option value="${k}"${k === currentLang ? ' selected' : ''}>${v.label}</option>`
    ).join('');

    pane.innerHTML = `
      <!-- Tab bar -->
      <div class="leetify-tab-bar">
        <div class="leetify-tab active" id="leetify-tab">
          <span class="leetify-tab-dot"></span>
          <span id="leetify-tab-name">${def.filename}</span>
        </div>
      </div>

      <!-- Toolbar: only functional controls -->
      <div class="leetify-toolbar">
        <div class="leetify-toolbar-left">
          <!-- Language -->
          <select class="leetify-select" id="leetify-lang-sel" title="Language">${langOpts}</select>

          <span class="leetify-sep"></span>

          <!-- Font size -->
          <button class="leetify-tbtn" id="lbtn-font-down" title="Decrease font size">A−</button>
          <span class="lsb" id="lbtn-font-label" style="color:var(--ui-muted);font-size:11px;min-width:24px;text-align:center;">${currentFontSize}px</span>
          <button class="leetify-tbtn" id="lbtn-font-up"   title="Increase font size">A+</button>

          <span class="leetify-sep"></span>

          <!-- Word wrap -->
          <button class="leetify-tbtn" id="lbtn-wrap" title="Toggle word wrap">↵ Wrap</button>

          <span class="leetify-sep"></span>

          <!-- Focus mode (hide problem pane) -->
          <button class="leetify-tbtn" id="lbtn-focus" title="Focus mode: hide problem pane">⛶ Focus</button>
        </div>

        <div class="leetify-toolbar-right">
          <!-- Reset -->
          <button class="leetify-tbtn" id="lbtn-reset" title="Reset to boilerplate">↺ Reset</button>

          <!-- Copy -->
          <button class="leetify-tbtn" id="lbtn-copy" title="Copy code to clipboard">⎘ Copy</button>

          <!-- Submit (opens CF submit page) -->
          <button class="leetify-tbtn submit" id="lbtn-submit" title="Submit on Codeforces">▶ Submit</button>
        </div>
      </div>

      <!-- Editor area: gutter + stacked (highlight pre + textarea) -->
      <div class="leetify-editor-body">
        <div class="leetify-gutter" id="leetify-gutter">
          <div class="leetify-gutter-inner" id="leetify-gutter-inner"></div>
        </div>
        <div class="leetify-editor-stack">
          <pre id="leetify-highlight-layer" aria-hidden="true"></pre>
          <textarea
            id="leetify-code-input"
            autocomplete="off" autocorrect="off"
            autocapitalize="off" spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- Status bar -->
      <div class="leetify-status-bar">
        <span class="lsb accent"><span class="lsb-dot"></span>Monokai</span>
        <span class="lsb" id="lsb-lang">${currentLang.toUpperCase()}</span>
        <span class="lsb spacer"></span>
        <span class="lsb" id="lsb-cursor">Ln 1, Col 1</span>
        <span class="lsb" id="lsb-chars">0 chars</span>
        <span class="lsb">Tab: 4</span>
        <span class="lsb">UTF-8</span>
      </div>
    `;
    return pane;
  }

  /* ════════════════════════════════════════════════════════════
     EDITOR LOGIC
  ════════════════════════════════════════════════════════════ */
  function setupEditor() {
    codeInput.value = LANG[currentLang].boilerplate;
    refreshAll();

    codeInput.addEventListener('input',   () => { refreshAll(); });
    codeInput.addEventListener('keydown', onKeyDown);
    codeInput.addEventListener('scroll',  syncScroll);
    codeInput.addEventListener('keyup',   updateStatus);
    codeInput.addEventListener('mouseup', updateStatus);
    codeInput.addEventListener('click',   updateStatus);
  }

  /* ── Bracket/quote pair tables ── */
  const OPEN_TO_CLOSE = { '{':'}', '(':')','[':']', '"':'"', "'":"'" };
  const CLOSE_CHARS   = new Set([')', '}', ']', '"', "'"]); // for skip logic

  function onKeyDown(e) {
    const meta = e.ctrlKey || e.metaKey; // Ctrl on Win/Linux, Cmd on Mac

    /* ════════ Ctrl+/ : Toggle line comment ════════ */
    if (meta && e.key === '/') {
      e.preventDefault();
      toggleLineComment();
      return;
    }

    /* ════════ Ctrl+D : Duplicate line ════════ */
    if (meta && e.key === 'd') {
      e.preventDefault();
      duplicateLine();
      return;
    }

    /* ════════ Home key: smart home (col 0 ↔ first non-space) ════════ */
    if (e.key === 'Home' && !e.shiftKey) {
      e.preventDefault();
      const s   = codeInput.selectionStart;
      const val = codeInput.value;
      const lineStart    = val.lastIndexOf('\n', s - 1) + 1;
      const firstNonWS   = lineStart + (val.slice(lineStart).match(/^(\s*)/)[1].length);
      // Toggle: if already at firstNonWS go to lineStart, else go to firstNonWS
      codeInput.selectionStart = codeInput.selectionEnd =
        (s === firstNonWS) ? lineStart : firstNonWS;
      updateStatus();
      return;
    }

    /* ════════ Tab / Shift+Tab ════════ */
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = codeInput.selectionStart, end = codeInput.selectionEnd;
      const val = codeInput.value;

      if (s !== end) {
        // Multi-line selection: indent or dedent every affected line
        const firstLF  = val.lastIndexOf('\n', s - 1) + 1;
        const lastLF   = val.lastIndexOf('\n', end - 1) + 1;
        const block    = val.slice(firstLF, end);
        let newBlock;
        if (e.shiftKey) {
          newBlock = block.replace(/^( {1,4})/gm, '');
        } else {
          newBlock = block.replace(/^/gm, '    ');
        }
        codeInput.value = val.slice(0, firstLF) + newBlock + val.slice(end);
        codeInput.selectionStart = firstLF;
        codeInput.selectionEnd   = firstLF + newBlock.length;
      } else if (e.shiftKey) {
        // Shift-Tab on single line: remove up to 4 leading spaces
        const lineStart = val.lastIndexOf('\n', s - 1) + 1;
        const spaces = val.slice(lineStart).match(/^ {1,4}/);
        if (spaces) {
          codeInput.value = val.slice(0, lineStart) + val.slice(lineStart + spaces[0].length);
          codeInput.selectionStart = codeInput.selectionEnd =
            Math.max(s - spaces[0].length, lineStart);
        }
      } else {
        // Tab on empty selection: insert 4 spaces
        codeInput.value = val.slice(0, s) + '    ' + val.slice(end);
        codeInput.selectionStart = codeInput.selectionEnd = s + 4;
      }
      refreshAll();
      return;
    }

    /* ════════ Enter: smart indent + bracket expansion ════════ */
    if (e.key === 'Enter') {
      e.preventDefault();
      const s   = codeInput.selectionStart;
      const val = codeInput.value;
      const lineStart  = val.lastIndexOf('\n', s - 1) + 1;
      const indent     = val.slice(lineStart).match(/^(\s*)/)[1];
      const charBefore = val[s - 1];
      const charAfter  = val[s];

      // Bracket expansion: { | }  →  {\n    |\n}
      if (OPEN_TO_CLOSE[charBefore] && charAfter === OPEN_TO_CLOSE[charBefore]) {
        const middle = '\n' + indent + '    ';
        const close  = '\n' + indent;
        // charAfter (the closing bracket) is already in val, we just insert
        // two newlines before it, leaving closing bracket in place.
        codeInput.value =
          val.slice(0, s) + middle + close + val.slice(s);
        // Cursor sits at end of middle line (after the extra indent)
        codeInput.selectionStart = codeInput.selectionEnd = s + middle.length;
      } else {
        // Normal Enter: match current line indent only, no extra bump
        const ins = '\n' + indent;
        codeInput.value =
          val.slice(0, s) + ins + val.slice(codeInput.selectionEnd);
        codeInput.selectionStart = codeInput.selectionEnd = s + ins.length;
      }
      refreshAll();
      return;
    }

    /* ════════ Backspace: delete pair if cursor sits between them ════════ */
    if (e.key === 'Backspace' && codeInput.selectionStart === codeInput.selectionEnd) {
      const s   = codeInput.selectionStart;
      const val = codeInput.value;
      const cb  = val[s - 1];
      const ca  = val[s];
      if (cb && ca && OPEN_TO_CLOSE[cb] === ca) {
        e.preventDefault();
        codeInput.value = val.slice(0, s - 1) + val.slice(s + 1);
        codeInput.selectionStart = codeInput.selectionEnd = s - 1;
        refreshAll();
        return;
      }
    }

    /* ════════ Smart closing-bracket skip ════════
       Must be checked BEFORE the auto-open handler below,
       so that typing ) when ) is already at the cursor
       just moves past it instead of inserting a second one. */
    if (
      CLOSE_CHARS.has(e.key) &&
      codeInput.selectionStart === codeInput.selectionEnd &&
      codeInput.value[codeInput.selectionStart] === e.key
    ) {
      e.preventDefault();
      codeInput.selectionStart = codeInput.selectionEnd = codeInput.selectionStart + 1;
      updateStatus();
      return;
    }

    /* ════════ Auto-close opening brackets / quotes ════════ */
    if (OPEN_TO_CLOSE[e.key]) {
      e.preventDefault();
      const s   = codeInput.selectionStart;
      const end = codeInput.selectionEnd;
      const val = codeInput.value;
      const sel = val.slice(s, end);
      const close = OPEN_TO_CLOSE[e.key];
      codeInput.value = val.slice(0, s) + e.key + sel + close + val.slice(end);
      if (s === end) {
        // No selection: place cursor between the pair
        codeInput.selectionStart = codeInput.selectionEnd = s + 1;
      } else {
        // Wrap selection: keep it selected (including both delimiters)
        codeInput.selectionStart = s;
        codeInput.selectionEnd   = s + 1 + sel.length + 1;
      }
      refreshAll();
      return;
    }
  }

  /* ── Toggle line comment (Ctrl+/) ── */
  function toggleLineComment() {
    const COMMENT_PREFIX = {
      cpp: '//', java: '//', javascript: '//', python: '#',
    };
    const prefix = COMMENT_PREFIX[currentLang] || '//';
    const s   = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    const val = codeInput.value;

    // Find start of first affected line and end of last affected line
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    // For the end boundary: if selection ends exactly at a line start, don't include that line
    const selEnd   = (end > s && val[end - 1] === '\n') ? end - 1 : end;
    const lineEnd  = val.indexOf('\n', selEnd);
    const blockEnd = lineEnd === -1 ? val.length : lineEnd;

    const block    = val.slice(lineStart, blockEnd);
    const lines    = block.split('\n');

    // Decide: if ALL lines already start with prefix → uncomment, else comment
    const allCommented = lines.every(l => l.trimStart().startsWith(prefix));
    const newLines = lines.map(l => {
      if (allCommented) {
        // Remove first occurrence of prefix (respecting indent)
        return l.replace(new RegExp('(\\s*)' + escRegex(prefix) + '\\s?'), '$1');
      } else {
        // Add prefix at the indent level
        return l.replace(/^(\s*)/, '$1' + prefix + ' ');
      }
    });

    const newBlock = newLines.join('\n');
    codeInput.value = val.slice(0, lineStart) + newBlock + val.slice(blockEnd);
    // Restore selection roughly
    codeInput.selectionStart = lineStart;
    codeInput.selectionEnd   = lineStart + newBlock.length;
    refreshAll();
  }

  function escRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ── Duplicate current line (Ctrl+D) ── */
  function duplicateLine() {
    const s   = codeInput.selectionStart;
    const val = codeInput.value;
    const lineStart = val.lastIndexOf('\n', s - 1) + 1;
    const lineEnd   = val.indexOf('\n', s);
    const end       = lineEnd === -1 ? val.length : lineEnd;
    const line      = val.slice(lineStart, end);
    const ins       = '\n' + line;
    codeInput.value =
      val.slice(0, end) + ins + val.slice(end);
    // Move cursor to same column on the duplicated line
    codeInput.selectionStart = codeInput.selectionEnd = s + ins.length;
    refreshAll();
  }



  /* ── Refresh highlight layer + gutter ── */
  function refreshAll() {
    refreshHighlight();
    refreshGutter();
    updateStatus();
  }

  function refreshHighlight() {
    // Trailing \n hack: keeps pre height = textarea height
    hlLayer.innerHTML = highlight(codeInput.value, currentLang) + '\n';
  }

  /**
   * Rebuild gutter: one <div class="mk-ln"> per line.
   * CSS sets height: var(--ed-line-height) on .mk-ln, which is the same
   * pixel value as ED.lineHeight → perfect alignment, no doubling.
   */
  function refreshGutter() {
    const count = codeInput.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= count; i++) html += `<div class="mk-ln">${i}</div>`;
    gutterInner.innerHTML = html;
  }

  /**
   * Sync both the highlight layer scroll AND the gutter via CSS transform
   * (gutter container is overflow:hidden so no scrollbar appears there).
   */
  function syncScroll() {
    hlLayer.scrollTop  = codeInput.scrollTop;
    hlLayer.scrollLeft = codeInput.scrollLeft;
    // Shift gutter content up by scrollTop to keep line numbers aligned
    gutterInner.style.transform = `translateY(-${codeInput.scrollTop}px)`;
  }

  /* ── Cursor / char status ── */
  function updateStatus() {
    const val = codeInput.value;
    const pos = codeInput.selectionStart;
    const before = val.slice(0, pos).split('\n');
    const ln = before.length, col = before[before.length - 1].length + 1;
    if (statusCursor) statusCursor.textContent = `Ln ${ln}, Col ${col}`;
    if (statusChars)  statusChars.textContent  = `${val.length} chars`;
  }

  /* ── Font size ── */
  function setFontSize(px) {
    currentFontSize = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
    const lh = Math.round(currentFontSize * 1.615);

    // Update CSS custom properties on the container
    const rp = document.getElementById('leetify-right-pane');
    rp.style.setProperty('--ed-font-size',   currentFontSize + 'px');
    rp.style.setProperty('--ed-line-height',  lh + 'px');

    // Gutter .mk-ln divs are sized via CSS var, so they auto-update.
    // But we need to re-sync the gutter transform in case scroll position differs.
    syncScroll();

    const lbl = document.getElementById('lbtn-font-label');
    if (lbl) lbl.textContent = currentFontSize + 'px';
  }

  /* ── Language change ── */
  function changeLang(lang) {
    if (!LANG[lang]) return;
    currentLang = lang;
    codeInput.value = LANG[lang].boilerplate;
    const tabName = document.getElementById('leetify-tab-name');
    if (tabName) tabName.textContent = LANG[lang].filename;
    if (statusLang) statusLang.textContent = lang.toUpperCase();
    refreshAll();
  }

  /* ── Word wrap ── */
  function toggleWrap() {
    wrapOn = !wrapOn;
    const rp = document.getElementById('leetify-right-pane');
    rp.classList.toggle('wrap-on', wrapOn);
    const btn = document.getElementById('lbtn-wrap');
    if (btn) btn.classList.toggle('active', wrapOn);
  }

  /* ── Focus mode ── */
  function toggleFocus() {
    splitContainer.classList.toggle('focus-mode');
    const btn = document.getElementById('lbtn-focus');
    if (btn) btn.classList.toggle('active', splitContainer.classList.contains('focus-mode'));
  }

  /* ── Reset ── */
  function resetCode() {
    if (!confirm('Reset code to boilerplate?')) return;
    codeInput.value = LANG[currentLang].boilerplate;
    refreshAll();
    codeInput.focus();
  }

  /* ── Copy ── */
  async function copyCode() {
    await navigator.clipboard.writeText(codeInput.value);
    const btn = document.getElementById('lbtn-copy');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.color = 'var(--ui-accent)';
    btn.style.borderColor = 'var(--ui-accent)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  }

  /* ── Submit: open CF submit page in same tab ── */
  function submitCode() {
    // Try to build a CF submit URL from the current page URL
    const url = window.location.href;
    const contestMatch = url.match(/codeforces\.com\/contest\/(\d+)\/problem\/([A-Z0-9]+)/i);
    const problemMatch = url.match(/codeforces\.com\/problemset\/problem\/(\d+)\/([A-Z0-9]+)/i);

    let submitUrl = null;
    if (contestMatch) {
      submitUrl = `https://codeforces.com/contest/${contestMatch[1]}/submit`;
    } else if (problemMatch) {
      submitUrl = `https://codeforces.com/problemset/submit`;
    }

    if (submitUrl) {
      // Copy code to clipboard first, then open the page
      navigator.clipboard.writeText(codeInput.value).then(() => {
        alert('Code copied to clipboard.\nPaste it on the submission page that will open.');
        window.open(submitUrl, '_blank');
      });
    } else {
      alert('Could not detect a Codeforces contest URL. Please navigate to a problem page.');
    }
  }

  /* ── Bind toolbar buttons ── */
  function bindToolbar() {
    document.getElementById('leetify-lang-sel')
      .addEventListener('change', e => changeLang(e.target.value));
    document.getElementById('lbtn-font-down')
      .addEventListener('click', () => setFontSize(currentFontSize - 1));
    document.getElementById('lbtn-font-up')
      .addEventListener('click', () => setFontSize(currentFontSize + 1));
    document.getElementById('lbtn-wrap')
      .addEventListener('click', toggleWrap);
    document.getElementById('lbtn-focus')
      .addEventListener('click', toggleFocus);
    document.getElementById('lbtn-reset')
      .addEventListener('click', resetCode);
    document.getElementById('lbtn-copy')
      .addEventListener('click', copyCode);
    document.getElementById('lbtn-submit')
      .addEventListener('click', submitCode);
  }

  /* ════════════════════════════════════════════════════════════
     RESIZER
  ════════════════════════════════════════════════════════════ */
  function setupResizer(bar, leftPane) {
    let dragging = false;
    bar.addEventListener('mousedown', e => {
      dragging = true;
      bar.classList.add('resizing');
      document.body.style.cursor     = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const w   = window.innerWidth;
      const px  = Math.max(w * 0.2, Math.min(e.clientX, w * 0.75));
      leftPane.style.width = (px / w * 100) + '%';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('resizing');
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    });
  }

  /* ════════════════════════════════════════════════════════════
     BOOTSTRAP
  ════════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
