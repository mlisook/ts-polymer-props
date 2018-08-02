# ts-polymer-props

This is a VS Code extension which may save developers using Typescript to develop Polymer project time. The extension allows the developer to copy property declarations between Polymer's `static get properties() { ... }` block and Typescript class property declarations.

## Features
### Copy properties from Polymer to TS
This feature reads Polymer's `static get properties() { ... }` block and adds in Typescript class property declarations.
#### Before
```js
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
#### After
```js
class SomeElement extends PolymerElement {
    
  aBasicTsPropNotNeededByPolymer: string;
  // polyProp
  author_email!: string;
  // polyProp
  author_name!: string;
  // polyProp
  comment_text!: string;
  // polyProp {value: () => { return []; }, notify: true, observer: "_commentsChanged"}
  _commentsForPost!: Icomment[];
  // polyProp { value: "", notify: true }
  _error_message!: string;
  // polyProp
  _isValid: boolean;
  // polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  // polyProp { value: "", notify: true }
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
This feature reads Typescript class property declarations marked with the // polyProp comment and copies them to Polymer's `static get properties() { ... }` block.
#### Before
```js
class SomeElement extends PolymerElement {
    
  aBasicTsPropNotNeededByPolymer: string;
  anotherBasicTsProp: string;
  // polyProp
  author_email!: string;
  // polyProp
  author_name!: string;
  // polyProp
  comment_text!: string;
  // polyProp { value: () => { return []; }, notify: true, observer: "_commentsChanged" }
  _commentsForPost!: Icomment[];
  // polyProp { value: "", notify: true }
  _error_message!: string;
  // polyProp
  _isValid: boolean;
  // polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  // polyProp { value: "", notify: true }
  _success_message!: string;

  static get properties() {
      return {
          postId: Number
      };
  }
```
#### After
```js
  aBasicTsPropNotNeededByPolymer: string;
  anotherBasicTsProp: string;
  // polyProp
  author_email!: string;
  // polyProp
  author_name!: string;
  // polyProp
  comment_text!: string;
  // polyProp {value: () => { return []; }, notify: true, observer: "_commentsChanged"}
  _commentsForPost!: Icomment[];
  // polyProp { value: "", notify: true }
  _error_message!: string;
  // polyProp
  _isValid: boolean;
  // polyProp { value: 0, notify: true, observer: "_postIdObserver" }
  postId!: number;
  // polyProp { value: "", notify: true }
  _success_message!: string;
  
  static get properties() {
      return {
          author_email: String,
          author_name: String,
          comment_text: String,
          // @type {Icomment[]}
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
## Release Notes

