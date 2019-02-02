# minecraft-documentation-extractor
This is a script which extracts data from minecraft addon documentation.

To use this script, you need the `Documentation_Scripting.html` (or `Documentation_Addons.html`) file from the [vanilla addon files](https://aka.ms/MinecraftBetaBehaviors).

## Using as a command line program
First, install this script globally with:
```
npm install -g minecraft-documentation-extractor
```

You can then execute
```
minecraft-documentation-extractor --scripting ./Documentation_Scripting.html
```
to parse the `Documentation_Scripting.html` file and print the documentation in JSON format to the console. To write the output to a file `documentation.json`, do
```
minecraft-documentation-extractor --scripting ./Documentation_Scripting.html ./documentation.json
```

## Using as a library
Install it with:
```
npm install minecraft-documentation-extractor
```
Example code:
```javascript
const { MinecraftScriptDocumentation } = require("minecraft-documentation-extractor");

async function myFunction() {
    const documentation = await MinecraftScriptDocumentation.fromFile("./Documentation_Scripting.html");
    for (const component of documentation.components) {
        console.log(component.name);
    }
}
```

## License
You can use this script under the terms of the GNU General Public License, either version 3, or (at your option) any later version. For more information see [LICENSE](./LICENSE).