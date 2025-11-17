# Copy As PlainText

**Clean, one-click plain-text copy from Obsidian!**

![GitHub release (latest by date)](https://img.shields.io/github/v/release/FinickySpider/Obsidian-Copy-as-Plaintext?color=%23483699)
![Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&logoColor=white&color=%23483699&label=downloads&query=%24%5B%22copy-plaintext%22%5D.downloads&url=https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json)
![GitHub stars](https://img.shields.io/github/stars/FinickySpider/Obsidian-Copy-as-Plaintext?style=social)



> [!IMPORTANT]
> If you want to use *any* advanced/fine-tuning settings, make sure to **disable Simple Mode** in the plugin options. If Simple Mode is on, all advanced options are ignored.

<details><summary>Table&nbsp;of&nbsp;Contents</summary>


<!-- TOC -->
- [Copy As PlainText](#copy-as-plaintext)
  - [What It Does](#what-it-does)
  - [Features](#features)
  - [Installation](#installation)
    - [Community](#community)
    - [Manual](#manual)
  - [Usage](#usage)
  - [Screenshots](#screenshots)
    - [Settings Panel](#settings-panel)
    - [Context Menu](#context-menu)
  - [Known Issues \& Quirks](#known-issues--quirks)
  - [FAQ](#faq)
  - [Support \& Feedback](#support--feedback)
  - [License](#license)
<!-- /TOC -->


</details>

## What It Does

- Adds a “Copy as Plain-Text” command to:
  - The editor’s right-click context menu  
  - The Command Palette    
- Offers two stripping modes:
    1. Super Simple (regex-based) — strips common markers like
    `#`, `**bold**`, `*italic*`, `` `code` ``, `[links](url)`, `![images](url)` 
    2. Unified/Remark (AST-based) — full GFM support (tables, task lists, footnotes, math, frontmatter, HTML blocks)  
- Fine-tunable settings let you enable/disable:
  - GFM tables & task lists  
  - YAML frontmatter  
  - Inline and block math  
  - Footnotes & inline refs  
  - Highlight markers (==text==)  
  - Custom markers ([~], [>])  
  - List numbers (1., 2., …)  
  - Dashes wrapping words (---word---)  
  - Hashtags (#tag) and mentions (@user)  
  - LaTeX commands (\quad, \int, etc.)  

---

## Features

- Strip basic Markdown: headings, emphasis, links, images, inline code  
- Unified AST processing for robust handling of tables, footnotes, math, HTML blocks  
- Super Simple mode for minimal regex stripping, ideal for quick, predictable plain-text  
- Context menu integration for one-click copying  
- Command Palette entry for keyboard-driven workflow  
- Customizable: toggle each stripping step on or off in plugin settings  

---

## Installation

### Community 

- Search for 'Copy As PlainText' in Obsidian’s Community Plugins browser.

<details> 
<summary>Manual Installation - Click to expand</summary>

### Manual

1. Download the latest ZIP from the [Releases page](https://github.com/FinickySpider/Obsidian-Copy-as-Plaintext/releases)  
2. Extract into your vault’s plugin folder:  
'YourVault/.obsidian/plugins/'
3. Open Obsidian → Settings → Community Plugins → Reload or toggle “Copy As PlainText” on.
</details>

---

## Usage

1. Select the text in any Markdown note.  
2. Right-click → Copy as Plain-Text, or open the Command Palette (Ctrl/Cmd+P) → Copy as Plain-Text.  
3. Paste anywhere, your selected text will be stripped of Markdown formatting.  
4. Optionally, open Settings → Plugin Options to tweak which syntax elements to strip or preserve.

---

## Screenshots

### Settings Panel
<img src="screenshots/settings.png" width="600" alt="Settings panel">


### Context Menu
<img src="screenshots/context-menu.png" width="600" alt="Context menu">


---

## Known Issues & Quirks

- **Performance:** AST-based stripping can be slower on very large selections—use Super Simple mode for speed.  
- Edge-case syntax: Some niche Markdown plugins or custom syntax may not be recognized by the AST pipeline.  
- Backslash escapes: By default, backslash-escaped characters (e.g. \*, \[ ) are unescaped; toggle settings if you need to preserve literal backslashes.  
- Table layout: The AST pipeline removes table structure; if you need plain rows or pipes, consider disabling table stripping in settings.

---

## FAQ

**Q:** Why don’t my settings seem to do anything?  
**A:** Make sure **Simple Mode** is turned *off* in the plugin settings, otherwise, advanced options are ignored.

**Q:** Can I copy images as plain text?  
**A:** Yes. Markdown image links are stripped down to the alt/title text.

**Q:** Does it handle custom Markdown plugins?  
**A:** The AST-based mode covers most standard Markdown. Some third-party plugin syntax might not be recognized. Though during my torture tests it covered most things. Let me know if you have requests for specific plugin stripping [Here](https://github.com/FinickySpider/Obsidian-Copy-as-Plaintext/issues)  

**Q:** What’s the difference between Simple Mode and Unified/Remark?  
**A:** Simple Mode is a fast, lightweight text-only method that strips Markdown using simple rules (think regex). It’s quick and works well for basic notes, but can make mistakes with complex formatting (code blocks, nested styling, HTML, tables, etc.). Unified/Remark parses the Markdown properly and removes formatting reliably. It’s slower, but the results are more accurate.

---

## Support & Feedback

I'd love to hear from you, if you have feature requests, issues, questions, or just want to talk about it! I'm always happy to help tweak things or create niche features is needed.

- GitHub Issues: [Report bugs or request features](https://github.com/FinickySpider/Obsidian-Copy-as-Plaintext/issues)  

---

## License
![BSD 0-Clause license](https://img.shields.io/badge/license-BSD%200--Clause-blue)

---

*Built with ❤️ for Obsidian users who just want clean, copy-ready text.*

<details>
<summary><strong>Appreciate the script?</strong></summary>

If this script helped you, you can support it here:

<a href="https://ko-fi.com/P5P71EDY8L" target="_blank">
  <img src="https://storage.ko-fi.com/cdn/kofi2.png?v=6" width="150" alt="Buy me a coffee">
</a>

_Thanks for visiting ☕_
</details>
