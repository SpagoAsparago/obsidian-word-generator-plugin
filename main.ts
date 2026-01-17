import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { WordGeneratorView, VIEW_WORD_GENERATOR as VIEW_WORD_GENERATOR, PatternLetters } from 'view';

interface WordGeneratorPluginSettings {
	wordCount: number;
	filterDuplicates: boolean;
	newLineEach: boolean;
	mainPattern: string;
	patterns: PatternLetters[];
}

const DEFAULT_SETTINGS: WordGeneratorPluginSettings = {
	wordCount: 100,
	filterDuplicates: true,
	newLineEach: true,
	mainPattern: '{C}{V}{C}',
	patterns: [],
}

export default class WordGeneratorPlugin extends Plugin {
	settings: WordGeneratorPluginSettings;

	async onload() {
		await this.loadSettings();
		// Register view
		this.registerView(
			VIEW_WORD_GENERATOR,
			(leaf) => new WordGeneratorView(leaf, this)
		)

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('book-a', 'Word Generator', (_evt: MouseEvent) => {
			//Activate view
			this.activateView();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Custom commands to open/close the view
		this.addCommand({
			id: 'open-word-generator-view',
			name: 'Open word generator view',
			callback: () => {
				this.activateView();
			}
		});
		this.addCommand({
			id: 'close-word-generator-view',
			name: 'Close word generator view',
			callback: () => {
				this.deactivateView();
			}
		})

		// Add settings tab and relative command
		this.addSettingTab(new WordGeneratorSettingTab(this.app, this));
		this.addCommand({
			id: 'open-word-generator-settings',
			name: 'Open settings',
			callback: () => {
				const setting = (this.app as any).setting;
				setting.open();
				setting.openTabById('word-generator-plugin');
			}
		})
	}

	async onunload() {

	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_WORD_GENERATOR);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			// @ts-ignore: leaf might be null, but Obsidian API handles this
			await leaf.setViewState({ type: VIEW_WORD_GENERATOR, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		// @ts-ignore
		workspace.revealLeaf(leaf);
	}

	async deactivateView() {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_WORD_GENERATOR);
		leaves.forEach((leaf) => leaf.detach());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WordGeneratorSettingTab extends PluginSettingTab {
	plugin: WordGeneratorPlugin;

	constructor(app: App, plugin: WordGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Words Count setting
		new Setting(containerEl)
			.setName('Words Count')
			.setDesc('Number of words to generate')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(String(this.plugin.settings.wordCount))
				.onChange(async (value) => {
					this.plugin.settings.wordCount = parseInt(value);
					await this.plugin.saveSettings();
				})
			);
		// Filter duplicates setting
		new Setting(containerEl)
			.setName('Filter duplicates.')
			.setDesc('Remove duplicated words.Total words count will be lower to avoid infinite loops.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.filterDuplicates)
				.onChange(async (value) => {
					this.plugin.settings.filterDuplicates = value;
					await this.plugin.saveSettings();
				})
			);
		// New line setting
		new Setting(containerEl)
			.setName('New Line for each word')
			.setDesc('Every word will be generated on a new line.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.newLineEach)
				.onChange(async (value) => {
					this.plugin.settings.newLineEach = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
