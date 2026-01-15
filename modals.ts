import { AbstractInputSuggest, App, FuzzySuggestModal, Modal, Notice, Setting, SuggestModal, TFile, TFolder } from "obsidian";
import { exportPatternData } from 'view';

// Modal for exporting configuration
export class SelectFolderModal extends Modal {

    public saveFileName: string = 'patterns-config'
    public folderPath: string = ''
    constructor(app: App, private patternData: exportPatternData) {
        super(app);
    }

    onOpen() {
        const folders = this.app.vault.getAllFolders();
        const { contentEl } = this;
        contentEl.createEl('p', { cls: 'modal-header', text: 'Save configuration to your vault' });
        contentEl.createEl('div', { cls: 'modal-div', text: 'If a file with the same name already exists, it will be overwritten' });

        //Filename input field
        new Setting(contentEl)
            .setName('Name')
            .setDesc('JSON extension will be added when saving')
            .addText(text => text
                .setPlaceholder('my-patterns')
                .setValue(this.saveFileName)
                .onChange(async (value) => {
                    this.saveFileName = value;
                })
            );
        //Folder select field
        new Setting(contentEl)
            .setName('Folder')
            .setDesc('A new folder will be created if it does\'t exist')
            .addSearch(search => {
                search.setPlaceholder('Search folder...');
                search.setValue(this.folderPath);
                search.onChange(value => this.folderPath = value);
                new FolderSuggest(this.app, search.inputEl);
            });

        const saveButton = contentEl.createEl('button', { cls: 'cta-mod', text: 'Save' });
        saveButton.addEventListener('click', () => {
            this.saveFile(this.patternData, this.saveFileName, this.folderPath);
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    async saveFile(data: exportPatternData, fileName: string, folder: string) {
        if (fileName.trim() === '') {
            new Notice('File name can\'t be empty');
            return
        }
        //Create the input folder if it doesn't exist
        if (folder !== '' && this.app.vault.getFolderByPath(folder) === null) {
            await this.app.vault.createFolder(folder);
        }

        // Stringify content to json
        const content = JSON.stringify(data, null, 2);

        // Remove slashes to avoid path formatting issues
        let filePath = folder.trim();
        if (filePath.startsWith('/')) filePath = filePath.slice(1);
        if (filePath.endsWith('/')) filePath = filePath.slice(0, -1);
        // Build the filePath with the fileName and json extension
        filePath = filePath ? `${filePath}/${fileName}.json` : `${fileName}.json`;

        // Check if a file with the same name already exists
        const abstractFile = this.app.vault.getAbstractFileByPath(filePath)
        if (abstractFile instanceof TFile) {
            // Overwrite the file
            await this.app.vault.modify(abstractFile, content);
            new Notice(`File ${filePath} has been updated`);
        } else {
            // Create the new file
            await this.app.vault.create(filePath, content);
            new Notice(`File ${filePath} has been saved`)
        }
    }
}

// Modal for importing configuration
export class JSONFileSuggestModal extends SuggestModal<TFile> {
    constructor(app: App, private onSelect: (file: TFile) => void) {
        super(app);
        this.setPlaceholder("Type json file name...");
    }

    // Get all json files for the select
    getSuggestions(query: string): TFile[] | Promise<TFile[]> {
        const allFiles = this.app.vault.getFiles();
        let jsonFiles = [];

        // Filter based on .json and search query
        for (const file of allFiles) {
            const lowerQuery = query.toLowerCase();
            // Checks that the file is not in /.obsidian or /.trash
            const hiddenFolderRegex = /(^|\/)\.[^\/.]+/;
            if (file.extension === 'json' &&
                file.path.toLowerCase().includes(lowerQuery)) {

                if (!hiddenFolderRegex.test(file.path)) {
                    jsonFiles.push(file);
                }
            }
            // Stop search for too many files for optimization
            if (jsonFiles.length >= 100) break;
        }
        // Sort by path length so files in root appear first
        return jsonFiles.sort((a, b) => a.path.length - b.path.length).slice(0, 10);
    }

    onChooseSuggestion(item: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item);
    }

    // Display the select in the modal
    renderSuggestion(value: TFile, el: HTMLElement): void {
        el.createDiv({ cls: 'suggestion-content' }, (content) => {
            content.createDiv({
                text: value.name,
                cls: 'suggestion-title',
            });
        })
    }

    onNoSuggestion(): void {
        this.resultContainerEl.empty();
        const suggestionEmptyDiv = this.resultContainerEl.createDiv({
            text: 'No JSON files have been found in your vault.',
            cls: 'suggestion-empty',
        });
        suggestionEmptyDiv.createEl('p', { text: 'Move configuration files in your vault to load them.' })
    }
}

// Class for the folder select in the modal
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    constructor(app: App, private textInputEl: HTMLInputElement) {
        super(app, textInputEl);
    }

    getSuggestions(query: string): TFolder[] {
        const folders = this.app.vault.getAllFolders();
        const lowerCaseQuery = query.toLowerCase();

        // Filter results based on the user's search text
        return folders.filter(folder =>
            folder.path.toLowerCase().includes(lowerCaseQuery)
        );
    }

    renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path);
    }

    // What happens when a user clicks a suggestion
    selectSuggestion(folder: TFolder): void {
        this.textInputEl.value = folder.path;
        this.textInputEl.trigger("input"); // Triggers the onChange in the Setting
        this.close();
    }
}