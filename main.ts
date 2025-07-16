/*
  Install required dependencies:
    npm install unified remark-parse strip-markdown remark-stringify remark-gfm remark-frontmatter remark-math remark-footnotes

  To satisfy TS for remark plugins, create a file `modules.d.ts` in your plugin folder:
    declare module 'remark-gfm';
    declare module 'remark-frontmatter';
    declare module 'remark-math';
    declare module 'remark-footnotes';
*/

import { Plugin, Notice, Editor, PluginSettingTab, Setting, App } from "obsidian";
import removeMd from "remove-markdown";

// @ts-ignore
import { unified } from "unified";
// @ts-ignore
import remarkParse from "remark-parse";
// @ts-ignore
import remarkGfm from "remark-gfm";
// @ts-ignore
import remarkFrontmatter from "remark-frontmatter";
// @ts-ignore
import remarkMath from "remark-math";
// @ts-ignore
import remarkFootnotes from "remark-footnotes";
// @ts-ignore
import strip from "strip-markdown";
// @ts-ignore
import remarkStringify from "remark-stringify";

interface CopyPlainTextSettings {
  useUnified: boolean;
  parseGfm: boolean;
  removeFrontmatter: boolean;
  removeMath: boolean;
  removeFootnotes: boolean;
  dehighlight: boolean;
  removeForwardRefs: boolean;
  unwrapBlockMath: boolean;
}

const DEFAULT_SETTINGS: CopyPlainTextSettings = {
  useUnified: true,
  parseGfm: true,
  removeFrontmatter: true,
  removeMath: true,
  removeFootnotes: true,
  dehighlight: true,
  removeForwardRefs: true,
  unwrapBlockMath: true,
};

export default class CopyPlaintextPlugin extends Plugin {
  settings: CopyPlainTextSettings;

  async onload() {
    console.log("Copy As PlainText plugin loaded ✅");
    await this.loadSettings();

    this.addCommand({
      id: "copy-plaintext",
      name: "Copy selection as plain-text",
      editorCallback: (editor: Editor) => this.copySelection(editor),
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        if (!editor.getSelection()) return;
        menu.addItem(item =>
          item
            .setTitle("Copy as Plain-Text")
            .setIcon("copy")
            .onClick(() => this.copySelection(editor))
        );
      })
    );

    this.addSettingTab(new CopyPlaintextSettingTab(this.app, this));
  }

  onunload() {
    console.log("Copy As PlainText plugin unloaded 📴");
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
    if (this.settings.useUnified) {
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

  private unifiedStrip(text: string): string {
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
    const file = pipeline.processSync(text);
    let s = String(file);

    // Always‐on cleanup:
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

    // Feature‐gated extras:
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
    containerEl.createEl("h2", { text: "Copy As PlainText Settings" });

    new Setting(containerEl)
      .setName("Use unified pipeline")
      .setDesc("Use AST-based stripping via unified + strip-markdown")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.useUnified)
          .onChange(async v => {
            this.plugin.settings.useUnified = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Parse GFM")
      .setDesc("Strip GitHub Flavored Markdown (tables, task lists, strikethrough)")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.parseGfm)
          .onChange(async v => {
            this.plugin.settings.parseGfm = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove frontmatter")
      .setDesc("Strip YAML frontmatter blocks")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.removeFrontmatter)
          .onChange(async v => {
            this.plugin.settings.removeFrontmatter = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove math")
      .setDesc("Strip inline `$…$` and block `$$…$$` math")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.removeMath)
          .onChange(async v => {
            this.plugin.settings.removeMath = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove footnotes")
      .setDesc("Strip footnote definitions and refs")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.removeFootnotes)
          .onChange(async v => {
            this.plugin.settings.removeFootnotes = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("De-highlight `==highlight==`")
      .setDesc("Remove GFM highlight markers (`==text==` → `text`)")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.dehighlight)
          .onChange(async v => {
            this.plugin.settings.dehighlight = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Remove forward-ref markers `[>]`")
      .setDesc("Strip custom `[>]` prefixes from lines")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.removeForwardRefs)
          .onChange(async v => {
            this.plugin.settings.removeForwardRefs = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Unwrap block math fences")
      .setDesc("Remove `$$` markers around math blocks")
      .addToggle(t =>
        t
          .setValue(this.plugin.settings.unwrapBlockMath)
          .onChange(async v => {
            this.plugin.settings.unwrapBlockMath = v;
            await this.plugin.saveSettings();
          })
      );
  }
}
