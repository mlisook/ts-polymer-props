# ts-polymer-props

This is a VS Code extension which may save developers using Typescript to develop a Polymer project some time. The extension allows the developer to copy property declarations between Polymer's `static get properties() { ... }` block and Typescript class property declarations.  It can also build the `$` property declaration for easy access to elements from the template with an id.

<!-- TOC -->

- [ts-polymer-props](#ts-polymer-props)
    - [Command Palette Commands](#command-palette-commands)
    - [Features Documentation](#features-documentation)
        - [Copy properties from Polymer to TS](#copy-properties-from-polymer-to-ts)
            - [Example](#example)
        - [Copy properties from TS to Polymer](#copy-properties-from-ts-to-polymer)
            - [Example](#example-1)
        - [Update Polymer '$' element access property](#update-polymer--element-access-property)
            - [Example](#example-2)
    - [Release Notes](#release-notes)
    - [Support and Issues](#support-and-issues)
    - [Contributing](#contributing)
    - [License](#license)

<!-- /TOC -->

## Command Palette Commands
The extension supplies 3 commands:
* Update TS class properties from Polymer static get properties() block
* Update Polymer static get properties() block from TS class properties
* Update Polymer '$' element access property

## Features Documentation
### Copy properties from Polymer to TS
This feature reads Polymer's `static get properties() { ... }` block and adds in Typescript class property declarations. You can use the feature as many times as needed during development.

You can optionally use `@type {...}` in a jsDoc comment to control the type of the generated property declaration. 

**Access:** choose `Update TS class properties from Polymer static get properties() block` from the command palette.

#### Example
**Before:**
```ts
class SomeElement extends PolymerElement {

  aBasicTsPropNotNeededByPolymer: string;

  static get properties() {
      return {
          postId: {
              type: Number,
              value: 0,
              notify: true,
              observer: "_postIdObserver"
          },
          author_email: String,
          author_name: String,
          comment_text: String,
          _errorMessage: {
              type: String,
              value: "",
              notify: true
          },
          /**
           * message shown after a comment is successfully saved
           */
          _successMessage: {
              type: String,
              value: "",
              notify: true
          },
          _isValid: Boolean,
          // @type {Icomment[]}
          _commentsForPost: {
              type: Array,
              value: () => {
                  return [];
              },
              notify: true,
              observer: "_commentsChanged"
          }
      };
  }
```
**After:**
```ts
class SomeElement extends PolymerElement {
    
  aBasicTsPropNotNeededByPolymer: string;
  // @polyProp
  author_email!: string;
  // @polyProp
  author_name!: string;
  // @polyProp
  comment_text!: string;
  // @polyProp {value: () => { return []; }, notify: true, observer: "_commentsChanged"}
  _commentsForPost!: Icomment[];
  // @polyProp { value: "", notify: true }
  _error_message!: string;
  // @polyProp
  _isValid!: boolean;
  // @polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  /**
   * message shown after a comment is successfully saved
   * @polyProp { value: "", notify: true }
   */
  _success_message!: string;
  
  static get properties() {
      return {
          postId: {
              type: Number,
              value: 0,
              notify: true,
              observer: "_postIdObserver"
          },
          author_email: String,
          author_name: String,
          comment_text: String,
          _errorMessage: {
              type: String,
              value: "",
              notify: true
          },
          /**
           * message shown after a comment is successfully saved
           */
          _successMessage: {
              type: String,
              value: "",
              notify: true
          },
          _isValid: Boolean,
          // @type {Icomment[]}
          _commentsForPost: {
              type: Array,
              value: () => {
                  return [];
              },
              notify: true,
              observer: "_commentsChanged"
          }
      };
  }
```
### Copy properties from TS to Polymer
This feature reads Typescript class property declarations marked with the `@polyProp` comment and copies them to Polymer's `static get properties() { ... }` block.  You may run this command as often as needed during development.

Not every typescript class property is needed in the polymer property block.  For that reason only properties marked with an `@polyProp` comment are copied. The `@polyProp` can be part of a jsDoc comment or just a `// @polyProp` line preceding the property declaration.

`@polyProp` accepts an optional field that can contain polymer specific attributes of the property - value, reflectToAttribute, readOnly, notify, computed, and observer.  Example:
```ts
/**
 * array of franistats avail on this gimfloppy
 * @polyProp { value: ()=>{ return []; }, notify: true }
 */
franistats!: Ifranistat[];
// @polyProp { value: 6500 }
maxTemp!: number;
// @polyProp
lost!: InTranslation;
```

**Access:** choose `Update Polymer static get properties() block from TS class properties` from the command palette.

#### Example
**Before:**
```ts
class SomeElement extends PolymerElement {
    
  aBasicTsPropNotNeededByPolymer: string;
  anotherBasicTsProp: string;
  // @polyProp
  author_email!: string;
  // @polyProp
  author_name!: string;
  // @polyProp
  comment_text!: string;
  /**
   * list of comments for this article
   * @polyProp { value: () => { return []; }, notify: true, observer: "_commentsChanged" }
   */
  _commentsForPost!: Icomment[];
  // @polyProp { value: "", notify: true }
  _error_message!: string;
  // @polyProp
  _isValid: boolean;
  // @polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  // @polyProp { value: "", notify: true }
  _success_message!: string;

  static get properties() {
      return {
          postId: Number
      };
  }
```
**After:**
```ts
  aBasicTsPropNotNeededByPolymer: string;
  anotherBasicTsProp: string;
  // @polyProp
  author_email!: string;
  // @polyProp
  author_name!: string;
  // @polyProp
  comment_text!: string;
  /**
   * list of comments for this article
   * @polyProp { value: () => { return []; }, notify: true, observer: "_commentsChanged" }
   */
  _commentsForPost!: Icomment[];
  // @polyProp { value: "", notify: true }
  _error_message!: string;
  // @polyProp
  _isValid: boolean;
  // @polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  // @polyProp { value: "", notify: true }
  _success_message!: string;
  
  static get properties() {
      return {
          author_email: String,
          author_name: String,
          comment_text: String,
           /**
            * list of comments for this article
            * @type {Icomment[]}
            */
          _commentsForPost: {
              type: Array,
              value: () => {
                  return [];
              },
              notify: true,
              observer: "_commentsChanged"
          },
          _errorMessage: {
              type: String,
              value: "",
              notify: true
          },
          _isValid: Boolean,
          postId: {
              type: Number,
              value: 0,
              notify: true,
              observer: "_postIdObserver"
          },
          _successMessage: {
              type: String,
              value: "",
              notify: true
          }
      };
  }
```
### Update Polymer '$' element access property
This feature reads the template from the `static get template()` construct and finds elements with an id.  It builds an `interface` definition and a property declaration to add to the class.  You may run this command as often as necessary during development.

**Access:** choose `Update Polymer static get properties() block from TS class properties` from the command palette.

#### Example
**Before:**
```ts
class SomeElement extends PolymerElement {
    static get template() {
        return html'
            <div id="foo"></div>
            <a href="bar.html" id="bar">bar</a>
        ';
    }
}
```
**After:**
```ts
interface I$SomeElement {
    foo: HTMLDivElement;
    bar: HTMLAnchorElement;
}

class SomeElement extends PolymerElement {
    static get template() {
        return html'
            <div id="foo"></div>
            <a href="bar.html" id="bar">bar</a>
        ';
    }
    $!: I$SomeElement;
}
```
## Release Notes
0.1.0 - first release, beta 1

## Support and Issues
Support is available by submitting an issue to the [project's Github repo](https://github.com/mlisook/ts-polymer-props/issues).

## Contributing 
Contributions and pull requests are welcome and appreciated.

## License
MIT