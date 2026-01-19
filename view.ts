import WordGeneratorPlugin from 'main';
import { JSONFileSuggestModal, SelectFolderModal } from 'modals';
import { ItemView, WorkspaceLeaf, Notice, setIcon, Setting, setTooltip, TextComponent, debounce, MarkdownRenderer, Component } from 'obsidian';
// @ts-ignore
import helpMarkdown from './help.md';

export const VIEW_WORD_GENERATOR = 'example-view';

interface PatternRow {
    container: HTMLElement;
    nameInput: HTMLInputElement;
    contentInput: HTMLInputElement;
    deleteBtn: HTMLButtonElement;
}

interface PatternSequence {
    content: string
    isOptional: boolean;
}

export interface PatternLetters {
    name: string;
    letters: string[];
}

export interface exportPatternData {
    patterns: {
        name: string;
        pattern: string;
    }[]
    settings: {
        numWords: number;
        newLineEach: boolean;
        filterDuplicates: boolean;
    }
}

export class WordGeneratorView extends ItemView {
    private plugin: WordGeneratorPlugin;
    private patterns: PatternRow[] = [];
    private mainPatternInput: TextComponent;
    private outputText: HTMLElement;
    private errorMessage: HTMLElement;
    private patternsContainer: HTMLElement;

    // Debounce for optimized saving of mainPattern
    private debouncedSave = debounce(async () => {
        await this.plugin.saveSettings();
    }, 750);

    constructor(leaf: WorkspaceLeaf, plugin: WordGeneratorPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_WORD_GENERATOR;
    }

    getDisplayText() {
        return 'Word Generator';
    }

    async onOpen() {
        //Create header and default text
        const { contentEl } = this;
        contentEl.empty();

        const viewHeader = contentEl.createDiv({ cls: 'word-gen-custom-header' });
        viewHeader.createEl('h4', { text: 'Word Generator' });

        // Close view button
        const closeViewButton = viewHeader.createEl('button', { cls: 'close-view-button' });
        setIcon(closeViewButton, 'x');
        setTooltip(closeViewButton, 'Close this view');
        closeViewButton.addEventListener('click', () => {
            this.plugin.deactivateView();
        })
        // Plugin settings button
        const pluginSettingsButton = viewHeader.createEl('button', { cls: 'mod-cta' })
        setIcon(pluginSettingsButton, 'settings');
        setTooltip(pluginSettingsButton, 'Plugin Settings');
        pluginSettingsButton.addEventListener('click', () => {
            // Open settings tab via command
            (this.app as any).commands.executeCommandById(`${this.plugin.manifest.id}:open-word-generator-settings`)
        })


        contentEl.createEl('p', { text: 'Generate new words with custom patterns' });
        const howToUseDiv = contentEl.createDiv({ cls: 'how-to-use-div' });
        MarkdownRenderer.render(
            this.app,
            helpMarkdown,
            howToUseDiv,
            '',
            new Component()
        )

        this.patternsContainer = contentEl.createSpan({ cls: 'pattern-container' });
        // Check if stored patterns from plugin settings are empty
        if (this.plugin.settings.patterns.length === 0) {
            // Create default patterns
            this.createDefaultRows();
        } else {
            // Load patterns from settings
            this.loadPatternsFromSettings();
        }

        this.errorMessage = contentEl.createEl('p', {
            text: '',
            cls: 'error-message',
        });
        const mainPatternSetting = new Setting(contentEl)
            .setName('Main pattern:')
            .addText(text => {
                this.mainPatternInput = text;
                text
                    .setValue(String(this.plugin.settings.mainPattern)) // Initialize with default 
                    .onChange((value) => {
                        this.plugin.settings.mainPattern = value;
                        // Save settings to disk
                        this.debouncedSave();
                    });

            });
        // Add classes to setting elements for styling
        mainPatternSetting.settingEl.addClass('main-pattern-setting');
        mainPatternSetting.infoEl.addClass('main-pattern-info');
        mainPatternSetting.controlEl.addClass('main-pattern-control');

        const settingsRow = contentEl.createDiv({ cls: 'buttons-div' });
        const generateButton = settingsRow.createEl('button', { cls: 'mod-cta' });
        setIcon(generateButton, 'rotate-ccw');
        setTooltip(generateButton, 'Generate words from main pattern');
        // Text in addition to the icon
        generateButton.createSpan({ text: " Generate", cls: 'btn-icon-text' });

        const addButton = settingsRow.createEl('button', { cls: 'mod-cta ' });
        setIcon(addButton, 'plus');
        setTooltip(addButton, 'Add new pattern');

        const exportButton = settingsRow.createEl('button', { cls: 'mod-cta' });
        setIcon(exportButton, 'save');
        setTooltip(exportButton, 'Save patterns and settings to JSON');

        const importButton = settingsRow.createEl('button', { cls: 'mod-cta' });
        setIcon(importButton, 'upload');
        setTooltip(importButton, 'Import patterns and settings from JSON');

        // Event listeners for buttons
        generateButton.addEventListener('click', async () => {
            // Save patterns to plugin settings
            await this.savePatternsToSettings(this.patterns);
            //Reset error message
            this.errorMessage.textContent = '';
            // Check if word count is valid
            if (!isNaN(this.plugin.settings.wordCount) && this.plugin.settings.wordCount > 0) {
                // Check if main pattern is valid
                if (this.validateMainPattern(this.plugin.settings.mainPattern)) {
                    // Clear previous output and generate new words
                    this.outputText.textContent = '';
                    this.generateWords(this.plugin.settings.wordCount, this.plugin.settings.mainPattern);
                }
            } else {
                this.errorMessage.textContent = 'Invalid number of words to generate';
            }
        });

        addButton.addEventListener('click', () => {
            const row = this.createRow();
            this.patterns.push(row);
        })

        exportButton.addEventListener('click', () => {
            this.errorMessage.textContent = '';
            this.exportSettings();
        });

        importButton.addEventListener('click', () => {
            this.errorMessage.textContent = '';
            this.importSettings();
        });

        this.outputText = contentEl.createEl('p', {
            text: 'No words generated yet',
            cls: 'selectable-text',
        });
    }

