#!/usr/bin/env node

function decodeHTML(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
}

function stripHtml(html) {
  let depth = 0
  let processed = ''
  let i = 0
  let inTag = false
  let tagStart = -1
  
  while (i < html.length && i < 10000) {
    const char = html[i]
    
    if (char === '<' && !inTag) {
      const nextChars = html.slice(i, i + 10)
      if (/^<[a-zA-Z!/]/.test(nextChars)) {
        inTag = true
        tagStart = i
      } else {
        processed += char
      }
      i++
      continue
    }
    
    if (char === '>' && inTag) {
      inTag = false
      const tagContent = html.slice(tagStart, i + 1)
      
      if (tagContent.match(/<ul|<ol/i)) {
        depth++
        processed += '\n'
      } else if (tagContent.match(/<\/ul|<\/ol/i)) {
        depth = Math.max(0, depth - 1)
        processed += '\n'
      } else if (tagContent.match(/<li/i)) {
        const indent = '  '.repeat(Math.max(0, depth))
        processed += `\n${indent}• `
      } else if (tagContent.match(/<\/li/i)) {
        processed += '\n'
      } else if (tagContent.match(/<br/i)) {
        processed += '\n'
      } else if (tagContent.match(/<\/p/i)) {
        processed += '\n'
      }
      
      i++
      continue
    }
    
    if (inTag) {
      i++
      continue
    }
    
    processed += char
    i++
  }
  
  return processed.replace(/\n{3,}/g, '\n\n').trim()
}

const testHtml = "<li>Pet's name is erroneously called 'Baby Weaver III' instead of 'BabyWeaver III'.";
const decoded = decodeHTML(testHtml);
const stripped = stripHtml(decoded);

console.log('Input HTML:', testHtml);
console.log('After decode:', decoded);
console.log('After stripHtml:', stripped);
console.log('Length:', stripped.length);
console.log('\nCharacter analysis around position 30-40:');
console.log([...stripped].slice(30, 40).map((c, i) => `${30+i}: '${c}' (${c.charCodeAt(0)})`).join('\n'));
