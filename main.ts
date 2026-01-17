import { Plugin, Notice, Editor, PluginSettingTab, Setting, App } from "obsidian";
import removeMd from "remove-markdown";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkFootnotes from "remark-footnotes";
import strip from "strip-markdown";
import remarkStringify from "remark-stringify";

// ─────────────────────────────────────────────────────────────
// TYPE DEFINITIONS FOR SETTINGS
// ─────────────────────────────────────────────────────────────

/**
 * Mode for handling internal link text output
 * - "alias": Prefer alias if present, else use target (default)
 * - "target": Always use target, ignore alias
 */
type InternalLinkMode = "alias" | "target";

/**
 * Mode for handling [[Page#Heading]] or [[Page^blockid]] parts
 * - "keep": Keep the full target including heading/block parts
 * - "page": Strip to just the page name
 * - "part": Use only the heading/block part (e.g., "Heading")
 */
type HeadingBlockPartMode = "keep" | "page" | "part";

/**
 * Mode for stripping block IDs (^abcdef)
 * - "eol": Only strip at end of line (safer, default)
 * - "anywhere": Strip anywhere in line (advanced)
 */
type BlockIdMode = "eol" | "anywhere";

/**
 * Mode for handling embeds (![[...]])
 * - "remove": Remove embed entirely (default)
 * - "placeholder": Replace with [embedded: Note]
 * - "linktext": Convert to link-text equivalent (like stripped link)
 */
type EmbedMode = "remove" | "placeholder" | "linktext";

/**
 * Mode for handling non-markdown file targets (pdf, png, mp3, etc.)
 * - "alias": Alias if present, else filename (default)
 * - "filename": Always use filename
 * - "remove": Remove entirely
 * - "placeholder": Use [file: filename] placeholder
 */
type NonMdTargetMode = "alias" | "filename" | "remove" | "placeholder";

interface CopyPlainTextSettings {
  // ── Existing Settings ──
  useUnified: boolean;
  parseGfm: boolean;
  removeFrontmatter: boolean;
  removeMath: boolean;
  removeFootnotes: boolean;
  dehighlight: boolean;
  removeForwardRefs: boolean;
  unwrapBlockMath: boolean;
  removeListNumbers: boolean;
  normalizeDashes: boolean;
  stripHashtags: boolean;
  stripMentions: boolean;
  sanitizeMath: boolean;
  superSimple: boolean;

  // ── NEW: Obsidian-Specific Stripping (FR-1) ──

  // Feature 1: Internal Links [[LINK|TEXT]] and [[LINK]]
  stripInternalLinks: boolean;
  internalLinkMode: InternalLinkMode;
  stripPathsToBasename: boolean;
  headingBlockPartMode: HeadingBlockPartMode;

  // Feature 2: Block IDs ^abcdef
  stripBlockIds: boolean;
  blockIdMode: BlockIdMode;

  // Feature 3: Embeds ![[...]]
  handleEmbeds: boolean;
  embedMode: EmbedMode;

  // Feature 4: Non-markdown file targets
  handleNonMdTargets: boolean;
  nonMdTargetMode: NonMdTargetMode;
}

const DEFAULT_SETTINGS: CopyPlainTextSettings = {
  // ── Existing Defaults ──
  useUnified: false,
  parseGfm: false,
  removeFrontmatter: false,
  removeMath: false,
  removeFootnotes: false,
  dehighlight: false,
  removeForwardRefs: false,
  unwrapBlockMath: false,
  removeListNumbers: false,
  normalizeDashes: false,
  stripHashtags: false,
  stripMentions: false,
  sanitizeMath: false,
  superSimple: true,

  // ── NEW: Obsidian-Specific Stripping Defaults (FR-1) ──

  // Feature 1: Internal Links - ON by default, prefer alias
  stripInternalLinks: true,
  internalLinkMode: "alias",
  stripPathsToBasename: false,
  headingBlockPartMode: "keep",

  // Feature 2: Block IDs - ON by default, end-of-line only
  stripBlockIds: true,
  blockIdMode: "eol",

  // Feature 3: Embeds - ON by default, remove entirely
  handleEmbeds: true,
  embedMode: "remove",

  // Feature 4: Non-md targets - ON by default, alias if present else filename
  handleNonMdTargets: true,
  nonMdTargetMode: "alias",
};