    async onClose() {
        // Save local patterns to disk
        this.savePatternsToSettings(this.patterns);
        // Nothing to clean up.
    }

    private createDefaultRows(): void {
        let pName, pContent = '';
        for (let i = 0; i < 3; i++) {
            //Default example values
            switch (i) {
                case 0:
                    pName = 'V';
                    pContent = 'a/e/i/o/u';
                    break;
                case 1:
                    pName = 'C';
                    pContent = 'c/d/k/t';
                    break;
                default:
                    pName = 'M';
                    pContent = 'm/n'
                    break;
            }
            const newRow = this.createRow(pName, pContent)
            this.patterns.push(newRow);
        }
        return;
    }

    // Create a new (empty) pattern and return the row
    private createRow(pName?: string, pContent?: string): PatternRow {
        const row = this.patternsContainer.createDiv({ cls: 'pattern' })
        const nameInput = row.createEl('input', {
            cls: 'pattern-name',
            attr: { type: 'search', placeholder: 'V' }
        })
        if (pName) {
            nameInput.setAttribute('value', pName)
        }

        const contentInput = row.createEl('input', {
            cls: 'pattern-content',
            attr: { type: 'search', placeholder: 'a/e/i/o/u' }
        });
        if (pContent) {
            contentInput.setAttribute('value', pContent)
        }

        const deleteButton = row.createEl('button', {
            cls: 'mod-cta',
            text: 'Remove'
        });
        setIcon(deleteButton, 'circle-x');

        const newRow: PatternRow = {
            container: row,
            nameInput: nameInput,
            contentInput: contentInput,
            deleteBtn: deleteButton
        }

        setTooltip(deleteButton, 'Remove this pattern')
        deleteButton.addEventListener('click', () => {
            this.deletePattern(newRow);
        })

        return newRow;
    }

