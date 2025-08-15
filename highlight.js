// Simple offline highlighter (regex-based)
(function(){
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function highlight(text){
    let s = esc(text);
    s = s.replace(/(\/\*[\s\S]*?\*\/|\/\/.*$)/gm, m => `<span class="hl-comment">${m}</span>`);
    s = s.replace(/(".*?"|'.*?'|`[\s\S]*?`)/g, m => `<span class="hl-string">${m}</span>`);
    s = s.replace(/\b(\d+(\.\d+)?)\b/g, m => `<span class="hl-number">${m}</span>`);
    s = s.replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|class|try|catch|finally|throw|await|async)\b/g, m => `<span class="hl-keyword">${m}</span>`);
    s = s.replace(/\b(window|document|console|JSON|Math|Date|Array|Object|String|Number|Boolean|fetch|localStorage)\b/g, m => `<span class="hl-built">${m}</span>`);
    s = s.replace(/([a-zA-Z_]\w*)(?=\s*\()/g, m => `<span class="hl-function">${m}</span>`);
    return s;
  }
  window.SimpleHighlighter = { highlight };
})();