export default class CopyPlaintextPlugin extends Plugin {
  settings: CopyPlainTextSettings;

  async onload() {
    //console.log("Copy As PlainText plugin loaded ✅");
    await this.loadSettings();

    this.addCommand({
      id: "copy-plaintext",
      name: "Copy selection as plain-text",
      editorCallback: (editor: Editor) => this.copySelection(editor),
    });

    this.addCommand({
      id: "copy-plaintext-note",
      name: "Copy entire note as plain-text",
      editorCallback: (editor: Editor) => this.copyNote(editor),
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        if (!editor.getSelection()) return;
        menu.addItem(item =>
          item
            .setTitle("Copy as plain-text")
            .setIcon("copy")
            .onClick(() => this.copySelection(editor))
        );
      })
    );

    this.addSettingTab(new CopyPlaintextSettingTab(this.app, this));
  }

  onunload() {
    //console.log("Copy As PlainText plugin unloaded 📴");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async copySelection(editor: Editor) {
    const raw = editor.getSelection();
    if (!raw) {
      new Notice("Nothing selected.");
      return;
    }

    let plain: string;
    if (this.settings.superSimple) {
      plain = this.simpleStrip(raw);
    } else if (this.settings.useUnified) {
      plain = this.unifiedStrip(raw);
    } else {
      plain = removeMd(raw);
    }

    try {
      await navigator.clipboard.writeText(plain);
      new Notice("Copied as plain-text ✔️", 1500);
    } catch (err) {
      console.error(err);
      new Notice("Copy failed – see console.");
    }
  }

  private async copyNote(editor: Editor) {
    const raw = editor.getValue();
    if (!raw) {
      new Notice("Note is empty.");
      return;
    }

    let plain: string;
    if (this.settings.superSimple) {
      plain = this.simpleStrip(raw);
    } else if (this.settings.useUnified) {
      plain = this.unifiedStrip(raw);
    } else {
      plain = removeMd(raw);
    }

    try {
      await navigator.clipboard.writeText(plain);
      new Notice("Copied note as plain-text ✔️", 1500);
    } catch (err) {
      console.error(err);
      new Notice("Copy failed – see console.");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // OBSIDIAN-SPECIFIC STRIPPING HELPERS (FR-1)
  // ─────────────────────────────────────────────────────────────

  /**
   * Common file extensions considered "non-markdown" targets
   */
  private static readonly NON_MD_EXTENSIONS = /\.(pdf|png|jpg|jpeg|gif|svg|webp|bmp|ico|mp3|mp4|wav|ogg|webm|mov|avi|mkv|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|tar|gz|csv|json|xml|html|css|js|ts)$/i;

  /**
   * Check if a target looks like a non-markdown file
   */
  private isNonMdTarget(target: string): boolean {
    return CopyPlaintextPlugin.NON_MD_EXTENSIONS.test(target);
  }

  /**
   * Extract basename from a path (e.g., "Folder/Sub/Page" → "Page")
   */
  private extractBasename(target: string): string {
    const lastSlash = target.lastIndexOf("/");
    return lastSlash >= 0 ? target.substring(lastSlash + 1) : target;
  }

  /**
   * Process the target part of a link, stripping heading/block references if configured
   * Input: "Page#Heading" or "Page^blockid" or "Page"
   * Output: depends on headingBlockPartMode setting
   */
  private processLinkTarget(target: string): string {
    let result = target;

    // Handle heading references: [[Page#Heading]]
    const headingMatch = result.match(/^(.+?)#(.+)$/);
    if (headingMatch) {
      switch (this.settings.headingBlockPartMode) {
        case "page":
          result = headingMatch[1]; // Just the page
          break;
        case "part":
          result = headingMatch[2]; // Just the heading
          break;
        case "keep":
        default:
          // Keep as-is (will show "Page#Heading")
          break;
      }
    }

    // Handle block references: [[Page^blockid]]
    const blockMatch = result.match(/^(.+?)\^([A-Za-z0-9-]+)$/);
    if (blockMatch) {
      switch (this.settings.headingBlockPartMode) {
        case "page":
        case "part":
          result = blockMatch[1]; // Strip block ID, keep page
          break;
        case "keep":
        default:
          // Keep as-is (will show "Page^blockid")
          break;
      }
    }

    // Apply basename stripping if enabled
    if (this.settings.stripPathsToBasename) {
      result = this.extractBasename(result);
    }

    return result;
  }

  /**
   * Determine the output text for an internal link based on settings
   * @param target The link target (e.g., "Page", "Folder/Page", "Page#Heading")
   * @param alias The alias if present (e.g., "Display Text"), or null
   * @param isNonMd Whether this is a non-markdown file target
   */
  private getLinkOutputText(target: string, alias: string | null, isNonMd: boolean): string {
    // Handle non-markdown targets specially if enabled
    if (isNonMd && this.settings.handleNonMdTargets) {
      switch (this.settings.nonMdTargetMode) {
        case "remove":
          return "";
        case "placeholder":
          return `[file: ${this.extractBasename(target)}]`;
        case "filename":
          return this.settings.stripPathsToBasename 
            ? this.extractBasename(target) 
            : target;
        case "alias":
        default:
          if (alias) return alias;
          return this.settings.stripPathsToBasename 
            ? this.extractBasename(target) 
            : target;
      }
    }

    // Regular markdown link handling
    switch (this.settings.internalLinkMode) {
      case "target":
        return this.processLinkTarget(target);
      case "alias":
      default:
        return alias ? alias : this.processLinkTarget(target);
    }
  }

  /**
   * Strip embeds: ![[Note]] or ![[Note|Alias]]
   * MUST be called BEFORE stripInternalLinks to avoid conflicts
   * 
   * Regex explanation:
   * !\[\[         - Match embed prefix ![[
   * ([^\]|]+)     - Capture group 1: target (anything except ] or |)
   * (?:\|([^\]]+))? - Optional non-capturing group with | and capture group 2: alias
   * \]\]          - Match closing ]]
   */
  private stripEmbeds(text: string): string {
    if (!this.settings.handleEmbeds) return text;

    // Pattern for embeds: ![[target]] or ![[target|alias]]
    const embedPattern = /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    return text.replace(embedPattern, (match, target: string, alias?: string) => {
      const isNonMd = this.isNonMdTarget(target);

      switch (this.settings.embedMode) {
        case "remove":
          return "";
        
        case "placeholder": {
          const displayName = this.settings.stripPathsToBasename 
            ? this.extractBasename(target) 
            : target;
          return `[embedded: ${displayName}]`;
        }
        
        case "linktext":
          // Treat like a stripped internal link
          return this.getLinkOutputText(target, alias || null, isNonMd);
        
        default:
          return "";
      }
    });
  }

  /**
   * Strip internal links: [[Link]] or [[Link|Alias]]
   * Should be called AFTER stripEmbeds
   * 
   * Regex explanation:
   * \[\[          - Match opening [[
   * ([^\]|]+)     - Capture group 1: target (anything except ] or |)
   * (?:\|([^\]]+))? - Optional non-capturing group with | and capture group 2: alias
   * \]\]          - Match closing ]]
   */
  private stripInternalLinksFromText(text: string): string {
    if (!this.settings.stripInternalLinks) return text;

    // Pattern for internal links: [[target]] or [[target|alias]]
    const linkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    return text.replace(linkPattern, (match, target: string, alias?: string) => {
      const isNonMd = this.isNonMdTarget(target);
      return this.getLinkOutputText(target, alias || null, isNonMd);
    });
  }

  /**
   * Strip block IDs: ^abcdef at end of lines
   * 
   * Regex explanation (end-of-line mode):
   * \s+           - One or more whitespace chars before the block ID
   * \^            - Literal caret
   * [A-Za-z0-9-]+ - Block ID (alphanumeric + hyphens)
   * \s*           - Optional trailing whitespace
   * $             - End of line (with 'm' flag for multiline)
   * 
   * This ensures we don't strip carets used in math (e.g., "x^2")
   */
  private stripBlockIdsFromText(text: string): string {
    if (!this.settings.stripBlockIds) return text;

    switch (this.settings.blockIdMode) {
      case "anywhere":
        // Advanced: strip ^blockid anywhere (riskier - may catch math exponents)
        // Only match when preceded by whitespace to reduce false positives
        return text.replace(/\s+\^[A-Za-z0-9-]+/g, "");
      
      case "eol":
      default:
        // Safe default: only strip at end of line
        // Matches: " ^abcdef" or " ^abcdef   " at line end
        return text.replace(/\s+\^[A-Za-z0-9-]+\s*$/gm, "");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN STRIPPING METHODS
  // ─────────────────────────────────────────────────────────────

  private simpleStrip(text: string): string {
    let s = text;

    // ═══════════════════════════════════════════════════════════
    // OBSIDIAN-SPECIFIC STRIPPING (FR-1) - MUST COME FIRST
    // Order matters! Embeds before links to avoid conflicts.
    // ═══════════════════════════════════════════════════════════

    // FR-1.3) Strip embeds ![[...]] FIRST (before internal links)
    s = this.stripEmbeds(s);

    // FR-1.1) Strip internal wiki links [[...]]
    s = this.stripInternalLinksFromText(s);

    // FR-1.2) Strip block IDs ^abcdef (end-of-line)
    s = this.stripBlockIdsFromText(s);

    // ═══════════════════════════════════════════════════════════
    // STANDARD MARKDOWN STRIPPING (Original behavior)
    // ═══════════════════════════════════════════════════════════

    // 1) Strip heading hashes
    s = s.replace(/^#{1,6}\s+/gm, "");

    // 2) Unwrap bold & underline
    s = s.replace(/\*\*(.+?)\*\*/g, "$1");
    s = s.replace(/__(.+?)__/g, "$1");

    // 3) Unwrap italic
    s = s.replace(/\*(.+?)\*/g, "$1");
    s = s.replace(/_(.+?)_/g, "$1");

    // 4) Unwrap inline code
    s = s.replace(/`([^`\r\n]+)`/g, "$1");

    // 5) Images: ![alt](url) → alt
    s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

    // 6) Links: [text](url) → text
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // 7) Collapse multiple blank lines
    s = s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");

    return s.trim();
  }

  private unifiedStrip(text: string): string {
    // ═══════════════════════════════════════════════════════════
    // OBSIDIAN-SPECIFIC STRIPPING (FR-1) - MUST RUN FIRST!
    // Strip Obsidian syntax BEFORE unified pipeline processing,
    // otherwise the remark parser may mangle the syntax.
    // Order matters! Embeds before links to avoid conflicts.
    // ═══════════════════════════════════════════════════════════

    let s = text;

    // FR-1.3) Strip embeds ![[...]] FIRST (before internal links)
    s = this.stripEmbeds(s);

    // FR-1.1) Strip internal wiki links [[...]]
    s = this.stripInternalLinksFromText(s);

    // FR-1.2) Strip block IDs ^abcdef (end-of-line)
    s = this.stripBlockIdsFromText(s);

    // ═══════════════════════════════════════════════════════════
    // UNIFIED PIPELINE PROCESSING
    // ═══════════════════════════════════════════════════════════

    // Build our pipeline dynamically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pipeline = (unified as any)().use(remarkParse);

    if (this.settings.removeFrontmatter) {
      pipeline = pipeline.use(remarkFrontmatter, ["yaml"]);
    }
    if (this.settings.parseGfm) {
      pipeline = pipeline.use(remarkGfm);
    }
    if (this.settings.removeMath) {
      pipeline = pipeline.use(remarkMath);
    }
    if (this.settings.removeFootnotes) {
      pipeline = pipeline.use(remarkFootnotes, { inlineNotes: true });
    }

    pipeline = pipeline.use(strip).use(remarkStringify, { bullet: "-", fences: true });
    const file = pipeline.processSync(s);
    s = String(file);

    // Always-on cleanup:
    // 1) Unescape any remaining backslashes
    // eslint-disable-next-line no-useless-escape
    s = s.replace(/\\([\\`*_>~\[\]()#!\+\-\.\$])/g, "$1");

    // 2) Remove custom task markers [~]
    // eslint-disable-next-line no-useless-escape
    s = s.replace(/^\[\~\]\s*/gm, "");

    // 3) Remove empty-task brackets [ ]
    s = s.replace(/^\[\s*\]\s*/gm, "");

    // 4) Remove any remaining list bullets (-, *, +)
    // eslint-disable-next-line no-useless-escape
    s = s.replace(/^[\-\*\+]\s*/gm, "");

    // 5) Strip leading/trailing table pipes
    s = s.replace(/^\s*\|\s*/gm, "").replace(/\s*\|\s*$/gm, "");

    // Feature-gated extras:
    if (this.settings.dehighlight) {
      // ==highlight== → highlight
      s = s.replace(/==(.+?)==/g, "$1");
    }
    if (this.settings.removeForwardRefs) {
      // [>] prefix → removed
      s = s.replace(/^\[>\]\s*/gm, "");
    }
    if (this.settings.unwrapBlockMath) {
      // unwrap $$...$$ fences
      s = s.replace(/^\$\$\s*\n?([\s\S]*?)\n?\s*\$\$$/gm, "$1");
    }
    if (this.settings.removeListNumbers) {
      // Strip leading "1. ", "2. ", etc.
      s = s.replace(/^\d+\.\s*/gm, "");
    }
    if (this.settings.normalizeDashes) {
      // ---word--- → word, collapse runs of --
      s = s.replace(/-{2,}(.+?)-{2,}/g, "$1").replace(/-{3,}/g, "-");
    }
    if (this.settings.stripHashtags) {
      // #word → word
      s = s.replace(/#(\w+)/g, "$1");
    }
    if (this.settings.stripMentions) {
      // @user → user
      s = s.replace(/@(\w+)/g, "$1");
    }
    if (this.settings.sanitizeMath) {
      // Remove LaTeX commands: \quad, \text, \int, etc.
      s = s.replace(/\\[a-zA-Z]+/g, "");
    }

    return s.trim();
  }
}

class CopyPlaintextSettingTab extends PluginSettingTab {
  plugin: CopyPlaintextPlugin;

  constructor(app: App, plugin: CopyPlaintextPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Super Simple mode")
      .setDesc("Only strip #, **bold**, *italic*, `code`, [links](url), and ![images](url). Disable to access advanced unified pipeline settings.")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.superSimple)
          .onChange(async v => { 
            this.plugin.settings.superSimple = v; 
            await this.plugin.saveSettings(); 
            this.display(); // Refresh to show/hide unified settings
          })
      );

    // ── Unified Pipeline Settings (only shown when Super Simple mode is OFF) ──
    if (!this.plugin.settings.superSimple) {
      containerEl.createEl("h3", { text: "Advanced Unified Pipeline Settings" });
      containerEl.createEl("p", { 
        text: "These settings require Super Simple mode to be disabled. They use AST-based markdown processing.",
        cls: "setting-item-description"
      });

      new Setting(containerEl)
        .setName("Use unified pipeline")
        .setDesc("Use AST-based stripping via unified + strip-markdown")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.useUnified)
            .onChange(async v => { this.plugin.settings.useUnified = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Parse GFM")
        .setDesc("Strip GitHub Flavored Markdown (tables, task lists, strikethrough)")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.parseGfm)
            .onChange(async v => { this.plugin.settings.parseGfm = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Remove frontmatter")
        .setDesc("Strip YAML frontmatter blocks")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.removeFrontmatter)
            .onChange(async v => { this.plugin.settings.removeFrontmatter = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Remove math")
        .setDesc("Strip inline `$…$` and block `$$…$$` math")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.removeMath)
            .onChange(async v => { this.plugin.settings.removeMath = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Remove footnotes")
        .setDesc("Strip footnote definitions and refs")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.removeFootnotes)
            .onChange(async v => { this.plugin.settings.removeFootnotes = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("De-highlight `==highlight==`")
        .setDesc("Remove GFM highlight markers (`==text==` → `text`)")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.dehighlight)
            .onChange(async v => { this.plugin.settings.dehighlight = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Remove forward-ref markers `[>]`")
        .setDesc("Strip custom `[>]` prefixes from lines")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.removeForwardRefs)
            .onChange(async v => { this.plugin.settings.removeForwardRefs = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Unwrap block math fences")
        .setDesc("Remove `$$` markers around math blocks")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.unwrapBlockMath)
            .onChange(async v => { this.plugin.settings.unwrapBlockMath = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Remove list numbers")
        .setDesc("Strip leading `1. `, `2. `, etc.")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.removeListNumbers)
            .onChange(async v => { this.plugin.settings.removeListNumbers = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Normalize dashes")
        .setDesc("Turn `---word---` into `word`, collapse runs of hyphens")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.normalizeDashes)
            .onChange(async v => { this.plugin.settings.normalizeDashes = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Strip hashtags")
        .setDesc("Remove leading `#` from words")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.stripHashtags)
            .onChange(async v => { this.plugin.settings.stripHashtags = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Strip mentions")
        .setDesc("Remove leading `@` from words")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.stripMentions)
            .onChange(async v => { this.plugin.settings.stripMentions = v; await this.plugin.saveSettings(); })
        );

      new Setting(containerEl)
        .setName("Sanitize math commands")
        .setDesc("Remove LaTeX commands (`\\quad`, `\\text`, `\\int`, etc.)")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.sanitizeMath)
            .onChange(async v => { this.plugin.settings.sanitizeMath = v; await this.plugin.saveSettings(); })
        );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // OBSIDIAN-SPECIFIC SETTINGS (FR-1)
    // These work in ALL modes (Super Simple, Unified, and removeMd)
    // ═══════════════════════════════════════════════════════════════════════

    containerEl.createEl("h3", { text: "Obsidian-Specific Stripping" });
    containerEl.createEl("p", { 
      text: "Settings for stripping Obsidian-specific markup (wiki links, block IDs, embeds).",
      cls: "setting-item-description"
    });

    // ── Feature 1: Internal Links [[...]] ──

    new Setting(containerEl)
      .setName("Strip internal links")
      .setDesc("Convert [[Link]] and [[Link|Alias]] to plain text")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.stripInternalLinks)
          .onChange(async v => { 
            this.plugin.settings.stripInternalLinks = v; 
            await this.plugin.saveSettings(); 
            this.display(); // Refresh to show/hide sub-settings
          })
      );

    if (this.plugin.settings.stripInternalLinks) {
      new Setting(containerEl)
        .setName("Internal link mode")
        .setDesc("How to extract text from [[Link|Alias]] format")
        .setClass("setting-indent")
        .addDropdown(d =>
          d
            .addOption("alias", "Prefer alias, else target")
            .addOption("target", "Always use target (ignore alias)")
            .setValue(this.plugin.settings.internalLinkMode)
            .onChange(async v => { 
              this.plugin.settings.internalLinkMode = v as InternalLinkMode; 
              await this.plugin.saveSettings(); 
            })
        );

      new Setting(containerEl)
        .setName("Strip paths to basename")
        .setDesc("[[Folder/Sub/Page]] → Page (remove path)")
        .setClass("setting-indent")
        .addToggle(t =>
          t
            .setValue(this.plugin.settings.stripPathsToBasename)
            .onChange(async v => { 
              this.plugin.settings.stripPathsToBasename = v; 
              await this.plugin.saveSettings(); 
            })
        );

      new Setting(containerEl)
        .setName("Heading/block part handling")
        .setDesc("How to handle [[Page#Heading]] or [[Page^blockid]]")
        .setClass("setting-indent")
        .addDropdown(d =>
          d
            .addOption("keep", "Keep full reference")
            .addOption("page", "Strip to page name only")
            .addOption("part", "Use heading/block part only")
            .setValue(this.plugin.settings.headingBlockPartMode)
            .onChange(async v => { 
              this.plugin.settings.headingBlockPartMode = v as HeadingBlockPartMode; 
              await this.plugin.saveSettings(); 
            })
        );
    }

    // ── Feature 2: Block IDs ^abcdef ──

    new Setting(containerEl)
      .setName("Strip block IDs")
      .setDesc("Remove ^blockid markers (e.g., `text ^abc123` → `text`)")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.stripBlockIds)
          .onChange(async v => { 
            this.plugin.settings.stripBlockIds = v; 
            await this.plugin.saveSettings(); 
            this.display(); // Refresh to show/hide sub-settings
          })
      );

    if (this.plugin.settings.stripBlockIds) {
      new Setting(containerEl)
        .setName("Block ID stripping mode")
        .setDesc("Where to strip block IDs (end-of-line is safer)")
        .setClass("setting-indent")
        .addDropdown(d =>
          d
            .addOption("eol", "End of line only (safe)")
            .addOption("anywhere", "Anywhere in line (advanced)")
            .setValue(this.plugin.settings.blockIdMode)
            .onChange(async v => { 
              this.plugin.settings.blockIdMode = v as BlockIdMode; 
              await this.plugin.saveSettings(); 
            })
        );
    }

    // ── Feature 3: Embeds ![[...]] ──

    new Setting(containerEl)
      .setName("Handle embeds")
      .setDesc("Process ![[Embed]] syntax (images, notes, etc.)")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.handleEmbeds)
          .onChange(async v => { 
            this.plugin.settings.handleEmbeds = v; 
            await this.plugin.saveSettings(); 
            this.display(); // Refresh to show/hide sub-settings
          })
      );

    if (this.plugin.settings.handleEmbeds) {
      new Setting(containerEl)
        .setName("Embed handling mode")
        .setDesc("How to handle ![[Embed]] syntax")
        .setClass("setting-indent")
        .addDropdown(d =>
          d
            .addOption("remove", "Remove entirely")
            .addOption("placeholder", "Replace with [embedded: Name]")
            .addOption("linktext", "Convert to link text")
            .setValue(this.plugin.settings.embedMode)
            .onChange(async v => { 
              this.plugin.settings.embedMode = v as EmbedMode; 
              await this.plugin.saveSettings(); 
            })
        );
    }

    // ── Feature 4: Non-markdown file targets ──

    new Setting(containerEl)
      .setName("Handle non-markdown targets")
      .setDesc("Special handling for [[file.pdf]], [[image.png]], etc.")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.handleNonMdTargets)
          .onChange(async v => { 
            this.plugin.settings.handleNonMdTargets = v; 
            await this.plugin.saveSettings(); 
            this.display(); // Refresh to show/hide sub-settings
          })
      );

    if (this.plugin.settings.handleNonMdTargets) {
      new Setting(containerEl)
        .setName("Non-markdown target mode")
        .setDesc("How to display non-markdown file references")
        .setClass("setting-indent")
        .addDropdown(d =>
          d
            .addOption("alias", "Alias if present, else filename")
            .addOption("filename", "Always use filename")
            .addOption("remove", "Remove entirely")
            .addOption("placeholder", "Use [file: name] placeholder")
            .setValue(this.plugin.settings.nonMdTargetMode)
            .onChange(async v => { 
              this.plugin.settings.nonMdTargetMode = v as NonMdTargetMode; 
              await this.plugin.saveSettings(); 
            })
        );
    }
  }
}