    // Remove the matching pattern from the array and view
    private deletePattern(inputPattern: PatternRow) {
        // Can't delete the last pattern
        if (this.patterns.length <= 1) {
            this.errorMessage.textContent = 'The last pattern can\'t be removed';
            return;
        }
        const foundPattern = this.patterns.find(pattern =>
            pattern.nameInput.value === inputPattern.nameInput.value &&
            pattern.contentInput.value === inputPattern.contentInput.value);
        if (foundPattern) {
            this.patterns.remove(foundPattern);
            foundPattern.container.remove();
        }
    }

    // Delete all patterns from the array and view
    private deleteAllPatterns() {
        // Remove from view each pattern
        for (const pattern of this.patterns) {
            pattern.container.remove();
        }
        // Empty array
        this.patterns = [];
    }

    private mapPatternRows(localPatternRows: PatternRow[]) {
        const characterSets = new Map();
        for (const pattern of localPatternRows) {
            characterSets.set(
                pattern.nameInput.value, 
                pattern.contentInput.value.split('/'),
            );
        }
        return characterSets;
    }

    // Generate the words using existing patterns
    private generateWords(count: number, mainPattern: string) {

        if (this.checkDuplicatePatternName()) {
            this.errorMessage.textContent = 'Different patterns can\'t have the same name'
            return;
        }
        // Array of objects with pattern name as key and content as value
        const referencedPatterns = this.mapPatternRows(this.patterns);

        // Subdivide the main pattern into an array to construct each word
        const mainPatternSequence = this.parseMainPattern(mainPattern);

        // Generate all the words from the main pattern
        const words: string[] = [];
        for (let i = 0; i < count; i++) {
            let word = '';
            // Get rnd index from 1st Level (split choice)
            const sequence = mainPatternSequence[Math.floor(Math.random() * mainPatternSequence.length)]
            // Parse each element from 2nd Level
            for (const path of sequence) {
                // Get a rnd index from 3rd Level (split choice inside ())
                const index = Math.floor(Math.random()*path.length);
                let newChars = path[index].content;
                // Check for pattern references
                const refPatterns = newChars.match(/\{[^}]+\}/g) || [];
                if (refPatterns.length > 0) {
                    // Substitute references with patterns content
                    for (const ref of refPatterns) {
                        const refContent = referencedPatterns.get(ref.slice(1,-1));
                        const rndId = Math.floor(Math.random()*refContent.length);
                        newChars = newChars.replace(ref, refContent[rndId]);
                    }
                }
                // Only add optional 50% of the time
                if (path[index].isOptional) {
                    if (Math.random() < 0.5) word += newChars; // Add setting for global % chance?
                } else {
                    word += newChars;
                }   
            }
            words.push(word);
        }
        this.writeOutput(words);
    }

    // Display generated words according to settings
    private writeOutput(input: string[]) {
        //Filter duplicates from the array if enabled
        let words = input;
        if (this.plugin.settings.filterDuplicates) {
            words = [...new Set(input)]
        }
        let separator = ' ';
        //Set each new word on a new line if enabled
        if (this.plugin.settings.newLineEach) {
            separator = '\n'
        }

        words.forEach((word) => {
            this.outputText.textContent += word + separator;
        })
    }
    /*
    Returns a 3D array => 1st Level: splits in main pattern
    2nd Level: optional sequences, 3rd Level: split choices between ()
     e.g.; a(b)c(d)/(f)g/(h/i)
    [
        [ [a] ] , [O [b] ], [ [c] ], [O [d] ]
    ],
    [
        [O [f] ] , [ [g] ]
    ],
    [
        [O [h,i] ]
    ] 
    */
    private parseMainPattern(input: string): PatternSequence[][][] {
        const fullSequence: PatternSequence[][][] = [];
        let currentPath: PatternSequence[][] = [];
        let currentText = "";

        const flushText = (isOptional: boolean = false) => {
            if (currentText.length > 0) {
                // A standard segment has only one choice in the 3rd dimension
                currentPath.push([{
                    content: currentText,
                    isOptional: isOptional,
                }]);
                currentText = "";
            }
        };
        let i = 0;
        // Parse every character
        while (i < input.length) {
            const char = input[i];

            if (char === '/') {
                flushText();
                fullSequence.push(currentPath);
                currentPath = [];
                i++;
            }
            else if (char === '(') {
                // Finish any text before the '('
                flushText();
                const endIdx = input.indexOf(')', i);
                const inside = input.substring(i + 1, endIdx);
                // Handle slashes inside parentheses
                const choices = inside.split('/').map(choice => ({
                    content: choice,
                    isOptional: true, // Everything inside () is optional
                    isReference: false
                }));
                // Push the whole group of choices as one segment
                currentPath.push(choices);
                // Skip index after the ')'
                i = endIdx + 1;
            }
            else {
                currentText += char;
                i++;
            }
        }
        flushText();
        if (currentPath.length > 0) fullSequence.push(currentPath);
        return fullSequence;
    }

    // Returns true if there are duplicate names
    private checkDuplicatePatternName(): boolean {
        //If there are duplicates, the set has a different size than the array
        const hasDuplicates = this.patterns.length !== new Set(this.patterns.map(p => p.nameInput.value)).size;
        if (hasDuplicates) {
            this.errorMessage.textContent = 'Different patterns can\'t have the same name';
        }
        return hasDuplicates;
    }
    // Returns true if there are empty names
    private checkEmptyPatternName(): boolean {
        const hasEmptyName = this.patterns.find(pattern => pattern.nameInput.value === '');
        if (hasEmptyName) {
            this.errorMessage.textContent = ('Pattern name can\'t be empty')
            return true;
        }
        return false;
    }

    private validateMainPattern(mainPattern: string): boolean {
        //Empty main pattern
        if (mainPattern === '') {
            this.errorMessage.textContent = 'Main pattern can\'t be empty';
            return false;
        }

        //Check for unclosed round or curly brackets
        if (this.hasUnclosedBrackets(mainPattern, '(') || this.hasUnclosedBrackets(mainPattern, '{')) {
            this.errorMessage.textContent = 'Main pattern is missing a bracket';
            return false;
        }

        if (this.hasNestedParenthesis(mainPattern)) {
            this.errorMessage.textContent = 'Parenthesis nesting is not allowed';
            return false;
        }

        //Regex to capture what's inside the brackets
        const regex = /{(.*?)}/g;
        //Read all pattern names in the main pattern
        const matches = [...mainPattern.matchAll(regex)];
        const parts = new Set(matches.map(m => m[1]));
        //Validate each pattern
        if (parts.size > 0) {
            const invalidPatternRegex = /^\/*$/
            for (const part of parts) {
                //Check if exists a pattern with this name in the array
                const result = this.patterns.find(pattern => pattern.nameInput.value === part)
                //There pattern does not exist in the array
                if (!result) {
                    this.errorMessage.textContent = `Pattern ${part} does not exist`;
                    return false;
                }
                //The pattern exists but the content is empty or only contains /
                if (result && (invalidPatternRegex.test(result.contentInput.value))) {
                    this.errorMessage.textContent = `Pattern ${part} is empty or invalid`;
                    return false;
                }
            };
        }
        return true;
    }

    // Check if the input string has unclosed brackets
    private hasUnclosedBrackets(input: string, start_bracket: string): boolean {
        let counter = 0;
        const end_bracket = (start_bracket == '{' ? '}' : ')');
        for (const char of input) {
            if (char === start_bracket) counter++;
            if (char === end_bracket) counter--;
            if (counter < 0) return true;
        }
        return counter !== 0;
    }

    private hasNestedParenthesis(input: string): boolean {
        let isBracketOpen = false;
        for (const char of input) {
            if (char === '(') {
                if (isBracketOpen) {
                    return true;
                }
                isBracketOpen = true;
            } else if (char === ')') {
                isBracketOpen = false;
            }
        }
        return isBracketOpen;
    }

    private exportSettings() {
        // Check if patterns are valid to be exported
        if (this.checkDuplicatePatternName() || this.checkEmptyPatternName()) {
            return;
        }
        // Convert pattern data to object
        const patternData = this.patterns.map(element => ({
            name: element.nameInput.value,
            pattern: element.contentInput.value,
        }))
        //Add main pattern
        patternData.push({ name: 'main', pattern: this.plugin.settings.mainPattern });
        // Write patterns and settings to JSON
        const exportData: exportPatternData = {
            'patterns': patternData,
            'settings': {
                'numWords': this.plugin.settings.wordCount,
                "newLineEach": this.plugin.settings.newLineEach,
                "filterDuplicates": this.plugin.settings.filterDuplicates,
            }
        }
        //Open modal for file save
        new SelectFolderModal(this.app, exportData).open();
    }

    private importSettings() {

        // Open file selection modal
        new JSONFileSuggestModal(this.app, async (file) => {
            try {
                // Await the file content
                const fileContent = await this.app.vault.read(file);
                // Parse JSON string into array
                const data = JSON.parse(fileContent);
                // Check if the array is valid
                if (this.isValidImportData(data)) {
                    // Write settings 
                    this.plugin.settings.wordCount = data.settings.numWords;
                    this.plugin.settings.filterDuplicates = data.settings.filterDuplicates;
                    this.plugin.settings.newLineEach = data.settings.newLineEach;

                    // Write main pattern
                    const mainPattern = data.patterns.find((p) => p.name === 'main')
                    if (mainPattern) {
                        // Update mainPattern in view and setting value
                        this.plugin.settings.mainPattern = mainPattern.pattern;
                        this.mainPatternInput.setValue(mainPattern.pattern);
                    } else {
                        new Notice('Error: main pattern could not be loaded')
                    }
                    await this.plugin.saveSettings();
                    // Delete existing patterns
                    this.deleteAllPatterns();
                    // Write new patterns
                    for (const pattern of data.patterns) {
                        if (pattern.name !== 'main') {
                            const newRow = this.createRow(pattern.name, pattern.pattern);
                            this.patterns.push(newRow);
                        }
                    }
                    // Save to plugin settings
                    await this.savePatternsToSettings(this.patterns);
                    new Notice('Imported settings and pattern data!')
                } else {
                    new Notice(`Error: selected file contains invalid data`)
                }
            } catch (error) {
                new Notice(`Failed to parse JSON file: ${error}`);
            }
        }).open();
    }

    // Type guard to check that data matches the type of exportPatternData
    private isValidImportData(data: any): data is exportPatternData {
        const hasPatterns = Array.isArray(data.patterns) &&
            data.patterns.every((p: any) => typeof p.name === 'string');
        return hasPatterns &&
            data.settings && typeof data.settings.numWords === 'number';
    }

    // Save patterns to plugin settings
    private async savePatternsToSettings(localPatternRows: PatternRow[]) {
        let stringPatterns: PatternLetters[] = [];
        for (const p of localPatternRows) {
            const row: PatternLetters = {
                name: p.nameInput.value,
                letters: p.contentInput.value.split('/')
            }
            stringPatterns.push(row)
        }
        this.plugin.settings.patterns = stringPatterns;
        await this.plugin.saveSettings();
        return;
    }

    private loadPatternsFromSettings() {
        this.deleteAllPatterns();
        const savedPatterns = this.plugin.settings.patterns;
        for (const p of savedPatterns) {
            const newRow = this.createRow(p.name, p.letters.join('/'))
            this.patterns.push(newRow);
        }
    }
}
