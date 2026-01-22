# Word Generator Plugin

A plugin for generating custom words based on patterns of characters, inspired by [kozuka](https://kozuka.kmwc.org/).

## Manual installation

- Download the latest release from the [Releases](https://github.com/SpagoAsparago/obsidian-word-generator-plugin/releases) page
- Unzip the file and extract the `word-generator-plugin` folder to your vault `VaultFolder/.obsidian/plugins/`. 
- It might be necessary to enable hidden folders in your file explorer to see the `.obsidian` folder.
- Enable community plugins in Obsidian settings and turn on the plugin in Options>Community Plugins

## Building from source

- Make sure your NodeJS is at least v16 (`node --version`).
- Clone this repository inside a folder named `word-generator-plugin` in `.obsidian/plugins`.
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.

## How to use

Click the new icon with the book at the bottom of the sidebar or use Ctrl+P to execute the command `Open word generator view`. You can turn on 'Show all file types' in `Files & Links` Obsidian settings to see your exported configuration files.

### Main pattern
Words are built using this sequence. Use <b>/</b> to separate characters or groups with an equal chance of selection.
### Referenced Patterns
Patterns are useful to avoid your main pattern getting too long. Create new patterns with the <b>+</b> button, then you can reference it in the main pattern by enclosing its name in curly brackets, e.g., `{C}`. 
Patterns can also contain split choices with <b>/</b>.
### Optional sequence
Enclose characters or patterns in parentheses to give them a 50% chance of being used. Only works in the main pattern.
### Settings
Access settings via the button at the top, the command or the Community Plugins tab. 
You can set the total word count, toggle "one word per line," and filter out duplicate results.
### Exporting and importing patterns
Use the save icon button to create a configuration file containing your settings, patterns and main pattern. The import button will load this JSON file and overwrite your current patterns.
### Automated saving
Patterns and the main pattern are automatically saved to Obsidian settings when closing the word generator page or selecting the <b>Generate</b> button, as well as importing from a configuration file.

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request if you have ideas, bug fixes, or improvements.
