# terminal-table-output

Create and print tables in the terminal.

[![NPM](https://nodei.co/npm/terminal-table-output.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/terminal-table-output/)

## Installation

	npm install terminal-table-output

## Usage

Use this syntax
```javascript
var tto = require('terminal-table-output').create();
tto.col('foo')
	.col('bar')
	.col('foobar')
	.row()
	.col('onoff')
	.col('extraextra')
	.line()
	.col('line')
	.col('special')
	.line('(*)')
	.print(true);
```
or this
```javascript
tto.pushrow(['foo', 'bar', 'foobar'])
	.pushrow(['onoff', 'extraextra'])
	.line()
	.pushrow(['line', 'special'])
	.line("(*)")
	.print(true);
```		
both will output
```	
foo   | bar        | foobar
onoff | extraextra |
===========================
line  | special    |
(*)(*)(*)(*)(*)(*)(*)(*)(*)
```

### Functions	
	
#### col(anyString)

col takes any string and pushes this into the last row.

#### row()

row creates a new row, using col after this will push into the new row

#### pushrow(arrayOfStrings)

creates a new row from the array of strings inserted into the function

#### line(anyString)

create a horizontal line in the table output, line takes a string argument as the char of string used in that specific line.

	
## Settings

You can send in a settings object with the create function.  
With these you can set the character that fills the text that has less width than the longest.
And you can set the delimiter between columns.

```javascript
var tto = require('terminal-table-output')
			.create({
				fill: "-",
				border: "/",
				line: ">"
			});
```				
Would output the example above in the following way.
```
foo--/bar-------/foobar
onoff/extraextra/
>>>>>>>>>>>>>>>>>>>>>>>
table/delay-----/
```
	
Default settings  
**fill:** " "  
**border:** " | "  
**line:** "="  

